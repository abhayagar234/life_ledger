from __future__ import annotations

from datetime import date

from sqlalchemy.orm import Session

from app.models.emi_payment import EMIPayment
from app.models.loan import Loan


def _month_start(value: date) -> date:
    return value.replace(day=1)


def _add_month(value: date) -> date:
    year = value.year + (1 if value.month == 12 else 0)
    month = 1 if value.month == 12 else value.month + 1
    if month == 12:
        next_month_start = date(year + 1, 1, 1)
    else:
        next_month_start = date(year, month + 1, 1)
    last_day = (next_month_start - date.resolution).day
    return date(year, month, min(value.day, last_day))


def is_recurring_manual_due(loan: Loan | None, emi_payment: EMIPayment | None = None) -> bool:
    if loan is None:
        return False
    if loan.loan_type != "informal_due" or loan.emi_frequency != "monthly" or loan.emi_amount is None:
        return False
    if emi_payment is None:
        return True
    return emi_payment.source_type == "manual_due"


def create_next_recurring_due(
    db: Session,
    *,
    loan: Loan,
    current_payment: EMIPayment,
) -> EMIPayment | None:
    if not is_recurring_manual_due(loan, current_payment):
        return None

    next_due_date = _add_month(current_payment.due_date)
    existing = (
        db.query(EMIPayment)
        .filter(
            EMIPayment.loan_id == loan.id,
            EMIPayment.user_id == loan.user_id,
            EMIPayment.due_date == next_due_date,
        )
        .first()
    )
    if existing is not None:
        return existing

    next_payment = EMIPayment(
        user_id=loan.user_id,
        loan_id=loan.id,
        due_date=next_due_date,
        amount_due=float(loan.emi_amount or current_payment.amount_due),
        amount_paid=0,
        status="pending",
        source_type="manual_due",
    )
    db.add(next_payment)
    db.flush()
    return next_payment


def ensure_recurring_dues_current(db: Session, user_id: str, as_of: date) -> bool:
    changed = False
    target_month = _month_start(as_of)
    loans = (
        db.query(Loan)
        .filter(
            Loan.user_id == user_id,
            Loan.loan_type == "informal_due",
            Loan.emi_frequency == "monthly",
            Loan.emi_amount.is_not(None),
        )
        .all()
    )

    for loan in loans:
        payments = (
            db.query(EMIPayment)
            .filter(EMIPayment.loan_id == loan.id, EMIPayment.user_id == user_id)
            .order_by(EMIPayment.due_date.asc(), EMIPayment.created_at.asc())
            .all()
        )
        if not payments:
            continue

        latest = payments[-1]
        while _month_start(latest.due_date) < target_month:
            next_payment = create_next_recurring_due(db, loan=loan, current_payment=latest)
            if next_payment is None or next_payment.id == latest.id:
                break
            latest = next_payment
            changed = True

    if changed:
        db.commit()

    return changed
