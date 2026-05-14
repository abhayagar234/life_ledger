# 🐛 IMPORT STATEMENT (PDF) WORKFLOW - BUG REPORT

## Workflow: Upload Real PDF → Preview → Confirm Dues → Home Display

---

## 🔴 CRITICAL BUGS

### BUG #1: PDF Table Extraction Incomplete ❌
**Status**: BLOCKS WORKFLOW  
**Severity**: CRITICAL  
**Location**: `/backend/app/ingestion/pdf_reader.py` lines 37-70

**Problem**:
- PDF tables ARE detected by `_is_transaction_table()` 
- BUT columns are NOT properly mapped to standard format
- Expected columns: `date`, `amount`, `direction` (debit/credit), `description`
- Actual: Raw table cells without normalization

**Impact**:
- ✗ Transaction amounts not extracted correctly
- ✗ Direction (debit/credit) not identified
- ✗ Dates not parsed consistently  
- ✗ Descriptions truncated or malformed

**What Happens**:
```
Input: PDF table with headers [S No., Transaction Date, Remarks, Withdrawal Amount, Deposit Amount, Balance]
Output: Headers not mapped, column matching fails
Result: ImportRow created with NULL or wrong values for amount/date/direction
```

**Expected Behavior**:
```
Column mapping should:
- "Transaction Date" → "date"
- "Withdrawal Amount" → direction="out", amount=value
- "Deposit Amount" → direction="in", amount=value
- "Transaction Remarks" → "description"
```

**Test with Real PDF**:
```
PDF Row:
  Date: 13.02.2026
  Withdrawal: 503.00
  Deposit: null
  Remarks: "UPI/FIRST CRY/vyapar.1729285/..."

Expected ImportRow:
  transaction_date: 2026-02-13
  direction: "out"
  amount: 503.00
  description: "First Cry Payment"

Actual ImportRow (likely):
  transaction_date: null or wrong
  direction: null  
  amount: null
  description: raw text
```

---

### BUG #2: Preview Not Showing Real Transaction Data ❌
**Status**: VISIBLE TO USER  
**Severity**: CRITICAL  
**Location**: `mobile/app/import-statement.tsx` lines 159-168

**Problem**:
- Preview DOES render if `uploadResult.preview` exists
- BUT `ImportFile.preview` is NULL because PDF data extraction failed
- Preview shows empty or garbage data from failed parse

**Impact**:
- ✗ User uploads PDF, sees blank preview
- ✗ User doesn't know if upload worked
- ✗ User can't verify transactions before confirming

**What User Sees**:
```
BEFORE: Upload screen
AFTER: Preview section appears but shows nothing
       "Transaction preview shows 0 rows"
       OR shows malformed data: "null · null · null · null"
```

**Root Cause Chain**:
1. PDF parsing fails to extract columns → ImportRow.transaction_date = null
2. Backend returns: `"imported_rows": 0, "duplicate_rows": 0`
3. Mobile checks: `uploadResult.preview?.length` → FALSE
4. Preview section doesn't render

---

### BUG #3: Detected Dues Empty (No Pattern Recognition) ❌
**Status**: VISIBLE TO USER  
**Severity**: CRITICAL  
**Location**: `/backend/app/services/due_extractor.py` (likely incomplete)

**Problem**:
- Even if PDF parsed, due detection fails
- Recurring dues should show: Netflix, Spotify, Jio, Insurance, etc.
- Actually shows: NOTHING (empty dues list)

**Why**:
- Due detection needs `NormalizedTransaction` records with:
  - Correct dates
  - Correct amounts  
  - Correct descriptions
- If PDF columns unmapped → NormalizedTransaction has NULL values
- Due detector can't find patterns in NULL data

**What User Sees**:
```
Upload succeeds
Preview shows rows ✓ (if fixed)
Detected Dues: EMPTY ❌
Message: "No recurring dues found in your statement"
BUT: PDF clearly has Netflix (199), Spotify (139), Jio (299) repeating
```

