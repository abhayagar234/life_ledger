from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict

from app.models.enums import GoalStatus, GoalType


class GoalCreate(BaseModel):
    goal_type: GoalType = GoalType.SAVINGS
    name: str
    target_amount: float
    current_amount: float = 0
    target_date: Optional[date] = None
    priority_level: Optional[str] = None
    notes: Optional[str] = None


class GoalUpdate(BaseModel):
    current_amount: Optional[float] = None
    target_date: Optional[date] = None
    priority_level: Optional[str] = None
    status: Optional[GoalStatus] = None
    notes: Optional[str] = None


class GoalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    goal_type: str
    name: str
    target_amount: float
    current_amount: float
    target_date: Optional[date]
    priority_level: Optional[str]
    status: str
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
