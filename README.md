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

---

## What It Does

- Import one bank or UPI statement CSV — no daily tracking required
- Strip out all committed expenses: EMI, rent, subscriptions, upcoming bills
- Show what is actually safe to spend — not the bank balance lie
- Surface upcoming dues with specific amounts and dates before they hit
- Show a plain language answer: *"You are covered till May 1 — ₹250 is yours for anything extra"*
- Flag government schemes the user likely qualifies for (Ayushman Bharat, PM Kisan, etc.)

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
- **Medical, food, education are never flagged as overspend** — always show a safety path
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
| `safe_to_invest` | Only shown after 3 months consistent surplus |

---

## What Is Built

- Full onboarding — user type, income pattern, cash setup, CSV import
- Cashflow engine — safe_to_spend, runway, watchouts, confidence scoring
- CSV ingestion pipeline — normalisation, deduplication, categorisation
- Fuel gauge home screen — green/yellow/red, plain language headline
- Quick cash entry — add spend/income between imports, auto-refreshes dashboard
- Demo data seeding — realistic sample with upcoming dues

## What Is Coming

- Real auth (email/OTP) — currently demo stub
- Forgotten subscriptions surface — "3 charges you may have forgotten"
- Stale data indicator — "Last updated 3 days ago"
- Government opportunities card — Ayushman Bharat, PM Kisan based on profile
- EMI auto-materialisation from import patterns — not manual entry
- Hindi language support
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

1. Run `npx expo start` in the mobile folder
2. Share the QR code on WhatsApp
3. Friend downloads Expo Go, scans link, done

## Android APK Build

```bash
npx eas build --platform android --profile preview
```

Produces a `.apk` link you can share directly on WhatsApp. No Expo Go needed.

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
