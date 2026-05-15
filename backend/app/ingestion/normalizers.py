from __future__ import annotations

import re
from datetime import date, datetime, timedelta
from decimal import Decimal, InvalidOperation


FIXED_OBLIGATION_KEYWORDS = {
    "rent": ("expense_home", None, True),
    "emi": ("expense_loan_payment", None, True),
    "electricity": ("expense_bill", None, True),
    "school": ("expense_school", None, True),
    "fees": ("expense_school", None, True),
    "medicine": ("expense_medicine", None, False),
    "loan": ("expense_loan_payment", None, True),
}

COUNTERPARTY_NOISE = {
    "upi",
    "dr",
    "cr",
    "neft",
    "imps",
    "pos",
    "txn",
    "ref",
}


def normalize_date(value: object) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, (int, float)) and 20000 < float(value) < 60000:
        excel_epoch = date(1899, 12, 30)
        return excel_epoch + timedelta(days=int(float(value)))

    text = str(value).strip()
    if not text:
        return None

    formats = [
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%d/%m/%Y",
        "%d.%m.%Y",
        "%d.%m.%y",
        "%d %b %Y",
        "%d %b %y",
        "%Y/%m/%d",
        "%d %b %Y",
        "%d-%b-%y",
        "%d-%m-%y",
        "%d-%m-%Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
    ]
    for fmt in formats:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def parse_amount(value: object) -> Decimal | None:
    if value is None or value == "":
        return None
    if isinstance(value, (int, float, Decimal)):
        return Decimal(str(value))

    text = str(value).strip()
    if not text:
        return None

    lowered_text = text.lower()
    negative = text.startswith("(") and text.endswith(")")
    cleaned = (
        text.replace("₹", "")
        .replace("rs.", "")
        .replace("rs", "")
        .replace("inr", "")
        .replace(",", "")
        .replace("CR", "")
        .replace("DR", "")
        .replace("Cr.", "")
        .replace("Dr.", "")
        .replace("cr.", "")
        .replace("dr.", "")
        .replace("cr", "")
        .replace("dr", "")
        .strip()
    )
    cleaned = cleaned.strip("()")
    try:
        amount = Decimal(cleaned)
    except InvalidOperation:
        return None
    if negative or " dr" in lowered_text or lowered_text.endswith("dr.") or lowered_text.endswith("dr"):
        return -amount
    if " cr" in lowered_text or lowered_text.endswith("cr.") or lowered_text.endswith("cr"):
        return amount
    return -amount if negative else amount


def clean_description(value: object) -> str:
    text = str(value or "").strip().lower()
    text = re.sub(r"[/_-]+", " ", text)
    text = re.sub(r"\b\d{5,}\b", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def extract_counterparty(description_clean: str) -> str | None:
    tokens = [token for token in description_clean.split() if token not in COUNTERPARTY_NOISE and not token.isdigit()]
    if not tokens:
        return None
    return " ".join(tokens[:4]).strip() or None


def extract_upi_merchant(description_raw: str) -> str | None:
    """
    Extract merchant from UPI transactions.
    Handles both SBI and ICICI formats with PDF line-wrapping.

    SBI format: UPI/DR|CR/<ref>/<merchant> or UPI/DR/<ref>/<merchant>/...
    ICICI format: UPI/<merchant>/<handle>/<bank_info>...
    """
    if not description_raw:
        return None

    # Normalize: collapse multiple whitespace/newlines into single space
    normalized = " ".join(description_raw.split())
    normalized_lower = normalized.lower()

    # Try SBI format: UPI/DR|CR/digits/merchant (merchant ends at / or becomes last part)
    match = re.search(r'upi/(?:dr|cr)/\d+/([^/]+?)(?:/|$)', normalized_lower, re.IGNORECASE)
    if match:
        merchant = match.group(1).strip()
        if merchant and not re.fullmatch(r'[\d\s]+', merchant):
            return merchant

    # Try ICICI format: UPI/merchant/handle/... (merchant is 2nd part before next /)
    match = re.search(r'upi/([^/]+?)/[^/]+/(?:upi|hdfc|union|icici|axis|sbi|bank)?', normalized_lower, re.IGNORECASE)
    if match:
        potential_merchant = match.group(1).strip()
        # Reject if it looks like a transaction code (all digits or very short)
        if (potential_merchant
            and not re.fullmatch(r'[\d\s]+', potential_merchant)
            and len(potential_merchant) > 2):
            return potential_merchant

    return None


def infer_category(description_clean: str) -> tuple[str | None, str | None, bool]:
    for keyword, result in FIXED_OBLIGATION_KEYWORDS.items():
        if keyword in description_clean:
            return result
    return (None, None, False)


def normalize_direction(
    raw_row: dict,
    mapping: dict[str, str],
    amount_value: Decimal | None,
) -> tuple[str | None, Decimal | None]:
    debit_key = mapping.get("debit")
    credit_key = mapping.get("credit")
    direction_key = mapping.get("direction")

    if debit_key and parse_amount(raw_row.get(debit_key)) not in (None, Decimal("0")):
        debit_amount = parse_amount(raw_row.get(debit_key))
        return "debit", abs(debit_amount) if debit_amount is not None else None
    if credit_key and parse_amount(raw_row.get(credit_key)) not in (None, Decimal("0")):
        credit_amount = parse_amount(raw_row.get(credit_key))
        return "credit", abs(credit_amount) if credit_amount is not None else None
    if direction_key:
        direction_text = str(raw_row.get(direction_key, "")).strip().lower()
        if direction_text in {"debit", "dr", "paid", "payment", "sent", "withdrawal", "withdrawn"}:
            return "debit", abs(amount_value) if amount_value is not None else None
        if direction_text in {"credit", "cr", "received", "receive", "deposit", "credited"}:
            return "credit", abs(amount_value) if amount_value is not None else None
    amount_source_value = None
    if mapping.get("amount"):
        amount_source_value = str(raw_row.get(mapping.get("amount", ""), "")).strip().lower()
    if amount_source_value:
        if amount_source_value.endswith("dr.") or amount_source_value.endswith("dr") or " dr" in amount_source_value:
            return "debit", abs(amount_value) if amount_value is not None else None
        if amount_source_value.endswith("cr.") or amount_source_value.endswith("cr") or " cr" in amount_source_value:
            return "credit", abs(amount_value) if amount_value is not None else None
    if amount_value is not None:
        if amount_value < 0:
            return "debit", abs(amount_value)
        return "credit", abs(amount_value)
    return (None, None)
