from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class LedgerEntry(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "ledger_entries"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    entry_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    account_type: Mapped[str] = mapped_column(String(50), default="cash", nullable=False)
    counterparty_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    category_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    subcategory_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cash_direction: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    loan_id: Mapped[Optional[str]] = mapped_column(ForeignKey("loans.id"), nullable=True, index=True)
    emi_payment_id: Mapped[Optional[str]] = mapped_column(ForeignKey("emi_payments.id"), nullable=True, index=True)
    is_business: Mapped[Optional[bool]] = mapped_column(nullable=True)
    is_system_generated: Mapped[bool] = mapped_column(default=False, nullable=False)

    user = relationship("User", back_populates="ledger_entries")
    loan = relationship("Loan", back_populates="ledger_entries")
    emi_payment = relationship("EMIPayment", back_populates="ledger_entries")
