from collections.abc import Iterable
import re


def normalize_header_name(value: str) -> str:
    lowered = (value or "").strip().lower().replace("_", " ").replace("-", " ")
    lowered = re.sub(r"[\(\)\[\]\.`,:;/]+", " ", lowered)
    return " ".join(lowered.split())


def detect_source(
    file_name: str,
    headers: Iterable[str],
    sheet_names: Iterable[str] | None = None,
    bank_hint: str | None = None,
) -> tuple[str, str]:
    normalized_headers = {normalize_header_name(header) for header in headers}
    lowered_name = (file_name or "").lower()
    normalized_sheets = {normalize_header_name(sheet) for sheet in (sheet_names or [])}

    if bank_hint:
        normalized_hint = normalize_header_name(bank_hint)
        if "state bank" in normalized_hint or normalized_hint == "sbi":
            return ("sbi_bank_like", "bank")
        if "hdfc" in normalized_hint:
            return ("hdfc_bank_like", "bank")
        if "icici" in normalized_hint:
            return ("icici_bank_like", "bank")
        if "axis" in normalized_hint:
            return ("axis_bank_like", "bank")
        if "kotak" in normalized_hint:
            return ("kotak_bank_like", "bank")

    if "paytm" in lowered_name or "wallet" in lowered_name or "wallet" in normalized_headers:
        return ("wallet_export_like", "wallet")
    if "card" in lowered_name or "card number" in normalized_headers or "merchant" in normalized_headers:
        return ("generic_card_like", "card")
    if {"transaction details", "amount (inr)"} & normalized_headers:
        return ("icici_card_like", "card")
    if "withdrawal amt." in normalized_headers or "deposit amt." in normalized_headers:
        return ("hdfc_bank_like", "bank")
    if {"transaction date", "transaction remarks", "debit amount", "credit amount"} <= normalized_headers:
        return ("icici_bank_like", "bank")
    if {"tran date", "particulars"} & normalized_headers:
        return ("axis_bank_like", "bank")
    if {"date", "debit", "credit"} & normalized_headers and "transaction reference" in normalized_headers:
        return ("sbi_bank_like", "bank")
    if {"txn date", "description", "debit", "credit"} <= normalized_headers:
        return ("sbi_bank_like", "bank")
    if {"narration", "debit", "credit"} & normalized_headers and "withdrawal amt." not in normalized_headers:
        return ("kotak_bank_like", "bank")
    if {"transaction date", "value date", "narration"} & normalized_headers:
        return ("generic_bank_like", "bank")
    if {"statement", "transactions"} & normalized_sheets:
        return ("generic_bank_like", "bank")
    return ("unknown_source", "other")
