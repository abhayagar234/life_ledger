# Multi-Statement Upload API - Design & Implementation Plan

## Current Status

### What Works ✅
- Bank statements (SBI Saving Account) - Successfully parsed and categorized
- 56 transactions parsed from March 2026 statement
- Categorization engine working with 50% success rate (28/56 categorized)
- Transaction grouping by category and payment method

### What Doesn't Work ❌
- **Credit Card Statement PDFs** - Cannot parse (different table structure)
- Current `read_pdf_rows()` fails on SBI AURUM CC statements
- Single statement gives limited picture of spending patterns

---

## Problem Statement

**Current Issue:** Uploading one bank statement provides incomplete spending insights
- Limited historical context
- Can't differentiate between "normal" and "exceptional" spending
- Difficult to establish safe spending threshold

**Example from Analysis:**
```
March 2026 Bank Statement:
- Total Spending: ₹338,072.83
- Real Spending (excluding transfers): ₹76,658.43
- Largest category: RENT (₹60,000 - 78%)
```

**Safe Spending Question:** Is ₹76K/month safe? Need 3-6 months of data to answer.

---

## Solution: Multi-Statement Upload API

### Phase 1: API Design

#### 1.1 Endpoint Structure
```
POST /api/v1/statements/upload-batch
- Accept: Multiple PDF files (up to 6 months)
- Returns: Aggregated analysis + safe spending recommendation
```

#### 1.2 Request Format
```json
{
  "user_id": "string",
  "statements": [
    {
      "file": "file_object",
      "statement_type": "bank|credit_card",
      "bank_name": "sbi|hdfc|icici|axis"
    }
  ],
  "analysis_period_months": 3  // or 6
}
```

#### 1.3 Response Format
```json
{
  "status": "success",
  "analysis": {
    "period": "2026-02 to 2026-04",
    "total_months": 3,
    "statements_processed": 3,
    "total_spending": 230000,
    "average_monthly_spend": 76666.67,
    "safe_spend_recommendations": {
      "conservative_60_percent": 46000,
      "balanced_70_percent": 53666,
      "optimistic_80_percent": 61333
    },
    "category_breakdown": {
      "rent": {
        "monthly_avg": 60000,
        "percentage": 78.2,
        "consistency": 100,
        "is_fixed": true
      },
      "groceries": {
        "monthly_avg": 900,
        "percentage": 1.2,
        "consistency": 85,
        "is_fixed": false
      }
    },
    "spending_volatility": 12.5,  // percentage
    "categorization_success_rate": 65
  }
}
```

---

### Phase 2: PDF Parsing Enhancement

#### Current Limitation
```python
# Current flow fails here:
_stitch_tables() -> _is_transaction_table()  # Returns False for CC statements
```

#### Solution: Dual Parser Strategy

**Option A: Specialized CC Statement Parser** (Recommended)
```python
def read_cc_statement_rows(content: bytes) -> ParsedSheet:
    """Handle SBI, HDFC, ICICI credit card formats"""
    # Extract from standardized CC statement layout
    # Parse transaction table with Date|Description|Amount|D/C pattern
    # Return ParsedSheet in same format as bank statements
```

**Option B: Enhanced Generic Parser**
```python
def read_pdf_rows_v2(content: bytes, statement_type: str) -> ParsedSheet:
    """
    statement_type: 'bank_statement' | 'credit_card'
    Uses different extraction logic based on type
    """
```

#### Implementation Priority
1. **First:** Add CC statement parser (handles SBI AURUM, HDFC, ICICI formats)
2. **Then:** Enhance bank statement parser for other banks
3. **Finally:** Abstract to generic document reader

---

### Phase 3: Smart Safe Spending Calculation

#### Algorithm

```python
def calculate_safe_spending(aggregated_data: AggregatedStatements):
    """
    Returns: safe_spend_recommendations dict
    
    Logic:
    1. Separate FIXED vs VARIABLE expenses
       - Fixed: Rent, Insurance, Subscriptions, EMI, Utilities
       - Variable: Groceries, Dining, Shopping, Travel
    
    2. Calculate monthly averages
       - fixed_avg = sum of fixed / months
       - variable_avg = sum of variable / months
    
    3. Calculate spending volatility (std deviation)
       - Low volatility (0-10%): Predictable
       - Medium (10-25%): Moderate swings
       - High (25%+): Volatile
    
    4. Determine safe thresholds
       - Conservative (60%): fixed + (0.5 × variable)
       - Balanced (70%): fixed + (0.7 × variable)
       - Optimistic (80%): fixed + (0.9 × variable)
    
    5. Add warnings for
       - High volatility months
       - Missing categories
       - Unusual spending spikes
    """
```

#### Example Output
```python
{
  "fixed_obligations": {
    "rent": 60000,
    "subscriptions": 500,
    "total": 60500
  },
  "variable_spending": {
    "groceries": 900,
    "dining": 400,
    "shopping": 1000,
    "travel": 500,
    "total": 2800
  },
  "safe_spend": {
    "minimum_60pct": 61680,  # fixed + 50% variable
    "comfortable_70pct": 62460,  # fixed + 70% variable
    "aggressive_80pct": 63240  # fixed + 90% variable
  },
  "notes": [
    "Rent is fixed obligation (100% of months)",
    "Spending volatile in Mar (+35% vs Feb)",
    "Travel shows seasonal pattern"
  ]
}
```

