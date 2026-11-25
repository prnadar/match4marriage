"""
Matching engine unit tests — pure functions, no IO.

The three personality-score compatibility tests at the bottom are skipped:
compute_compatibility was rewritten to take UserProfile objects rather
than Big-Five score dicts, and the algorithm now blends age / religion /
location / education / marital_status / diet / height instead of summing
weighted dimension scores. The old tests are kept for reference until
someone writes the equivalent suite against the current signature.
"""
import pytest
from app.services.matching import compute_compatibility, passes_hard_filters, DIMENSION_WEIGHTS
from datetime import date


@pytest.mark.skip(reason="compute_compatibility signature changed: now takes UserProfile, not score dicts")
def test_compatibility_identical_profiles():
    scores = {
        "values_score": 0.8,
        "lifestyle_score": 0.7,
        "family_expectations_score": 0.9,
        "ambition_score": 0.6,
        "communication_style_score": 0.75,
    }
    overall, breakdown = compute_compatibility(scores, scores)
    assert overall == 100.0
    for dim in breakdown:
        assert breakdown[dim] == 1.0


@pytest.mark.skip(reason="compute_compatibility signature changed: now takes UserProfile, not score dicts")
def test_compatibility_opposite_profiles():
    user_scores = {
        "values_score": 1.0,
        "lifestyle_score": 1.0,
        "family_expectations_score": 1.0,
        "ambition_score": 1.0,
        "communication_style_score": 1.0,
    }
    cand_scores = {
        "values_score": 0.0,
        "lifestyle_score": 0.0,
        "family_expectations_score": 0.0,
        "ambition_score": 0.0,
        "communication_style_score": 0.0,
    }
    overall, breakdown = compute_compatibility(user_scores, cand_scores)
    assert overall == 0.0


def test_compatibility_weights_sum_to_one():
    """Dimension weights must sum to 1.0."""
    total = sum(DIMENSION_WEIGHTS.values())
    assert abs(total - 1.0) < 1e-9


@pytest.mark.skip(reason="compute_compatibility signature changed: now takes UserProfile, not score dicts")
def test_compatibility_score_in_range():
    import random
    random.seed(42)
    for _ in range(100):
        u = {k: random.random() for k in [
            "values_score", "lifestyle_score", "family_expectations_score",
            "ambition_score", "communication_style_score"
        ]}
        c = {k: random.random() for k in u}
        score, _ = compute_compatibility(u, c)
        assert 0.0 <= score <= 100.0


class MockProfile:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)


def test_hard_filter_age_pass():
    profile = MockProfile(
        date_of_birth=date(1998, 1, 1),
        religion="hindu",
        height_cm=165,
        country="India",
    )
    prefs = {"min_age": 24, "max_age": 32}
    assert passes_hard_filters(profile, prefs) is True


def test_hard_filter_age_fail():
    profile = MockProfile(
        date_of_birth=date(1980, 1, 1),  # ~45 years old
        religion=None,
        height_cm=None,
        country="India",
    )
    prefs = {"min_age": 24, "max_age": 35}
    assert passes_hard_filters(profile, prefs) is False


def test_hard_filter_religion_fail():
    profile = MockProfile(
        date_of_birth=date(1995, 1, 1),
        religion="muslim",
        height_cm=170,
        country="India",
    )
    prefs = {"religions": ["hindu", "sikh"]}
    assert passes_hard_filters(profile, prefs) is False


def test_hard_filter_no_prefs_always_passes():
    profile = MockProfile(
        date_of_birth=date(1995, 1, 1),
        religion="christian",
        height_cm=170,
        country="India",
    )
    assert passes_hard_filters(profile, {}) is True


# ── Partner-pref normalisation + My Matches ranking ──────────────────────────
import uuid as _uuid

from app.services.matching import (
    build_profile_card,
    hard_filter_failures,
    match_reasons,
    normalize_partner_prefs,
    primary_photo_url,
    rank_candidates,
)


def _dob(age: int) -> date:
    # Jan 1 birthday => already had this year's birthday, so exactly `age`.
    return date(date.today().year - age, 1, 1)


def _profile(**kw):
    base = dict(
        user_id=_uuid.uuid4(), gender="female", date_of_birth=_dob(28), religion="hindu",
        city="London", country="United Kingdom", height_cm=165, marital_status="never_married",
        education_level="Master's", mother_tongue="Tamil", partner_prefs={}, family_details={},
        kundali_data={"diet": "Vegetarian"}, completeness_score=80,
    )
    base.update(kw)
    return MockProfile(**base)


