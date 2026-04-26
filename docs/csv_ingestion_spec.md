# MoneyOS File Ingestion Spec

## Goal

Build a deterministic ingestion pipeline for bank, card, and wallet statement files that can accept:

- `.csv`
- `.xlsx`
- `.xls`

The pipeline should turn messy statement rows into one canonical transaction shape for downstream categorization, deduplication, budgeting, and insights.

## MVP Principles

- deterministic parsing first
- no LLM for basic parsing or mapping
- store raw imported rows separately from normalized rows
- support messy dates and amount formats
- fail row-by-row, not file-by-file, whenever possible
- keep source detection explainable and debuggable

## Supported Source Types

For MVP, use broad source types:

- `bank`
- `card`
- `wallet`
- `other`

These are product-facing source types. They are not the same as specific institutions.

## Canonical Transaction Schema

Every successfully normalized imported row should map into this canonical shape:

- `user_id`
- `source_name`
- `source_type`
- `transaction_date`
- `posted_date`
- `amount`
- `currency`
- `direction`
- `description_raw`
- `description_clean`
- `counterparty`
- `category`
- `subcategory`
- `is_recurring`
- `is_fixed_obligation`
- `confidence_score`
- `raw_import_id`

### Canonical Field Rules

#### `user_id`

- owner of the import
- always required

#### `source_name`

- detected institution or export label
- examples:
- `hdfc_bank`
- `sbi_card`
- `paytm_wallet`
- `unknown_source`

#### `source_type`

- one of `bank`, `card`, `wallet`, `other`

#### `transaction_date`

- best available transaction date
- required for normalized output

#### `posted_date`

- posting or settlement date if available
- optional

#### `amount`

- always positive in canonical storage
- direction decides whether it is inflow or outflow

#### `currency`

- default `INR`
- allow fallback if not explicitly present

#### `direction`

- one of `credit` or `debit`

#### `description_raw`

- exact raw text from source row
- no cleanup

#### `description_clean`

- normalized description for matching and categorization
- lowercase
- collapse repeated spaces
- strip reference numbers where possible

#### `counterparty`

- best-effort extracted merchant, sender, or receiver name
- nullable

#### `category`

- deterministic category label if confidence is strong
- nullable if unclear

#### `subcategory`

- narrower grouping if obvious
- nullable

#### `is_recurring`

- true if description and timing strongly suggest repetition
- false by default in MVP

#### `is_fixed_obligation`

- true if likely rent, EMI, school fee, bill, insurance, or other fixed due
- false by default

#### `confidence_score`

- numeric confidence from `0.0` to `1.0`
- reflects normalization confidence, not financial truth confidence

#### `raw_import_id`

- link to raw imported row record
- always required for auditability

## Raw Storage Strategy

The ingestion system should preserve two layers:

### Raw Layer

Store exactly what came from the file:

- file metadata
- sheet name if Excel
- row number
- raw cell values
- parse errors
- original header mapping used

This maps to:

- `import_files`
- `import_rows`

### Normalized Layer

Store cleaned transaction records:

- canonical dates
- normalized amount
- inferred direction
- cleaned description
- dedupe fingerprint
- review status

This maps to:

- `normalized_transactions`

## Source Detection Logic

Detection should happen in this order:

1. file extension
2. file name hints
3. header names
4. sheet names for Excel files
5. fallback to `unknown_source`

### Step 1. Detect File Format

Use file extension:

- `.csv` -> CSV parser
- `.xlsx` -> Excel parser
- `.xls` -> legacy Excel parser

If extension is missing or misleading, use MIME type only as a weak fallback.

### Step 2. Detect Source Name

Use deterministic rules based on:

- filename tokens
- known headers
- known sheet names
- recurring label patterns in description columns

Examples:

- filename contains `hdfc`, `statement`, `account` -> likely `hdfc_bank`
- filename contains `sbi`, `card` -> likely `sbi_card`
- filename contains `paytm`, `wallet` -> likely `paytm_wallet`

### Step 3. Detect Source Type

Source type should come from rule groups:

- bank-like headers -> `bank`
- card-like headers -> `card`
- wallet-like headers -> `wallet`
- otherwise -> `other`

### Common Header Signals

#### Bank-like

- `transaction date`
- `value date`
- `narration`
- `withdrawal`
- `deposit`
- `balance`

