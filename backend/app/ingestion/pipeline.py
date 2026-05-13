from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal
from io import BytesIO

from sqlalchemy.orm import Session
import pdfplumber

from app.categorization.engine import categorize_transaction
from app.categorization.types import CategorizationInput
from app.ingestion.dedupe import build_dedupe_fingerprint
from app.ingestion.detectors import detect_source
from app.ingestion.mappers import map_columns
from app.ingestion.normalizers import (
    clean_description,
    extract_counterparty,
    extract_upi_merchant,
    normalize_date,
    normalize_direction,
    parse_amount,
)
from app.ingestion.pdf_reader import read_pdf_rows
from app.ingestion.readers import ParsedSheet, read_csv_rows, read_xls_rows, read_xlsx_rows
from app.models.import_file import ImportFile
from app.models.import_row import ImportRow
from app.models.normalized_transaction import NormalizedTransaction
from app.schemas.imports import FileUploadResponse, ImportPreviewRow


@dataclass
class ParsedTabularFile:
    headers: list[str]
    rows: list[dict]
    sheet_names: list[str]
    selected_sheet: str | None
    header_row_index: int


def compute_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def read_rows_for_file_type(file_type: str, content: bytes) -> ParsedTabularFile:
    if file_type == "csv":
        parsed_sheet = read_csv_rows(content)
    elif file_type == "xlsx":
        parsed_sheet = read_xlsx_rows(content)
    elif file_type == "xls":
        parsed_sheet = read_xls_rows(content)
    elif file_type == "pdf":
        parsed_sheet = read_pdf_rows(content)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")
    return ParsedTabularFile(
        headers=parsed_sheet.headers,
        rows=parsed_sheet.rows,
        sheet_names=[parsed_sheet.sheet_name] if parsed_sheet.sheet_name else [],
        selected_sheet=parsed_sheet.sheet_name,
        header_row_index=parsed_sheet.header_row_index,
    )


def extract_bank_hint_for_file_type(file_type: str, content: bytes) -> str | None:
    if file_type != "pdf":
        return None
    try:
        with pdfplumber.open(BytesIO(content)) as pdf:
            if not pdf.pages:
                return None
            text = pdf.pages[0].extract_text() or ""
    except Exception:
        return None

    lowered = text.lower()
    if "state bank of india" in lowered or "\nsbi" in lowered or " sbi " in lowered:
        return "sbi"
    if "hdfc bank" in lowered:
        return "hdfc"
    if "icici bank" in lowered:
        return "icici"
    if "axis bank" in lowered:
        return "axis"
    if "kotak mahindra" in lowered or "kotak bank" in lowered:
        return "kotak"
    return None


def _first_non_empty(row: dict, keys: list[str]) -> object | None:
    for key in keys:
        if not key:
            continue
        value = row.get(key)
        if value not in (None, ""):
            return value
    return None


def _json_safe_value(value: object) -> object:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def _json_safe_row(raw_row: dict) -> dict[str, object]:
    return {str(key): _json_safe_value(value) for key, value in raw_row.items()}


