from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import BudgetPeriodType, BudgetStatus


class BudgetCreate(BaseModel):
    name: str
    period_type: BudgetPeriodType = BudgetPeriodType.MONTHLY
    start_date: date
    end_date: date
    category_code: Optional[str] = None
    limit_amount: float


class BudgetUpdate(BaseModel):
    name: Optional[str] = None
    end_date: Optional[date] = None
    category_code: Optional[str] = None
    limit_amount: Optional[float] = None
    spent_amount_snapshot: Optional[float] = None
    status: Optional[BudgetStatus] = None


class BudgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    period_type: str
    start_date: date
    end_date: date
    category_code: Optional[str]
    limit_amount: float
    spent_amount_snapshot: float
    status: str
    created_at: datetime
    updated_at: datetime
