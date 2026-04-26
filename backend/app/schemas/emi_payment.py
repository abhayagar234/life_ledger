from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import EMIPaymentStatus


class EMIPaymentCreate(BaseModel):
    loan_id: str
    due_date: date
    amount_due: float
    principal_component: Optional[float] = None
    interest_component: Optional[float] = None
    amount_paid: float = 0
    paid_date: Optional[date] = None
    status: EMIPaymentStatus = EMIPaymentStatus.PENDING
    source_type: str = "manual"


class EMIPaymentUpdate(BaseModel):
    amount_paid: Optional[float] = None
    paid_date: Optional[date] = None
    status: Optional[EMIPaymentStatus] = None


class EMIPaymentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    loan_id: str
    due_date: date
    amount_due: float
    principal_component: Optional[float]
    interest_component: Optional[float]
    amount_paid: float
    paid_date: Optional[date]
    status: str
    source_type: str
    created_at: datetime
    updated_at: datetime
