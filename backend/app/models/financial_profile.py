from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class FinancialProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "financial_profiles"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), unique=True, nullable=False, index=True)
    user_type: Mapped[str] = mapped_column(String(50), nullable=False)
    income_pattern: Mapped[str] = mapped_column(String(50), nullable=False)
    tracks_cash: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    tracks_loans: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tracks_emi: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tracking_scope: Mapped[str] = mapped_column(String(50), default="personal", nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    start_cash_amount: Mapped[Optional[float]] = mapped_column(nullable=True)
    salary_day_of_month: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    next_income_in_days: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    business_mode_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    bank_balance_confirmed: Mapped[Optional[float]] = mapped_column(nullable=True)
    bank_balance_source: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    bank_balance_last_confirmed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    user = relationship("User", back_populates="financial_profile")
