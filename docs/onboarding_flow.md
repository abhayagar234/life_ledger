# MoneyOS Onboarding Flow

## Goal

Help a new user reach a useful dashboard and first value moment in under 2 minutes.

The onboarding should feel calm, guided, and trustworthy. It should avoid finance jargon and should not ask for setup that is not needed for the first answer.

## UX Principles

- one question per screen
- large tap targets
- short labels
- explain why each question matters
- avoid “demo” or “prototype” language in the main flow
- sample statement history should auto-load after setup
- never require a real bank connection to get value

## Current Onboarding Sequence

### Screen 1. Welcome + Language

Purpose:

- explain what the app does
- reduce fear
- set expectation that statement history and light corrections work together

Primary content:

- title: simple money clarity
- supporting text: helps show what is safe before the next income
- trust line: no live bank connection needed to start
- language choice:
  - English
  - हिंदी
  - मराठी

Primary action:

- `Start`

### Screen 2. User Type

Question:

- `What fits you best?`

Current options:

- `💼 Salaried`
- `🛠️ Daily Wage`
- `🌾 Farmer / Seasonal`
- `🏪 Business / Self-Employed`
- `🏠 Family Manager`

Reason shown:

- `We’ll shape the questions and money view around your reality.`

### Screen 3. Cash Setup

Question:

- `Do you want to include cash on hand?`

Options:

- yes
- not now

If yes:

- input starting cash amount
- helper text clarifies this includes wallet cash + home cash

### Screen 4. Final Setup

Purpose:

- collect name
- reinforce the selected persona visually
- complete setup without extra noise

Current behavior:

- selected persona card is shown above the name field
- salaried and family-manager users can still set the monthly money day here
- setup save triggers sample statement autoload
- user goes straight to Home after save with the first answer already loaded
- sample history now changes by selected profile instead of using one generic salaried sample

## Important Changes From Older Flow

The app no longer uses these as onboarding steps:

- income rhythm
- next money horizon
- loan / EMI setup step
- separate CSV decision step
- `Home + Business` tracking scope
- “prototype works best…” copy

Why:

- those steps added friction before value
- the user should first see the app work
- important dues can be added after setup

## Persona Variants

The onboarding engine is shared. Only wording and follow-up logic change by user type.

### Salaried Variant

Can ask:

- usual salary day on the final setup screen

Home emphasis:

- safe till next salary
- protected dues
- safe to spend

### Daily Wage Variant

Does not ask for a salary date or next-money horizon.

Home emphasis:

- what is safe for the next few days
- cash on hand
- today’s or recent money change
- tighter sample with small frequent inflows and lower buffer

### Farmer / Seasonal Variant

Does not force a monthly framing or a manual runway choice.

Home emphasis:

- this money should last
- dues to protect
- practical next action
- seasonal sample with crop / mandi payout, tractor EMI, irrigation, and farm expenses

### Business / Self-Employed Variant

Home emphasis:

- money seen this cycle
- dues coming up
- what is free after protection
- sample with customer payments, supplier payments, shop rent, and business EMI

### Family Manager Variant

Home emphasis:

- simple household answer
- dues to keep aside
- what is still safe
- sample with home transfer, household bills, school fees, and groceries

## Happy Path Timing

Target time:

- welcome: 5 seconds
- user type: 10 seconds
- cash setup: 15 seconds
- final setup: 15 to 20 seconds

Total target:

- under 2 minutes

## Empty States

- no cash added yet: `You can add this later.`
- no recent data yet: sample history is loaded automatically after setup based on the selected profile

## Error States

- invalid amount: `Enter numbers only`
- no selection made: `Choose one option to continue`
- setup save failed: explain clearly and offer retry

## Smart Defaults Now Used

These values are no longer asked directly in onboarding. They are inferred from user type:

- salaried → monthly
- daily wage → daily
- farmer / seasonal → seasonal
- business / self-employed → mixed
- family manager → monthly

Horizon defaults are also inferred:

- salaried with salary day → dynamically calculated to next salary day
- salaried without salary day → 30 days
- daily wage → 7 days
- farmer / seasonal → 90 days
- business / self-employed → 30 days
- family manager → same as salaried logic
