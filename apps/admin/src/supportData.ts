export type SupportAvailability = "available" | "tenant_only" | "derivable" | "not_available" | "future";

export type InvestigationSurface = {
  id: string;
  label: string;
  summary: string;
};

export type SupportTopic = {
  id: string;
  topic: string;
  availability: SupportAvailability;
  evidence: string;
  inspectIn: string;
};

export const LIVE_ADMIN_SECTIONS = [
  "dashboard",
  "organizations",
  "devices",
  "monitoring",
  "display-content",
  "subscriptions",
  "users",
] as const;

export type SupportFlowStep = {
  id: string;
  title: string;
  note: string;
};

export type InvestigationPath = {
  id: string;
  issue: string;
  startHere: string;
  startId: (typeof LIVE_ADMIN_SECTIONS)[number];
  thenInspect: string;
};

export const SUPPORT_FLOW: SupportFlowStep[] = [
  {
    id: "organization",
    title: "Organization",
    note: "Inspect identity, status, and plan on Organizations, then open the record.",
  },
  {
    id: "members",
    title: "Members",
    note: "Memberships and roles are on Users and Organization detail.",
  },
  {
    id: "displays",
    title: "Displays",
    note: "Registered ticker counts and delivery evidence. Live heartbeat is not available.",
  },
  {
    id: "publishing",
    title: "Publishing",
    note: "Published versions and jobs on Display Content, Monitoring, and Organization detail.",
  },
  {
    id: "delivery",
    title: "Deliveries",
    note: "Acked and pending records on Displays, Monitoring, and Organization detail.",
  },
  {
    id: "subscription",
    title: "Subscription",
    note: "Current plan, status, period, and entitlements on Subscriptions.",
  },
  {
    id: "audit",
    title: "Audit",
    note: "Latest 100 organization events on Organization detail and Dashboard. Audit Logs is not a workspace.",
  },
];

export const INVESTIGATION_PATHS: InvestigationPath[] = [
  {
    id: "display-blank",
    issue: "Display not showing content",
    startHere: "Displays",
    startId: "devices",
    thenInspect: "Display Content for the published version, then deliveries on Displays, Monitoring, or Organization detail. Live heartbeat is not available.",
  },
  {
    id: "publish-stuck",
    issue: "Publish appears stuck",
    startHere: "Display Content",
    startId: "display-content",
    thenInspect: "Publishing jobs and deliveries on Monitoring or Organization detail. Admin returns the latest 100 jobs per organization.",
  },
  {
    id: "wrong-content",
    issue: "Wrong content on display",
    startHere: "Display Content",
    startId: "display-content",
    thenInspect: "Published version, jobs, and deliveries. Campaign targeting is tenant-only and is not on Admin APIs.",
  },
  {
    id: "access",
    issue: "Organization access issue",
    startHere: "Organizations",
    startId: "organizations",
    thenInspect: "Members on Users or Organization detail, then organization audit.",
  },
  {
    id: "subscription",
    issue: "Subscription issue",
    startHere: "Subscriptions",
    startId: "subscriptions",
    thenInspect: "Organization record, current plan, period, and entitlements. This is not a Stripe billing ledger.",
  },
  {
    id: "unexpected-change",
    issue: "Unexpected administrative change",
    startHere: "Organizations",
    startId: "organizations",
    thenInspect: "Organization audit (latest 100 events) and Dashboard recent activity.",
  },
];

export const UNAVAILABLE_SUPPORT_CAPABILITIES: SupportTopic[] = [
  {
    id: "tickets",
    topic: "Support tickets",
    availability: "not_available",
    evidence: "No support, ticket, case, or incident table or Admin API exists.",
    inspectIn: "Not available",
  },
  {
    id: "case-assignment",
    topic: "Case assignment",
    availability: "not_available",
    evidence: "There is no case owner, queue, or assignment entity.",
    inspectIn: "Not available",
  },
  {
    id: "agent-workflow",
    topic: "Agent workflow",
    availability: "not_available",
    evidence: "There are no support agent records or work queues.",
    inspectIn: "Not available",
  },
  {
    id: "messages",
    topic: "Customer support conversation history",
    availability: "not_available",
    evidence: "There is no contact, conversation, or support-message entity for Admin.",
    inspectIn: "Not available",
  },
  {
    id: "sla",
    topic: "SLA tracking",
    availability: "future",
    evidence: "Enterprise support SLA is documented as later. There are no agent or SLA records.",
    inspectIn: "Not available",
  },
  {
    id: "incidents",
    topic: "Incident management",
    availability: "not_available",
    evidence: "There is no incident, severity, or timeline entity.",
    inspectIn: "Not available",
  },
];

export const INVESTIGATION_SURFACES: InvestigationSurface[] = [
  {
    id: "organizations",
    label: "Organizations",
    summary: "Customer record, status, plan, members, per-organization audit, publishing jobs, and deliveries.",
  },
  {
    id: "devices",
    label: "Displays",
    summary: "Registered ticker counts and delivery records known to Admin APIs.",
  },
  {
    id: "monitoring",
    label: "Monitoring",
    summary: "Current publishing job and delivery status. Live heartbeat is not available.",
  },
  {
    id: "display-content",
    label: "Display Content",
    summary: "Published versions inferred from Admin publishing jobs and deliveries.",
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    summary: "Current plan, subscription status, provider, period, and evaluated entitlements.",
  },
  {
    id: "users",
    label: "Users",
    summary: "Organization memberships, roles, and membership status.",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    summary: "Platform snapshot plus recent audit events. This is not a support inbox.",
  },
];

