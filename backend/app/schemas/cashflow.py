from datetime import date

from pydantic import BaseModel


class ProtectedDueItem(BaseModel):
    due_key: str
    name: str
    amount: float
    due_date: date
    status: str
    amount_paid: float = 0
    remaining_amount: float = 0
    source_type: str
    emi_payment_id: str | None = None
    loan_id: str | None = None


class CashflowSummaryResponse(BaseModel):
    as_of_date: date
    latest_activity_date: date | None
    status: str
    headline: str
    plain_summary: str
    safe_till_date: date | None
    next_income_date: date | None
    effective_available_money: float
    liquid_balance: float
    cash_on_hand: float
    upcoming_dues_total: float
    daily_needs_buffer: float
    daily_needs_required: float
    baseline_daily_spend: float
    runway_days: float | None
    safe_to_spend: float
    safe_to_save: float
    safe_to_invest: float
    shortfall_amount: float
    confidence: str
    explanations: list[str]
    watchouts: list[str]
    protected_due_items: list[ProtectedDueItem]
