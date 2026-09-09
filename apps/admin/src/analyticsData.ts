export type AnalyticsKind = "snapshot" | "historical";

export type AnalyticsAvailability = "available" | "derivable" | "not_available" | "future";

export type AnalyticsTopic = {
  id: string;
  topic: string;
  kind: AnalyticsKind;
  availability: AnalyticsAvailability;
  evidence: string;
  inspectIn: string;
  chart: boolean;
};

export type OperationalSurface = {
  id: string;
  label: string;
  summary: string;
};

export const ANALYTICS_TOPICS: AnalyticsTopic[] = [
  {
    id: "org-snapshot",
    topic: "Organization current state",
    kind: "snapshot",
    availability: "available",
    evidence: "GET /v1/admin/organizations returns each organization and its current subscription row.",
    inspectIn: "Dashboard, Organizations",
    chart: false,
  },
  {
    id: "subscription-distribution",
    topic: "Subscription status distribution",
    kind: "snapshot",
    availability: "available",
    evidence: "Organization list includes subscription.status. Dashboard already counts those current values.",
    inspectIn: "Dashboard, Subscriptions",
    chart: false,
  },
  {
    id: "publishing-by-org",
    topic: "Publishing activity by organization",
    kind: "snapshot",
    availability: "available",
    evidence: "GET /v1/admin/organizations/:id/publishing-jobs returns the latest 100 jobs per organization.",
    inspectIn: "Monitoring, Display Content",
    chart: false,
  },
  {
    id: "orgs-publishing",
    topic: "Organizations publishing content",
    kind: "snapshot",
    availability: "available",
    evidence: "Jobs include organization scope, content ID, version ID, status, and createdAt.",
    inspectIn: "Display Content, Monitoring",
    chart: false,
  },
  {
    id: "job-status-distribution",
    topic: "Job success/failure distribution",
    kind: "snapshot",
    availability: "available",
    evidence: "Job records include status. Monitoring already counts completed versus other statuses.",
    inspectIn: "Monitoring",
    chart: false,
  },
  {
    id: "delivery-status-distribution",
    topic: "Delivery acknowledged/pending distribution",
    kind: "snapshot",
    availability: "available",
    evidence: "GET /v1/admin/organizations/:id/deliveries returns status only (latest 100 per organization).",
    inspectIn: "Monitoring, Displays",
    chart: false,
  },
  {
    id: "recent-audit",
    topic: "Recent audit activity",
    kind: "snapshot",
    availability: "available",
    evidence: "GET /v1/admin/organizations/:id/audit-logs returns the latest 100 events with createdAt.",
    inspectIn: "Dashboard, Organization detail",
    chart: false,
  },
  {
    id: "jobs-over-time",
    topic: "Publishing jobs over time",
    kind: "historical",
    availability: "derivable",
    evidence:
      "Jobs include createdAt, but Admin returns at most 100 per organization. That is a truncated recent list, not a time-series store.",
    inspectIn: "Monitoring (job counts, not trends)",
    chart: false,
  },
  {
    id: "audit-over-time",
    topic: "Audit activity over time",
    kind: "historical",
    availability: "derivable",
    evidence:
      "Audit rows include createdAt, capped at 100 per organization. Dashboard already lists the most recent events.",
    inspectIn: "Dashboard (recent activity table)",
    chart: false,
  },
  {
    id: "deliveries-over-time",
    topic: "Delivery status over time",
    kind: "historical",
    availability: "not_available",
    evidence: "device_deliveries has no createdAt column. The Admin delivery payload has no timestamp.",
    inspectIn: "Not available",
    chart: false,
  },
  {
    id: "org-activity-trend",
    topic: "Organization activity trends",
    kind: "historical",
    availability: "not_available",
    evidence: "There is no usage table, no daily rollup, and no platform-wide activity query.",
    inspectIn: "Not available",
    chart: false,
  },
  {
    id: "analytics-overview-api",
    topic: "Analytics overview API",
    kind: "historical",
    availability: "future",
    evidence: "Target docs mention /v1/analytics/overview. The current API does not implement it.",
    inspectIn: "Not available",
    chart: false,
  },
  {
    id: "player-impressions",
    topic: "Player impressions and content views",
    kind: "historical",
    availability: "future",
    evidence: "No impression, playback, or viewer metrics exist on Admin APIs.",
    inspectIn: "Not available",
    chart: false,
  },
  {
    id: "usage-over-time",
    topic: "Usage versus plan over time",
    kind: "historical",
    availability: "future",
    evidence: "Entitlement remaining is a current snapshot on organization detail. There is no historical usage ledger.",
    inspectIn: "Subscriptions (current limits only)",
    chart: false,
  },
];

