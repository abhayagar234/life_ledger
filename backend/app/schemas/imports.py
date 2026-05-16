from datetime import date, datetime

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


class DetectedDueResponse(BaseModel):
    counterparty_name: str
    amount: float
    frequency: str
    next_due_estimate: date | None
    confidence: float
    category_code: str
    sample_dates: list[str]
    transaction_ids: list[str]


class ConfirmDueItem(BaseModel):
    counterparty_name: str
    amount: float
    frequency: str
    next_due_date: date
    custom_name: str | None = None
    category_code: str | None = None


class ConfirmDuesRequest(BaseModel):
    confirmed_dues: list[ConfirmDueItem]


class ConfirmDuesResponse(BaseModel):
    created_loans: list[str]
    message: str


class CategoryHelpCandidate(BaseModel):
    merchant_key: str
    merchant_label: str
    total_amount: float
    transaction_count: int


class CategoryMappingItem(BaseModel):
    merchant_key: str
    merchant_label: str
    category_code: str


class CategoryMappingRequest(BaseModel):
    mappings: list[CategoryMappingItem]


class CategoryMappingResponse(BaseModel):
    saved_mappings: int
    updated_transactions: int
    message: str


class ImportSummaryResponse(BaseModel):
    total_income: float
    total_spend: float
    total_upi: float
    total_cash_withdrawal: float
    total_transfer: float
    top_categories: dict[str, float]
    most_spent_category: str | None = None
    most_spent_amount: float = 0
    date_range: tuple[str, str] | None = None
    period_days: int | None = None
    period_months: float | None = None
    top_merchants: dict[str, float] = {}
    category_coverage_ratio: float = 0
    uncategorized_spend: float = 0
    credit_card_insights: dict[str, str] | None = None


class ImportCoverageResponse(BaseModel):
    total_uploads: int
    total_transactions: int
    date_range: tuple[str, str] | None = None
    period_days: int | None = None
    period_months: float | None = None
    account_coverage: dict[str, int]
    total_spend: float
    total_income: float
    total_upi: float
    total_cash_withdrawal: float
    top_categories_current_month: dict[str, float]
    top_categories_overall: dict[str, float] = {}
    top_merchants_overall: dict[str, float] = {}
    category_coverage_ratio: float = 0
    uncategorized_spend_overall: float = 0
    most_spent_category_current_month: str | None = None
    most_spent_amount_current_month: float = 0
    recurring_dues: list[DetectedDueResponse]
    category_help_candidates: list[CategoryHelpCandidate] = []
