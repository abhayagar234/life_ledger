from __future__ import annotations

from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
import re

from sqlalchemy.orm import Session

from app.models.emi_payment import EMIPayment
from app.models.financial_profile import FinancialProfile
from app.models.ledger_entry import LedgerEntry
from app.models.loan import Loan
from app.models.normalized_transaction import NormalizedTransaction
from app.schemas.cashflow import CashflowSummaryResponse, ProtectedDueItem
from app.services.due_matching import ConfirmedDueSignature, confirmed_due_matches, confirmed_due_signatures
from app.services.upcoming_dues import ensure_recurring_dues_current, is_recurring_manual_due


ESSENTIAL_CATEGORIES = {"groceries", "health", "travel", "bills", "rent", "emi_loans", "farming_expense", "education"}
NON_SPEND_CATEGORIES = {"transfers"}
SAVINGS_CATEGORIES = {"savings_investments"}
FIXED_DUE_CATEGORIES = {"rent", "emi_loans", "bills", "subscriptions", "insurance", "credit_card_payment"}
ROLLING_DAILY_NEEDS_CATEGORIES = {"groceries", "health", "travel", "farming_expense"}
STRICT_PATTERN_DUE_CATEGORIES = {"rent", "emi_loans", "subscriptions", "insurance", "credit_card_payment"}
CARD_PAYMENT_KEYWORDS = (
    "credit card payment",
    "card payment",
    "direct debit payment",
    "cc payment",
    "sbicard",
    "sbi card",
)


def _round_money(value: float) -> float:
    return round(max(value, 0.0), 2)


def _fmt_money(value: float) -> str:
    return f"Rs {round(value):,}"


def _is_card_payment_transfer(row: NormalizedTransaction) -> bool:
    description = (row.description_clean or row.description_raw or "").lower()
    if any(keyword in description for keyword in CARD_PAYMENT_KEYWORDS):
        return True
    return (row.category_code or "") == "credit_card_payment"


def _parse_balance_value(value: object) -> float | None:
    if value in (None, ""):
        return None
    if isinstance(value, (int, float, Decimal)):
        return float(value)
    text = str(value).strip().lower()
    if not text:
        return None
    cleaned = (
        text.replace("₹", "")
        .replace("rs.", "")
        .replace("rs", "")
        .replace("inr", "")
        .replace(",", "")
        .replace("cr", "")
        .replace("dr", "")
        .strip()
    )
    cleaned = cleaned.strip("()")
    if not re.fullmatch(r"-?\d+(\.\d+)?", cleaned):
        return None
    try:
        return float(Decimal(cleaned))
    except InvalidOperation:
        return None


def _latest_statement_balance(rows: list[NormalizedTransaction]) -> float | None:
    for row in sorted(rows, key=lambda item: item.import_row.row_number if item.import_row else 0):
        raw_data = row.import_row.raw_data if row.import_row else {}
        for key, value in raw_data.items():
            if str(key).lower() in {"statement_clear_balance", "statement_closing_balance"}:
                parsed = _parse_balance_value(value)
                if parsed is not None:
                    return max(parsed, 0.0)

    def sort_key(item: NormalizedTransaction) -> tuple[date, int]:
        row_number = item.import_row.row_number if item.import_row else 0
        return item.transaction_date, row_number

    for row in sorted(rows, key=sort_key, reverse=True):
        raw_data = row.import_row.raw_data if row.import_row else {}
        for key, value in raw_data.items():
            if "balance" in str(key).lower():
                parsed = _parse_balance_value(value)
                if parsed is not None:
                    return max(parsed, 0.0)
    return None


def _format_date_label(value: date | None) -> str:
    return value.strftime("%b %d") if value else "the next income"


def _next_income_label(profile: FinancialProfile | None, value: date | None) -> str:
    if profile and profile.next_income_in_days and profile.next_income_in_days > 0:
        if profile.next_income_in_days <= 3:
            return "the next few days"
        if profile.next_income_in_days <= 7:
            return "the next week"
        if profile.next_income_in_days <= 30:
            return "the next money point"
        return "the next big money point"
    if profile and profile.income_pattern == "weekly":
        return "the end of this week"
    if profile and profile.income_pattern == "monthly" and not profile.salary_day_of_month:
        return "the end of this month"
    if profile and profile.income_pattern == "daily":
        return "the next few days"
    if profile and profile.income_pattern == "seasonal":
        return value.strftime("%b %d") if value else "the next money point"
    return _format_date_label(value)


def _humanize_counterparty(value: str | None, fallback: str) -> str:
    raw = (value or fallback or "").replace("_", " ").strip()
    if not raw:
        return "A due"
    return " ".join(part.capitalize() for part in raw.split())


def _slugify_due_part(value: str) -> str:
    safe = "".join(char.lower() if char.isalnum() else "-" for char in value.strip())
    while "--" in safe:
        safe = safe.replace("--", "-")
    return safe.strip("-") or "due"


def _end_of_month(day: date) -> date:
    return date(day.year, day.month, monthrange(day.year, day.month)[1])


def _start_of_week(day: date) -> date:
    return day - timedelta(days=day.weekday())


def _end_of_week(day: date) -> date:
    return _start_of_week(day) + timedelta(days=6)


