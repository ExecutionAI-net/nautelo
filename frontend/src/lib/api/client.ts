const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8020";

const REFRESH_PATH = "/api/v1/auth/token/refresh/";

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string[]>;
  readonly requestId: string;

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string[]> = {},
    requestId = "",
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    this.requestId = requestId;
  }
}

interface ErrorEnvelope {
  error?: {
    code?: string;
    message?: string;
    fields?: Record<string, string[]>;
    request_id?: string;
  };
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: ErrorEnvelope = {};
  try {
    body = (await response.json()) as ErrorEnvelope;
  } catch {
    // A non-JSON error body (proxy/gateway failure) still becomes an ApiError.
  }
  const envelope = body.error ?? {};
  return new ApiError(
    response.status,
    envelope.code ?? "unexpected_error",
    envelope.message ?? `Request failed with status ${response.status}.`,
    envelope.fields ?? {},
    envelope.request_id ?? response.headers.get("X-Request-ID") ?? "",
  );
}

async function rawFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
}

// Backend rotates and blacklists the refresh token on every use
// (ROTATE_REFRESH_TOKENS + BLACKLIST_AFTER_ROTATION). Two concurrent refresh
// calls sharing the same cookie would otherwise race: the loser hits the
// already-rotated token, gets a 401, and nulls out the token the winner just
// set. `refreshPromise` collapses concurrent same-tab callers onto a single
// request; the Web Lock below serializes callers across tabs so a second
// tab's request only fires once the first tab's cookie rotation has landed.
const REFRESH_LOCK_NAME = "nauta:refresh-access-token";

// A stalled refresh request would otherwise hold the cross-tab lock forever,
// freezing every other tab's session refresh along with it.
export const REFRESH_TIMEOUT_MS = 15_000;

let refreshPromise: Promise<boolean> | null = null;

/**
 * Exchange the HttpOnly refresh cookie for a fresh access token.
 * Returns false (without throwing) when there is no usable session.
 */
export async function tryRefreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = runRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function runRefresh(): Promise<boolean> {
  const locks =
    typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks) {
    return performRefresh();
  }
  return locks.request(REFRESH_LOCK_NAME, () => performRefresh());
}

async function performRefresh(): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${REFRESH_PATH}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: "{}",
      signal: controller.signal,
    });
  } catch {
    accessToken = null;
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
  if (!response.ok) {
    accessToken = null;
    return false;
  }
  const data = (await response.json()) as { access: string };
  accessToken = data.access;
  return true;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  let response = await rawFetch(path, init);

  if (response.status === 401 && path !== REFRESH_PATH) {
    const refreshed = await tryRefreshAccessToken();
    if (refreshed) {
      response = await rawFetch(path, init);
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}
