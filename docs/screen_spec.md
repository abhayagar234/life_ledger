# MoneyOS Screen Spec

## Purpose

Define the MVP mobile screens for MoneyOS with a strong focus on simplicity, clarity, and fast manual use.

The app should feel premium by being calm, confident, and easy to scan. It should not feel busy, technical, or finance-heavy.

## Design Direction

- mobile-first
- clean spacing
- high contrast
- big tap areas
- soft cards with clear hierarchy
- icons paired with plain text
- summary before detail
- grouped insights before raw transaction list

## Navigation Map

Primary navigation should use 4 bottom tabs:

- Home
- Insights
- Loans
- You

A floating primary action button should open `Add Entry`.

Secondary stacked screens:

- onboarding screens
- add income
- add expense
- add cash
- add loan / EMI
- CSV import
- transaction details
- category details
- AI coach

## Screen List

### 1. Welcome

Goal:

- explain value and build trust

Primary action:

- `Start`

### 2. User Type Selection

Goal:

- place the user into the right dashboard pattern

UI:

- icon card grid or stacked cards

### 3. Income Rhythm

Goal:

- pick the right summary frame

UI:

- large radio-card list

### 4. Cash Setup

Goal:

- capture initial cash if relevant

UI:

- yes/no choice
- single amount input

### 5. Loans / EMI Setup

Goal:

- identify whether dues should appear on home

UI:

- yes/later choice
- optional sub-choice

### 6. CSV Import Choice

Goal:

- offer import without making it mandatory

UI:

- two large actions: `Import now`, `Later`

### 7. Home Dashboard

Goal:

- answer the most important money question first

Shared layout:

- top summary card
- 2 to 4 quick action buttons
- dues / alerts strip
- grouped spending preview
- recent activity preview

Raw transaction list:

- only a short preview on home
- full list lives deeper in the flow

## Dashboard Variants

### A. Salaried Dashboard

Primary question answered:

- `How much can I safely spend before next salary?`

Top card:

- cash left
- month spent
- salary date or next income date

Quick actions:

- add expense
- add income
- set cash
- add EMI

Secondary modules:

- bills and EMI due
- top spend categories
- budget status

Recent activity:

- last 3 to 5 entries only

### B. Irregular Income Dashboard

This variant serves daily wage and farmer / seasonal users with slightly different labels.

Primary question answered:

- `Did money come in enough, and what is left now?`

Top card:

- today or recent income
- today or recent spend
- cash left

Quick actions:

- earned today
- spent cash
- add loan
- set cash

Secondary modules for daily wage:

- this week earnings
- today spend groups
- money due soon

Secondary modules for farmer / seasonal:

- season income
- home vs work spend
- loans and interest due

Recent activity:

- last few entries with larger amounts and icons

### C. Business / Self-Employed Dashboard

Primary question answered:

- `What came in, what went out, and what is still due?`

Top card:

- money in
- money out
- cash balance

Quick actions:

- add sale
- add expense
- add due
- set cash

Secondary modules:

- dues to collect
- dues to pay
- top spend buckets
- this week summary

Recent activity:

- short list with tags like `sale`, `expense`, `due`

## Add Entry Flow

The add flow should be the fastest path in the app.

### Add Entry Hub

Options:

- income
- expense
- cash
- loan / due
- EMI payment

UI:

- large icon tiles
- one-line examples under each option

### Add Income

Fields:

- amount
- source
- date
- note optional

Suggested quick sources:

- salary
- sale
- wage
- seasonal income
- other

### Add Expense

Fields:

- amount
- category
- paid by
- date
- note optional

Suggested quick categories:

- food
- travel
- home
- school
- medicine
- business

### Add Cash

Use cases:

- set opening cash
- cash added
- cash removed
- cash correction

Fields:

- amount
- action type
- location optional
- note optional

### Add Loan / EMI

Fields:

- type
- who
- amount
- due date
- interest optional
- paid / pending status

## CSV Import Flow

### Import Entry

Entry points:

- onboarding
- home shortcut
- profile / settings

### Upload Screen

Actions:

- choose file
- see supported examples
- continue

Helper text:

- `Import bank, card, or wallet CSV files`

### Mapping Review

Goal:

- show a simple preview of columns

UI:

- detected columns
- editable mapping chips
- preview of first few rows

### Import Result

Show:

- rows imported
- duplicates skipped
- rows needing review

Primary actions:

- view imported entries
- review uncertain rows later

## Insights Screen

Goal:

- show grouped spending first

Sections:

- top spending groups
- income vs expense summary
- monthly trend summary
- budget status

Rules:

- use simple bars or rings only if readable
- one insight card should say what changed in plain language
- raw list is not the hero content

## Loans Screen

Goal:

- keep dues simple and visible

Sections:

- due soon
- borrowed
- lent
- EMI list

Each loan card should show:

- name or label
- amount left
- due date
- status

Primary actions:

- add loan
- mark paid

## AI Coach Screen

Goal:

- offer calm, actionable advice

UI model:

- coach card list first
- optional chat later

Card examples:

- `Food spending is high this week`
- `EMI due in 3 days`
- `Cash is falling faster than usual`

Each card should include:

- short insight
- one suggested action
- simple explanation

## Empty States

### Home Empty

- `Start by adding income or expense`

Actions:

- add income
- add expense

### Insights Empty

- `Add a few entries to see spending groups`

Action:

- add entry

### Loans Empty

- `No loans or EMI yet`

Action:

- add loan

### CSV Empty

- `Import a CSV or continue with manual entry`

Actions:

- choose file
- skip

## Error States

### Generic Form Error

- `Please check the highlighted field`

### CSV Error

- `We could not read this file`
- `Try another CSV file or add entries manually`

### Network Error

- `Something went wrong`
- `Your data is safe. Try again`

### No Data Error

- `Nothing to show yet`

## Component List

- primary button
- secondary button
- icon card
- summary card
- metric pill
- quick action tile
- alert strip
- category bar row
- transaction preview row
- loan card
- coach card
- empty state card
- error banner
- amount input
- segmented selector
- bottom tab bar
- floating action button

## Build Notes

- preferred stack: React Native + Expo + TypeScript
- styling: NativeWind or a very small token-based design system
- use a single component language across all personas
- persona differences should come from content, module order, and labels more than fully different layouts
