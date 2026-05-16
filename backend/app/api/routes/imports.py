import logging
from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.ingestion.pipeline import create_failed_import_response, process_import_file
from app.ingestion.service import detect_import_file_type
from app.models.emi_payment import EMIPayment
from app.models.import_file import ImportFile
from app.models.loan import Loan
from app.models.user import User
from app.schemas.imports import (
    CategoryHelpCandidate,
    CategoryMappingRequest,
    CategoryMappingResponse,
    ConfirmDuesRequest,
    ConfirmDuesResponse,
    DetectedDueResponse,
    FileUploadResponse,
    ImportCoverageResponse,
    ImportSummaryResponse,
)
from app.services.category_alias import (
    CategoryMappingInput,
    apply_aliases_to_uncategorized_transactions,
    normalize_merchant_key,
    upsert_user_category_aliases,
)
from app.services.due_extractor import extract_detected_dues

logger = logging.getLogger(__name__)


def _categorize_import_error(error_msg: str, file_type: str) -> str:
    error_lower = error_msg.lower()

    if "password" in error_lower or "encrypted" in error_lower:
        return "PDF is password-protected. Please remove the password and try again."
    if "no pages" in error_lower or "empty" in error_lower:
        return f"The {file_type} file appears to be empty or corrupted."
    if "header" in error_lower or "no readable" in error_lower:
        return "Could not find transaction headers in this file. Check the file format or try a different export format."
    if "openpyxl" in error_lower:
        return "XLSX format not supported. Please convert to CSV or PDF and try again."
    if "xlrd" in error_lower:
        return "XLS format not supported. Please convert to CSV, XLSX, or PDF and try again."
    if "amount" in error_lower and "date" in error_lower:
        return "File is missing required columns (date and amount). Check your statement format."
    if "amount" in error_lower:
        return "Could not identify amount column. Check that amounts are in a standard format."
    if "date" in error_lower:
        return "Could not identify date column. Check that dates are in DD/MM/YYYY or similar format."
    if "decode" in error_lower or "encoding" in error_lower or "utf" in error_lower:
        return "File encoding issue. Try saving as UTF-8 CSV and upload again."
    if "max" in error_lower or "size" in error_lower:
        return "File is too large. Please upload a smaller statement or split into multiple files."
    if file_type == "pdf":
        return "Unable to extract data from PDF. Try exporting as CSV from your bank instead."
    return "We could not fully read this statement format yet. Please try another file or export in CSV format."


def _display_merchant_name(txn) -> str:
    merchant = (txn.counterparty_name or "").strip().lower()
    if merchant:
        return " ".join(merchant.split()[:4])
    description = (txn.description_clean or "").strip().lower()
    if not description:
        return "unknown"
    tokens = [token for token in description.split() if token not in {"upi", "dr", "cr", "bank", "payment"}]
    if not tokens:
        return "unknown"
    return " ".join(tokens[:4])


def _candidate_merchant_name(txn) -> str:
    merchant = (txn.counterparty_name or "").strip()
    if merchant:
        return merchant
    return _display_merchant_name(txn)


router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("/files", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    force_reprocess: bool = True,
    source_hint: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> FileUploadResponse:
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    file_type = detect_import_file_type(file.filename or "", content)
    if file_type is None:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Use .csv, .xlsx, .xls, or .pdf.",
        )

    try:
        return process_import_file(
            db,
            user_id=current_user.id,
            file_name=file.filename or "upload",
            file_type=file_type,
            content=content,
            force_reprocess=force_reprocess,
            source_hint=source_hint,
        )
    except (RuntimeError, ValueError) as exc:
        detail = str(exc)
        return create_failed_import_response(
            db,
            user_id=current_user.id,
            file_name=file.filename or "upload",
            file_type=file_type,
            content=content,
            failure_message=detail,
        )
    except Exception as exc:
        error_msg = str(exc)
        logger.error(f"Unhandled error during import processing: {error_msg}", exc_info=True)

        error_details = _categorize_import_error(error_msg, file_type)
        return create_failed_import_response(
            db,
            user_id=current_user.id,
            file_name=file.filename or "upload",
            file_type=file_type,
            content=content,
            failure_message=error_details,
        )


