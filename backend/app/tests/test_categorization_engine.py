from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.categorization.engine import categorize_transaction
from app.categorization.types import CategorizationInput
from app.db.base import Base
from app.models.user import User


def _make_db() -> Session:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)
    return testing_session_local()


def test_categorization_engine_matches_known_merchant() -> None:
    db = _make_db()
    user = User(display_name="Category Test User")
    db.add(user)
    db.commit()
    db.refresh(user)

    result = categorize_transaction(
        db,
        payload=CategorizationInput(
            user_id=user.id,
            description_raw="UPI/DR/12345/BIGBASKET",
            description_clean="upi dr bigbasket",
            counterparty="bigbasket",
            direction="debit",
            amount=845.50,
            source_type="bank",
            source_name="hdfc_bank_like",
        ),
        transaction_date=date(2026, 4, 2),
    )

    assert result.category == "groceries"
    assert result.confidence_score >= 0.90


def test_categorization_engine_marks_emi_as_fixed_obligation() -> None:
    db = _make_db()
    user = User(display_name="Category Test User 2")
    db.add(user)
    db.commit()
    db.refresh(user)

    result = categorize_transaction(
        db,
        payload=CategorizationInput(
            user_id=user.id,
            description_raw="BAJAJ FINANCE EMI",
            description_clean="bajaj finance emi",
            counterparty="bajaj finance",
            direction="debit",
            amount=2500.00,
            source_type="bank",
            source_name="generic_bank_like",
        ),
        transaction_date=date(2026, 4, 5),
    )

    assert result.category == "emi_loans"
    assert result.is_fixed_obligation is True
