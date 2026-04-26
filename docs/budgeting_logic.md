# MoneyOS Budgeting Logic

## Goal

Turn transaction summaries into simple planning metrics that help users answer:

- how much came in?
- how much went out?
- what must be paid?
- what can still move?
- what is safe to spend now?

This logic is for MVP budgeting guidance, not full financial planning or accounting.

## Planning Modes

MoneyOS should support three planning modes:

- `salaried`
- `irregular_income`
- `business_self_employed`

`irregular_income` covers daily wage, mixed-income, and farmer / seasonal users.

## Design Principles

- keep formulas understandable
- avoid false precision
- use buckets the user can recognize
- protect fixed dues before giving spend suggestions
- separate transfers and savings from spending
- recommend small practical actions, not idealized budgets

## Bucket Definitions

These buckets should be derived from categorized transactions.

### Income

Count inflows that represent earned money in the selected period.

Include:

- salary
- wages
- seasonal receipts
- business sales receipts
- customer payments

Exclude:

- transfers between own accounts
- cash withdrawals
- loans received
- balance adjustments

Formula:

- `monthly_income = sum(earned inflows in period)`

### Fixed Obligations

Expected or contract-like dues the user usually cannot skip.

Typical categories:

- `emi_loans`
- `rent`
- `subscriptions`
- utility bills marked fixed
- school fees
- insurance premiums

Formula:

- `fixed_obligations = sum(expense transactions flagged fixed obligation)`

### Flexible Spend

Spending that is easiest to reduce first.

Typical categories:

- `shopping`
- `entertainment`
- non-essential travel
- optional subscriptions not marked fixed

Formula:

- `flexible_spend = sum(expense transactions in flexible bucket)`

### Essential Spend

Necessary day-to-day spend that is not always fixed in amount.

Typical categories:

- groceries
- health
- routine travel
- core bills not already counted as fixed
- farming expense needed for livelihood
- business expense needed to keep earning

Formula:

- `essential_spend = sum(expense transactions in essential bucket)`

### Monthly Expense

All spending for the period, excluding transfers and savings allocations.

Formula:

- `monthly_expense = fixed_obligations + essential_spend + flexible_spend + other_spend`

Notes:

- `other_spend` is small spillover from categories not yet mapped cleanly
- transfers should not inflate spend
- savings allocations should be shown separately, not inside expense

### Savings Allocations

Money intentionally moved into savings or investments.

Formula:

- `savings_allocations = sum(transactions categorized as savings or investments)`

### EMI Burden Ratio

How much of income is consumed by EMI and loan repayments.

Formula:

- `emi_burden_ratio = emi_repayments / monthly_income`

Where:

- `emi_repayments = sum(emi_loans category or EMI-linked repayments in period)`

If `monthly_income <= 0`:

- do not compute the ratio

Interpretation:

- below `20%`: usually manageable
- `20% to 35%`: needs attention
- above `35%`: high pressure

### Savings Rate

How much of earned income remains after spending.

Formula:

- `savings_rate = (monthly_income - monthly_expense) / monthly_income`

If explicit savings tracking is important, also expose:

- `planned_savings_rate = savings_allocations / monthly_income`

If `monthly_income <= 0`:

- do not compute savings rate

### Goal Gap

How far the user is from an active goal.

Formula:

- `goal_gap = max(target_amount - current_amount, 0)`

If multiple active goals exist:

- `goal_gap_total = sum(goal_gap for each active goal)`

### Runway

How long current liquid money may last if the user protects only essentials and fixed dues.

Formula:

- `daily_survival_spend = (essential_spend + fixed_obligations) / reference_days`
- `runway_days = liquid_balance / daily_survival_spend`

Where:

- `reference_days = 30` by default
- `liquid_balance` should be a conservative cash-plus-bank number when available

If `daily_survival_spend <= 0` or liquid balance is unknown:

- do not show runway

## Safe-To-Spend

Safe-to-spend should be conservative. It is not “money left in theory.” It is the amount that can still be spent without hurting dues and buffer needs.

Generic shape:

- `safe_to_spend = available_money - protected_dues - protected_buffer`

Clamp:

- if result is negative, show `0`

Round:

- round to simple user-facing numbers such as nearest `50`, `100`, or `500`

## User-Type Specific Logic

## 1. Salaried

### Core Planning Frame

Use the salary cycle as the default planning unit.

Primary view:

- current calendar month
- optionally phrase guidance as “before next salary”

### Core Formulas

- `monthly_income = sum(income in current month)`
- `monthly_expense = fixed_obligations + essential_spend + flexible_spend + other_spend`
- `remaining_income = monthly_income - monthly_expense - savings_allocations`
- `remaining_fixed_obligations = fixed dues still unpaid before next salary`
- `essential_buffer = 7 to 10 days of average essential spend`
- `safe_to_spend = remaining_income - remaining_fixed_obligations - essential_buffer`

If no salary day is known:

- use month-end as the default cycle boundary

### Recommendation Logic

- start from last `2 to 3` full months if available
- keep fixed categories near actual observed levels
- keep essentials near realistic history, not aspirational cuts
- trim flexible categories first when pressure is visible

Suggested budgeting behavior:

