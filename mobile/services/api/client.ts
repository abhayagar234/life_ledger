const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

type RequestOptions = RequestInit & {
  userId?: string | null;
};

function buildUrl(path: string, userId?: string | null) {
  const url = new URL(path, API_BASE_URL);
  if (userId) {
    url.searchParams.set("user_id", userId);
  }
  return url.toString();
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { userId, headers, ...init } = options;
  const response = await fetch(buildUrl(path, userId), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}
