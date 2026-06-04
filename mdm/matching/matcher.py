"""Deduplication & matching engine for master data (zones, vendors).

Pure-Python (no third-party deps) so it bundles cleanly into Lambda and runs in
CI without installs. Implements:
  - normalize(): lowercasing, punctuation removal, whitespace normalization
  - exact match
  - token-set similarity (Jaccard over normalized tokens)
  - fuzzy ratio (SequenceMatcher; a Levenshtein-style 0..1 similarity)
  - match_score(): weighted blend + human-readable reason
  - find_candidates(): rank duplicate candidates for a query record
"""
from __future__ import annotations

import re
import string
from difflib import SequenceMatcher
from typing import Iterable

# Tunable weights for the blended component of the composite score.
_W_TOKEN = 0.5
_W_FUZZY = 0.5
_PUNCT_RE = re.compile(f"[{re.escape(string.punctuation)}]")
_WS_RE = re.compile(r"\s+")

# Common corporate suffixes treated as low-signal noise during normalization.
_STOPWORDS = {"inc", "incorporated", "llc", "ltd", "co", "corp", "company",
              "technologies", "technology", "tech", "the"}


def normalize(value: str | None, drop_stopwords: bool = False) -> str:
    """Lowercase, strip punctuation, and collapse whitespace.

    >>> normalize("  Creative Mobile  Technologies, L.L.C. ")
    'creative mobile technologies llc'
    """
    if not value:
        return ""
    text = str(value).lower()
    text = _PUNCT_RE.sub(" ", text)
    text = _WS_RE.sub(" ", text).strip()
    if drop_stopwords:
        text = " ".join(t for t in text.split() if t not in _STOPWORDS)
    return text


def _tokens(value: str | None) -> set[str]:
    return set(normalize(value, drop_stopwords=True).split())


def token_set_similarity(a: str | None, b: str | None) -> float:
    """Jaccard similarity over normalized token sets (0..1)."""
    ta, tb = _tokens(a), _tokens(b)
    if not ta and not tb:
        return 1.0
    if not ta or not tb:
        return 0.0
    inter = len(ta & tb)
    union = len(ta | tb)
    return inter / union if union else 0.0


def fuzzy_ratio(a: str | None, b: str | None) -> float:
    """Character-level similarity using SequenceMatcher (0..1)."""
    na, nb = normalize(a), normalize(b)
    if not na and not nb:
        return 1.0
    if not na or not nb:
        return 0.0
    return SequenceMatcher(None, na, nb).ratio()


def match_score(a: str | None, b: str | None) -> tuple[float, str]:
    """Composite match score with a human-readable reason.

    Returns (score in 0..1, reason). Exact normalized matches short-circuit to 1.0.
    """
    na, nb = normalize(a), normalize(b)
    if na and na == nb:
        return 1.0, "exact match (normalized)"

    tok = token_set_similarity(a, b)
    fuz = fuzzy_ratio(a, b)
    blend = _W_TOKEN * tok + _W_FUZZY * fuz
    # A strong signal from EITHER method should carry the score: token overlap
    # catches word reordering, fuzzy catches in-token typos (e.g. "Cntr").
    # We slightly discount a lone signal so blended agreement still ranks highest.
    score = round(max(blend, 0.95 * fuz, 0.95 * tok), 4)
    reason = f"token_set={tok:.2f}, fuzzy={fuz:.2f}, score={score:.2f}"
    return score, reason


def find_candidates(
    query: dict,
    records: Iterable[dict],
    key_field: str,
    id_field: str,
    threshold: float = 0.80,
) -> list[dict]:
    """Return ranked duplicate candidates for `query` against `records`.

    Each candidate dict: {id, value, match_score, reason}. Sorted desc by score,
    filtered to >= threshold. The query's own id (if present) is excluded.
    """
    q_value = query.get(key_field)
    q_id = query.get(id_field)
    out: list[dict] = []
    for rec in records:
        if q_id is not None and rec.get(id_field) == q_id:
            continue
        score, reason = match_score(q_value, rec.get(key_field))
        if score >= threshold:
            out.append({
                id_field: rec.get(id_field),
                key_field: rec.get(key_field),
                "match_score": score,
                "reason": reason,
            })
    out.sort(key=lambda r: r["match_score"], reverse=True)
    return out
