from datetime import date

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.base import Base
from app.models.emi_payment import EMIPayment
from app.models.financial_profile import FinancialProfile
from app.models.ledger_entry import LedgerEntry
from app.models.loan import Loan
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


def test_manual_due_shows_in_protected_list_and_turns_paid() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        user = User(display_name="Due List User")
        db.add(user)
        db.commit()
        db.refresh(user)

        seed_demo_financial_data(db, user.id)

        loan = Loan(
            user_id=user.id,
            loan_type="informal_due",
            counterparty_name="School Fees",
            principal_amount=3500,
            interest_type="none",
            start_date=date.today(),
            due_date=date.today(),
            outstanding_principal=3500,
            notes="term payment",
            is_business=False,
        )
        db.add(loan)
        db.flush()

        emi_payment = EMIPayment(
            user_id=user.id,
            loan_id=loan.id,
            due_date=date.today(),
            amount_due=3500,
            amount_paid=0,
            status="pending",
            source_type="manual_due",
        )
        db.add(emi_payment)
        db.commit()
        db.refresh(emi_payment)

        before = build_cashflow_summary(db, user.id, as_of=date.today())
        due_item = next(item for item in before.protected_due_items if item.emi_payment_id == emi_payment.id)
        assert due_item.name == "School Fees"
        assert due_item.status == "pending"

        emi_payment.amount_paid = 3500
        emi_payment.status = "paid"
        emi_payment.paid_date = date.today()
        db.add(emi_payment)
        db.commit()

        after = build_cashflow_summary(db, user.id, as_of=date.today())
        paid_item = next(item for item in after.protected_due_items if item.emi_payment_id == emi_payment.id)
        assert paid_item.status == "paid"
        assert after.upcoming_dues_total == before.upcoming_dues_total - 3500


def test_manual_due_shows_partial_when_only_part_is_paid() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        user = User(display_name="Partial Due User")
        db.add(user)
        db.commit()
        db.refresh(user)

        loan = Loan(
            user_id=user.id,
            loan_type="informal_due",
            counterparty_name="Bike EMI",
            principal_amount=5000,
            interest_type="none",
            start_date=date.today(),
            due_date=date.today(),
            outstanding_principal=5000,
            notes="monthly bike emi",
            is_business=False,
        )
        db.add(loan)
        db.flush()

        emi_payment = EMIPayment(
            user_id=user.id,
            loan_id=loan.id,
            due_date=date.today(),
            amount_due=5000,
            amount_paid=2500,
            status="partial",
            source_type="manual_due",
        )
        db.add(emi_payment)
        db.commit()

        summary = build_cashflow_summary(db, user.id, as_of=date.today())
        due_item = next(item for item in summary.protected_due_items if item.emi_payment_id == emi_payment.id)

        assert due_item.status == "partial"
        assert due_item.amount_paid == 2500
        assert due_item.remaining_amount == 2500


def test_cash_set_replaces_old_cash_and_changes_safe_to_spend() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        user = User(display_name="Cash Reset User")
        db.add(user)
        db.commit()
        db.refresh(user)

        seed_demo_financial_data(db, user.id)
        before = build_cashflow_summary(db, user.id, as_of=date.today())

        db.add(
            LedgerEntry(
                user_id=user.id,
                entry_type="cash_adjustment",
                amount=1500,
                entry_date=date.today(),
                account_type="cash",
                cash_direction="set",
                description="manual cash reset",
                source_label="test",
            )
        )
        db.commit()

        after = build_cashflow_summary(db, user.id, as_of=date.today())

        assert after.cash_on_hand == 1500
        assert after.safe_to_spend != before.safe_to_spend


def test_sample_seed_surfaces_multiple_named_due_items() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        user = User(display_name="Seeded Sample User")
        db.add(user)
        db.commit()
        db.refresh(user)

        seed_demo_financial_data(db, user.id)
        summary = build_cashflow_summary(db, user.id, as_of=date.today())
        names = {item.name for item in summary.protected_due_items}

        assert "House Rent Ramesh" in names
        assert "Bike Emi Bajaj Finance" in names
        assert "Jio Recharge" in names
        assert "Netflix Subscription" in names
        assert "Hotstar Subscription" in names
        assert summary.upcoming_dues_total > 0