def process_import_file(
    db: Session,
    *,
    user_id: str,
    file_name: str,
    file_type: str,
    content: bytes,
    force_reprocess: bool = True,
) -> FileUploadResponse:
    file_hash = compute_file_hash(content)
    existing_file = (
        db.query(ImportFile)
        .filter(ImportFile.user_id == user_id, ImportFile.file_hash == file_hash)
        .first()
    )
    if existing_file is not None:
        if force_reprocess:
            db.delete(existing_file)
            db.flush()
        else:
            return FileUploadResponse(
                upload_id=existing_file.id,
                file_name=existing_file.file_name,
                source_name=existing_file.source_name,
                source_type=existing_file.source_type,
                file_type=existing_file.file_type,
                selected_sheet=None,
                header_row_index=None,
                status="duplicate_file",
                message="This file has already been imported for this user.",
                total_rows=existing_file.total_rows,
                imported_rows=existing_file.imported_rows,
                duplicate_rows=existing_file.duplicate_rows,
                error_rows=existing_file.error_rows,
                error_samples=[],
                preview=[],
                uploaded_at=existing_file.uploaded_at,
            )

    parsed_file = read_rows_for_file_type(file_type, content)
    bank_hint = extract_bank_hint_for_file_type(file_type, content)
    source_name, source_type = detect_source(file_name, parsed_file.headers, parsed_file.sheet_names, bank_hint)
    mapping = map_columns(parsed_file.headers)

    import_file = ImportFile(
        user_id=user_id,
        file_name=file_name,
        file_type=file_type,
        source_name=source_name,
        source_type=source_type,
        file_hash=file_hash,
        status="processing",
        total_rows=len(parsed_file.rows),
    )
    db.add(import_file)
    db.flush()

    imported_rows = 0
    duplicate_rows = 0
    error_rows = 0
    error_samples: list[str] = []
    preview: list[ImportPreviewRow] = []

    for index, raw_row in enumerate(parsed_file.rows, start=1):
        raw_description = _first_non_empty(raw_row, [mapping.get("description", "")])
        raw_amount_value = _first_non_empty(
            raw_row, [mapping.get("amount", ""), mapping.get("debit", ""), mapping.get("credit", "")]
        )
        raw_date_value = _first_non_empty(raw_row, [mapping.get("transaction_date", ""), mapping.get("posted_date", "")])

        import_row = ImportRow(
            import_file_id=import_file.id,
            user_id=user_id,
            row_number=index,
            raw_data=_json_safe_row(raw_row),
            raw_description=None if raw_description is None else str(raw_description),
            raw_amount=None if raw_amount_value is None else str(raw_amount_value),
            raw_date=None if raw_date_value is None else str(raw_date_value),
            parse_status="pending",
            parse_errors=[],
        )
        db.add(import_row)
        db.flush()

        parse_errors: list[str] = []
        transaction_date = normalize_date(raw_row.get(mapping.get("transaction_date", "")))
        posted_date = normalize_date(raw_row.get(mapping.get("posted_date", ""))) if mapping.get("posted_date") else None
        amount_value = parse_amount(raw_row.get(mapping.get("amount", ""))) if mapping.get("amount") else None
        direction, normalized_amount = normalize_direction(raw_row, mapping, amount_value)

        if transaction_date is None:
            parse_errors.append("missing_or_invalid_transaction_date")
        if normalized_amount is None:
            parse_errors.append("missing_or_invalid_amount")
        if direction is None:
            parse_errors.append("missing_or_unresolved_direction")

        description_raw = str(raw_description or "")
        description_clean = clean_description(description_raw)
        counterparty = extract_upi_merchant(description_raw) or extract_counterparty(description_clean)

        if parse_errors:
            import_row.parse_status = "invalid"
            import_row.parse_errors = parse_errors
            error_rows += 1
            if len(error_samples) < 5:
                error_samples.append(f"row {index}: {', '.join(parse_errors)}")
            continue

        dedupe_fingerprint = build_dedupe_fingerprint(
            user_id=user_id,
            transaction_date=transaction_date.isoformat(),
            amount=normalized_amount,
            direction=direction,
            description_clean=description_clean,
            source_name=source_name,
        )
        existing_transaction = (
            db.query(NormalizedTransaction)
            .filter(
                NormalizedTransaction.user_id == user_id,
                NormalizedTransaction.dedupe_fingerprint == dedupe_fingerprint,
            )
            .first()
        )
        dedupe_status = "duplicate" if existing_transaction else "unique"
        if dedupe_status == "duplicate":
            duplicate_rows += 1
        else:
            imported_rows += 1

        categorization = categorize_transaction(
            db,
            payload=CategorizationInput(
                user_id=user_id,
                description_raw=description_raw,
                description_clean=description_clean,
                counterparty=counterparty,
                direction=direction,
                amount=float(normalized_amount),
                source_type=source_type,
                source_name=source_name,
            ),
            transaction_date=transaction_date,
        )

        import_row.parse_status = "parsed"
        import_row.parse_errors = []

        normalized_transaction = NormalizedTransaction(
            user_id=user_id,
            import_file_id=import_file.id,
            import_row_id=import_row.id,
            source_name=source_name,
            source_type=source_type,
            transaction_date=transaction_date,
            posted_date=posted_date,
            amount=float(normalized_amount),
            currency_code="INR",
            direction=direction,
            description_raw=description_raw,
            description_clean=description_clean,
            counterparty_name=counterparty,
            category_code=categorization.category,
            subcategory_code=categorization.subcategory,
            is_recurring=categorization.is_recurring,
            is_fixed_obligation=categorization.is_fixed_obligation,
            confidence_score=min(categorization.confidence_score, 1.0),
            dedupe_fingerprint=dedupe_fingerprint,
            dedupe_status=dedupe_status,
            review_status="pending" if dedupe_status == "duplicate" or categorization.unresolved else "accepted",
        )
        db.add(normalized_transaction)

        if len(preview) < 5:
            preview.append(
                ImportPreviewRow(
                    transaction_date=transaction_date.isoformat(),
                    amount=float(normalized_amount),
                    direction=direction,
                    description_clean=description_clean,
                    dedupe_status=dedupe_status,
                )
            )

    import_file.imported_rows = imported_rows
    import_file.duplicate_rows = duplicate_rows
    import_file.error_rows = error_rows
    import_file.status = "processed"
    import_file.processed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(import_file)

    return FileUploadResponse(
        upload_id=import_file.id,
        file_name=import_file.file_name,
        source_name=import_file.source_name,
        source_type=import_file.source_type,
        file_type=import_file.file_type,
        selected_sheet=parsed_file.selected_sheet,
        header_row_index=parsed_file.header_row_index,
        status=import_file.status,
        message="File processed successfully." if existing_file is None else "File reprocessed successfully.",
        total_rows=import_file.total_rows,
        imported_rows=import_file.imported_rows,
        duplicate_rows=import_file.duplicate_rows,
        error_rows=import_file.error_rows,
        error_samples=error_samples,
        preview=preview,
        uploaded_at=import_file.uploaded_at,
    )
