from __future__ import annotations

from calendar import monthrange
from collections import defaultdict
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.emi_payment import EMIPayment
from app.models.financial_profile import FinancialProfile
from app.models.ledger_entry import LedgerEntry
from app.models.normalized_transaction import NormalizedTransaction
from app.schemas.cashflow import CashflowSummaryResponse


ESSENTIAL_CATEGORIES = {"groceries", "health", "travel", "bills", "rent", "emi_loans", "farming_expense", "education"}
NON_SPEND_CATEGORIES = {"transfers"}
SAVINGS_CATEGORIES = {"savings_investments"}
FIXED_DUE_CATEGORIES = {"rent", "emi_loans", "bills", "subscriptions", "insurance"}


def _round_money(value: float) -> float:
    return round(max(value, 0.0), 2)


def _fmt_money(value: float) -> str:
    return f"Rs {round(value):,}"


def _format_date_label(value: date | None) -> str:
    return value.strftime("%b %d") if value else "the next income"


def _end_of_month(day: date) -> date:
    return date(day.year, day.month, monthrange(day.year, day.month)[1])


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
    if profile and profile.salary_day_of_month:
        same_month = _safe_date_for_day(as_of, profile.salary_day_of_month)
        if same_month >= as_of:
            return same_month, "high"
        next_month = _next_month(as_of)
        return _safe_date_for_day(next_month, profile.salary_day_of_month), "high"

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
    if profile and profile.salary_day_of_month:
        candidate = _safe_date_for_day(as_of, profile.salary_day_of_month)
        return candidate if candidate <= as_of else _safe_date_for_day(_previous_month(as_of), profile.salary_day_of_month)

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


