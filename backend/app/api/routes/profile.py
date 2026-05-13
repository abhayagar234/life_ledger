from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.financial_profile import FinancialProfile
from app.models.user import User
from app.schemas.profile import ProfileBankBalanceUpdate, ProfileDailyNeedsUpdate, ProfileOnboardingUpdate, ProfileRead

router = APIRouter(prefix="/profile", tags=["profile"])


def _normalized_tracking_scope(value: str) -> str:
    return "personal" if value == "home_and_business" else value


def _normalized_money_mix_type(value: str) -> str:
    return value if value in {"home", "business", "mixed"} else "home"


@router.get("", response_model=ProfileRead | None)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(FinancialProfile).filter(FinancialProfile.user_id == current_user.id).first()
    if profile is not None and (
        profile.tracking_scope == "home_and_business"
        or not profile.money_mix_type
        or profile.receives_salary_besides_business is None
    ):
        if profile.tracking_scope == "home_and_business":
            profile.tracking_scope = "personal"
        if not profile.money_mix_type:
            profile.money_mix_type = "home"
        if profile.receives_salary_besides_business is None:
            profile.receives_salary_besides_business = False
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


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
    profile.tracking_scope = _normalized_tracking_scope(payload.tracking_scope.value)
    profile.start_cash_amount = payload.start_cash_amount
    profile.salary_day_of_month = payload.salary_day_of_month
    profile.next_income_in_days = payload.next_income_in_days
    profile.business_mode_enabled = payload.business_mode_enabled
    profile.money_mix_type = _normalized_money_mix_type(payload.money_mix_type)
    profile.receives_salary_besides_business = payload.receives_salary_besides_business
    profile.business_reserve_amount = max(float(payload.business_reserve_amount), 0.0) if payload.business_reserve_amount is not None else None
    profile.currency_code = "INR"
    profile.updated_at = datetime.utcnow()

    db.add(current_user)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/bank-balance", response_model=ProfileRead)
def update_bank_balance(
    payload: ProfileBankBalanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(FinancialProfile).filter(FinancialProfile.user_id == current_user.id).first()
    if profile is None:
        profile = FinancialProfile(
            user_id=current_user.id,
            user_type="salaried",
            income_pattern="monthly",
        )
        db.add(profile)

    profile.bank_balance_confirmed = max(float(payload.amount), 0.0)
    profile.bank_balance_source = payload.source if payload.source in {"detected", "manual"} else "manual"
    profile.bank_balance_last_confirmed_at = datetime.utcnow()
    profile.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(profile)
    return profile


@router.put("/daily-needs", response_model=ProfileRead)
def update_daily_needs(
    payload: ProfileDailyNeedsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    profile = db.query(FinancialProfile).filter(FinancialProfile.user_id == current_user.id).first()
    if profile is None:
        profile = FinancialProfile(
            user_id=current_user.id,
            user_type="salaried",
            income_pattern="monthly",
        )
        db.add(profile)

    profile.daily_needs_override = max(float(payload.amount), 0.0)
    profile.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(profile)
    return profile
