from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine_kwargs = {"future": True, "connect_args": connect_args}

if not settings.database_url.startswith("sqlite"):
    # Hosted Postgres providers can drop idle connections; pre-ping avoids serving stale pooled connections.
    engine_kwargs.update(
        {
            "pool_pre_ping": True,
            "pool_recycle": 300,
        }
    )

engine = create_engine(settings.database_url, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, class_=Session, future=True)