def _safe_date_for_day(base: date, target_day: int) -> date:
    clamped_day = min(max(target_day, 1), monthrange(base.year, base.month)[1])
    return date(base.year, base.month, clamped_day)


def _next_month(base: date) -> date:
    if base.month == 12:
        return date(base.year + 1, 1, 1)
    return date(base.year, base.month + 1, 1)


def _previous_month(base: date) -> date:
    if base.month == 1:
        return date(base.year - 1, 12, 1)
    return date(base.year, base.month - 1, 1)


def _next_income_date(profile: FinancialProfile | None, rows: list[NormalizedTransaction], as_of: date) -> tuple[date | None, str]:
    if profile and profile.next_income_in_days and profile.next_income_in_days > 0:
        return as_of + timedelta(days=profile.next_income_in_days), "high"
    if profile and profile.salary_day_of_month:
        same_month = _safe_date_for_day(as_of, profile.salary_day_of_month)
        salary_seen_today = any(
            row.direction == "credit"
            and row.category_code == "salary_income"
            and row.transaction_date == as_of
            for row in rows
        )
        if same_month > as_of:
            return same_month, "high"
        if same_month == as_of and not salary_seen_today:
            return same_month, "high"
        next_month = _next_month(as_of)
        return _safe_date_for_day(next_month, profile.salary_day_of_month), "high"

    if profile and profile.income_pattern == "weekly":
        return _end_of_week(as_of), "medium"
    if profile and profile.income_pattern == "monthly":
        return _end_of_month(as_of), "medium"
    if profile and profile.income_pattern == "daily":
        return as_of + timedelta(days=3), "low"
    if profile and profile.income_pattern == "seasonal":
        return as_of + timedelta(days=30), "low"

    salary_rows = [
        row
        for row in rows
        if row.direction == "credit" and row.category_code == "salary_income" and row.transaction_date <= as_of
    ]
    salary_rows.sort(key=lambda row: row.transaction_date, reverse=True)
    if salary_rows:
        last_salary = salary_rows[0].transaction_date
        next_month = _next_month(last_salary)
        inferred = _safe_date_for_day(next_month, last_salary.day)
        return (inferred if inferred >= as_of else _safe_date_for_day(_next_month(as_of), last_salary.day), "medium")

    recent_credits = [
        row
        for row in rows
        if row.direction == "credit"
        and row.category_code not in NON_SPEND_CATEGORIES
        and row.transaction_date >= as_of - timedelta(days=45)
    ]
    if recent_credits:
        avg_gap = 14 if profile and profile.income_pattern in {"daily", "weekly"} else 30
        return as_of + timedelta(days=avg_gap), "low"

    return None, "low"


def _cycle_start_date(profile: FinancialProfile | None, rows: list[NormalizedTransaction], as_of: date) -> date:
    if profile and profile.next_income_in_days and profile.next_income_in_days > 0:
        return as_of - timedelta(days=min(profile.next_income_in_days, 30))
    if profile and profile.salary_day_of_month:
        candidate = _safe_date_for_day(as_of, profile.salary_day_of_month)
        return candidate if candidate <= as_of else _safe_date_for_day(_previous_month(as_of), profile.salary_day_of_month)

    if profile and profile.income_pattern == "weekly":
        return _start_of_week(as_of)
    if profile and profile.income_pattern == "monthly":
        return date(as_of.year, as_of.month, 1)
    if profile and profile.income_pattern == "daily":
        return as_of - timedelta(days=6)
    if profile and profile.income_pattern == "seasonal":
        return as_of - timedelta(days=30)

    salary_rows = [
        row.transaction_date
        for row in rows
        if row.direction == "credit" and row.category_code == "salary_income" and row.transaction_date <= as_of
    ]
    if salary_rows:
        return max(salary_rows)

    recent_credits = [
        row.transaction_date
        for row in rows
        if row.direction == "credit"
        and row.category_code not in NON_SPEND_CATEGORIES
        and row.source_type != "credit_card"
        and row.transaction_date <= as_of
    ]
    if recent_credits:
        return max(recent_credits)

    return max(as_of - timedelta(days=30), date(as_of.year, as_of.month, 1))


def _has_due_like_pattern(group: list[NormalizedTransaction]) -> bool:
    if len(group) < 2:
        return False
    dates = sorted(row.transaction_date for row in group)
    gaps = [(dates[index + 1] - dates[index]).days for index in range(len(dates) - 1)]
    return any(6 <= gap <= 8 or 27 <= gap <= 33 for gap in gaps)


def _is_statement_due_candidate(row: NormalizedTransaction) -> bool:
    category = row.category_code or "uncategorized"
    if category in STRICT_PATTERN_DUE_CATEGORIES:
        return True
    if category == "bills":
        return bool(row.is_fixed_obligation)
    return bool(row.is_fixed_obligation and category in FIXED_DUE_CATEGORIES)


def _lower_confidence(current: str, maximum: str) -> str:
    rank = {"low": 0, "medium": 1, "high": 2}
    return current if rank[current] <= rank[maximum] else maximum


