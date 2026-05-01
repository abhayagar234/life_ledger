# MoneyOS Data Model

## Goal

Describe the current core data shape behind the MoneyOS demo app.

The model exists to support:

- onboarding profile
- imported statement history
- manual corrections
- protected dues
- cashflow summary generation

It is not intended to be a full accounting schema.

## Data Modeling Principles

- imported and manual data should stay traceable
- current money logic must be explainable
- user corrections should be lightweight
- dues should be representable even before full due-management UX exists

## Core Entities

### 1. `users`

Purpose:

- top-level identity owner

Notes:

- current auth is light/demo-oriented
- production auth is not built yet

### 2. `financial_profiles`

Purpose:

- store onboarding choices and money context

Important fields:

- `display_name`
- `user_type`
- `income_pattern`
- `tracks_cash`
- `start_cash_amount`
- `salary_day_of_month`
- `onboarding_completed_at`

### 3. `ledger_entries`

Purpose:

- store lightweight manual money events

Current product-facing examples:

- cash in hand
- cash received
- big spend
- due paid

Important product traits:

- manual entries can be source-aware
- source can reflect cash, online / UPI, card, or split behavior

### 4. `imports`

Purpose:

- metadata for uploaded statement files

### 5. `raw_import_rows`

Purpose:

- preserve imported source rows for traceability

### 6. `normalized_transactions`

Purpose:

- canonical imported transaction layer used by categorization and cashflow logic

Important role:

- this is the statement-backed history that drives most automatic inference

### 7. `loans`

Purpose:

- lightweight storage for formal or informal due containers

Current product use:

- manual upcoming due creation uses this model as a simple backing record

### 8. `emi_payments`

Purpose:

- represent payable due items with amount, date, and payment status

Current product use:

- manual upcoming dues are stored through this layer
- due-paid logic can reduce protected dues through this layer

## What The Current Model Supports Well

- onboarding personalization
- sample/imported transaction history
- manual cash and spend corrections
- protected dues total
- explanation-friendly summary calculations

## What The Current Model Does Not Yet Fully Support

- polished named due list with paid strike-through state on Home
- rich recurring-due lifecycle management
- multi-account truth as a first-class visible concept
- real auth/account security flows
