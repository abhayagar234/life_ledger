# MoneyOS Data Model

## Goal

Define a simple, extensible MVP schema for MoneyOS that supports:

- manual ledger entry
- cash tracking
- loans and EMI
- budgets and goals
- CSV import
- normalization and deduplication
- monthly summaries
- AI coaching outputs

The model should stay correct for real money flows while remaining easy to implement in a FastAPI + PostgreSQL + SQLAlchemy stack.

## Data Modeling Principles

- one user owns one primary MoneyOS workspace in v1
- keep raw imported data separate from normalized data
- keep manual entries and imported transactions traceable
- do not build double-entry accounting in v1
- use one flexible ledger entry model for manual actions
- support user persona and income pattern as profile metadata
- leave room for business versus personal tagging later without forcing it now

## Core Entities

### 1. users

Purpose:

- authentication identity and top-level owner of all financial data

Key fields:

- `id` UUID PK
- `phone_number` nullable unique
- `email` nullable unique
- `display_name`
- `is_active`
- `created_at`
- `updated_at`

Notes:

- v1 can work with lightweight auth or demo auth
- personally sensitive data should stay minimal

### 2. financial_profiles

Purpose:

- store persona, income style, onboarding configuration, and future product tailoring

Relationship:

- one-to-one with `users`

Key fields:

- `id` UUID PK
- `user_id` FK -> `users.id`
- `user_type`
- `income_pattern`
- `tracks_cash` boolean
- `tracks_loans` boolean
- `tracks_emi` boolean
- `tracking_scope` enum-like string
- `currency_code` default `INR`
- `start_cash_amount` numeric nullable
- `salary_day_of_month` nullable smallint
- `business_mode_enabled` boolean default false
- `onboarding_completed_at` nullable timestamp
- `created_at`
- `updated_at`

Suggested enums:

- `user_type`: `salaried`, `daily_wage`, `farmer_seasonal`, `business_self_employed`, `family_manager`
- `income_pattern`: `daily`, `weekly`, `monthly`, `seasonal`, `mixed`
- `tracking_scope`: `personal`, `household`, `home_and_business`

### 3. dependents

Purpose:

- lightweight support for household context and future family-aware summaries

Relationship:

- many dependents per user

Key fields:

- `id` UUID PK
- `user_id` FK -> `users.id`
- `name`
- `relationship_label`
- `birth_year` nullable
- `notes` nullable
- `created_at`
- `updated_at`

Notes:

- not required for v1 core flows
- used mainly for future family planning and goal context

### 4. ledger_entries

Purpose:

- canonical manual money events entered by the user

Relationship:

- many ledger entries per user

Key fields:

- `id` UUID PK
- `user_id` FK -> `users.id`
- `entry_type`
- `amount` numeric(14,2)
- `currency_code` default `INR`
- `entry_date`
- `account_type`
- `counterparty_name` nullable
- `category_code` nullable
- `subcategory_code` nullable
- `description` nullable
- `source_label` nullable
- `cash_direction` nullable
- `loan_id` nullable FK -> `loans.id`
- `emi_payment_id` nullable FK -> `emi_payments.id`
- `is_business` boolean nullable
- `is_system_generated` boolean default false
- `created_at`
- `updated_at`

Suggested enums:

- `entry_type`: `income`, `expense`, `transfer`, `cash_adjustment`, `loan_disbursal`, `loan_repayment`, `interest_charge`, `emi_payment`
- `account_type`: `cash`, `bank`, `wallet`, `card`, `other`
- `cash_direction`: `in`, `out`, `set`, `adjust`

Notes:

- this is the main table powering manual tracking
- cash balance is computed from entries, not stored as a separate truth table in v1

### 5. loans

Purpose:

- track borrowed money, lent money, and simple dues

Relationship:

- one user has many loans
- one loan has many `emi_payments`
- one loan may link to many `ledger_entries`

Key fields:

- `id` UUID PK
- `user_id` FK -> `users.id`
- `loan_type`
- `counterparty_name`
- `principal_amount` numeric(14,2)
- `currency_code` default `INR`
- `interest_type`
- `interest_rate` nullable numeric(8,4)
- `flat_interest_amount` nullable numeric(14,2)
- `start_date`
- `due_date` nullable
- `emi_amount` nullable numeric(14,2)
- `emi_frequency` nullable
- `outstanding_principal` nullable numeric(14,2)
- `status`
- `notes` nullable
- `is_business` boolean nullable
- `created_at`
- `updated_at`

