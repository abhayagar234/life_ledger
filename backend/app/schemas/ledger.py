from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import AccountType, CashDirection, EntryType


class LedgerEntryCreate(BaseModel):
    entry_type: EntryType
    amount: float
    entry_date: date
    account_type: AccountType = AccountType.CASH
    counterparty_name: Optional[str] = None
    category_code: Optional[str] = None
    subcategory_code: Optional[str] = None
    description: Optional[str] = None
    source_label: Optional[str] = None
    cash_direction: Optional[CashDirection] = None
    loan_id: Optional[str] = None
    emi_payment_id: Optional[str] = None
    is_business: Optional[bool] = None
    money_scope: Optional[str] = None


class LedgerEntryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    entry_type: str
    amount: float
    currency_code: str
    entry_date: date
    account_type: str
    counterparty_name: Optional[str]
    category_code: Optional[str]
    subcategory_code: Optional[str]
    description: Optional[str]
    source_label: Optional[str]
    cash_direction: Optional[str]
    loan_id: Optional[str]
    emi_payment_id: Optional[str]
    is_business: Optional[bool]
    money_scope: Optional[str]
    is_system_generated: bool
    created_at: datetime
    updated_at: datetime
