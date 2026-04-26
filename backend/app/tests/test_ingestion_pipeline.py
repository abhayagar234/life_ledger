from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.ingestion.pipeline import process_import_file
from app.models.user import User


def test_csv_ingestion_pipeline_creates_import_summary() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    fixture_path = Path(__file__).parent / "fixtures" / "ingestion" / "sample_bank_statement.csv"
    content = fixture_path.read_bytes()

    with testing_session_local() as db:
        user = User(display_name="Import Test User")
        db.add(user)
        db.commit()
        db.refresh(user)

        result = process_import_file(
            db,
            user_id=user.id,
            file_name="sample_bank_statement.csv",
            file_type="csv",
            content=content,
        )

        assert result.total_rows == 4
        assert result.imported_rows >= 1
        assert result.error_rows == 0
