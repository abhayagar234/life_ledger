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

MERCHANT_NOISE_TOKENS = {
    "upi",
    "dr",
    "cr",
    "paymenttou",
    "payment",
    "paytm",
    "hdfc",
    "icici",
    "axis",
    "sbi",
    "yes",
    "bank",
    "indusind",
    "l",
    "p",
    "b",
    "in",
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

    def _clean_candidate(candidate: str) -> str | None:
        text = " ".join((candidate or "").lower().split())
        if not text:
            return None
        text = re.sub(r"[^a-z0-9\s]", " ", text)
        parts = []
        for token in text.split():
            if token in MERCHANT_NOISE_TOKENS:
                continue
            if token.isdigit():
                continue
            if len(token) == 1:
                continue
            # Remove obvious hash/reference tokens.
            if re.fullmatch(r"[a-f0-9]{8,}", token):
                continue
            parts.append(token)
        if not parts:
            return None
        # Keep enough tokens for real merchant names.
        merchant = " ".join(parts[:5]).strip()
        if len(merchant) < 3:
            return None
        return merchant

    # Normalize: collapse multiple whitespace/newlines but keep separators
    normalized = " ".join(description_raw.split())
    normalized_lower = normalized.lower()

    # Parse UPI path fragments; first human-readable fragment after UPI is usually merchant.
    path_match = re.search(r"upi/([^\\n]+)", normalized_lower, re.IGNORECASE)
    if path_match:
        tail = path_match.group(1)
        fragments = [frag.strip() for frag in tail.split("/") if frag.strip()]
        for fragment in fragments:
            # Skip direction/ref/id fragments.
            if fragment in {"dr", "cr"}:
                continue
            if re.fullmatch(r"[0-9a-z\.\-@_]{8,}", fragment):
                continue
            cleaned = _clean_candidate(fragment)
            if cleaned:
                return cleaned

    # SBI style fallback: UPI/DR|CR/<ref>/<merchant>
    match = re.search(r'upi/(?:dr|cr)/\d+/([^/]+?)(?:/|$)', normalized_lower, re.IGNORECASE)
    if match:
        cleaned = _clean_candidate(match.group(1))
        if cleaned:
            return cleaned

    # Generic fallback: UPI/<merchant>/<handle>/...
    match = re.search(r'upi/([^/]+?)/[^/]+/', normalized_lower, re.IGNORECASE)
    if match:
        cleaned = _clean_candidate(match.group(1))
        if cleaned:
            return cleaned

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
