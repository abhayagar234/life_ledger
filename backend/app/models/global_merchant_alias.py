from datetime import datetime

from sqlalchemy import DateTime, Index, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class GlobalMerchantAlias(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "global_merchant_aliases"
    __table_args__ = (
        UniqueConstraint("merchant_key", name="uq_global_merchant_alias_key"),
        Index("ix_global_merchant_alias_key_category", "merchant_key", "category_code"),
    )

    merchant_key: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    merchant_label: Mapped[str] = mapped_column(String(255), nullable=False)
    category_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    confirmation_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    last_confirmed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
