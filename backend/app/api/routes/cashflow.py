from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.cashflow import CashflowSummaryResponse
from app.services.cashflow import build_cashflow_summary

router = APIRouter(prefix="/cashflow", tags=["cashflow"])


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
