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

DemoTxn = tuple[date, float, str, str, str, bool, bool]


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


def _salaried_transactions(month_start: date) -> list[DemoTxn]:
    return [
        (date(month_start.year, month_start.month, 1), 18000.0, "credit", "salary acme tools", "salary_income", False, True),
        (date(month_start.year, month_start.month, 2), 5500.0, "debit", "house rent ramesh", "rent", True, True),
        (date(month_start.year, month_start.month, 5), 1850.0, "debit", "grocery market", "groceries", False, False),
        (date(month_start.year, month_start.month, 7), 2500.0, "debit", "school fees vidya mandir", "education", True, True),
        (date(month_start.year, month_start.month, 8), 1200.0, "debit", "electricity board", "bills", True, True),
        (date(month_start.year, month_start.month, 12), 2400.0, "debit", "bike emi bajaj finance", "emi_loans", True, True),
        (date(month_start.year, month_start.month, 16), 900.0, "debit", "medical store", "health", False, False),
        (date(month_start.year, month_start.month, 18), 2500.0, "credit", "weekend tailoring", "business_income", False, False),
        (date(month_start.year, month_start.month, 20), 650.0, "debit", "upi self transfer", "transfers", False, False),
        (date(month_start.year, month_start.month, 25), 349.0, "debit", "jio recharge", "bills", True, True),
        (date(month_start.year, month_start.month, 26), 299.0, "debit", "hotstar subscription", "subscriptions", True, True),
        (date(month_start.year, month_start.month, 27), 649.0, "debit", "netflix subscription", "subscriptions", True, True),
        (date(month_start.year, month_start.month, 28), 1500.0, "debit", "hdfc credit card due", "credit_card_payment", True, True),
    ]


def _daily_wage_transactions(month_start: date) -> list[DemoTxn]:
    return [
        (date(month_start.year, month_start.month, 1), 950.0, "credit", "mason work payment", "business_income", False, False),
        (date(month_start.year, month_start.month, 3), 780.0, "credit", "helper wages", "business_income", False, False),
        (date(month_start.year, month_start.month, 4), 420.0, "debit", "grocery kirana", "groceries", False, False),
        (date(month_start.year, month_start.month, 6), 1100.0, "credit", "driver shift payment", "business_income", False, False),
        (date(month_start.year, month_start.month, 7), 1800.0, "debit", "room rent santosh", "rent", True, True),
        (date(month_start.year, month_start.month, 9), 160.0, "debit", "bus pass recharge", "travel", False, False),
        (date(month_start.year, month_start.month, 11), 820.0, "credit", "site labour payment", "business_income", False, False),
        (date(month_start.year, month_start.month, 12), 900.0, "debit", "grocery kirana", "groceries", False, False),
        (date(month_start.year, month_start.month, 15), 700.0, "credit", "paint work advance", "business_income", False, False),
        (date(month_start.year, month_start.month, 16), 650.0, "debit", "health clinic", "health", False, False),
        (date(month_start.year, month_start.month, 18), 1200.0, "debit", "micro loan emi", "emi_loans", True, True),
        (date(month_start.year, month_start.month, 21), 890.0, "credit", "construction wages", "business_income", False, False),
        (date(month_start.year, month_start.month, 23), 299.0, "debit", "jio recharge", "bills", True, True),
        (date(month_start.year, month_start.month, 25), 450.0, "debit", "electricity prepaid", "bills", True, True),
        (date(month_start.year, month_start.month, 27), 940.0, "credit", "weekend labour payment", "business_income", False, False),
    ]


