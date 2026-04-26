from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.insights import InsightCard, SpendingInsightsResponse
from app.services.insights import build_insight_cards_from_summary, build_spending_insights

router = APIRouter(prefix="/insights", tags=["insights"])


@router.get("", response_model=list[InsightCard])
def list_insights(
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[InsightCard]:
    today = date.today()
    summary = build_spending_insights(
        db,
        user_id=current_user.id,
        year=year or today.year,
        month=month or today.month,
    )
    return build_insight_cards_from_summary(summary)


@router.get("/summary", response_model=SpendingInsightsResponse)
def get_spending_summary(
    year: int | None = None,
    month: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SpendingInsightsResponse:
    today = date.today()
    return build_spending_insights(
        db,
        user_id=current_user.id,
        year=year or today.year,
        month=month or today.month,
    )
