from typing import Generator, Optional

from fastapi import Depends, Query
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.user import User


DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001"


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    user_id: Optional[str] = Query(default=None, description="Optional demo user id"),
    db: Session = Depends(get_db),
) -> User:
    resolved_user_id = user_id or DEFAULT_USER_ID
    user = db.get(User, resolved_user_id)

    if user is None:
        user = User(id=resolved_user_id, display_name="Demo User")
        db.add(user)
        db.commit()
        db.refresh(user)

    return user
