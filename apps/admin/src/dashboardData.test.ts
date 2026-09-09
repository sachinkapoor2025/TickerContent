import { describe, expect, it } from "vitest";
import {
  filterOrganizations,
  mergeRecentActivity,
  organizationStatuses,
  orgNeedsAttention,
  subscriptionOverview,
  sumCounts,
} from "./dashboardData";

describe("admin dashboard aggregations", () => {
  it("counts subscription buckets from real org records", () => {
    const now = Date.parse("2026-09-09T00:00:00Z");
    const counts = subscriptionOverview(
      [
        { id: "a", name: "A", status: "active", subscription: { status: "active", currentPeriodEnd: "2026-09-15T00:00:00Z" } },
        { id: "b", name: "B", status: "active", subscription: { status: "active", currentPeriodEnd: "2026-12-01T00:00:00Z" } },
        { id: "c", name: "C", status: "suspended", subscription: { status: "suspended" } },
        { id: "d", name: "D", status: "active", subscription: { status: "cancelled" } },
        { id: "e", name: "E", status: "active", subscription: null },
      ],
      now,
    );
    expect(counts).toEqual({ active: 2, expiring: 1, suspended: 1, cancelled: 1, other: 0, none: 1 });
  });

  it("flags attention from org status and entitlements without inventing device telemetry", () => {
    const flagged = orgNeedsAttention(
      { id: "a", name: "A", status: "suspended", subscription: { status: "active" } },
      { organization: { id: "a", name: "A", status: "suspended" }, subscription: { status: "active" }, plan: null, entitlements: { restricted: true, reason: "organization_suspended" }, memberCount: 1, tickerCount: 2 },
    );
    expect(flagged.attention).toBe(true);
    expect(flagged.reasons.join(" ")).toContain("suspended");
  });

  it("sums users and devices from loaded organization details", () => {
    expect(
      sumCounts([
        { organization: { id: "a", name: "A", status: "active" }, subscription: null, plan: null, memberCount: 2, tickerCount: 3 },
        undefined,
        { organization: { id: "b", name: "B", status: "active" }, subscription: null, plan: null, memberCount: 1, tickerCount: 0 },
      ]),
    ).toEqual({ users: 3, devices: 3, loaded: 2 });
  });

  it("merges audit rows newest first and keeps organization names", () => {
    const rows = mergeRecentActivity(
      [
        { id: "orgA", name: "Org A", status: "active" },
        { id: "orgB", name: "Org B", status: "active" },
      ],
      {
        orgA: [{ id: "1", organizationId: "orgA", actorUserId: "u1", action: "organization.status", createdAt: "2026-09-01T00:00:00Z" }],
        orgB: [{ id: "2", organizationId: "orgB", actorUserId: "u2", action: "auth.login", createdAt: "2026-09-08T00:00:00Z" }],
      },
      10,
    );
    expect(rows[0]?.action).toBe("auth.login");
    expect(rows[0]?.organizationName).toBe("Org B");
    expect(rows).toHaveLength(2);
  });

  it("filters loaded organizations by name and status without extra API fields", () => {
    const orgs = [
      { id: "org_a", name: "Demo Venue", slug: "demo-venue", status: "active" },
      { id: "org_b", name: "Other Org", slug: "other", status: "suspended" },
    ];
    expect(filterOrganizations(orgs, "demo", "all").map((org) => org.id)).toEqual(["org_a"]);
    expect(filterOrganizations(orgs, "", "suspended").map((org) => org.id)).toEqual(["org_b"]);
    expect(filterOrganizations(orgs, "missing", "all")).toEqual([]);
  });

  it("lists only statuses present on loaded organizations", () => {
    expect(
      organizationStatuses([
        { id: "org_a", name: "A", status: "active" },
        { id: "org_b", name: "B", status: "suspended" },
        { id: "org_c", name: "C", status: "active" },
      ]),
    ).toEqual(["active", "suspended"]);
  });
});
