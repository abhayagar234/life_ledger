from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.goal import Goal
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalRead, GoalUpdate
from app.services.goal import list_goals_for_user

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=list[GoalRead])
def list_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_goals_for_user(db, current_user.id)


@router.post("", response_model=GoalRead)
def create_goal(
    payload: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = Goal(
        user_id=current_user.id,
        goal_type=payload.goal_type.value,
        name=payload.name,
        target_amount=payload.target_amount,
        current_amount=payload.current_amount,
        target_date=payload.target_date,
        priority_level=payload.priority_level,
        notes=payload.notes,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


@router.patch("/{goal_id}", response_model=GoalRead)
def update_goal(
    goal_id: str,
    payload: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == current_user.id).first()
    if goal is None:
        raise HTTPException(status_code=404, detail="Goal not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(goal, key, value.value if hasattr(value, "value") else value)

    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal
