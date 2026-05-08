from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.normalized_transaction import NormalizedTransaction


@dataclass
class DetectedDue:
    counterparty_name: str
    amount: float
    frequency: str
    next_due_estimate: date | None
    confidence: float
    category_code: str
    transaction_ids: list[str]
    sample_dates: list[str]


def _normalize_counterparty(cp: str | None) -> str:
    if not cp:
        return ""
    tokens = cp.split()
    return " ".join(tokens[:3]).lower()


def _amount_bucket(amount: float) -> float:
    return round(amount / 100) * 100


def extract_detected_dues(
    db: Session,
    *,
    user_id: str,
    upload_id: str,
    min_confidence: float = 0.40,
) -> list[DetectedDue]:
    """
    Extract detected recurring/EMI dues from imported transactions.

    Groups transactions by (counterparty_normalized, amount_bucket).
    Computes periodicity (weekly/monthly) via median gap analysis.
    Returns list of DetectedDue sorted by confidence DESC, amount DESC.
    """
    transactions = (
        db.query(NormalizedTransaction)
        .filter(
            NormalizedTransaction.user_id == user_id,
            NormalizedTransaction.import_file_id == upload_id,
            NormalizedTransaction.direction == "debit",
            (NormalizedTransaction.is_fixed_obligation == True) | (NormalizedTransaction.is_recurring == True),
        )
        .order_by(NormalizedTransaction.transaction_date.asc())
        .all()
    )

    groups: dict[tuple[str, float], list[NormalizedTransaction]] = {}

    for txn in transactions:
        cp_norm = _normalize_counterparty(txn.counterparty_name)
        amount_bucket = _amount_bucket(txn.amount)
        key = (cp_norm, amount_bucket)
        if key not in groups:
            groups[key] = []
        groups[key].append(txn)

    detected_dues: list[DetectedDue] = []

    for (cp_norm, bucket_amount), txns in groups.items():
        if len(txns) < 2:
            continue

        dates = sorted([t.transaction_date for t in txns])
        gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]

        if not gaps:
            continue

        median_gap = statistics.median(gaps)

        if 6 <= median_gap <= 8:
            frequency = "weekly"
            valid_gaps = sum(1 for g in gaps if 6 <= g <= 8)
            confidence = valid_gaps / len(gaps) if gaps else 0.0
        elif 27 <= median_gap <= 33:
            frequency = "monthly"
            valid_gaps = sum(1 for g in gaps if 27 <= g <= 33)
            confidence = valid_gaps / len(gaps) if gaps else 0.0
        else:
            frequency = "irregular"
            confidence = 0.40

        if confidence < min_confidence:
            continue

        last_date = dates[-1]
        if frequency == "weekly":
            next_due = last_date + timedelta(days=7)
        elif frequency == "monthly":
            next_due = last_date + timedelta(days=30)
        else:
            next_due = None

        counterparty = txns[0].counterparty_name or cp_norm
        category = txns[0].category_code or "uncategorized"
        transaction_ids = [str(t.id) for t in txns]
        sample_dates = [d.isoformat() for d in dates[-5:]]

        detected_dues.append(
            DetectedDue(
                counterparty_name=counterparty,
                amount=bucket_amount,
                frequency=frequency,
                next_due_estimate=next_due,
                confidence=round(confidence, 2),
                category_code=category,
                transaction_ids=transaction_ids,
                sample_dates=sample_dates,
            )
        )

    detected_dues.sort(key=lambda d: (-d.confidence, -d.amount))
    return detected_dues
