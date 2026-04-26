from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Budget(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "budgets"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    period_type: Mapped[str] = mapped_column(String(50), default="monthly", nullable=False)
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    category_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    limit_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    spent_amount_snapshot: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
