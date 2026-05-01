import { apiRequest } from "./client";
import type {
  CashflowSummary,
  DemoLoginRequest,
  DemoLoginResponse,
  DemoActionResponse,
  InsightCard,
  LedgerEntryCreate,
  LedgerEntryRead,
  MonthlySummaryRead,
  UpcomingDueCreate,
  UpcomingDueRead,
  ProfileOnboardingUpdate,
  ProfileRead,
  SpendingInsightsResponse
} from "./types";

export function demoLogin(payload: DemoLoginRequest) {
  return apiRequest<DemoLoginResponse>("/auth/demo-login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function getProfile(userId: string) {
  return apiRequest<ProfileRead | null>("/profile", { userId });
}

export function upsertProfile(userId: string, payload: ProfileOnboardingUpdate) {
  return apiRequest<ProfileRead>("/profile/onboarding", {
    method: "PUT",
    userId,
    body: JSON.stringify(payload)
  });
}

export function getMonthlySummary(userId: string, year: number, month: number) {
  return apiRequest<MonthlySummaryRead>(`/monthly-summaries/${year}/${month}`, {
    userId
  });
}

export function getSpendingSummary(userId: string, year?: number, month?: number) {
  const query = new URLSearchParams();
  if (year) {
    query.set("year", String(year));
  }
  if (month) {
    query.set("month", String(month));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<SpendingInsightsResponse>(`/insights/summary${suffix}`, {
    userId
  });
}

export function listInsights(userId: string, year?: number, month?: number) {
  const query = new URLSearchParams();
  if (year) {
    query.set("year", String(year));
  }
  if (month) {
    query.set("month", String(month));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiRequest<InsightCard[]>(`/insights${suffix}`, {
    userId
  });
}

export function getCashflowSummary(userId: string) {
  return apiRequest<CashflowSummary>("/cashflow/summary", {
    userId
  });
}

export function createLedgerEntry(userId: string, payload: LedgerEntryCreate) {
  return apiRequest<LedgerEntryRead>("/ledger-entries", {
    method: "POST",
    userId,
    body: JSON.stringify(payload)
  });
}

export function loadSampleStatement(userId: string) {
  return apiRequest<DemoActionResponse>("/demo/sample-statement", {
    method: "POST",
    userId
  });
}

export function createUpcomingDue(userId: string, payload: UpcomingDueCreate) {
  return apiRequest<UpcomingDueRead>("/upcoming-dues", {
    method: "POST",
    userId,
    body: JSON.stringify(payload)
  });
}
