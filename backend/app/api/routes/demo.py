from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.services.demo_data import reset_demo_financial_data

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/sample-statement")
def load_sample_statement(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    reset_demo_financial_data(db, current_user.id)
    return {
        "status": "ok",
        "message": "Sample statement data is ready. Refresh the dashboard to see the updated cashflow answer.",
    }
