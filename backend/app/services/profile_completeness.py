"""
Profile-completeness helper.

Returns a 0–100 score reflecting how many of the core profile fields are
populated. Used to drive the completeness banner on the dashboard and to
gate features that require a fleshed-out profile.
"""
from __future__ import annotations


def compute_profile_completeness(profile) -> int:
    """
    Compute the % completeness of a UserProfile. Returns an integer in
    the range [0, 100].
    """
    fields = [
        profile.first_name,
        profile.last_name,
        profile.date_of_birth,
        profile.gender,
        profile.city,
        profile.state,
        profile.religion,
        profile.mother_tongue,
        profile.height_cm,
        profile.education_level,
        profile.occupation,
        profile.bio,
        # ``photos`` is a list — pass it through directly so the empty-check
        # below treats an empty list as "not filled". ``bool(profile.photos)``
        # would have returned ``False`` for an empty list and then
        # ``False is not None and != "" and != []`` is True, so empty
        # profiles incorrectly received +1.
        profile.photos,
    ]
    filled = sum(1 for f in fields if f is not None and f != "" and f != [])
    return int((filled / len(fields)) * 100)