Suggested enums:

- `loan_type`: `borrowed`, `lent`, `informal_due`
- `interest_type`: `none`, `flat`, `monthly_percent`, `annual_percent`
- `emi_frequency`: `monthly`, `weekly`, `custom`
- `status`: `active`, `closed`, `overdue`

Notes:

- `informal_due` supports simple `someone owes me / I owe someone`
- outstanding balance may be materialized for speed but must come from payments and adjustments

### 6. emi_payments

Purpose:

- store scheduled or completed EMI and repayment events

Relationship:

- many EMI payments per loan

Key fields:

- `id` UUID PK
- `user_id` FK -> `users.id`
- `loan_id` FK -> `loans.id`
- `due_date`
- `amount_due` numeric(14,2)
- `principal_component` nullable numeric(14,2)
- `interest_component` nullable numeric(14,2)
- `amount_paid` numeric(14,2) default 0
- `paid_date` nullable
- `status`
- `source_type`
- `ledger_entry_id` nullable FK -> `ledger_entries.id`
- `created_at`
- `updated_at`

Suggested enums:

- `status`: `pending`, `paid`, `partial`, `missed`
- `source_type`: `manual`, `generated_schedule`, `imported`

Notes:

- this table can represent both EMIs and scheduled repayments for simpler loan flows

### 7. budgets

Purpose:

- define simple spending limits for a month or other period

Relationship:

- many budgets per user

Key fields:

- `id` UUID PK
- `user_id` FK -> `users.id`
- `name`
- `period_type`
- `start_date`
- `end_date`
- `category_code` nullable
- `limit_amount` numeric(14,2)
- `spent_amount_snapshot` nullable numeric(14,2)
- `status`
- `created_at`
- `updated_at`

Suggested enums:

- `period_type`: `weekly`, `monthly`, `seasonal`, `custom`
- `status`: `active`, `completed`, `archived`

Notes:

- v1 budgets should be category or bucket based, not envelope-accounting heavy

### 8. goals

Purpose:

- simple planning targets like emergency fund, school fee, festival fund, or debt payoff

Relationship:

- many goals per user

Key fields:

- `id` UUID PK
- `user_id` FK -> `users.id`
- `goal_type`
- `name`
- `target_amount` numeric(14,2)
- `current_amount` numeric(14,2) default 0
- `target_date` nullable
- `priority_level` nullable
- `status`
- `notes` nullable
- `created_at`
- `updated_at`

Suggested enums:

- `goal_type`: `savings`, `debt_payoff`, `education`, `medical`, `festival`, `business`, `other`
- `status`: `active`, `achieved`, `paused`, `cancelled`

### 9. import_files

Purpose:

- represent each uploaded CSV file and its processing lifecycle

Relationship:

- one import file has many import rows
- one user has many import files

Key fields:

- `id` UUID PK
- `user_id` FK -> `users.id`
- `file_name`
- `storage_path` nullable
- `source_kind`
- `source_label` nullable
- `file_hash`
- `status`
- `uploaded_at`
- `processed_at` nullable
- `total_rows` nullable integer
- `imported_rows` nullable integer
- `duplicate_rows` nullable integer
- `error_rows` nullable integer
- `notes` nullable

Suggested enums:

- `source_kind`: `bank_csv`, `card_csv`, `wallet_csv`, `other_csv`
- `status`: `uploaded`, `processing`, `processed`, `failed`, `partial`

Notes:

- file hash is used for same-file dedup and auditability

### 10. import_rows

Purpose:

- preserve raw imported row data before cleaning

Relationship:

- many rows per import file

Key fields:

- `id` UUID PK
- `import_file_id` FK -> `import_files.id`
- `user_id` FK -> `users.id`
- `row_number`
- `raw_data` JSONB
- `raw_description` nullable
- `raw_amount` nullable string
- `raw_date` nullable string
- `parse_status`
- `parse_errors` JSONB nullable
- `created_at`

Suggested enums:

- `parse_status`: `pending`, `parsed`, `invalid`, `skipped`

Notes:

- keep raw strings even if parsing fails
- this makes debugging and user review much easier

### 11. normalized_transactions

Purpose:

- canonical imported transaction records after mapping, parsing, and normalization

Relationship:

- many normalized transactions per user
- optional link to one import row

Key fields:

- `id` UUID PK
- `user_id` FK -> `users.id`
- `import_file_id` FK -> `import_files.id`
- `import_row_id` FK -> `import_rows.id`
- `transaction_date`
- `posted_date` nullable
- `amount` numeric(14,2)
- `direction`
- `currency_code` default `INR`
- `description`
- `merchant_name` nullable
- `counterparty_name` nullable
- `account_type`
- `source_account_last4` nullable
- `category_code` nullable
- `subcategory_code` nullable
- `dedupe_fingerprint`
- `dedupe_status`
- `review_status`
- `is_business` boolean nullable
- `created_at`
- `updated_at`

Suggested enums:

- `direction`: `credit`, `debit`
- `account_type`: `bank`, `wallet`, `card`, `cash_other`, `unknown`
- `dedupe_status`: `unique`, `possible_duplicate`, `duplicate`
- `review_status`: `pending`, `reviewed`, `accepted`, `rejected`

Notes:

- imported transactions remain separate from manual `ledger_entries`
- reporting can union both sources at the service layer
- if future product needs a unified transaction feed table, it can be built later

### 12. monthly_summaries

Purpose:

- cached monthly aggregates for fast dashboard rendering

Relationship:

- many summaries per user

Key fields:

- `id` UUID PK
- `user_id` FK -> `users.id`
- `year`
- `month`
- `income_total` numeric(14,2)
- `expense_total` numeric(14,2)
- `cash_in_total` numeric(14,2)
- `cash_out_total` numeric(14,2)
- `loan_due_total` numeric(14,2)
- `emi_due_total` numeric(14,2)
- `top_categories` JSONB
- `budget_status` JSONB nullable
- `summary_payload` JSONB nullable
- `generated_at`

Constraints:

- unique on (`user_id`, `year`, `month`)

Notes:

- treat as a cache or snapshot table, not the source of truth

### 13. llm_insights

Purpose:

- store simple AI-generated coaching outputs and explanation cards

Relationship:

- many insights per user

Key fields:

- `id` UUID PK
- `user_id` FK -> `users.id`
- `insight_type`
- `title`
- `message`
- `action_label` nullable
- `action_payload` JSONB nullable
- `source_period_start` nullable
- `source_period_end` nullable
- `source_summary_id` nullable FK -> `monthly_summaries.id`
- `status`
- `model_name` nullable
- `prompt_version` nullable
- `created_at`
- `dismissed_at` nullable

Suggested enums:

- `insight_type`: `budget_warning`, `cash_flow_tip`, `loan_alert`, `spend_summary`, `goal_tip`
- `status`: `active`, `dismissed`, `expired`

Notes:

- only store short user-facing outputs and metadata
- do not store full raw prompts if avoidable

## Entity Relationship Summary

Main ownership:

- `users` -> one `financial_profiles`
- `users` -> many `dependents`
- `users` -> many `ledger_entries`
- `users` -> many `loans`
- `users` -> many `emi_payments`
- `users` -> many `budgets`
- `users` -> many `goals`
- `users` -> many `import_files`
- `users` -> many `import_rows`
- `users` -> many `normalized_transactions`
- `users` -> many `monthly_summaries`
- `users` -> many `llm_insights`

Operational relationships:

- `import_files` -> many `import_rows`
- `import_rows` -> zero or one `normalized_transactions`
- `loans` -> many `emi_payments`
- `loans` -> many `ledger_entries`
- `emi_payments` -> optional one `ledger_entries`
- `monthly_summaries` -> many `llm_insights`

## Source-Of-Truth Strategy

Use these rules to avoid confusion:

- `ledger_entries` are the source of truth for manual money events
- `import_rows` are the source of truth for uploaded raw data
- `normalized_transactions` are the source of truth for cleaned imported data
- `monthly_summaries` are cached aggregates
- `llm_insights` are generated guidance, not financial truth