@router.get("/{upload_id}/detected-dues", response_model=list[DetectedDueResponse])
def get_detected_dues(
    upload_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DetectedDueResponse]:
    import_file = (
        db.query(ImportFile)
        .filter(ImportFile.id == upload_id, ImportFile.user_id == current_user.id)
        .first()
    )
    if not import_file:
        raise HTTPException(status_code=404, detail="Import file not found.")

    detected = extract_detected_dues(db, user_id=current_user.id, upload_id=upload_id)
    return [
        DetectedDueResponse(
            counterparty_name=d.counterparty_name,
            amount=d.amount,
            frequency=d.frequency,
            next_due_estimate=d.next_due_estimate,
            confidence=d.confidence,
            category_code=d.category_code,
            sample_dates=d.sample_dates,
            transaction_ids=d.transaction_ids,
        )
        for d in detected
    ]


@router.get("/{upload_id}/summary", response_model=ImportSummaryResponse)
def get_import_summary(
    upload_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportSummaryResponse:
    import_file = (
        db.query(ImportFile)
        .filter(ImportFile.id == upload_id, ImportFile.user_id == current_user.id)
        .first()
    )
    if not import_file:
        raise HTTPException(status_code=404, detail="Import file not found.")

    from app.models.normalized_transaction import NormalizedTransaction
    from collections import defaultdict

    transactions = (
        db.query(NormalizedTransaction)
        .filter(
            NormalizedTransaction.user_id == current_user.id,
            NormalizedTransaction.import_file_id == upload_id,
            NormalizedTransaction.dedupe_status != "duplicate",
        )
        .all()
    )

    total_income = 0.0
    total_spend = 0.0
    total_upi = 0.0
    total_cash_withdrawal = 0.0
    total_transfer = 0.0
    category_totals: dict[str, float] = defaultdict(float)
    merchant_totals: dict[str, float] = defaultdict(float)
    dates = []
    non_spend_categories = {"salary_income", "business_income", "transfers", "savings_investments"}

    for txn in transactions:
        amount = float(txn.amount)
        if txn.direction == "credit":
            total_income += amount
        else:
            total_spend += amount

        category = txn.category_code or "uncategorized"
        description_lower = (txn.description_clean or "").lower()
        raw_lower = (txn.description_raw or "").lower()

        if txn.direction == "debit" and category not in non_spend_categories:
            category_totals[category] += amount
            merchant_totals[_display_merchant_name(txn)] += amount

        if txn.direction == "debit":
            if "upi" in description_lower or "upi" in raw_lower:
                total_upi += amount
            is_pos_atm_purchase = "pos atm" in description_lower or "pos atm" in raw_lower
            is_atm_like = (
                ("atm wdl" in description_lower or "atm wdl" in raw_lower)
                or ("cash withdrawal" in description_lower and not is_pos_atm_purchase)
            )
            if (is_atm_like and not is_pos_atm_purchase) or category == "cash_withdrawal":
                total_cash_withdrawal += amount
            if category == "transfers":
                total_transfer += amount

        if txn.transaction_date:
            dates.append(txn.transaction_date.isoformat())

    sorted_categories = sorted(
        ((cat, amt) for cat, amt in category_totals.items() if amt > 0),
        key=lambda x: x[1],
        reverse=True,
    )
    top_categories = dict(sorted_categories[:5])
    top_merchants = dict(
        (merchant, round(amt, 2))
        for merchant, amt in sorted(
            ((name, value) for name, value in merchant_totals.items() if value > 0 and name != "unknown"),
            key=lambda item: item[1],
            reverse=True,
        )[:5]
    )
    uncategorized_spend = float(category_totals.get("uncategorized", 0.0))
    categorized_spend = sum(value for key, value in category_totals.items() if key != "uncategorized")
    denominator = categorized_spend + uncategorized_spend
    category_coverage_ratio = round((categorized_spend / denominator), 4) if denominator > 0 else 1.0

    most_spent_category = None
    most_spent_amount = 0
    credit_card_insights: dict[str, str] = {}
    meaningful = [item for item in sorted_categories if item[0] != "uncategorized"]
    top_for_badge = meaningful[0] if meaningful else (sorted_categories[0] if sorted_categories else None)
    if top_for_badge:
        most_spent_category = top_for_badge[0].replace("_", " ").title()
        most_spent_amount = top_for_badge[1]

    date_range = None
    period_days = None
    period_months = None
    if dates:
        dates.sort()
        date_range = (dates[0], dates[-1])
        start = date.fromisoformat(dates[0])
        end = date.fromisoformat(dates[-1])
        period_days = max((end - start).days + 1, 1)
        period_months = round(period_days / 30.4, 1)

    for txn in transactions[:10]:
        raw = txn.import_row.raw_data if txn.import_row else {}
        for key, value in (raw or {}).items():
            key_text = str(key)
            if key_text.startswith("statement_") and key_text != "statement_clear_balance" and value not in (None, ""):
                credit_card_insights[key_text] = str(value)

    return ImportSummaryResponse(
        total_income=round(total_income, 2),
        total_spend=round(total_spend, 2),
        total_upi=round(total_upi, 2),
        total_cash_withdrawal=round(total_cash_withdrawal, 2),
        total_transfer=round(total_transfer, 2),
        top_categories={k: round(v, 2) for k, v in top_categories.items()},
        top_merchants=top_merchants,
        category_coverage_ratio=category_coverage_ratio,
        uncategorized_spend=round(uncategorized_spend, 2),
        most_spent_category=most_spent_category,
        most_spent_amount=round(most_spent_amount, 2),
        date_range=date_range,
        period_days=period_days,
        period_months=period_months,
        credit_card_insights=credit_card_insights or None,
    )


@router.post("/{upload_id}/confirm-dues", response_model=ConfirmDuesResponse)
def confirm_dues(
    upload_id: str,
    payload: ConfirmDuesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConfirmDuesResponse:
    import_file = (
        db.query(ImportFile)
        .filter(ImportFile.id == upload_id, ImportFile.user_id == current_user.id)
        .first()
    )
    if not import_file:
        raise HTTPException(status_code=404, detail="Import file not found.")

    created_loan_ids: list[str] = []

    try:
        for item in payload.confirmed_dues:
            if item.frequency not in ("weekly", "monthly"):
                raise HTTPException(
                    status_code=422,
                    detail=f"Frequency must be 'weekly' or 'monthly', got '{item.frequency}'.",
                )

            loan = Loan(
                user_id=current_user.id,
                loan_type="informal_due",
                counterparty_name=item.custom_name or item.counterparty_name,
                principal_amount=item.amount,
                interest_type="none",
                start_date=date.today(),
                emi_amount=item.amount,
                emi_frequency=item.frequency,
                status="active",
                notes=(
                    f"Auto-detected from import {upload_id}"
                    + (f" | category:{item.category_code}" if item.category_code else "")
                ),
            )
            db.add(loan)
            db.flush()

            emi = EMIPayment(
                user_id=current_user.id,
                loan_id=loan.id,
                due_date=item.next_due_date,
                amount_due=item.amount,
                amount_paid=0,
                status="pending",
                source_type="import_detected",
            )
            db.add(emi)
            db.flush()
            created_loan_ids.append(loan.id)

        db.commit()
        return ConfirmDuesResponse(
            created_loans=created_loan_ids,
            message=f"Created {len(created_loan_ids)} loan(s) from detected dues.",
        )
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create loans: {str(exc)}") from exc


@router.post("/category-mappings", response_model=CategoryMappingResponse)
def save_category_mappings(
    payload: CategoryMappingRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CategoryMappingResponse:
    if not payload.mappings:
        return CategoryMappingResponse(saved_mappings=0, updated_transactions=0, message="No mappings provided.")

    try:
        mapping_inputs = [
            CategoryMappingInput(
                merchant_key=item.merchant_key,
                merchant_label=item.merchant_label,
                category_code=item.category_code,
            )
            for item in payload.mappings
        ]
        saved = upsert_user_category_aliases(db, current_user.id, mapping_inputs)
        updated = apply_aliases_to_uncategorized_transactions(db, current_user.id)
        db.commit()
        return CategoryMappingResponse(
            saved_mappings=saved,
            updated_transactions=updated,
            message=f"Saved {saved} mapping(s). Updated {updated} transaction(s).",
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Could not save category mappings: {str(exc)}") from exc


@router.get("/coverage", response_model=ImportCoverageResponse)
def get_import_coverage(
    upload_ids: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ImportCoverageResponse:
    from collections import defaultdict

    from app.models.normalized_transaction import NormalizedTransaction

    uploads_query = db.query(ImportFile).filter(ImportFile.user_id == current_user.id, ImportFile.status == "processed")
    requested_ids: list[str] = []
    if upload_ids:
        requested_ids = [item.strip() for item in upload_ids.split(",") if item.strip()]
        if requested_ids:
            uploads_query = uploads_query.filter(ImportFile.id.in_(requested_ids))
    uploads = uploads_query.all()
    scoped_upload_ids = [upload.id for upload in uploads]
    if not scoped_upload_ids:
        return ImportCoverageResponse(
            total_uploads=0,
            total_transactions=0,
            date_range=None,
            period_days=None,
            period_months=None,
            account_coverage={},
            total_spend=0,
            total_income=0,
            total_upi=0,
            total_cash_withdrawal=0,
            top_categories_current_month={},
            most_spent_category_current_month=None,
            most_spent_amount_current_month=0,
            recurring_dues=[],
        )

    transactions = (
        db.query(NormalizedTransaction)
        .filter(
            NormalizedTransaction.user_id == current_user.id,
            NormalizedTransaction.import_file_id.in_(scoped_upload_ids),
            NormalizedTransaction.dedupe_status != "duplicate",
        )
        .all()
    )

    total_income = 0.0
    total_spend = 0.0
    total_upi = 0.0
    total_cash_withdrawal = 0.0
    dates: list[str] = []
    account_coverage: dict[str, int] = defaultdict(int)
    latest_month_category_totals: dict[str, float] = defaultdict(float)
    overall_category_totals: dict[str, float] = defaultdict(float)
    overall_merchant_totals: dict[str, float] = defaultdict(float)
    category_help_aggregates: dict[str, dict[str, float | int | str]] = {}
    non_spend_categories = {"salary_income", "business_income", "transfers", "savings_investments"}

    for txn in transactions:
        amount = float(txn.amount)
        if txn.direction == "credit":
            total_income += amount
        else:
            total_spend += amount
        source = (txn.source_type or "other").lower()
        if source in {"credit_card", "card"}:
            source = "card"
        elif source in {"bank", "savings", "current"}:
            source = "bank"
        account_coverage[source] += 1

        description_lower = (txn.description_clean or "").lower()
        raw_lower = (txn.description_raw or "").lower()
        category = txn.category_code or "uncategorized"
        if txn.direction == "debit" and category not in non_spend_categories:
            overall_category_totals[category] += amount
            overall_merchant_totals[_display_merchant_name(txn)] += amount
        if txn.direction == "debit" and category == "uncategorized" and amount >= 1000:
            merchant_label = _candidate_merchant_name(txn)
            merchant_key = normalize_merchant_key(merchant_label)
            if merchant_key:
                entry = category_help_aggregates.get(merchant_key)
                if entry is None:
                    category_help_aggregates[merchant_key] = {
                        "merchant_key": merchant_key,
                        "merchant_label": merchant_label,
                        "total_amount": float(amount),
                        "transaction_count": 1,
                    }
                else:
                    entry["total_amount"] = float(entry["total_amount"]) + float(amount)
                    entry["transaction_count"] = int(entry["transaction_count"]) + 1
        if txn.direction == "debit" and ("upi" in description_lower or "upi" in raw_lower):
            total_upi += amount
        is_pos_atm_purchase = "pos atm" in description_lower or "pos atm" in raw_lower
        is_atm_like = (
            ("atm wdl" in description_lower or "atm wdl" in raw_lower)
            or ("cash withdrawal" in description_lower and not is_pos_atm_purchase)
        )
        if txn.direction == "debit" and (((is_atm_like and not is_pos_atm_purchase) or txn.category_code == "cash_withdrawal")):
            total_cash_withdrawal += amount

        if txn.transaction_date:
            dates.append(txn.transaction_date.isoformat())

    latest_txn_date = max((txn.transaction_date for txn in transactions), default=None)
    if latest_txn_date is not None:
        for txn in transactions:
            if txn.transaction_date.year != latest_txn_date.year or txn.transaction_date.month != latest_txn_date.month:
                continue
            if txn.direction != "debit":
                continue
            category = txn.category_code or "uncategorized"
            if category in non_spend_categories:
                continue
            latest_month_category_totals[category] += float(txn.amount)

    date_range = None
    period_days = None
    period_months = None
    if dates:
        dates.sort()
        date_range = (dates[0], dates[-1])
        start = date.fromisoformat(dates[0])
        end = date.fromisoformat(dates[-1])
        period_days = max((end - start).days + 1, 1)
        period_months = round(period_days / 30.4, 1)

    sorted_month_categories = sorted(
        ((cat, amt) for cat, amt in latest_month_category_totals.items() if amt > 0),
        key=lambda item: item[1],
        reverse=True,
    )
    top_month_categories = dict((cat, round(amt, 2)) for cat, amt in sorted_month_categories[:5])
    sorted_overall_categories = sorted(
        ((cat, amt) for cat, amt in overall_category_totals.items() if amt > 0),
        key=lambda item: item[1],
        reverse=True,
    )
    top_overall_categories = dict((cat, round(amt, 2)) for cat, amt in sorted_overall_categories[:8])
    top_merchants_overall = dict(
        (merchant, round(amt, 2))
        for merchant, amt in sorted(
            ((name, value) for name, value in overall_merchant_totals.items() if value > 0 and name != "unknown"),
            key=lambda item: item[1],
            reverse=True,
        )[:8]
    )
    uncategorized_spend_overall = float(overall_category_totals.get("uncategorized", 0.0))
    categorized_spend_overall = sum(value for key, value in overall_category_totals.items() if key != "uncategorized")
    denominator = categorized_spend_overall + uncategorized_spend_overall
    category_coverage_ratio = round((categorized_spend_overall / denominator), 4) if denominator > 0 else 1.0
    meaningful_month = [item for item in sorted_month_categories if item[0] != "uncategorized"]
    top_month = meaningful_month[0] if meaningful_month else (sorted_month_categories[0] if sorted_month_categories else None)
    most_spent_category_current_month = (
        top_month[0].replace("_", " ").title() if top_month else None
    )
    most_spent_amount_current_month = round(top_month[1], 2) if top_month else 0.0

    # Run recurring detection on the combined cross-statement timeline.
    # This is critical for credit-card flows where each monthly PDF has only one cycle.
    detected_combined = extract_detected_dues(
        db,
        user_id=current_user.id,
        upload_ids=scoped_upload_ids if scoped_upload_ids else None,
    )
    recurring_detected = sorted(
        detected_combined,
        key=lambda item: (-item.confidence, -item.amount),
    )[:12]
    recurring_dues = [
        DetectedDueResponse(
            counterparty_name=due.counterparty_name,
            amount=due.amount,
            frequency=due.frequency,
            next_due_estimate=due.next_due_estimate,
            confidence=due.confidence,
            category_code=due.category_code,
            sample_dates=due.sample_dates,
            transaction_ids=due.transaction_ids,
        )
        for due in recurring_detected
    ]
    category_help_candidates = [
        CategoryHelpCandidate(
            merchant_key=item["merchant_key"],  # type: ignore[index]
            merchant_label=item["merchant_label"],  # type: ignore[index]
            total_amount=round(float(item["total_amount"]), 2),  # type: ignore[index]
            transaction_count=int(item["transaction_count"]),  # type: ignore[index]
        )
        for item in sorted(
            category_help_aggregates.values(),
            key=lambda row: float(row["total_amount"]),
            reverse=True,
        )[:6]
    ]

    return ImportCoverageResponse(
        total_uploads=len(uploads),
        total_transactions=len(transactions),
        date_range=date_range,
        period_days=period_days,
        period_months=period_months,
        account_coverage=dict(account_coverage),
        total_spend=round(total_spend, 2),
        total_income=round(total_income, 2),
        total_upi=round(total_upi, 2),
        total_cash_withdrawal=round(total_cash_withdrawal, 2),
        top_categories_current_month=top_month_categories,
        top_categories_overall=top_overall_categories,
        top_merchants_overall=top_merchants_overall,
        category_coverage_ratio=category_coverage_ratio,
        uncategorized_spend_overall=round(uncategorized_spend_overall, 2),
        most_spent_category_current_month=most_spent_category_current_month,
        most_spent_amount_current_month=most_spent_amount_current_month,
        recurring_dues=recurring_dues,
        category_help_candidates=category_help_candidates,
    )