def _manual_due_payments(db: Session, user_id: str, cycle_start: date, as_of: date) -> float:
    entries = (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.user_id == user_id,
            LedgerEntry.entry_type == "emi_payment",
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
            if category in ESSENTIAL_CATEGORIES:
                trailing_essential += amount

    return round(trailing_total, 2), round(trailing_essential, 2)


def _fixed_due_estimate(rows: list[NormalizedTransaction], as_of: date, horizon_days: int) -> tuple[float, list[str]]:
    horizon_end = as_of + timedelta(days=horizon_days)
    grouped: dict[str, list[NormalizedTransaction]] = defaultdict(list)
    for row in rows:
        if row.direction != "debit":
            continue
        if row.category_code not in FIXED_DUE_CATEGORIES and not row.is_fixed_obligation:
            continue
        key = row.counterparty_name or row.description_clean or row.category_code or "due"
        grouped[key].append(row)

    due_total = 0.0
    labels: list[str] = []
    for key, group in grouped.items():
        group.sort(key=lambda row: row.transaction_date, reverse=True)
        latest = group[0]
        if len(group) >= 2:
            last_day = group[0].transaction_date.day
            prev_day = group[1].transaction_date.day
            target_day = round((last_day + prev_day) / 2)
        else:
            target_day = latest.transaction_date.day

        candidate = _safe_date_for_day(as_of, target_day)
        if candidate < as_of:
            candidate = _safe_date_for_day(_next_month(as_of), target_day)

        if as_of <= candidate <= horizon_end:
            amount = float(latest.amount)
            due_total += amount
            label = latest.category_code.replace("_", " ") if latest.category_code else "fixed due"
            labels.append(label)

    return due_total, sorted(set(labels))


def build_cashflow_summary(db: Session, user_id: str, as_of: date | None = None) -> CashflowSummaryResponse:
    as_of_date = as_of or date.today()
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

    if not rows:
        return CashflowSummaryResponse(
            as_of_date=as_of_date,
            status="needs_data",
            headline="Start with a statement, then protect cash clearly.",
            plain_summary="Bring one bank or UPI CSV first, then add any important cash on hand. We will help you protect the next few days calmly.",
            safe_till_date=None,
            next_income_date=None,
            effective_available_money=0,
            liquid_balance=0,
            cash_on_hand=0,
            upcoming_dues_total=0,
            daily_needs_buffer=0,
            daily_needs_required=0,
            baseline_daily_spend=0,
            runway_days=None,
            safe_to_spend=0,
            safe_to_save=0,
            safe_to_invest=0,
            shortfall_amount=0,
            confidence="low",
            explanations=[
                "We need imported statement history before we can estimate your next income and upcoming dues.",
            ],
            watchouts=["Bring one statement first, then keep only the cash updates that matter."],
        )

    cycle_start = _cycle_start_date(profile, rows, as_of_date)
    bank_observed_balance = 0.0
    trailing_essential_spend = 0.0
    trailing_total_spend = 0.0

    trailing_start = as_of_date - timedelta(days=30)
    for row in rows:
        amount = float(row.amount)
        category = row.category_code or ""
        is_bank_like = row.source_type != "credit_card"
        in_current_cycle = row.transaction_date >= cycle_start

        if row.direction == "credit":
            if in_current_cycle and category not in NON_SPEND_CATEGORIES and is_bank_like:
                bank_observed_balance += amount
            continue

        if category in NON_SPEND_CATEGORIES:
            continue
        if in_current_cycle and is_bank_like:
            bank_observed_balance -= amount

        if row.transaction_date < trailing_start:
            continue

        if category not in SAVINGS_CATEGORIES:
            trailing_total_spend += amount
        if category in ESSENTIAL_CATEGORIES:
            trailing_essential_spend += amount

    bank_observed_balance += _manual_bank_activity(db, user_id, cycle_start, as_of_date)
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
    emi_due_total = sum(
        float(emi.amount_due) - float(emi.amount_paid)
        for emi in db.query(EMIPayment)
        .filter(
            EMIPayment.user_id == user_id,
            EMIPayment.status != "paid",
            EMIPayment.due_date >= as_of_date,
            EMIPayment.due_date <= next_income_date,
        )
        .all()
    )
    pattern_due_total, due_labels = _fixed_due_estimate(rows, as_of_date, days_until_income)
    manual_card_due_total = _manual_card_due_activity(db, user_id, cycle_start, as_of_date)
    gross_protected_dues = max(emi_due_total, 0.0) + pattern_due_total + manual_card_due_total
    manual_due_paid_total = _manual_due_payments(db, user_id, cycle_start, as_of_date)
    protected_dues = _round_money(gross_protected_dues - manual_due_paid_total)

    baseline_daily_spend = round(trailing_essential_spend / 30, 2) if trailing_essential_spend > 0 else 0.0
    if baseline_daily_spend == 0 and trailing_total_spend > 0:
        baseline_daily_spend = round((trailing_total_spend * 0.55) / 30, 2)

    effective_available_money = _round_money(bank_observed_balance + manual_cash - protected_dues)
    spend_needed_until_income = round(baseline_daily_spend * days_until_income, 2)
    daily_needs_required = round(spend_needed_until_income, 2)
    daily_needs_buffer = round(min(effective_available_money, daily_needs_required), 2)
    safe_leftover = round(effective_available_money - daily_needs_required, 2)
    shortfall_amount = _round_money(daily_needs_required - effective_available_money)

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

    safe_to_spend = _round_money(safe_leftover)
    safe_to_save = _round_money(safe_leftover - uncertainty_buffer)
    safe_to_invest = _round_money(safe_to_save - max(500.0, uncertainty_buffer * 0.5) if safe_to_save > 0 else 0.0)

    next_income_label = _format_date_label(next_income_date)

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
    if next_income_date:
        explanations.append(f"The next income is estimated around {next_income_date.strftime('%b %d')}.")
    explanations.append("Bank money here means money seen in this income cycle from imported statement activity, not a live bank balance.")

    watchouts: list[str] = []
    if due_labels:
        watchouts.append(f"Keep aside money for {', '.join(due_labels[:3])} first.")
    if safe_to_spend <= 0:
        watchouts.append(f"Protect essentials till {next_income_label}. Avoid big spends this week.")
    elif status == "tight":
        watchouts.append(f"Money is getting tight till {next_income_label}. Slow optional spending for a few days.")
    elif safe_to_invest == 0:
        watchouts.append("Keep money flexible for now. Savings are safer than locking money away this week.")
    if confidence != "high":
        watchouts.append("This answer is still an estimate. Keep a little extra buffer this week.")
    if not watchouts:
        watchouts.append(f"You're steady till {next_income_label}. Keep dues protected and avoid unnecessary big spends.")

    return CashflowSummaryResponse(
        as_of_date=as_of_date,
        status=status,
        headline=headline,
        plain_summary=plain_summary,
        safe_till_date=safe_till_date,
        next_income_date=next_income_date,
        effective_available_money=effective_available_money,
        liquid_balance=round(bank_observed_balance, 2),
        cash_on_hand=round(manual_cash, 2),
        upcoming_dues_total=round(protected_dues, 2),
        daily_needs_buffer=daily_needs_buffer,
        daily_needs_required=daily_needs_required,
        baseline_daily_spend=round(baseline_daily_spend, 2),
        runway_days=runway_days,
        safe_to_spend=safe_to_spend,
        safe_to_save=safe_to_save,
        safe_to_invest=safe_to_invest,
        shortfall_amount=shortfall_amount,
        confidence=confidence,
        explanations=explanations,
        watchouts=watchouts,
    )
