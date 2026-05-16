from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.models.import_file import ImportFile
from app.models.import_row import ImportRow
from app.models.normalized_transaction import NormalizedTransaction
from app.models.user import User
from app.services.due_extractor import extract_detected_dues


def _make_db() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)
    return testing_session_local()


def _seed_txn(
    db: Session,
    *,
    user_id: str,
    import_file_id: str,
    row_number: int,
    txn_date: date,
    amount: float,
    description: str,
    counterparty: str,
    category_code: str,
) -> None:
    import_row = ImportRow(
        import_file_id=import_file_id,
        user_id=user_id,
        row_number=row_number,
        raw_data={"description": description, "amount": amount, "date": txn_date.isoformat()},
        raw_description=description,
        raw_amount=str(amount),
        raw_date=txn_date.isoformat(),
        parse_status="parsed",
        parse_errors=[],
    )
    db.add(import_row)
    db.flush()

    txn = NormalizedTransaction(
        user_id=user_id,
        import_file_id=import_file_id,
        import_row_id=import_row.id,
        source_name="sbi_bank_like",
        source_type="bank",
        transaction_date=txn_date,
        posted_date=None,
        amount=amount,
        currency_code="INR",
        direction="debit",
        description_raw=description,
        description_clean=description.lower(),
        counterparty_name=counterparty,
        category_code=category_code,
        subcategory_code=None,
        is_recurring=False,
        is_fixed_obligation=False,
        confidence_score=0.9,
        dedupe_fingerprint=f"fp-{row_number}",
        dedupe_status="unique",
        review_status="accepted",
    )
    db.add(txn)


def test_due_extractor_detects_recurring_sip() -> None:
    db = _make_db()
    user = User(display_name="Due Extractor Test User")
    db.add(user)
    db.commit()
    db.refresh(user)

    import_file = ImportFile(
        user_id=user.id,
        file_name="sample_bank_statement.csv",
        file_type="csv",
        source_name="sbi_bank_like",
        source_type="bank",
        file_hash="sip-hash-1",
        status="processed",
        total_rows=3,
        imported_rows=3,
        duplicate_rows=0,
        error_rows=0,
    )
    db.add(import_file)
    db.flush()

    _seed_txn(
        db,
        user_id=user.id,
        import_file_id=import_file.id,
        row_number=1,
        txn_date=date(2026, 2, 28),
        amount=1000.0,
        description="BIL/BPAY/001179922382/HDFC MUTUA/HDCAMSIP-B97649 HDFC MUTUAL FUN",
        counterparty="hdfc mutua",
        category_code="savings_investments",
    )
    _seed_txn(
        db,
        user_id=user.id,
        import_file_id=import_file.id,
        row_number=2,
        txn_date=date(2026, 3, 28),
        amount=1000.0,
        description="BIL/BPAY/001179922382/HDFC MUTUA/HDCAMSIP-B97649 HDFC MUTUAL FUN",
        counterparty="hdfc mutua",
        category_code="savings_investments",
    )
    _seed_txn(
        db,
        user_id=user.id,
        import_file_id=import_file.id,
        row_number=3,
        txn_date=date(2026, 4, 28),
        amount=1000.0,
        description="BIL/BPAY/001179922382/HDFC MUTUA/HDCAMSIP-B97649 HDFC MUTUAL FUN",
        counterparty="hdfc mutua",
        category_code="savings_investments",
    )
    db.commit()

    detected = extract_detected_dues(db, user_id=user.id, upload_id=import_file.id)
    assert any(d.counterparty_name.lower().startswith("hdfc") and d.frequency == "monthly" for d in detected)
    assert any(abs(d.amount - 1000.0) < 0.01 for d in detected)
