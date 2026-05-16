from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class UserCategoryAlias(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "user_category_aliases"
    __table_args__ = (
        UniqueConstraint("user_id", "merchant_key", name="uq_user_category_alias_user_merchant"),
    )

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    merchant_key: Mapped[str] = mapped_column(String(180), nullable=False, index=True)
    merchant_label: Mapped[str] = mapped_column(String(255), nullable=False)
    category_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
