# MoneyOS User Personas

These personas define who the MVP is for and how onboarding and core flows should adapt. The app should use one unified ledger model underneath, but the first-run experience and home screen should feel relevant to each user type.

## 1. Salaried User

### Profile

- fixed monthly salary
- uses a mix of cash, UPI, card, and bank balance
- wants a simple monthly money view, not a complex finance tool

### Pain Points

- loses track of small daily spending
- forgets bills, EMI, subscriptions, or school fees
- does not know how much is safe to spend before next salary
- finds existing apps too complex or chart-heavy

### What Success Looks Like

- sees salary, monthly spending, and cash left in one place
- gets a simple month-based budget view
- sees upcoming EMI and bill pressure clearly

### Onboarding Needs

- ask salary frequency and approximate payday
- ask whether the user wants to track cash also
- start with a monthly summary home screen

## 2. Daily Wage Worker

### Profile

- earns daily or weekly
- often cash-first
- may lend, borrow, or receive partial payments often

### Pain Points

- monthly budgeting feels unnatural
- hard to remember what was earned or spent today
- small loans and cash movements are easy to lose track of
- long forms are a barrier

### What Success Looks Like

- can log today’s earning in seconds
- sees cash-in-hand clearly
- knows whether today or this week was strong or weak

### Onboarding Needs

- ask if income comes daily or weekly
- ask if most money is cash
- start with fast actions like `Earned Today` and `Spent Cash`

## 3. Farmer / Seasonal Earner

### Profile

- income comes in seasonal waves
- home money and work money often mix
- cash and informal loans are common

### Pain Points

- hard to make a monthly plan when income is not monthly
- crop costs and home costs get mixed together
- loan and interest tracking is usually manual and fragmented

### What Success Looks Like

- separates seasonal income from household spending simply
- sees how long money should last until the next earning cycle
- keeps loan and interest obligations visible

### Onboarding Needs

- ask whether income is seasonal, weekly, or mixed
- ask whether they want separate `home` and `work` tracking
- start with cash, dues, and seasonal planning cues

## 4. Business Owner / Self-Employed User

### Profile

- runs a small business, shop, trade, service, or gig income stream
- business and personal money may mix
- cares about cash flow more than formal accounting

### Pain Points

- sales and expenses are not consistently recorded
- daily cash and dues are hard to track
- existing tools feel like accounting software, not everyday money help

### What Success Looks Like

- tracks sales, expenses, and money due without learning accounting
- sees simple daily or monthly business health
- keeps business and home money partly separated

### Onboarding Needs

- ask if they want `home only` or `home + business`
- ask if they need to track money others owe them
- start with sales, spending, and cash balance shortcuts

## 5. Family Money Manager

### Profile

- manages household spending for the family
- may or may not be the main earner
- handles groceries, fees, medicine, rent, and loan payments

### Pain Points

- many small family expenses get forgotten
- income may come from more than one person or source
- planning for bills and sudden expenses is stressful

### What Success Looks Like

- sees the household money picture simply
- knows what cash is available for home use
- can stay ahead of regular bills and EMI

### Onboarding Needs

- ask if one person or the whole household income is being tracked
- ask which regular expenses matter most
- start with family bills, groceries, medicine, and home cash framing

## Cross-Persona Rules

- use plain words and large buttons
- make cash tracking visible in every persona
- do not force bank connection in onboarding
- do not assume monthly salary unless the user says so
- keep trust high by explaining why each question is asked
- let users skip non-essential setup and start entering money quickly

## Shared Onboarding Questions

These are the core questions that should drive the adaptive flow:

- which type of user are you?
- how does money usually come in: daily, weekly, monthly, seasonal, or mixed?
- do you want to track cash?
- do you want to track loans or EMI?
- do you want to import a CSV now or later?

## Persona-To-Home Mapping

- salaried user: monthly summary, bills due, top spending
- daily wage worker: earned today, spent today, cash left
- farmer / seasonal earner: season money left, loans due, home versus work spend
- business owner / self-employed: sales in, expense out, dues, cash
- family manager: home cash, family bills, groceries, medicine, EMI
