from datetime import datetime

from pydantic import BaseModel


class ImportPreviewRow(BaseModel):
    transaction_date: str
    amount: float
    direction: str
    description_clean: str
    dedupe_status: str


class FileUploadResponse(BaseModel):
    upload_id: str
    file_name: str
    source_name: str
    source_type: str
    file_type: str
    selected_sheet: str | None = None
    header_row_index: int | None = None
    status: str
    message: str
    total_rows: int
    imported_rows: int
    duplicate_rows: int
    error_rows: int
    error_samples: list[str] = []
    preview: list[ImportPreviewRow]
    uploaded_at: datetime