def _manual_cash_on_hand(db: Session, user_id: str) -> tuple[float, bool]:
    cash_total = 0.0
    has_explicit_set = False
    entries = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.user_id == user_id, LedgerEntry.account_type == "cash")
        .order_by(LedgerEntry.entry_date.asc(), LedgerEntry.created_at.asc())
        .all()
    )
    for entry in entries:
        amount = float(entry.amount)
        if entry.cash_direction == "set":
            cash_total = amount
            has_explicit_set = True
        elif entry.cash_direction in {"in", "adjust"}:
            cash_total += amount
        elif entry.cash_direction == "out":
            cash_total -= amount
    return cash_total, has_explicit_set


def _latest_cash_update_date(db: Session, user_id: str, profile: FinancialProfile | None) -> date | None:
    latest_cash_entry = (
        db.query(LedgerEntry)
        .filter(LedgerEntry.user_id == user_id, LedgerEntry.account_type == "cash")
        .order_by(LedgerEntry.entry_date.desc(), LedgerEntry.created_at.desc())
        .first()
    )
    if latest_cash_entry is not None:
        return latest_cash_entry.entry_date
    if profile and profile.start_cash_amount is not None:
        return profile.updated_at.date()
    return None


def _manual_due_payments(db: Session, user_id: str, cycle_start: date, as_of: date) -> float:
    entries = (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.user_id == user_id,
            LedgerEntry.entry_type == "emi_payment",
            LedgerEntry.emi_payment_id.is_(None),
            ~LedgerEntry.source_label.like("pattern_due:%"),
            LedgerEntry.entry_date >= cycle_start,
            LedgerEntry.entry_date <= as_of,
        )
        .all()
    )
    return round(sum(float(entry.amount) for entry in entries), 2)


def _manual_bank_activity(db: Session, user_id: str, cycle_start: date, as_of: date) -> float:
    entries = (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.user_id == user_id,
            LedgerEntry.account_type == "bank",
            LedgerEntry.entry_date >= cycle_start,
            LedgerEntry.entry_date <= as_of,
        )
        .all()
    )

    bank_total = 0.0
    for entry in entries:
        amount = float(entry.amount)
        if entry.cash_direction in {"in", "adjust"}:
            bank_total += amount
        elif entry.cash_direction == "out":
            bank_total -= amount
    return round(bank_total, 2)


def _manual_card_due_activity(db: Session, user_id: str, cycle_start: date, as_of: date) -> float:
    entries = (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.user_id == user_id,
            LedgerEntry.account_type == "card",
            LedgerEntry.entry_date >= cycle_start,
            LedgerEntry.entry_date <= as_of,
        )
        .all()
    )

    card_due_total = 0.0
    for entry in entries:
        amount = float(entry.amount)
        if entry.cash_direction == "out":
            card_due_total += amount
        elif entry.cash_direction in {"in", "adjust"}:
            card_due_total -= amount
    return round(max(card_due_total, 0.0), 2)


def _manual_trailing_spend(db: Session, user_id: str, trailing_start: date, as_of: date) -> tuple[float, float]:
    entries = (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.user_id == user_id,
            LedgerEntry.entry_date >= trailing_start,
            LedgerEntry.entry_date <= as_of,
        )
        .all()
    )

    trailing_total = 0.0
    trailing_essential = 0.0
    for entry in entries:
        amount = float(entry.amount)
        category = entry.category_code or ""
        if entry.entry_type in {"expense", "emi_payment"} and entry.cash_direction == "out":
            if category not in SAVINGS_CATEGORIES:
                trailing_total += amount
            if category in ROLLING_DAILY_NEEDS_CATEGORIES:
                trailing_essential += amount

    return round(trailing_total, 2), round(trailing_essential, 2)


def _manual_upcoming_due_watchouts(db: Session, user_id: str, as_of: date, next_income_date: date) -> list[str]:
    items = (
        db.query(EMIPayment, Loan)
        .join(Loan, Loan.id == EMIPayment.loan_id)
        .filter(
            EMIPayment.user_id == user_id,
            EMIPayment.status != "paid",
            EMIPayment.due_date >= as_of,
            EMIPayment.due_date <= next_income_date,
        )
        .order_by(EMIPayment.due_date.asc(), EMIPayment.created_at.asc())
        .all()
    )

    watchouts: list[str] = []
    for emi_payment, loan in items:
        remaining_due = max(float(emi_payment.amount_due) - float(emi_payment.amount_paid), 0.0)
        if remaining_due <= 0:
            continue
        readable_name = _humanize_counterparty(loan.counterparty_name, "due")
        formatted_date = emi_payment.due_date.strftime("%B %d")
        watchouts.append(f"{readable_name} {_fmt_money(remaining_due)} on {formatted_date}. Keep this aside first.")
    return watchouts


def _pattern_due_payments(db: Session, user_id: str, cycle_start: date, as_of: date) -> dict[str, float]:
    entries = (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.user_id == user_id,
            LedgerEntry.entry_type == "emi_payment",
            LedgerEntry.entry_date >= cycle_start,
            LedgerEntry.entry_date <= as_of,
            LedgerEntry.source_label.like("pattern_due:%"),
        )
        .all()
    )
    paid_amounts: dict[str, float] = defaultdict(float)
    for entry in entries:
        if entry.source_label and entry.source_label.startswith("pattern_due:"):
            paid_amounts[entry.source_label] += float(entry.amount)
    return {key: round(value, 2) for key, value in paid_amounts.items()}


