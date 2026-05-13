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
    next_income_in_days: Optional[int] = None
    business_mode_enabled: bool = False
    money_mix_type: str = "home"
    receives_salary_besides_business: bool = False
    business_reserve_amount: Optional[float] = None


class ProfileBankBalanceUpdate(BaseModel):
    amount: float
    source: str = "manual"


class ProfileDailyNeedsUpdate(BaseModel):
    amount: float


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
    next_income_in_days: Optional[int]
    business_mode_enabled: bool
    money_mix_type: str
    receives_salary_besides_business: bool
    business_reserve_amount: Optional[float]
    daily_needs_override: Optional[float]
    bank_balance_confirmed: Optional[float]
    bank_balance_source: Optional[str]
    bank_balance_last_confirmed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime
