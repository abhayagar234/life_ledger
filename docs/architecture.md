# Life Ledger Architecture

## Current Phase

Phase 1: Product blueprint

## Product Scope

Life Ledger starts with a single module called MoneyOS. The v1 goal is a functional demo app for manual money tracking, cash visibility, loan and EMI tracking, CSV import, backend normalization, basic insights, simple budgeting support, and AI coaching in plain language.

The v1 system should:

- work well on low-end mobile devices
- support irregular income and heavy cash usage
- keep ledger entry usable without bank integrations
- treat AI as assistive, not foundational
- stay simple enough for one backend and one mobile app team to ship quickly

The v1 system should not include:

- live bank account aggregation
- UPI integrations
- Account Aggregator integrations
- OCR-heavy document pipelines
- complex event-driven microservices
- fine-tuned ML models

## High-Level Architecture

The MVP uses a straightforward client-server design.

1. Mobile app: React Native with Expo and TypeScript
2. API layer: FastAPI
3. Primary database: PostgreSQL
4. Background processing: lightweight async jobs with Redis-backed queue or simple background workers
5. CSV processing: pandas or polars in the backend
6. AI services: external LLM API later for coaching and categorization fallback

## System Components

### 1. Mobile App

Primary responsibilities:

- onboarding and user-type selection
- manual ledger entry
- cash balance tracking
- loan, EMI, and interest entry
- CSV upload flow
- transaction list and grouped insights
- simple budget views
- AI coach chat or card-based prompts

Mobile design rules:

- mobile-first and thumb-friendly
- simple language with icons and examples
- adaptive home screen by user type
- limited choices per screen
- safe offline-first assumptions for entry capture where possible

### 2. Backend API

Primary responsibilities:

- authentication bootstrap suitable for demo environments
- account, wallet, ledger, loan, budget, and insight APIs
- CSV upload endpoints
- normalization and deduplication pipeline
- rule-based categorization
- coaching prompt orchestration

The backend remains modular but monolithic in deployment. This keeps operations simple while preserving enough separation for growth.

Suggested modules:

- `auth`
- `users`
- `profiles`
- `ledgers`
- `transactions`
- `cash_accounts`
- `loans`
- `budgets`
- `imports`
- `insights`
- `coach`

### 3. Database

PostgreSQL stores:

- user profile and persona selections
- ledger accounts and cash balances
- manual transactions
- loans, EMI schedules, and interest terms
- uploaded CSV file metadata
- normalized transactions
- deduplication fingerprints
- category assignments
- budget rules and budget periods
- generated insight snapshots
- coach conversation summaries if needed later

### 4. Background Jobs

Background jobs are used only where waiting would harm the UX:

- CSV parsing
- normalization
- deduplication
- bulk categorization
- insight refresh

The initial demo can use FastAPI background tasks. If job volume grows, move to Redis-backed workers without changing product behavior.

### 5. AI Layer

AI is used only after the ledger works without it.

Planned v1 AI uses:

- explain spending in simple language
- suggest budget actions
- summarize cash flow patterns
- ask clarifying questions for unclear categories

AI should not be the source of truth for balances, transaction storage, or core bookkeeping logic.

## Core MVP Flows

1. User selects profile type during onboarding
2. User lands on a tailored home screen
3. User adds manual income, expense, transfer, or loan event
4. User optionally uploads CSV from wallet, bank export, or statement
5. Backend parses, normalizes, and deduplicates transactions
6. App shows grouped spending, cash status, and budget progress
7. AI coach offers simple guidance based on ledger data

## Data Ownership Boundaries

Mobile app owns:

- UI state
- local draft entries
- upload initiation
- rendering of personalized flows

Backend owns:

- canonical transaction records
- normalization
- deduplication
- categorization rules
- budget calculations
- insight generation
- AI prompt assembly and safety controls

## Simplicity Decisions

To keep v1 practical:

- use one primary ledger model for all persona types
- model cash as an account, not a special-case side system
- use rule-based categorization first
- use CSV ingestion as the bridge to external financial data
- postpone multilingual expansion until the English-first demo flow is stable
- postpone family multi-user collaboration to a later phase unless needed for demo polish

## Deployment Shape

Recommended demo deployment:

- Expo app for mobile clients
- FastAPI app deployed as a single service
- PostgreSQL as managed database
- Redis only if async workloads justify it
- object storage for CSV files if upload retention is needed

## Security and Privacy Baseline

Even for demo quality, the system should:

- minimize stored PII
- encrypt secrets and API keys
- avoid sending raw financial history to AI unless needed
- log imports and processing outcomes for debugging
- keep audit-friendly timestamps on financial records

## Future Expansion Path

This architecture leaves room for:

- richer financial connectors
- multilingual interfaces
- household shared ledgers
- health record modules
- reminders and repayment nudges
- OCR and document extraction

Those are future layers on top of the stable ledger, import, and insight foundation built in v1.