def _manual_due_items(
    db: Session,
    user_id: str,
    cycle_start: date,
    as_of: date,
    next_income_date: date,
) -> list[ProtectedDueItem]:
    items = (
        db.query(EMIPayment, Loan)
        .join(Loan, Loan.id == EMIPayment.loan_id)
        .filter(
            EMIPayment.user_id == user_id,
            EMIPayment.due_date >= cycle_start,
            EMIPayment.due_date <= next_income_date,
            Loan.confirmed == True,
        )
        .order_by(EMIPayment.due_date.asc(), EMIPayment.created_at.asc())
        .all()
    )

    results: list[ProtectedDueItem] = []
    for emi_payment, loan in items:
        remaining_due = max(float(emi_payment.amount_due) - float(emi_payment.amount_paid), 0.0)
        is_paid = emi_payment.status == "paid" or remaining_due <= 0
        if not is_paid and emi_payment.due_date < as_of:
            continue
        results.append(
            ProtectedDueItem(
                due_key=f"manual_due:{emi_payment.id}",
                name=_humanize_counterparty(loan.counterparty_name, "Due"),
                amount=round(float(emi_payment.amount_due), 2),
                due_date=emi_payment.due_date,
                status="paid" if is_paid else ("partial" if float(emi_payment.amount_paid) > 0 else "pending"),
                amount_paid=round(float(emi_payment.amount_paid), 2),
                remaining_amount=round(remaining_due, 2),
                source_type=emi_payment.source_type,
                emi_payment_id=emi_payment.id,
                loan_id=loan.id,
                repeat_monthly=is_recurring_manual_due(loan, emi_payment),
            )
        )
    return results


def _manual_due_total(db: Session, user_id: str, as_of: date, next_income_date: date) -> float:
    items = (
        db.query(EMIPayment)
        .filter(
            EMIPayment.user_id == user_id,
            EMIPayment.status != "paid",
            EMIPayment.due_date >= as_of,
            EMIPayment.due_date <= next_income_date,
        )
        .all()
    )
    return round(sum(max(float(item.amount_due) - float(item.amount_paid), 0.0) for item in items), 2)


def _fixed_due_estimate(
    rows: list[NormalizedTransaction],
    as_of: date,
    cycle_start: date,
    horizon_days: int,
    paid_due_amounts: dict[str, float],
    existing_confirmed_dues: list[ConfirmedDueSignature],
) -> tuple[float, list[str], list[str], list[str], list[ProtectedDueItem]]:
    horizon_end = as_of + timedelta(days=horizon_days)
    grouped: dict[str, list[NormalizedTransaction]] = defaultdict(list)
    for row in rows:
        if row.direction != "debit":
            continue
        if not _is_statement_due_candidate(row):
            continue
        key = row.counterparty_name or row.description_clean or row.category_code or "due"
        grouped[key].append(row)

    due_total = 0.0
    labels: list[str] = []
    due_watchouts: list[str] = []
    forgotten_subscriptions: list[str] = []
    due_items: list[ProtectedDueItem] = []
    for key, group in grouped.items():
        group.sort(key=lambda row: row.transaction_date, reverse=True)
        if not _has_due_like_pattern(group):
            continue
        latest = group[0]
        last_day = group[0].transaction_date.day
        prev_day = group[1].transaction_date.day
        target_day = round((last_day + prev_day) / 2)

        candidate = _safe_date_for_day(as_of, target_day)
        if candidate < as_of:
            candidate = _safe_date_for_day(_next_month(as_of), target_day)

        if as_of <= candidate <= horizon_end:
            amount = float(latest.amount)
            label = latest.category_code.replace("_", " ") if latest.category_code else "fixed due"
            readable_name = _humanize_counterparty(latest.counterparty_name or latest.description_clean, label)
            if confirmed_due_matches(
                existing_confirmed_dues,
                counterparty=f"{readable_name} {latest.counterparty_name or ''} {latest.description_clean or latest.description_raw or ''}",
                amount=amount,
                frequency="monthly",
            ):
                continue
            labels.append(label)
            formatted_date = candidate.strftime("%B %d")
            due_key = (
                f"pattern_due:{latest.category_code or 'due'}:"
                f"{_slugify_due_part(latest.counterparty_name or latest.description_clean or key)}:"
                f"{candidate.isoformat()}:{int(round(amount))}"
            )
            amount_paid = min(paid_due_amounts.get(due_key, 0.0), amount)
            remaining_amount = max(amount - amount_paid, 0.0)
            is_paid = remaining_amount <= 0
            is_partial = amount_paid > 0 and not is_paid
            if remaining_amount > 0:
                due_total += remaining_amount
                due_watchouts.append(
                    f"{readable_name} {_fmt_money(remaining_amount)} on {formatted_date}. Keep this aside first."
                )
            if latest.category_code == "subscriptions":
                forgotten_subscriptions.append(f"{readable_name} {_fmt_money(remaining_amount)} on {formatted_date}")
            due_items.append(
                ProtectedDueItem(
                    due_key=due_key,
                    name=readable_name,
                    amount=round(amount, 2),
                    due_date=candidate,
                    status="paid" if is_paid else ("partial" if is_partial else "pending"),
                    amount_paid=round(amount_paid, 2),
                    remaining_amount=round(remaining_amount, 2),
                    source_type="statement_pattern",
                    emi_payment_id=None,
                    loan_id=None,
                )
            )

    return due_total, sorted(set(labels)), due_watchouts, forgotten_subscriptions, due_items


