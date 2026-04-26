from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.budget import Budget
from app.models.user import User
from app.schemas.budget import BudgetCreate, BudgetRead, BudgetUpdate
from app.services.budget import list_budgets_for_user

router = APIRouter(prefix="/budgets", tags=["budgets"])


@router.get("", response_model=list[BudgetRead])
def list_budgets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_budgets_for_user(db, current_user.id)


@router.post("", response_model=BudgetRead)
def create_budget(
    payload: BudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget = Budget(
        user_id=current_user.id,
        name=payload.name,
        period_type=payload.period_type.value,
        start_date=payload.start_date,
        end_date=payload.end_date,
        category_code=payload.category_code,
        limit_amount=payload.limit_amount,
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget


@router.patch("/{budget_id}", response_model=BudgetRead)
def update_budget(
    budget_id: str,
    payload: BudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    budget = db.query(Budget).filter(Budget.id == budget_id, Budget.user_id == current_user.id).first()
    if budget is None:
        raise HTTPException(status_code=404, detail="Budget not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(budget, key, value.value if hasattr(value, "value") else value)

    db.add(budget)
    db.commit()
    db.refresh(budget)
    return budget
