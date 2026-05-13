import re

from sqlalchemy.orm import Session

from app.categorization.cleaners import clean_merchant_name
from app.categorization.config import load_categorization_rules
from app.categorization.merchant_classifier import (
    classify_merchant,
    detect_payment_gateway_purpose,
    detect_person_name_transfer,
)
from app.categorization.recurring import detect_recurring
from app.categorization.types import CategorizationInput, CategorizationResult


def _keywords_match(text: str, keywords: list[str]) -> bool:
    return any(keyword.lower() in text for keyword in keywords)


def _apply_structured_rules(payload: CategorizationInput, rules: dict) -> tuple[str | None, float, bool, list[str]]:
    traces: list[str] = []
    description = payload.description_clean.lower()
    for rule in rules.get("structured_rules", []):
        when = rule.get("when", {})
        direction_ok = when.get("direction") in (None, payload.direction)
        keywords_ok = _keywords_match(description, when.get("description_keywords", []))
        if direction_ok and keywords_ok:
            traces.append(f"structured:{rule['id']}")
            return rule["category"], float(rule["confidence"]), bool(rule.get("is_fixed_obligation", False)), traces
    return None, 0.0, False, traces


def _apply_merchant_rules(merchant: str, rules: dict) -> tuple[str | None, str | None, float, list[str]]:
    traces: list[str] = []
    for category, config in rules.get("merchant_rules", {}).items():
        for known_merchant in config.get("merchants", []):
            if known_merchant in merchant:
                traces.append(f"merchant:{known_merchant}")
                return category, config.get("merchant_group"), float(config.get("confidence", 0.0)), traces
    return None, None, 0.0, traces


def _apply_smart_merchant_classification(
    merchant: str, description_clean: str, is_recurring: bool, amount: float = 0.0
) -> tuple[str | None, float, bool, list[str]]:
    """
    Apply smart merchant brand classification.
    Handles: quick commerce, food delivery, investment platforms, payment gateways, etc.
    """
    traces: list[str] = []
    if not merchant:
        return None, 0.0, False, traces

    merchant_lower = merchant.lower()

    # Step 1: Check if it's a known brand type
    classification = classify_merchant(merchant_lower)
    if classification.category:
        traces.append(f"smart_merchant:{classification.brand_type}:{classification.merchant_match}")
        return classification.category, classification.confidence, False, traces

    # Step 2: Check if it's a payment gateway (needs deeper inspection)
    if any(gw in merchant_lower for gw in ["paytm", "google pay", "phonpe", "whatsapp", "airtel"]):
        category, confidence = detect_payment_gateway_purpose(merchant_lower, description_clean)
        if category:
            traces.append(f"smart_gateway:{merchant_lower}:{category}")
            return category, confidence, False, traces
        # If we can't determine purpose, mark as transfer (safe default)
        traces.append(f"smart_gateway:{merchant_lower}:unresolved")
        return "transfers", 0.50, False, traces

    # Step 3: Check if it's a person's name (for rent or P2P detection)
    # Heuristic: if merchant is 1-2 words, all alphabetic, and NOT a known brand component
    merchant_tokens = merchant_lower.split()
    known_non_names = {"card", "bank", "payment", "payments", "digital", "money", "credit", "debit"}
    has_non_name_token = any(token in known_non_names for token in merchant_tokens)
    is_person_name = (
        len(merchant_tokens) <= 2
        and all(token.isalpha() for token in merchant_tokens)
        and not has_non_name_token
    )

    if is_person_name:
        category, confidence, is_fixed = detect_person_name_transfer(merchant_lower, amount, is_recurring, description_clean)
        if category:
            traces.append(f"smart_person:{merchant_lower}:{category}")
            return category, confidence, is_fixed, traces

    return None, 0.0, False, traces


def _apply_keyword_rules(description: str, rules: dict) -> tuple[str | None, float, list[str]]:
    traces: list[str] = []
    for category, config in rules.get("keyword_rules", {}).items():
        if _keywords_match(description, config.get("keywords", [])):
            traces.append(f"keyword:{category}")
            return category, float(config.get("confidence", 0.0)), traces
    return None, 0.0, traces


def _apply_regex_rules(description: str, rules: dict) -> tuple[str | None, float, bool, list[str]]:
    traces: list[str] = []
    for rule in rules.get("regex_rules", []):
        pattern = rule.get("pattern")
        if pattern and re.search(pattern, description):
            traces.append(f"regex:{rule['id']}")
            return rule["category"], float(rule["confidence"]), bool(rule.get("is_fixed_obligation", False)), traces
    return None, 0.0, False, traces


