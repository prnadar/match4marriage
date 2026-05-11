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
