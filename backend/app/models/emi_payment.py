from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class EMIPayment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "emi_payments"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    loan_id: Mapped[str] = mapped_column(ForeignKey("loans.id"), nullable=False, index=True)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    amount_due: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    principal_component: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    interest_component: Mapped[Optional[float]] = mapped_column(Numeric(14, 2), nullable=True)
    amount_paid: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    paid_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), default="manual", nullable=False)

    user = relationship("User", back_populates="emi_payments")
    loan = relationship("Loan", back_populates="emi_payments")
    ledger_entries = relationship("LedgerEntry", back_populates="emi_payment")
