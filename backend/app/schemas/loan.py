from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import EMIFrequency, InterestType, LoanStatus, LoanType


class LoanCreate(BaseModel):
    loan_type: LoanType
    counterparty_name: str
    principal_amount: float
    interest_type: InterestType = InterestType.NONE
    interest_rate: Optional[float] = None
    flat_interest_amount: Optional[float] = None
    start_date: date
    due_date: Optional[date] = None
    emi_amount: Optional[float] = None
    emi_frequency: Optional[EMIFrequency] = None
    notes: Optional[str] = None
    is_business: Optional[bool] = None


class LoanUpdate(BaseModel):
    status: Optional[LoanStatus] = None
    outstanding_principal: Optional[float] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None


class LoanRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    loan_type: str
    counterparty_name: str
    principal_amount: float
    currency_code: str
    interest_type: str
    interest_rate: Optional[float]
    flat_interest_amount: Optional[float]
    start_date: date
    due_date: Optional[date]
    emi_amount: Optional[float]
    emi_frequency: Optional[str]
    outstanding_principal: Optional[float]
    status: str
    notes: Optional[str]
    is_business: Optional[bool]
    created_at: datetime
    updated_at: datetime
