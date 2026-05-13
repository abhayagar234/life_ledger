from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlalchemy import inspect, text

from app.api.router import api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine


def _ensure_financial_profile_columns() -> None:
    inspector = inspect(engine)
    if "financial_profiles" not in inspector.get_table_names():
        return
    existing_columns = {column["name"] for column in inspector.get_columns("financial_profiles")}
    with engine.begin() as connection:
        if "next_income_in_days" not in existing_columns:
            connection.execute(text("ALTER TABLE financial_profiles ADD COLUMN next_income_in_days INTEGER"))
        if "bank_balance_confirmed" not in existing_columns:
            connection.execute(text("ALTER TABLE financial_profiles ADD COLUMN bank_balance_confirmed NUMERIC"))
        if "bank_balance_source" not in existing_columns:
            connection.execute(text("ALTER TABLE financial_profiles ADD COLUMN bank_balance_source VARCHAR(20)"))
        if "bank_balance_last_confirmed_at" not in existing_columns:
            connection.execute(text("ALTER TABLE financial_profiles ADD COLUMN bank_balance_last_confirmed_at TIMESTAMP"))
        if "money_mix_type" not in existing_columns:
            connection.execute(text("ALTER TABLE financial_profiles ADD COLUMN money_mix_type VARCHAR(20) DEFAULT 'home'"))
        if "receives_salary_besides_business" not in existing_columns:
            connection.execute(text("ALTER TABLE financial_profiles ADD COLUMN receives_salary_besides_business BOOLEAN DEFAULT FALSE"))
        if "business_reserve_amount" not in existing_columns:
            connection.execute(text("ALTER TABLE financial_profiles ADD COLUMN business_reserve_amount NUMERIC"))
        if "daily_needs_override" not in existing_columns:
            connection.execute(text("ALTER TABLE financial_profiles ADD COLUMN daily_needs_override NUMERIC"))
        ledger_columns = {column["name"] for column in inspector.get_columns("ledger_entries")} if "ledger_entries" in inspector.get_table_names() else set()
        if "ledger_entries" in inspector.get_table_names() and "money_scope" not in ledger_columns:
            connection.execute(text("ALTER TABLE ledger_entries ADD COLUMN money_scope VARCHAR(20)"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_financial_profile_columns()
    yield


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
app.include_router(api_router)


@app.get("/")
def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "ok",
    }
