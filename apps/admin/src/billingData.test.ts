import { describe, expect, it } from "vitest";
import {
  entitlementFeatures,
  entitlementLimits,
  filterPlanRows,
  filterSubscriptionRows,
  findPlan,
  planRows,
  subscriptionPlans,
  subscriptionRows,
  subscriptionStatuses,
  usageText,
} from "./billingData";
import type { AdminOrgDetail, AdminOrgListItem } from "./dashboardData";

const orgs: AdminOrgListItem[] = [
  {
    id: "org_a",
    name: "Org A",
    status: "active",
    subscription: { status: "active", planId: "plan_developer", provider: "manual", currentPeriodEnd: "2026-12-01T00:00:00Z" },
  },
  {
    id: "org_b",
    name: "Org B",
    status: "active",
    subscription: { status: "suspended", planId: "plan_starter", provider: "manual" },
  },
  {
    id: "org_c",
    name: "Org C",
    status: "active",
    subscription: { status: "active", planId: "plan_developer", provider: "manual" },
  },
  { id: "org_d", name: "Org D", status: "active", subscription: null },
];

const details: Record<string, AdminOrgDetail> = {
  org_a: {
    organization: { id: "org_a", name: "Org A", status: "active" },
    subscription: { status: "active", planId: "plan_developer", provider: "manual", currentPeriodEnd: "2026-12-01T00:00:00Z" },
    plan: { id: "plan_developer", name: "Developer", code: "developer" },
    entitlements: {
      restricted: false,
      status: "active",
      flags: { "content.publish": true, "ai.copilot": false, "devices.max": true },
      limits: { "devices.max": 10, "users.max": 25 },
      remaining: { users: 23, devices: 7, storageBytes: null },
    },
    memberCount: 2,
    tickerCount: 3,
  },
  org_b: {
    organization: { id: "org_b", name: "Org B", status: "active" },
    subscription: { status: "suspended", planId: "plan_starter", provider: "manual" },
    plan: { id: "plan_starter", name: "Starter", code: "starter" },
    entitlements: { restricted: true, status: "suspended", flags: { "content.publish": false }, limits: { "devices.max": 2 } },
    memberCount: 1,
    tickerCount: 1,
  },
};

describe("admin billing aggregations", () => {
  it("groups organizations by assigned plan without inventing unused catalog plans", () => {
    const rows = planRows(orgs, details);
    expect(rows.map((row) => row.planId)).toEqual(["plan_developer", "plan_starter"]);
    expect(rows[0]).toMatchObject({
      name: "Developer",
      code: "developer",
      organizationCount: 2,
    });
    expect(rows[0].organizations.map((org) => org.id)).toEqual(["org_a", "org_c"]);
    expect(rows.find((row) => row.planId === "plan_starter")?.organizationCount).toBe(1);
  });

  it("keeps plan identity from list planId when organization detail is missing", () => {
    const rows = planRows(orgs, {});
    const developer = findPlan(rows, "plan_developer");
    expect(developer?.name).toBeNull();
    expect(developer?.organizationCount).toBe(2);
  });

  it("builds one subscription row per organization including organizations with no subscription", () => {
    const rows = subscriptionRows(orgs, details);
    expect(rows).toHaveLength(4);
    expect(rows[0]).toMatchObject({
      organizationId: "org_a",
      planName: "Developer",
      status: "active",
      provider: "manual",
    });
    expect(rows[3]).toMatchObject({ organizationId: "org_d", status: "none", planId: "" });
  });

  it("filters subscriptions by organization, status, and plan without extra API fields", () => {
    const rows = subscriptionRows(orgs, details);
    expect(filterSubscriptionRows(rows, "Org A", "all", "all")).toHaveLength(1);
    expect(filterSubscriptionRows(rows, "", "suspended", "all").map((row) => row.organizationId)).toEqual(["org_b"]);
    expect(filterSubscriptionRows(rows, "", "all", "plan_developer").map((row) => row.organizationId)).toEqual([
      "org_a",
      "org_c",
    ]);
    expect(filterSubscriptionRows(rows, "missing", "all", "all")).toEqual([]);
  });

  it("lists only statuses and plans present on loaded rows", () => {
    const rows = subscriptionRows(orgs, details);
    expect(subscriptionStatuses(rows)).toEqual(["active", "none", "suspended"]);
    expect(subscriptionPlans(rows).map((plan) => plan.id)).toEqual(["plan_developer", "plan_starter"]);
  });

  it("filters inferred plans by name or organization", () => {
    const rows = planRows(orgs, details);
    expect(filterPlanRows(rows, "starter")).toHaveLength(1);
    expect(filterPlanRows(rows, "Org A")).toHaveLength(1);
    expect(filterPlanRows(rows, "missing")).toEqual([]);
  });

  it("renders entitlement flags without using limit keys as features", () => {
    const features = entitlementFeatures(details.org_a.entitlements?.flags);
    expect(features.map((row) => row.key)).toEqual(["ai.copilot", "content.publish"]);
    expect(features.find((row) => row.key === "content.publish")).toMatchObject({ label: "Publishing", enabled: true });
  });

  it("shows device and user usage from organization counts and snapshot limits", () => {
    const limits = entitlementLimits(details.org_a.entitlements, 2, 3);
    expect(usageText(3, 10)).toBe("3 / 10");
    expect(limits.find((row) => row.key === "devices.max")).toMatchObject({ used: 3, limit: 10, label: "Displays" });
    expect(limits.find((row) => row.key === "users.max")).toMatchObject({ used: 2, limit: 25 });
    expect(limits.find((row) => row.key === "content.publish")).toBeUndefined();
  });
});
