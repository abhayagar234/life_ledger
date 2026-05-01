# MoneyOS Design System

## Goal

Provide a calm, trustworthy visual system for a survival-clarity app.

The app should feel:

- practical
- protective
- easy to scan
- non-judgmental

It should not feel like:

- a chart-heavy budgeting app
- a bank dashboard
- a finance toy

## Visual Principles

- answer first, details later
- strong hierarchy
- low cognitive load
- large tap targets
- plain language paired with visual cues
- no fear-heavy warning design

## Home-Screen Hierarchy

Preferred order:

1. status line
2. hero money number
3. fuel gauge
4. named watchouts / dues
5. supporting metrics
6. explanation
7. secondary actions

## Color Direction

Use a grounded, practical palette:

- `safe`: green
- `tight`: yellow / amber
- `slow down`: red
- warm neutrals for surfaces and text

Important rule:

- red should communicate protection and slowdown, not panic

## Typography

- strong contrast between hero amount and body text
- avoid tiny helper text
- plain, readable sans-serif

## Components

### Persona Banner

- small, warm, identity-reinforcing
- should not compete with the money answer

### Hero Number

- the strongest number on the screen
- either:
  - `Safe to spend`
  - or `Still to protect`

### Fuel Gauge

- immediate visual state:
  - green = safe
  - yellow = getting tight
  - red = slow down

### Supporting Metric Cards

Should feel secondary.

Examples:

- upcoming dues
- daily needs covered
- bank money seen this cycle
- cash on hand

### Watchouts

Should be:

- specific
- calm
- actionable

Avoid vague warnings like:

- `bills coming`

Prefer:

- `Jio Rs 349 on April 25. Keep this aside first.`

## Interaction Principles

- one primary CTA at a time
- corrections should feel lightweight
- refresh should be implicit where possible
- every meaningful money action should visibly change the answer

## Accessibility

- do not rely on color alone
- large hit targets
- labels should be readable without financial literacy
- icons and emoji should support meaning, not replace text
