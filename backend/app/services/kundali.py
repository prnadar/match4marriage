"""
Kundali matching service powered by VedAstro.
Provides 36-point Guna Milan (Ashtakoot) matching using the open-source
VedAstro library (vedastro.org — MIT licensed, free API).

Birth details required per user:
  - date_of_birth (date)
  - birth_time (str HH:MM, 24h)
  - birth_city (str)
  - birth_latitude (float)
  - birth_longitude (float)
  - birth_timezone_offset (str, e.g. "+05:30")
"""
from __future__ import annotations

from datetime import date
from typing import Any

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)
settings = get_settings()

# Minimum guna score for a recommended match (out of 36)
MIN_RECOMMENDED_GUNA = 18

# ── 8 Kuta categories and their max points ────────────────────────────────────
KUTA_MAX_POINTS: dict[str, int] = {
    "varna": 1,
    "vashya": 2,
    "tara": 3,
    "yoni": 4,
    "graha_maitri": 5,
    "gana": 6,
    "bhakoot": 7,
    "nadi": 8,
}
TOTAL_MAX_POINTS = 36


def _format_birth_time(dob: date, birth_time: str, tz_offset: str) -> str:
    """
    Convert our DB fields into VedAstro's time format: "HH:mm/DD/MM/YYYY/±HH:MM"
    birth_time: "14:30" (24h)
    tz_offset: "+05:30" or "-04:00"
    """
    return f"{birth_time}/{dob.strftime('%d/%m/%Y')}/{tz_offset}"


async def compute_kundali_match(
    person_a: dict[str, Any],
    person_b: dict[str, Any],
) -> dict[str, Any]:
    """
    Compute full Ashtakoot Guna Milan between two people using VedAstro.

    Each person dict must contain:
        date_of_birth: date
        birth_time: str  ("HH:MM")
        birth_city: str
        birth_latitude: float
        birth_longitude: float
        birth_timezone_offset: str  ("+05:30")

    Returns:
        {
            "total_points": int (0-36),
            "max_points": 36,
            "kuta_breakdown": { "varna": {...}, "vashya": {...}, ... },
            "is_manglik_a": bool | None,
            "is_manglik_b": bool | None,
            "nadi_dosha": bool,
            "recommendation": "highly_recommended" | "recommended" | "neutral" | "not_recommended",
            "raw_report": dict  (full VedAstro response),
            "source": "vedastro",
        }
    """
    try:
        from vedastro import Calculate, GeoLocation, Time

        Calculate.SetAPIKey(settings.VEDASTRO_API_KEY)

        geo_a = GeoLocation(
            person_a["birth_city"],
            person_a["birth_longitude"],
            person_a["birth_latitude"],
        )
        geo_b = GeoLocation(
            person_b["birth_city"],
            person_b["birth_longitude"],
            person_b["birth_latitude"],
        )

        time_str_a = _format_birth_time(
            person_a["date_of_birth"],
            person_a["birth_time"],
            person_a["birth_timezone_offset"],
        )
        time_str_b = _format_birth_time(
            person_b["date_of_birth"],
            person_b["birth_time"],
            person_b["birth_timezone_offset"],
        )

        birth_time_a = Time(time_str_a, geo_a)
        birth_time_b = Time(time_str_b, geo_b)

        # VedAstro returns full kuta match report
        raw_report = Calculate.MatchReport(birth_time_a, birth_time_b)

        return _parse_match_report(raw_report)

    except ImportError:
        logger.warning("vedastro_not_installed", msg="vedastro package not found, using fallback")
        return _fallback_empty_response("vedastro_not_installed")

    except Exception as exc:
        logger.error("kundali_match_failed", error=str(exc), exc_info=True)
        return _fallback_empty_response(f"error: {str(exc)}")


def _parse_match_report(raw_report: Any) -> dict[str, Any]:
    """
    Parse VedAstro MatchReport response into our standardised format.
    VedAstro returns varied structures — handle gracefully.
    """
    try:
        # If raw_report is a dict, try to extract kuta data
        if isinstance(raw_report, dict):
            return _extract_from_dict(raw_report)

        # If it's a list of match results
        if isinstance(raw_report, list):
            return _extract_from_list(raw_report)

        # Fallback: store the raw response and return neutral
        logger.info("kundali_raw_type", raw_type=type(raw_report).__name__)
        return {
            "total_points": 0,
            "max_points": TOTAL_MAX_POINTS,
            "kuta_breakdown": {},
            "is_manglik_a": None,
            "is_manglik_b": None,
            "nadi_dosha": False,
            "recommendation": "pending",
            "raw_report": _safe_serialize(raw_report),
            "source": "vedastro",
        }
    except Exception as exc:
        logger.error("kundali_parse_failed", error=str(exc))
        return _fallback_empty_response(f"parse_error: {str(exc)}")


