from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.models.ledger_entry import LedgerEntry
from app.models.user import User
from app.services.cashflow import build_cashflow_summary
from app.services.demo_data import seed_demo_financial_data


def test_cashflow_summary_returns_demo_ready_answer() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        user = User(display_name="Cashflow Test User")
        db.add(user)
        db.commit()
        db.refresh(user)

        seed_demo_financial_data(db, user.id)
        summary = build_cashflow_summary(db, user.id, as_of=date.today())

        assert summary.headline
        assert summary.next_income_date is not None
        assert summary.effective_available_money >= 0
        assert summary.confidence in {"high", "medium", "low"}
        assert len(summary.explanations) >= 2


def test_negative_cash_only_covers_part_of_daily_needs() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        user = User(display_name="Negative Cash User")
        db.add(user)
        db.commit()
        db.refresh(user)

        seed_demo_financial_data(db, user.id)
        db.add(
            LedgerEntry(
                user_id=user.id,
                entry_type="expense",
                amount=6800,
                entry_date=date.today(),
                account_type="cash",
                cash_direction="out",
                description="manual cash overspend",
                source_label="test",
            )
        )
        db.commit()

        summary = build_cashflow_summary(db, user.id, as_of=date.today())

        assert summary.cash_on_hand < 0
        assert summary.daily_needs_required >= summary.daily_needs_buffer
        assert summary.safe_to_spend == 0


def test_manual_bank_spend_reduces_bank_money_seen_in_cycle() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        user = User(display_name="Manual Bank Spend User")
        db.add(user)
        db.commit()
        db.refresh(user)

        seed_demo_financial_data(db, user.id)
        before = build_cashflow_summary(db, user.id, as_of=date.today())

        db.add(
            LedgerEntry(
                user_id=user.id,
                entry_type="expense",
                amount=800,
                entry_date=date.today(),
                account_type="bank",
                cash_direction="out",
                description="manual bank spend",
                source_label="test",
            )
        )
        db.commit()

        after = build_cashflow_summary(db, user.id, as_of=date.today())

        assert after.liquid_balance == before.liquid_balance - 800


def test_manual_credit_card_spend_increases_upcoming_dues() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        user = User(display_name="Manual Card Spend User")
        db.add(user)
        db.commit()
        db.refresh(user)

        seed_demo_financial_data(db, user.id)
        before = build_cashflow_summary(db, user.id, as_of=date.today())

        db.add(
            LedgerEntry(
                user_id=user.id,
                entry_type="expense",
                amount=1200,
                entry_date=date.today(),
                account_type="card",
                cash_direction="out",
                description="manual card spend",
                source_label="test",
            )
        )
        db.commit()

        after = build_cashflow_summary(db, user.id, as_of=date.today())

        assert after.upcoming_dues_total == before.upcoming_dues_total + 1200
