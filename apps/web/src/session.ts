export type CustomerMe = {
  user: { id: string; email: string; name: string; audience: string };
  organization: { id: string; name: string; status: string } | null;
  roleKey: string;
};

export const TENANT_AUDIENCE = "tenant";
export const PLATFORM_WORKSPACE_MESSAGE = "This account cannot access the customer workspace.";
export const UNABLE_TO_SIGN_IN_MESSAGE = "Unable to sign in right now. Please try again.";
export const UNABLE_TO_REGISTER_MESSAGE = "Unable to create your account right now. Please try again.";
export const INVALID_CREDENTIALS_MESSAGE = "Email or password is incorrect.";
export const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please sign in again.";

export type TenantDecision = { ok: true; me: CustomerMe } | { ok: false; message: string };

export function initialSessionStatus(hasToken: boolean): "checking" | "unauthenticated" {
  return hasToken ? "checking" : "unauthenticated";
}

export function isAuthApiPath(path: string) {
  const pathname = path.split("?")[0] ?? path;
  return pathname === "/v1/auth" || pathname.startsWith("/v1/auth/");
}

export function shouldInvalidateSession(path: string, status: number) {
  return status === 401 && !isAuthApiPath(path);
}

export function evaluateTenantMe(data: unknown): TenantDecision {
  if (!data || typeof data !== "object") {
    return { ok: false, message: UNABLE_TO_SIGN_IN_MESSAGE };
  }
  const me = data as CustomerMe;
  if (!me.user || typeof me.user.audience !== "string") {
    return { ok: false, message: UNABLE_TO_SIGN_IN_MESSAGE };
  }
  if (me.user.audience !== TENANT_AUDIENCE) {
    return { ok: false, message: PLATFORM_WORKSPACE_MESSAGE };
  }
  return { ok: true, me };
}

export function evaluateLoginToken(data: unknown): { ok: true; token: string } | { ok: false; message: string } {
  if (!data || typeof data !== "object") {
    return { ok: false, message: UNABLE_TO_SIGN_IN_MESSAGE };
  }
  const payload = data as { token?: unknown; user?: { audience?: unknown } };
  if (typeof payload.user?.audience === "string" && payload.user.audience !== TENANT_AUDIENCE) {
    return { ok: false, message: PLATFORM_WORKSPACE_MESSAGE };
  }
  if (typeof payload.token !== "string" || !payload.token) {
    return { ok: false, message: UNABLE_TO_SIGN_IN_MESSAGE };
  }
  return { ok: true, token: payload.token };
}

export const CUSTOMER_REGISTER_FIELDS = [
  { key: "name", label: "Full name", type: "text", autoComplete: "name", id: "name" },
  { key: "email", label: "Email", type: "email", autoComplete: "email", id: "email" },
  { key: "password", label: "Password", type: "password", autoComplete: "new-password", id: "password" },
] as const;

export function defaultWorkspaceName(fullName: string) {
  const name = fullName.trim().replace(/\s+/g, " ");
  if (name.length >= 2) return `${name}'s workspace`;
  return "Workspace";
}

export function buildCustomerRegisterPayload(input: { name: string; email: string; password: string }) {
  return {
    name: input.name.trim(),
    email: input.email.trim(),
    password: input.password,
    organizationName: defaultWorkspaceName(input.name),
  };
}

export function customerSignInError(err: unknown, fallback = UNABLE_TO_SIGN_IN_MESSAGE) {
  if (err instanceof TypeError) return fallback;
  const error = err as { status?: number; code?: string; message?: string };
  if (error?.message === PLATFORM_WORKSPACE_MESSAGE) return PLATFORM_WORKSPACE_MESSAGE;
  if (error?.code === "invalid_credentials") return INVALID_CREDENTIALS_MESSAGE;
  if (error?.code === "locked" || error?.code === "email_taken") {
    return typeof error.message === "string" && error.message.trim() ? error.message.trim() : fallback;
  }
  if (error?.status === 400 && typeof error.message === "string" && error.message.trim() && error.message.length < 180) {
    return error.message.trim();
  }
  return fallback;
}
