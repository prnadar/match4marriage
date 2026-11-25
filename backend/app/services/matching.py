"""
Matching engine.

Builds the "My Matches" feed: a ranked list of admin-approved, gender-appropriate
profiles scored against the viewer's own profile and partner preferences.

Pipeline (see `build_match_feed`):
  1. Candidate pool  — same tenant, approved, active, not deleted, not self,
                       opposite gender (when the viewer's gender is male/female).
  2. Preferences     — `partner_prefs` is normalised from whatever shape the
                       client saved (the profile editor writes camelCase strings
                       such as {"ageFrom": "24", "religionPref": "Hindu, Sikh"};
                       older rows use {"min_age": 24, "religions": [...]}).
  3. Hard filters    — candidates inside every stated preference are
                       "preferred" matches.
  4. Scoring         — profile-based compatibility, blended with the reverse
                       direction (does the viewer fit the candidate's prefs?).
  5. Graceful relax  — if too few candidates meet every preference, the best
                       remaining candidates are appended as "broader" matches,
                       labelled with which preference they fall outside of,
                       instead of showing an empty page.

All functions except `generate_daily_matches` / `load_feed_candidates` are pure
(no IO) so they are unit-testable with plain objects or dicts.
"""
from __future__ import annotations

import re
import uuid
from datetime import date
from typing import Any, Iterable
from uuid import UUID

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger(__name__)

# Personality dimension weights from PRD
DIMENSION_WEIGHTS = {
    "values": 0.25,
    "lifestyle": 0.20,
    "family": 0.25,
    "ambition": 0.15,
    "communication": 0.15,
}

# Size of the My Matches feed (best N by score).
DAILY_MATCH_COUNT = 20
# If fewer than this many candidates satisfy every stated preference, top the
# feed up with the best "broader" matches so the page is never empty.
MIN_PREFERRED_BEFORE_BROADER = 6
# Weight of the reverse direction (candidate's prefs vs the viewer) in the
# final score. 0.3 => 70% "how well they fit me", 30% "how well I fit them".
RECIPROCAL_WEIGHT = 0.3
# Upper bound on the candidate rows scored per request (keeps a single feed
# request O(pool) bounded even if the tenant grows large).
MAX_CANDIDATE_POOL = 2000

# ── Religion compatibility map ────────────────────────────────────────────────
# Keys/values use lowercase string versions of Religion enum values.
_COMPATIBLE_RELIGIONS: dict[str, set[str]] = {
    "hindu":     {"hindu", "jain", "buddhist", "sikh"},
    "jain":      {"jain", "hindu", "buddhist"},
    "buddhist":  {"buddhist", "hindu", "jain"},
    "sikh":      {"sikh", "hindu"},
    "christian": {"christian"},
    "muslim":    {"muslim"},
    "parsi":     {"parsi"},
    "jewish":    {"jewish"},
    "other":     {"other"},
}

# ── Diet compatibility map ────────────────────────────────────────────────────
_COMPATIBLE_DIETS: dict[str, set[str]] = {
    "vegetarian":      {"vegetarian", "vegan", "jain_vegetarian"},
    "vegan":           {"vegan", "vegetarian"},
    "jain_vegetarian": {"jain_vegetarian", "vegetarian", "vegan"},
    "non_vegetarian":  {"non_vegetarian", "eggetarian", "vegetarian"},
    "eggetarian":      {"eggetarian", "vegetarian", "non_vegetarian"},
}

# ── Marital status compatibility map ─────────────────────────────────────────
_COMPATIBLE_MARITAL: dict[str, set[str]] = {
    "never_married": {"never_married", "divorced", "widowed", "separated"},
    "divorced":      {"divorced", "never_married", "widowed", "separated", "awaiting_divorce"},
    "widowed":       {"widowed", "never_married", "divorced"},
    "separated":     {"separated", "divorced", "never_married"},
    "awaiting_divorce": {"awaiting_divorce", "divorced", "separated"},
}

# ── Education keywords that indicate a degree-level qualification ─────────────
_DEGREE_KEYWORDS = {
    "bachelor", "master", "phd", "doctor", "mba", "msc", "bsc", "bcom", "ba ",
    "be ", "btech", "mtech", "llb", "llm", "md ", "mbbs", "mca", "bca",
    "postgraduate", "graduate", "degree", "honours", "honors", "professional",
}

