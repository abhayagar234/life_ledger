# MoneyOS Categorization Spec

## Goal

Define a deterministic categorization system for MoneyOS that turns normalized transactions into simple user-facing buckets, while also detecting:

- fixed obligations
- recurring payments
- unresolved descriptions for future LLM fallback

The system should stay explainable, easy to debug, and suitable for low-literacy-friendly product summaries.

## Core Category Set

Use these primary categories in the MVP:

- `groceries`
- `health`
- `entertainment`
- `travel`
- `bills`
- `shopping`
- `salary_income`
- `emi_loans`
- `rent`
- `subscriptions`
- `savings_investments`
- `farming_expense`
- `business_expense`
- `transfers`
- `uncategorized`

## Product Rules

- categories should be understandable to normal users
- deterministic rules come first
- rules should prefer precision over guessing
- unresolved rows should stay reviewable
- LLM is only a fallback for unresolved or ambiguous rows
- fixed obligation and recurring flags should be separate from category

## Inputs To The Rules Engine

The categorization engine should use:

- `description_raw`
- `description_clean`
- `counterparty`
- `direction`
- `amount`
- `source_type`
- `source_name`
- optional historical matches for recurrence

## Rule Hierarchy

Rules should run in this order.

### 1. Hard Structured Rules

Use explicit structured signals first.

Examples:

- `direction = credit` and description contains salary keywords -> `salary_income`
- description contains `emi`, `loan repayment`, `finance` -> `emi_loans`
- description contains `rent` -> `rent`
- description contains transfer rails with self-transfer patterns -> `transfers`

These rules should have the highest confidence.

### 2. Merchant Rules

Use known merchant or counterparty patterns.

Examples:

- `dmart`, `bigbasket`, `blinkit`, `zepto` -> `groceries`
- `apollo`, `pharmacy`, `medplus` -> `health`
- `netflix`, `spotify`, `youtube premium` -> `subscriptions`
- `amazon`, `flipkart`, `myntra` -> `shopping`
- `irctc`, `uber`, `ola`, `rapido` -> `travel`

Merchant rules are strong when the merchant match is clean.

### 3. Keyword And Regex Rules

Use deterministic keyword groups and regular expressions.

Examples:

- `electricity`, `water`, `gas`, `broadband`, `recharge` -> `bills`
- `movie`, `cinema`, `bookmyshow`, `game` -> `entertainment`
- `seed`, `fertilizer`, `tractor`, `pesticide` -> `farming_expense`
- `supplier`, `inventory`, `wholesale`, `gst`, `shop rent` -> `business_expense`

These rules are useful for long-tail descriptions.

### 4. Transfer Detection Rules

Before general expense categorization, check if the transaction is actually a transfer.

Examples:

- `cash withdrawal`
- `self transfer`
- `to own account`
- `wallet add cash`
- `bank transfer to self`

Transfer detection is important because transfers should not inflate spending categories.

### 5. Recurring And Fixed Obligation Overlay

After category is assigned, apply recurring and fixed-obligation logic.

These flags are not categories by themselves.

Examples:

- Netflix can be `subscriptions` and recurring
- rent can be `rent` and fixed obligation
- electricity can be `bills`, recurring, and fixed obligation

### 6. Low-Confidence Or No-Match Handling

If confidence remains too low:

- assign `uncategorized`
- add row to unresolved queue
- preserve rule metadata for later LLM fallback

## Confidence Model

Confidence should be numeric between `0.0` and `1.0`.

### Base Idea

Each classification gets confidence based on the strongest matching rule.

### Suggested Scoring

- exact structured rule match: `0.95`
- strong merchant rule match: `0.90`
- exact keyword group match: `0.80`
- regex or weak merchant alias match: `0.70`
- historical recurring pattern support: `+0.05`
- conflicting category signals: `-0.20`
- unclear or noisy description: clamp to `0.40` or lower

### Confidence Bands

- `0.90 to 1.00` -> high confidence
- `0.75 to 0.89` -> good confidence
- `0.50 to 0.74` -> weak confidence
- `below 0.50` -> unresolved candidate

### Rule Outcome Logic