def test_sample_seed_does_not_double_count_fixed_dues_inside_daily_needs() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        user = User(display_name="Daily Needs Sample User")
        db.add(user)
        db.commit()
        db.refresh(user)

        seed_demo_financial_data(db, user.id)
        summary = build_cashflow_summary(db, user.id, as_of=date.today())

        assert summary.upcoming_dues_total > 10000
        assert summary.daily_needs_required < 5000
        assert summary.safe_to_spend > 0


def test_sample_seed_preserves_existing_start_cash_amount() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        user = User(display_name="Preserved Cash User")
        db.add(user)
        db.commit()
        db.refresh(user)

        profile = FinancialProfile(
            user_id=user.id,
            user_type="farmer_seasonal",
            income_pattern="seasonal",
            tracks_cash=True,
            tracks_loans=False,
            tracks_emi=False,
            tracking_scope="personal",
            currency_code="INR",
            start_cash_amount=5000,
            salary_day_of_month=None,
            business_mode_enabled=False,
        )
        db.add(profile)
        db.commit()

        seed_demo_financial_data(db, user.id)
        db.refresh(profile)
        summary = build_cashflow_summary(db, user.id, as_of=date.today())

        assert float(profile.start_cash_amount) == 5000
        assert summary.cash_on_hand == 5000


def test_custom_next_income_horizon_controls_safe_till_date() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        user = User(display_name="Custom Horizon User")
        db.add(user)
        db.commit()
        db.refresh(user)

        profile = FinancialProfile(
            user_id=user.id,
            user_type="business_self_employed",
            income_pattern="mixed",
            tracks_cash=True,
            tracks_loans=False,
            tracks_emi=False,
            tracking_scope="personal",
            currency_code="INR",
            start_cash_amount=300000,
            salary_day_of_month=None,
            next_income_in_days=180,
            business_mode_enabled=False,
        )
        db.add(profile)
        db.commit()

        summary = build_cashflow_summary(db, user.id, as_of=date.today())

        assert summary.next_income_date is not None
        assert (summary.next_income_date - date.today()).days == 180


def test_farmer_sample_excludes_ott_and_credit_card_due() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        user = User(display_name="Farmer Sample User")
        db.add(user)
        db.commit()
        db.refresh(user)

        profile = FinancialProfile(
            user_id=user.id,
            user_type="farmer_seasonal",
            income_pattern="seasonal",
            tracks_cash=True,
            tracks_loans=False,
            tracks_emi=True,
            tracking_scope="household",
            currency_code="INR",
            start_cash_amount=12000,
            salary_day_of_month=None,
            next_income_in_days=180,
            business_mode_enabled=False,
        )
        db.add(profile)
        db.commit()

        seed_demo_financial_data(db, user.id)
        summary = build_cashflow_summary(db, user.id, as_of=date.today())
        names = {item.name for item in summary.protected_due_items}

        assert "Tractor Emi Cooperative Bank" in names
        assert "Netflix Subscription" not in names
        assert "Hotstar Subscription" not in names
        assert "Hdfc Credit Card Due" not in names


def test_daily_wage_sample_is_tighter_and_has_no_streaming_subscriptions() -> None:
    engine = create_engine("sqlite+pysqlite:///:memory:", future=True)
    testing_session_local = sessionmaker(bind=engine, class_=Session, autoflush=False, autocommit=False, future=True)
    Base.metadata.create_all(bind=engine)

    with testing_session_local() as db:
        user = User(display_name="Daily Wage Sample User")
        db.add(user)
        db.commit()
        db.refresh(user)

        profile = FinancialProfile(
            user_id=user.id,
            user_type="daily_wage",
            income_pattern="daily",
            tracks_cash=True,
            tracks_loans=False,
            tracks_emi=True,
            tracking_scope="personal",
            currency_code="INR",
            start_cash_amount=500,
            salary_day_of_month=None,
            next_income_in_days=7,
            business_mode_enabled=False,
        )
        db.add(profile)
        db.commit()

        seed_demo_financial_data(db, user.id)
        summary = build_cashflow_summary(db, user.id, as_of=date.today())
        names = {item.name for item in summary.protected_due_items}

        assert "Room Rent Santosh" in names
        assert "Netflix Subscription" not in names
        assert "Hotstar Subscription" not in names
        assert summary.safe_to_spend < 3000
