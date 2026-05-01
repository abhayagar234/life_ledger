from datetime import date, datetime

from pydantic import BaseModel


class UpcomingDueCreate(BaseModel):
    name: str
    amount: float
    due_date: date
    repeat_monthly: bool = False
    notes: str | None = None


class UpcomingDueRead(BaseModel):
    loan_id: str
    emi_payment_id: str
    name: str
    amount: float
    due_date: date
    repeat_monthly: bool
    notes: str | None
    created_at: datetime
