from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.financial_profile import FinancialProfile
from app.models.user import User
from app.schemas.profile import ProfileOnboardingUpdate, ProfileRead

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileRead | None)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(FinancialProfile).filter(FinancialProfile.user_id == current_user.id).first()


@router.put("/onboarding", response_model=ProfileRead)
def upsert_profile_onboarding(
    payload: ProfileOnboardingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    current_user.display_name = payload.display_name
    profile = db.query(FinancialProfile).filter(FinancialProfile.user_id == current_user.id).first()

    if profile is None:
        profile = FinancialProfile(user_id=current_user.id)
        db.add(profile)

    profile.user_type = payload.user_type.value
    profile.income_pattern = payload.income_pattern.value
    profile.tracks_cash = payload.tracks_cash
    profile.tracks_loans = payload.tracks_loans
    profile.tracks_emi = payload.tracks_emi
    profile.tracking_scope = payload.tracking_scope.value
    profile.start_cash_amount = payload.start_cash_amount
    profile.salary_day_of_month = payload.salary_day_of_month
    profile.business_mode_enabled = payload.business_mode_enabled
    profile.currency_code = "INR"
    profile.updated_at = datetime.utcnow()

    db.add(current_user)
    db.commit()
    db.refresh(profile)
    return profile
