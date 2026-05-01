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