export const SUPPORT_TOPICS: SupportTopic[] = [
  {
    id: "org-inspect",
    topic: "Customer organization inspection",
    availability: "available",
    evidence: "GET /v1/admin/organizations and GET /v1/admin/organizations/:id.",
    inspectIn: "Organizations",
  },
  {
    id: "membership-inspect",
    topic: "Customer users and roles",
    availability: "available",
    evidence: "GET /v1/admin/organizations/:id/memberships. Email and name only; no passwords.",
    inspectIn: "Users, Organization detail",
  },
  {
    id: "display-inspect",
    topic: "Display and delivery inspection",
    availability: "available",
    evidence: "Admin organization ticker counts and GET /v1/admin/organizations/:id/deliveries.",
    inspectIn: "Displays, Monitoring",
  },
  {
    id: "publish-inspect",
    topic: "Publishing job inspection",
    availability: "available",
    evidence: "GET /v1/admin/organizations/:id/publishing-jobs returns the latest 100 jobs.",
    inspectIn: "Monitoring, Display Content, Organization detail",
  },
  {
    id: "subscription-inspect",
    topic: "Subscription and entitlement inspection",
    availability: "available",
    evidence: "Organization list and detail include current subscription, plan identity, and evaluated entitlements.",
    inspectIn: "Subscriptions, Organizations",
  },
  {
    id: "audit-inspect",
    topic: "Audit activity for an organization",
    availability: "available",
    evidence:
      "GET /v1/admin/organizations/:id/audit-logs returns the latest 100 events. The Admin Audit Logs nav item is not a workspace yet.",
    inspectIn: "Organization detail, Dashboard",
  },
  {
    id: "pending-deliveries",
    topic: "Pending or acknowledged deliveries",
    availability: "derivable",
    evidence: "Delivery status counts already exist on Monitoring. They are operational records, not support cases.",
    inspectIn: "Monitoring, Displays",
  },
  {
    id: "restricted-orgs",
    topic: "Restricted or attention organizations",
    availability: "derivable",
    evidence: "Dashboard attention uses organization status, subscription status, and entitlement restriction.",
    inspectIn: "Dashboard, Subscriptions",
  },
  {
    id: "tenant-audit",
    topic: "Tenant audit log API",
    availability: "tenant_only",
    evidence: "GET /v1/audit-logs requires an organization session. Admin must use /v1/admin/.../audit-logs.",
    inspectIn: "Not used by Admin",
  },
  {
    id: "tenant-jobs",
    topic: "Tenant publishing and delivery APIs",
    availability: "tenant_only",
    evidence: "GET /v1/publishing-jobs and GET /v1/deliveries are organization-scoped tenant routes.",
    inspectIn: "Not used by Admin",
  },
  {
    id: "tenant-ai-help",
    topic: "In-app AI guide",
    availability: "tenant_only",
    evidence: "POST /v1/ai/chat is a tenant navigation/copilot helper, not a support ticket channel.",
    inspectIn: "Not used by Admin",
  },
  {
    id: "tickets",
    topic: "Support tickets / cases / incidents",
    availability: "not_available",
    evidence: "No support, ticket, case, or incident table or Admin API exists.",
    inspectIn: "Not available",
  },
  {
    id: "messages",
    topic: "Customer support messages",
    availability: "not_available",
    evidence: "There is no contact, conversation, or support-message entity for Admin.",
    inspectIn: "Not available",
  },
  {
    id: "contact-metadata",
    topic: "Support contact metadata",
    availability: "not_available",
    evidence: "Organizations store name, slug, status, and timezone. There is no support email or phone field on Admin APIs.",
    inspectIn: "Not available",
  },
  {
    id: "notifications-api",
    topic: "Notifications",
    availability: "future",
    evidence: "Target docs mention /v1/notifications. The current API does not implement it. Tenant and Admin nav items are unavailable.",
    inspectIn: "Not available",
  },
  {
    id: "view-as-tenant",
    topic: "View as tenant / impersonation",
    availability: "future",
    evidence: "Product docs describe time-boxed tenant context. No Admin impersonation API exists.",
    inspectIn: "Not available",
  },
  {
    id: "sla",
    topic: "SLA, agents, and response times",
    availability: "future",
    evidence: "Enterprise support SLA is documented as later. There are no agent or SLA records.",
    inspectIn: "Not available",
  },
];

export function availabilityLabel(availability: SupportAvailability) {
  if (availability === "available") return "Available";
  if (availability === "tenant_only") return "Tenant-only";
  if (availability === "derivable") return "Derivable";
  if (availability === "future") return "Future";
  return "Not available";
}

export function availabilityTone(availability: SupportAvailability) {
  if (availability === "available") return "info";
  if (availability === "tenant_only") return "info";
  if (availability === "future") return "info";
  return "neutral";
}

export function findTopic(id: string, topics = SUPPORT_TOPICS) {
  return topics.find((topic) => topic.id === id) ?? null;
}

export function ticketLikeTopics(topics = SUPPORT_TOPICS) {
  return topics.filter((topic) => ["tickets", "messages", "sla", "contact-metadata"].includes(topic.id));
}

export function investigationSurfaceIds(surfaces = INVESTIGATION_SURFACES) {
  return surfaces.map((surface) => surface.id);
}

export function supportFlowIds(steps = SUPPORT_FLOW) {
  return steps.map((step) => step.id);
}

export function investigationPathStartIds(paths = INVESTIGATION_PATHS) {
  return paths.map((path) => path.startId);
}