def build_cashflow_summary(db: Session, user_id: str, as_of: date | None = None) -> CashflowSummaryResponse:
    as_of_date = as_of or date.today()
    ensure_recurring_dues_current(db, user_id, as_of_date)
    profile = db.query(FinancialProfile).filter(FinancialProfile.user_id == user_id).first()
    history_start = as_of_date - timedelta(days=120)
    rows = (
        db.query(NormalizedTransaction)
        .filter(
            NormalizedTransaction.user_id == user_id,
            NormalizedTransaction.transaction_date >= history_start,
            NormalizedTransaction.transaction_date <= as_of_date,
            NormalizedTransaction.dedupe_status != "duplicate",
        )
        .order_by(NormalizedTransaction.transaction_date.asc())
        .all()
    )
    used_stale_statement_window = False

    if not rows:
        latest_imported_row = (
            db.query(NormalizedTransaction)
            .filter(
                NormalizedTransaction.user_id == user_id,
                NormalizedTransaction.transaction_date <= as_of_date,
                NormalizedTransaction.dedupe_status != "duplicate",
            )
            .order_by(NormalizedTransaction.transaction_date.desc())
            .first()
        )
        if latest_imported_row is not None:
            stale_window_end = latest_imported_row.transaction_date
            stale_window_start = stale_window_end - timedelta(days=120)
            rows = (
                db.query(NormalizedTransaction)
                .filter(
                    NormalizedTransaction.user_id == user_id,
                    NormalizedTransaction.transaction_date >= stale_window_start,
                    NormalizedTransaction.transaction_date <= stale_window_end,
                    NormalizedTransaction.dedupe_status != "duplicate",
                )
                .order_by(NormalizedTransaction.transaction_date.asc())
                .all()
            )
            used_stale_statement_window = bool(rows)

    if not rows:
        next_income_date, _ = _next_income_date(profile, rows, as_of_date)
        if next_income_date is None:
            next_income_date = _end_of_month(as_of_date)
        cycle_start = _cycle_start_date(profile, rows, as_of_date)
        manual_cash_total, has_explicit_cash_set = _manual_cash_on_hand(db, user_id)
        starting_cash = float(profile.start_cash_amount) if profile and profile.start_cash_amount and not has_explicit_cash_set else 0.0
        manual_cash = starting_cash + manual_cash_total
        latest_cash_update_date = _latest_cash_update_date(db, user_id, profile)
        cash_is_stale = bool(
            latest_cash_update_date is not None and (as_of_date - latest_cash_update_date).days > 4 and manual_cash > 0
        )
        manual_due_items = _manual_due_items(db, user_id, cycle_start, as_of_date, next_income_date)
        manual_due_total = _manual_due_total(db, user_id, as_of_date, next_income_date)
        business_reserve = max(float(profile.business_reserve_amount), 0.0) if profile and profile.business_reserve_amount is not None else 0.0
        confirmed_bank_balance = float(profile.bank_balance_confirmed) if profile and profile.bank_balance_confirmed is not None else None
        working_bank_balance = round(max(confirmed_bank_balance or 0.0, 0.0), 2)
        days_until_income = max((next_income_date - as_of_date).days, 1)
        baseline_daily_spend = (
            round(float(profile.daily_needs_override), 2)
            if profile and profile.daily_needs_override is not None and float(profile.daily_needs_override) > 0
            else 0.0
        )
        daily_needs_required = round(baseline_daily_spend * days_until_income, 2)
        effective_available_money = _round_money(max(working_bank_balance + manual_cash - manual_due_total - business_reserve, 0.0))
        safe_to_spend = _round_money(effective_available_money - daily_needs_required)
        effective_available_bank_only = _round_money(max(working_bank_balance - manual_due_total - business_reserve, 0.0))
        safe_to_spend_bank_only = _round_money(effective_available_bank_only - daily_needs_required)
        daily_needs_buffer = round(min(effective_available_money, daily_needs_required), 2)
        shortfall_amount = _round_money(daily_needs_required - effective_available_money)
        shortfall_amount_bank_only = _round_money(daily_needs_required - effective_available_bank_only)
        return CashflowSummaryResponse(
            as_of_date=as_of_date,
            latest_activity_date=None,
            latest_cash_update_date=latest_cash_update_date,
            status="needs_data",
            headline="Start clean, then add only what matters.",
            plain_summary="You can add cash, dues, and important money changes now. Statement history will make the answer smarter later.",
            safe_till_date=None,
            next_income_date=next_income_date,
            effective_available_money=effective_available_money,
            liquid_balance=0,
            detected_bank_balance=0,
            working_bank_balance=working_bank_balance,
            bank_balance_needs_confirmation=False,
            bank_balance_source=profile.bank_balance_source if profile and profile.bank_balance_source else "detected",
            cash_on_hand=round(manual_cash, 2),
            cash_is_stale=cash_is_stale,
            business_reserve_amount=round(business_reserve, 2),
            upcoming_dues_total=manual_due_total,
            daily_needs_buffer=daily_needs_buffer,
            daily_needs_required=daily_needs_required,
            baseline_daily_spend=baseline_daily_spend,
            runway_days=None,
            safe_to_spend=safe_to_spend,
            safe_to_spend_bank_only=safe_to_spend_bank_only,
            safe_to_save=0,
            safe_to_invest=0,
            shortfall_amount=shortfall_amount,
            shortfall_amount_bank_only=shortfall_amount_bank_only,
            confidence="low",
            explanations=[
                "This is a clean start with no statement history yet.",
                "Any cash or due you add now will show up here first.",
                *(
                    [f"Daily needs till the next income are set aside at about {_fmt_money(daily_needs_required)}."]
                    if daily_needs_required > 0
                    else []
                ),
            ],
            watchouts=[],
            protected_due_items=manual_due_items,
        )

    latest_activity_date = max(
        [row.transaction_date for row in rows],
        default=None,
    )
    latest_cash_update_date = _latest_cash_update_date(db, user_id, profile)

    cycle_start = _cycle_start_date(profile, rows, as_of_date)
    bank_observed_balance = 0.0
    trailing_essential_spend = 0.0
    trailing_total_spend = 0.0

    spend_window_end = latest_activity_date if latest_activity_date and latest_activity_date < as_of_date else as_of_date
    trailing_start = spend_window_end - timedelta(days=30)
    for row in rows:
        amount = float(row.amount)
        category = row.category_code or ""
        is_bank_like = row.source_type != "credit_card"
        is_card_payment_transfer = _is_card_payment_transfer(row)
        in_current_cycle = row.transaction_date >= cycle_start

        if row.direction == "credit":
            if in_current_cycle and category not in NON_SPEND_CATEGORIES and is_bank_like:
                bank_observed_balance += amount
            continue

        if category in NON_SPEND_CATEGORIES:
            continue
        if in_current_cycle and is_bank_like:
            bank_observed_balance -= amount

        if row.transaction_date < trailing_start or row.transaction_date > spend_window_end:
            continue
        if is_card_payment_transfer:
            # Avoid double counting: card purchases are spend events, bill payment is settlement transfer.
            continue

        if category not in SAVINGS_CATEGORIES:
            trailing_total_spend += amount
        if category in ROLLING_DAILY_NEEDS_CATEGORIES:
            trailing_essential_spend += amount

    manual_bank_delta = _manual_bank_activity(db, user_id, cycle_start, as_of_date)
    bank_observed_balance += manual_bank_delta
    manual_trailing_total, manual_trailing_essential = _manual_trailing_spend(db, user_id, trailing_start, as_of_date)
    trailing_total_spend += manual_trailing_total
    trailing_essential_spend += manual_trailing_essential

    next_income_date, income_confidence = _next_income_date(profile, rows, as_of_date)
    if next_income_date is None:
        next_income_date = _end_of_month(as_of_date)
    days_until_income = max((next_income_date - as_of_date).days, 1)

    manual_cash_total, has_explicit_cash_set = _manual_cash_on_hand(db, user_id)
    starting_cash = float(profile.start_cash_amount) if profile and profile.start_cash_amount and not has_explicit_cash_set else 0.0
    manual_cash = starting_cash + manual_cash_total
    cash_is_stale = bool(
        latest_cash_update_date is not None and (as_of_date - latest_cash_update_date).days > 4 and manual_cash > 0
    )
    emi_due_total = sum(
        float(emi.amount_due) - float(emi.amount_paid)
        for emi in db.query(EMIPayment)
        .join(Loan, Loan.id == EMIPayment.loan_id)
        .filter(
            EMIPayment.user_id == user_id,
            EMIPayment.status != "paid",
            EMIPayment.due_date >= as_of_date,
            EMIPayment.due_date <= next_income_date,
            Loan.confirmed == True,
        )
        .all()
    )
    paid_pattern_due_amounts = _pattern_due_payments(db, user_id, cycle_start, as_of_date)
    existing_confirmed_dues = confirmed_due_signatures(db, user_id)
    pattern_due_total, due_labels, _due_watchouts, forgotten_subscriptions, pattern_due_items = _fixed_due_estimate(
        rows, as_of_date, cycle_start, days_until_income, paid_pattern_due_amounts, existing_confirmed_dues
    )
    manual_due_items = _manual_due_items(db, user_id, cycle_start, as_of_date, next_income_date)
    manual_card_due_total = _manual_card_due_activity(db, user_id, cycle_start, as_of_date)

    # Pattern dues are now pending confirmation - don't count them in protected_dues
    # They'll be returned separately for user to confirm/dismiss
    pending_pattern_dues = pattern_due_items

    # Only count confirmed manual dues + card activity in protected_dues
    gross_protected_dues = max(emi_due_total, 0.0) + manual_card_due_total
    manual_due_paid_total = _manual_due_payments(db, user_id, cycle_start, as_of_date)
    protected_dues = _round_money(gross_protected_dues - manual_due_paid_total)

    baseline_daily_spend = round(trailing_essential_spend / 30, 2) if trailing_essential_spend > 0 else 0.0
    if baseline_daily_spend == 0 and trailing_total_spend > 0:
        baseline_daily_spend = round((trailing_total_spend * 0.55) / 30, 2)
    if profile and profile.daily_needs_override is not None and float(profile.daily_needs_override) > 0:
        baseline_daily_spend = round(float(profile.daily_needs_override), 2)

    statement_closing_balance = _latest_statement_balance(rows)
    detected_bank_balance = round(
        statement_closing_balance if statement_closing_balance is not None else max(bank_observed_balance, 0.0),
        2,
    )
    confirmed_bank_balance = float(profile.bank_balance_confirmed) if profile and profile.bank_balance_confirmed is not None else None
    working_bank_balance_base = round(
        max(confirmed_bank_balance if confirmed_bank_balance is not None else detected_bank_balance, 0.0),
        2,
    )
    # Manual online/UPI entries should immediately affect visible bank money
    # until statement import catches up.
    working_bank_balance = round(max(working_bank_balance_base + manual_bank_delta, 0.0), 2)
    bank_balance_needs_confirmation = detected_bank_balance > 0 and confirmed_bank_balance is None
    business_reserve = max(float(profile.business_reserve_amount), 0.0) if profile and profile.business_reserve_amount is not None else 0.0

    effective_available_money = _round_money(working_bank_balance + manual_cash - protected_dues - business_reserve)
    spend_needed_until_income = round(baseline_daily_spend * days_until_income, 2)
    daily_needs_required = round(spend_needed_until_income, 2)
    daily_needs_buffer = round(min(effective_available_money, daily_needs_required), 2)
    safe_leftover = round(effective_available_money - daily_needs_required, 2)
    shortfall_amount = _round_money(daily_needs_required - effective_available_money)
    effective_available_bank_only = _round_money(working_bank_balance - protected_dues - business_reserve)
    safe_leftover_bank_only = round(effective_available_bank_only - daily_needs_required, 2)
    safe_to_spend_bank_only = _round_money(safe_leftover_bank_only)
    shortfall_amount_bank_only = _round_money(daily_needs_required - effective_available_bank_only)

    runway_days = round(effective_available_money / baseline_daily_spend, 1) if baseline_daily_spend > 0 else None
    runway_horizon = int(runway_days) if runway_days is not None else 0
    safe_till_date = as_of_date + timedelta(days=runway_horizon) if runway_days is not None else None

    uncertainty_buffer = 0.0
    confidence = "high"
    if income_confidence == "medium":
        uncertainty_buffer = max(500.0, spend_needed_until_income * 0.1)
        confidence = "medium"
    elif income_confidence == "low":
        uncertainty_buffer = max(1000.0, spend_needed_until_income * 0.2)
        confidence = "low"
    if bank_balance_needs_confirmation:
        confidence = _lower_confidence(confidence, "medium")
    if latest_activity_date and (as_of_date - latest_activity_date).days > 14:
        confidence = _lower_confidence(confidence, "low")
    if used_stale_statement_window:
        confidence = "low"
    if len(rows) < 10 or trailing_total_spend <= 0:
        confidence = _lower_confidence(confidence, "low")
    # Thin statement coverage should down-rank confidence even if rows exist.
    unique_uploads = len({row.import_file_id for row in rows if row.import_file_id})
    coverage_days = (
        (max(row.transaction_date for row in rows) - min(row.transaction_date for row in rows)).days + 1
        if rows
        else 0
    )
    if unique_uploads <= 1 or coverage_days < 30:
        confidence = _lower_confidence(confidence, "medium")
    if coverage_days < 14:
        confidence = _lower_confidence(confidence, "low")
    if pending_pattern_dues:
        confidence = _lower_confidence(confidence, "medium")

    safe_to_spend = _round_money(safe_leftover)
    safe_to_save = _round_money(safe_leftover - uncertainty_buffer)
    safe_to_invest = _round_money(safe_to_save - max(500.0, uncertainty_buffer * 0.5) if safe_to_save > 0 else 0.0)

    next_income_label = _next_income_label(profile, next_income_date)

    if shortfall_amount > 0:
        status = "risk"
        headline = f"Protect {_fmt_money(shortfall_amount)} before {next_income_label}."
        plain_summary = (
            f"Protect {_fmt_money(shortfall_amount)} before {next_income_label}. Avoid big spends this week and keep dues aside first."
        )
    elif safe_to_spend > 0 and safe_to_spend >= max(1500.0, protected_dues * 0.4):
        status = "safe"
        headline = f"You're okay till {next_income_label}."
        plain_summary = (
            f"You're okay till {next_income_label}. Keep dues protected first, then spend from about {_fmt_money(safe_to_spend)} safely free money."
        )
    else:
        status = "tight"
        headline = f"Slow down - tight till {next_income_label}."
        plain_summary = (
            f"Slow down till {next_income_label}. Keep only essentials moving for now and protect dues before new spending."
        )
    if used_stale_statement_window and latest_activity_date:
        status = "needs_data"
        headline = "Upload a recent statement to trust this number."
        plain_summary = (
            f"We can show a rough picture from your old statement ending {latest_activity_date.strftime('%b %d, %Y')}, "
            "but today's Safe to Spend needs recent transactions or a bank balance update."
        )

    explanations = [
        f"We used imported transactions from this income cycle up to {as_of_date.strftime('%b %d')} to estimate your cashflow.",
        f"We protected about {_fmt_money(protected_dues)} for EMI, rent, bills, and other fixed dues.",
        f"Daily needs till the next income look like about {_fmt_money(daily_needs_required)}.",
    ]
    if daily_needs_buffer >= daily_needs_required and daily_needs_required > 0:
        explanations.append(f"That full daily-needs amount is currently covered inside the money we can see.")
    elif daily_needs_buffer > 0:
        uncovered_daily_needs = _round_money(daily_needs_required - daily_needs_buffer)
        explanations.append(
            f"Only about {_fmt_money(daily_needs_buffer)} of that is covered right now, so protect another {_fmt_money(uncovered_daily_needs)} before {next_income_label}."
        )
    if manual_due_paid_total > 0:
        explanations.append(f"We reduced upcoming dues by about {_fmt_money(manual_due_paid_total)} because you marked those dues as already paid in this cycle.")
    if manual_card_due_total > 0:
        explanations.append(f"We included about {_fmt_money(manual_card_due_total)} from manual credit card spends as money to protect later.")
    if profile and profile.start_cash_amount:
        explanations.append(f"Cash on hand includes your declared starting cash of {_fmt_money(float(profile.start_cash_amount))}.")
    if business_reserve > 0:
        explanations.append(f"We kept about {_fmt_money(business_reserve)} aside first for business running costs.")
    if pending_pattern_dues:
        explanations.append("Some recurring payments were detected but are not counted until you confirm them.")
    if next_income_date:
        explanations.append(f"The next income is estimated around {next_income_date.strftime('%b %d')}.")
        if bank_balance_needs_confirmation:
            explanations.append("Bank money is still an estimate from imported statement activity until you confirm or edit it.")
        else:
            explanations.append("Bank money reflects the amount you confirmed for this cycle.")
    if used_stale_statement_window and latest_activity_date:
        explanations.append(
            f"Your latest imported statement activity is from {latest_activity_date.strftime('%b %d, %Y')}, so today's number needs a recent statement or bank balance confirmation."
        )

    watchouts: list[str] = []
    if safe_to_spend <= 0:
        watchouts.append(f"Protect essentials till {next_income_label}. Avoid big spends this week.")
    elif status == "tight":
        watchouts.append(f"Money is getting tight till {next_income_label}. Slow optional spending for a few days.")
    if confidence != "high":
        watchouts.append("This answer is still an estimate. Keep a little extra buffer this week.")
    if used_stale_statement_window and latest_activity_date:
        watchouts.append(
            f"Latest statement is old ({latest_activity_date.strftime('%b %d, %Y')}). Upload a recent statement for a reliable Safe to Spend number."
        )
    if business_reserve > 0:
        watchouts.append("Some money is being protected first for business running costs.")

    protected_due_items = sorted(
        [*manual_due_items, *pattern_due_items],
        key=lambda item: (0 if item.status == "pending" else 1, item.due_date, item.name.lower()),
    )

    # Prioritize actionable due reminders (especially dues within next 3 days).
    urgent_due_watchouts: list[str] = []
    for item in protected_due_items:
        if item.status == "paid" or item.remaining_amount <= 0:
            continue
        days_left = (item.due_date - as_of_date).days
        if 0 <= days_left <= 3:
            urgent_due_watchouts.append(
                f"{item.name} due in {days_left} day{'s' if days_left != 1 else ''}: {_fmt_money(item.remaining_amount)}."
            )
    if urgent_due_watchouts:
        # Watchouts should stay actionable. The full due list already lives in Keep Aside First.
        unique_due_watchouts = list(dict.fromkeys(urgent_due_watchouts))
        watchouts = [*unique_due_watchouts[:3], *watchouts]

    return CashflowSummaryResponse(
        as_of_date=as_of_date,
        latest_activity_date=latest_activity_date,
        latest_cash_update_date=latest_cash_update_date,
        status=status,
        headline=headline,
        plain_summary=plain_summary,
        safe_till_date=safe_till_date,
        next_income_date=next_income_date,
        effective_available_money=effective_available_money,
        liquid_balance=round(bank_observed_balance, 2),
        detected_bank_balance=detected_bank_balance,
        working_bank_balance=working_bank_balance,
        bank_balance_needs_confirmation=bank_balance_needs_confirmation,
        bank_balance_source=profile.bank_balance_source if profile and profile.bank_balance_source else "detected",
        cash_on_hand=round(manual_cash, 2),
        cash_is_stale=cash_is_stale,
        business_reserve_amount=round(business_reserve, 2),
        upcoming_dues_total=round(protected_dues, 2),
        daily_needs_buffer=daily_needs_buffer,
        daily_needs_required=daily_needs_required,
        baseline_daily_spend=round(baseline_daily_spend, 2),
        runway_days=runway_days,
        safe_to_spend=safe_to_spend,
        safe_to_spend_bank_only=safe_to_spend_bank_only,
        safe_to_save=safe_to_save,
        safe_to_invest=safe_to_invest,
        shortfall_amount=shortfall_amount,
        shortfall_amount_bank_only=shortfall_amount_bank_only,
        confidence=confidence,
        explanations=explanations,
        watchouts=watchouts,
        protected_due_items=protected_due_items,
        pending_pattern_dues=pending_pattern_dues,
    )
