from fastapi import APIRouter

from app.api.routes import (
    auth,
    budgets,
    cashflow,
    coach,
    demo,
    emi_payments,
    goals,
    imports,
    insights,
    ledger,
    loans,
    monthly_summaries,
    profile,
    upcoming_dues,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(upcoming_dues.router)
api_router.include_router(ledger.router)
api_router.include_router(loans.router)
api_router.include_router(emi_payments.router)
api_router.include_router(budgets.router)
api_router.include_router(goals.router)
api_router.include_router(imports.router)
api_router.include_router(insights.router)
api_router.include_router(cashflow.router)
api_router.include_router(demo.router)
api_router.include_router(coach.router)
api_router.include_router(monthly_summaries.router)
