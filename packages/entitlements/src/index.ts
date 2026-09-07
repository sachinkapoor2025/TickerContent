export const ENTITLEMENT_KEYS = [
  "users.max",
  "devices.max",
  "storage.bytes",
  "templates.org.max",
  "ai.tokens.monthly",
  "ai.copilot",
  "packs.festivals",
  "packs.alerts",
  "data.market",
  "scheduling.advanced",
  "analytics.advanced",
  "api.public",
  "content.publish",
  "billing.manage",
] as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

export type SubscriptionStatus =
  | "incomplete"
  | "trialing"
  | "active"
  | "past_due"
  | "grace"
  | "expired"
  | "cancelled"
  | "suspended";

export type PlanFeature = {
  enabled: boolean;
  limit?: number | null;
};

export type EntitlementOverride = {
  key: EntitlementKey;
  enabled?: boolean;
  limit?: number | null;
  expiresAt?: Date | null;
};

export type EvaluateInput = {
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  now: Date;
  graceEndsAt?: Date | null;
  plan: Partial<Record<EntitlementKey, PlanFeature>>;
  overrides?: EntitlementOverride[];
  usage?: {
    users?: number;
    devices?: number;
    storageBytes?: number;
  };
};

export type EntitlementSnapshot = {
  status: SubscriptionStatus;
  restricted: boolean;
  flags: Record<EntitlementKey, boolean>;
  limits: Partial<Record<EntitlementKey, number | null>>;
  remaining: {
    users: number | null;
    devices: number | null;
    storageBytes: number | null;
  };
  reason: string | null;
};

const ALWAYS_ON_WHEN_RESTRICTED: EntitlementKey[] = ["billing.manage"];

function isRestricted(input: EvaluateInput): { restricted: boolean; reason: string | null; status: SubscriptionStatus } {
  const { status, now, currentPeriodEnd, graceEndsAt } = input;

  if (status === "suspended") {
    return { restricted: true, reason: "organization_suspended", status };
  }
  if (status === "expired") {
    return { restricted: true, reason: "subscription_expired", status };
  }
  if (status === "incomplete") {
    return { restricted: true, reason: "subscription_incomplete", status };
  }
  if (status === "cancelled") {
    if (currentPeriodEnd && now < currentPeriodEnd) {
      return { restricted: false, reason: null, status };
    }
    return { restricted: true, reason: "subscription_cancelled", status: "expired" };
  }
  if (status === "past_due") {
    if (graceEndsAt && now < graceEndsAt) {
      return { restricted: false, reason: "past_due_in_grace", status: "grace" };
    }
    return { restricted: true, reason: "payment_failed", status: "expired" };
  }
  if (status === "grace") {
    if (graceEndsAt && now >= graceEndsAt) {
      return { restricted: true, reason: "grace_elapsed", status: "expired" };
    }
    return { restricted: false, reason: "in_grace", status };
  }
  if (status === "trialing" || status === "active") {
    if (currentPeriodEnd && now >= currentPeriodEnd && status === "trialing") {
      return { restricted: true, reason: "trial_ended", status: "expired" };
    }
    return { restricted: false, reason: null, status };
  }
  return { restricted: true, reason: "unknown_status", status };
}

export function evaluate(input: EvaluateInput): EntitlementSnapshot {
  const gate = isRestricted(input);
  const flags = {} as Record<EntitlementKey, boolean>;
  const limits: Partial<Record<EntitlementKey, number | null>> = {};

  for (const key of ENTITLEMENT_KEYS) {
    const feature = input.plan[key];
    let enabled = feature?.enabled ?? false;
    let limit = feature?.limit ?? null;

    const override = input.overrides?.find(
      (o) => o.key === key && (!o.expiresAt || o.expiresAt > input.now),
    );
    if (override) {
      if (override.enabled !== undefined) enabled = override.enabled;
      if (override.limit !== undefined) limit = override.limit;
    }

    if (gate.restricted && !ALWAYS_ON_WHEN_RESTRICTED.includes(key)) {
      enabled = false;
    }

    flags[key] = enabled;
    limits[key] = limit;
  }

  const usersLimit = limits["users.max"] ?? null;
  const devicesLimit = limits["devices.max"] ?? null;
  const storageLimit = limits["storage.bytes"] ?? null;
  const usage = input.usage ?? {};

  return {
    status: gate.status,
    restricted: gate.restricted,
    flags,
    limits,
    remaining: {
      users: usersLimit == null ? null : Math.max(0, usersLimit - (usage.users ?? 0)),
      devices: devicesLimit == null ? null : Math.max(0, devicesLimit - (usage.devices ?? 0)),
      storageBytes: storageLimit == null ? null : Math.max(0, storageLimit - (usage.storageBytes ?? 0)),
    },
    reason: gate.reason,
  };
}

export function requireFlag(snapshot: EntitlementSnapshot, key: EntitlementKey): void {
  if (!snapshot.flags[key]) {
    const error = new Error(`entitlement_denied:${key}`);
    error.name = "EntitlementDeniedError";
    throw error;
  }
}

export const DEVELOPER_PLAN: Partial<Record<EntitlementKey, PlanFeature>> = {
  "users.max": { enabled: true, limit: 25 },
  "devices.max": { enabled: true, limit: 10 },
  "storage.bytes": { enabled: true, limit: 5 * 1024 * 1024 * 1024 },
  "templates.org.max": { enabled: true, limit: 100 },
  "ai.tokens.monthly": { enabled: false, limit: 0 },
  "ai.copilot": { enabled: false },
  "packs.festivals": { enabled: true },
  "packs.alerts": { enabled: true },
  "data.market": { enabled: false },
  "scheduling.advanced": { enabled: true },
  "analytics.advanced": { enabled: true },
  "api.public": { enabled: false },
  "content.publish": { enabled: true },
  "billing.manage": { enabled: true },
};
