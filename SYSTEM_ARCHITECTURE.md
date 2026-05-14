# MoneyOS System Architecture

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        MOBILE APP (React Native)                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Screens                                                  │   │
│  │ - Onboarding (language → type → cash → name)            │   │
│  │ - Home (safe_to_spend, fuel gauge, data health)         │   │
│  │ - Add Entry (cash/UPI/credit)                           │   │
│  │ - Coach (chat interface)                                │   │
│  │ - Household (link with partner)                         │   │
│  │ - Offers (insurance, lending, gig)                      │   │
│  │ - Schemes (govt programs)                               │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ State Management (Zustand)                              │   │
│  │ - session store (user, profile, token)                  │   │
│  │ - cashflow store (summary, dues)                        │   │
│  │ - household store (members, permissions)                │   │
│  └──────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Services                                                │   │
│  │ - API client (axios with auth headers)                  │   │
│  │ - Offline queue (sync when online)                      │   │
│  │ - Analytics (track events)                              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                        HTTPS/REST
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND (FastAPI + Python)                  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ API Routes (FastAPI)                                     │   │
│  │ - /auth (request-otp, verify-otp, refresh-token)        │   │
│  │ - /profiles (CRUD user profile)                         │   │
│  │ - /cashflow (summary, calculation)                      │   │
│  │ - /ledger-entries (manual transactions)                 │   │
│  │ - /upcoming-dues (track obligations)                    │   │
│  │ - /imports (CSV upload & processing)                    │   │
│  │ - /coach (ask questions, get answers)                   │   │
│  │ - /households (manage multi-user)                       │   │
│  │ - /insights (hidden costs, analysis)                    │   │
│  │ - /referrals (insurance, lending, gig)                  │   │
│  │ - /schemes (government programs)                        │   │
│  │ - /subscriptions (payment, tiers)                       │   │
│  │ - /webhooks (WhatsApp, Razorpay)                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Business Logic (Services)                                │   │
│  │ ┌──────────────────────────────────────────────────┐     │   │
│  │ │ CashflowService (core calculation engine)        │     │   │
│  │ │ - build_cashflow_summary()                       │     │   │
│  │ │ - calculate_safe_to_spend()                      │     │   │
│  │ │ - detect_protected_dues()                        │     │   │
│  │ │ - calculate_runway_days()                        │     │   │
│  │ └──────────────────────────────────────────────────┘     │   │
│  │                                                            │   │
│  │ ┌──────────────────────────────────────────────────┐     │   │
│  │ │ HiddenCostAnalyzer                               │     │   │
│  │ │ - detect_delivery_fees()                         │     │   │
│  │ │ - detect_subscription_duplicates()               │     │   │
│  │ │ - detect_category_overspend()                    │     │   │
│  │ └──────────────────────────────────────────────────┘     │   │
│  │                                                            │   │
│  │ ┌──────────────────────────────────────────────────┐     │   │
│  │ │ ImportService (CSV processing)                   │     │   │
│  │ │ - parse_csv/xlsx()                              │     │   │
│  │ │ - normalize_transactions()                       │     │   │
│  │ │ - deduplicate()                                 │     │   │
│  │ │ - categorize()                                  │     │   │
│  │ └──────────────────────────────────────────────────┘     │   │
│  │                                                            │   │
│  │ ┌──────────────────────────────────────────────────┐     │   │
│  │ │ SpendingCoach (Q&A)                              │     │   │
│  │ │ - answer_affordability()                         │     │   │
│  │ │ - answer_spending_breakdown()                    │     │   │
│  │ │ - answer_savings_potential()                     │     │   │
│  │ └──────────────────────────────────────────────────┘     │   │
│  │                                                            │   │
│  │ ┌──────────────────────────────────────────────────┐     │   │
│  │ │ WhatsAppBotService                               │     │   │
│  │ │ - send_daily_confirmation_message()              │     │   │
│  │ │ - handle_inbound_message()                       │     │   │
│  │ │ - parse_cash_amount()                            │     │   │
│  │ └──────────────────────────────────────────────────┘     │   │
│  │                                                            │   │
│  │ ┌──────────────────────────────────────────────────┐     │   │
│  │ │ PartnerIntegrationService                        │     │   │
│  │ │ - InsurancePartner.send_lead()                   │     │   │
│  │ │ - LendingPartner.check_eligibility()             │     │   │
│  │ │ - GigWorkPartner.send_referral()                 │     │   │
│  │ └──────────────────────────────────────────────────┘     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Data Models (SQLAlchemy ORM)                             │   │
│  │ User                   FinancialProfile                   │   │
│  │ ├─ id, email, phone    ├─ user_type                      │   │
│  │ ├─ created_at          ├─ income_pattern                 │   │
│  │ ├─ is_active           └─ salary_day_of_month            │   │
│  │                                                            │   │
│  │ NormalizedTransaction  LedgerEntry                        │   │
│  │ ├─ amount              ├─ cash_on_hand                    │   │
│  │ ├─ category            ├─ entry_type                      │   │
│  │ ├─ transaction_date    └─ created_at                      │   │
│  │                                                            │   │
│  │ UpcomingDue            Loan                               │   │
│  │ ├─ due_date            ├─ amount                          │   │
│  │ ├─ amount              ├─ status                          │   │
│  │ └─ status              └─ emi_amount                      │   │
│  │                                                            │   │
│  │ Household              UserSubscription                   │   │
│  │ ├─ owner_user_id       ├─ tier (free/basic/pro)          │   │
│  │ ├─ members             ├─ monthly_amount                  │   │
│  │ └─ permissions         └─ questions_limit                 │   │
│  │                                                            │   │
│  │ OTPSession             UserSession                        │   │
│  │ ├─ phone/email         ├─ access_token                    │   │
│  │ ├─ otp_code            ├─ refresh_token                   │   │
│  │ └─ expires_at          └─ expires_at                      │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
        ┌───────────────────────────────────────────┐
        │  External Services (via HTTP/webhooks)    │
        ├───────────────────────────────────────────┤
        │ - Twilio (SMS/WhatsApp API)               │
        │ - Razorpay (Payments)                     │
        │ - Partner APIs (Insurance/Lending/Gig)    │
        │ - Account Aggregator (RBI, future)        │
        └───────────────────────────────────────────┘
                              ↓
                     ┌─────────────────┐
                     │  PostgreSQL     │
                     │  (production DB)│
                     └─────────────────┘
                     
                     ┌─────────────────┐
                     │     Redis       │
                     │  (job queues)   │
                     └─────────────────┘
