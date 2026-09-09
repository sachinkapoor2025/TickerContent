import { describe, expect, it } from "vitest";
import {
  CUSTOMER_REGISTER_FIELDS,
  INVALID_CREDENTIALS_MESSAGE,
  PLATFORM_WORKSPACE_MESSAGE,
  SESSION_EXPIRED_MESSAGE,
  UNABLE_TO_SIGN_IN_MESSAGE,
  buildCustomerRegisterPayload,
  customerSignInError,
  defaultWorkspaceName,
  evaluateLoginToken,
  evaluateTenantMe,
  initialSessionStatus,
  shouldInvalidateSession,
} from "./session.js";

const tenantMe = {
  user: { id: "usr_1", email: "owner@demo.local", name: "Owner", audience: "tenant" },
  organization: { id: "org_1", name: "Demo Venue", status: "active" },
  roleKey: "organization_owner",
};

describe("customer session bootstrap", () => {
  it("treats a missing token as unauthenticated without checking", () => {
    expect(initialSessionStatus(false)).toBe("unauthenticated");
    expect(initialSessionStatus(true)).toBe("checking");
  });

  it("accepts a tenant /v1/me identity", () => {
    expect(evaluateTenantMe(tenantMe)).toEqual({ ok: true, me: tenantMe });
  });

  it("rejects a platform /v1/me identity", () => {
    expect(
      evaluateTenantMe({
        ...tenantMe,
        user: { ...tenantMe.user, audience: "platform" },
        organization: null,
      }),
    ).toEqual({ ok: false, message: PLATFORM_WORKSPACE_MESSAGE });
  });

  it("rejects missing or unexpected identity payloads", () => {
    expect(evaluateTenantMe(null).ok).toBe(false);
    expect(evaluateTenantMe({}).ok).toBe(false);
  });
});

describe("customer login identity", () => {
  it("accepts a tenant login token", () => {
    expect(evaluateLoginToken({ token: "jwt", user: { audience: "tenant" } })).toEqual({
      ok: true,
      token: "jwt",
    });
  });

  it("rejects a platform login without entering the workspace", () => {
    expect(evaluateLoginToken({ token: "jwt", user: { audience: "platform" } })).toEqual({
      ok: false,
      message: PLATFORM_WORKSPACE_MESSAGE,
    });
  });

  it("accepts a register payload that omits audience until /v1/me is checked", () => {
    expect(evaluateLoginToken({ token: "jwt", user: { id: "usr_1", email: "a@b.c", name: "A" } })).toEqual({
      ok: true,
      token: "jwt",
    });
  });

  it("rejects HTTP 200 payloads that omit a token", () => {
    expect(evaluateLoginToken({ user: { audience: "tenant" } }).ok).toBe(false);
  });
});

describe("session invalidation", () => {
  it("invalidates authenticated 401 responses but not login/register 401s", () => {
    expect(shouldInvalidateSession("/v1/me", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/dashboard", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/tickers", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/playback/tickers/tkr_1", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/auth/login", 401)).toBe(false);
    expect(shouldInvalidateSession("/v1/auth/register", 401)).toBe(false);
  });

  it("rejects expired or invalid authenticated tokens as session failures", () => {
    expect(shouldInvalidateSession("/v1/me", 401)).toBe(true);
    expect(evaluateTenantMe({ user: { id: "usr_1", email: "a@b.c", name: "A", audience: "tenant" } }).ok).toBe(true);
  });
});

describe("customer auth errors", () => {
  it("maps invalid credentials and network failures without exposing token errors", () => {
    expect(customerSignInError({ code: "invalid_credentials", status: 401 })).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(customerSignInError(new TypeError("Failed to fetch"))).toBe(UNABLE_TO_SIGN_IN_MESSAGE);
    expect(customerSignInError({ status: 401, code: "unauthorized", message: "Invalid token." })).toBe(
      UNABLE_TO_SIGN_IN_MESSAGE,
    );
    expect(customerSignInError({ status: 500 }, "Unable to create your account right now. Please try again.")).toBe(
      "Unable to create your account right now. Please try again.",
    );
    expect(SESSION_EXPIRED_MESSAGE).toContain("expired");
  });
});

describe("customer account registration", () => {
  it("does not present organization fields in the signup form", () => {
    expect(CUSTOMER_REGISTER_FIELDS.map((field) => field.label)).toEqual(["Full name", "Email", "Password"]);
    expect(CUSTOMER_REGISTER_FIELDS.map((field) => field.id)).toEqual(["name", "email", "password"]);
    expect(
      CUSTOMER_REGISTER_FIELDS.some(
        (field) => field.key === "organizationName" || /organization/i.test(field.label) || /organization/i.test(field.id),
      ),
    ).toBe(false);
  });

  it("sends an internal workspace name so the existing register API still creates a tenant", () => {
    const payload = buildCustomerRegisterPayload({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "longenough",
    });
    expect(payload).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "longenough",
      organizationName: "Ada Lovelace's workspace",
    });
    expect(payload.organizationName.length).toBeGreaterThanOrEqual(2);
    expect(defaultWorkspaceName("A")).toBe("Workspace");
    expect(evaluateLoginToken({ token: "jwt", user: { audience: "tenant" } }).ok).toBe(true);
    expect(evaluateLoginToken({ token: "jwt", user: { audience: "platform" } })).toEqual({
      ok: false,
      message: PLATFORM_WORKSPACE_MESSAGE,
    });
    expect(customerSignInError({ code: "email_taken", message: "An account with this email already exists." })).toBe(
      "An account with this email already exists.",
    );
  });
});
