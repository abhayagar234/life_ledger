# Life Ledger — MoneyOS

> "Will my money last till next payday?"

MoneyOS is a financial survival app built for India's mass market — the 180M+ salaried Indians earning ₹10K–₹50K/month who have smartphones, UPI, and real financial anxiety but zero tools built for their reality.

This is **not** a budgeting app. Not an expense tracker. Not an investment platform.

It answers one question, honestly, before the crisis hits.

---

## The Problem

A person earns ₹8,000/month. Rent ₹3,000. EMI ₹2,000. Home expenses ₹1,500. Their bank shows ₹1,500 remaining and they feel okay. By the 15th they are borrowing from a colleague.

Their real safe-to-spend is ₹250 — not ₹1,500. Nobody told them. No app, no bank, no tool shows them this number before it is too late.

Household debt in India hit 41.3% of GDP in 2025. Personal loan defaults under ₹1L reached 44%. Indians are not bad with money — they are flying blind.

### More real problems this app can solve

- **Salary looks bigger than reality**  
  A user sees `₹6,000` in the bank, but `₹3,000` rent, `₹1,500` EMI, and `₹900` subscriptions are already committed. The app should show what is truly free before they spend wrongly.

- **Cash and online money are mixed in real life**  
  A person pays some things in cash, some by UPI, some by credit card. Their statement alone is incomplete, but they also will not do full bookkeeping. The app needs to combine imported history with a few lightweight corrections.

- **Upcoming dues are remembered too late**  
  School fees, medicine, rent, EMI, and subscriptions are often known mentally but not protected in time. The app should turn “I know it is coming” into a visible amount that reduces safe-to-spend now.

- **A user spends from credit card and forgets the future hit**  
  Credit card spending can feel invisible in the moment. The app should treat that as a future due to protect, not as free money.

- **Informal income makes bank balance misleading**  
  Tailoring income, cash sales, family transfers, mandi cash, or side work may never appear cleanly in one bank feed. The app should let users add only what matters without forcing daily accounting.

- **A family manager needs one answer, not ten finance screens**  
  One person may be handling salary, children’s expenses, rent, and irregular household cash. They do not need categories first. They need one calm answer: “How much is safe right now?”

---

## What It Does

- Start with sample statement history or build manually from cash and dues
- Turn imported + manual money activity into one answer: what is protected, what is visible, and what is still free
- Show what is actually safe to spend — not just the bank balance
- Surface upcoming dues with specific amounts, statuses, and dates before they hit
- Keep confidence visible when data is thin, stale, or incomplete
- Let the user add only what matters between imports:
  - cash received
  - cash spent
  - one day-total cash number
  - due paid
  - upcoming due
- Show useful government scheme suggestions based on the user type chosen in onboarding

---

## Why This Has Not Been Built Before

- CRED, Fi, Jupiter — built for top 5%, ₹50K+ income, credit score 750+
- Walnut, MoneyView — backward-looking expense trackers, not survival tools
- Banks — no incentive to tell you when you are about to run short
- Global apps (Snoop, PocketGuard) — built on UK/US Open Banking, no India/UPI support

The Account Aggregator framework launched in India in 2021–22 makes this technically possible for the first time. No one has built it yet for this segment.

---

## Product Principles

- **One import per month is enough** — works without daily discipline
- **Cash + UPI + credit together** — not just bank balance
- **Plain language always** — no jargon, no pie charts as hero
- **Action-oriented, never alarming** — *"₹4,200 to protect before May 1"* not *"you may run short"*
- **Essential spending is treated carefully** — food, medical, and household needs should not feel like moral failure
- **Trust before monetization** — show government schemes and opportunities as help, not ads

---

## Stack

**Mobile**
- Expo + React Native + TypeScript
- Expo Router (file-based routing)
- Zustand (state management)

**Backend**
- FastAPI + SQLAlchemy
- SQLite (dev) / PostgreSQL (production)
- Rule-based cashflow engine — no black-box AI

---

## Key Metrics Calculated