```

---

## Data Flow: User Adds Cash Entry

```
┌─────────────────────────────────────┐
│ User on mobile: "I have ₹1,200 cash"│
└──────────────────┬──────────────────┘
                   │
                   ↓
        ┌──────────────────────┐
        │ Mobile app stores:   │
        │ - cash_on_hand: 1200 │
        │ - entry_type: cash   │
        │ - timestamp: now     │
        └──────────┬───────────┘
                   │
                   ↓
        POST /ledger-entries
        {
          "entry_type": "cash",
          "cash_on_hand": 1200,
          "notes": "WhatsApp update",
          "source_type": "whatsapp_bot"
        }
        
        Middleware:
        1. Verify JWT token
        2. Check rate limits
        3. Validate input
        
        Handler:
        1. Create LedgerEntry in DB
        2. Increment user analytics event
        3. Return 200 OK
                   │
                   ↓
        ┌──────────────────────┐
        │ Backend calls:       │
        │ build_cashflow_      │
        │ summary(user_id)     │
        └──────────┬───────────┘
                   │
                   ↓
        CashflowService algorithm:
        1. Fetch all transactions (last 6 months)
        2. Fetch all upcoming dues
        3. Calculate:
           - liquid_balance (from imports)
           - cash_on_hand (1200, from ledger)
           - total_available = 1200 + liquid_balance
           
           - protected_dues (sum of upcoming)
           - daily_needs (avg spend from history)
           - daily_needs_till_income = daily_needs * days_till_next_income
           
           - safe_to_spend = total_available 
                           - protected_dues 
                           - daily_needs_till_income
        4. Return { safe_to_spend, protected_dues, ... }
                   │
                   ↓
        ┌──────────────────────┐
        │ Mobile app gets:     │
        │ {                    │
        │   "safe_to_spend":   │
        │     1200,            │
        │   "protected_dues":  │
        │     2500,            │
        │   "liquid_balance":  │
        │     3700             │
        │ }                    │
        └──────────┬───────────┘
                   │
                   ↓
        ┌─────────────────────────────────┐
        │ Home screen updates:            │
        │ - Fuel gauge: GREEN (safe)      │
        │ - Hero: "₹1,200 to spend"       │
        │ - Breakdown: "₹2,500 protected" │
        └─────────────────────────────────┘
