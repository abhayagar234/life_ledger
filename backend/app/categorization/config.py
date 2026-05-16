from functools import lru_cache
from pathlib import Path

import yaml


def _resolve_rules_path() -> Path:
    current = Path(__file__).resolve()
    candidates = [
        current.parents[3] / "docs" / "categorization_rules.yaml",  # repo root layout
        current.parents[2] / "docs" / "categorization_rules.yaml",  # backend as deploy root
        Path.cwd() / "docs" / "categorization_rules.yaml",          # runtime cwd fallback
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


RULES_PATH = _resolve_rules_path()


@lru_cache(maxsize=1)
def load_categorization_rules() -> dict:
    with RULES_PATH.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)