- if `emi_burden_ratio > 0.35`, avoid increasing flexible budgets
- if `savings_rate < 0`, recommend a small cut in one flexible bucket
- if fixed dues plus essentials already use most income, show a caution before showing safe-to-spend

### Practical Defaults

- savings target: about `10%` of income when feasible
- essential buffer: about `1 week` of essentials
- flexible reduction when overspending: `5% to 15%`, not dramatic cuts

## 2. Irregular Income

### Core Planning Frame

Do not force a salary-style monthly budget.

Primary view:

- recent `30` days
- current liquid money
- dues due soon
- runway

### Core Formulas

- `income_window = sum(income in last 30 days)`
- `expense_window = sum(expense in last 30 days excluding transfers and savings allocations)`
- `dues_due_soon = fixed obligations due in next 7 to 14 days`
- `daily_survival_spend = (essential_spend + fixed_obligations) / 30`
- `runway_days = liquid_balance / daily_survival_spend`
- `survival_buffer = 5 to 15 days of daily_survival_spend`
- `safe_to_spend = liquid_balance - dues_due_soon - survival_buffer`

Clamp:

- if result is negative, show `0`

### Daily Wage Logic

For daily wage users:

- prioritize short-term stability over monthly targets
- show weekly caution if expenses are outrunning recent earnings
- recommend holding a small cash buffer before flexible spending

Practical default:

- protect at least `5 to 7` days of survival spend

### Farmer / Seasonal Logic

For seasonal earners:

- anchor planning to the last major earning cycle, not only this month
- treat harvested or seasonal receipts as money that must stretch across lean periods

Useful formulas:

- `season_income = sum(major seasonal inflows in current cycle)`
- `season_spend_to_date = sum(essential_spend + fixed_obligations + livelihood spend in cycle)`
- `season_money_left = season_income - season_spend_to_date`

Practical default:

- protect a longer reserve than daily wage users when a dry period is expected

### Recommendation Logic

- avoid strict category ceilings when income is unstable
- show warnings only when runway is short or dues are near
- reduce flexible spend first
- do not tell the user to cut groceries or medicine first

## 3. Business / Self-Employed

### Core Planning Frame

Focus on cash flow and separation between livelihood money and home spending.

Primary view:

- money in
- business expense
- home expense
- fixed dues
- reserve needed to keep work running

### Core Formulas

- `money_in = sum(all earned inflows in period)`
- `business_expense_total = sum(expense transactions where is_business = true or category is business/farming expense)`
- `home_expense_total = sum(non-business expense transactions)`
- `fixed_obligations = business fixed dues + home fixed dues`
- `operating_reserve = 7 to 14 days of average business expense`
- `home_buffer = 7 days of essential home spend`
- `safe_to_spend = money_in - business_expense_total - home_expense_total - remaining_fixed_obligations - operating_reserve - home_buffer`

Clamp:

- if result is negative, show `0`

### Recommendation Logic

- protect business-running costs before flexible home spending
- if home withdrawals are rising faster than income, flag owner-draw pressure
- if business expense is high but stable, do not treat it like wasteful spending
- if flexible home spend is rising during weak sales periods, recommend trimming there first

Useful derived signal:

- `owner_draw_pressure = home_expense_total / money_in`

If `money_in <= 0`:

- do not compute owner-draw pressure

## Budget Recommendation Rules

## Rule 1. Start From History

Use recent history, not arbitrary textbook percentages.

Lookback guidance:

- salaried: last `2 to 3` full months
- irregular: last `30` days or last meaningful earning cycle
- business: last `4 to 8` weeks

## Rule 2. Protect Fixed Obligations First

Always reserve for:

- EMI
- rent
- utilities
- school fees
- insurance

## Rule 3. Protect Essential Survival Spend Second

Essentials are the second layer of protection after fixed dues.

Do not recommend cuts there unless spending is obviously unusual.

## Rule 4. Reduce Flexible Spend First

If guidance requires a cut, start with:

- shopping
- entertainment
- optional subscriptions
- clearly discretionary travel

## Rule 5. Use Small, Rounded Suggestions

Good:

- `Try keeping shopping under 3,000 this month`
- `Hold back about 2,000 for upcoming dues`

Avoid:

- exact decimals
- long projections
- pretending future income is guaranteed

## Rule 6. Stay Honest About Weak Data

If history is thin or categorization is incomplete:

- show broad guidance only
- avoid strong targets
- tell the user the estimate is based on limited records

## Default Recommendation Templates

If enough data exists:

- fixed bucket budget = recent observed average or current due amount, whichever is higher
- essential bucket budget = recent average, lightly rounded
- flexible bucket budget = recent average, reduced only when pressure is visible

If data is weak:

- fixed bucket budget = current known dues
- essential bucket budget = recent 30-day average if available
- flexible bucket budget = simple cap based on remaining safe-to-spend

## No-False-Precision Rules

- round money values before showing them
- say `about`, `around`, or `roughly` for forecasts
- present runway as an estimate, not a promise
- do not infer stable monthly income for irregular earners
- do not compute ratios when denominator quality is weak

## MVP Notes

- keep formulas explicit in backend code
- version the logic so UI copy can stay consistent
- prefer explainable heuristics over personalization
- use LLM only to explain the output, not to invent the numbers