## Manual And Imported Data Strategy

Manual and imported data should both power the user experience, but should stay distinct in storage.

Why:

- manual entries may represent cash events not present in imports
- imported records may contain noisy or duplicate data
- separating them keeps reconciliation and debugging simpler

Reporting approach:

- build a service-layer `unified activity feed`
- merge `ledger_entries` and `normalized_transactions` into one response shape for UI
- preserve source metadata so the UI can label rows as `manual` or `imported`

## Category Model

For v1, category codes can remain string-based instead of a full normalized category table.

Suggested category codes:

- `income_salary`
- `income_wage`
- `income_seasonal`
- `income_sale`
- `expense_food`
- `expense_travel`
- `expense_home`
- `expense_school`
- `expense_medicine`
- `expense_business`
- `expense_bill`
- `expense_loan_payment`
- `transfer_cash`
- `transfer_internal`

This keeps categorization logic simple and easy to version in YAML later.

## Personal Vs Business Support

The MVP should not build full business accounting, but should leave room for mixed use.

Support this with:

- `financial_profiles.business_mode_enabled`
- nullable `is_business` on `ledger_entries`, `loans`, and `normalized_transactions`
- optional `tracking_scope` on `financial_profiles`

This is enough for later filtering without multiplying entity types now.

## SQLAlchemy Model Plan

Suggested SQLAlchemy files:

- `app/models/user.py`
- `app/models/financial_profile.py`
- `app/models/dependent.py`
- `app/models/ledger_entry.py`
- `app/models/loan.py`
- `app/models/emi_payment.py`
- `app/models/budget.py`
- `app/models/goal.py`
- `app/models/import_file.py`
- `app/models/import_row.py`
- `app/models/normalized_transaction.py`
- `app/models/monthly_summary.py`
- `app/models/llm_insight.py`
- `app/models/enums.py`
- `app/models/base.py`

Implementation guidance:

- use UUID primary keys
- use SQLAlchemy 2.x typed declarative models
- use `Numeric(14, 2)` for money amounts
- use `JSONB` for raw row payloads, summary payloads, and AI action payloads
- use DB constraints for simple enums where helpful, or PostgreSQL enums if the team wants stricter typing
- add `created_at` and `updated_at` to mutable entities

Indexes to add early:

- `ledger_entries(user_id, entry_date)`
- `ledger_entries(user_id, entry_type)`
- `loans(user_id, status)`
- `emi_payments(user_id, due_date, status)`
- `import_files(user_id, uploaded_at)`
- `import_files(file_hash)`
- `import_rows(import_file_id, row_number)`
- `normalized_transactions(user_id, transaction_date)`
- `normalized_transactions(dedupe_fingerprint)`
- `monthly_summaries(user_id, year, month)` unique
- `llm_insights(user_id, status, created_at)`

## Migration Plan

### Migration 001: Core User And Profile

Create:

- `users`
- `financial_profiles`
- `dependents`

### Migration 002: Manual Ledger And Loans

Create:

- `ledger_entries`
- `loans`
- `emi_payments`

### Migration 003: Planning Tables

Create:

- `budgets`
- `goals`

### Migration 004: Import Pipeline

Create:

- `import_files`
- `import_rows`
- `normalized_transactions`

### Migration 005: Aggregates And AI

Create:

- `monthly_summaries`
- `llm_insights`

### Migration 006: Constraints And Performance

Add:

- unique constraints
- check constraints
- indexes
- foreign key cascade behavior where appropriate

## Recommended Cascade Rules

- deleting a user should cascade to all child records in non-production demo environments
- deleting an `import_file` should cascade to `import_rows` and `normalized_transactions`
- deleting a `loan` should not silently delete payment history in production-minded setups; prefer soft-delete later if needed

## Open Implementation Decisions

- whether to use PostgreSQL native enums or string columns with check constraints
- whether `monthly_summaries` are rebuilt nightly or on-demand after changes
- whether EMI schedules are manually created or partially auto-generated from loan setup

## MVP Recommendation

For the first implementation:

- use string enums plus application validation
- compute monthly summaries in background jobs after writes and imports
- keep loans flexible and allow manual EMI schedule creation

This gives the team a clean foundation without locking into overly complex accounting behavior.
