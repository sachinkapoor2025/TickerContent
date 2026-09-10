import { describe, expect, it } from "vitest";
import { filterMemberships, membershipRoles, membershipRows, membershipStatuses } from "./accessData";

describe("admin access aggregations", () => {
  const orgs = [
    { id: "org_a", name: "Org A", status: "active" },
    { id: "org_b", name: "Org B", status: "suspended" },
  ];

  it("keeps memberships scoped to their organization", () => {
    const rows = membershipRows(orgs, {
      org_a: [
        { id: "mem_1", userId: "usr_1", email: "a@example.com", name: "Ann", roleKey: "organization_owner", status: "active" },
      ],
      org_b: [
        { id: "mem_2", userId: "usr_2", email: "b@example.com", name: "Bob", roleKey: "viewer", status: "active" },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ email: "a@example.com", organizationId: "org_a", organizationName: "Org A" });
    expect(rows[1]).toMatchObject({ email: "b@example.com", organizationId: "org_b" });
  });

  it("does not invent memberships when the membership load failed", () => {
    expect(membershipRows(orgs, null)).toEqual([]);
  });

  it("filters loaded memberships by name, role, and status", () => {
    const rows = membershipRows(orgs, {
      org_a: [
        { id: "mem_1", userId: "usr_1", email: "owner@demo.local", name: "Demo Owner", roleKey: "organization_owner", status: "active" },
        { id: "mem_2", userId: "usr_2", email: "view@demo.local", name: "Viewer", roleKey: "viewer", status: "invited" },
      ],
    });
    expect(filterMemberships(rows, "demo owner", "all", "all").map((row) => row.id)).toEqual(["mem_1"]);
    expect(filterMemberships(rows, "", "viewer", "all").map((row) => row.id)).toEqual(["mem_2"]);
    expect(filterMemberships(rows, "", "all", "invited").map((row) => row.id)).toEqual(["mem_2"]);
    expect(filterMemberships(rows, "missing", "all", "all")).toEqual([]);
  });

  it("lists only roles and statuses present on loaded memberships", () => {
    const rows = membershipRows(orgs, {
      org_a: [{ id: "mem_1", userId: "usr_1", email: "a@example.com", name: "A", roleKey: "viewer", status: "active" }],
      org_b: [{ id: "mem_2", userId: "usr_2", email: "b@example.com", name: "B", roleKey: "organization_owner", status: "active" }],
    });
    expect(membershipRoles(rows)).toEqual(["organization_owner", "viewer"]);
    expect(membershipStatuses(rows)).toEqual(["active"]);
  });
});
