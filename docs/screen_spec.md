# MoneyOS Screen Spec

## Purpose

Define the current MoneyOS mobile experience with a focus on survival clarity, low-friction updates, and trust.

The app should feel calm, specific, and easy to scan. It should not feel like a generic budgeting dashboard.

## Design Direction

- mobile-first
- one clear answer before detail
- high contrast
- big tap areas
- plain language over finance jargon
- status first, numbers second, explanations third
- named dues over abstract totals

## Navigation Map

Current primary tab experience is intentionally reduced:

- Home
- Setup

Other surfaces exist in the codebase, but incomplete tabs should not lead the experience.

Secondary stacked screens:

- onboarding screens
- add cash / due update
- add upcoming due
- import statement

## Current Screen List

### 1. Welcome

Goal:

- explain value and build trust

Primary action:

- `Start`

### 2. User Type Selection

Goal:

- place the user into the right money framing

UI:

- large role cards with emoji + plain text

### 3. Income Rhythm

Goal:

- understand how money usually comes in

UI:

- large radio-card list

### 4. Cash Setup

Goal:

- capture starting cash when relevant

UI:

- yes/no choice
- single amount input

### 5. Final Setup

Goal:

- confirm the selected persona
- capture name
- complete setup and auto-load sample history

### 6. Home Dashboard

Goal:

- answer the most important money question first

Current shared layout:

- persona banner
- one primary CTA
- status headline
- hero number:
  - `Safe to spend`
  - or `Still to protect`
- fuel gauge
- stale/freshness card
- watchouts
- supporting metrics
- explanations
- more actions

## Current Home Experience

### Shared Home Pattern

Primary question answered:

- `Am I okay till the next income?`

Hero area:

- plain-language status
- big hero number
- green / yellow / red gauge

Supporting metrics:

- upcoming dues
- daily needs covered
- bank money seen this cycle
- cash on hand

Current helper pattern:

- `Why We Think So`
- specific watchouts where possible
- freshness indicator when data is stale

### Persona Flavor

The structure stays shared. The emotional framing may differ by persona, but the app should not fork into wildly different dashboards.

- salaried: safe till next salary
- daily wage: what is safe right now
- seasonal: what must be protected before the next money event
- business/self-employed: what is free after dues
- family manager: what the household can safely use

## Add Cash / Due Update Flow

This is the main correction flow in the current app.

Actions:

- cash in hand
- big cash spent
- cash received
- due paid

Important current behavior:

- source-aware choices:
  - cash
  - online / UPI
  - credit card
  - split cash + online where relevant
- impossible cash-only payments are blocked
- the home answer refreshes after save

## Add Upcoming Due Flow

Goal:

- let the user protect an important payment that may not be visible in statement history yet

Fields:

- due name
- amount
- due date
- optional monthly repeat
- optional note

Expected effect:

- increases protected dues
- reduces safe-to-spend
- can appear in watchouts

## Import Statement Screen

Goal:

- give users a lightweight way to load statement-based history

Current reality:

- sample statement path is the strongest current route
- real import exists as a foundation, not yet the best polished first-run flow

## Current UX Gaps

- named protected dues list is not fully visible on Home yet
- due-paid flow is still more generic than ideal
- real CSV import still trails the sample path
- coach / deeper insights should not be treated as finished product surfaces

## Next Screen-Level Priorities

1. protected dues list with paid state on Home
2. stronger forgotten-subscription card
3. clearer named due management from imported history
4. real auth entry flow
