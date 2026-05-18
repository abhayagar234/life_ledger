from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.emi_payment import EMIPayment
from app.models.loan import Loan
from app.models.user import User
from app.schemas.cashflow import CashflowSummaryResponse
from app.services.cashflow import build_cashflow_summary
from app.services.due_matching import due_amount_bucket, due_counterparty_matches

router = APIRouter(prefix="/cashflow", tags=["cashflow"])


class ConfirmPatternDueRequest(BaseModel):
    name: str
    amount: float
    due_date: date
    frequency: str | None = "monthly"


class ConfirmPatternDueResponse(BaseModel):
    loan_id: str
    emi_payment_id: str
    message: str


@router.get("/summary", response_model=CashflowSummaryResponse)
def get_cashflow_summary(
    as_of: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CashflowSummaryResponse:
    return build_cashflow_summary(db=db, user_id=current_user.id, as_of=as_of)


@router.post("/refresh", response_model=CashflowSummaryResponse)
def refresh_cashflow_summary(
    as_of: date | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CashflowSummaryResponse:
    return build_cashflow_summary(db=db, user_id=current_user.id, as_of=as_of)


@router.post("/confirm-pattern-due", response_model=ConfirmPatternDueResponse)
def confirm_pattern_due(
    payload: ConfirmPatternDueRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ConfirmPatternDueResponse:
    try:
        existing_loans = (
            db.query(Loan)
            .filter(
                Loan.user_id == current_user.id,
                Loan.confirmed == True,
                Loan.status == "active",
                Loan.emi_amount.isnot(None),
            )
            .all()
        )
        requested_bucket = due_amount_bucket(payload.amount)
        requested_frequency = payload.frequency or "monthly"
        for loan in existing_loans:
            loan_frequency = loan.emi_frequency or "monthly"
            if loan_frequency != requested_frequency:
                continue
            if abs(due_amount_bucket(float(loan.emi_amount or 0)) - requested_bucket) > 100:
                continue
            if not due_counterparty_matches(loan.counterparty_name, payload.name):
                continue
            emi = (
                db.query(EMIPayment)
                .filter(EMIPayment.user_id == current_user.id, EMIPayment.loan_id == loan.id)
                .order_by(EMIPayment.due_date.desc())
                .first()
            )
            if emi is not None:
                return ConfirmPatternDueResponse(
                    loan_id=loan.id,
                    emi_payment_id=emi.id,
                    message=f"{payload.name} is already protected on Home.",
                )

        loan = Loan(
            user_id=current_user.id,
            loan_type="informal_due",
            counterparty_name=payload.name,
            principal_amount=payload.amount,
            interest_type="none",
            start_date=date.today(),
            emi_amount=payload.amount,
            emi_frequency=payload.frequency or "monthly",
            status="active",
            confirmed=True,
            notes=f"Confirmed from detected pattern",
        )
        db.add(loan)
        db.flush()

        emi = EMIPayment(
            user_id=current_user.id,
            loan_id=loan.id,
            due_date=payload.due_date,
            amount_due=payload.amount,
            amount_paid=0,
            status="pending",
            source_type="pattern_confirmed",
        )
        db.add(emi)
        db.commit()
        db.refresh(emi)

        return ConfirmPatternDueResponse(
            loan_id=loan.id,
            emi_payment_id=emi.id,
            message=f"Confirmed {payload.name} as recurring due of Rs {int(payload.amount)}",
        )
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to confirm due: {str(exc)}") from exc
