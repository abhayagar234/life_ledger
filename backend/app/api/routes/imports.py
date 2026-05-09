from datetime import date

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.ingestion.pipeline import process_import_file
from app.ingestion.service import detect_import_file_type
from app.models.emi_payment import EMIPayment
from app.models.import_file import ImportFile
from app.models.loan import Loan
from app.models.user import User
from app.schemas.imports import (
    ConfirmDuesRequest,
    ConfirmDuesResponse,
    DetectedDueResponse,
    FileUploadResponse,
)
from app.services.due_extractor import extract_detected_dues

router = APIRouter(prefix="/imports", tags=["imports"])


@router.post("/files", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    force_reprocess: bool = True,
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
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


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
                notes=f"Auto-detected from import {upload_id}",
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
