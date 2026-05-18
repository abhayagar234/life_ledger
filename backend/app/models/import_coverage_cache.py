from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class ImportCoverageCache(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "import_coverage_cache"

    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    upload_ids_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    upload_ids_json: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    summary_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
