from calendar import monthrange
from datetime import date
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.emi_payment import EMIPayment
from app.models.ledger_entry import LedgerEntry
from app.models.monthly_summary import MonthlySummary


def _to_float(value: Decimal | float | int | None) -> float:
    return float(value or 0)


def build_monthly_summary(db: Session, user_id: str, year: int, month: int, refresh: bool = True) -> MonthlySummary:
    summary = (
        db.query(MonthlySummary)
        .filter(MonthlySummary.user_id == user_id, MonthlySummary.year == year, MonthlySummary.month == month)
        .first()
    )

    if summary and not refresh:
        return summary

    month_start = date(year, month, 1)
    month_end = date(year, month, monthrange(year, month)[1])

    income_total = _to_float(
        db.query(func.sum(LedgerEntry.amount))
        .filter(
            LedgerEntry.user_id == user_id,
            LedgerEntry.entry_type == "income",
            LedgerEntry.entry_date >= month_start,
            LedgerEntry.entry_date <= month_end,
        )
        .scalar()
    )
    expense_total = _to_float(
        db.query(func.sum(LedgerEntry.amount))
        .filter(
            LedgerEntry.user_id == user_id,
            LedgerEntry.entry_type == "expense",
            LedgerEntry.entry_date >= month_start,
            LedgerEntry.entry_date <= month_end,
        )
        .scalar()
    )
    cash_in_total = _to_float(
        db.query(func.sum(LedgerEntry.amount))
        .filter(
            LedgerEntry.user_id == user_id,
            LedgerEntry.account_type == "cash",
            LedgerEntry.entry_date >= month_start,
            LedgerEntry.entry_date <= month_end,
            LedgerEntry.cash_direction.in_(["in", "set", "adjust"]),
        )
        .scalar()
    )
    cash_out_total = _to_float(
        db.query(func.sum(LedgerEntry.amount))
        .filter(
            LedgerEntry.user_id == user_id,
            LedgerEntry.account_type == "cash",
            LedgerEntry.entry_date >= month_start,
            LedgerEntry.entry_date <= month_end,
            LedgerEntry.cash_direction == "out",
        )
        .scalar()
    )
    loan_due_total = _to_float(
        db.query(func.sum(LedgerEntry.amount))
        .filter(
            LedgerEntry.user_id == user_id,
            LedgerEntry.entry_type.in_(["loan_repayment", "interest_charge"]),
            LedgerEntry.entry_date >= month_start,
            LedgerEntry.entry_date <= month_end,
        )
        .scalar()
    )
    emi_due_total = _to_float(
        db.query(func.sum(EMIPayment.amount_due))
        .filter(
            EMIPayment.user_id == user_id,
            EMIPayment.due_date >= month_start,
            EMIPayment.due_date <= month_end,
        )
        .scalar()
    )

    if summary is None:
        summary = MonthlySummary(user_id=user_id, year=year, month=month)
        db.add(summary)

    summary.income_total = income_total
    summary.expense_total = expense_total
    summary.cash_in_total = cash_in_total
    summary.cash_out_total = cash_out_total
    summary.loan_due_total = loan_due_total
    summary.emi_due_total = emi_due_total

    if income_total == 0 and expense_total == 0:
        summary.primary_insight = "Start by adding income or expense to see your monthly picture."
    elif expense_total > income_total and income_total > 0:
        summary.primary_insight = "Spending is higher than income this month. Review top expenses first."
    else:
        summary.primary_insight = "Your month looks stable. Keep tracking cash and upcoming dues."

    db.commit()
    db.refresh(summary)
    return summary
