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
from app.services.category_alias import get_user_alias_lookup, match_alias_category


@dataclass
class ParsedTabularFile:
    headers: list[str]
    rows: list[dict]
    sheet_names: list[str]
    selected_sheet: str | None
    header_row_index: int


@dataclass
class PreparedImportFile:
    parsed_file: ParsedTabularFile
    mapping: dict[str, str]
    source_name: str
    source_type: str


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


def build_file_upload_response(
    import_file: ImportFile,
    *,
    message: str,
    status: str | None = None,
    selected_sheet: str | None = None,
    header_row_index: int | None = None,
    error_samples: list[str] | None = None,
    preview: list[ImportPreviewRow] | None = None,
) -> FileUploadResponse:
    return FileUploadResponse(
        upload_id=import_file.id,
        file_name=import_file.file_name,
        source_name=import_file.source_name,
        source_type=import_file.source_type,
        file_type=import_file.file_type,
        selected_sheet=selected_sheet,
        header_row_index=header_row_index,
        status=status or import_file.status,
        message=message,
        total_rows=import_file.total_rows,
        imported_rows=import_file.imported_rows,
        duplicate_rows=import_file.duplicate_rows,
        error_rows=import_file.error_rows,
        error_samples=error_samples or [],
        preview=preview or [],
        uploaded_at=import_file.uploaded_at,
    )


def build_import_file_status_response(
    db: Session,
    import_file: ImportFile,
    *,
    message: str | None = None,
) -> FileUploadResponse:
    preview_transactions = (
        db.query(NormalizedTransaction)
        .filter(
            NormalizedTransaction.user_id == import_file.user_id,
            NormalizedTransaction.import_file_id == import_file.id,
        )
        .order_by(NormalizedTransaction.transaction_date.desc())
        .limit(5)
        .all()
    )
    preview = [
        ImportPreviewRow(
            transaction_date=txn.transaction_date.isoformat(),
            amount=float(txn.amount),
            direction=txn.direction,
            description_clean=txn.description_clean,
            dedupe_status=txn.dedupe_status,
        )
        for txn in preview_transactions
    ]
    default_message = {
        "processing": "Statement processing is still running.",
        "processed": "Statement is ready.",
        "needs_review": "Statement could not be processed automatically.",
        "duplicate_file": "This file has already been imported for this user.",
    }.get(import_file.status, "Statement status loaded.")
    return build_file_upload_response(
        import_file,
        message=message or default_message,
        error_samples=[message or default_message] if import_file.status == "needs_review" else [],
        preview=preview,
    )


def find_existing_import_file(db: Session, *, user_id: str, file_hash: str) -> ImportFile | None:
    return (
        db.query(ImportFile)
        .filter(ImportFile.user_id == user_id, ImportFile.file_hash == file_hash)
        .order_by(ImportFile.uploaded_at.desc())
        .first()
    )


def create_processing_import_record(
    db: Session,
    *,
    user_id: str,
    file_name: str,
    file_type: str,
    file_hash: str,
    source_hint: str | None = None,
) -> ImportFile:
    source_type = source_hint if source_hint in {"bank", "card", "other"} else "other"
    import_file = ImportFile(
        user_id=user_id,
        file_name=file_name,
        file_type=file_type,
        source_name="pending_detection",
        source_type=source_type,
        file_hash=file_hash,
        status="processing",
        total_rows=0,
    )
    db.add(import_file)
    db.commit()
    db.refresh(import_file)
    return import_file


def mark_import_file_failed(
    db: Session,
    *,
    import_file_id: str,
    failure_message: str,
) -> FileUploadResponse | None:
    import_file = db.get(ImportFile, import_file_id)
    if import_file is None:
        return None

    import_file.status = "needs_review"
    import_file.imported_rows = 0
    import_file.duplicate_rows = 0
    import_file.error_rows = 1
    import_file.processed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(import_file)
    return build_file_upload_response(
        import_file,
        message=failure_message,
        error_samples=[failure_message],
    )


def prepare_import_file(
    *,
    file_name: str,
    file_type: str,
    content: bytes,
    source_hint: str | None = None,
) -> PreparedImportFile:
    parsed_file = read_rows_for_file_type(file_type, content)

    if not parsed_file.headers or not parsed_file.rows:
        raise ValueError("File contains no transaction data. Check that the file includes headers and at least one row of data.")

    bank_hint = extract_bank_hint_for_file_type(file_type, content)
    source_name, source_type = detect_source(
        file_name, parsed_file.headers, parsed_file.sheet_names, bank_hint, source_hint
    )
    mapping = map_columns(parsed_file.headers)

    if not mapping or (not mapping.get("amount") and not mapping.get("debit")):
        raise ValueError(f"Cannot find amount or debit/credit columns in the statement. Headers found: {', '.join(parsed_file.headers[:10])}. Check that your statement includes transaction amounts.")
    if not mapping.get("transaction_date"):
        raise ValueError(f"Cannot find transaction date column. Headers found: {', '.join(parsed_file.headers[:10])}. Check that your statement includes transaction dates.")

    return PreparedImportFile(
        parsed_file=parsed_file,
        mapping=mapping,
        source_name=source_name,
        source_type=source_type,
    )


