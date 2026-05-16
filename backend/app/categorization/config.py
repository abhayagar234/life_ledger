from functools import lru_cache
import logging
from pathlib import Path

import yaml

logger = logging.getLogger(__name__)


DEFAULT_RULES: dict = {
    "default_category": "uncategorized",
    "structured_rules": [],
    "merchant_rules": {},
    "regex_rules": [],
    "keyword_rules": {},
    "transfer_rules": {"keywords": [], "confidence": 0.95},
    "recurring_detection": {},
    "fixed_obligation_detection": {"strong_categories": [], "keyword_overrides": []},
    "confidence_thresholds": {"unresolved_below": 0.5},
}


def _resolve_rules_path() -> Path:
    current = Path(__file__).resolve()
    candidates = [
        current.parents[3] / "docs" / "categorization_rules.yaml",   # monorepo root layout
        current.parents[2] / "docs" / "categorization_rules.yaml",   # backend as deploy root
        current.parents[2] / "app" / "docs" / "categorization_rules.yaml",  # nested app dir
        Path.cwd() / "docs" / "categorization_rules.yaml",           # runtime cwd fallback
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


RULES_PATH = _resolve_rules_path()


@lru_cache(maxsize=1)
def load_categorization_rules() -> dict:
    if not RULES_PATH.exists():
        logger.warning(
            "categorization_rules.yaml not found at %s. Falling back to in-memory defaults.",
            RULES_PATH,
        )
        return DEFAULT_RULES.copy()
    try:
        with RULES_PATH.open("r", encoding="utf-8") as handle:
            data = yaml.safe_load(handle) or {}
    except FileNotFoundError:
        logger.warning(
            "categorization_rules.yaml disappeared at runtime (%s). Falling back to in-memory defaults.",
            RULES_PATH,
        )
        return DEFAULT_RULES.copy()
    except OSError as exc:
        logger.warning(
            "Could not read categorization_rules.yaml (%s): %s. Falling back to defaults.",
            RULES_PATH,
            exc,
        )
        return DEFAULT_RULES.copy()
    if not isinstance(data, dict):
        logger.warning("categorization_rules.yaml is not a dict. Falling back to defaults.")
        return DEFAULT_RULES.copy()
    merged = DEFAULT_RULES.copy()
    merged.update(data)
    return merged
