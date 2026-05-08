from collections.abc import Iterable

from app.ingestion.detectors import normalize_header_name


HEADER_SYNONYMS = {
    "transaction_date": {
        "date",
        "txn date",
        "transaction date",
        "transaction date/time",
        "value date",
        "created date",
    },
    "posted_date": {"posted date", "post date", "settlement date"},
    "description": {
        "description",
        "narration",
        "remarks",
        "details",
        "merchant",
        "activity",
        "transaction details",
        "transaction reference",
        "particulars",
    },
    "amount": {
        "amount",
        "txn amount",
        "transaction amount",
        "amount in inr",
        "amount (inr)",
        "amount inr",
        "amount rs",
        "amount (rs.)",
        "paid amount",
        "received amount",
        "value",
    },
    "debit": {
        "debit",
        "withdrawal",
        "withdrawal amt",
        "withdrawal amt.",
        "withdrawal amount",
        "withdrawal amount inr",
        "debit amount",
        "paid amount",
    },
    "credit": {
        "credit",
        "deposit",
        "deposit amt",
        "deposit amt.",
        "deposit amount",
        "deposit amount inr",
        "credit amount",
        "received amount",
    },
    "direction": {"type", "dr cr", "cr dr", "transaction type", "txn type", "payment type", "nature"},
    "currency": {"currency", "curr"},
}


def map_columns(headers: Iterable[str]) -> dict[str, str]:
    normalized_to_original = {normalize_header_name(header): header for header in headers if header}
    mapping: dict[str, str] = {}
    for target, synonyms in HEADER_SYNONYMS.items():
        for synonym in synonyms:
            if synonym in normalized_to_original:
                mapping[target] = normalized_to_original[synonym]
                break

    normalized_headers = list(normalized_to_original.keys())

    if "amount" not in mapping:
        for header in normalized_headers:
            if "amount" in header and "balance" not in header:
                mapping["amount"] = normalized_to_original[header]
                break

    if "direction" not in mapping:
        for header in normalized_headers:
            if any(token in header for token in {"type", "dr", "cr", "nature", "payment"}):
                mapping["direction"] = normalized_to_original[header]
                break

    if "description" not in mapping:
        for header in normalized_headers:
            if any(token in header for token in {"narration", "description", "details", "remarks", "merchant", "particular"}):
                mapping["description"] = normalized_to_original[header]
                break

    if "transaction_date" not in mapping:
        for header in normalized_headers:
            if "date" in header and "posted" not in header:
                mapping["transaction_date"] = normalized_to_original[header]
                break

    return mapping
