export const EXPIRING_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export type AdminOrgListItem = {
  id: string;
  name: string;
  slug?: string;
  status: string;
  timezone?: string;
  createdAt?: string | Date;
  subscription?: {
    status?: string;
    planId?: string;
    currentPeriodEnd?: string | Date | null;
    graceEndsAt?: string | Date | null;
    provider?: string;
  } | null;
};

export type AdminOrgDetail = {
  organization: {
    id: string;
    name: string;
    slug?: string;
    status: string;
    timezone?: string;
    createdAt?: string | Date;
  };
  subscription: {
    status?: string;
    currentPeriodEnd?: string | Date | null;
    graceEndsAt?: string | Date | null;
    planId?: string;
    provider?: string;
  } | null;
  plan: { id?: string; name?: string; code?: string } | null;
  entitlements?: {
    restricted?: boolean;
    status?: string;
    reason?: string | null;
    flags?: Record<string, boolean>;
    limits?: Record<string, number | null | undefined>;
    remaining?: { users?: number | null; devices?: number | null; storageBytes?: number | null };
  };
  memberCount: number;
  tickerCount: number;
};

export type AdminAuditItem = {
  id: string;
  organizationId: string | null;
  actorUserId: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  createdAt?: string | Date;
};

export type SubscriptionOverview = {
  active: number;
  expiring: number;
  suspended: number;
  cancelled: number;
  other: number;
  none: number;
};

function timeMs(value: string | Date | null | undefined): number | null {
  if (value == null || value === "") return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export function subscriptionOverview(orgs: AdminOrgListItem[], now = Date.now()): SubscriptionOverview {
  const counts: SubscriptionOverview = {
    active: 0,
    expiring: 0,
    suspended: 0,
    cancelled: 0,
    other: 0,
    none: 0,
  };
  for (const org of orgs) {
    const status = org.subscription?.status?.toLowerCase() ?? "";
    if (!org.subscription || !status) {
      counts.none += 1;
      continue;
    }
    if (status === "cancelled" || status === "canceled") {
      counts.cancelled += 1;
      continue;
    }
    if (status === "suspended") {
      counts.suspended += 1;
      continue;
    }
    if (status === "active" || status === "trialing" || status === "grace") {
      counts.active += 1;
      const end = timeMs(org.subscription.currentPeriodEnd);
      if (end !== null && end >= now && end - now <= EXPIRING_WINDOW_MS) counts.expiring += 1;
      continue;
    }
    counts.other += 1;
  }
  return counts;
}

export function orgNeedsAttention(org: AdminOrgListItem, detail?: AdminOrgDetail | null): { attention: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (org.status && org.status !== "active") reasons.push(`organization ${org.status}`);
  const sub = (detail?.subscription ?? org.subscription)?.status?.toLowerCase();
  if (sub && ["suspended", "cancelled", "canceled", "expired", "past_due", "incomplete"].includes(sub)) {
    reasons.push(`subscription ${sub}`);
  }
  if (detail?.entitlements?.restricted) {
    reasons.push(detail.entitlements.reason ? `restricted: ${detail.entitlements.reason}` : "entitlements restricted");
  }
  return { attention: reasons.length > 0, reasons };
}

export function sumCounts(details: Array<AdminOrgDetail | undefined>): { users: number; devices: number; loaded: number } {
  let users = 0;
  let devices = 0;
  let loaded = 0;
  for (const detail of details) {
    if (!detail) continue;
    loaded += 1;
    users += detail.memberCount ?? 0;
    devices += detail.tickerCount ?? 0;
  }
  return { users, devices, loaded };
}

export function mergeRecentActivity(
  orgs: AdminOrgListItem[],
  auditsByOrg: Record<string, AdminAuditItem[]>,
  limit = 25,
): Array<AdminAuditItem & { organizationName: string }> {
  const rows: Array<AdminAuditItem & { organizationName: string }> = [];
  for (const org of orgs) {
    const items = auditsByOrg[org.id] ?? [];
    for (const item of items) {
      rows.push({ ...item, organizationName: org.name });
    }
  }
  rows.sort((a, b) => (timeMs(b.createdAt) ?? 0) - (timeMs(a.createdAt) ?? 0));
  return rows.slice(0, limit);
}

export function formatWhen(value: string | Date | null | undefined): string {
  const ms = timeMs(value);
  if (ms == null) return "";
  return new Date(ms).toLocaleString();
}

export function statusClass(status: string) {
  const value = status.toLowerCase();
  if (value === "active" || value === "trialing" || value === "grace" || value === "enabled" || value === "acked" || value === "completed") {
    return "pp-status pp-status--success";
  }
  if (value === "suspended" || value === "past_due" || value === "expiring" || value === "pending") return "pp-status pp-status--warning";
  if (value === "closed" || value === "cancelled" || value === "canceled" || value === "expired" || value === "failed") {
    return "pp-status pp-status--error";
  }
  return "pp-status pp-status--neutral";
}

export function filterOrganizations(orgs: AdminOrgListItem[], query: string, status: string) {
  const needle = query.trim().toLowerCase();
  return orgs.filter((org) => {
    if (status && status !== "all" && org.status !== status) return false;
    if (!needle) return true;
    return [org.name, org.slug, org.id].some((value) => value?.toLowerCase().includes(needle));
  });
}

export function organizationStatuses(orgs: AdminOrgListItem[]) {
  return [...new Set(orgs.map((org) => org.status).filter(Boolean))].sort();
}
