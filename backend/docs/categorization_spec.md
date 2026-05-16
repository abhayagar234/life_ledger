# MoneyOS Categorization Spec

## Goal

Use deterministic categorization to turn normalized transactions into product-friendly buckets that support:

- safe-to-spend math
- essential spending estimation
- recurring due detection
- specific watchouts

The categorization system must stay explainable and easy to debug.

## Product-Useful Categories

Current high-value categories:

- `salary_income`
- `rent`
- `emi_loans`
- `subscriptions`
- `bills`
- `groceries`
- `health`
- `travel`
- `shopping`
- `savings_investments`
- `farming_expense`
- `business_expense`
- `transfers`
- `uncategorized`

## Product Rules

- deterministic rules first
- transfer detection before expense categorization
- recurring/fixed signals matter as much as category names
- precision is more important than broad guessing
- ambiguous rows can stay uncertain

## Primary Inputs To Categorization

- `description_raw`
- `description_clean`
- `counterparty`
- `direction`
- `amount`
- `source_type`
- import history and recurrence signals

## Rule Hierarchy

### 1. Hard Structured Rules

Examples:

- salary-like credits -> `salary_income`
- descriptions with EMI / finance / loan repayment -> `emi_loans`
- rent-like descriptions -> `rent`
- clear self-transfer patterns -> `transfers`

### 2. Merchant Rules

Examples:

- grocery merchants -> `groceries`
- pharmacies / medical merchants -> `health`
- subscription merchants -> `subscriptions`
- shopping merchants -> `shopping`
- travel merchants -> `travel`

### 3. Keyword / Regex Rules

Examples:

- recharge / broadband / electricity -> `bills`
- seed / fertilizer / pesticide -> `farming_expense`
- supplier / inventory / wholesale -> `business_expense`

### 4. Recurring Overlay

After category assignment, recurring and fixed-obligation signals should be applied separately.

This is important because:

- recurring subscription
- recurring bill
- recurring EMI

drive watchouts and protected dues more than category alone.

## Product Output Use

Categorization currently feeds:

- daily-needs estimation
- upcoming dues estimation
- recurring watchouts
- forgotten-subscription surfacing
- explanation generation

## Current Limits

- no LLM-first categorization
- no user-facing correction loop yet for every ambiguous transaction
- long-tail merchant coverage is still incomplete
