# MoneyOS Mobile Testing Checklist

## Goal

Verify that the first mobile wedge for Life Ledger feels trustworthy, clear, and useful.

The focus of this round is:

- onboarding speed
- persona fit
- dashboard clarity
- backend connectivity

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
2. Select each income rhythm and confirm the flow advances.
3. Turn cash tracking on and off.
4. Enter a starting cash amount.
5. Toggle loans and EMI setup.
6. Choose `Import now` and `Do it later` and confirm both continue cleanly.
7. Enter a display name and save onboarding.
8. For salaried users, confirm salary day is accepted.
9. For business or family flows, confirm scope selection appears.

Expected result:

- onboarding feels calm and simple
- no screen asks unnecessary questions
- save completes and returns to Home

## Persona Dashboard Test

### Salaried

Check for:

- safe-to-spend hero
- month spent card
- fixed dues card
- actions like `Add Expense` and `Add EMI`

### Daily Wage / Irregular

Check for:

- cash left or money left hero
- recent income
- runway estimate when available
- actions like `Earned Today` and `Spent Cash`

### Farmer / Seasonal

Check for:

- seasonal framing text
- money left after essentials
- runway or reserve-oriented messaging

### Business / Self-Employed

Check for:

- money in hero
- money out and safe-to-spend support cards
- business-friendly quick actions like `Add Sale`

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

## Known Current Limits

- add-entry forms are still placeholder screens
- loans, AI coach, and CSV import flows are scaffolded but not fully implemented
- dashboard depth depends on backend demo data
