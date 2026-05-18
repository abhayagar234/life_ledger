from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.ingestion.pipeline import compute_file_hash, create_processing_import_record, process_import_file, process_import_file_record
from app.models.normalized_transaction import NormalizedTransaction
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


def test_async_import_record_processes_against_same_upload_id() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    fixture_path = Path(__file__).parent / "fixtures" / "ingestion" / "sample_bank_statement.csv"
    content = fixture_path.read_bytes()

    with testing_session_local() as db:
        user = User(display_name="Async Import Test User")
        db.add(user)
        db.commit()
        db.refresh(user)

        import_file = create_processing_import_record(
            db,
            user_id=user.id,
            file_name="sample_bank_statement.csv",
            file_type="csv",
            file_hash=compute_file_hash(content),
            source_hint="bank",
        )

        result = process_import_file_record(
            db,
            import_file_id=import_file.id,
            content=content,
            source_hint="bank",
        )

        assert result.upload_id == import_file.id
        assert result.status == "processed"
        assert result.imported_rows >= 1


def test_card_statement_positive_amounts_are_expenses() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    fixture_path = Path(__file__).parent / "fixtures" / "ingestion" / "sample_card_statement.csv"
    content = fixture_path.read_bytes()

    with testing_session_local() as db:
        user = User(display_name="Card Import Test User")
        db.add(user)
        db.commit()
        db.refresh(user)

        result = process_import_file(
            db,
            user_id=user.id,
            file_name="sample_card_statement.csv",
            file_type="csv",
            content=content,
            source_hint="card",
        )

        rows = (
            db.query(NormalizedTransaction)
            .filter(NormalizedTransaction.import_file_id == result.upload_id)
            .all()
        )
        assert rows
        assert {row.direction for row in rows} == {"debit"}