- confidence `>= 0.75`: assign category directly
- confidence `0.50 to 0.74`: assign only if no conflict and mark for optional review
- confidence `< 0.50`: set `uncategorized` and send to unresolved queue

## Merchant Cleanup Logic

Merchant cleanup should happen before categorization.

### Goals

- remove rails and transaction noise
- normalize repeated aliases
- improve stable matching

### Cleanup Steps

1. lowercase
2. strip long numeric refs
3. remove payment rails like `upi`, `neft`, `imps`, `pos`
4. collapse spaces
5. normalize common aliases

### Examples

- `UPI/DR/12345/BIGBASKET` -> `bigbasket`
- `POS TXN DMART READY` -> `dmart ready`
- `NEFT CR ACME PVT LTD` -> `acme pvt ltd`

## Recurring Detection Logic

Recurring means:

- same or similar merchant/description
- similar amount
- repeating at a regular interval

### MVP Detection Rules

Mark `is_recurring = true` if:

- same cleaned merchant appears at least 2 times in prior 90 days
- amounts are same or within small tolerance
- gap pattern suggests weekly or monthly recurrence

Suggested cadence windows:

- weekly: `6 to 8` days
- monthly: `27 to 33` days

### Examples

- Netflix every month -> recurring
- school fee every month -> recurring
- electricity bill monthly -> recurring

### Non-Recurring Examples

- one-off Amazon purchase
- seasonal fertilizer purchase
- random restaurant spend

## Fixed Obligation Logic

Fixed obligation means a user likely expects this payment and needs to plan for it.

Mark `is_fixed_obligation = true` when:

- category is `emi_loans`
- category is `rent`
- category is `subscriptions`
- category is `bills` with strong utility keywords
- salary-linked school fee patterns appear
- lender keywords appear

Examples:

- EMI
- rent
- school fees
- broadband bill
- insurance premium

Not every recurring expense is a fixed obligation.

Example:

- groceries may recur, but are not fixed obligation

## EMI And Lender Detection

These should have strong deterministic rules.

### Hard Keywords

- `emi`
- `loan`
- `repayment`
- `finance`
- `credit card bill`
- `interest`

### Lender Patterns

Examples:

- `bajaj finance`
- `hdb`
- `hdfc loan`
- `home credit`
- `muthoot`
- `manappuram`

If matched:

- category -> `emi_loans`
- fixed obligation -> true
- confidence -> high unless the description is clearly about disbursal rather than repayment

## Unresolved Transaction Queue

Any transaction should enter the unresolved queue if:

- category is `uncategorized`
- confidence is below threshold
- multiple conflicting rules matched
- merchant cleanup produced weak or empty result

### Queue Payload

Each unresolved item should preserve:

- raw description
- cleaned description
- detected merchant
- source type
- amount
- direction
- candidate categories
- confidence
- rule traces

This queue is what later LLM fallback will use.

## Rules Engine Design

Suggested module structure:

- `backend/app/categorization/cleaners.py`
- `backend/app/categorization/rules.py`
- `backend/app/categorization/recurring.py`
- `backend/app/categorization/engine.py`
- `backend/app/categorization/unresolved.py`

### Engine Flow

1. clean merchant and description
2. run hard structured rules
3. run merchant rules
4. run keyword and regex rules
5. resolve conflicts
6. compute confidence
7. apply recurring detection
8. apply fixed-obligation flags
9. emit final category or unresolved payload

## Conflict Resolution Rules

When multiple categories match:

1. prefer hard structured rules
2. prefer exact merchant match over generic keyword match
3. prefer `transfers` over ordinary expense categories when self-transfer evidence exists
4. prefer `emi_loans` over `bills` if lender/EMI keywords exist
5. if still unclear, lower confidence and move to unresolved

## User-Facing Language

Internal rules may use aliases and regex patterns, but the UI should only show the category names listed in the core category set.

This keeps summaries simple:

- `groceries`
- `travel`
- `bills`
- `rent`

Not internal labels like:

- `utility_postpaid_mobile`
- `retail_online_marketplace`

## MVP Recommendation

For the first implementation:

- use YAML-driven rule sets
- keep merchant aliases flat and readable
- keep conflict rules explicit
- do not auto-guess too aggressively
- prefer `uncategorized` over bad categorization

This is the safest path for money products.
