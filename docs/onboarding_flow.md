# MoneyOS Onboarding Flow

## Goal

Help a new user reach a useful dashboard and complete a first money action in under 2 minutes.

The onboarding should feel calm, guided, and trustworthy. It should not ask for anything that is not needed for first value.

## UX Principles

- one question per screen
- large tap targets
- short labels
- clear icons with text
- explain why a question matters
- allow skipping optional setup
- never block usage on CSV import
- never ask for live bank, UPI, or Account Aggregator connection in v1

## Onboarding Sequence

### Screen 1. Welcome

Purpose:

- explain what the app does
- reduce fear
- set expectation that manual use works

Primary content:

- title: `Money made simple`
- supporting text: `Track income, expense, cash, and loans in one place.`
- trust line: `No bank connection needed to start.`

Primary action:

- `Start`

Secondary action:

- none

### Screen 2. User Type

Question:

- `What fits you best?`

Options:

- salaried
- daily wage
- farmer / seasonal
- business / self-employed
- family manager

UI pattern:

- large icon cards
- 1 short subtitle under each option

Reason shown:

- `We will show the right home screen and shortcuts for you.`

### Screen 3. Income Rhythm

Question:

- `How does money usually come in?`

Options:

- daily
- weekly
- monthly
- seasonal
- mixed

UI pattern:

- vertical choice list with icon + label

Reason shown:

- `This helps us show the right summary and reminders.`

### Screen 4. Cash Setup

Question:

- `Do you want to track cash in hand?`

Options:

- yes
- not now

If yes:

- input: starting cash amount
- helper text: `Example: wallet cash + home cash`

Reason shown:

- `Many people spend in cash. This helps show what is left.`

### Screen 5. Loans And EMI

Question:

- `Do you want to track loans or EMI?`

Options:

- yes
- later

If yes:

- sub-options:
- `I took a loan`
- `I gave money to someone`
- `I pay EMI`

Reason shown:

- `This helps you see what is due and what is pending.`

### Screen 6. CSV Import Choice

Question:

- `Do you want to import a CSV now?`

Options:

- import now
- do it later

Helper text:

- `You can also start with manual entry.`

Reason shown:

- `CSV import can save time, but it is optional.`

### Screen 7. First Action

Purpose:

- avoid dropping the user on an empty home
- create immediate success

Primary choices:

- add income
- add expense
- set cash
- add loan

Behavior:

- after one action, land on the user’s home dashboard

## Persona-Based Variants

The onboarding engine is shared. Only the wording, follow-up question, and default first action change by user type.

### Salaried Variant

Extra question:

- `When do you usually get salary?`

Default home emphasis:

- this month spent
- cash left
- upcoming bills and EMI

Recommended first action:

- add salary

### Irregular Income Variant

This covers daily wage users and seasonal earners.

Extra question:

- `Do you want to see money by day or by season?`

If daily wage:

- home emphasis:
- earned today
- spent today
- cash left

Recommended first action:

- add today’s earning

If farmer / seasonal:

- home emphasis:
- recent income
- loans due
- home vs work spend

Recommended first action:

- add latest income

### Business / Self-Employed Variant

Extra question:

- `Do you want to track home and business together or separately?`

Default home emphasis:

- money in
- money out
- dues
- cash balance

Recommended first action:

- add sale

## Happy Path Timing

Target time:

- welcome: 5 seconds
- user type: 10 seconds
- income rhythm: 10 seconds
- cash setup: 15 seconds
- loans and EMI: 15 seconds
- CSV choice: 10 seconds
- first action: 20 to 30 seconds

Total target:

- under 2 minutes

## Empty States During Onboarding

- no cash added yet: `Add cash now or do it later.`
- no loan setup yet: `You can track this later too.`
- CSV skipped: `No problem. You can import later from the home screen.`

## Error States During Onboarding

- invalid amount: `Enter numbers only`
- no selection made: `Choose one option to continue`
- import selected but no file chosen: `Pick a CSV file or skip for now`

## Acceptance Criteria

- user can complete onboarding in under 2 minutes
- each screen asks only one main question
- every option has both icon and text
- skipping optional steps still leads to a useful dashboard
- onboarding ends with a first money action, not an empty home
- no onboarding step asks for live account linking
