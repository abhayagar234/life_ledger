# Life Ledger MoneyOS Backend

## What This Is

MVP FastAPI backend scaffold for MoneyOS.

Current scope:

- demo auth scaffold
- onboarding profile
- manual ledger entries
- loans
- budgets
- goals
- file import for CSV with Excel readers wired in
- insights stub
- AI coach stub
- EMI payments
- monthly summary

Still stubbed:

- real auth
- richer source-specific mapping templates
- real insights generation
- real AI coaching
- live financial integrations

## Ingestion Notes

Current import endpoint:

- `POST /imports/files`

Current support:

- CSV parsing and normalization implemented
- XLSX and XLS readers supported when dependencies are installed
- dedupe based on user, date, amount, direction, cleaned description, and source

Current limitations:

- deterministic heuristics only
- limited source templates
- no async background processing yet

## Local Run

1. Create a virtual environment and install dependencies:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Start the app:

```bash
uvicorn app.main:app --reload
```

3. Open:

- API: `http://127.0.0.1:8000`
- Docs: `http://127.0.0.1:8000/docs`

## Local Database

By default, the app uses SQLite for easy local startup:

- `sqlite:///./life_ledger.db`

To use PostgreSQL later, set:

```bash
export DATABASE_URL="postgresql+psycopg://user:password@localhost:5432/life_ledger"
```

## Demo Usage

The API is auth-light for now. Every request can optionally include a `user_id` query parameter.

If omitted, the backend uses a default demo user.
