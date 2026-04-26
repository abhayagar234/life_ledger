from __future__ import annotations

from datetime import date
from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.emi_payment import EMIPayment
from app.models.financial_profile import FinancialProfile
from app.models.import_file import ImportFile
from app.models.import_row import ImportRow
from app.models.ledger_entry import LedgerEntry
from app.models.loan import Loan
from app.models.monthly_summary import MonthlySummary
from app.models.normalized_transaction import NormalizedTransaction


def _month_offset(base: date, delta: int) -> date:
    month = base.month + delta
    year = base.year
    while month <= 0:
        month += 12
        year -= 1
    while month > 12:
        month -= 12
        year += 1
    day = min(base.day, 28)
    return date(year, month, day)


def _create_txn(
    *,
    user_id: str,
    import_file_id: str,
    row_number: int,
    source_name: str,
    source_type: str,
    txn_date: date,
    amount: float,
    direction: str,
    description: str,
    category_code: str,
    is_fixed_obligation: bool = False,
    is_recurring: bool = False,
) -> tuple[ImportRow, NormalizedTransaction]:
    import_row = ImportRow(
        user_id=user_id,
        import_file_id=import_file_id,
        row_number=row_number,
        raw_data={"date": txn_date.isoformat(), "description": description, "amount": amount, "direction": direction},
        raw_description=description,
        raw_amount=str(amount),
        raw_date=txn_date.isoformat(),
        parse_status="parsed",
    )
    normalized = NormalizedTransaction(
        user_id=user_id,
        import_file_id=import_file_id,
        import_row_id=import_row.id,
        source_name=source_name,
        source_type=source_type,
        transaction_date=txn_date,
        posted_date=txn_date,
        amount=amount,
        direction=direction,
        description_raw=description,
        description_clean=description.lower(),
        counterparty_name=description.lower(),
        category_code=category_code,
        subcategory_code=None,
        is_recurring=is_recurring,
        is_fixed_obligation=is_fixed_obligation,
        confidence_score=0.9,
        dedupe_fingerprint=str(uuid4()),
        dedupe_status="unique",
        review_status="accepted",
    )
    return import_row, normalized


def seed_demo_financial_data(db: Session, user_id: str) -> None:
    has_rows = db.query(NormalizedTransaction).filter(NormalizedTransaction.user_id == user_id).first()
    if has_rows is not None:
        return

    profile = db.query(FinancialProfile).filter(FinancialProfile.user_id == user_id).first()
    if profile is None:
        profile = FinancialProfile(
            user_id=user_id,
            user_type="salaried",
            income_pattern="monthly",
            tracks_cash=True,
            tracks_loans=False,
            tracks_emi=True,
            tracking_scope="household",
            currency_code="INR",
            start_cash_amount=1800,
            salary_day_of_month=1,
            business_mode_enabled=False,
        )
        db.add(profile)

    today = date.today()
    months = [_month_offset(today.replace(day=1), offset) for offset in (-2, -1, 0)]
    source_name = "demo_hdfc_bank"
    source_type = "bank"

    row_counter = 1
    for month_start in months:
        import_file = ImportFile(
            user_id=user_id,
            file_name=f"demo_{month_start.year}_{month_start.month:02d}.csv",
            file_type="csv",
            source_name=source_name,
            source_type=source_type,
            file_hash=str(uuid4()),
            status="processed",
            total_rows=0,
            imported_rows=0,
            duplicate_rows=0,
            error_rows=0,
        )
        db.add(import_file)
        db.flush()

        transactions = [
            (date(month_start.year, month_start.month, 1), 18000.0, "credit", "salary acme tools", "salary_income", False, True),
            (date(month_start.year, month_start.month, 2), 5500.0, "debit", "house rent ramesh", "rent", True, True),
            (date(month_start.year, month_start.month, 5), 1850.0, "debit", "grocery market", "groceries", False, False),
            (date(month_start.year, month_start.month, 8), 1200.0, "debit", "electricity board", "bills", True, True),
            (date(month_start.year, month_start.month, 12), 2400.0, "debit", "bajaj finance emi", "emi_loans", True, True),
            (date(month_start.year, month_start.month, 16), 900.0, "debit", "medical store", "health", False, False),
            (date(month_start.year, month_start.month, 18), 2500.0, "credit", "weekend tailoring", "business_income", False, False),
            (date(month_start.year, month_start.month, 20), 650.0, "debit", "upi self transfer", "transfers", False, False),
            (date(month_start.year, month_start.month, 25), 349.0, "debit", "jio recharge", "bills", True, True),
            (date(month_start.year, month_start.month, 27), 649.0, "debit", "netflix subscription", "subscriptions", True, True),
            (date(month_start.year, month_start.month, 28), 1500.0, "debit", "hdfc credit card due", "credit_card_payment", True, True),
        ]

        for txn_date, amount, direction, description, category, fixed_due, recurring in transactions:
            if month_start.year == today.year and month_start.month == today.month and txn_date > today:
                continue
            import_row, normalized = _create_txn(
                user_id=user_id,
                import_file_id=import_file.id,
                row_number=row_counter,
                source_name=source_name,
                source_type=source_type,
                txn_date=txn_date,
                amount=amount,
                direction=direction,
                description=description,
                category_code=category,
                is_fixed_obligation=fixed_due,
                is_recurring=recurring,
            )
            db.add(import_row)
            db.flush()
            normalized.import_row_id = import_row.id
            db.add(normalized)
            row_counter += 1
            import_file.total_rows += 1
            import_file.imported_rows += 1

    db.commit()


def reset_demo_financial_data(db: Session, user_id: str) -> None:
    db.query(MonthlySummary).filter(MonthlySummary.user_id == user_id).delete(synchronize_session=False)
    db.query(EMIPayment).filter(EMIPayment.user_id == user_id).delete(synchronize_session=False)
    db.query(Loan).filter(Loan.user_id == user_id).delete(synchronize_session=False)
    db.query(LedgerEntry).filter(LedgerEntry.user_id == user_id).delete(synchronize_session=False)
    db.query(NormalizedTransaction).filter(NormalizedTransaction.user_id == user_id).delete(synchronize_session=False)
    db.query(ImportRow).filter(ImportRow.user_id == user_id).delete(synchronize_session=False)
    db.query(ImportFile).filter(ImportFile.user_id == user_id).delete(synchronize_session=False)
    db.commit()
    seed_demo_financial_data(db, user_id)
