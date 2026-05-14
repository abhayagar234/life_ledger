# MoneyOS Milestone Checklist

This file is the product build checklist for staying on track across:

1. Demo
2. Private Beta
3. Public Beta
4. Production App

The goal is simple:

- do not build expensive layers too early
- do not confuse demo polish with real-app readiness
- do not argue every week about what is “needed now”

---

## How To Use This File

Every feature should be tagged mentally as one of these:

- `Now` = required for the current milestone
- `Next` = useful, but only after current milestone is stable
- `Later` = real future value, not current priority

Rule:

**Do not pull features from a later milestone unless they directly unblock the current one.**

---

# Milestone 1 — Demo That Feels Believable

## Goal

A new person can try the app in 5 minutes and understand:

- what is safe to spend
- what must be kept aside
- why the answer looks that way

## Success Test

A user can open the app, use sample data, make a few manual updates, and say:

**“I understand what this app is telling me.”**

## Must Have

### Core money clarity
- [x] Persona-based onboarding
- [x] Language support for EN / HI / MR
- [x] Sample statement loading
- [x] Safe-to-spend calculation
- [x] Keep-aside / dues logic
- [x] Recurring dues
- [x] Confidence treatment
- [x] Stale cash handling
- [x] Borrowed money handling
- [x] Credit-card minimum vs full payment handling
- [x] Data completeness line
- [x] Day-total cash shortcut

### Demo trust
- [x] Demo banner before real data exists
- [x] Simpler onboarding flow
- [x] Scheme recommendations on Home
- [ ] Home screen psychological cleanup
- [ ] Better explanation when `safe_to_spend = 0`
- [ ] Better wording for daily-needs and bank widgets
- [x] Bank-balance confirmation concept defined

### Demo realism
- [x] Sample personas
- [x] Rebalanced sample data
- [ ] Sample outputs reviewed persona by persona
- [ ] Demo-to-real transition plan

## Nice To Have
- [ ] Better demo identity switching for multiple users trying the app
- [ ] Cleaner “continue old user vs start fresh” demo flow

## Do Not Build Yet
- [ ] Real auth
- [ ] WhatsApp bot
- [ ] Monetization
- [ ] Partner APIs
- [ ] Household mode
- [ ] AI coach

## Exit Criteria

Move beyond Demo only when:

- 8 out of 10 people understand the Home screen story
- no obviously dangerous or contradictory numbers remain
- sample experience is believable across key user types

---

# Milestone 2 — Private Beta With Real User Data

## Goal

A real user can sign in, import their own financial data, correct key numbers, and trust the answer enough to reuse the app.

## Success Test

A real user can say:

**“This is my money picture, not just a demo.”**

## Must Have

### Product focus
- [ ] Keep one core promise: `How much money is truly safe to spend right now?`
- [ ] Do not position the beta as expense tracking
- [ ] Do not drift into generic dashboards
- [ ] Keep survival-first logic ahead of goals and analytics

### Beta user segments
- [ ] Support salaried users well
- [ ] Support family money managers well
- [ ] Support small business / service operators well enough for beta
- [ ] Support hybrid users: salary + side business / salary + clinic

### Real user access
- [ ] Real auth
- [ ] OTP or magic-link login
- [ ] Session/token handling
- [ ] Secure token storage on mobile
- [ ] Protected backend routes

### Onboarding and initial truth setup
- [ ] Preferred language
- [ ] User type
- [ ] Next meaningful money point
- [ ] Current bank money
- [ ] Current cash in hand
- [ ] Whether home and business money mix
- [ ] Whether user also receives salary besides business income
- [ ] Keep onboarding short and understandable without import
- [ ] Produce a useful first answer even before statement import

### Real data ingestion
- [ ] Stable CSV import for common bank statements
- [ ] Stable PDF import for common bank statements
- [ ] Import preview users can understand
- [ ] Clear import failure states
- [ ] Dedupe that behaves safely
- [ ] Make import optional but clearly better for accuracy
- [ ] Use import to detect recurring obligations automatically
- [ ] Use import to improve category understanding
- [ ] Show uncategorized / low-confidence transactions clearly
- [ ] Ask for lightweight user annotation only on important unclear transactions
- [ ] Allow users to confirm whether an unclear transaction is rent / EMI / bill / salary / business / other
- [ ] Avoid asking users to classify the whole statement manually

### Trust-critical correction flows
- [ ] Detected dues review / confirm flow
- [ ] Bank-balance confirmation card
- [ ] Manual bank-balance override
- [ ] Store working confirmed bank balance
- [ ] Explain “visible money is already committed”
- [ ] Online-spend validation against confirmed bank balance

