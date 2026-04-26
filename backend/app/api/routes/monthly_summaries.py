from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.monthly_summary import MonthlySummaryRead
from app.services.monthly_summary import build_monthly_summary

router = APIRouter(prefix="/monthly-summaries", tags=["monthly summaries"])


@router.get("/{year}/{month}", response_model=MonthlySummaryRead)
def get_monthly_summary(
    year: int,
    month: int,
    refresh: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return build_monthly_summary(db=db, user_id=current_user.id, year=year, month=month, refresh=refresh)