---

### Phase 4: Multi-Statement Processing Pipeline

```
┌─────────────────────────────────────┐
│  User Uploads 3-6 PDF Statements    │
├─────────────────────────────────────┤
│ Detection Layer                      │
│  • Identify statement type (B/CC)    │
│  • Detect bank                       │
│  • Extract period                    │
├─────────────────────────────────────┤
│ Parsing Layer                        │
│  • Bank: existing read_pdf_rows()    │
│  • CC: new read_cc_statement_rows()  │
│  • Output: ParsedSheet[] (normalized)│
├─────────────────────────────────────┤
│ Ingestion Layer                      │
│  • For each transaction:             │
│    - Clean & normalize               │
│    - Deduplicate (across statements) │
│    - Categorize                      │
├─────────────────────────────────────┤
│ Aggregation Layer                    │
│  • Group by month                    │
│  • Calculate category totals         │
│  • Detect patterns                   │
├─────────────────────────────────────┤
│ Analysis Layer                       │
│  • Calculate safe spending           │
│  • Identify volatility               │
│  • Generate recommendations          │
└─────────────────────────────────────┘
```

---

## Current Test Results

### Bank Statement (March 2026)
| Metric | Value |
|--------|-------|
| Transactions | 56 |
| Categorized | 28 (50%) |
| UPI Spending | ₹170,752 |
| Top Category | Rent (₹60,000) |
| Health Spending | ₹1,266 |

### Credit Card Statements
| File | Status |
|------|--------|
| CardStatement_2026-02-24.pdf | ❌ Parse Failed |
| CardStatement_2026-03-24.pdf | ❌ Parse Failed |
| CardStatement_2026-04-24.pdf | ❌ Parse Failed |

**Reason:** Different PDF table structure than bank statements

---

## Implementation Roadmap

### Week 1: Foundation
- [ ] Create `PDFStatementDetector` to identify statement type
- [ ] Build `CCStatementParser` for SBI AURUM format
- [ ] Add unit tests for both parsers

### Week 2: Integration
- [ ] Update ingestion pipeline to handle CC statements
- [ ] Implement deduplication across multiple statements
- [ ] Add transaction merging logic

### Week 3: Analytics
- [ ] Implement `SafeSpendingCalculator`
- [ ] Add category volatility detection
- [ ] Create spending pattern analyzer

### Week 4: API & UI
- [ ] Create `/api/v1/statements/upload-batch` endpoint
- [ ] Build multi-file upload UI
- [ ] Display aggregated dashboard
- [ ] Add safe spending recommendations widget

---

## Benefits

### For Users
1. **Better Spending Insights** - See full picture across months
2. **Accurate Safe Spend** - Data-driven recommendations, not guesswork
3. **Category Trends** - Identify which categories vary monthly
4. **Volatility Detection** - Know which months are "unusual"

### For App
1. **Rich Data** - 3-6 months vs single month
2. **Better Categorization** - More examples = better ML training
3. **Recurring Detection** - Multiple months improve accuracy
4. **User Retention** - Dashboard becomes more valuable over time

### Example Scenario
```
User uploads Feb, Mar, Apr statements:
- Sees rent is fixed (₹60K every month)
- Sees groceries average ₹900/month
- Identifies March had unusual ₹100 shopping spike
- App recommends: "Safe to spend ₹62,500/month on average"
- Warning: "April had 35% higher spending, investigate cause"
```

---

## Technical Considerations

### Data Storage
- Store raw transactions for audit trail
- Aggregate queries (month summaries) for performance
- Deduplicate using: `(date, amount, counterparty)` fingerprint

### Privacy
- Don't store sensitive merchant names (hash instead)
- Aggregate at user level, not across users
- Purge raw statements after 12 months (keep aggregates)

### Error Handling
- Partial failures: If 1 of 3 files fails, still process others
- Missing months: Flag gaps in data
- Duplicate statements: Detect and reject

---

## Next Steps

1. **Immediate:** Build CC statement parser for SBI AURUM
2. **Short term:** Implement safe spending calculator
3. **Medium term:** Create batch upload API
4. **Long term:** Add ML-based anomaly detection for spending

---

## Files to Modify/Create

```
app/
├── ingestion/
│   ├── pdf_reader.py (MODIFY - add detector)
│   ├── cc_statement_parser.py (CREATE - new)
│   └── statement_detector.py (CREATE - new)
├── categorization/
│   └── safe_spending.py (CREATE - new)
├── aggregation/ (CREATE - new directory)
│   ├── multi_statement_aggregator.py
│   ├── spending_analyzer.py
│   └── patterns.py
└── api/
    └── statements.py (MODIFY - add batch endpoint)
```

---

## Success Metrics

- ✅ Parse 3+ credit card statements without errors
- ✅ 70%+ categorization success rate (vs current 50%)
- ✅ Safe spending recommendation differs by <20% across multiple runs
- ✅ User can upload 6 months of statements in <2 minutes
- ✅ API response time <5 seconds for 6 months of data

