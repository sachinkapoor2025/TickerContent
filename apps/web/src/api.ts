import { shouldInvalidateSession } from "./session";

const TOKEN_KEY = "ticker_cms_token";

type SessionListener = () => void;

const sessionListeners = new Set<SessionListener>();
let invalidatingSession = false;

export function token(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(value: string | null) {
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

export function onSessionInvalidated(listener: SessionListener) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

export function clearCustomerSession() {
  setToken(null);
}

function invalidateAuthenticatedSession() {
  if (invalidatingSession) return;
  invalidatingSession = true;
  setToken(null);
  for (const listener of sessionListeners) listener();
  invalidatingSession = false;
}

export class ApiError extends Error {
  code?: string;
  status?: number;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const isForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!headers.has("content-type") && init.body && !isForm) headers.set("content-type", "application/json");
  const t = token();
  if (t) headers.set("authorization", `Bearer ${t}`);
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error?.message ?? res.statusText;
    if (shouldInvalidateSession(path, res.status)) invalidateAuthenticatedSession();
    throw new ApiError(message, res.status, data?.error?.code);
  }
  return data as T;
}
