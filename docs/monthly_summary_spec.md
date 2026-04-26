# MoneyOS Monthly Summary Spec

## Goal

Define the monthly summary outputs and rules that turn transactions into simple planning signals for the dashboard and coach layer.

The monthly summary should help the user answer:

- how much came in?
- how much went out?
- what must be paid?
- what is flexible?
- what is still safe to spend?
- what should I do next?

## Summary Scope

Use different planning windows by user type:

- `salaried`: calendar month, phrased against next salary cycle
- `irregular_income`: rolling `30` days plus dues due soon
- `business_self_employed`: calendar month with business versus home split

## Core Summary Outputs

Every summary should try to produce:

- `period_start`
- `period_end`
- `planning_mode`
- `monthly_income`
- `monthly_expense`
- `fixed_obligations`
- `essential_spend`
- `flexible_spend`
- `transfer_total`
- `savings_allocations`
- `emi_burden_ratio`
- `savings_rate`
- `safe_to_spend`
- `goal_gap_total`
- `runway_days` when relevant
- `top_categories`
- `warnings`
- `next_best_action`

## Monthly Summary Rules

## Rule 1. Exclude Transfers From Spending

Transfers between own accounts should not count as expense.

They should be shown separately as:

- `transfer_total`

## Rule 2. Separate Savings From Expense

Money moved into savings or investments should not inflate expense totals.

It should be shown separately as:

- `savings_allocations`

## Rule 3. Keep Fixed Obligations Visible

Even when small in count, these should always be visible:

- EMI
- rent
- core bills
- school fees
- insurance

## Rule 4. Show Only a Few Buckets

Show the top `3 to 5` categories by amount.

Everything else can be grouped under:

- `other`

## Rule 5. Explain Pressure Simply

Warnings and tips should use plain language.

Examples:

- `Fixed dues are taking a big part of this month.`
- `Shopping is the easiest place to reduce.`
- `Your cash runway looks short.`

## Rule 6. Do Not Overstate Confidence

If data is thin, mixed, or incomplete:

- show a softer warning
- avoid exact recommendations
- mention that the estimate is based on limited records

## User-Type Specific Summary Behavior

## 1. Salaried

Main cards:

- `Money In`
- `Money Out`
- `Fixed Dues`
- `Flexible Spend`
- `Safe To Spend`

Primary summary questions:

- how much salary came in this month?
- what is already spent?
- what dues are still left before next salary?

Guidance priorities:

- protect unpaid fixed dues
- show EMI burden when meaningful
- highlight one flexible bucket to trim if pressure is high

## 2. Irregular Income

Main cards:

- `Money In (30 Days)`
- `Money Out (30 Days)`
- `Dues Due Soon`
- `Runway`
- `Safe To Spend`

Primary summary questions:

- how much came in recently?
- how long can current money last?
- what is due in the next week or two?

Guidance priorities:

- protect essentials first
- show runway only when the estimate is strong enough
- show flexible-spend warnings only when runway is weak

## 3. Business / Self-Employed

Main cards:

- `Money In`
- `Business Expense`
- `Home Expense`
- `Fixed Dues`
- `Reserve Need`

Primary summary questions:

- how much money came into the business and household?
- how much went to business-running cost?
- how much went to home spending?

Guidance priorities:

- protect business continuity
- highlight home flexible spend only after business costs are covered
- surface mixed-money pressure simply

## Metric Rules

### Monthly Income

- use earned inflows only
- exclude transfers, loans received, and balance adjustments

### Monthly Expense

- include fixed, essential, flexible, and other spend
- exclude transfers and savings allocations

### Fixed Obligations

- sum transactions flagged fixed obligation

### Flexible Spend

- sum categories in the flexible bucket

### Safe To Spend

Use the planning-mode-specific formula from [budgeting_logic.md](/Users/Abhay/life-ledger/docs/budgeting_logic.md).

Always:

- subtract protected dues and buffers first
- clamp negative values to `0`
- round before showing

### Runway

Show only for `irregular_income` by default.

Optionally show for others later if liquid balance quality becomes reliable.

### Goal Gap

If active goals exist:

- show total remaining gap

If no active goals exist:

- omit or show `null`

## Warning Rules

Warnings should be triggered by simple thresholds, not complex scoring.

Recommended MVP warnings:

- `high_emi_pressure` when `emi_burden_ratio > 0.35`
- `negative_savings_rate` when `savings_rate < 0`
- `fixed_dues_heavy` when fixed obligations are a large share of income or spend
- `runway_short` when runway is below about `7 to 14` days for irregular earners
- `flexible_spend_high` when flexible spend is clearly larger than normal or larger than essentials
- `uncategorized_high` when too much spend is uncategorized

## Next Best Action Logic

Only show one primary action in the summary.

Priority order:

1. protect overdue or near-due fixed obligations
2. protect essentials and reserve buffer
3. reduce one flexible bucket
4. move a small amount to savings if the month is stable
5. update missing or uncategorized transactions if data quality is weak

Example actions:

- `Keep aside about 3,000 for EMI and rent first.`
- `Try reducing shopping this week to protect your cash.`
- `Track a few more expenses to improve this estimate.`

## Coach Copy Rules

Guidance should be:

- short
- plain
- practical
- non-judgmental

Good examples:

- `EMI and rent are already taking a big part of this month. Keep flexible spending low.`
- `Groceries look normal. Shopping is the easiest place to reduce right now.`
- `At this pace, your money may last about 12 days. Protect dues and essentials first.`

Avoid:

- finance jargon
- exact predictions
- moralizing language

## No-False-Precision Rules

- round money suggestions to user-friendly numbers
- use `about`, `around`, or `roughly` for estimates
- avoid exact runway decimals in UI copy
- do not imply guaranteed future income

## Suggested API Payload

This is a suggested response shape for backend and UI alignment.

```json
{
  "period_start": "2026-04-01",
  "period_end": "2026-04-30",
  "planning_mode": "salaried",
  "totals": {
    "monthly_income": 42000,
    "monthly_expense": 30100,
    "fixed_obligations": 14500,
    "essential_spend": 9800,
    "flexible_spend": 4200,
    "transfer_total": 3000,
    "savings_allocations": 2000
  },
  "ratios": {
    "emi_burden_ratio": 0.24,
    "savings_rate": 0.28
  },
  "planning": {
    "safe_to_spend": 4500,
    "goal_gap_total": 18000,
    "runway_days": null
  },
  "top_categories": [
    { "category": "rent", "amount": 9000 },
    { "category": "groceries", "amount": 6200 },
    { "category": "emi_loans", "amount": 5500 }
  ],
  "warnings": ["fixed_dues_heavy"],
  "next_best_action": "Keep aside about 5,000 for upcoming fixed dues first."
}
```

## MVP Notes

- compute summary metrics on the backend
- keep formulas explicit and versioned
- use the same buckets across dashboard and coach copy
- prefer a small number of trustworthy signals over many weak signals
