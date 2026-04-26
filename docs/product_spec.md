# Life Ledger MoneyOS MVP Product Blueprint

## Product Summary

MoneyOS is the first module of Life Ledger. It is a mobile-first money app for Indians who need a simple way to track income, expenses, cash, loans, EMI, and monthly money status without relying on live bank integrations.

The MVP is meant to be good enough for a real demo with family and friends. It should feel useful on day one, especially for users who:

- mix cash and digital spending
- have irregular income
- manage family money for others
- are not comfortable with complex finance apps

## Target Users

Primary user types:

- salaried users
- daily wage workers
- farmers and seasonal earners
- business owners and self-employed users
- family money managers

## Core User Jobs

Users should be able to:

- record income
- record expense
- record cash balance or cash adjustment
- record a loan or money due
- record EMI and interest payments
- upload CSV exports from bank, card, or wallet statements
- see grouped spending by category
- see a monthly summary
- receive simple budgeting advice

## Product Principles

- mobile-first
- low-literacy friendly
- plain language over finance jargon
- icons and large tap areas over dense forms
- cash-first, not bank-first
- irregular income is normal, not an edge case
- AI is a coach, not the ledger itself
- demo quality should favor clarity and usefulness over breadth

## Main User Pain Points

- users forget small cash spending
- many users do not know their real cash-on-hand amount
- income may be daily, weekly, seasonal, or mixed
- loans and EMI are often tracked in memory, paper, or chat
- finance apps often assume steady salary and auto-sync
- current tools feel too complex, English-heavy, or judgmental

## MVP Value Proposition

MoneyOS should answer these questions simply:

- how much money came in?
- how much money went out?
- how much cash is left?
- what loan or EMI is due?
- where is most spending happening?
- what is one simple thing I should do next?

## v1 Scope

### Included In v1

- persona-based onboarding
- manual income entry
- manual expense entry
- manual transfer and cash adjustment entry
- cash account tracking
- loan tracking for borrowed and lent money
- EMI tracking with due date and payment status
- CSV upload from external exports
- backend normalization and deduplication of imported rows
- rule-based category grouping
- monthly summary view
- basic budgets by category or spending bucket
- simple AI budgeting and coaching guidance

### Explicit Non-Goals For v1

- live bank integrations
- UPI integrations
- Account Aggregator integrations
- health module
- investment tracking
- tax filing
- insurance workflows
- full accounting for businesses
- OCR-first document ingestion
- multi-user family collaboration
- custom ML training or fine-tuning

## Feature Priority

### Must

- choose user type during onboarding
- add income manually
- add expense manually
- create and view cash balance
- create and track a loan
- create and track EMI or interest obligation
- upload CSV file
- normalize imported transactions into one format
- deduplicate obvious repeated imports
- auto-assign or suggest category groups using simple rules
- show monthly money summary
- show top spending categories
- give simple budget advice in plain language

### Should

- adaptive home screen by persona
- quick-add shortcuts like “earned today” or “spent cash”
- flag uncertain imported rows for review
- budget warning when a category is crossing limit
- simple reminders for EMI and loan due dates
- coaching cards that explain recent spending behavior

### Later

- bilingual or multilingual UI
- household shared access
- OCR on bills or passbooks
- recurring transaction templates
- richer insights and trends
- live sync with financial accounts

## Demo-First UX Requirements

- first transaction should be possible in under one minute
- one clear primary action on each main screen
- labels should use simple money words like `income`, `expense`, `cash`, `loan`, `due`
- monthly summary should be understandable without charts
- CSV import should not be required to get value
- AI should appear only after enough data exists to say something useful

## MVP Screens

- welcome and trust screen
- user type selection
- simple setup questions
- home dashboard
- add income
- add expense
- cash balance / cash adjustment
- loans and EMI tracker
- CSV import flow
- transactions list
- category summary
- monthly summary
- budget advice / coach card screen

## Acceptance Criteria

### Product Acceptance

- a new user can complete onboarding in under 2 minutes
- a new user can add income, expense, and cash entries without training
- a user can create at least one loan or EMI entry and view its status
- a user can import a CSV and see normalized transactions
- repeated CSV import of the same file does not double-count obvious duplicates
- grouped spending and monthly summary are visible after data entry
- budget advice is written in plain, short sentences

### Demo Acceptance

- a family or friend can understand the main flow without explanation
- the app is still useful even if no bank data is connected
- each target persona sees a believable first-run experience
- the product feels focused, not overloaded

## Success Criteria

The MVP is successful if demo users can:

1. pick a persona that feels close to their life
2. add a few real money records quickly
3. understand cash left, monthly spending, and upcoming dues
4. see at least one useful budget or coaching suggestion
5. feel the app is simple enough to keep using

## Risks To Avoid

- over-designing for future integrations
- building too many account types early
- making onboarding too long
- relying on AI before the ledger is solid
- showing complex graphs before clear summaries

## Recommended Build Order

1. lock onboarding and core screens
2. lock data model and API contract
3. build manual ledger and cash tracking
4. build loans and EMI tracking
5. build CSV import, normalization, and deduplication
6. add category grouping and monthly summary
7. layer in budget advice and simple AI coaching
