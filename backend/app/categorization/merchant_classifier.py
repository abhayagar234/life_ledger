"""
Smart merchant brand classifier for UPI and other payment modes.
Classifies merchants by brand type and applies category + confidence.
"""
import re
from dataclasses import dataclass


@dataclass
class MerchantClassification:
    category: str | None
    confidence: float
    brand_type: str | None
    merchant_match: str | None


# Primary merchants that should take precedence over others
PRIMARY_MERCHANTS = {
    "swiggy",
    "zomato",
    "uber",
    "amazon",
    "flipkart",
    "zerodha",
    "paytm",
}


BRAND_TYPE_RULES = {
    "quick_commerce": {
        "category": "groceries",
        "confidence": 0.95,
        "patterns": ["zepto", "instamart", "blinkit", "amazon fresh", "jiomart", "dmart", "bigbasket"],
    },
    "food_delivery": {
        "category": "dining",
        "confidence": 0.95,
        "patterns": ["zomato", "swiggy", "uber eats", "magicpin", "faasos", "dominos"],
    },
    "online_shopping": {
        "category": "shopping",
        "confidence": 0.93,
        "patterns": ["amazon", "flipkart", "myntra", "ajio", "nykaa", "unacademy", "ebay"],
    },
    "health_pharmacy": {
        "category": "health",
        "confidence": 0.90,
        "patterns": ["apollo", "medplus", "netmeds", "practo", "1mg", "pharmeasy"],
    },
    "entertainment": {
        "category": "entertainment",
        "confidence": 0.90,
        "patterns": ["bookmyshow", "pvr", "inox", "paytm movies"],
    },
    "subscriptions": {
        "category": "subscriptions",
        "confidence": 0.90,
        "patterns": ["netflix", "spotify", "youtube premium", "hotstar", "prime video", "disney"],
    },
    "travel_transport": {
        "category": "travel",
        "confidence": 0.90,
        "patterns": ["uber", "ola", "rapido", "irctc", "makemytrip", "goibibo", "air", "flight"],
    },
    "investment_platform": {
        "category": "savings_investments",
        "confidence": 0.95,
        "patterns": ["zerodha", "paytm money", "groww", "upstox", "smallcase", "kuvera", "sbicap", "sbi securities"],
    },
    "credit_card_payment": {
        "category": "bills",
        "confidence": 0.95,
        "is_fixed_obligation": True,
        "patterns": ["credit card", "sbi card", "sbicard", "billdesk", "kotak", "axis bank", "icici", "hdfc"],
    },
    "payment_gateway": {
        "category": None,  # Fallback, needs deeper inspection
        "confidence": 0.85,
        "patterns": ["paytm", "google pay", "phonpe", "whatsapp pay", "airtel pay"],
    },
}


def classify_merchant(merchant_name: str | None) -> MerchantClassification:
    """
    Classify merchant by brand type and return category with confidence.
    Finds the LONGEST matching pattern (most specific) across all brand types.

    Args:
        merchant_name: Cleaned merchant name from UPI/description (lowercase expected)

    Returns:
        MerchantClassification with category, confidence, and metadata
    """
    if not merchant_name:
        return MerchantClassification(category=None, confidence=0.0, brand_type=None, merchant_match=None)

    merchant_lower = merchant_name.strip().lower()

    # Collect all matching patterns with their metadata
    all_matches = []
    for brand_type, config in BRAND_TYPE_RULES.items():
        for pattern in config.get("patterns", []):
            if pattern in merchant_lower:
                # Check if this pattern is a primary merchant
                is_primary = any(primary in pattern.lower() for primary in PRIMARY_MERCHANTS)
                all_matches.append(
                    {
                        "pattern": pattern,
                        "brand_type": brand_type,
                        "category": config.get("category"),
                        "confidence": config.get("confidence", 0.90),
                        "pattern_len": len(pattern),
                        "is_primary": is_primary,
                    }
                )

    if not all_matches:
        return MerchantClassification(category=None, confidence=0.0, brand_type=None, merchant_match=None)

    # Prioritize: primary merchants first, then longest match
    best_match = sorted(all_matches, key=lambda x: (not x["is_primary"], -x["pattern_len"]))[0]
    return MerchantClassification(
        category=best_match["category"],
        confidence=best_match["confidence"],
        brand_type=best_match["brand_type"],
        merchant_match=best_match["pattern"],
    )


def detect_person_name_transfer(
    merchant_name: str | None, amount: float, is_recurring: bool, description: str | None
) -> tuple[str | None, float, bool]:
    """
    Detect if a transfer to a person name is rent or P2P transfer.

    Logic:
    - If amount is "round" (like Rs 60K) + recurring monthly = rent (fixed obligation)
    - If amount varies or one-off = P2P transfer
    - If description has "rent" keyword = rent

    Returns:
        (category, confidence, is_fixed_obligation)
    """
    if not merchant_name:
        return None, 0.0, False

    # Check if description contains rent keywords
    desc = (description or "").lower()
    if any(keyword in desc for keyword in ["rent", "landlord", "house", "apartment"]):
        return "rent", 0.90, True

    # Heuristic: round amounts (60K, 50K, 30K) that recur = likely rent
    if is_recurring and amount > 10000:
        # Check if it's a "round" number (ends in 0 or 00)
        if amount % 1000 == 0 or amount % 5000 == 0:
            return "rent", 0.85, True

    # Default: P2P transfer to friend/family
    return "transfers", 0.70, False


def detect_payment_gateway_purpose(merchant_name: str, description: str | None) -> tuple[str | None, float]:
    """
    Detect purpose of payment gateway transactions (Paytm, GPay, PhonePe).

    Logic:
    - If description has investment keywords (zerodha, paytm money) = investment
    - If description has bill/utility keywords = bills
    - If description has rent keyword = rent
    - Default: uncategorized (customer should review)

    Returns:
        (category, confidence)
    """
    desc = (description or "").lower()

    investment_keywords = ["zerodha", "paytm money", "groww", "investment", "trading", "mutual", "sip"]
    if any(keyword in desc for keyword in investment_keywords):
        return "savings_investments", 0.80

    bill_keywords = ["bill", "electricity", "water", "gas", "insurance", "premium"]
    if any(keyword in desc for keyword in bill_keywords):
        return "bills", 0.80

    rent_keywords = ["rent", "landlord", "house", "apartment"]
    if any(keyword in desc for keyword in rent_keywords):
        return "rent", 0.85

    return None, 0.0