```

---

## Data Flow: WhatsApp Bot (9 PM Daily)

```
┌──────────────────────────────────────┐
│ APScheduler: CRON 9 PM IST           │
│ (runs every day)                     │
└────────────┬─────────────────────────┘
             │
             ↓
┌──────────────────────────────────────┐
│ WhatsAppBotService.send_daily_       │
│ confirmation_message()               │
└────────────┬─────────────────────────┘
             │
             ├→ Query all active users
             ├→ Filter users who haven't updated today
             │
             ↓
   For each user:
   ┌────────────────────────────────┐
   │ 1. Twilio WhatsApp API         │
   │    POST                        │
   │    to: whatsapp:+919876543210 │
   │    body: "How much cash today?"│
   └────────┬───────────────────────┘
            │
            ↓ (User replies on WhatsApp)
            │
   ┌────────────────────────────────┐
   │ 2. Twilio Webhook              │
   │    POST /webhooks/whatsapp     │
   │    { From, Body: "500" }       │
   └────────┬───────────────────────┘
            │
            ↓
   WhatsAppBotService.
   handle_inbound_message()
   ├→ Parse amount: "500" → 500
   ├→ Update LedgerEntry
   ├→ Call cashflow recalculation
   │
   └→ Send confirmation:
      "Got it! Your cash: ₹500.
       Safe to spend: ₹250"
```

---

## Data Flow: Hidden Cost Detection

```
┌──────────────────────────────────────┐
│ User opens "Hidden Costs" screen     │
└────────────┬─────────────────────────┘
             │
             ↓
   GET /insights/hidden-costs?days=30
             │
             ↓
   HiddenCostAnalyzer.analyze_user()
   ├→ Fetch all debit transactions (30 days)
   │
   ├→ _detect_delivery_fees()
   │  ├─ Find txns with "zomato", "swiggy", etc.
   │  ├─ Estimate fee = 12% of amount
   │  └─ Return: { amount: 400, action: "Plan groceries" }
   │
   ├→ _detect_subscription_duplicates()
   │  ├─ Find Netflix, Hotstar, Prime Video
   │  ├─ Total: ₹900/month
   │  └─ Return: { amount: 900, action: "Cancel 1" }
   │
   ├→ _detect_category_overspend()
   │  ├─ Compare this month vs last month
   │  ├─ Entertainment: ₹1,200 → ₹2,100 (75% ↑)
   │  └─ Return: { amount: 900, action: "Why the spike?" }
   │
   └→ Return sorted by savings potential
             │
             ↓
   ┌──────────────────────────────────┐
   │ Mobile shows:                    │
   │ "You're wasting ₹2,200/month:"   │
   │ ├─ Delivery fees: ₹400           │
   │ ├─ Subscriptions: ₹900           │
   │ └─ Entertainment overspend: ₹900 │
   │                                  │
   │ "Save ₹2,200, invest it instead" │
   └──────────────────────────────────┘
```

---

## Database Schema (Simplified)

```sql
-- Users & Auth
users (id, email, phone, display_name, created_at, is_active)
otp_sessions (id, phone, otp_code, expires_at, is_verified)
user_sessions (id, user_id, access_token, refresh_token, device_id)

-- Financial Data
financial_profiles (user_id, user_type, income_pattern, salary_day, ...)
normalized_transactions (id, user_id, amount, category, transaction_date, ...)
ledger_entries (id, user_id, entry_type, cash_on_hand, ...)
upcoming_dues (id, user_id, due_date, amount, status, ...)
loans (id, user_id, amount, emi_amount, status, ...)
emi_payments (id, loan_id, amount, due_date, status, ...)

