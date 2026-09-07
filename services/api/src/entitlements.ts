import { eq } from "drizzle-orm";
import {
  DEVELOPER_PLAN,
  evaluate,
  type EntitlementKey,
  type EntitlementSnapshot,
  type SubscriptionStatus,
} from "@ticker-cms/entitlements";
import { db } from "./db.js";
import { entitlementOverrides, plans, subscriptions, tickers, memberships } from "./schema.js";

export async function snapshotForOrg(organizationId: string, now = new Date()): Promise<EntitlementSnapshot> {
  const sub = db.select().from(subscriptions).where(eq(subscriptions.organizationId, organizationId)).get();
  if (!sub) {
    return evaluate({
      status: "incomplete",
      currentPeriodEnd: null,
      now,
      plan: {},
    });
  }
  const plan = db.select().from(plans).where(eq(plans.id, sub.planId)).get();
  const planFeatures = plan ? (JSON.parse(plan.entitlementsJson) as typeof DEVELOPER_PLAN) : DEVELOPER_PLAN;
  const overrides = db
    .select()
    .from(entitlementOverrides)
    .where(eq(entitlementOverrides.organizationId, organizationId))
    .all();
  const deviceCount = db.select().from(tickers).where(eq(tickers.organizationId, organizationId)).all().length;
  const userCount = db.select().from(memberships).where(eq(memberships.organizationId, organizationId)).all().length;

  return evaluate({
    status: sub.status as SubscriptionStatus,
    currentPeriodEnd: sub.currentPeriodEnd,
    graceEndsAt: sub.graceEndsAt,
    now,
    plan: planFeatures,
    overrides: overrides.map((o) => ({
      key: o.key as EntitlementKey,
      enabled: o.enabled ?? undefined,
      expiresAt: o.expiresAt,
    })),
    usage: { devices: deviceCount, users: userCount },
  });
}