def test_normalize_editor_shape_prefs():
    """The profile editor saves camelCase strings; matching must understand them."""
    norm = normalize_partner_prefs({
        "ageFrom": "25", "ageTo": "32", "heightFrom": "5ft 2in", "heightTo": "6ft 0in",
        "religionPref": "Hindu, Sikh", "maritalStatus": "Never Married, Divorced",
        "diet": "Vegetarian, Non-Vegetarian", "country": "UK, India",
    })
    assert norm["min_age"] == 25 and norm["max_age"] == 32
    assert norm["min_height_cm"] == 157 and norm["max_height_cm"] == 183
    assert norm["religions"] == {"hindu", "sikh"}
    assert norm["marital"] == {"never_married", "divorced"}
    assert norm["diets"] == {"vegetarian", "non_vegetarian"}
    assert norm["countries"] == {"united kingdom", "india"}


def test_editor_full_range_defaults_are_no_constraint():
    norm = normalize_partner_prefs({"ageFrom": "18", "ageTo": "70", "heightFrom": "4ft 6in",
                                    "heightTo": "7ft 0in", "country": "Other"})
    assert norm["min_age"] is None and norm["max_age"] is None
    assert norm["min_height_cm"] is None and norm["max_height_cm"] is None
    assert norm["countries"] == set()


def test_hard_filters_editor_prefs_and_country_alias():
    cand = _profile(religion="sikh", country="United Kingdom")
    assert hard_filter_failures(cand, {"religionPref": "Hindu, Sikh", "country": "UK"}) == []
    assert hard_filter_failures(cand, {"religionPref": "Christian"}) == ["religion"]


def test_rank_opposite_gender_only_and_sorted():
    viewer = _profile(gender="male", partner_prefs={"ageFrom": "24", "ageTo": "32"})
    good = _profile(gender="female", date_of_birth=_dob(28))
    ok = _profile(gender="female", date_of_birth=_dob(31), religion="christian", city="Leeds")
    same_gender = _profile(gender="male")
    ranked = rank_candidates(viewer, [ok, same_gender, good])
    ids = [e["profile"].user_id for e in ranked]
    assert same_gender.user_id not in ids
    assert ids[0] == good.user_id
    assert all(e["tier"] == "preferred" for e in ranked)
    assert ranked[0]["score"] >= ranked[-1]["score"]


def test_rank_falls_back_to_broader_matches():
    """Strict prefs that nobody meets must not produce an empty feed."""
    viewer = _profile(gender="male", partner_prefs={"religionPref": "Jain", "ageFrom": "22", "ageTo": "24"})
    cands = [_profile(gender="female", religion="hindu", date_of_birth=_dob(a)) for a in (27, 29, 35)]
    ranked = rank_candidates(viewer, cands)
    assert len(ranked) == 3
    assert all(e["tier"] == "broader" for e in ranked)
    assert "religion" in ranked[0]["relaxed"]


def test_rank_no_broader_when_enough_preferred():
    viewer = _profile(gender="male", partner_prefs={"religionPref": "Hindu"})
    cands = [_profile(gender="female") for _ in range(7)] + [_profile(gender="female", religion="muslim")]
    ranked = rank_candidates(viewer, cands, min_preferred=6)
    assert len(ranked) == 7 and all(e["tier"] == "preferred" for e in ranked)


def test_match_reasons_are_human_readable():
    viewer = _profile(gender="male", partner_prefs={"ageFrom": "24", "ageTo": "32"})
    cand = _profile(gender="female", partner_prefs={"religionPref": "Hindu"})
    reasons = match_reasons(viewer, cand)
    assert reasons and len(reasons) <= 4
    assert any("Hindu" in r for r in reasons)


def test_primary_photo_never_premium():
    photos = [
        {"url": "p.jpg", "is_primary": True, "is_premium": True},
        {"url": "a.jpg"},
        {"url": "b.jpg", "is_primary": True},
    ]
    assert primary_photo_url(photos) == "b.jpg"
    assert primary_photo_url([{"url": "x.jpg", "is_premium": True}]) is None


def test_build_profile_card():
    p = _profile(first_name="Asha", state=None, occupation="Doctor", photos=[{"url": "a.jpg"}],
                 verification_status="approved")
    card = build_profile_card(p)
    assert card.first_name == "Asha" and card.age == 28 and card.is_verified is True
    assert card.primary_photo_url == "a.jpg"