def _process_prepared_import_file(
    db: Session,
    *,
    import_file: ImportFile,
    prepared: PreparedImportFile,
    success_message: str,
) -> FileUploadResponse:
    parsed_file = prepared.parsed_file
    mapping = prepared.mapping
    import_file.source_name = prepared.source_name
    import_file.source_type = prepared.source_type
    import_file.status = "processing"
    import_file.total_rows = len(parsed_file.rows)
    db.flush()

    imported_rows = 0
    duplicate_rows = 0
    error_rows = 0
    error_samples: list[str] = []
    preview: list[ImportPreviewRow] = []
    alias_lookup = get_user_alias_lookup(db, import_file.user_id)

    for index, raw_row in enumerate(parsed_file.rows, start=1):
        raw_description = _first_non_empty(raw_row, [mapping.get("description", "")])
        raw_amount_value = _first_non_empty(
            raw_row, [mapping.get("amount", ""), mapping.get("debit", ""), mapping.get("credit", "")]
        )
        raw_date_value = _first_non_empty(raw_row, [mapping.get("transaction_date", ""), mapping.get("posted_date", "")])

        import_row = ImportRow(
            import_file_id=import_file.id,
            user_id=import_file.user_id,
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
        default_direction = "debit" if prepared.source_type in {"card", "credit_card"} else None
        direction, normalized_amount = normalize_direction(raw_row, mapping, amount_value, default_direction=default_direction)

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
            user_id=import_file.user_id,
            transaction_date=transaction_date.isoformat(),
            amount=normalized_amount,
            direction=direction,
            description_clean=description_clean,
            raw_description=description_raw,
            source_name=prepared.source_name,
        )
        existing_transaction = (
            db.query(NormalizedTransaction)
            .filter(
                NormalizedTransaction.user_id == import_file.user_id,
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
                user_id=import_file.user_id,
                description_raw=description_raw,
                description_clean=description_clean,
                counterparty=counterparty,
                direction=direction,
                amount=float(normalized_amount),
                source_type=prepared.source_type,
                source_name=prepared.source_name,
            ),
            transaction_date=transaction_date,
        )
        alias_category = match_alias_category(
            alias_lookup,
            counterparty_name=counterparty,
            description_clean=description_clean,
        )
        if alias_category:
            categorization.category = alias_category
            categorization.subcategory = None
            categorization.unresolved = False
            categorization.confidence_score = max(categorization.confidence_score, 0.92)

        import_row.parse_status = "parsed"
        import_row.parse_errors = []

        normalized_transaction = NormalizedTransaction(
            user_id=import_file.user_id,
            import_file_id=import_file.id,
            import_row_id=import_row.id,
            source_name=prepared.source_name,
            source_type=prepared.source_type,
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

    return build_file_upload_response(
        import_file,
        selected_sheet=parsed_file.selected_sheet,
        header_row_index=parsed_file.header_row_index,
        message=success_message,
        error_samples=error_samples,
        preview=preview,
    )


def process_import_file_record(
    db: Session,
    *,
    import_file_id: str,
    content: bytes,
    source_hint: str | None = None,
) -> FileUploadResponse:
    import_file = db.get(ImportFile, import_file_id)
    if import_file is None:
        raise ValueError("Import file not found.")

    prepared = prepare_import_file(
        file_name=import_file.file_name,
        file_type=import_file.file_type,
        content=content,
        source_hint=source_hint,
    )
    return _process_prepared_import_file(
        db,
        import_file=import_file,
        prepared=prepared,
        success_message="File processed successfully.",
    )


def process_import_file(
    db: Session,
    *,
    user_id: str,
    file_name: str,
    file_type: str,
    content: bytes,
    force_reprocess: bool = True,
    source_hint: str | None = None,
) -> FileUploadResponse:
    file_hash = compute_file_hash(content)
    existing_file = find_existing_import_file(db, user_id=user_id, file_hash=file_hash)
    if existing_file is not None:
        if force_reprocess:
            db.delete(existing_file)
            db.flush()
        else:
            return build_file_upload_response(
                existing_file,
                status="duplicate_file",
                message="This file has already been imported for this user.",
            )

    prepared = prepare_import_file(
        file_name=file_name,
        file_type=file_type,
        content=content,
        source_hint=source_hint,
    )
    import_file = ImportFile(
        user_id=user_id,
        file_name=file_name,
        file_type=file_type,
        source_name=prepared.source_name,
        source_type=prepared.source_type,
        file_hash=file_hash,
        status="processing",
        total_rows=len(prepared.parsed_file.rows),
    )
    db.add(import_file)
    db.flush()
    return _process_prepared_import_file(
        db,
        import_file=import_file,
        prepared=prepared,
        success_message="File processed successfully." if existing_file is None else "File reprocessed successfully.",
    )


def create_failed_import_response(
    db: Session,
    *,
    user_id: str,
    file_name: str,
    file_type: str,
    content: bytes,
    failure_message: str,
) -> FileUploadResponse:
    file_hash = compute_file_hash(content)
    import_file = ImportFile(
        user_id=user_id,
        file_name=file_name,
        file_type=file_type,
        source_name="unknown_source",
        source_type="other",
        file_hash=file_hash,
        status="needs_review",
        total_rows=0,
        imported_rows=0,
        duplicate_rows=0,
        error_rows=1,
        processed_at=datetime.now(timezone.utc),
    )
    db.add(import_file)
    db.commit()
    db.refresh(import_file)
    return FileUploadResponse(
        upload_id=import_file.id,
        file_name=import_file.file_name,
        source_name=import_file.source_name,
        source_type=import_file.source_type,
        file_type=import_file.file_type,
        selected_sheet=None,
        header_row_index=None,
        status=import_file.status,
        message=failure_message,
        total_rows=0,
        imported_rows=0,
        duplicate_rows=0,
        error_rows=1,
        error_samples=[failure_message],
        preview=[],
        uploaded_at=import_file.uploaded_at,
    )
