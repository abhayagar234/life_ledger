import { apiRequest, BACKEND_WAKEUP_MESSAGE, fetchWithRetry } from "./client";
import type {
  CashflowSummary,
  ConfirmDueItem,
  ConfirmDuesResponse,
  CategoryHelpCandidate,
  DetectedDueResponse,
  DemoLoginRequest,
  DemoLoginResponse,
  DemoActionResponse,
  FileUploadResponse,
  ImportCoverageLiteResponse,
  ImportSummaryResponse,
  ImportCoverageResponse,
  CategoryMappingItem,
  CategoryMappingResponse,
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

const IMPORT_PROCESSING_STATUSES = new Set(["processing", "uploaded"]);
const IMPORT_POLL_INTERVAL_MS = 1800;
const IMPORT_POLL_TIMEOUT_MS = 120000;

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

export function listLedgerEntries(userId: string, limit = 50) {
  return apiRequest<LedgerEntryRead[]>(`/ledger-entries?limit=${limit}`, {
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

export async function uploadImportFile(
  userId: string,
  file: { uri: string; name: string; mimeType: string },
  sourceHint?: "bank" | "card" | "other"
) {
  const form = new FormData();
  form.append("file", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType
  } as any);

  const url = new URL("/imports/files/async", getApiBaseUrl());
  url.searchParams.set("user_id", userId);
  if (sourceHint) {
    url.searchParams.set("source_hint", sourceHint);
  }
  const response = await fetchWithRetry(url.toString(), {
    method: "POST",
    body: form
  }, {
    timeoutMs: 20000,
    retries: 1,
    retryDelayMs: 3000
  });
  if (!response.ok) {
    if ([502, 503, 504].includes(response.status)) {
      throw new Error(BACKEND_WAKEUP_MESSAGE);
    }
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }
  return (await response.json()) as FileUploadResponse;
}

export function getImportFileStatus(userId: string, uploadId: string) {
  return apiRequest<FileUploadResponse>(`/imports/files/${uploadId}`, {
    userId
  });
}

export function isImportProcessing(status: string) {
  return IMPORT_PROCESSING_STATUSES.has(status);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForImportProcessing(
  userId: string,
  uploadId: string,
  onUpdate?: (status: FileUploadResponse) => void
) {
  const startedAt = Date.now();
  let latest = await getImportFileStatus(userId, uploadId);
  onUpdate?.(latest);

  while (isImportProcessing(latest.status) && Date.now() - startedAt < IMPORT_POLL_TIMEOUT_MS) {
    await delay(IMPORT_POLL_INTERVAL_MS);
    latest = await getImportFileStatus(userId, uploadId);
    onUpdate?.(latest);
  }

  return latest;
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

export function getImportCoverageLite(userId: string, uploadIds?: string[]) {
  const query = uploadIds && uploadIds.length > 0 ? `?upload_ids=${encodeURIComponent(uploadIds.join(","))}` : "";
  return apiRequest<ImportCoverageLiteResponse>(`/imports/coverage-lite${query}`, {
    userId,
    timeoutMs: 20000,
    retries: 1,
    retryDelayMs: 3000
  });
}

export function confirmDetectedDues(userId: string, uploadId: string, confirmedDues: ConfirmDueItem[]) {
  return apiRequest<ConfirmDuesResponse>(`/imports/${uploadId}/confirm-dues`, {
    method: "POST",
    userId,
    body: JSON.stringify({ confirmed_dues: confirmedDues })
  });
}

export function getImportCoverage(userId: string, uploadIds?: string[]) {
  const query = uploadIds && uploadIds.length > 0 ? `?upload_ids=${encodeURIComponent(uploadIds.join(","))}` : "";
  return apiRequest<ImportCoverageResponse>(`/imports/coverage${query}`, {
    userId
  });
}

export function getRecurringDues(userId: string, uploadIds?: string[]) {
  const query = uploadIds && uploadIds.length > 0 ? `?upload_ids=${encodeURIComponent(uploadIds.join(","))}` : "";
  return apiRequest<DetectedDueResponse[]>(`/imports/recurring-dues${query}`, {
    userId,
    timeoutMs: 20000,
    retries: 1,
    retryDelayMs: 3000
  });
}

export function getCategoryHelpCandidates(userId: string, uploadIds?: string[]) {
  const query = uploadIds && uploadIds.length > 0 ? `?upload_ids=${encodeURIComponent(uploadIds.join(","))}` : "";
  return apiRequest<CategoryHelpCandidate[]>(`/imports/category-help-candidates${query}`, {
    userId,
    timeoutMs: 20000,
    retries: 1,
    retryDelayMs: 3000
  });
}

export function saveCategoryMappings(userId: string, mappings: CategoryMappingItem[]) {
  return apiRequest<CategoryMappingResponse>("/imports/category-mappings", {
    method: "POST",
    userId,
    body: JSON.stringify({ mappings })
  });
}

export function confirmPatternDue(userId: string, name: string, amount: number, dueDate: string, frequency: string = "monthly") {
  return apiRequest<{ loan_id: string; emi_payment_id: string; message: string }>("/cashflow/confirm-pattern-due", {
    method: "POST",
    userId,
    body: JSON.stringify({ name, amount, due_date: dueDate, frequency })
  });
}