def _apply_transfer_rules(description: str, rules: dict) -> tuple[str | None, float, list[str]]:
    traces: list[str] = []
    config = rules.get("transfer_rules", {})
    if _keywords_match(description, config.get("keywords", [])):
        traces.append("transfer_rules")
        return "transfers", float(config.get("confidence", 0.95)), traces
    return None, 0.0, traces


def categorize_transaction(
    db: Session,
    *,
    payload: CategorizationInput,
    transaction_date,
) -> CategorizationResult:
    rules = load_categorization_rules()
    description = payload.description_clean.lower()
    merchant = clean_merchant_name(payload.counterparty, payload.description_clean)

    candidates: list[tuple[str, str | None, float, bool, str]] = []
    traces: list[str] = []

    category, confidence, is_fixed_obligation, rule_trace = _apply_structured_rules(payload, rules)
    traces.extend(rule_trace)
    if category:
        candidates.append((category, None, confidence, is_fixed_obligation, "structured"))

    # Try smart merchant classification first (handles UPI brands, payment gateways, person names)
    is_recurring_tentative = False  # Will be computed later after other rules
    category, confidence, is_fixed_obligation, rule_trace = _apply_smart_merchant_classification(
        merchant, description, is_recurring_tentative, amount=payload.amount
    )
    traces.extend(rule_trace)
    if category:
        candidates.append((category, None, confidence, is_fixed_obligation, "smart_merchant"))

    category, subcategory, confidence, rule_trace = _apply_merchant_rules(merchant, rules)
    traces.extend(rule_trace)
    if category:
        candidates.append((category, subcategory, confidence, False, "merchant"))

    category, confidence, is_fixed_obligation, rule_trace = _apply_regex_rules(description, rules)
    traces.extend(rule_trace)
    if category:
        candidates.append((category, None, confidence, is_fixed_obligation, "regex"))

    category, confidence, rule_trace = _apply_transfer_rules(description, rules)
    traces.extend(rule_trace)
    if category:
        candidates.append((category, None, confidence, False, "transfer"))

    category, confidence, rule_trace = _apply_keyword_rules(description, rules)
    traces.extend(rule_trace)
    if category:
        candidates.append((category, None, confidence, False, "keyword"))

    candidate_categories = [candidate[0] for candidate in candidates]
    conflicting_categories = len(set(candidate_categories)) > 1

    if candidates:
        best_category, best_subcategory, best_confidence, fixed_from_rule, best_source = sorted(
            candidates, key=lambda item: item[2], reverse=True
        )[0]
    else:
        best_category, best_subcategory, best_confidence, fixed_from_rule = ("uncategorized", None, 0.0, False)
        best_source = None

    # Only penalize conflicts if best match is NOT from smart_merchant with high confidence
    actual_conflict = False
    if conflicting_categories:
        if best_source == "smart_merchant" and best_confidence >= 0.90:
            traces.append("conflict:ignored_for_high_confidence_smart_merchant")
        else:
            best_confidence = max(0.0, best_confidence - 0.20)
            traces.append("conflict:multiple_categories")
            actual_conflict = True

    is_recurring = detect_recurring(
        db,
        user_id=payload.user_id,
        transaction_date=transaction_date,
        amount=payload.amount,
        description_clean=payload.description_clean,
        counterparty=merchant,
        config=rules.get("recurring_detection", {}),
    )
    if is_recurring:
        best_confidence = min(1.0, best_confidence + 0.05)
        traces.append("overlay:recurring")

    strong_categories = set(rules.get("fixed_obligation_detection", {}).get("strong_categories", []))
    fixed_keywords = rules.get("fixed_obligation_detection", {}).get("keyword_overrides", [])
    keyword_fixed = _keywords_match(description, fixed_keywords)
    is_fixed_obligation = fixed_from_rule or best_category in strong_categories or keyword_fixed
    if is_fixed_obligation:
        traces.append("overlay:fixed_obligation")

    unresolved_below = float(rules.get("confidence_thresholds", {}).get("unresolved_below", 0.50))
    empty_description = not payload.description_clean.strip()
    unresolved = best_confidence < unresolved_below or actual_conflict or empty_description

    final_category = best_category if not unresolved else rules.get("default_category", "uncategorized")
    return CategorizationResult(
        category=final_category,
        subcategory=best_subcategory,
        confidence_score=best_confidence,
        is_recurring=is_recurring,
        is_fixed_obligation=is_fixed_obligation,
        unresolved=unresolved,
        candidate_categories=sorted(set(candidate_categories)),
        rule_trace=traces,
    )
