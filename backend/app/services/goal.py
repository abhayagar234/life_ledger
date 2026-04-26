from sqlalchemy.orm import Session

from app.models.goal import Goal


def list_goals_for_user(db: Session, user_id: str) -> list[Goal]:
    return db.query(Goal).filter(Goal.user_id == user_id).order_by(Goal.created_at.desc()).all()
