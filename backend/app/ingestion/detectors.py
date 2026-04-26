from collections.abc import Iterable


import re


def normalize_header_name(value: str) -> str:
    lowered = (value or "").strip().lower().replace("_", " ").replace("-", " ")
    lowered = re.sub(r"[\(\)\[\]\.`,:;/]+", " ", lowered)
    return " ".join(lowered.split())


def detect_source(file_name: str, headers: Iterable[str], sheet_names: Iterable[str] | None = None) -> tuple[str, str]:
    normalized_headers = {normalize_header_name(header) for header in headers}
    lowered_name = (file_name or "").lower()
    normalized_sheets = {normalize_header_name(sheet) for sheet in (sheet_names or [])}

    if "paytm" in lowered_name or "wallet" in lowered_name or "wallet" in normalized_headers:
        return ("wallet_export_like", "wallet")
    if "card" in lowered_name or "card number" in normalized_headers or "merchant" in normalized_headers:
        return ("generic_card_like", "card")
    if "withdrawal amt." in normalized_headers or "deposit amt." in normalized_headers:
        return ("hdfc_bank_like", "bank")
    if {"transaction date", "value date", "narration"} & normalized_headers:
        return ("generic_bank_like", "bank")
    if {"statement", "transactions"} & normalized_sheets:
        return ("generic_bank_like", "bank")
    return ("unknown_source", "other")
