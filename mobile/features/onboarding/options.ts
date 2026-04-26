import type { IncomePattern, TrackingScope, UserType } from "../../services/api/types";

export const userTypeOptions: Array<{
  value: UserType;
  title: string;
  subtitle: string;
  icon: string;
}> = [
  { value: "salaried", title: "💼 Salaried", subtitle: "Corporate professional, office staff, monthly salary", icon: "wallet-outline" },
  { value: "daily_wage", title: "🛠️ Daily Wage", subtitle: "Construction worker, driver, helper, daily income", icon: "sunny-outline" },
  { value: "farmer_seasonal", title: "🌾 Farmer / Seasonal", subtitle: "Harvest income or money that comes in waves", icon: "leaf-outline" },
  { value: "business_self_employed", title: "🏪 Business / Self-Employed", subtitle: "Shop owner, freelancer, service work, mixed money", icon: "storefront-outline" },
  { value: "family_manager", title: "🏠 Family Manager", subtitle: "One person keeping household money visible", icon: "people-outline" }
];

export const incomePatternOptions: Array<{
  value: IncomePattern;
  title: string;
  subtitle: string;
  icon: string;
}> = [
  { value: "daily", title: "☀️ Daily", subtitle: "Money comes in most days", icon: "today-outline" },
  { value: "weekly", title: "📅 Weekly", subtitle: "Money usually comes once a week", icon: "calendar-outline" },
  { value: "monthly", title: "🧾 Monthly", subtitle: "Salary or regular monthly payout", icon: "calendar-clear-outline" },
  { value: "seasonal", title: "🌦️ Seasonal", subtitle: "Bigger money only at certain times", icon: "partly-sunny-outline" },
  { value: "mixed", title: "🔀 Mixed", subtitle: "Money comes in different ways", icon: "shuffle-outline" }
];

export const trackingScopeOptions: Array<{
  value: TrackingScope;
  title: string;
  subtitle: string;
}> = [
  { value: "personal", title: "Home Only", subtitle: "Track personal or household money" },
  { value: "household", title: "Whole Household", subtitle: "See family income and spending together" },
  { value: "home_and_business", title: "Home + Business", subtitle: "Keep business and home money visible" }
];
