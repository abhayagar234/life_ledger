import re


MERCHANT_ALIAS_REWRITES = {
    "amazon pay": "amazon",
    "apollo pharmacy": "apollo",
    "dmart ready": "dmart",
}

NOISE_TOKENS = {
    "upi",
    "dr",
    "cr",
    "neft",
    "imps",
    "pos",
    "txn",
    "ref",
    "to",
}


def clean_merchant_name(counterparty: str | None, description_clean: str) -> str:
    base = (counterparty or description_clean or "").strip().lower()
    base = re.sub(r"\b\d{4,}\b", " ", base)
    base = re.sub(r"\s+", " ", base).strip()
    tokens = [token for token in base.split() if token not in NOISE_TOKENS]
    merchant = " ".join(tokens[:4]).strip()
    for source_value, normalized in MERCHANT_ALIAS_REWRITES.items():
        if source_value in merchant:
            return normalized
    return merchant
