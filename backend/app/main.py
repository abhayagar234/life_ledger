from contextlib import asynccontextmanager
import logging
import time

from fastapi import FastAPI, Request, Response
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
        if "loans" in inspector.get_table_names():
            loan_columns = {column["name"] for column in inspector.get_columns("loans")}
            if "confirmed" not in loan_columns:
                connection.execute(text("ALTER TABLE loans ADD COLUMN confirmed BOOLEAN DEFAULT TRUE"))
                connection.execute(text("UPDATE loans SET confirmed = TRUE WHERE confirmed IS NULL"))


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.database_url.startswith("sqlite"):
        Base.metadata.create_all(bind=engine)
        _ensure_financial_profile_columns()
    yield


app = FastAPI(title=settings.app_name, version=settings.app_version, lifespan=lifespan)
app.include_router(api_router)


@app.middleware("http")
async def log_request_timing(request: Request, call_next):
    started_at = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - started_at) * 1000, 2)

    path_params = getattr(request, "path_params", {}) or {}
    extras = []
    user_id = request.query_params.get("user_id")
    upload_id = path_params.get("upload_id")
    upload_ids = request.query_params.get("upload_ids")
    upload_count = getattr(request.state, "upload_count", None)
    txn_count = getattr(request.state, "transaction_count", None)
    recurring = getattr(request.state, "recurring_detection_ran", None)

    if user_id:
        extras.append(f"user_id={user_id}")
    if upload_id:
        extras.append(f"upload_id={upload_id}")
    if upload_ids:
        extras.append(f"upload_ids={upload_ids}")
    if upload_count is not None:
        extras.append(f"uploads={upload_count}")
    if txn_count is not None:
        extras.append(f"txns={txn_count}")
    if recurring is not None:
        extras.append(f"recurring={str(bool(recurring)).lower()}")

    suffix = f", {', '.join(extras)}" if extras else ""
    logger = getattr(request.app.state, "logger", None)
    message = f"{request.method} {request.url.path} took {duration_ms}ms{suffix}"
    if logger:
        logger.info(message)
    else:
        logging.getLogger("app.request_timing").info(message)
    return response


@app.get("/")
def root():
    return {
        "status": "ok",
    }


@app.head("/")
def root_head():
    return Response(status_code=200)


@app.get("/health")
def health():
    return {"status": "ok"}
