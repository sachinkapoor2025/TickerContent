export const SUBSCRIPTION_LOADING_MESSAGE = "Loading subscription…";
export const SUBSCRIPTION_ERROR_MESSAGE = "Unable to load your subscription.";
export const SUBSCRIPTION_PAGE_DESCRIPTION = "Plan access and limits for this workspace.";
export const SUBSCRIPTION_SIMULATION_NOTE =
  "These buttons change the local MVP subscription status. They are not a payment.";
export const SUBSCRIPTION_SIMULATE_ERROR = "Unable to simulate this status.";
export { canSimulateSubscription } from "./customerAccess";

export const SUBSCRIPTION_NOT_AVAILABLE = "Not available";

export const SIMULATED_STATUSES = ["active", "past_due", "expired", "cancelled", "suspended"] as const;

export type SubscriptionRecord = {
  id?: string;
  organizationId?: string | null;
  planId?: string | null;
  status?: string | null;
  currentPeriodEnd?: string | Date | number | null;
  graceEndsAt?: string | Date | number | null;
  provider?: string | null;
};

export type EntitlementSnapshotRecord = {
  status?: string | null;
  restricted?: boolean | null;
  reason?: string | null;
  flags?: Record<string, boolean> | null;
  limits?: Record<string, number | null> | null;
  remaining?: {
    users?: number | null;
    devices?: number | null;
    storageBytes?: number | null;
  } | null;
};

export type SubscriptionResponse = {
  subscription?: SubscriptionRecord | null;
  entitlements?: EntitlementSnapshotRecord | null;
  provider?: string | null;
  note?: string | null;
};

export type SubscriptionLimitRow = {
  id: string;
  label: string;
  value: string;
};

export type SubscriptionView = {
  statusLabel: string;
  restrictedLabel: string;
  periodLabel: string;
  providerLabel: string;
  note: string;
  limits: SubscriptionLimitRow[];
};

export type SubscriptionPageState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; view: SubscriptionView };

export function formatSubscriptionPeriod(value: unknown) {
  if (value == null || value === "") return SUBSCRIPTION_NOT_AVAILABLE;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return SUBSCRIPTION_NOT_AVAILABLE;
  return date.toLocaleDateString();
}

export function formatRemainingCount(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return SUBSCRIPTION_NOT_AVAILABLE;
  return String(value);
}

export function formatStorageRemaining(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return SUBSCRIPTION_NOT_AVAILABLE;
  if (value < 1024) return `${Math.round(value)} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function subscriptionStatusLabel(status: unknown) {
  if (typeof status !== "string" || !status.trim()) return SUBSCRIPTION_NOT_AVAILABLE;
  return status.trim().replaceAll("_", " ");
}

export function subscriptionView(data: SubscriptionResponse): SubscriptionView {
  const entitlements = data.entitlements ?? {};
  const subscription = data.subscription ?? {};
  const remaining = entitlements.remaining ?? {};
  return {
    statusLabel: subscriptionStatusLabel(entitlements.status ?? subscription.status),
    restrictedLabel: entitlements.restricted ? "Yes" : "No",
    periodLabel: formatSubscriptionPeriod(subscription.currentPeriodEnd),
    providerLabel: typeof data.provider === "string" && data.provider.trim() ? data.provider.trim() : SUBSCRIPTION_NOT_AVAILABLE,
    note:
      typeof data.note === "string" && data.note.trim()
        ? data.note.trim()
        : "Stripe Billing will be connected later. Access is still enforced from subscription status.",
    limits: [
      { id: "users", label: "Users remaining", value: formatRemainingCount(remaining.users) },
      { id: "displays", label: "Displays remaining", value: formatRemainingCount(remaining.devices) },
      { id: "storage", label: "Storage remaining", value: formatStorageRemaining(remaining.storageBytes) },
    ],
  };
}

export function subscriptionPageState(input: {
  loading: boolean;
  error: string | null;
  data: SubscriptionResponse | null;
}): SubscriptionPageState {
  if (input.loading) return { kind: "loading", message: SUBSCRIPTION_LOADING_MESSAGE };
  const error = input.error?.trim();
  if (error || !input.data) return { kind: "error", message: error || SUBSCRIPTION_ERROR_MESSAGE };
  return { kind: "ready", view: subscriptionView(input.data) };
}