# Values that mean "no preference" in a multi-select / free-text pref.
_ANY_VALUES = {"", "any", "all", "doesn't matter", "doesnt matter", "no preference", "open"}

# Country aliases → canonical lowercase name. Onboarding stores long names
# ("United Kingdom"); the partner-prefs picker stores short codes ("UK").
_COUNTRY_ALIASES: dict[str, str] = {
    "uk": "united kingdom", "u.k.": "united kingdom", "gb": "united kingdom",
    "great britain": "united kingdom", "britain": "united kingdom",
    "england": "united kingdom", "scotland": "united kingdom", "wales": "united kingdom",
    "northern ireland": "united kingdom",
    "usa": "united states", "us": "united states", "u.s.": "united states",
    "u.s.a.": "united states", "united states of america": "united states", "america": "united states",
    "uae": "united arab emirates", "u.a.e.": "united arab emirates", "emirates": "united arab emirates",
    "nz": "new zealand",
}

_RELIGION_ALIASES: dict[str, str] = {"christianity": "christian", "islam": "muslim", "jainism": "jain",
                                     "sikhism": "sikh", "buddhism": "buddhist", "hinduism": "hindu",
                                     "zoroastrian": "parsi", "judaism": "jewish"}

_DIET_ALIASES: dict[str, str] = {"jain": "jain_vegetarian", "non_veg": "non_vegetarian",
                                 "nonvegetarian": "non_vegetarian", "veg": "vegetarian",
                                 "egg": "eggetarian", "eggitarian": "eggetarian"}


# ── Small helpers ─────────────────────────────────────────────────────────────

