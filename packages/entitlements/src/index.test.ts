import { describe, expect, it } from "vitest";
import { DEVELOPER_PLAN, evaluate, requireFlag } from "./index.js";

const now = new Date("2026-09-08T00:00:00Z");
const later = new Date("2026-12-01T00:00:00Z");

describe("evaluate", () => {
  it("grants developer plan when active", () => {
    const snap = evaluate({
      status: "active",
      currentPeriodEnd: later,
      now,
      plan: DEVELOPER_PLAN,
    });
    expect(snap.restricted).toBe(false);
    expect(snap.flags["content.publish"]).toBe(true);
    expect(snap.remaining.devices).toBe(10);
  });

  it("blocks publish when expired", () => {
    const snap = evaluate({
      status: "expired",
      currentPeriodEnd: now,
      now,
      plan: DEVELOPER_PLAN,
    });
    expect(snap.restricted).toBe(true);
    expect(snap.flags["content.publish"]).toBe(false);
    expect(snap.flags["billing.manage"]).toBe(true);
    expect(snap.reason).toBe("subscription_expired");
  });

  it("keeps access during cancelled period", () => {
    const snap = evaluate({
      status: "cancelled",
      currentPeriodEnd: later,
      now,
      plan: DEVELOPER_PLAN,
    });
    expect(snap.restricted).toBe(false);
    expect(snap.flags["content.publish"]).toBe(true);
  });

  it("restricts cancelled after period end", () => {
    const snap = evaluate({
      status: "cancelled",
      currentPeriodEnd: new Date("2026-01-01T00:00:00Z"),
      now,
      plan: DEVELOPER_PLAN,
    });
    expect(snap.restricted).toBe(true);
    expect(snap.flags["content.publish"]).toBe(false);
  });

  it("treats past_due inside grace as usable", () => {
    const snap = evaluate({
      status: "past_due",
      currentPeriodEnd: later,
      now,
      graceEndsAt: later,
      plan: DEVELOPER_PLAN,
    });
    expect(snap.restricted).toBe(false);
    expect(snap.status).toBe("grace");
  });

  it("applies admin override until expiry", () => {
    const snap = evaluate({
      status: "expired",
      currentPeriodEnd: now,
      now,
      plan: DEVELOPER_PLAN,
      overrides: [{ key: "content.publish", enabled: true, expiresAt: later }],
    });
    expect(snap.restricted).toBe(true);
    expect(snap.flags["content.publish"]).toBe(false);
  });

  it("honors override when not restricted", () => {
    const snap = evaluate({
      status: "active",
      currentPeriodEnd: later,
      now,
      plan: DEVELOPER_PLAN,
      overrides: [{ key: "data.market", enabled: true }],
    });
    expect(snap.flags["data.market"]).toBe(true);
  });
});

describe("requireFlag", () => {
  it("throws when flag is off", () => {
    const snap = evaluate({
      status: "expired",
      currentPeriodEnd: now,
      now,
      plan: DEVELOPER_PLAN,
    });
    expect(() => requireFlag(snap, "content.publish")).toThrow(/entitlement_denied/);
  });
});
