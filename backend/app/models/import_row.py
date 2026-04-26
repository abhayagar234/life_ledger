from typing import Optional

from sqlalchemy import ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ImportRow(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "import_rows"

    import_file_id: Mapped[str] = mapped_column(ForeignKey("import_files.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    row_number: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_data: Mapped[dict] = mapped_column(JSON, nullable=False)
    raw_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    raw_amount: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    raw_date: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    parse_status: Mapped[str] = mapped_column(String(50), default="pending", nullable=False)
    parse_errors: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    import_file = relationship("ImportFile", back_populates="import_rows")
    normalized_transaction = relationship("NormalizedTransaction", back_populates="import_row", uselist=False)