| Metric | What it means |
|---|---|
| `safe_to_spend` | After ALL committed expenses stripped |
| `runway_days` | Days money lasts at current pace |
| `safe_till_date` | The date money runs out |
| `watchouts` | Specific upcoming hits — "Jio ₹349 on April 25" |
| `safe_to_save` | Surplus after uncertainty buffer |
| `confidence` | Whether the answer is high-confidence, estimated, or missing too much data |

---

## What Is Built

- Language-first onboarding — English, Hindi, Marathi
- Persona-aware onboarding — user type + cash setup + completion
- Sample statement flow — setup saves first, then loads realistic history automatically
- Cashflow engine — safe_to_spend, protected dues, daily-basics coverage, runway, confidence scoring
- CSV ingestion foundation — normalisation, deduplication, categorisation
- Fuel gauge home screen — green/yellow/red, plain language headline, hero number
- Keep Aside First layer — named dues with pending / partial / paid state
- Recurring due support — recurring manual dues reappear next cycle
- Manual money updates — cash, online / UPI, credit card, split payment validation
- Borrowed money protection — cash received can auto-create a return due
- Credit card minimum-payment handling — minimum payment keeps the remaining card balance protected
- Stale cash protection — old cash is excluded from the main answer
- Confidence treatment on hero number — estimated / low-confidence states are visually distinct
- Persistent demo banner — sample numbers stay visibly “example only” until real data is added
- Data completeness line on home — shows what the answer is based on
- Add upcoming due flow — protect a due that is not visible in imported history yet
- Day-total cash shortcut — one honest number for the day instead of many tiny cash entries
- Government scheme suggestion card — profile-based and localized by language
- Profile-aware sample data seeding:
  - salaried
  - daily wage
  - farmer / seasonal
  - business / self-employed
  - family manager

## What Is Coming

- Real auth (email/OTP) — currently demo stub
- Scheme eligibility check flow — current version only recommends, it does not verify
- WhatsApp cash / due reminder channel
- EMI auto-materialisation from import patterns beyond manual recurring dues
- Full due management — edit / remove / mark named upcoming dues from home
- Full trust-surface localization beyond the current main path
- SMS parsing for real-time UPI capture
- Account Aggregator integration — replace CSV with live bank sync

---

## Setup

```bash
# Install dependencies
cd mobile
npm install

# Copy environment config
cp .env.example .env

# Start
npm start
```

The app reads backend URL from `EXPO_PUBLIC_API_BASE_URL`. Defaults to `http://127.0.0.1:8000`.

For physical device testing use your machine's LAN IP:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.20:8000 npm start
```

---

## Backend

```bash
cd backend
uvicorn app.main:app --reload
```

---

## Sharing With Friends (Expo Go)

This works best for local or supervised testing, not broad public sharing.

1. Run `npx expo start` in the mobile folder
2. Make sure the backend is reachable from the tester's device
3. Share the QR code or Expo link
4. Friend downloads Expo Go and opens the app

For remote unguided testing, a hosted backend plus Android APK is the better path.

## Android APK Build

```bash
npx eas build --platform android --profile preview
```

Produces a `.apk` link you can share directly on WhatsApp. No Expo Go needed, but the backend still needs to be publicly reachable.

---

## The Market

- 180M salaried Indians in tier 2/3 cities earning ₹15K–₹50K — zero tools built for them
- Verified: no Indian app ships proactive cashflow runway for this segment today
- Closest global equivalent: Snoop (UK) — raised $42M, acquired by a bank
- Business model: trust first → insurance referral → credit when short → SIP when surplus detected

---

## Competitive Position

| App | What they do | Serves our user? |
|---|---|---|
| CRED | Credit card rewards | No — top 5% only |
| Fi / Jupiter | Neobank for salaried professionals | No — ₹50K+ income |
| INDmoney | Wealth and investment tracking | No — assumes existing surplus |
| Bachat | Daily micro-savings for self-employed | No — assumes you know you have surplus |
| MoneyView | Expense tracking + lending | No — backward looking |
| Snoop (UK) | Payday-to-payday cashflow | Yes — but UK only, no India |

**Nobody owns this space in India. We are first.**
