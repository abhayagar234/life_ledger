from functools import lru_cache
from pathlib import Path

import yaml


RULES_PATH = Path(__file__).resolve().parents[3] / "docs" / "categorization_rules.yaml"


@lru_cache(maxsize=1)
def load_categorization_rules() -> dict:
    with RULES_PATH.open("r", encoding="utf-8") as handle:
        return yaml.safe_load(handle)
