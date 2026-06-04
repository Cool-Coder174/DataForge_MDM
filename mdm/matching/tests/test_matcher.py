"""Unit tests for the MDM matching + survivorship engine.

Run with: pytest -q   (from repo root)
"""
import os
import sys

import pytest

# Make `matching` importable whether run from repo root or package dir.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from matching import (  # noqa: E402
    normalize,
    token_set_similarity,
    fuzzy_ratio,
    match_score,
    find_candidates,
    build_golden_record,
)


# --------------------------------------------------------------- normalize
@pytest.mark.parametrize("raw,expected", [
    ("  Creative Mobile  Technologies, L.L.C. ", "creative mobile technologies l l c"),
    ("Astoria", "astoria"),
    ("UPPER East   Side", "upper east side"),
    (None, ""),
    ("", ""),
])
def test_normalize(raw, expected):
    assert normalize(raw) == expected


def test_normalize_drop_stopwords():
    assert normalize("VeriFone Inc", drop_stopwords=True) == "verifone"


# --------------------------------------------------------------- token/fuzzy
def test_token_set_similarity_identical():
    assert token_set_similarity("Midtown Center", "Midtown Center") == 1.0


def test_token_set_similarity_partial():
    s = token_set_similarity("Upper East Side North", "Upper East Side South")
    assert 0.4 < s < 1.0


def test_fuzzy_ratio_close():
    assert fuzzy_ratio("Midtown Center", "Midtown Cntr") > 0.8


def test_fuzzy_ratio_disjoint():
    assert fuzzy_ratio("Astoria", "JFK Airport") < 0.4


# --------------------------------------------------------------- match_score
def test_exact_normalized_match_is_one():
    score, reason = match_score("Astoria", "  astoria ")
    assert score == 1.0
    assert "exact" in reason


def test_typo_scores_high():
    score, _ = match_score("Midtown Center", "Midtown Cntr")
    assert score >= 0.80


def test_unrelated_scores_low():
    score, _ = match_score("Astoria", "Battery Park City")
    assert score < 0.5


# --------------------------------------------------------------- candidates
def test_find_candidates_ranks_and_filters():
    records = [
        {"id": 1, "name": "Midtown Center"},
        {"id": 2, "name": "Midtown Cntr"},
        {"id": 3, "name": "Battery Park City"},
        {"id": 4, "name": "midtown  center"},
    ]
    query = {"id": None, "name": "Midtown Center"}
    cands = find_candidates(query, records, key_field="name", id_field="id",
                            threshold=0.8)
    ids = [c["id"] for c in cands]
    assert 1 in ids and 4 in ids   # exact/near-exact
    assert 3 not in ids            # unrelated filtered out
    assert cands[0]["match_score"] >= cands[-1]["match_score"]


def test_find_candidates_excludes_self():
    records = [{"id": 5, "name": "Astoria"}]
    query = {"id": 5, "name": "Astoria"}
    assert find_candidates(query, records, "name", "id") == []


# --------------------------------------------------------------- survivorship
def test_golden_prefers_fewer_nulls():
    records = [
        {"id": 1, "vendor_name": "VeriFone", "vendor_code": None,
         "tech_provider": None, "source_system": "manual_entry", "updated_at": "2024-02-12"},
        {"id": 2, "vendor_name": "VeriFone Inc", "vendor_code": "VTS",
         "tech_provider": "VeriFone", "source_system": "tlc_registry", "updated_at": "2024-01-02"},
    ]
    golden = build_golden_record(records, attrs=["vendor_name", "vendor_code", "tech_provider"])
    assert golden["survivor_id"] == 2          # fewer nulls wins
    assert golden["vendor_code"] == "VTS"
    assert set(golden["source_ids"]) == {1, 2}  # original ids preserved


def test_golden_breaks_tie_by_trusted_source():
    records = [
        {"id": 10, "vendor_name": "Myle", "vendor_code": "MYLE",
         "tech_provider": "Myle", "source_system": "manual_entry", "updated_at": "2024-03-01"},
        {"id": 11, "vendor_name": "Myle Technologies", "vendor_code": "MYLE",
         "tech_provider": "Myle", "source_system": "tlc_registry", "updated_at": "2023-11-15"},
    ]
    golden = build_golden_record(records, attrs=["vendor_name", "vendor_code", "tech_provider"])
    # Same null count -> more trusted source (tlc_registry) survives.
    assert golden["survivor_id"] == 11


def test_golden_attribute_best_of_breed():
    records = [
        {"id": 1, "zone_name": "Astoria", "borough": None, "service_zone": "Boro Zone",
         "source_system": "partner_feed", "updated_at": "2024-02-10"},
        {"id": 2, "zone_name": "Astoria", "borough": "Queens", "service_zone": None,
         "source_system": "tlc_registry", "updated_at": "2024-01-02"},
    ]
    golden = build_golden_record(records, attrs=["zone_name", "borough", "service_zone"])
    assert golden["borough"] == "Queens"          # filled from rec 2
    assert golden["service_zone"] == "Boro Zone"  # filled from rec 1
