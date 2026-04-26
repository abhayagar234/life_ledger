from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Loan(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "loans"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    loan_type: Mapped[str] = mapped_column(String(50), nullable=False)
    counterparty_name: Mapped[str] = mapped_column(String(255), nullable=False)
    principal_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    interest_type: Mapped[str] = mapped_column(String(50), default="none", nullable=False)
    interest_rate: Mapped[Optional[float]] = mapped_column(Numeric(8, 4), nullable=True)
    flat_interest_amount: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    emi_amount: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    emi_frequency: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    outstanding_principal: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_business: Mapped[Optional[bool]] = mapped_column(nullable=True)

    user = relationship("User", back_populates="loans")
    ledger_entries = relationship("LedgerEntry", back_populates="loan")
    emi_payments = relationship("EMIPayment", back_populates="loan", cascade="all, delete-orphan")
