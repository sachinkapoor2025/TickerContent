import { describe, expect, it } from "vitest";
import {
  SIMULATED_STATUSES,
  SUBSCRIPTION_ERROR_MESSAGE,
  SUBSCRIPTION_LOADING_MESSAGE,
  SUBSCRIPTION_NOT_AVAILABLE,
  SUBSCRIPTION_PAGE_DESCRIPTION,
  SUBSCRIPTION_SIMULATION_NOTE,
  canSimulateSubscription,
  subscriptionPageState,
  subscriptionView,
  type SubscriptionResponse,
} from "./subscriptionData.js";

const payload: SubscriptionResponse = {
  provider: "manual",
  note: "Stripe Billing will be connected later. Access is still enforced from subscription status.",
  subscription: {
    id: "sub_1",
    organizationId: "org_secret",
    planId: "plan_developer",
    status: "active",
    currentPeriodEnd: "2026-12-01T00:00:00.000Z",
    provider: "manual",
  },
  entitlements: {
    status: "active",
    restricted: false,
    remaining: { users: 23, devices: 7, storageBytes: 1024 },
    limits: { "users.max": 25, "devices.max": 10 },
    flags: { "content.publish": true },
  },
};

describe("subscription page mapping", () => {
  it("presents real plan status, period, and remaining limits without Devices inventory language", () => {
    const view = subscriptionView(payload);
    expect(view.statusLabel).toBe("active");
    expect(view.restrictedLabel).toBe("No");
    expect(view.periodLabel).not.toBe(SUBSCRIPTION_NOT_AVAILABLE);
    expect(view.limits).toEqual([
      { id: "users", label: "Users remaining", value: "23" },
      { id: "displays", label: "Displays remaining", value: "7" },
      { id: "storage", label: "Storage remaining", value: "1 KB" },
    ]);
    expect(JSON.stringify(view)).not.toMatch(/Devices remaining|org_secret|plan_developer/);
    expect(SUBSCRIPTION_PAGE_DESCRIPTION).toContain("limits");
  });

  it("covers loading, error, and missing payload without inventing Stripe checkout", () => {
    expect(subscriptionPageState({ loading: true, error: null, data: null })).toEqual({
      kind: "loading",
      message: SUBSCRIPTION_LOADING_MESSAGE,
    });
    expect(subscriptionPageState({ loading: false, error: "nope", data: null })).toEqual({
      kind: "error",
      message: "nope",
    });
    expect(subscriptionPageState({ loading: false, error: null, data: null })).toEqual({
      kind: "error",
      message: SUBSCRIPTION_ERROR_MESSAGE,
    });
    expect(subscriptionPageState({ loading: false, error: SUBSCRIPTION_ERROR_MESSAGE, data: null }).kind).not.toBe("ready");
    expect(subscriptionView({}).limits[0]?.value).toBe(SUBSCRIPTION_NOT_AVAILABLE);
    expect(SUBSCRIPTION_SIMULATION_NOTE).toMatch(/not a payment/i);
    expect(SIMULATED_STATUSES).toContain("active");
  });

  it("keeps simulation as an owner-only MVP control", () => {
    expect(canSimulateSubscription("organization_owner")).toBe(true);
    expect(canSimulateSubscription("viewer")).toBe(false);
    expect(canSimulateSubscription("organization_admin")).toBe(false);
  });
});
