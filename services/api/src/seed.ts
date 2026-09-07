import { createDemoDocument, type CompositionDocument } from "@ticker-cms/composition";
import { DEVELOPER_PLAN } from "@ticker-cms/entitlements";
import { db } from "./db.js";
import { hashPassword, id, slugify } from "./crypto.js";
import {
  animationPacks,
  assets,
  memberships,
  organizations,
  plans,
  subscriptions,
  templates,
  users,
} from "./schema.js";

export function seedCatalog() {
  const existing = db.select().from(plans).all();
  if (existing.length > 0) return;

  const now = new Date();
  const developer = {
    id: "plan_developer",
    name: "Developer",
    code: "developer",
    entitlementsJson: JSON.stringify(DEVELOPER_PLAN),
  };
  const starter = {
    id: "plan_starter",
    name: "Starter",
    code: "starter",
    entitlementsJson: JSON.stringify({
      ...DEVELOPER_PLAN,
      "devices.max": { enabled: true, limit: 2 },
      "scheduling.advanced": { enabled: false },
      "packs.festivals": { enabled: false },
    }),
  };
  db.insert(plans).values([developer, starter]).run();

  const diwali: CompositionDocument = createDemoDocument(
    { width: 993, height: 32, colorMode: "full" },
    "Happy Diwali  •  Gold lights  •  Limited offer",
  );
  db.insert(templates)
    .values([
      {
        id: "tpl_blank",
        organizationId: null,
        title: "Blank ticker",
        visibility: "platform",
        category: "Business",
        documentJson: JSON.stringify(createDemoDocument({ width: 993, height: 32, colorMode: "full" }, "Your message here")),
      },
      {
        id: "tpl_diwali",
        organizationId: null,
        title: "Festival — Diwali",
        visibility: "platform",
        category: "Festivals",
        documentJson: JSON.stringify(diwali),
      },
      {
        id: "tpl_alert",
        organizationId: null,
        title: "Priority alert",
        visibility: "platform",
        category: "Alerts",
        documentJson: JSON.stringify(
          createDemoDocument({ width: 993, height: 32, colorMode: "full" }, "ALERT  •  Please stand by"),
        ),
      },
    ])
    .run();

  db.insert(animationPacks)
    .values([
      {
        id: "pack_festivals",
        slug: "festivals",
        name: "Festivals",
        category: "Festivals",
        entitlementKey: "packs.festivals",
        itemsJson: JSON.stringify([
          { id: "pumpkin", name: "Pumpkin peek", source: "reference:pumpkin.json" },
          { id: "diya", name: "Diya loop", source: "generated" },
        ]),
      },
      {
        id: "pack_alerts",
        slug: "alerts",
        name: "Alerts",
        category: "Alerts",
        entitlementKey: "packs.alerts",
        itemsJson: JSON.stringify([{ id: "flash", name: "Attention flash", source: "generated" }]),
      },
      {
        id: "pack_retail",
        slug: "retail",
        name: "Retail & promotions",
        category: "Retail",
        entitlementKey: "packs.festivals",
        itemsJson: JSON.stringify([{ id: "sale", name: "Sale burst", source: "generated" }]),
      },
    ])
    .run();

  db.insert(assets)
    .values([
      {
        id: "asset_platform_diya",
        organizationId: null,
        kind: "lottie",
        name: "Diya loop",
        status: "ready",
        metaJson: JSON.stringify({ category: "Festivals" }),
      },
    ])
    .run();

  const platformEmail = "admin@tickercms.local";
  const existingAdmin = db.select().from(users).all().find((u) => u.email === platformEmail);
  if (!existingAdmin) {
    const userId = id("usr");
    db.insert(users)
      .values({
        id: userId,
        email: platformEmail,
        passwordHash: hashPassword("Admin@12345"),
        name: "Platform Admin",
        audience: "platform",
        createdAt: now,
      })
      .run();
  }
}

export function seedTenantDemo() {
  const email = "owner@demo.local";
  if (db.select().from(users).all().some((u) => u.email === email)) return;
  const now = new Date();
  const userId = id("usr");
  const orgId = id("org");
  db.insert(users)
    .values({
      id: userId,
      email,
      passwordHash: hashPassword("Demo@12345"),
      name: "Demo Owner",
      audience: "tenant",
      createdAt: now,
    })
    .run();
  db.insert(organizations)
    .values({
      id: orgId,
      slug: slugify("demo-org") + "-" + orgId.slice(-6),
      name: "Demo Venue",
      status: "active",
      timezone: "America/New_York",
      createdAt: now,
    })
    .run();
  db.insert(memberships)
    .values({
      id: id("mem"),
      userId,
      organizationId: orgId,
      roleKey: "organization_owner",
      status: "active",
    })
    .run();
  db.insert(subscriptions)
    .values({
      id: id("sub"),
      organizationId: orgId,
      planId: "plan_developer",
      status: "active",
      currentPeriodEnd: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365),
      graceEndsAt: null,
      provider: "manual",
    })
    .run();
}
