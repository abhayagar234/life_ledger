from datetime import date
from typing import Optional

from sqlalchemy import Boolean, Date, Float, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class NormalizedTransaction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "normalized_transactions"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    import_file_id: Mapped[str] = mapped_column(ForeignKey("import_files.id"), nullable=False, index=True)
    import_row_id: Mapped[str] = mapped_column(ForeignKey("import_rows.id"), nullable=False, unique=True, index=True)
    source_name: Mapped[str] = mapped_column(String(100), nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), nullable=False)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    posted_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    currency_code: Mapped[str] = mapped_column(String(3), default="INR", nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    description_raw: Mapped[str] = mapped_column(Text, nullable=False)
    description_clean: Mapped[str] = mapped_column(Text, nullable=False)
    counterparty_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    category_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    subcategory_code: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_recurring: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_fixed_obligation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    dedupe_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    dedupe_status: Mapped[str] = mapped_column(String(50), default="unique", nullable=False)
    review_status: Mapped[str] = mapped_column(String(50), default="accepted", nullable=False)

    import_file = relationship("ImportFile", back_populates="normalized_transactions")
    import_row = relationship("ImportRow", back_populates="normalized_transaction")