---

## 🟡 MAJOR BUGS

### BUG #4: Confirm Dues Creates Loans But Cashflow Not Calculated ❌
**Status**: DATA CREATED BUT NOT DISPLAYED  
**Severity**: MAJOR  
**Location**: `/backend/app/api/routes/imports.py` lines 123-186

**What Works**:
- ✓ User confirms dues
- ✓ Backend creates `Loan` and `EMIPayment` records
- ✓ Database transaction commits successfully

**What Fails**:
- ✗ `getCashflowSummary()` doesn't include imported transactions
- ✗ Safe-to-spend NOT calculated
- ✗ Home screen shows zeros

**Root Cause**:
```python
# Backend creates dues correctly:
Loan(id=123, amount=199, frequency="monthly")  # Netflix
EMIPayment(id=456, amount=199, status="pending")

# But getCashflowSummary() doesn't query ImportRow table
# It only looks at EMIPayment (soon-due dates)
# Imported transaction history is IGNORED
```

**Result**:
- Safe-to-spend = 0 (no data)
- Daily needs = 0 (not calculated)
- Bank balance = 0 (not extracted from statement)

---

### BUG #5: Safe-to-Spend Shows Zero After Import ❌
**Status**: USER-VISIBLE ON HOME SCREEN  
**Severity**: MAJOR  
**Location**: `/backend/app/services/cashflow.py` (calculation logic missing)

**Expected Flow**:
1. User uploads PDF with statement
2. Backend extracts: total_in, total_out, final_balance
3. Calculates: `safe_to_spend = final_balance - upcoming_dues`
4. Home screen displays value

