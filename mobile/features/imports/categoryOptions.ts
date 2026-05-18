import type { DetectedDueResponse } from "../../services/api/types";

export const CATEGORY_OPTIONS: Array<{ code: string; label: string }> = [
  { code: "groceries", label: "Groceries" },
  { code: "health", label: "Hospital / Health" },
  { code: "travel", label: "Travel / Fuel" },
  { code: "bills", label: "Bills / Utilities" },
  { code: "emi_loans", label: "Loan / EMI" },
  { code: "rent", label: "Rent" },
  { code: "insurance", label: "Insurance" },
  { code: "savings_investments", label: "Investment / SIP" },
  { code: "shopping", label: "Shopping" },
  { code: "dining", label: "Dining / Food" },
  { code: "subscriptions", label: "Subscriptions" },
  { code: "education", label: "Education" },
  { code: "transfers", label: "Transfer / Personal" },
  { code: "uncategorized", label: "Other" }
];

export function formatMoney(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function dueDateFromEstimate(value?: string | null) {
  if (value) {
    return value;
  }
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export function dueKey(due: DetectedDueResponse) {
  return `${due.counterparty_name}:${due.amount}:${due.frequency}:${due.next_due_estimate ?? "no-date"}`;
}

export function prettyCategory(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  if (value === "uncategorized") {
    return "Other spends";
  }
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function categoryLabel(categoryCode: string | undefined | null) {
  if (!categoryCode) {
    return "Choose category";
  }
  const found = CATEGORY_OPTIONS.find((item) => item.code === categoryCode);
  return found?.label ?? prettyCategory(categoryCode) ?? "Choose category";
}
