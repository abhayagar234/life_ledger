export type UserType =
  | "salaried"
  | "daily_wage"
  | "farmer_seasonal"
  | "business_self_employed"
  | "family_manager";

export type IncomePattern = "daily" | "weekly" | "monthly" | "seasonal" | "mixed";
export type TrackingScope = "personal" | "household" | "home_and_business";

export type DemoLoginRequest = {
  display_name: string;
  phone_number?: string | null;
  force_new?: boolean;
};

export type DemoLoginResponse = {
  user_id: string;
  display_name: string;
  message: string;
};

export type ProfileRead = {
  id: string;
  user_id: string;
  user_type: UserType;
  income_pattern: IncomePattern;
  tracks_cash: boolean;
  tracks_loans: boolean;
  tracks_emi: boolean;
  tracking_scope: TrackingScope;
  currency_code: string;
  start_cash_amount: number | null;
  salary_day_of_month: number | null;
  next_income_in_days: number | null;
  business_mode_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type ProfileOnboardingUpdate = {
  display_name: string;
  user_type: UserType;
  income_pattern: IncomePattern;
  tracks_cash: boolean;
  tracks_loans: boolean;
  tracks_emi: boolean;
  tracking_scope: TrackingScope;
  start_cash_amount?: number | null;
  salary_day_of_month?: number | null;
  next_income_in_days?: number | null;
  business_mode_enabled: boolean;
};

export type CategorySpendItem = {
  category: string;
  amount: number;
  percentage: number;
};

export type SpendingInsightsResponse = {
  period_start: string;
  period_end: string;
  planning_mode: string;
  monthly_income: number;
  total_spend: number;
  transfer_total: number;
  savings_allocations_total: number;
  fixed_obligations_total: number;
  essential_spend_total: number;
  flexible_spend_total: number;
  emi_burden_ratio: number | null;
  savings_rate: number | null;
  safe_to_spend: number;
  runway_days: number | null;
  goal_gap_total: number | null;
  top_categories: CategorySpendItem[];
  guidance: string[];
};

export type MonthlySummaryRead = {
  id: string;
  user_id: string;
  year: number;
  month: number;
  income_total: number;
  expense_total: number;
  cash_in_total: number;
  cash_out_total: number;
  loan_due_total: number;
  emi_due_total: number;
  primary_insight: string;
  created_at: string;
  updated_at: string;
};

export type InsightCard = {
  title: string;
  message: string;
  period_start: string;
  period_end: string;
};

export type CashflowSummary = {
  as_of_date: string;
  latest_activity_date: string | null;
  status: string;
  headline: string;
  plain_summary: string;
  safe_till_date: string | null;
  next_income_date: string | null;
  effective_available_money: number;
  liquid_balance: number;
  cash_on_hand: number;
  upcoming_dues_total: number;
  daily_needs_buffer: number;
  daily_needs_required: number;
  baseline_daily_spend: number;
  runway_days: number | null;
  safe_to_spend: number;
  safe_to_save: number;
  safe_to_invest: number;
  shortfall_amount: number;
  confidence: string;
  explanations: string[];
  watchouts: string[];
  protected_due_items: ProtectedDueItem[];
};

export type ProtectedDueItem = {
  due_key: string;
  name: string;
  amount: number;
  due_date: string;
  status: "pending" | "partial" | "paid";
  amount_paid: number;
  remaining_amount: number;
  source_type: string;
  emi_payment_id: string | null;
  loan_id: string | null;
};

export type LedgerEntryCreate = {
  entry_type: "income" | "expense" | "transfer" | "cash_adjustment" | "loan_disbursal" | "loan_repayment" | "interest_charge" | "emi_payment";
  amount: number;
  entry_date: string;
  account_type?: "cash" | "bank" | "wallet" | "card" | "other";
  counterparty_name?: string | null;
  category_code?: string | null;
  subcategory_code?: string | null;
  description?: string | null;
  source_label?: string | null;
  cash_direction?: "in" | "out" | "set" | "adjust" | null;
  loan_id?: string | null;
  emi_payment_id?: string | null;
  is_business?: boolean | null;
};

export type LedgerEntryRead = {
  id: string;
  user_id: string;
  entry_type: string;
  amount: number;
  currency_code: string;
  entry_date: string;
  account_type: string;
  counterparty_name: string | null;
  category_code: string | null;
  subcategory_code: string | null;
  description: string | null;
  source_label: string | null;
  cash_direction: string | null;
  loan_id: string | null;
  emi_payment_id: string | null;
  is_business: boolean | null;
  is_system_generated: boolean;
  created_at: string;
  updated_at: string;
};

export type DemoActionResponse = {
  status: string;
  message: string;
};

export type UpcomingDueCreate = {
  name: string;
  amount: number;
  due_date: string;
  repeat_monthly?: boolean;
  notes?: string | null;
};

export type UpcomingDueRead = {
  loan_id: string;
  emi_payment_id: string;
  name: string;
  amount: number;
  due_date: string;
  repeat_monthly: boolean;
  notes: string | null;
  created_at: string;
};
