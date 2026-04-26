from datetime import date
from typing import Optional

from sqlalchemy import Date, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class Goal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "goals"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    goal_type: Mapped[str] = mapped_column(String(50), default="savings", nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    target_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    current_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    target_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    priority_level: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="active", nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
