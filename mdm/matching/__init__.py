"""DataForge MDM matching package: normalization, fuzzy matching, survivorship."""
from .matcher import (  # noqa: F401
    normalize,
    token_set_similarity,
    fuzzy_ratio,
    match_score,
    find_candidates,
)
from .survivorship import build_golden_record  # noqa: F401