def _extract_from_dict(data: dict[str, Any]) -> dict[str, Any]:
    """Extract kuta scores from a dict-style VedAstro response."""
    total_points = 0
    kuta_breakdown: dict[str, Any] = {}

    # Look for common VedAstro keys
    for kuta_name, max_pts in KUTA_MAX_POINTS.items():
        # VedAstro may use various key formats
        for key_variant in [kuta_name, kuta_name.title(), kuta_name.upper()]:
            if key_variant in data:
                val = data[key_variant]
                score = val if isinstance(val, (int, float)) else 0
                kuta_breakdown[kuta_name] = {
                    "score": score,
                    "max": max_pts,
                    "description": _kuta_description(kuta_name),
                }
                total_points += score
                break

    # If we couldn't extract individual kutas, look for a total
    if not kuta_breakdown and "TotalPoints" in data:
        total_points = int(data["TotalPoints"])
    elif not kuta_breakdown and "total" in data:
        total_points = int(data["total"])

    nadi_score = kuta_breakdown.get("nadi", {}).get("score", 0)

    return {
        "total_points": int(total_points),
        "max_points": TOTAL_MAX_POINTS,
        "kuta_breakdown": kuta_breakdown,
        "is_manglik_a": data.get("IsManglikA") or data.get("is_manglik_a"),
        "is_manglik_b": data.get("IsManglikB") or data.get("is_manglik_b"),
        "nadi_dosha": nadi_score == 0,
        "recommendation": _get_recommendation(int(total_points)),
        "raw_report": data,
        "source": "vedastro",
    }


def _extract_from_list(data: list[Any]) -> dict[str, Any]:
    """Extract kuta scores from a list-style VedAstro response."""
    total_points = 0
    kuta_breakdown: dict[str, Any] = {}

    for item in data:
        if isinstance(item, dict):
            name = (
                item.get("Name", "")
                or item.get("name", "")
                or item.get("kuta", "")
            ).lower().replace(" ", "_")
            score = item.get("Score", item.get("score", item.get("points", 0)))
            max_pts = item.get("MaxScore", item.get("max", KUTA_MAX_POINTS.get(name, 0)))

            if name:
                kuta_breakdown[name] = {
                    "score": score,
                    "max": max_pts,
                    "description": _kuta_description(name),
                }
                total_points += score

    nadi_score = kuta_breakdown.get("nadi", {}).get("score", 0)

    return {
        "total_points": int(total_points),
        "max_points": TOTAL_MAX_POINTS,
        "kuta_breakdown": kuta_breakdown,
        "is_manglik_a": None,
        "is_manglik_b": None,
        "nadi_dosha": nadi_score == 0,
        "recommendation": _get_recommendation(int(total_points)),
        "raw_report": data,
        "source": "vedastro",
    }


def _get_recommendation(total_points: int) -> str:
    """Map guna score to human-readable recommendation."""
    if total_points >= 28:
        return "highly_recommended"
    if total_points >= MIN_RECOMMENDED_GUNA:
        return "recommended"
    if total_points >= 12:
        return "neutral"
    return "not_recommended"


def _kuta_description(kuta: str) -> str:
    """Brief explanation of each kuta for the frontend."""
    descriptions = {
        "varna": "Spiritual compatibility and ego levels",
        "vashya": "Mutual attraction and dominance",
        "tara": "Destiny and luck compatibility",
        "yoni": "Physical and sexual compatibility",
        "graha_maitri": "Mental compatibility and friendship",
        "gana": "Temperament and behaviour match",
        "bhakoot": "Love, health, and financial prosperity",
        "nadi": "Health of offspring and genetic compatibility",
    }
    return descriptions.get(kuta, "")


def _fallback_empty_response(reason: str) -> dict[str, Any]:
    """Return a safe empty response when VedAstro is unavailable."""
    return {
        "total_points": 0,
        "max_points": TOTAL_MAX_POINTS,
        "kuta_breakdown": {},
        "is_manglik_a": None,
        "is_manglik_b": None,
        "nadi_dosha": False,
        "recommendation": "pending",
        "raw_report": {"error": reason},
        "source": "fallback",
    }


def _safe_serialize(obj: Any) -> Any:
    """Safely convert VedAstro objects to JSON-serializable form."""
    try:
        if isinstance(obj, (dict, list, str, int, float, bool, type(None))):
            return obj
        return str(obj)
    except Exception:
        return "unserializable"


def kundali_score_to_compatibility_points(total_guna: int, max_points: int = 15) -> int:
    """
    Convert 36-point guna score to compatibility engine points (0-max_points).
    Used by compute_compatibility() to factor kundali into the overall score.
    """
    if total_guna <= 0:
        return 0
    ratio = total_guna / TOTAL_MAX_POINTS
    return int(round(ratio * max_points))
