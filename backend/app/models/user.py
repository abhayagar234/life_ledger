from typing import Optional

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"

    phone_number: Mapped[Optional[str]] = mapped_column(String(20), unique=True, nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    display_name: Mapped[str] = mapped_column(String(255), default="Demo User")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    financial_profile = relationship("FinancialProfile", back_populates="user", uselist=False, cascade="all, delete-orphan")
    ledger_entries = relationship("LedgerEntry", back_populates="user", cascade="all, delete-orphan")
    loans = relationship("Loan", back_populates="user", cascade="all, delete-orphan")
    emi_payments = relationship("EMIPayment", back_populates="user", cascade="all, delete-orphan")
    monthly_summaries = relationship("MonthlySummary", back_populates="user", cascade="all, delete-orphan")
    import_files = relationship("ImportFile", back_populates="user", cascade="all, delete-orphan")
