"""Survivorship rules: build a golden record from a survivor + duplicates.

Rules (in priority order):
  1. Prefer the record with fewer NULL/empty attributes (most complete).
  2. On a tie, prefer the most recently updated trusted source.
  3. Preserve original source IDs from every contributing record.

For each attribute, the value is taken from the highest-ranked record that has a
non-empty value (attribute-level survivorship / "best of breed").
"""
from __future__ import annotations

from typing import Sequence

# Source systems ranked by trust (higher = more trusted).
_SOURCE_TRUST = {
    "tlc_registry": 3,
    "partner_feed": 2,
    "manual_entry": 1,
}


def _null_count(rec: dict, attrs: Sequence[str]) -> int:
    return sum(1 for a in attrs if not rec.get(a))


def _trust(rec: dict) -> int:
    return _SOURCE_TRUST.get(str(rec.get("source_system", "")).lower(), 0)


def _updated_at(rec: dict) -> str:
    # ISO-ish strings sort lexicographically; missing sorts lowest.
    return str(rec.get("updated_at") or "")


def rank_records(records: Sequence[dict], attrs: Sequence[str]) -> list[dict]:
    """Rank records best-first per the survivorship priority."""
    return sorted(
        records,
        key=lambda r: (_null_count(r, attrs), -_trust(r), _negate(_updated_at(r))),
    )


def _negate(s: str):
    # Sort updated_at descending by inverting comparison via a wrapper key.
    return _Reversed(s)


class _Reversed:
    __slots__ = ("s",)

    def __init__(self, s):
        self.s = s

    def __lt__(self, other):
        return self.s > other.s

    def __eq__(self, other):
        return self.s == other.s


def build_golden_record(
    records: Sequence[dict],
    attrs: Sequence[str],
    id_field: str = "id",
) -> dict:
    """Merge `records` into a single golden record.

    Returns a dict containing the surviving attributes, a `source_ids` list
    preserving every original id, and `contributing_sources`.
    """
    if not records:
        raise ValueError("no records to merge")

    ranked = rank_records(records, attrs)
    golden: dict = {}

    # Attribute-level best-of-breed: first non-empty value from ranked order.
    for attr in attrs:
        for rec in ranked:
            val = rec.get(attr)
            if val not in (None, ""):
                golden[attr] = val
                break
        else:
            golden[attr] = None

    golden["source_ids"] = [r.get(id_field) for r in records if r.get(id_field) is not None]
    golden["contributing_sources"] = sorted(
        {str(r.get("source_system")) for r in records if r.get("source_system")}
    )
    golden["survivor_id"] = ranked[0].get(id_field)
    return golden
