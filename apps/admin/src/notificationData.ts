export type NotificationAvailability = "available" | "tenant_only" | "derivable" | "not_available" | "future";

export type NotificationTopic = {
  id: string;
  topic: string;
  availability: NotificationAvailability;
  evidence: string;
  inspectIn: string;
};

export type OperationalSignal = {
  id: string;
  signal: string;
  currentSource: string;
  startId: (typeof LIVE_ADMIN_SECTIONS)[number];
};

export type RelatedView = {
  id: (typeof LIVE_ADMIN_SECTIONS)[number];
  label: string;
};

export const LIVE_ADMIN_SECTIONS = [
  "dashboard",
  "organizations",
  "devices",
  "monitoring",
  "display-content",
  "subscriptions",
] as const;

export const RELATED_VIEWS: RelatedView[] = [
  { id: "organizations", label: "Organizations" },
  { id: "devices", label: "Displays" },
  { id: "monitoring", label: "Monitoring" },
  { id: "display-content", label: "Display Content" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "dashboard", label: "Dashboard" },
];

export const OPERATIONAL_SIGNALS: OperationalSignal[] = [
  {
    id: "publishing-jobs",
    signal: "Publishing job status",
    currentSource: "Display Content / Monitoring",
    startId: "display-content",
  },
  {
    id: "delivery-status",
    signal: "Delivery status",
    currentSource: "Displays / Monitoring / Display Content",
    startId: "monitoring",
  },
  {
    id: "organization-status",
    signal: "Organization status",
    currentSource: "Organizations",
    startId: "organizations",
  },
  {
    id: "subscription-status",
    signal: "Subscription status",
    currentSource: "Subscriptions",
    startId: "subscriptions",
  },
  {
    id: "audit-activity",
    signal: "Audit activity",
    currentSource: "Organization detail / Dashboard",
    startId: "dashboard",
  },
];

export const NOTIFICATION_CAPABILITIES: NotificationTopic[] = [
  {
    id: "in-app",
    topic: "In-app notifications",
    availability: "not_available",
    evidence: "There is no Admin notification inbox or in-app notification record.",
    inspectIn: "Not available",
  },
  {
    id: "history",
    topic: "Notification history",
    availability: "not_available",
    evidence: "There is no notification history table or list API.",
    inspectIn: "Not available",
  },
  {
    id: "read-state",
    topic: "Unread / read state",
    availability: "not_available",
    evidence: "There is no read flag, unread count, or notification badge API.",
    inspectIn: "Not available",
  },
  {
    id: "preferences",
    topic: "Notification preferences",
    availability: "not_available",
    evidence: "There is no notification preference table or user preference API.",
    inspectIn: "Not available",
  },
  {
    id: "email",
    topic: "Email notification delivery",
    availability: "not_available",
    evidence: "The MVP API does not send notification email.",
    inspectIn: "Not available",
  },
  {
    id: "recipients",
    topic: "Notification recipients",
    availability: "not_available",
    evidence: "There is no recipient list or delivery-target entity for notifications.",
    inspectIn: "Not available",
  },
  {
    id: "templates",
    topic: "Notification templates",
    availability: "not_available",
    evidence: "There is no notification template store. Content templates are unrelated.",
    inspectIn: "Not available",
  },
];

export const UNAVAILABLE_INFRASTRUCTURE: NotificationTopic[] = [
  {
    id: "records",
    topic: "Notification records and APIs",
    availability: "not_available",
    evidence: "No notifications table exists. GET /v1/notifications is not implemented.",
    inspectIn: "Not available",
  },
  {
    id: "queues",
    topic: "Notification queues",
    availability: "not_available",
    evidence: "There is no notification queue, worker, or delivery-status entity.",
    inspectIn: "Not available",
  },
  {
    id: "ses-email",
    topic: "Outbound notification email",
    availability: "future",
    evidence: "Architecture mentions SES for outbound email. The current MVP does not send it.",
    inspectIn: "Not available",
  },
  {
    id: "packs-alerts",
    topic: "Alert packs entitlement",
    availability: "not_available",
    evidence: "packs.alerts is a plan feature flag. It is not a notification inbox, history, or delivery system.",
    inspectIn: "Plans, Subscriptions",
  },
];

export function availabilityLabel(availability: NotificationAvailability) {
  if (availability === "available") return "Available";
  if (availability === "tenant_only") return "Tenant-only";
  if (availability === "derivable") return "Derivable";
  if (availability === "future") return "Future";
  return "Not available";
}

export function availabilityTone(availability: NotificationAvailability) {
  if (availability === "available") return "info";
  if (availability === "tenant_only") return "info";
  if (availability === "future") return "info";
  return "neutral";
}

export function findTopic(id: string, topics = NOTIFICATION_CAPABILITIES) {
  return topics.find((topic) => topic.id === id) ?? null;
}

export function findSignal(id: string, signals = OPERATIONAL_SIGNALS) {
  return signals.find((signal) => signal.id === id) ?? null;
}

export function findInfrastructure(id: string, items = UNAVAILABLE_INFRASTRUCTURE) {
  return items.find((item) => item.id === id) ?? null;
}

export function relatedViewIds(views = RELATED_VIEWS) {
  return views.map((view) => view.id);
}

export function operationalSignalStartIds(signals = OPERATIONAL_SIGNALS) {
  return signals.map((signal) => signal.startId);
}

export function availableNotificationTopics(topics = NOTIFICATION_CAPABILITIES) {
  return topics.filter((topic) => topic.availability === "available");
}
