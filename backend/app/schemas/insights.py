from datetime import date

from pydantic import BaseModel


class CategorySpendItem(BaseModel):
    category: str
    amount: float
    percentage: float


class SpendingInsightsResponse(BaseModel):
    period_start: date
    period_end: date
    planning_mode: str
    monthly_income: float
    total_spend: float
    transfer_total: float
    savings_allocations_total: float
    fixed_obligations_total: float
    essential_spend_total: float
    flexible_spend_total: float
    emi_burden_ratio: float | None
    savings_rate: float | None
    safe_to_spend: float
    runway_days: float | None
    goal_gap_total: float | None
    top_categories: list[CategorySpendItem]
    guidance: list[str]


class InsightCard(BaseModel):
    title: str
    message: str
    period_start: date
    period_end: date


class CoachMessageRequest(BaseModel):
    message: str


class CoachMessageResponse(BaseModel):
    reply: str
    tone: str = "simple"
