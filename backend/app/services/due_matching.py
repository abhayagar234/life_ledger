from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.models.loan import Loan


CANONICAL_DUE_HINTS: list[tuple[str, tuple[str, ...]]] = [
    ("google play", ("google play", "googleplay", "gplay", "play store", "app purchase")),
    ("netflix", ("netflix", "netflix.com", "netflix en")),
    ("spotify", ("spotify", "spotify in")),
    ("youtube", ("youtube", "youtube premium")),
    ("amazon prime", ("prime video", "amazon prime", "amzn prime")),
    ("hotstar", ("hotstar", "disney hotstar")),
    ("hdfc mutual fund", ("hdfc mutua", "hdfc mutual", "hdcamsip", "hdmfipar")),
    ("icici prudential", ("icici prud", "ipcamsip", "icici prudentia")),
]


@dataclass(frozen=True)
class ConfirmedDueSignature:
    counterparty: str
    amount_bucket: float
    frequency: str | None


def normalize_due_counterparty(value: str | None) -> str:
    text = (value or "").lower().strip()
    if not text:
        return ""
    for canonical, hints in CANONICAL_DUE_HINTS:
        if any(hint in text for hint in hints):
            return canonical
    tokens = [
        token
        for token in "".join(char if char.isalnum() else " " for char in text).split()
        if not any(char.isdigit() for char in token)
    ]
    return " ".join(tokens[:5]).strip()


def due_amount_bucket(amount: float | int | str | None) -> float:
    try:
        value = float(amount or 0)
    except (TypeError, ValueError):
        value = 0.0
    return round(value / 50) * 50


def due_counterparty_matches(left: str | None, right: str | None) -> bool:
    left_norm = normalize_due_counterparty(left)
    right_norm = normalize_due_counterparty(right)
    if not left_norm or not right_norm:
        return False
    if left_norm == right_norm:
        return True
    if len(left_norm) >= 6 and left_norm in right_norm:
        return True
    if len(right_norm) >= 6 and right_norm in left_norm:
        return True
    left_tokens = set(left_norm.split())
    right_tokens = set(right_norm.split())
    common = left_tokens & right_tokens
    required = max(1, min(len(left_tokens), len(right_tokens)) - 1)
    return len(common) >= required and len(common) >= 2


def confirmed_due_signatures(db: Session, user_id: str) -> list[ConfirmedDueSignature]:
    loans = (
        db.query(Loan)
        .filter(
            Loan.user_id == user_id,
            Loan.confirmed == True,
            Loan.status == "active",
            Loan.emi_amount.isnot(None),
        )
        .all()
    )
    signatures: list[ConfirmedDueSignature] = []
    for loan in loans:
        counterparty = normalize_due_counterparty(loan.counterparty_name)
        if not counterparty:
            continue
        signatures.append(
            ConfirmedDueSignature(
                counterparty=counterparty,
                amount_bucket=due_amount_bucket(float(loan.emi_amount or 0)),
                frequency=loan.emi_frequency,
            )
        )
    return signatures


def confirmed_due_matches(
    signatures: list[ConfirmedDueSignature],
    *,
    counterparty: str | None,
    amount: float,
    frequency: str | None,
) -> bool:
    amount_bucket = due_amount_bucket(amount)
    for signature in signatures:
        if frequency and signature.frequency and signature.frequency != frequency:
            continue
        if abs(signature.amount_bucket - amount_bucket) > 100:
            continue
        if due_counterparty_matches(signature.counterparty, counterparty):
            return True
    return False
