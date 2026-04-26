from datetime import timedelta

from sqlalchemy.orm import Session

from app.models.normalized_transaction import NormalizedTransaction


def detect_recurring(
    db: Session,
    *,
    user_id: str,
    transaction_date,
    amount: float,
    description_clean: str,
    counterparty: str | None,
    config: dict,
) -> bool:
    rules = config.get("rules", {})
    if not config.get("enabled", False):
        return False

    lookback_days = int(rules.get("lookback_days", 90))
    minimum_prior_matches = int(rules.get("minimum_prior_matches", 2))
    amount_tolerance_ratio = float(rules.get("amount_tolerance_ratio", 0.10))

    match_text = (counterparty or description_clean or "").strip().lower()
    if not match_text:
        return False

    prior_rows = (
        db.query(NormalizedTransaction)
        .filter(
            NormalizedTransaction.user_id == user_id,
            NormalizedTransaction.transaction_date >= transaction_date - timedelta(days=lookback_days),
            NormalizedTransaction.transaction_date < transaction_date,
        )
        .order_by(NormalizedTransaction.transaction_date.asc())
        .all()
    )

    matches = []
    for row in prior_rows:
        prior_text = (row.counterparty_name or row.description_clean or "").strip().lower()
        if match_text and prior_text and match_text in prior_text or prior_text in match_text:
            if amount == 0:
                continue
            if abs(float(row.amount) - amount) / max(amount, 1) <= amount_tolerance_ratio:
                matches.append(row)

    return len(matches) >= minimum_prior_matches
