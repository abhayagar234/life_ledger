from sqlalchemy.orm import Session

from app.models.budget import Budget


def list_budgets_for_user(db: Session, user_id: str) -> list[Budget]:
    return db.query(Budget).filter(Budget.user_id == user_id).order_by(Budget.start_date.desc()).all()
