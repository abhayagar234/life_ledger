import hashlib
from decimal import Decimal


def build_dedupe_fingerprint(
    user_id: str,
    transaction_date: str,
    amount: Decimal,
    direction: str,
    description_clean: str,
    source_name: str,
) -> str:
    seed = "|".join(
        [
            user_id,
            transaction_date,
            f"{amount:.2f}",
            direction,
            description_clean,
            source_name,
        ]
    )
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()