def _farmer_transactions(month_start: date) -> list[DemoTxn]:
    if month_start.month == date.today().month and month_start.year == date.today().year:
        crop_credit = (date(month_start.year, month_start.month, 1), 300000.0, "credit", "soyabean mandi payout", "business_income", False, False)
    else:
        crop_credit = (date(month_start.year, month_start.month, 3), 145000.0, "credit", "crop sale mandi", "business_income", False, False)

    return [
        crop_credit,
        (date(month_start.year, month_start.month, 4), 3200.0, "debit", "grocery market", "groceries", False, False),
        (date(month_start.year, month_start.month, 6), 8500.0, "debit", "fertilizer dealer", "farming_expense", False, False),
        (date(month_start.year, month_start.month, 8), 4200.0, "debit", "diesel pump filling", "farming_expense", False, False),
        (date(month_start.year, month_start.month, 10), 2500.0, "debit", "school fees zilla parishad", "education", True, True),
        (date(month_start.year, month_start.month, 14), 3600.0, "debit", "tractor emi cooperative bank", "emi_loans", True, True),
        (date(month_start.year, month_start.month, 18), 950.0, "debit", "medical store", "health", False, False),
        (date(month_start.year, month_start.month, 21), 1250.0, "debit", "irrigation power bill", "bills", True, True),
        (date(month_start.year, month_start.month, 24), 349.0, "debit", "jio recharge", "bills", True, True),
    ]


def _business_transactions(month_start: date) -> list[DemoTxn]:
    return [
        (date(month_start.year, month_start.month, 1), 42000.0, "credit", "customer payments week one", "business_income", False, False),
        (date(month_start.year, month_start.month, 3), 17000.0, "debit", "supplier payment mahesh traders", "business_expense", False, False),
        (date(month_start.year, month_start.month, 5), 6500.0, "debit", "shop rent", "rent", True, True),
        (date(month_start.year, month_start.month, 8), 18500.0, "credit", "upi customer settlements", "business_income", False, False),
        (date(month_start.year, month_start.month, 10), 2400.0, "debit", "shop electricity bill", "bills", True, True),
        (date(month_start.year, month_start.month, 12), 3200.0, "debit", "business loan emi", "emi_loans", True, True),
        (date(month_start.year, month_start.month, 15), 21000.0, "credit", "counter sales deposit", "business_income", False, False),
        (date(month_start.year, month_start.month, 18), 2600.0, "debit", "family grocery market", "groceries", False, False),
        (date(month_start.year, month_start.month, 20), 900.0, "debit", "medical store", "health", False, False),
        (date(month_start.year, month_start.month, 23), 349.0, "debit", "jio business recharge", "bills", True, True),
        (date(month_start.year, month_start.month, 26), 18000.0, "credit", "festival season bulk order", "business_income", False, False),
    ]


def _family_manager_transactions(month_start: date) -> list[DemoTxn]:
    return [
        (date(month_start.year, month_start.month, 1), 16500.0, "credit", "home transfer from rajesh", "salary_income", False, True),
        (date(month_start.year, month_start.month, 2), 5000.0, "debit", "house rent", "rent", True, True),
        (date(month_start.year, month_start.month, 5), 2300.0, "debit", "grocery market", "groceries", False, False),
        (date(month_start.year, month_start.month, 7), 2800.0, "debit", "school fees vidya mandir", "education", True, True),
        (date(month_start.year, month_start.month, 10), 1100.0, "debit", "gas cylinder", "bills", True, True),
        (date(month_start.year, month_start.month, 14), 950.0, "debit", "medical store", "health", False, False),
        (date(month_start.year, month_start.month, 18), 1250.0, "debit", "electricity board", "bills", True, True),
        (date(month_start.year, month_start.month, 24), 349.0, "debit", "jio recharge", "bills", True, True),
    ]


def _transactions_for_profile(profile: FinancialProfile, month_start: date) -> list[DemoTxn]:
    if profile.user_type == "daily_wage":
        return _daily_wage_transactions(month_start)
    if profile.user_type == "farmer_seasonal":
        return _farmer_transactions(month_start)
    if profile.user_type == "business_self_employed":
        return _business_transactions(month_start)
    if profile.user_type == "family_manager":
        return _family_manager_transactions(month_start)
    return _salaried_transactions(month_start)


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
            next_income_in_days=None,
            business_mode_enabled=False,
        )
        db.add(profile)
    else:
        preserved_start_cash = profile.start_cash_amount
        profile.currency_code = "INR"
        profile.start_cash_amount = preserved_start_cash if preserved_start_cash is not None else 1800
        if profile.income_pattern == "monthly" and profile.salary_day_of_month is None:
            profile.salary_day_of_month = 1

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

        transactions = _transactions_for_profile(profile, month_start)

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
