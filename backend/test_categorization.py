#!/usr/bin/env python3
import sys
sys.path.insert(0, '/Users/Abhay/life-ledger/backend')

from app.ingestion.normalizers import (
    clean_description,
    extract_counterparty,
    extract_upi_merchant,
)

# Test cases from Abhay's statement
test_cases = [
    # SWEEP transfers - should extract as "sweep tfr" or similar
    ("SWEEP TFR DR 9876543210 AT BENGALURU", "sweep", "transfers"),
    ("SWEEP TRF CREDT 123456 OF Mr. ABHAY AGARWAL", "sweep", "transfers"),
    
    # ATM withdrawals - should extract as "atm wdl" or similar
    ("ATM WDL ATM CASH 50932 +EROS CITY SQUARE GURGAON", "atm", "transfers"),
    ("ATM WDL ATM 50932", "atm", "transfers"),
    
    # SBI Card payment - should match sbi card pattern
    ("WDL TFR INB SBICARD FOR BILLDESK SBICARD Payments", "sbi card", "bills"),
    ("DEBIT 000000 SBI 0000000761 SBI CREDIT CARD PAYMENT", "sbi", "bills"),
    ("IYA25248 SBI CARDS AND PAYMENT", "sbi cards", "bills"),
    
    # UPI merchant extraction (with newlines from PDF)
    ("UPI/DR/509373407024/MUKUS\nMART/HDFC/mukusmart./UP", "muks mart", "upi"),
    ("UPI/DR/123456789/BLINKIT/HDFC/vpa", "blinkit", "upi"),
    ("UPI/CR/987654321/ZEPTO/HDFC/zepto", "zepto", "upi"),
]

print("Testing categorization patterns:\n")

for raw_desc, pattern_name, expected_category in test_cases:
    description_clean = clean_description(raw_desc)
    counterparty = extract_upi_merchant(raw_desc) or extract_counterparty(description_clean)
    
    print(f"Pattern: {pattern_name}")
    print(f"  Raw: {raw_desc[:60]}...")
    print(f"  Clean: {description_clean}")
    print(f"  Counterparty: {counterparty}")
    print(f"  Expected category: {expected_category}")
    print()

