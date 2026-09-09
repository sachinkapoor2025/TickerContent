import type { AdminOrgDetail, AdminOrgListItem } from "./dashboardData";

export type PlanRow = {
  planId: string;
  name: string | null;
  code: string | null;
  organizationCount: number;
  organizations: Array<{ id: string; name: string; subscriptionStatus: string }>;
};

export type SubscriptionRow = {
  organizationId: string;
  organizationName: string;
  organizationStatus: string;
  planId: string;
  planName: string | null;
  planCode: string | null;
  status: string;
  provider: string;
  currentPeriodEnd?: string | Date | null;
  graceEndsAt?: string | Date | null;
};

export type EntitlementFeatureRow = {
  key: string;
  label: string;
  enabled: boolean;
};

export type EntitlementLimitRow = {
  key: string;
  label: string;
  used: number | null;
  limit: number | null;
};

const FEATURE_LABELS: Record<string, string> = {
  "content.publish": "Publishing",
  "scheduling.advanced": "Advanced scheduling",
  "ai.copilot": "AI copilot",
  "packs.festivals": "Festival packs",
  "packs.alerts": "Alert packs",
  "data.market": "Market data",
  "analytics.advanced": "Advanced analytics",
  "api.public": "Public API",
  "billing.manage": "Billing management",
  "users.max": "Users",
  "devices.max": "Displays",
  "storage.bytes": "Storage",
  "templates.org.max": "Organization templates",
  "ai.tokens.monthly": "AI tokens",
};

const LIMIT_KEYS = new Set(["users.max", "devices.max", "storage.bytes", "templates.org.max", "ai.tokens.monthly"]);

export function featureLabel(key: string) {
  return FEATURE_LABELS[key] ?? key;
}

export function planRows(orgs: AdminOrgListItem[], details: Record<string, AdminOrgDetail>): PlanRow[] {
  const byPlan = new Map<string, PlanRow>();
  for (const org of orgs) {
    const planId = org.subscription?.planId;
    if (!planId) continue;
    const detail = details[org.id];
    const existing = byPlan.get(planId);
    const name = detail?.plan?.name ?? existing?.name ?? null;
    const code = detail?.plan?.code ?? existing?.code ?? null;
    const organization = {
      id: org.id,
      name: org.name,
      subscriptionStatus: org.subscription?.status || "none",
    };
    if (existing) {
      existing.name = name;
      existing.code = code;
      existing.organizationCount += 1;
      existing.organizations.push(organization);
    } else {
      byPlan.set(planId, {
        planId,
        name,
        code,
        organizationCount: 1,
        organizations: [organization],
      });
    }
  }
  return [...byPlan.values()].sort((a, b) => (a.name ?? a.planId).localeCompare(b.name ?? b.planId));
}

export function subscriptionRows(orgs: AdminOrgListItem[], details: Record<string, AdminOrgDetail>): SubscriptionRow[] {
  return orgs.map((org) => {
    const detail = details[org.id];
    const sub = detail?.subscription ?? org.subscription;
    return {
      organizationId: org.id,
      organizationName: org.name,
      organizationStatus: org.status,
      planId: sub?.planId ?? "",
      planName: detail?.plan?.name ?? null,
      planCode: detail?.plan?.code ?? null,
      status: sub?.status || "none",
      provider: sub?.provider ?? "",
      currentPeriodEnd: sub?.currentPeriodEnd,
      graceEndsAt: sub?.graceEndsAt,
    };
  });
}

export function filterPlanRows(rows: PlanRow[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    [row.planId, row.name ?? "", row.code ?? "", ...row.organizations.map((org) => org.name)].some((value) =>
      value.toLowerCase().includes(needle),
    ),
  );
}

export function filterSubscriptionRows(
  rows: SubscriptionRow[],
  query: string,
  status: string,
  planId: string,
) {
  const needle = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (status && status !== "all" && row.status !== status) return false;
    if (planId && planId !== "all" && row.planId !== planId) return false;
    if (!needle) return true;
    return [row.organizationName, row.organizationId, row.planId, row.planName ?? "", row.planCode ?? "", row.provider, row.status]
      .some((value) => value.toLowerCase().includes(needle));
  });
}

export function subscriptionStatuses(rows: SubscriptionRow[]) {
  return [...new Set(rows.map((row) => row.status).filter(Boolean))].sort();
}

export function subscriptionPlans(rows: SubscriptionRow[]) {
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!row.planId) continue;
    if (!seen.has(row.planId)) seen.set(row.planId, row.planName || row.planCode || row.planId);
  }
  return [...seen.entries()]
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function findPlan(rows: PlanRow[], planId: string | null) {
  if (!planId) return null;
  return rows.find((row) => row.planId === planId) ?? null;
}

export function findSubscription(rows: SubscriptionRow[], organizationId: string | null) {
  if (!organizationId) return null;
  return rows.find((row) => row.organizationId === organizationId) ?? null;
}

export function entitlementFeatures(flags: Record<string, boolean> | undefined): EntitlementFeatureRow[] {
  if (!flags) return [];
  return Object.entries(flags)
    .filter(([key]) => !LIMIT_KEYS.has(key))
    .map(([key, enabled]) => ({ key, label: featureLabel(key), enabled: Boolean(enabled) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function entitlementLimits(
  entitlements: AdminOrgDetail["entitlements"] | undefined,
  memberCount: number | undefined,
  tickerCount: number | undefined,
): EntitlementLimitRow[] {
  const limits = entitlements?.limits ?? {};
  const rows: EntitlementLimitRow[] = [];
  for (const key of LIMIT_KEYS) {
    const limit = limits[key];
    const numericLimit = typeof limit === "number" ? limit : null;
    let used: number | null = null;
    if (key === "users.max") used = memberCount ?? null;
    if (key === "devices.max") used = tickerCount ?? null;
    if (numericLimit == null && used == null) continue;
    rows.push({
      key,
      label: featureLabel(key),
      used,
      limit: numericLimit,
    });
  }
  return rows.sort((a, b) => a.label.localeCompare(b.label));
}

export function usageText(used: number | null, limit: number | null) {
  if (limit == null && used == null) return "none";
  if (limit == null) return String(used);
  if (used == null) return `— / ${limit}`;
  return `${used} / ${limit}`;
}
