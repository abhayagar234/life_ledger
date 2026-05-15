from __future__ import annotations

import statistics
from calendar import monthrange
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.normalized_transaction import NormalizedTransaction


CONFIRMABLE_DUE_CATEGORIES = {
    "rent",
    "emi_loans",
    "subscriptions",
    "insurance",
    "credit_card_payment",
}

FIXED_OBLIGATION_CATEGORIES = CONFIRMABLE_DUE_CATEGORIES | {
    "bills",
    "education",
}

NEVER_AUTO_DUE_CATEGORIES = {
    "uncategorized",
    "transfers",
    "savings_investments",
    "business_expense",
    "groceries",
    "health",
    "travel",
    "shopping",
    "food",
}
SUBSCRIPTION_HINTS = {
    "google play",
    "netflix",
    "spotify",
    "youtube",
    "prime video",
    "apple.com",
    "hotstar",
}

CANONICAL_MERCHANT_HINTS: list[tuple[str, tuple[str, ...]]] = [
    ("google play", ("google play", "googleplay", "gplay", "play store", "app purchase")),
    ("netflix", ("netflix", "netflix.com", "netflix en")),
    ("spotify", ("spotify", "spotify in")),
    ("youtube", ("youtube", "youtube premium")),
    ("amazon prime", ("prime video", "amazon prime", "amzn prime")),
    ("hotstar", ("hotstar", "disney hotstar")),
]


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
    tokens = [token for token in cp.lower().split() if not any(char.isdigit() for char in token)]
    return " ".join(tokens[:4]).strip()

def _canonical_counterparty(txn: NormalizedTransaction) -> str:
    description = (txn.description_clean or txn.description_raw or "").lower()
    for canonical, hints in CANONICAL_MERCHANT_HINTS:
        if any(hint in description for hint in hints):
            return canonical
    return _normalize_counterparty(txn.counterparty_name)


def _amount_bucket(amount: float) -> float:
    return round(float(amount) / 50) * 50


def _median_amount(txns: list[NormalizedTransaction]) -> float:
    amounts = [float(Decimal(str(txn.amount))) for txn in txns if float(txn.amount) > 0]
    if not amounts:
        return 0.0
    return round(float(statistics.median(amounts)), 2)


def _add_month(base: date) -> date:
    year = base.year + (1 if base.month == 12 else 0)
    month = 1 if base.month == 12 else base.month + 1
    day = min(base.day, monthrange(year, month)[1])
    return date(year, month, day)


def _next_due_after_today(last_seen: date, frequency: str) -> date:
    if frequency == "weekly":
        candidate = last_seen + timedelta(days=7)
        while candidate < date.today():
            candidate += timedelta(days=7)
        return candidate

    candidate = _add_month(last_seen)
    while candidate < date.today():
        candidate = _add_month(candidate)
    return candidate


def _is_confirmable_due(txn: NormalizedTransaction) -> bool:
    category = txn.category_code or "uncategorized"
    if category in NEVER_AUTO_DUE_CATEGORIES:
        description = (txn.description_clean or txn.description_raw or "").lower()
        if any(hint in description for hint in SUBSCRIPTION_HINTS):
            return True
        return False
    if category in CONFIRMABLE_DUE_CATEGORIES:
        return True
    return bool(txn.is_fixed_obligation and category in FIXED_OBLIGATION_CATEGORIES)


def extract_detected_dues(
    db: Session,
    *,
    user_id: str,
    upload_id: str | None = None,
    upload_ids: list[str] | None = None,
    min_confidence: float = 0.75,
) -> list[DetectedDue]:
    """
    Extract detected recurring/EMI dues from imported transactions.

    Groups likely obligations by (counterparty_normalized, amount_bucket).
    Computes periodicity (weekly/monthly) via gap analysis.
    Returns list of DetectedDue sorted by confidence DESC, amount DESC.
    """
    query = db.query(NormalizedTransaction).filter(
        NormalizedTransaction.user_id == user_id,
        NormalizedTransaction.direction == "debit",
        NormalizedTransaction.dedupe_status != "duplicate",
        NormalizedTransaction.amount > 0,
    )
    if upload_ids:
        query = query.filter(NormalizedTransaction.import_file_id.in_(upload_ids))
    elif upload_id is not None:
        query = query.filter(NormalizedTransaction.import_file_id == upload_id)
    transactions = query.order_by(NormalizedTransaction.transaction_date.asc()).all()

    groups: dict[tuple[str, float], list[NormalizedTransaction]] = {}

    for txn in transactions:
        if not _is_confirmable_due(txn):
            continue
        cp_norm = _canonical_counterparty(txn)
        if not cp_norm:
            continue
        amount_bucket = _amount_bucket(txn.amount)
        key = (cp_norm, amount_bucket)
        if key not in groups:
            groups[key] = []
        groups[key].append(txn)

    detected_dues: list[DetectedDue] = []

    for (cp_norm, bucket_amount), txns in groups.items():
        if len(txns) < 2:
            continue

        # Merge cross-statement overlaps by collapsing same-day duplicates.
        dates = sorted(set(t.transaction_date for t in txns))
        gaps = [(dates[i + 1] - dates[i]).days for i in range(len(dates) - 1)]

        if not gaps:
            continue

        median_gap = statistics.median(gaps)

        if 6 <= median_gap <= 8:
            if len(txns) < 3:
                continue
            frequency = "weekly"
            valid_gaps = sum(1 for g in gaps if 6 <= g <= 8)
            confidence = valid_gaps / len(gaps) if gaps else 0.0
        elif 27 <= median_gap <= 33:
            frequency = "monthly"
            valid_gaps = sum(1 for g in gaps if 27 <= g <= 33)
            confidence = valid_gaps / len(gaps) if gaps else 0.0
        else:
            continue

        if confidence < min_confidence:
            continue

        last_date = dates[-1]
        if frequency == "weekly":
            next_due = _next_due_after_today(last_date, frequency)
        elif frequency == "monthly":
            next_due = _next_due_after_today(last_date, frequency)
        else:
            next_due = None

        amount = _median_amount(txns)
        if amount <= 0:
            continue

        counterparty = txns[0].counterparty_name or cp_norm
        category = txns[0].category_code or "uncategorized"
        transaction_ids = [str(t.id) for t in txns]
        sample_dates = [d.isoformat() for d in dates[-5:]]

        detected_dues.append(
            DetectedDue(
                counterparty_name=counterparty,
                amount=amount,
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
