from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import IncomePattern, TrackingScope, UserType


class ProfileOnboardingUpdate(BaseModel):
    display_name: str = "Demo User"
    user_type: UserType
    income_pattern: IncomePattern
    tracks_cash: bool = True
    tracks_loans: bool = False
    tracks_emi: bool = False
    tracking_scope: TrackingScope = TrackingScope.PERSONAL
    start_cash_amount: Optional[float] = None
    salary_day_of_month: Optional[int] = None
    business_mode_enabled: bool = False


class ProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    user_type: str
    income_pattern: str
    tracks_cash: bool
    tracks_loans: bool
    tracks_emi: bool
    tracking_scope: str
    currency_code: str
    start_cash_amount: Optional[float]
    salary_day_of_month: Optional[int]
    business_mode_enabled: bool
    created_at: datetime
    updated_at: datetime
