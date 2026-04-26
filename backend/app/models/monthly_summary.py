from sqlalchemy import ForeignKey, Integer, Numeric, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class MonthlySummary(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "monthly_summaries"
    __table_args__ = (UniqueConstraint("user_id", "year", "month", name="uq_monthly_summary_user_year_month"),)

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    month: Mapped[int] = mapped_column(Integer, nullable=False)
    income_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    expense_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    cash_in_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    cash_out_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    loan_due_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    emi_due_total: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    primary_insight: Mapped[str] = mapped_column(String(255), default="Start adding entries to see your monthly summary.")

    user = relationship("User", back_populates="monthly_summaries")
