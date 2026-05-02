# MoneyOS Mobile Testing Checklist

## Goal

Verify that the first mobile wedge for Life Ledger feels trustworthy, clear, and useful.

The focus of this round is:

- onboarding speed
- persona fit
- dashboard clarity
- backend connectivity
- trust signals around stale / incomplete data

## Before Testing

1. Start the backend API.
2. Start the Expo app or install a preview APK.
3. Point the app to a reachable backend URL.
4. Confirm the phone and backend can reach each other on the same network if using local testing.

## Smoke Test

1. App opens without a blank screen or crash.
2. Welcome screen loads with the expected title and trust message.
3. Tapping `Start` moves into onboarding.
4. Completing onboarding lands on Home.
5. Home tab loads without blocking on empty data.

## Onboarding Test

1. Select each user type and confirm the choice card highlights correctly.
2. Turn cash tracking on and off.
3. Enter a starting cash amount.
4. Enter a display name and save onboarding.
5. For salaried and family-manager users, confirm salary day is accepted on the final step.
6. Confirm onboarding lands on Home without detouring through removed rhythm / horizon screens.

Expected result:

- onboarding feels calm and simple
- no screen asks unnecessary questions
- save completes and returns to Home

## Persona Dashboard Test

### Salaried

Check for:

- safe-to-spend hero
- confidence treatment if data is thin
- fixed dues card
- data completeness line
- actions like `Cash Received`, `Set Cash To What You Have Now`, and `Add Upcoming Due`

### Daily Wage / Irregular

Check for:

- cash left or money left hero
- daily wage sample data feels tighter than salaried
- `Today's Cash` quick action appears
- daily-basics and due protection still make sense

### Farmer / Seasonal

Check for:

- seasonal framing text
- money left after essentials
- due protection feels more important than daily-runway precision

### Business / Self-Employed

Check for:

- money in hero
- money out and safe-to-spend support cards
- no `Home + Business` tracking scope question appears

## API Connectivity Test

1. Confirm demo session is created automatically.
2. Confirm onboarding save hits `/profile/onboarding`.
3. Confirm Home refreshes data from:
   - `/profile`
   - `/monthly-summaries/{year}/{month}`
   - `/insights/summary`
   - `/insights`
4. Turn the backend off and confirm the app fails gracefully.

Expected result:

- errors should not crash the app
- users should see a clear message like `Your data is safe. Try again`

## Visual Test

Check:

- cards have enough spacing
- text remains readable on smaller phones
- tap targets are easy with one hand
- no screen feels crowded
- dashboard variants feel purposeful, not generic

## Packaged Build Test

For preview APK testing:

1. Install the APK on an Android device.
2. Open the app from a cold start.
3. Run through full onboarding.
4. Close and reopen the app.
5. Confirm the saved session persists.
6. Pull to refresh or tap refresh on Home.

Expected result:

- session persistence works
- onboarding is not shown again after completion unless cleared

## Trust Regression Test

1. Load sample data and confirm the demo banner is visible until real data is added.
2. Add one real manual update and confirm the demo banner disappears.
3. Add an upcoming due with recurring ON and confirm it appears in `Keep Aside First`.
4. Mark a recurring due paid and confirm the success copy says it will reappear next month.
5. For a card-like due, choose `Minimum only` and confirm the due remains partial, not cleared.
6. Let cash go stale or simulate a stale cash date and confirm:
   - hero answer switches to bank-only
   - stale cash banner appears
   - cash card shows unknown instead of the old stale amount
7. Confirm medium-confidence answers do not look identical to high-confidence answers.

## Known Current Limits

- AI coach and full CSV import UX are still not fully implemented
- scheme cards are recommendations only, not full eligibility checks
- dashboard depth depends on backend demo data
