export type SettingsAvailability = "inspectable" | "editable" | "not_available" | "future";

export type SettingsScope = "platform" | "organization" | "user" | "security" | "integrations" | "notifications";

export type RelatedView = {
  id: (typeof LIVE_ADMIN_SECTIONS)[number];
  label: string;
};

export type SettingsTopic = {
  id: string;
  topic: string;
  scope: SettingsScope;
  availability: SettingsAvailability;
  evidence: string;
  inspectIn: string;
};

export type CapabilityRow = {
  id: string;
  area: string;
  capability: string;
  availability: SettingsAvailability;
  location: string;
  startId: (typeof LIVE_ADMIN_SECTIONS)[number] | null;
};

export type OrganizationControl = {
  id: string;
  capability: string;
  inspectable: boolean;
  editable: boolean;
  where: string;
  startId: (typeof LIVE_ADMIN_SECTIONS)[number];
};

export const LIVE_ADMIN_SECTIONS = ["dashboard", "organizations", "subscriptions", "users"] as const;

export const RELATED_VIEWS: RelatedView[] = [
  { id: "organizations", label: "Organizations" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "users", label: "Users" },
  { id: "dashboard", label: "Dashboard" },
];

export const PLATFORM_SCOPE: SettingsTopic[] = [
  {
    id: "platform-config",
    topic: "Platform configuration",
    scope: "platform",
    availability: "not_available",
    evidence: "There is no /v1/admin/settings or system_config endpoint.",
    inspectIn: "Not available",
  },
  {
    id: "org-status",
    topic: "Organization status",
    scope: "organization",
    availability: "editable",
    evidence: "Activate and Suspend use POST /v1/admin/organizations/:id/status on Organizations and Organization detail.",
    inspectIn: "Organizations, Organization detail",
  },
  {
    id: "subscription-state",
    topic: "Organization subscription / plan",
    scope: "organization",
    availability: "inspectable",
    evidence: "Current plan and subscription state are on Subscriptions and Organization detail. Admin has no plan CRUD.",
    inspectIn: "Subscriptions, Organization detail",
  },
  {
    id: "org-timezone",
    topic: "Organization timezone",
    scope: "organization",
    availability: "inspectable",
    evidence: "GET /v1/admin/organizations/:id returns timezone. Admin cannot change it.",
    inspectIn: "Organization detail",
  },
  {
    id: "account-profile",
    topic: "User profile management",
    scope: "user",
    availability: "not_available",
    evidence: "GET /v1/me is session identity only. There is no profile update API.",
    inspectIn: "Not available",
  },
  {
    id: "security",
    topic: "Security settings",
    scope: "security",
    availability: "not_available",
    evidence: "Admin authentication is email and password with a JWT. There is no security settings screen.",
    inspectIn: "Not available",
  },
  {
    id: "email-preferences",
    topic: "Notification preferences",
    scope: "notifications",
    availability: "not_available",
    evidence: "There is no preference table or notification settings form.",
    inspectIn: "Not available",
  },
  {
    id: "integrations",
    topic: "Integrations",
    scope: "integrations",
    availability: "not_available",
    evidence: "Stripe, SES, IoT, and similar services are not Admin-configurable in this MVP.",
    inspectIn: "Not available",
  },
  {
    id: "api-keys",
    topic: "API key management",
    scope: "security",
    availability: "not_available",
    evidence: "There is no API-key Admin endpoint. Secrets must not appear in the UI.",
    inspectIn: "Not available",
  },
];

export const CAPABILITY_MATRIX: CapabilityRow[] = [
  {
    id: "platform-api",
    area: "Platform",
    capability: "Global settings",
    availability: "not_available",
    location: "—",
    startId: null,
  },
  {
    id: "system-config",
    area: "Platform",
    capability: "Feature / configuration catalog",
    availability: "not_available",
    location: "—",
    startId: null,
  },
  {
    id: "org-status",
    area: "Organization",
    capability: "Status",
    availability: "editable",
    location: "Organizations / Organization detail",
    startId: "organizations",
  },
  {
    id: "subscription-state",
    area: "Organization",
    capability: "Plan / subscription",
    availability: "inspectable",
    location: "Subscriptions / Organization detail",
    startId: "subscriptions",
  },
  {
    id: "org-timezone",
    area: "Organization",
    capability: "Timezone",
    availability: "inspectable",
    location: "Organization detail",
    startId: "organizations",
  },
  {
    id: "entitlements-read",
    area: "Organization",
    capability: "Entitlements",
    availability: "inspectable",
    location: "Organization detail / Subscriptions",
    startId: "organizations",
  },
  {
    id: "memberships",
    area: "Organization",
    capability: "Memberships / roles",
    availability: "inspectable",
    location: "Users / Organization detail",
    startId: "users",
  },
  {
    id: "account-profile",
    area: "User",
    capability: "Profile management",
    availability: "not_available",
    location: "—",
    startId: null,
  },
  {
    id: "password-change",
    area: "User",
    capability: "Password change",
    availability: "not_available",
    location: "—",
    startId: null,
  },
  {
    id: "mfa",
    area: "Security",
    capability: "MFA",
    availability: "future",
    location: "—",
    startId: null,
  },
  {
    id: "sso",
    area: "Security",
    capability: "SSO",
    availability: "future",
    location: "—",
    startId: null,
  },
  {
    id: "api-keys",
    area: "Security",
    capability: "API keys",
    availability: "not_available",
    location: "—",
    startId: null,
  },
  {
    id: "integrations",
    area: "Integrations",
    capability: "External integrations",
    availability: "not_available",
    location: "—",
    startId: null,
  },
  {
    id: "email-preferences",
    area: "Notifications",
    capability: "Notification preferences",
    availability: "not_available",
    location: "—",
    startId: null,
  },
];