-- Features
households (id, owner_user_id, name, created_at)
household_members (id, household_id, user_id, role, status, ...)
coach_questions (id, user_id, question, answer, answer_type, created_at)
user_subscriptions (user_id, tier, monthly_amount, questions_limit, ...)
referral_records (id, user_id, partner, lead_id, commission, status, ...)
government_schemes (id, code, name, max_loan, rate, eligible_types, ...)

-- Analytics & Tracking
user_events (id, user_id, event_type, event_data, session_id, cohort_date, ...)
```

---

## Key Design Decisions

### 1. Cashflow Calculation is Rule-Based, Not ML
**Why:** Transparency, debuggability, no training data needed
**How:** Hard-coded rules in CashflowService
**Trade-off:** Can't personalize, but accurate for the segment

### 2. WhatsApp Primary, SMS Fallback
**Why:** Better UX in India, cheaper, native app
**Cost:** ₹30-60/user/month vs ₹100/user/month for SMS
**Fallback:** If WhatsApp API throttles, use SMS

### 3. Partner Model, Not Owned Products
**Why:** Insurance/lending are regulated, need capital
**How:** We send lead, partner handles everything, we get commission
**Risk:** Partner may say no, need backup plans

### 4. Stateless Mobile, State in Backend
**Why:** Simpler mobile app, easier to update logic server-side
**How:** Mobile is thin client, all logic in FastAPI
**Trade-off:** Requires constant connectivity (okay in India)

### 5. PostgreSQL for Production, SQLite for Dev
**Why:** PostgreSQL scales, handles transactions, better for analytics
**Dev:** SQLite works locally, easier setup
**Migration:** Already planned, done at Week 1

---

## Error Handling Strategy

```
User Action
    ↓
API Request
    ↓
Middleware (Auth check, rate limit)
    ↓
Service Layer (business logic)
    ↓
If error:
  ├→ ValidationError → 400 + user-friendly message
  ├→ AuthError → 401 + "Login required"
  ├→ NotFoundError → 404 + "Not found"
  ├→ PartnerError → 502 + "Partner unavailable"
  └→ UnexpectedError → 500 + "Something went wrong"
    
    Log with:
    - request_id (traceable)
    - user_id (for debugging)
    - stack trace (to Sentry)
    - context (what operation, what user, what data)
    
Mobile app shows:
    - User-friendly error message
    - Retry option if retryable
    - Support link if permanent
```

---

## Scaling Considerations

### Currently (Week 8)
- 1,000 users
- 1 backend instance
- SQLite → PostgreSQL
- No caching

### At 10K users (Week 16)
- Add Redis caching (most queries)
- Add Elasticsearch (transaction search)
- Horizontal scaling (multiple API instances)
- Background job workers (import processing)

### At 100K users (Month 6)
- Database read replicas
- CDN for static assets
- Event streaming (Kafka) for analytics
- Notification queue (RabbitMQ)

### At 1M users (Year 1)
- Sharding by user_id
- Separate read/write databases
- Microservices (auth, cashflow, partner-integrations)
- ML models for categorization

---

## Monitoring & Alerting

```
Production dashboard tracks:
- API latency (p50, p95, p99)
- Error rate (threshold: >1%)
- Failed partner requests
- DB connection pool utilization
- WhatsApp API quota usage
- Razorpay payment failures
- User cohort retention (day-7, day-30)

Alerts trigger if:
- Error rate >1% for 5 minutes
- API latency >2s for p95
- WhatsApp quota >80%
- DB connections >80%
- 0 new users in 1 hour (sign of outage)
```

---

## Summary: What Makes This Feasible

✅ **Clear problem:** Users don't know what's safe to spend
✅ **Simple solution:** One number (safe_to_spend)
✅ **Existing tech:** FastAPI, React Native, PostgreSQL all mature
✅ **No hard scaling problems:** Categorization is heuristic, not ML
✅ **Partner-driven monetization:** We don't own insurance/lending/credit
✅ **Government aligned:** Financial inclusion is government goal
✅ **Small team:** 4 people can build this in 8 weeks

---

**Architecture version:** 1.0
**Next review:** After Week 4 (when MVP is mostly done)
