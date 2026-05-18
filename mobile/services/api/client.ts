const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
export const BACKEND_WAKEUP_MESSAGE = "Backend is waking up. Please try again in a few seconds.";

type RequestOptions = RequestInit & {
  userId?: string | null;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
};

function buildUrl(path: string, userId?: string | null) {
  const url = new URL(path, API_BASE_URL);
  if (userId) {
    url.searchParams.set("user_id", userId);
  }
  return url.toString();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

function isNetworkReachabilityError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = (error.message || "").toLowerCase();
  return (
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("networkerror")
  );
}

function buildBackendUnreachableError() {
  return new Error(
    `Cannot reach backend at ${API_BASE_URL}. Set EXPO_PUBLIC_API_BASE_URL to your deployed API URL or LAN IP and restart Expo.`
  );
}

function buildRetryError(error: unknown) {
  if (isAbortError(error)) {
    return new Error(BACKEND_WAKEUP_MESSAGE);
  }
  if (isNetworkReachabilityError(error)) {
    return buildBackendUnreachableError();
  }
  return error instanceof Error ? error : new Error(BACKEND_WAKEUP_MESSAGE);
}

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: { timeoutMs?: number; retries?: number; retryDelayMs?: number } = {}
) {
  const timeoutMs = options.timeoutMs ?? 20000;
  const retries = options.retries ?? 0;
  const retryDelayMs = options.retryDelayMs ?? 3000;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, init, timeoutMs);
      if ([502, 503, 504].includes(response.status) && attempt < retries) {
        await delay(retryDelayMs);
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= retries) {
        throw buildRetryError(error);
      }
      await delay(retryDelayMs);
    }
  }

  throw buildRetryError(lastError);
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { userId, headers, timeoutMs, retries, retryDelayMs, ...init } = options;
  const response = await fetchWithRetry(buildUrl(path, userId), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  }, {
    timeoutMs,
    retries,
    retryDelayMs
  });

  if (!response.ok) {
    if ([502, 503, 504].includes(response.status)) {
      throw new Error(BACKEND_WAKEUP_MESSAGE);
    }
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}