### Core money engine
- [ ] Use bank now as visible bank baseline
- [ ] Use cash now as visible cash baseline
- [ ] Use next money anchor for safe-to-spend logic
- [ ] Safe-to-spend = current money minus protected dues minus daily-needs reserve minus optional buffer
- [ ] Keep this as the primary beta output

### Protected dues logic
- [ ] Protect rent
- [ ] Protect EMI
- [ ] Protect credit-card bill
- [ ] Protect subscriptions
- [ ] Protect utilities
- [ ] Protect school fees
- [ ] Protect insurance
- [ ] Protect known recurring commitments
- [ ] Allow user-added protected dues
- [ ] Support due states: pending / partial / paid
- [ ] Show remaining amount clearly for partial dues
- [ ] Allow mark-paid from Home

### Lightweight maintenance model
- [ ] Keep quick actions: cash received, big spend, due paid, upcoming due, cash reset
- [ ] Support payment source: cash / online-UPI / card / split
- [ ] Explain no daily bookkeeping is needed
- [ ] Explain only important changes should be updated
- [ ] Explain bank balance is not spendable balance
- [ ] Explain we protect what matters first

### Home screen
- [ ] Keep Home centered on one main number: safe to spend
- [ ] Show keep aside first prominently
- [ ] Show named dues, not only totals
- [ ] Show safe after dues
- [ ] Show freshness / stale state
- [ ] Show simple explanation of why the number is what it is
- [ ] Show watchouts when something important is coming
- [ ] Keep Home usable without charts

### Daily needs reserve
- [ ] Estimate daily-needs reserve
- [ ] Include groceries / food
- [ ] Include fuel / commute
- [ ] Include medicine
- [ ] Include household basics
- [ ] Keep reserve logic adaptive and explainable

### Operational reliability
- [ ] Global error handling
- [ ] Consistent mobile error UI
- [ ] Retry behavior for network/import failures
- [ ] PostgreSQL as real deployed DB
- [ ] Logging
- [ ] Crash / error tracking

## Strongly Recommended

### Business and hybrid expansion
- [ ] Improve business / self-employed flow
- [ ] Add explicit support for boutique / salon / tuition / clinic style operators
- [ ] Add salary + business hybrid refinement
- [ ] Add home / business / mixed tagging
- [ ] Add business-specific quick actions
- [ ] Add business reserve concept
- [ ] Show what is safe for personal use after business obligations

### Real-world quality
- [ ] 10–15 anonymized real statement test files
- [ ] Bank-specific parser fixes
- [ ] Categorization tuning from real imports
- [ ] Due extractor quality tuning

### Product understanding
- [ ] Basic analytics
- [ ] Onboarding completion tracking
- [ ] Import success tracking
- [ ] First-week usage tracking

### Secondary insights
- [ ] Top 3 spending categories
- [ ] Category totals
- [ ] Keep spending insights secondary, not Home hero content

### Language and trust copy
- [ ] Complete trust-critical Hindi copy
- [ ] Complete trust-critical Marathi copy
- [ ] Remove mixed English in key financial flows
- [ ] Keep wording simple and non-judgmental

### Insight assistant foundation
- [ ] Rule-based Q&A assistant
- [ ] Affordability question flow
- [ ] Spend-by-category answers
- [ ] Quick-commerce / delivery-fee hidden-cost answers
- [ ] Basic question limit for free tier

## Nice To Have
- [ ] Import source labeling by bank / card provider
- [ ] Clear “replace sample with my data” flow
- [ ] Soft goals card
- [ ] Suggested monthly saving
- [ ] Payment-mode breakdown
- [ ] What changed? insight

## Do Not Build Yet
- [ ] WhatsApp bot as required channel
- [ ] LLM-based coach as a dependency
- [ ] Monetization flows
- [ ] Partner offers
- [ ] Household linking
- [ ] Full budgeting system
- [ ] Heavy goal planning
- [ ] Generic wealth dashboard
- [ ] Deep analytics-heavy charts
- [ ] Full business accounting
- [ ] Investment onboarding
- [ ] Tax workflows
- [ ] Insurance workflows
- [ ] Marketplace for side jobs
- [ ] Full government schemes engine

## Exit Criteria

Move beyond Private Beta only when:

- users can import and correct their data without direct help
- auth is stable
- import success is acceptable
- users trust the corrected bank/cash/dues picture
- business and hybrid beta users see themselves in the app

---

# Milestone 3 — Public Beta That Builds Habit

## Goal

The app is not only understandable, but reusable.

Users come back because it stays useful between imports.

## Success Test

A user still updates or checks the app after the first week without hand-holding.

## Must Have

