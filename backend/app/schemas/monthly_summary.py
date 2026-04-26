from datetime import datetime

from pydantic import BaseModel, ConfigDict


class MonthlySummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    year: int
    month: int
    income_total: float
    expense_total: float
    cash_in_total: float
    cash_out_total: float
    loan_due_total: float
    emi_due_total: float
    primary_insight: str
    created_at: datetime
    updated_at: datetime