#### Card-like

- `transaction date`
- `posted date`
- `merchant`
- `debit`
- `credit`
- `card number`

#### Wallet-like

- `date`
- `activity`
- `amount`
- `type`
- `wallet`
- `available balance`

## Column Mapping Rules

Column mapping should be template-based, with fallback heuristics.

### First Pass: Known Templates

Keep a set of known source templates keyed by:

- source name
- source type
- header signatures

Each template should define:

- date column
- posted date column if present
- description column
- amount column or debit/credit columns
- balance column if present
- currency column if present

### Second Pass: Header Heuristics

If no template matches:

- search for known synonyms
- normalize header text:
- lowercase
- replace `_` and `-` with spaces
- collapse spaces

Examples of date synonyms:

- `date`
- `txn date`
- `transaction date`
- `value date`

Examples of description synonyms:

- `description`
- `narration`
- `remarks`
- `details`
- `merchant`

Examples of amount synonyms:

- `amount`
- `txn amount`
- `value`
- `debit`
- `credit`

## Parser Design

## File-Level Flow

1. upload file
2. create `import_files` record
3. detect format
4. read rows into a table-like structure
5. normalize headers
6. detect source and template
7. create `import_rows` records
8. parse each row into canonical candidates
9. generate dedupe fingerprint
10. write `normalized_transactions`
11. mark row/file status

## Parser Components

### `detect_file_format(file_name, mime_type)`

Returns:

- `csv`
- `xlsx`
- `xls`
- raises unsupported error

### `read_tabular_file(file)`

Returns:

- sheet name if present
- normalized header row
- raw row dictionaries

### `detect_source(file_name, headers, sheet_names)`

Returns:

- `source_name`
- `source_type`
- `template_name` or `None`

### `map_columns(headers, template_name)`

Returns:

- canonical field -> source column mapping
- mapping confidence

### `parse_row(raw_row, mapping, source_context)`

Returns:

- normalized candidate
- parse status
- row errors

### `dedupe_transactions(normalized_rows)`

Returns:

- dedupe fingerprint
- dedupe status

## Date Normalization Rules

Support these common date patterns:

- `YYYY-MM-DD`
- `DD-MM-YYYY`
- `DD/MM/YYYY`
- `MM/DD/YYYY`
- `DD Mon YYYY`
- `DD-Mon-YY`
- Excel serial dates
- datetime values with time suffixes

Rules:

- trim spaces
- try source-template-specific parser first
- then try general ordered parser list
- preserve original raw date in raw storage
- reject impossible dates, but do not fail the full file

Ambiguity rule:

- if both `DD/MM/YYYY` and `MM/DD/YYYY` are plausible, prefer India-friendly day-first parsing unless source template is known to be month-first

## Amount Normalization Rules

Support:

- `1,250.00`
- `1250`
- `-450.50`
- `(450.50)`
- `₹1,250.00`
- `CR` / `DR` suffixes
- separate debit and credit columns

Rules:

- strip currency symbols
- strip commas and extra spaces
- convert bracketed negatives to negative numbers before final normalization
- if debit and credit are separate:
- non-empty debit -> `direction = debit`
- non-empty credit -> `direction = credit`
- store canonical `amount` as positive
- direction carries sign meaning

## Direction Detection Rules

Priority:

1. explicit debit/credit columns
2. explicit type column values like `dr`, `cr`, `debit`, `credit`
3. sign-based inference
4. source-template default rules

Fallback:

- unresolved direction -> row marked `needs_review`

## Description Cleaning Rules

Create `description_clean` from `description_raw` by:

- lowercase
- trim spaces
- collapse repeated spaces
- remove long transaction references if clearly machine-generated
- replace separators like `/`, `_`, `-` with spaces when safe

Examples:

- `UPI/DR/123456/AMAZON PAY` -> `upi dr amazon pay`
- `NEFT CR ACME PVT LTD REF239123` -> `neft cr acme pvt ltd`

Keep the original raw description untouched.

## Counterparty Extraction Rules

Use deterministic text cleanup only.

Heuristics:

- remove payment rail tokens like `upi`, `neft`, `imps`, `pos`
- remove long numeric references
- keep merchant-like tokens
- keep upper-confidence name fragments

Examples:

