from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.user import User
from app.schemas.auth import DemoLoginRequest, DemoLoginResponse
from app.services.demo_data import seed_demo_financial_data

router = APIRouter(prefix="/auth", tags=["auth"])


def _is_generic_demo_name(display_name: str) -> bool:
    normalized = display_name.strip().lower()
    return normalized == "moneyos user" or normalized.startswith("moneyos user ")


@router.post("/demo-login", response_model=DemoLoginResponse)
def demo_login(payload: DemoLoginRequest, db: Session = Depends(get_db)) -> DemoLoginResponse:
    should_force_new = payload.force_new or _is_generic_demo_name(payload.display_name)
    user = None if should_force_new else db.query(User).filter(User.display_name == payload.display_name).first()
    if user is None:
        user = User(display_name=payload.display_name, phone_number=payload.phone_number)
        db.add(user)
        db.commit()
        db.refresh(user)
    seed_demo_financial_data(db, user.id)

    return DemoLoginResponse(
        user_id=user.id,
        display_name=user.display_name,
        message="Use this user_id as a query parameter for subsequent demo API calls.",
    )
