from calendar import monthrange
from collections import defaultdict
from datetime import date

from sqlalchemy.orm import Session

from app.models.financial_profile import FinancialProfile
from app.models.goal import Goal
from app.models.normalized_transaction import NormalizedTransaction
from app.schemas.insights import CategorySpendItem, InsightCard, SpendingInsightsResponse


ESSENTIAL_CATEGORIES = {"groceries", "health", "travel", "bills", "rent", "emi_loans", "farming_expense"}
FLEXIBLE_CATEGORIES = {"shopping", "entertainment", "subscriptions"}
NON_SPEND_CATEGORIES = {"transfers"}
SAVINGS_CATEGORIES = {"savings_investments"}


def _get_profile(db: Session, user_id: str) -> FinancialProfile | None:
    return db.query(FinancialProfile).filter(FinancialProfile.user_id == user_id).first()


def _determine_planning_mode(profile: FinancialProfile | None) -> str:
    if profile is None:
        return "general"
    if profile.user_type == "salaried":
        return "salaried"
    if profile.user_type in {"daily_wage", "farmer_seasonal"}:
        return "irregular_income"
    if profile.user_type == "business_self_employed" or profile.business_mode_enabled:
        return "business_self_employed"
    return "general"


def _build_income_total(db: Session, *, user_id: str, period_start: date, period_end: date) -> float:
    rows = (
        db.query(NormalizedTransaction)
        .filter(
            NormalizedTransaction.user_id == user_id,
            NormalizedTransaction.transaction_date >= period_start,
            NormalizedTransaction.transaction_date <= period_end,
            NormalizedTransaction.direction == "credit",
            NormalizedTransaction.dedupe_status != "duplicate",
            NormalizedTransaction.category_code == "salary_income",
        )
        .all()
    )
    return round(sum(float(row.amount) for row in rows), 2)


def _build_goal_gap_total(db: Session, *, user_id: str) -> float | None:
    goals = db.query(Goal).filter(Goal.user_id == user_id, Goal.status == "active").all()
    if not goals:
        return None
    total_gap = 0.0
    for goal in goals:
        total_gap += max(float(goal.target_amount) - float(goal.current_amount), 0.0)
    return round(total_gap, 2)