- `UPI/DR/12345/BIGBASKET` -> `bigbasket`
- `NEFT CR ACME PVT LTD` -> `acme pvt ltd`

If unclear:

- set `counterparty = null`

## Category And Obligation Rules

Use rule-based tagging only in MVP.

Examples:

- `emi`, `loan repayment`, `finance` -> fixed obligation true
- `rent`, `house rent` -> category `expense_home`, fixed obligation true
- `school`, `fees` -> category `expense_school`, fixed obligation true
- `electricity`, `water`, `gas`, `recharge` -> likely recurring

If confidence is low:

- leave `category` and `subcategory` null

## Deduplication Logic

Deduplication should happen in two layers.

### File-Level Deduplication

Use `file_hash` to detect exact same file upload.

If exact same file appears again:

- mark file as duplicate or already processed
- allow user override later if needed

### Row-Level Deduplication

Build a deterministic fingerprint from:

- user_id
- transaction_date
- amount
- normalized direction
- normalized cleaned description
- source_name

Example fingerprint seed:

`user_id|2026-04-01|450.00|debit|amazon pay|hdfc_bank`

Hash this seed to produce `dedupe_fingerprint`.

### Duplicate Rules

- exact fingerprint match -> `duplicate`
- same date + same amount + high-similarity description -> `possible_duplicate`
- otherwise -> `unique`

Do not auto-delete duplicates. Mark them and skip them from summaries unless user accepts them later.

## Error Handling Rules

### File Errors

- unsupported format
- unreadable workbook
- missing header row
- empty file

### Row Errors

- missing date
- missing amount
- unparseable amount
- unresolved direction

Behavior:

- keep bad rows in raw storage
- store parse errors per row
- continue processing valid rows

## Confidence Scoring

Confidence is deterministic, not model-based.

Suggested scoring:

- +0.30 if source template matched
- +0.20 if date parsed cleanly
- +0.20 if amount parsed cleanly
- +0.10 if direction explicit
- +0.10 if description present
- +0.10 if counterparty extracted confidently

Clamp final score between `0.0` and `1.0`.

## MVP Review Status Rules

Rows should be flagged for review when:

- direction is inferred weakly
- date parse is ambiguous
- amount conflicts across columns
- duplicate confidence is uncertain
- category cannot be assigned and description is noisy

## Sample Source Detection Rules

### Rule: HDFC Bank Style

If headers include:

- `date`
- `narration`
- `withdrawal amt`
- `deposit amt`

Then:

- `source_type = bank`
- `source_name = hdfc_bank_like`

### Rule: Card Statement Style

If headers include:

- `transaction date`
- `posted date`
- `merchant`
- `amount`

Then:

- `source_type = card`
- `source_name = generic_card_like`

### Rule: Wallet Export Style

If headers include:

- `date`
- `activity`
- `amount`
- `closing balance`

Then:

- `source_type = wallet`
- `source_name = wallet_export_like`

## Sample Parser Design In Code Terms

Suggested modules:

- `backend/app/ingestion/detectors.py`
- `backend/app/ingestion/readers.py`
- `backend/app/ingestion/mappers.py`
- `backend/app/ingestion/parsers.py`
- `backend/app/ingestion/normalizers.py`
- `backend/app/ingestion/dedupe.py`
- `backend/app/ingestion/pipeline.py`

Suggested function flow:

```python
source_context = detect_source(file_name, headers, sheet_names)
mapping = map_columns(headers, source_context)

for raw_row in rows:
    candidate = parse_row(raw_row, mapping, source_context)
    normalized = normalize_candidate(candidate)
    fingerprint = build_dedupe_fingerprint(normalized)
```

## Sample Fixtures

Fixtures added for parser development:

- `backend/app/tests/fixtures/ingestion/sample_bank_statement.csv`
- `backend/app/tests/fixtures/ingestion/sample_card_statement.csv`
- `backend/app/tests/fixtures/ingestion/sample_wallet_export.csv`
- `backend/app/tests/fixtures/ingestion/sample_messy_dates_amounts.csv`

These fixtures are intentionally small and readable so parser logic stays explainable.

## Next Implementation Step

After this spec is approved:

1. create import file and row models in code
2. implement CSV parser first
3. add XLSX parser
4. add XLS parser
5. wire normalized transaction persistence
6. expose import result summary in the API