### Habit loop
- [ ] Better Home screen action hierarchy
- [ ] Clear “what do I do next?” prompts
- [ ] End-of-day cash update habit
- [ ] Better due reminder surfaces
- [ ] Retention analytics

### Value beyond one number
- [ ] Expand the rule-based Q&A assistant
- [ ] Hidden-cost detection inside Q&A and insight prompts
- [ ] Better watchouts
- [ ] Stronger explanation surfaces
- [ ] More robust scheme recommendations
- [ ] Scheme eligibility checker

### Monetizable intelligence layer
- [ ] Free tier question limit
- [ ] Pro tier expanded answers
- [ ] LLM enhancement for paid users if unit economics work

### Supportability
- [ ] Better logs for user-reported issues
- [ ] Admin/debug visibility for imports and calculation failures
- [ ] Versioned release notes / rollout discipline

## Nice To Have
- [ ] WhatsApp reminders
- [ ] Weekly summary
- [ ] Lightweight notification system

## Not Yet Required
- [ ] Insurance/lending/gig integrations
- [ ] Full conversational LLM coach
- [ ] Household mode

## Exit Criteria

Move beyond Public Beta only when:

- repeat usage is visible
- real users are updating data with moderate consistency
- insight surfaces create value beyond raw money math

---

# Milestone 4 — Production App

## Goal

The app is safe, supportable, and commercially expandable.

## Success Test

You can put real users into the app at scale without the product breaking trust, support, or compliance expectations.

## Must Have

### Product maturity
- [ ] Strong support flows
- [ ] Stable release process
- [ ] Production monitoring
- [ ] Security review
- [ ] Backup / restore discipline
- [ ] Data retention / privacy policy alignment

### Scalable product extensions
- [ ] WhatsApp channel if retention data proves it helps
- [ ] Household mode if demand proves real
- [ ] Monetization only after trust is proven
- [ ] Partner integrations only after core money clarity is stable

## Nice To Have
- [ ] Premium AI assistant
- [ ] Referral marketplace
- [ ] Product offers based on surplus behavior

## Exit Criteria

Production is not “we can publish to the store.”

Production is:

- the app is trustworthy on real data
- the app is supportable
- the app is measurable
- the app has a clear reason to grow

---

# Feature Placement Guide

Use this when debate starts.

## Demo

Allowed:
- sample data
- onboarding polish
- home clarity
- manual update flows
- scheme recommendations
- trust copy improvements

Avoid:
- heavy infra
- monetization
- deep growth systems

## Private Beta

Allowed:
- auth
- imports
- bank confirmation
- due confirmation
- error handling
- logging
- analytics

Avoid:
- broad feature sprawl

## Public Beta

Allowed:
- retention layer
- rule-based Q&A value
- hidden-cost value
- scheme eligibility
- better reminders

Avoid:
- monetization-first thinking

## Production

Allowed:
- monetization
- partnerships
- channel expansion
- household features

---

# Recommended Build Order From Today

## Track A — Finish the core trust engine
1. [ ] Home screen psychological cleanup
2. [ ] Bank-balance confirmation + override
3. [ ] Online-spend validation using confirmed bank balance
4. [ ] Better `safe_to_spend = 0` explanation

## Track B — Finish real-data readiness
5. [ ] CSV import hardening
6. [ ] PDF import hardening
7. [ ] Detected-due review and confirm flow
8. [ ] Real statement test fixtures

## Track C — Make it a real app
9. [ ] Real auth
10. [ ] Protected routes
11. [ ] PostgreSQL deployment cleanup
12. [ ] Logging + crash tracking
13. [ ] Better error handling

## Track D — Only after the above
14. [ ] Rule-based Q&A assistant
15. [ ] Hidden-cost answers inside Q&A
16. [ ] Scheme eligibility checker
17. [ ] WhatsApp reminder layer

---

# LLM Decision Rule

## Use now
- [ ] Rule-based Q&A with deterministic queries and templates

## Use later
- [ ] Claude or similar model for paid users only

## Do not use for core money truth
- [ ] LLM-generated safe-to-spend logic
- [ ] LLM-generated dues protection logic
- [ ] LLM as the only explanation layer

Reason:

- money math should stay deterministic
- insights can be generated from real data without LLM cost
- LLM should enhance the premium assistant experience later, not control the truth layer

---

# PM Bottom Line

If we want to avoid wasting time and money:

## Do not ask:
- “Is this a cool feature?”

## Ask:
- “Which milestone does this belong to?”
- “Does it unblock the current milestone?”
- “What are we delaying if we build it now?”

The next milestone is not “more features.”

The next milestone is:

## A believable app becomes a trustworthy private beta.