def build_spending_insights(db: Session, *, user_id: str, year: int, month: int) -> SpendingInsightsResponse:
    period_start = date(year, month, 1)
    period_end = date(year, month, monthrange(year, month)[1])
    profile = _get_profile(db, user_id)
    planning_mode = _determine_planning_mode(profile)

    rows = (
        db.query(NormalizedTransaction)
        .filter(
            NormalizedTransaction.user_id == user_id,
            NormalizedTransaction.transaction_date >= period_start,
            NormalizedTransaction.transaction_date <= period_end,
            NormalizedTransaction.direction == "debit",
            NormalizedTransaction.dedupe_status != "duplicate",
        )
        .all()
    )

    category_totals: dict[str, float] = defaultdict(float)
    transfer_total = 0.0
    savings_allocations_total = 0.0
    fixed_obligations_total = 0.0
    for row in rows:
        amount = float(row.amount)
        category = row.category_code or "uncategorized"
        if category in NON_SPEND_CATEGORIES:
            transfer_total += amount
            continue
        if category in SAVINGS_CATEGORIES:
            savings_allocations_total += amount
            continue
        category_totals[category] += amount
        if row.is_fixed_obligation:
            fixed_obligations_total += amount

    monthly_income = _build_income_total(db, user_id=user_id, period_start=period_start, period_end=period_end)
    total_spend = sum(category_totals.values())
    essential_spend_total = sum(amount for category, amount in category_totals.items() if category in ESSENTIAL_CATEGORIES)
    flexible_spend_total = sum(amount for category, amount in category_totals.items() if category in FLEXIBLE_CATEGORIES)
    emi_loans_total = category_totals.get("emi_loans", 0.0)
    emi_burden_ratio = round(emi_loans_total / monthly_income, 2) if monthly_income > 0 else None
    savings_rate = round((monthly_income - total_spend) / monthly_income, 2) if monthly_income > 0 else None
    goal_gap_total = _build_goal_gap_total(db, user_id=user_id)

    if planning_mode == "salaried":
        essential_buffer = round((essential_spend_total / 30) * 10, 2) if essential_spend_total > 0 else 0.0
        planned_savings_buffer = round(monthly_income * 0.10, 2) if monthly_income > 0 else 0.0
        safe_to_spend = max(monthly_income - total_spend - essential_buffer - planned_savings_buffer, 0.0)
        runway_days = None
    elif planning_mode == "irregular_income":
        daily_survival_spend = (essential_spend_total + fixed_obligations_total) / 30 if (essential_spend_total + fixed_obligations_total) > 0 else 0
        liquid_balance = max(monthly_income - total_spend - savings_allocations_total, 0.0)
        runway_days = round(liquid_balance / daily_survival_spend, 1) if daily_survival_spend > 0 else None
        survival_buffer = round(daily_survival_spend * 5, 2) if daily_survival_spend > 0 else 0.0
        safe_to_spend = max(liquid_balance - survival_buffer, 0.0)
    elif planning_mode == "business_self_employed":
        business_reserve = round(essential_spend_total * 0.25, 2) if essential_spend_total > 0 else 0.0
        safe_to_spend = max(monthly_income - total_spend - fixed_obligations_total - business_reserve, 0.0)
        runway_days = None
    else:
        safe_to_spend = max(monthly_income - total_spend - fixed_obligations_total, 0.0)
        runway_days = None

    top_categories = sorted(category_totals.items(), key=lambda item: item[1], reverse=True)[:5]
    top_category_items = [
        CategorySpendItem(
            category=category,
            amount=round(amount, 2),
            percentage=round((amount / total_spend) * 100, 2) if total_spend else 0.0,
        )
        for category, amount in top_categories
    ]

    guidance: list[str] = []
    if total_spend == 0 and monthly_income == 0:
        guidance.append("Add imported or manual expense entries to see spending guidance.")
    else:
        if fixed_obligations_total > 0:
            guidance.append(
                f"Fixed obligations are {round((fixed_obligations_total / total_spend) * 100, 1)}% of tracked spending this month."
            )
        if emi_burden_ratio is not None and emi_burden_ratio >= 0.35:
            guidance.append("EMI pressure is high. Reduce flexible spending first and protect essentials.")
        if savings_allocations_total > 0:
            guidance.append(f"You moved {round(savings_allocations_total, 2)} into savings or investments this month.")
        if flexible_spend_total > essential_spend_total and flexible_spend_total > 0:
            guidance.append("Flexible spending is higher than essentials. Shopping and entertainment are the first places to trim.")
        elif flexible_spend_total > 0:
            guidance.append("Flexible spending is visible and manageable. Keep an eye on shopping and subscriptions.")
        if planning_mode == "irregular_income" and runway_days is not None:
            guidance.append(f"At this pace, your current money may last about {runway_days} days.")
        if planning_mode == "salaried" and safe_to_spend > 0:
            guidance.append(f"You can spend about {round(safe_to_spend, -2) if safe_to_spend >= 100 else round(safe_to_spend, 2)} safely before the next income cycle.")
        if top_category_items:
            guidance.append(f"The biggest spending bucket this month is {top_category_items[0].category}.")

    return SpendingInsightsResponse(
        period_start=period_start,
        period_end=period_end,
        planning_mode=planning_mode,
        monthly_income=round(monthly_income, 2),
        total_spend=round(total_spend, 2),
        transfer_total=round(transfer_total, 2),
        savings_allocations_total=round(savings_allocations_total, 2),
        fixed_obligations_total=round(fixed_obligations_total, 2),
        essential_spend_total=round(essential_spend_total, 2),
        flexible_spend_total=round(flexible_spend_total, 2),
        emi_burden_ratio=emi_burden_ratio,
        savings_rate=savings_rate,
        safe_to_spend=round(safe_to_spend, 2),
        runway_days=runway_days,
        goal_gap_total=goal_gap_total,
        top_categories=top_category_items,
        guidance=guidance,
    )


def build_insight_cards_from_summary(summary: SpendingInsightsResponse) -> list[InsightCard]:
    if summary.total_spend == 0:
        return [
            InsightCard(
                title="Start tracking spending",
                message="Import a statement or add expenses manually to unlock category insights.",
                period_start=summary.period_start,
                period_end=summary.period_end,
            )
        ]

    cards = [
        InsightCard(
            title="Monthly spending snapshot",
            message=f"You tracked {summary.total_spend:.2f} in spending for this period.",
            period_start=summary.period_start,
            period_end=summary.period_end,
        )
    ]
    if summary.top_categories:
        cards.append(
            InsightCard(
                title="Top category",
                message=f"{summary.top_categories[0].category} is the biggest spending bucket right now.",
                period_start=summary.period_start,
                period_end=summary.period_end,
            )
        )
    if summary.guidance:
        cards.append(
            InsightCard(
                title="Budget tip",
                message=summary.guidance[0],
                period_start=summary.period_start,
                period_end=summary.period_end,
            )
        )
    return cards
