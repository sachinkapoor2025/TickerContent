import type { AdminOrgListItem } from "./dashboardData";

export type AdminMembershipItem = {
  id: string;
  userId: string;
  email?: string | null;
  name?: string | null;
  roleKey: string;
  status: string;
};

export type AccessRow = AdminMembershipItem & {
  organizationId: string;
  organizationName: string;
  organizationStatus: string;
};

export function membershipRows(
  orgs: AdminOrgListItem[],
  membershipsByOrg: Record<string, AdminMembershipItem[]> | null,
): AccessRow[] {
  if (!membershipsByOrg) return [];
  const rows: AccessRow[] = [];
  for (const org of orgs) {
    for (const member of membershipsByOrg[org.id] ?? []) {
      rows.push({
        ...member,
        organizationId: org.id,
        organizationName: org.name,
        organizationStatus: org.status,
      });
    }
  }
  return rows;
}

export function filterMemberships(rows: AccessRow[], query: string, role: string, status: string) {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (role && role !== "all" && row.roleKey !== role) return false;
    if (status && status !== "all" && row.status !== status) return false;
    if (!needle) return true;
    return [row.name, row.email, row.userId, row.organizationName, row.organizationId, row.roleKey]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle));
  });
}

export function membershipRoles(rows: AccessRow[]) {
  return [...new Set(rows.map((row) => row.roleKey).filter(Boolean))].sort();
}

export function membershipStatuses(rows: AccessRow[]) {
  return [...new Set(rows.map((row) => row.status).filter(Boolean))].sort();
}