export const ORGANIZATION_CONTROLS: OrganizationControl[] = [
  {
    id: "org-status",
    capability: "Organization status",
    inspectable: true,
    editable: true,
    where: "Activate and Suspend on Organizations and Organization detail. Not a Settings form.",
    startId: "organizations",
  },
  {
    id: "subscription-state",
    capability: "Plan / subscription",
    inspectable: true,
    editable: false,
    where: "Current snapshot on Subscriptions and Organization detail. Admin cannot change the plan here.",
    startId: "subscriptions",
  },
  {
    id: "org-timezone",
    capability: "Timezone",
    inspectable: true,
    editable: false,
    where: "Shown on Organization detail. Admin cannot PATCH timezone.",
    startId: "organizations",
  },
  {
    id: "entitlements-read",
    capability: "Entitlements",
    inspectable: true,
    editable: false,
    where: "Evaluated snapshot on Organization detail and Subscriptions. POST /v1/admin/organizations/:id/override exists, but the Admin Portal does not expose an override control.",
    startId: "organizations",
  },
  {
    id: "memberships",
    capability: "Memberships / roles",
    inspectable: true,
    editable: false,
    where: "Users and Organization detail list memberships. Admin does not create or edit members from this portal.",
    startId: "users",
  },
];

export const UNAVAILABLE_SETTINGS: SettingsTopic[] = [
  {
    id: "platform-api",
    topic: "Platform settings API",
    scope: "platform",
    availability: "not_available",
    evidence: "There is no /v1/admin/settings or system_config endpoint.",
    inspectIn: "Not available",
  },
  {
    id: "system-config",
    topic: "Global feature / configuration management",
    scope: "platform",
    availability: "not_available",
    evidence: "No system_config, feature-flag, or environment-configuration table is exposed to Admin.",
    inspectIn: "Not available",
  },
  {
    id: "account-profile",
    topic: "Admin profile editor",
    scope: "user",
    availability: "not_available",
    evidence: "GET /v1/me returns id, email, name, and audience for session checks only.",
    inspectIn: "Not available",
  },
  {
    id: "password-change",
    topic: "Password change",
    scope: "user",
    availability: "not_available",
    evidence: "Auth routes are POST /v1/auth/register and POST /v1/auth/login only.",
    inspectIn: "Not available",
  },
  {
    id: "mfa",
    topic: "MFA",
    scope: "security",
    availability: "future",
    evidence: "Architecture mentions Cognito MFA. The MVP uses email/password JWTs.",
    inspectIn: "Not available",
  },
  {
    id: "sso",
    topic: "SSO",
    scope: "security",
    availability: "future",
    evidence: "Enterprise SSO is documented as later. No SSO settings API exists.",
    inspectIn: "Not available",
  },
  {
    id: "api-keys",
    topic: "API keys",
    scope: "security",
    availability: "not_available",
    evidence: "There is no API-key or secret-management Admin endpoint.",
    inspectIn: "Not available",
  },
  {
    id: "integrations",
    topic: "Webhooks and external providers",
    scope: "integrations",
    availability: "not_available",
    evidence: "Stripe, SES, IoT, and webhook configuration are not Admin settings in this MVP.",
    inspectIn: "Not available",
  },
  {
    id: "email-preferences",
    topic: "Notification preferences",
    scope: "notifications",
    availability: "not_available",
    evidence: "Notifications is a capability page. There is no preference form.",
    inspectIn: "Not available",
  },
];

export function availabilityLabel(availability: SettingsAvailability) {
  if (availability === "inspectable") return "Inspectable";
  if (availability === "editable") return "Editable";
  if (availability === "future") return "Future";
  return "Not available";
}

export function availabilityTone(availability: SettingsAvailability) {
  if (availability === "inspectable" || availability === "editable") return "info";
  if (availability === "future") return "info";
  return "neutral";
}

export function accessLabel(value: boolean) {
  return value ? "Yes" : "No";
}

export function findTopic(id: string, topics = [...PLATFORM_SCOPE, ...UNAVAILABLE_SETTINGS]) {
  return topics.find((topic) => topic.id === id) ?? null;
}

export function findMatrixRow(id: string, rows = CAPABILITY_MATRIX) {
  return rows.find((row) => row.id === id) ?? null;
}

export function findControl(id: string, controls = ORGANIZATION_CONTROLS) {
  return controls.find((control) => control.id === id) ?? null;
}

export function relatedViewIds(views = RELATED_VIEWS) {
  return views.map((view) => view.id);
}

export function matrixStartIds(rows = CAPABILITY_MATRIX) {
  return rows.map((row) => row.startId).filter((id): id is (typeof LIVE_ADMIN_SECTIONS)[number] => id != null);
}

export function availablePlatformSettings(topics = PLATFORM_SCOPE) {
  return topics.filter((topic) => topic.scope === "platform" && (topic.availability === "inspectable" || topic.availability === "editable"));
}