def _attr(obj: Any, key: str, default: Any = None) -> Any:
    """Get attribute from either a dict or a model instance."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)


def _str_val(val: Any) -> str:
    """Safely convert enum or str to lowercase string."""
    if val is None:
        return ""
    return (val.value if hasattr(val, "value") else str(val)).lower().strip()


def _slug(val: Any) -> str:
    """'Non-Vegetarian' -> 'non_vegetarian', 'Never Married' -> 'never_married'."""
    return re.sub(r"[\s\-/]+", "_", _str_val(val)).strip("_")


def _split_multi(val: Any) -> list[str]:
    """Accept a list, a comma/pipe separated string, or a scalar."""
    if val is None:
        return []
    if isinstance(val, (list, tuple, set)):
        items = [str(v) for v in val if v is not None]
    else:
        items = re.split(r"[,|;]", str(val))
    out = [i.strip() for i in items if i and i.strip()]
    return [i for i in out if i.lower() not in _ANY_VALUES]


def _to_int(val: Any) -> int | None:
    if val is None or val == "":
        return None
    try:
        return int(float(str(val).strip()))
    except (TypeError, ValueError):
        return None


def _height_to_cm(val: Any) -> int | None:
    """Accept 170, "170", "170cm", "5ft 8in", "5'8\"", "5 ft"."""
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)):
        return int(val)
    s = str(val).strip().lower()
    m = re.match(r"^(\d+)\s*(?:ft|feet|foot|')\s*(?:(\d+)\s*(?:in|inch|inches|\"|'')?)?$", s)
    if m:
        ft = int(m.group(1))
        inch = int(m.group(2)) if m.group(2) else 0
        return round(ft * 30.48 + inch * 2.54)
    m = re.match(r"^(\d{2,3})(?:\s*cm)?$", s)
    if m:
        return int(m.group(1))
    return None


def normalize_country(val: Any) -> str:
    c = _str_val(val)
    return _COUNTRY_ALIASES.get(c, c)


def normalize_religion(val: Any) -> str:
    r = _str_val(val)
    return _RELIGION_ALIASES.get(r, r)


def normalize_diet(val: Any) -> str:
    d = _slug(val)
    return _DIET_ALIASES.get(d, d)


def age_from_dob(dob: date | None, today: date | None = None) -> int | None:
    if dob is None:
        return None
    t = today or date.today()
    return t.year - dob.year - ((t.month, t.day) < (dob.month, dob.day))


def own_diet(profile: Any) -> str:
    """A member's OWN diet. The profile editor stores it in kundali_data.diet;
    older rows may carry it in family_details.diet."""
    for blob_key in ("kundali_data", "family_details"):
        blob = _attr(profile, blob_key) or {}
        if isinstance(blob, dict) and blob.get("diet"):
            return normalize_diet(blob["diet"])
    return ""


def _title(s: str) -> str:
    return " ".join(w.capitalize() for w in s.replace("_", " ").split())


# ── Partner preference normalisation ─────────────────────────────────────────

def normalize_partner_prefs(prefs: dict[str, Any] | None) -> dict[str, Any]:
    """
    Normalise partner_prefs into a canonical dict:

        min_age, max_age, min_height_cm, max_height_cm : int | None
        religions, marital, diets, countries            : set[str] (empty = any)

    Supports both the profile-editor shape (ageFrom / ageTo / heightFrom /
    heightTo / religionPref / maritalStatus / diet / country — strings, multi
    values comma-separated) and the legacy snake_case shape (min_age /
    max_age / religions / countries / min_height_cm / max_height_cm).
    A pref that spans the editor's full slider range is treated as "any".
    """
    p = prefs or {}
    if not isinstance(p, dict):
        p = {}

    min_age = _to_int(p.get("min_age", p.get("ageFrom")))
    max_age = _to_int(p.get("max_age", p.get("ageTo")))
    if min_age is not None and min_age <= 18:
        min_age = None
    if max_age is not None and max_age >= 70 and "max_age" not in p:
        max_age = None  # editor default (full slider) = no upper bound
    if min_age is not None and max_age is not None and min_age > max_age:
        min_age, max_age = max_age, min_age

    min_h = _height_to_cm(p.get("min_height_cm", p.get("heightFrom")))
    max_h = _height_to_cm(p.get("max_height_cm", p.get("heightTo")))
    if min_h is not None and min_h <= 137 and "min_height_cm" not in p:
        min_h = None  # editor floor (4ft 6in)
    if max_h is not None and max_h >= 213 and "max_height_cm" not in p:
        max_h = None  # editor ceiling (7ft)

    religions = {normalize_religion(r) for r in _split_multi(p.get("religions", p.get("religionPref")))}
    marital = {_slug(m) for m in _split_multi(p.get("marital_statuses", p.get("maritalStatus")))}
    diets = {normalize_diet(d) for d in _split_multi(p.get("diets", p.get("diet")))}
    countries = {normalize_country(c) for c in _split_multi(p.get("countries", p.get("country")))}
    # "Other" in the country picker means "anywhere else too" → no constraint.
    if "other" in countries:
        countries = set()

    return {
        "min_age": min_age,
        "max_age": max_age,
        "min_height_cm": min_h,
        "max_height_cm": max_h,
        "religions": religions,
        "marital": marital,
        "diets": diets,
        "countries": countries,
    }


def has_any_preference(norm: dict[str, Any]) -> bool:
    return any(
        norm.get(k) for k in ("min_age", "max_age", "min_height_cm", "max_height_cm",
                              "religions", "marital", "diets", "countries")
    )


def _ensure_norm(prefs: dict[str, Any] | None) -> dict[str, Any]:
    if isinstance(prefs, dict) and "religions" in prefs and isinstance(prefs.get("religions"), set):
        return prefs
    return normalize_partner_prefs(prefs)


# ── Compatibility scoring ─────────────────────────────────────────────────────

def compute_compatibility(
    profile_a: Any,
    profile_b: Any,
) -> dict[str, Any]:
    """
    Profile-based compatibility of candidate `profile_b` from the point of view
    of `profile_a` (whose partner_prefs are the scoring lens).

    Both arguments can be UserProfile ORM instances or plain dicts with the
    same field names.

    Returns {"score": int 0–100, "breakdown": {factor: points}}.

    Maximum points by factor (total = 100):
        age_preference    25
        religion          20
        location          15
        education         10
        marital_status    10
        diet_lifestyle    10
        height_preference 10
    """
    breakdown: dict[str, int] = {}
    prefs = normalize_partner_prefs(_attr(profile_a, "partner_prefs"))

    # ── 1. Age (max 25) ──────────────────────────────────────────────────────
    age_b = age_from_dob(_attr(profile_b, "date_of_birth"))
    min_age, max_age = prefs["min_age"], prefs["max_age"]
    if age_b is not None and (min_age is not None or max_age is not None):
        lo = min_age if min_age is not None else 18
        hi = max_age if max_age is not None else max(lo + 12, 45)
        if lo <= age_b <= hi:
            mid = (lo + hi) / 2
            span = max(hi - lo, 1)
            closeness = max(0.0, 1.0 - (abs(age_b - mid) / (span / 2)))
            age_pts = int(20 + closeness * 5)                      # 20–25
        else:
            diff = (lo - age_b) if age_b < lo else (age_b - hi)
            age_pts = max(0, 20 - diff * 4)
    elif age_b is not None and age_from_dob(_attr(profile_a, "date_of_birth")) is not None:
        # No stated preference: favour a natural window around the viewer's age.
        diff = abs(age_b - age_from_dob(_attr(profile_a, "date_of_birth")))
        age_pts = 22 if diff <= 3 else 18 if diff <= 6 else max(6, 18 - (diff - 6) * 2)
    else:
        age_pts = 12                                                # neutral — no DOB data
    breakdown["age_preference"] = age_pts

    # ── 2. Religion (max 20) ─────────────────────────────────────────────────
    rel_a = normalize_religion(_attr(profile_a, "religion"))
    rel_b = normalize_religion(_attr(profile_b, "religion"))
    if rel_b and prefs["religions"]:
        if rel_b in prefs["religions"]:
            rel_pts = 20
        elif rel_a and rel_b in _COMPATIBLE_RELIGIONS.get(rel_a, set()):
            rel_pts = 8
        else:
            rel_pts = 0
    elif rel_a and rel_b:
        if rel_a == rel_b:
            rel_pts = 20
        elif rel_b in _COMPATIBLE_RELIGIONS.get(rel_a, set()):
            rel_pts = 10
        else:
            rel_pts = 0
    else:
        rel_pts = 10                                                # neutral — religion unknown
    breakdown["religion"] = rel_pts

    # ── 3. Location (max 15) ─────────────────────────────────────────────────
    city_a = (_attr(profile_a, "city") or "").lower().strip()
    city_b = (_attr(profile_b, "city") or "").lower().strip()
    country_a = normalize_country(_attr(profile_a, "country"))
    country_b = normalize_country(_attr(profile_b, "country"))
    if city_a and city_b and city_a == city_b and (not country_a or country_a == country_b):
        loc_pts = 15
    elif country_b and prefs["countries"]:
        loc_pts = 12 if country_b in prefs["countries"] else 2
    elif country_a and country_b and country_a == country_b:
        loc_pts = 10
    else:
        loc_pts = 5
    breakdown["location"] = loc_pts

    # ── 4. Education (max 10) ────────────────────────────────────────────────
    edu_a = (_attr(profile_a, "education_level") or "").lower()
    edu_b = (_attr(profile_b, "education_level") or "").lower()
    if edu_a and edu_b:
        a_degree = any(kw in edu_a + " " for kw in _DEGREE_KEYWORDS)
        b_degree = any(kw in edu_b + " " for kw in _DEGREE_KEYWORDS)
        edu_pts = 10 if (a_degree and b_degree) else 6 if a_degree == b_degree else 3
    else:
        edu_pts = 5                                                 # neutral — unknown
    breakdown["education"] = edu_pts

    # ── 5. Marital status (max 10) ───────────────────────────────────────────
    ms_a = _slug(_attr(profile_a, "marital_status"))
    ms_b = _slug(_attr(profile_b, "marital_status"))
    if ms_b and prefs["marital"]:
        ms_pts = 10 if ms_b in prefs["marital"] else 0
    elif ms_a and ms_b:
        if ms_a == ms_b:
            ms_pts = 10
        elif ms_b in _COMPATIBLE_MARITAL.get(ms_a, set()):
            ms_pts = 5
        else:
            ms_pts = 0
    else:
        ms_pts = 5
    breakdown["marital_status"] = ms_pts

    # ── 6. Diet (max 10) ─────────────────────────────────────────────────────
    diet_a = own_diet(profile_a)
    diet_b = own_diet(profile_b)
    if diet_b and prefs["diets"]:
        if diet_b in prefs["diets"]:
            diet_pts = 10
        elif diet_a and diet_b in _COMPATIBLE_DIETS.get(diet_a, set()):
            diet_pts = 5
        else:
            diet_pts = 0
    elif diet_a and diet_b:
        if diet_a == diet_b:
            diet_pts = 10
        elif diet_b in _COMPATIBLE_DIETS.get(diet_a, set()):
            diet_pts = 5
        else:
            diet_pts = 0
    else:
        diet_pts = 5
    breakdown["diet_lifestyle"] = diet_pts

    # ── 7. Height (max 10) ───────────────────────────────────────────────────
    height_b = _attr(profile_b, "height_cm")
    min_h, max_h = prefs["min_height_cm"], prefs["max_height_cm"]
    if height_b is not None and (min_h is not None or max_h is not None):
        in_range = not ((min_h is not None and height_b < min_h) or (max_h is not None and height_b > max_h))
        height_pts = 10 if in_range else 0
    else:
        height_pts = 5
    breakdown["height_preference"] = height_pts

    final_score = min(100, max(0, sum(breakdown.values())))
    return {"score": int(final_score), "breakdown": breakdown}


# ── Legacy personality-based scorer (retained for a future quiz pipeline) ────

def compute_personality_compatibility(
    user_scores: dict[str, float],
    candidate_scores: dict[str, float],
) -> tuple[float, dict[str, float]]:
    """
    Weighted 5-dimension personality compatibility score.
    Returns (overall_score_0_to_100, breakdown_dict). Pure function — no IO.
    """
    dimension_map = {
        "values":        ("values_score",               "values_score"),
        "lifestyle":     ("lifestyle_score",             "lifestyle_score"),
        "family":        ("family_expectations_score",   "family_expectations_score"),
        "ambition":      ("ambition_score",              "ambition_score"),
        "communication": ("communication_style_score",   "communication_style_score"),
    }

    breakdown: dict[str, float] = {}
    weighted_sum = 0.0

    for dim, (user_key, cand_key) in dimension_map.items():
        u_val = user_scores.get(user_key) or 0.5
        c_val = candidate_scores.get(cand_key) or 0.5

        similarity = 1.0 - abs(u_val - c_val)          # 0–1
        breakdown[dim] = round(similarity, 3)
        weighted_sum += similarity * DIMENSION_WEIGHTS[dim]

    overall = round(weighted_sum * 100, 1)
    return overall, breakdown


# ── Hard filters ──────────────────────────────────────────────────────────────

def hard_filter_failures(profile: Any, prefs: dict[str, Any] | None) -> list[str]:
    """
    Return the list of stated preferences the candidate falls OUTSIDE of
    ("age", "religion", "height", "country", "marital_status", "diet").
    Empty list = passes every hard filter. Missing candidate data never fails
    a filter (we don't punish incomplete profiles for being incomplete).
    """
    norm = _ensure_norm(prefs)
    failures: list[str] = []

    age = age_from_dob(_attr(profile, "date_of_birth"))
    if age is not None:
        if (norm["min_age"] is not None and age < norm["min_age"]) or (
            norm["max_age"] is not None and age > norm["max_age"]
        ):
            failures.append("age")

    rel = normalize_religion(_attr(profile, "religion"))
    if norm["religions"] and rel and rel not in norm["religions"]:
        failures.append("religion")

    h = _attr(profile, "height_cm")
    if h is not None and (
        (norm["min_height_cm"] is not None and h < norm["min_height_cm"])
        or (norm["max_height_cm"] is not None and h > norm["max_height_cm"])
    ):
        failures.append("height")

    country = normalize_country(_attr(profile, "country"))
    if norm["countries"] and country and country not in norm["countries"]:
        failures.append("country")

    ms = _slug(_attr(profile, "marital_status"))
    if norm["marital"] and ms and ms not in norm["marital"]:
        failures.append("marital_status")

    diet = own_diet(profile)
    if norm["diets"] and diet and diet not in norm["diets"]:
        failures.append("diet")

    return failures


def passes_hard_filters(profile: Any, prefs: dict[str, Any]) -> bool:
    """True if the candidate satisfies every stated partner preference."""
    return not hard_filter_failures(profile, prefs)


# ── "Why you match" reasons ───────────────────────────────────────────────────

def match_reasons(viewer: Any, cand: Any, limit: int = 4) -> list[str]:
    """Short human-readable reasons, strongest first."""
    prefs = normalize_partner_prefs(_attr(viewer, "partner_prefs"))
    reasons: list[tuple[int, str]] = []

    age = age_from_dob(_attr(cand, "date_of_birth"))
    if age is not None and (prefs["min_age"] is not None or prefs["max_age"] is not None):
        lo = prefs["min_age"] if prefs["min_age"] is not None else 18
        hi = prefs["max_age"]
        if lo <= age and (hi is None or age <= hi):
            rng = f"{lo}–{hi}" if hi is not None else f"{lo}+"
            reasons.append((90, f"Age {age} fits your {rng} preference"))

    rel_a = normalize_religion(_attr(viewer, "religion"))
    rel_b = normalize_religion(_attr(cand, "religion"))
    if rel_b:
        if rel_a and rel_a == rel_b:
            reasons.append((85, f"Both {_title(rel_b)}"))
        elif prefs["religions"] and rel_b in prefs["religions"]:
            reasons.append((80, f"{_title(rel_b)}, as you prefer"))
        elif rel_a and rel_b in _COMPATIBLE_RELIGIONS.get(rel_a, set()):
            reasons.append((40, "Compatible faith backgrounds"))

    city_a = (_attr(viewer, "city") or "").strip()
    city_b = (_attr(cand, "city") or "").strip()
    country_a = normalize_country(_attr(viewer, "country"))
    country_b = normalize_country(_attr(cand, "country"))
    if city_a and city_b and city_a.lower() == city_b.lower():
        reasons.append((75, f"Both in {city_b.title()}"))
    elif country_b and prefs["countries"] and country_b in prefs["countries"]:
        reasons.append((60, f"Lives in {_title(country_b)}, as you prefer"))
    elif country_a and country_b and country_a == country_b:
        reasons.append((55, f"Both based in {_title(country_b)}"))

    diet_a, diet_b = own_diet(viewer), own_diet(cand)
    if diet_b:
        if diet_a and diet_a == diet_b:
            reasons.append((50, f"Both {_title(diet_b).lower()}"))
        elif prefs["diets"] and diet_b in prefs["diets"]:
            reasons.append((45, "Diet matches your preference"))

    mt_a = _str_val(_attr(viewer, "mother_tongue"))
    mt_b = _str_val(_attr(cand, "mother_tongue"))
    if mt_a and mt_b and mt_a == mt_b:
        reasons.append((48, f"Both speak {_title(mt_b)}"))

    edu_a = (_attr(viewer, "education_level") or "").lower()
    edu_b = (_attr(cand, "education_level") or "").lower()
    if edu_a and edu_b and any(k in edu_a + " " for k in _DEGREE_KEYWORDS) and any(
        k in edu_b + " " for k in _DEGREE_KEYWORDS
    ):
        reasons.append((35, "Both degree-educated"))

    h = _attr(cand, "height_cm")
    if h is not None and (prefs["min_height_cm"] is not None or prefs["max_height_cm"] is not None):
        if not hard_filter_failures({"height_cm": h}, prefs):
            reasons.append((30, "Height within your preference"))

    ms_b = _slug(_attr(cand, "marital_status"))
    if ms_b and prefs["marital"] and ms_b in prefs["marital"]:
        reasons.append((25, f"{_title(ms_b)}, as you prefer"))

    # Reciprocity — the viewer also fits what the candidate is looking for.
    cand_prefs = normalize_partner_prefs(_attr(cand, "partner_prefs"))
    if has_any_preference(cand_prefs) and not hard_filter_failures(viewer, cand_prefs):
        reasons.append((70, "You fit their preferences too"))

    reasons.sort(key=lambda r: r[0], reverse=True)
    seen: set[str] = set()
    out: list[str] = []
    for _, text in reasons:
        if text not in seen:
            seen.add(text)
            out.append(text)
        if len(out) >= limit:
            break
    return out


_FAILURE_LABELS = {
    "age": "age range",
    "religion": "religion",
    "height": "height",
    "country": "country",
    "marital_status": "marital status",
    "diet": "diet",
}


def describe_relaxed(failures: Iterable[str]) -> list[str]:
    return [_FAILURE_LABELS.get(f, f) for f in failures]


# ── Ranking (pure) ────────────────────────────────────────────────────────────

def opposite_gender(gender: Any) -> str | None:
    g = _str_val(gender)
    if g == "male":
        return "female"
    if g == "female":
        return "male"
    return None


def rank_candidates(
    viewer: Any,
    candidates: Iterable[Any],
    limit: int = DAILY_MATCH_COUNT,
    min_preferred: int = MIN_PREFERRED_BEFORE_BROADER,
) -> list[dict[str, Any]]:
    """
    Score and rank candidates for `viewer`. Pure — no IO.

    Each result: {profile, score, breakdown, reasons, tier, relaxed}
      tier    = "preferred" (meets every stated preference) | "broader"
      relaxed = human labels of the preferences a broader match falls outside

    Gender: when the viewer is male/female only the opposite gender is ranked
    (callers should already filter in SQL; this is a defensive second check).
    Ordering: all preferred matches by score desc, then — only if fewer than
    `min_preferred` preferred matches exist — the best broader matches.
    """
    want_gender = opposite_gender(_attr(viewer, "gender"))
    viewer_id = _attr(viewer, "user_id")
    prefs = normalize_partner_prefs(_attr(viewer, "partner_prefs"))

    preferred: list[dict[str, Any]] = []
    broader: list[dict[str, Any]] = []
    for cand in candidates:
        if viewer_id is not None and _attr(cand, "user_id") == viewer_id:
            continue
        if want_gender is not None and _str_val(_attr(cand, "gender")) != want_gender:
            continue

        forward = compute_compatibility(viewer, cand)
        reverse = compute_compatibility(cand, viewer)
        score = round((1 - RECIPROCAL_WEIGHT) * forward["score"] + RECIPROCAL_WEIGHT * reverse["score"])
        failures = hard_filter_failures(cand, prefs)
        entry = {
            "profile": cand,
            "score": int(max(0, min(100, score))),
            "breakdown": forward["breakdown"],
            "reasons": match_reasons(viewer, cand),
            "tier": "preferred" if not failures else "broader",
            "relaxed": describe_relaxed(failures),
        }
        (broader if failures else preferred).append(entry)

    def _key(e: dict[str, Any]) -> tuple:
        # Score desc, then more complete profiles first, then stable by id.
        return (-e["score"], -int(_attr(e["profile"], "completeness_score") or 0),
                str(_attr(e["profile"], "user_id") or ""))

    preferred.sort(key=_key)
    # Broader matches: fewer relaxed preferences first, then score.
    broader.sort(key=lambda e: (len(e["relaxed"]),) + _key(e))

    out = preferred[:limit]
    if len(preferred) < min_preferred:
        out += broader[: max(0, limit - len(out))]
    return out


# ── Profile card (shared by Browse and My Matches) ────────────────────────────

def primary_photo_url(photos: list[dict[str, Any]] | None) -> str | None:
    """Non-premium primary photo (premium photos are never a card thumbnail)."""
    main = [p for p in (photos or []) if isinstance(p, dict) and not p.get("is_premium")]
    for p in main:
        if p.get("is_primary") and p.get("url"):
            return p.get("url")
    for p in main:
        if p.get("url"):
            return p.get("url")
    return None


def build_profile_card(profile: Any):
    """Build the public ProfileCard for a UserProfile (ORM instance)."""
    from app.schemas.user import ProfileCard

    return ProfileCard(
        user_id=profile.user_id,
        first_name=profile.first_name,
        age=age_from_dob(profile.date_of_birth),
        city=profile.city,
        state=profile.state,
        occupation=profile.occupation,
        education_level=profile.education_level,
        religion=profile.religion,
        primary_photo_url=primary_photo_url(profile.photos),
        completeness_score=profile.completeness_score or 0,
        is_verified=(profile.verification_status == "approved"),
    )


# ── IO: candidate pool + persistence ─────────────────────────────────────────

async def load_feed_candidates(viewer: Any, tenant_id: UUID, db: Any) -> list[Any]:
    """Approved, active, non-deleted, same-tenant, gender-appropriate profiles."""
    from sqlalchemy import select
    from app.models.user import Gender, User, UserProfile

    q = (
        select(UserProfile)
        .join(User, User.id == UserProfile.user_id)
        .where(
            UserProfile.tenant_id == tenant_id,
            UserProfile.user_id != viewer.user_id,
            UserProfile.deleted_at.is_(None),
            UserProfile.verification_status == "approved",
            User.deleted_at.is_(None),
            User.is_active.is_(True),
        )
    )
    want = opposite_gender(viewer.gender)
    if want is not None:
        q = q.where(UserProfile.gender == Gender(want))
    q = q.order_by(UserProfile.created_at.desc()).limit(MAX_CANDIDATE_POOL)
    return list((await db.execute(q)).scalars().all())


async def persist_daily_matches(
    viewer_id: UUID,
    tenant_id: UUID,
    ranked: list[dict[str, Any]],
    db: Any,
) -> dict[UUID, Any]:
    """
    Best-effort upsert of today's feed into `matches` (one row per ordered
    pair — the table has a UNIQUE(tenant_id, user_a_id, user_b_id), so the
    old insert-per-day approach raised IntegrityError from day two onward,
    which poisoned the session and blanked the dashboard).

    Runs inside a SAVEPOINT so any failure is contained and the feed is still
    returned. Returns {candidate_user_id: Match row} for rows it could load.
    """
    if not ranked:
        return {}
    from sqlalchemy import func, select
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from app.models.match import Match, MatchStatus

    today_str = date.today().isoformat()
    rows = [
        {
            "id": uuid.uuid4(),
            "tenant_id": tenant_id,
            "user_a_id": viewer_id,
            "user_b_id": _attr(e["profile"], "user_id"),
            "compatibility_score": float(e["score"]),
            "compatibility_breakdown": e["breakdown"],
            "status": MatchStatus.PENDING,
            "match_date": today_str,
            "a_super_liked": False,
            "b_super_liked": False,
        }
        for e in ranked
    ]
    try:
        async with db.begin_nested():
            stmt = pg_insert(Match).values(rows)
            stmt = stmt.on_conflict_do_update(
                index_elements=["tenant_id", "user_a_id", "user_b_id"],
                set_={
                    "compatibility_score": stmt.excluded.compatibility_score,
                    "compatibility_breakdown": stmt.excluded.compatibility_breakdown,
                    "match_date": stmt.excluded.match_date,
                    "deleted_at": None,
                    "updated_at": func.now(),
                },
            )
            await db.execute(stmt)
        found = (await db.execute(
            select(Match).where(
                Match.tenant_id == tenant_id,
                Match.user_a_id == viewer_id,
                Match.user_b_id.in_([r["user_b_id"] for r in rows]),
            )
        )).scalars().all()
        return {m.user_b_id: m for m in found}
    except Exception as exc:  # pragma: no cover — defensive; feed still renders
        logger.warning("persist_daily_matches_failed", user_id=str(viewer_id), error=str(exc))
        return {}


async def generate_daily_matches(
    user_id: UUID,
    tenant_id: UUID,
    db: Any,
) -> list[dict[str, Any]]:
    """
    Compute (and best-effort persist) the ranked match list for a user.
    Returns [{user_id, compatibility_score, breakdown, tier, reasons, relaxed}].
    Kept for a future scheduled job; the API calls `build_match_feed` directly.
    """
    from sqlalchemy import select
    from app.models.user import UserProfile

    viewer = (await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id, UserProfile.deleted_at.is_(None))
    )).scalar_one_or_none()
    if viewer is None:
        logger.warning("no_profile_for_user", user_id=str(user_id))
        return []
    candidates = await load_feed_candidates(viewer, tenant_id, db)
    ranked = rank_candidates(viewer, candidates)
    await persist_daily_matches(user_id, tenant_id, ranked, db)
    logger.info("daily_matches_generated", user_id=str(user_id), count=len(ranked))
    return [
        {
            "user_id": str(e["profile"].user_id),
            "compatibility_score": e["score"],
            "breakdown": e["breakdown"],
            "tier": e["tier"],
            "reasons": e["reasons"],
            "relaxed": e["relaxed"],
        }
        for e in ranked
    ]


def compute_kundali_score(
    user_birth: dict[str, Any],
    candidate_birth: dict[str, Any],
) -> dict[str, Any]:
    """
    36-point Guna Milan system.
    Returns score, breakdown, and dosha flags.
    Placeholder — integrate certified Jyotish API in Sprint 2.
    """
    return {
        "total_points": 0,
        "max_points": 36,
        "is_manglik_compatible": True,
        "nadi_dosha": False,
        "guna_breakdown": {},
        "recommendation": "pending",
    }
