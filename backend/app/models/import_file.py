from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKeyMixin


class ImportFile(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "import_files"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    file_type: Mapped[str] = mapped_column(String(20), nullable=False)
    source_name: Mapped[str] = mapped_column(String(100), default="unknown_source", nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), default="other", nullable=False)
    file_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="uploaded", nullable=False)
    total_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    imported_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duplicate_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_rows: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user = relationship("User", back_populates="import_files")
    import_rows = relationship("ImportRow", back_populates="import_file", cascade="all, delete-orphan")
    normalized_transactions = relationship(
        "NormalizedTransaction", back_populates="import_file", cascade="all, delete-orphan"
    )
