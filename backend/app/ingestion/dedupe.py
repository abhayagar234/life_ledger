import hashlib
import re
from decimal import Decimal

_SPACE_RE = re.compile(r"\s+")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9]+")


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    lowered = value.strip().lower()
    compact_space = _SPACE_RE.sub(" ", lowered)
    return compact_space


def _identity_from_raw_or_clean(raw_description: str | None, description_clean: str) -> str:
    raw_norm = _normalize_text(raw_description)
    if raw_norm:
        # Keep key identity chars (including reference digits) so same-day ATM withdrawals
        # with different reference numbers do not collapse into one duplicate.
        return _NON_ALNUM_RE.sub(" ", raw_norm).strip()
    return _NON_ALNUM_RE.sub(" ", _normalize_text(description_clean)).strip()


def build_dedupe_fingerprint(
    user_id: str,
    transaction_date: str,
    amount: Decimal,
    direction: str,
    description_clean: str,
    raw_description: str | None,
    source_name: str,
) -> str:
    description_identity = _identity_from_raw_or_clean(raw_description, description_clean)
    seed = "|".join(
        [
            user_id,
            transaction_date,
            f"{amount:.2f}",
            direction,
            description_identity,
            source_name,
        ]
    )
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()
