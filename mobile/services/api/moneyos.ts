import { apiRequest } from "./client";
import type {
  CashflowSummary,
  ConfirmDueItem,
  ConfirmDuesResponse,
  DetectedDueResponse,
  DemoLoginRequest,
  DemoLoginResponse,
  DemoActionResponse,
  FileUploadResponse,
  ImportSummaryResponse,
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
import { getApiBaseUrl } from "./client";

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

export function listLedgerEntries(userId: string) {
  return apiRequest<LedgerEntryRead[]>("/ledger-entries", {
    userId
  });
}

export function loadSampleStatement(userId: string) {
  return apiRequest<DemoActionResponse>("/demo/sample-statement", {
    method: "POST",
    userId
  });
}

export function updateBankBalance(
  userId: string, 
  amount: number, 
  source: "detected" | "manual"
) {
  return apiRequest<any>("/profile/bank-balance", {
    method: "PUT",
    userId,
    body: JSON.stringify({ amount, source })
  });
}

export function updateDailyNeeds(userId: string, amount: number) {
  return apiRequest<any>("/profile/daily-needs", {
    method: "PUT",
    userId,
    body: JSON.stringify({ amount })
  });
}

export function createUpcomingDue(userId: string, payload: UpcomingDueCreate) {
  return apiRequest<UpcomingDueRead>("/upcoming-dues", {
    method: "POST",
    userId,
    body: JSON.stringify(payload)
  });
}

export async function uploadImportFile(userId: string, file: { uri: string; name: string; mimeType: string }) {
  const form = new FormData();
  form.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType
  } as any);

  const url = new URL("/imports/files", getApiBaseUrl());
  url.searchParams.set("user_id", userId);
  const response = await fetch(url.toString(), {
    method: "POST",
    body: form
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as FileUploadResponse;
}

export function getDetectedDues(userId: string, uploadId: string) {
  return apiRequest<DetectedDueResponse[]>(`/imports/${uploadId}/detected-dues`, {
    userId
  });
}

export function getImportSummary(userId: string, uploadId: string) {
  return apiRequest<ImportSummaryResponse>(`/imports/${uploadId}/summary`, {
    userId
  });
}

export function confirmDetectedDues(userId: string, uploadId: string, confirmedDues: ConfirmDueItem[]) {
  return apiRequest<ConfirmDuesResponse>(`/imports/${uploadId}/confirm-dues`, {
    method: "POST",
    userId,
    body: JSON.stringify({ confirmed_dues: confirmedDues })
  });
}

export function confirmPatternDue(userId: string, name: string, amount: number, dueDate: string, frequency: string = "monthly") {
  return apiRequest<{ loan_id: string; emi_payment_id: string; message: string }>("/cashflow/confirm-pattern-due", {
    method: "POST",
    userId,
    body: JSON.stringify({ name, amount, due_date: dueDate, frequency })
  });
}
