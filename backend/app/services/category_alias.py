from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session

from app.models.normalized_transaction import NormalizedTransaction
from app.models.user_category_alias import UserCategoryAlias

_SPACE_RE = re.compile(r"\s+")
_NON_ALNUM_RE = re.compile(r"[^a-z0-9 ]+")


def normalize_merchant_key(value: str | None) -> str:
    if not value:
        return ""
    lowered = value.strip().lower()
    cleaned = _NON_ALNUM_RE.sub(" ", lowered)
    compact = _SPACE_RE.sub(" ", cleaned).strip()
    return compact[:180]


def get_user_alias_lookup(db: Session, user_id: str) -> dict[str, str]:
    try:
        rows = db.query(UserCategoryAlias).filter(UserCategoryAlias.user_id == user_id).all()
    except OperationalError:
        # Fresh/older DB may not have alias table yet; keep ingestion working.
        return {}
    return {row.merchant_key: row.category_code for row in rows if row.merchant_key}


def match_alias_category(
    alias_lookup: dict[str, str],
    *,
    counterparty_name: str | None,
    description_clean: str | None,
) -> str | None:
    if not alias_lookup:
        return None

    counterparty_key = normalize_merchant_key(counterparty_name)
    if counterparty_key and counterparty_key in alias_lookup:
        return alias_lookup[counterparty_key]

    description_key = normalize_merchant_key(description_clean)
    if not description_key:
        return None

    for merchant_key, category_code in alias_lookup.items():
        if not merchant_key:
            continue
        if merchant_key in description_key:
            return category_code
    return None


@dataclass
class CategoryMappingInput:
    merchant_key: str
    merchant_label: str
    category_code: str


def upsert_user_category_aliases(db: Session, user_id: str, mappings: list[CategoryMappingInput]) -> int:
    saved = 0
    for mapping in mappings:
        merchant_key = normalize_merchant_key(mapping.merchant_key)
        if not merchant_key:
            continue
        try:
            existing = (
                db.query(UserCategoryAlias)
                .filter(
                    UserCategoryAlias.user_id == user_id,
                    UserCategoryAlias.merchant_key == merchant_key,
                )
                .first()
            )
        except OperationalError:
            return 0
        if existing:
            existing.category_code = mapping.category_code
            existing.merchant_label = mapping.merchant_label or existing.merchant_label
        else:
            db.add(
                UserCategoryAlias(
                    user_id=user_id,
                    merchant_key=merchant_key,
                    merchant_label=mapping.merchant_label or merchant_key,
                    category_code=mapping.category_code,
                )
            )
        saved += 1
    return saved


def apply_aliases_to_uncategorized_transactions(db: Session, user_id: str) -> int:
    alias_lookup = get_user_alias_lookup(db, user_id)
    if not alias_lookup:
        return 0

    rows = (
        db.query(NormalizedTransaction)
        .filter(
            NormalizedTransaction.user_id == user_id,
            NormalizedTransaction.direction == "debit",
            NormalizedTransaction.category_code == "uncategorized",
            NormalizedTransaction.dedupe_status != "duplicate",
        )
        .all()
    )

    updated = 0
    for row in rows:
        category_code = match_alias_category(
            alias_lookup,
            counterparty_name=row.counterparty_name,
            description_clean=row.description_clean,
        )
        if not category_code:
            continue
        row.category_code = category_code
        row.subcategory_code = None
        row.review_status = "accepted"
        row.confidence_score = max(float(row.confidence_score or 0), 0.92)
        updated += 1
    return updated