export const OPERATIONAL_SURFACES: OperationalSurface[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    summary: "Current organization, membership, display, and subscription snapshot, plus recent audit events.",
  },
  {
    id: "organizations",
    label: "Organizations",
    summary: "Organization records, subscription state, and per-organization jobs, deliveries, and audit.",
  },
  {
    id: "devices",
    label: "Displays",
    summary: "Registered ticker counts and delivery records known to Admin APIs.",
  },
  {
    id: "monitoring",
    label: "Monitoring",
    summary: "Current publishing job and delivery status counts. Not a live heartbeat or historical trend.",
  },
  {
    id: "display-content",
    label: "Display Content",
    summary: "Published versions inferred from Admin publishing jobs and deliveries.",
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    summary: "Current subscription status, plan, period, and provider on organization records.",
  },
];

export const LIVE_ANALYTICS_SECTIONS = [
  "dashboard",
  "organizations",
  "devices",
  "monitoring",
  "display-content",
  "subscriptions",
] as const;

export const ANALYTICS_ACTIVITY_LIMIT = 8;

export const HISTORICAL_BOUNDARIES: Array<{
  id: string;
  topic: string;
  availability: Extract<AnalyticsAvailability, "not_available" | "future">;
  evidence: string;
}> = [
  {
    id: "usage",
    topic: "Historical usage",
    availability: "not_available",
    evidence: "There is no usage table or daily rollup on Admin APIs.",
  },
  {
    id: "telemetry",
    topic: "Display telemetry",
    availability: "not_available",
    evidence: "Live display heartbeat and telemetry history are not returned to platform Admin.",
  },
  {
    id: "heartbeat",
    topic: "Heartbeat history",
    availability: "not_available",
    evidence: "Delivery acked status is a publish-time record, not a heartbeat series.",
  },
  {
    id: "impressions",
    topic: "Impressions / playback analytics",
    availability: "not_available",
    evidence: "No impression, playback, or viewer metrics exist on Admin APIs.",
  },
  {
    id: "delivery-trends",
    topic: "Historical delivery trends",
    availability: "not_available",
    evidence: "Delivery records have no timestamp and are capped at 100 per organization.",
  },
];

export type StatusCount = {
  status: string;
  count: number;
};

export function countByStatus(items: Array<{ status?: string }>): StatusCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const status = (item.status ?? "").trim().toLowerCase() || "unknown";
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status));
}

export function jobSnapshotRows(items: Array<{ status?: string }>) {
  return countByStatus(items);
}

export function deliverySnapshotRows(items: Array<{ status?: string }>) {
  const counted = countByStatus(items);
  const byStatus = new Map(counted.map((row) => [row.status, row.count]));
  const rows: StatusCount[] = [
    { status: "acked", count: byStatus.get("acked") ?? 0 },
    { status: "pending", count: byStatus.get("pending") ?? 0 },
  ];
  for (const row of counted) {
    if (row.status !== "acked" && row.status !== "pending") rows.push(row);
  }
  return rows;
}

export function kindLabel(kind: AnalyticsKind) {
  return kind === "snapshot" ? "Current snapshot" : "Historical trend";
}

export function availabilityLabel(availability: AnalyticsAvailability) {
  if (availability === "available") return "Available";
  if (availability === "derivable") return "Derivable";
  if (availability === "future") return "Future";
  return "Not available";
}

export function snapshotTopics(topics = ANALYTICS_TOPICS) {
  return topics.filter((topic) => topic.kind === "snapshot");
}

export function historicalTopics(topics = ANALYTICS_TOPICS) {
  return topics.filter((topic) => topic.kind === "historical");
}

export function justifiedCharts(topics = ANALYTICS_TOPICS) {
  return topics.filter((topic) => topic.chart);
}

export function findTopic(id: string, topics = ANALYTICS_TOPICS) {
  return topics.find((topic) => topic.id === id) ?? null;
}

export function operationalSurfaceIds(surfaces = OPERATIONAL_SURFACES) {
  return surfaces.map((surface) => surface.id);
}

export function availabilityTone(availability: AnalyticsAvailability) {
  if (availability === "available") return "info";
  if (availability === "future") return "info";
  return "neutral";
}
