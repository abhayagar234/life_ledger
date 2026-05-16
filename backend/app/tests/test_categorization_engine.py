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


def test_categorization_engine_maps_upi_hospital_to_health() -> None:
    db = _make_db()
    user = User(display_name="Category Test User 3")
    db.add(user)
    db.commit()
    db.refresh(user)

    result = categorize_transaction(
        db,
        payload=CategorizationInput(
            user_id=user.id,
            description_raw="UPI/Manipal Ho/63280127563.pa/UPI/INDUSIND B/607146936191/AXI...",
            description_clean="upi manipal ho upi indusind b axi",
            counterparty="manipal ho",
            direction="debit",
            amount=1400.00,
            source_type="bank",
            source_name="sbi_bank_like",
        ),
        transaction_date=date(2026, 3, 12),
    )

    assert result.category == "health"
    assert result.confidence_score >= 0.8


def test_categorization_engine_maps_google_play_to_subscriptions() -> None:
    db = _make_db()
    user = User(display_name="Category Test User 4")
    db.add(user)
    db.commit()
    db.refresh(user)

    result = categorize_transaction(
        db,
        payload=CategorizationInput(
            user_id=user.id,
            description_raw="GOOGLE PLAY APP PURCHA MUMBAI IN",
            description_clean="google play app purcha mumbai in",
            counterparty="google play app purcha",
            direction="debit",
            amount=199.00,
            source_type="card",
            source_name="generic_card_like",
        ),
        transaction_date=date(2026, 3, 11),
    )

    assert result.category == "subscriptions"
    assert result.confidence_score >= 0.8
