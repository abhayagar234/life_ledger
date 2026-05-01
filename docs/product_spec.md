# Life Ledger MoneyOS Product Spec

## Product Summary

MoneyOS is a mobile-first financial survival app for Indian households operating under scarcity. It is not primarily a budgeting tool, expense tracker, or investment app.

Its first job is to answer:

- `Will my money last till the next income?`
- `What must I protect first?`
- `How much is actually safe to spend right now?`

The current build is intended to be believable in unguided demos with family and friends, especially for users who:

- mix cash, UPI, and credit card spending
- have low tolerance for complex finance apps
- manage household dues mentally
- need calm, practical money clarity rather than reports

## Target Users

Primary user types:

- salaried users
- daily wage workers
- farmers and seasonal earners
- business owners and self-employed users
- family money managers

## Core User Jobs

Users should be able to:

- complete setup quickly without finance jargon
- land on a useful home screen immediately
- understand safe-to-spend and safe-till date
- add or correct important money reality with minimal effort
- protect important dues before spending freely
- combine imported statement history with lightweight manual corrections
- see named watchouts when something important is coming

## Product Principles

- mobile-first
- low-literacy friendly
- one clear answer before any detail
- action-oriented, never doom-oriented
- cash + online + card together
- statement history should do the heavy lifting
- manual entry should be lightweight, not full bookkeeping
- trust before monetization

## Main User Pain Points

- bank balance looks larger than true free money
- cash and online spending are mixed in real life
- upcoming dues are remembered too late
- credit card spending hides a future hit
- daily-needs spending is real but hard to mentally reserve
- finance tools feel too complex, judgmental, or built for richer users

## MVP Value Proposition

MoneyOS should answer these questions simply:

- `Am I okay till the next income?`
- `How much is safe to spend?`
- `What dues should I protect first?`
- `What changed after today’s cash / online / card spend?`
- `What looks forgotten or risky in my recent statement history?`

## Current Product Scope

### Implemented

- language-first onboarding
- persona-aware onboarding
- next-money horizon selection
- sample statement autoload after onboarding
- home screen with:
  - status headline
  - hero safe-to-spend or still-to-protect number
  - fuel gauge
  - named `Keep Aside First` due list with paid / partial / pending state
  - supporting metrics
  - freshness messaging
  - explanations and watchouts
- manual money updates:
  - set cash to what you have now
  - big spend
  - cash received
  - due payment from named dues
- source-aware manual updates:
  - cash
  - online / UPI
  - credit card
  - split cash + online
- add upcoming due flow
- profile-aware sample data:
  - salaried
  - daily wage
  - farmer / seasonal
  - business / self-employed
  - family manager
- CSV import foundation
- backend normalization and deduplication
- rule-based categorization
- cashflow engine with due protection and daily-needs protection

### Not Fully Built Yet

- real auth
- true production-ready CSV import UX
- full editable due management from Home
- future-month recurring due materialization
- real coach product surface
- opportunities / subsidies layer
- full trust-surface localization across every visible screen
- live bank or Account Aggregator connections

## Explicit Non-Goals Right Now

- full budgeting workflows
- savings goals
- net worth tracking
- investment onboarding
- generic financial news feed
- full business accounting
- tax workflows
- insurance workflows

## Feature Priority

### Must

- complete setup quickly
- auto-land on a believable home experience
- show safe-to-spend and protected dues clearly
- let user update cash / online / card reality
- let user add a missing due
- keep the answer fresh and visibly time-aware

### Should

- surface likely recurring dues from imported data
- show forgotten subscriptions as a stronger wow moment
- let users mark named dues paid from a visible due list
- let users correct due names / amounts / dates
- improve trust through specific watchouts and clear explanations
- make recurring dues truly recur across future cycles

### Later

- bilingual UI
- household collaboration
- opportunities / scheme recommendations
- richer subscription controls
- live sync with financial accounts
- first surplus-to-save recommendations

## Demo-First UX Requirements

- the first useful answer should appear without extra thinking
- one primary action at a time
- no “prototype” or “demo” trust-killing language in core user flow
- named dues are more useful than abstract totals
- watchouts must be specific when possible
- safe-to-spend should update immediately after meaningful actions
- stale data should be visible, not hidden

## Final Pre-Demo Checklist

If we had to pick only three final changes before a serious demo, they are:

1. full Home localization cleanup
   - remove mixed English from the main trust path
   - especially Home labels, helper text, due/source labels, and action copy
2. true-or-honest recurring dues behavior
   - either make recurring dues actually recur
   - or remove wording that implies automatic monthly carry-forward
3. flawless onboarding-to-populated-home flow
   - setup finishes
   - sample autoloads
   - Home opens with believable data every time
   - no empty or confusing intermediate step

These three are the highest leverage because they directly affect:

- trust
- clarity
- demo smoothness

## Current Main Screens

- welcome
- language selection
- user type selection
- income rhythm
- next money horizon
- cash setup
- final setup + sample autoload
- home dashboard
- add cash / due update
- add upcoming due
- import statement
- setup

## Acceptance Criteria

### Product Acceptance

- a new user can complete onboarding in under 2 minutes
- the app reaches a useful home state automatically after setup
- the sample statement should feel believable for the selected user profile
- a user can update money reality and see the answer change immediately
- a user can add a due that affects `Upcoming Dues` and `Safe To Spend`
- a user can understand the main answer without needing charts

### Demo Acceptance

- a family or friend can understand the app without live explanation
- the app feels honest, not overloaded
- imported/sample history plus one manual update creates an obvious value moment
- the product feels like a survival-clarity tool, not a generic budgeting app

## Success Criteria

The current milestone is successful if demo users can:

1. pick a persona that feels close to their life
2. reach a believable home screen quickly
3. understand what is safe, what is due, and what needs protection
4. change reality once and see the answer update
5. trust the app enough to tell us what is missing

## Risks To Avoid

- over-explaining finance logic before showing the answer
- relying on too many manual entries
- hiding dues inside totals only
- making warning copy feel alarming or judgmental
- overpromising import, auth, or AI capabilities

## Recommended Next Build Order

1. stronger imported recurring-due surfacing
2. full trust-surface localization
3. forgotten subscriptions as a dedicated card
4. real auth
5. broader CSV import support