**Actual Flow**:
1. User uploads PDF → mostly fails (bug #1)
2. Backend extracts: nothing (NULL values)
3. Calculates: `safe_to_spend = 0 - 0 = 0`
4. Home screen shows: **Rs 0** ❌

**Test Case**:
```
PDF has:
- Final balance: Rs 834,029.53
- Confirmed dues: Rs 3,000/month (Netflix + Spotify + Jio)
- Cash on hand: Rs 0 (not in bank)

User expects to see:
safe_to_spend = 834,029 - 3,000 = ~Rs 831,000

User actually sees:
safe_to_spend = Rs 0 (no calculation happened)
```

---

### BUG #6: Bank Balance Confirmation Never Appears ❌
**Status**: USER CAN'T CONFIRM IMPORTED DATA  
**Severity**: MAJOR  
**Location**: `mobile/app/(tabs)/home.tsx` lines 685-720

**Problem**:
- Code expects: `bankBalanceNeedsConfirmation = true` + `detectedBankBalance = value`
- Reality: These fields are NULL because PDF extraction failed
- Confirmation card never appears

**Expected Behavior** (if PDF worked):
```
Upload PDF → Backend detects: Rs 834,029.53 in bank
Home page shows: "Is this your bank balance? Rs 834,029.53"
User clicks: "Yes, that's right" → Balance confirmed
Calculation updates
```

**Actual Behavior**:
```
Upload PDF → Backend extracts: null
Home page shows: Nothing
Calculation shows: Rs 0
```

---

## 🟠 MODERATE BUGS

### BUG #7: Missing Cash Entry After Import ❌
**Status**: WORKFLOW INCOMPLETE  
**Severity**: MODERATE  
**Location**: `mobile/app/(tabs)/home.tsx` quick actions

**Problem**:
- User imports bank statement (PDF)
- App asks to "confirm bank balance" (if working)
- BUT: Never asks for "cash on hand"
- User can't update cash → Safe-to-spend stays wrong

**Expected**:
```
Import PDF → Confirm bank balance → Enter cash on hand → Calculate safe-to-spend
```

**Actual**:
```
Import PDF → [Bank balance stuck at 0] → Cash assumed zero → Safe-to-spend = 0
```

---

### BUG #8: Daily Needs Not Calculated from Transaction History ❌
**Status**: MISSING CALCULATION  
**Severity**: MODERATE  
**Location**: `/backend/app/services/cashflow.py` (likely missing)

**Expected**:
```
Statement has 226 transactions over 3 months
Backend should:
1. Calculate daily average spend
2. Multiply by days until next salary
3. Show as: "Daily Needs Protected: Rs X"
```

**Actual**:
```
No calculation happens
Home screen shows: Rs 0
```

---

## 📋 SUMMARY OF BUGS

| # | Bug | Severity | Impact | Status |
|---|-----|----------|--------|--------|
| 1 | PDF columns not mapped | CRITICAL | No transaction data extracted | ❌ BLOCKS |
| 2 | Preview shows nothing | CRITICAL | User can't verify upload | ❌ BLOCKS |
| 3 | Dues detection empty | CRITICAL | Can't identify recurring payments | ❌ BLOCKS |
| 4 | Cashflow not calculated after confirm | MAJOR | Safe-to-spend shows 0 | ❌ BROKEN |
| 5 | Safe-to-spend shows 0 | MAJOR | Home screen useless | ❌ BROKEN |
| 6 | Bank balance confirmation missing | MAJOR | Can't confirm detected balance | ❌ MISSING |
| 7 | Cash entry missing from flow | MODERATE | Incomplete calculation | ⚠️ INCOMPLETE |
| 8 | Daily needs not calculated | MODERATE | Metric shows 0 | ⚠️ MISSING |

---

## 🧪 HOW TO VERIFY (Test with Real PDF)

### Test 1: PDF Parsing
```bash
cd /backend
python3 -c "
from app.ingestion.pdf_reader import read_pdf_rows
with open('/Downloads/OpTransactionHistory13-05-2026.pdf-11-57-08.pdf', 'rb') as f:
    result = read_pdf_rows(f.read())
print(f'Headers: {result.headers}')
print(f'Row count: {len(result.rows)}')
print(f'First row: {result.rows[0] if result.rows else \"EMPTY\"}')
"
```

Expected:
- Headers include: date, amount, withdrawal, deposit, description
- Row count: 226
- First row has values, not NULL

Actual (likely):
- Headers might be wrong or empty
- Row count: 0 or malformed
- First row: All NULLs or empty

### Test 2: Upload via Mobile
1. Start mobile app (npm run dev)
2. Go to import-statement screen
3. Upload real PDF
4. Check preview section
   - ✓ Shows 226 rows imported? 
   - ✗ Shows 0 or blank?
5. Check "Recurring Dues Found"
   - ✓ Shows Netflix, Spotify, etc.?
   - ✗ Empty list?

### Test 3: Confirm and Check Home
1. Select dues and click "Confirm"
2. Navigate to home page
3. Check metrics:
   - Safe to spend: Shows value > 0?
   - Bank seen: Shows value > 0?
   - Daily needs: Shows value > 0?

---

## 🔧 REQUIRED FIXES (Priority Order)

1. **Fix PDF column mapping** (pdf_reader.py)
   - Map PDF columns to date/amount/direction/description
   - Ensure NormalizedTransaction is created with real data

2. **Enable cashflow calculation** (cashflow.py)
   - Aggregate ImportRow transactions into bank balance
   - Calculate daily needs from history
   - Calculate safe_to_spend = balance - dues

3. **Link import refresh to dashboard** (imports.py)
   - After confirming dues, calculate cashflow
   - Return calculated values in response
   - Trigger refreshDashboard on mobile

4. **Test with real PDF** 
   - Upload OpTransactionHistory13-05-2026.pdf
   - Verify all 226 rows parsed
   - Verify preview shows transactions
   - Verify dues detected (Netflix, Spotify, etc.)
   - Verify home shows calculated values

