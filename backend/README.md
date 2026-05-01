# Life Ledger MoneyOS Backend

## What This Backend Does Today

This FastAPI backend powers the current MoneyOS demo build. The product is no longer framed as a budgeting tool first. It is a cashflow clarity engine focused on one question:

`Will my money last till the next income?`

Current implemented scope:

- auth-light early-access flow with profile + session persistence
- persona-aware onboarding profile
- sample statement seeding for first-run demos
- CSV import foundation with normalization and deduplication
- rule-based categorization and recurring-pattern detection
- cashflow summary engine for:
  - safe-to-spend
  - safe-till date
  - upcoming dues
  - daily-needs coverage
  - bank money seen this cycle
  - cash on hand
  - action-oriented watchouts and explanations
- manual ledger updates for:
  - cash in hand
  - cash received
  - big spend
  - due paid
- source-aware manual events:
  - cash
  - online / UPI
  - credit card
  - split cash + online
- lightweight upcoming due creation

## What Is Still Limited

- auth is still a demo/early-access stub, not email/OTP
- real CSV import exists as a foundation, but sample data is still the strongest first-run path
- due detection from imported statements is partly inferred, but full named due management is still evolving
- insights and coach are not trustworthy product surfaces yet
- no live bank, UPI, or Account Aggregator integration

## Main API Areas

Core routes currently in use:

- `POST /auth/demo-login`
- `GET /profiles/me`
- `PUT /profiles/me`
- `POST /demo/sample-statement`
- `GET /cashflow/summary`
- `POST /ledger-entries`
- `POST /upcoming-dues`
- `POST /imports/files`

## Cashflow Model

The summary engine protects money in this order:

1. upcoming dues
2. expected daily needs till next income
3. only then `safe_to_spend`

Key response fields:

- `safe_to_spend`
- `safe_till_date`
- `upcoming_dues_total`
- `daily_needs_required`
- `daily_needs_buffer`
- `liquid_balance`
- `cash_on_hand`
- `shortfall_amount`
- `watchouts`
- `latest_activity_date`

Important product note:

- `liquid_balance` is **not** a live bank balance
- it represents bank / UPI money observed in the current income cycle after imported and manual bank-like activity

## Import Notes

Current import endpoint:

- `POST /imports/files`

Current behavior:

- parses CSV files into normalized transactions
- supports XLSX / XLS readers when optional dependencies are installed
- deduplicates using user, date, amount, direction, cleaned description, and source
- feeds categorization and recurring-spend detection

Current limitations:

- deterministic heuristics only
- limited bank/card template coverage
- no async/background import job pipeline yet
- no statement-review UI loop on backend by itself

## Local Run

1. Create a virtual environment and install dependencies:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Start the API:

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

3. Open:

- API: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`

For phone testing on the same Wi-Fi, open:

- `http://YOUR_LAN_IP:8000/docs`

## Local Database

Default local database:

- `sqlite:///./life_ledger.db`

For PostgreSQL:

```bash
export DATABASE_URL="postgresql+psycopg://user:password@localhost:5432/life_ledger"
```

## Current Demo Usage

The backend is still auth-light for now.

- most requests can include `user_id`
- if omitted, the app may fall back to the current demo user behavior

This is acceptable for local demos and internal testing, but it is not production auth.
