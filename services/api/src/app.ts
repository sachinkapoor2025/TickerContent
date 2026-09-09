import { Hono } from "hono";
import type { Context, Next } from "hono";
import { cors } from "hono/cors";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { COLOR_MODES, createDemoDocument, type ColorMode, type CompositionDocument } from "@ticker-cms/composition";
import type { EntitlementKey, SubscriptionStatus } from "@ticker-cms/entitlements";
import { db } from "./db.js";
import { hashPassword, id, signToken, slugify, verifyPassword, verifyToken } from "./crypto.js";
import { snapshotForOrg } from "./entitlements.js";
import { classifyAsset, extensionForMime } from "./asset-classify.js";
import { MAX_ASSET_BYTES, assetStorage, writeAssetObject } from "./asset-storage.js";
import {
  aiConversations,
  animationPacks,
  assets,
  auditLogs,
  campaigns,
  contentVersions,
  contents,
  deviceDeliveries,
  deviceGroups,
  entitlementOverrides,
  memberships,
  organizations,
  plans,
  playlists,
  publishingJobs,
  subscriptions,
  templates,
  tickers,
  users,
} from "./schema.js";

export type AppEnv = {
  Variables: {
    userId: string;
    orgId: string;
    audience: "tenant" | "platform";
    email: string;
    roleKey: string;
  };
};

const loginLocks = new Map<string, { count: number; until: number }>();

function audit(input: {
  organizationId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string;
  source?: string;
  payload?: unknown;
}) {
  db.insert(auditLogs)
    .values({
      id: id("aud"),
      organizationId: input.organizationId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      source: input.source ?? "human",
      payloadJson: JSON.stringify(input.payload ?? {}),
      createdAt: new Date(),
    })
    .run();
}

function jsonError(c: Context, status: 400 | 401 | 403 | 404 | 409 | 413 | 429, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

function versionIdFromSnapshot(snapshotJson: string): string | null {
  try {
    const parsed = JSON.parse(snapshotJson) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

const colorModeSchema = z.enum(COLOR_MODES);
const tickerCreateSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
  width: z.number().int().positive().default(993),
  height: z.number().int().positive().default(32),
  colorMode: colorModeSchema.default("full"),
});
const tickerPatchSchema = z.object({
  name: z.string().min(1).optional(),
  location: z.string().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  colorMode: colorModeSchema.optional(),
});

function parseTickerBody<S extends z.ZodTypeAny>(c: Context, schema: S, data: unknown): z.output<S> | Response {
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return jsonError(c, 400, "invalid_body", issue?.message ?? "Invalid request body.");
  }
  return parsed.data;
}

const PERMISSIONS: Record<string, string[]> = {
  organization_owner: ["*"],
  organization_admin: ["tickers.*", "users.read", "users.invite", "content.*", "campaigns.*", "publish"],
  content_manager: ["content.*", "campaigns.*", "publish", "tickers.read"],
  designer: ["content.read", "content.write", "templates.*", "tickers.read"],
  operator: ["tickers.*", "campaigns.emergency", "publish", "content.read"],
  viewer: ["content.read", "tickers.read"],
  super_admin: ["*"],
  platform_admin: ["admin.*"],
};

function can(roleKey: string, permission: string): boolean {
  const list = PERMISSIONS[roleKey] ?? [];
  if (list.includes("*")) return true;
  if (list.includes(permission)) return true;
  const [ns] = permission.split(".");
  return list.includes(`${ns}.*`);
}

export function createApp() {
  const app = new Hono<AppEnv>();
  const origin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
  app.use(
    "*",
    cors({
      origin: [origin, "http://localhost:5174", "http://localhost:5175"],
      allowHeaders: ["Content-Type", "Authorization"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  );

  app.get("/health", (c) => c.json({ ok: true, service: "ticker-cms-api" }));

  const auth = new Hono<AppEnv>();

  auth.post("/register", async (c) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
        organizationName: z.string().min(2),
      })
      .parse(await c.req.json());
    if (db.select().from(users).where(eq(users.email, body.email.toLowerCase())).get()) {
      return jsonError(c, 409, "email_taken", "An account with this email already exists.");
    }
    const now = new Date();
    const userId = id("usr");
    const orgId = id("org");
    db.insert(users)
      .values({
        id: userId,
        email: body.email.toLowerCase(),
        passwordHash: hashPassword(body.password),
        name: body.name,
        audience: "tenant",
        createdAt: now,
      })
      .run();
    db.insert(organizations)
      .values({
        id: orgId,
        slug: `${slugify(body.organizationName)}-${orgId.slice(-6)}`,
        name: body.organizationName,
        status: "active",
        timezone: "UTC",
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
        currentPeriodEnd: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30),
        graceEndsAt: null,
        provider: "manual",
      })
      .run();
    audit({
      organizationId: orgId,
      actorUserId: userId,
      action: "organization.created",
      resourceType: "organization",
      resourceId: orgId,
    });
    const token = await signToken({ sub: userId, orgId, audience: "tenant", email: body.email.toLowerCase() });
    return c.json({ token, user: { id: userId, email: body.email.toLowerCase(), name: body.name }, organizationId: orgId });
  });

  auth.post("/login", async (c) => {
    const body = z.object({ email: z.string().email(), password: z.string() }).parse(await c.req.json());
    const email = body.email.toLowerCase();
    const lock = loginLocks.get(email);
    if (lock && lock.until > Date.now()) {
      return jsonError(c, 429, "locked", "Too many attempts. Try again shortly.");
    }
    const user = db.select().from(users).where(eq(users.email, email)).get();
    if (!user || !verifyPassword(body.password, user.passwordHash)) {
      const next = { count: (lock?.count ?? 0) + 1, until: 0 };
      if (next.count >= 8) next.until = Date.now() + 15 * 60 * 1000;
      loginLocks.set(email, next);
      return jsonError(c, 401, "invalid_credentials", "Email or password is incorrect.");
    }
    loginLocks.delete(email);
    const membership = db.select().from(memberships).where(eq(memberships.userId, user.id)).get();
    const orgId = user.audience === "platform" ? null : membership?.organizationId ?? null;
    const token = await signToken({
      sub: user.id,
      orgId,
      audience: user.audience as "tenant" | "platform",
      email: user.email,
    });
    audit({
      organizationId: orgId,
      actorUserId: user.id,
      action: "auth.login",
      resourceType: "user",
      resourceId: user.id,
    });
    return c.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, audience: user.audience },
      organizationId: orgId,
    });
  });

  app.route("/v1/auth", auth);

  app.use("/v1/*", async (c, next) => {
    if (c.req.path.startsWith("/v1/auth/")) return next();
    const header = c.req.header("authorization");
    if (!header?.startsWith("Bearer ")) return jsonError(c, 401, "unauthorized", "Missing token.");
    try {
      const claims = await verifyToken(header.slice(7));
      const membership = claims.orgId
        ? db
            .select()
            .from(memberships)
            .where(and(eq(memberships.userId, claims.sub), eq(memberships.organizationId, claims.orgId)))
            .get()
        : undefined;
      c.set("userId", claims.sub);
      c.set("orgId", claims.orgId ?? "");
      c.set("audience", claims.audience);
      c.set("email", claims.email);
      c.set("roleKey", membership?.roleKey ?? (claims.audience === "platform" ? "platform_admin" : "viewer"));
      await next();
    } catch {
      return jsonError(c, 401, "unauthorized", "Invalid token.");
    }
  });

  const requireOrg = async (c: Context<AppEnv>, next: Next) => {
    if (c.get("audience") === "platform") {
      return jsonError(c, 403, "forbidden", "Platform administration must use /v1/admin routes.");
    }
    if (!c.get("orgId")) return jsonError(c, 400, "no_organization", "Select an organization.");
    const org = db.select().from(organizations).where(eq(organizations.id, c.get("orgId"))).get();
    if (!org || org.status === "closed") return jsonError(c, 403, "org_unavailable", "Organization unavailable.");
    await next();
  };

  app.get("/v1/me", (c) => {
    const user = db.select().from(users).where(eq(users.id, c.get("userId"))).get();
    const org = c.get("orgId")
      ? db.select().from(organizations).where(eq(organizations.id, c.get("orgId"))).get()
      : null;
    return c.json({
      user: user ? { id: user.id, email: user.email, name: user.name, audience: user.audience } : null,
      organization: org,
      roleKey: c.get("roleKey"),
    });
  });

  app.get("/v1/entitlements/me", async (c) => {
    if (!c.get("orgId")) return c.json({ restricted: false, flags: {}, status: "active" });
    return c.json(await snapshotForOrg(c.get("orgId")));
  });

  app.use("/v1/tickers/*", requireOrg);
  app.use("/v1/tickers", requireOrg);
  app.use("/v1/playback/*", requireOrg);
  app.use("/v1/contents/*", requireOrg);
  app.use("/v1/contents", requireOrg);
  app.use("/v1/campaigns/*", requireOrg);
  app.use("/v1/campaigns", requireOrg);
  app.use("/v1/assets/*", requireOrg);
  app.use("/v1/assets", requireOrg);

  app.get("/v1/dashboard", async (c) => {
    const orgId = c.get("orgId");
    const list = db.select().from(tickers).where(eq(tickers.organizationId, orgId)).all();
    const jobs = db
      .select()
      .from(publishingJobs)
      .where(eq(publishingJobs.organizationId, orgId))
      .orderBy(desc(publishingJobs.createdAt))
      .all()
      .slice(0, 8);
    const ents = await snapshotForOrg(orgId);
    const now = Date.now();
    const online = list.filter((t) => t.lastHeartbeatAt && now - t.lastHeartbeatAt.getTime() < 90_000).length;
    const playing = resolveNowPlaying(orgId, list[0]?.id);
    return c.json({
      totals: {
        tickers: list.length,
        online,
        offline: list.length - online,
        campaigns: db.select().from(campaigns).where(eq(campaigns.organizationId, orgId)).all().length,
      },
      entitlements: ents,
      recentJobs: jobs,
      preview: playing,
      tickers: list.map(serializeTicker),
    });
  });

  app.get("/v1/tickers", (c) => {
    const orgId = c.get("orgId");
    return c.json({ items: db.select().from(tickers).where(eq(tickers.organizationId, orgId)).all().map(serializeTicker) });
  });

  app.post("/v1/tickers", async (c) => {
    if (!can(c.get("roleKey"), "tickers.write") && !can(c.get("roleKey"), "tickers.*")) {
      return jsonError(c, 403, "forbidden", "Not allowed.");
    }
    const body = parseTickerBody(c, tickerCreateSchema, await c.req.json());
    if (body instanceof Response) return body;
    const ents = await snapshotForOrg(c.get("orgId"));
    if ((ents.remaining.devices ?? 0) <= 0 || !ents.flags["devices.max"]) {
      return jsonError(c, 403, "entitlement_exceeded", "Device limit reached or subscription restricted.");
    }
    const row = {
      id: id("tkr"),
      organizationId: c.get("orgId"),
      name: body.name,
      location: body.location ?? null,
      width: body.width,
      height: body.height,
      colorMode: body.colorMode as ColorMode,
      orientation: "landscape" as const,
      status: "active",
      lastHeartbeatAt: null,
      assignedPlaylistId: null,
      tagsJson: "[]",
    };
    db.insert(tickers).values(row).run();
    audit({
      organizationId: c.get("orgId"),
      actorUserId: c.get("userId"),
      action: "ticker.created",
      resourceType: "ticker",
      resourceId: row.id,
    });
    return c.json(serializeTicker(row), 201);
  });

  app.get("/v1/tickers/:id", (c) => {
    const row = scopedTicker(c.get("orgId"), c.req.param("id"));
    if (!row) return jsonError(c, 404, "not_found", "Ticker not found.");
    return c.json({ ...serializeTicker(row), nowPlaying: resolveNowPlaying(c.get("orgId"), row.id) });
  });

  app.get("/v1/playback/tickers/:tickerId", (c) => {
    const row = scopedTicker(c.get("orgId"), c.req.param("tickerId"));
    if (!row) return jsonError(c, 404, "not_found", "Ticker not found.");
    return c.json(serializePlayback(row, resolveNowPlaying(c.get("orgId"), row.id)));
  });

  app.patch("/v1/tickers/:id", async (c) => {
    if (!can(c.get("roleKey"), "tickers.write") && !can(c.get("roleKey"), "tickers.*")) {
      return jsonError(c, 403, "forbidden", "Not allowed.");
    }
    const row = scopedTicker(c.get("orgId"), c.req.param("id"));
    if (!row) return jsonError(c, 404, "not_found", "Ticker not found.");
    const body = parseTickerBody(c, tickerPatchSchema, await c.req.json());
    if (body instanceof Response) return body;
    db.update(tickers)
      .set({
        name: body.name ?? row.name,
        location: body.location ?? row.location,
        width: body.width ?? row.width,
        height: body.height ?? row.height,
        colorMode: (body.colorMode ?? row.colorMode) as ColorMode,
      })
      .where(eq(tickers.id, row.id))
      .run();
    audit({
      organizationId: c.get("orgId"),
      actorUserId: c.get("userId"),
      action: "ticker.updated",
      resourceType: "ticker",
      resourceId: row.id,
    });
    const updated = scopedTicker(c.get("orgId"), row.id);
    return c.json(serializeTicker(updated!));
  });

  app.post("/v1/tickers/:id/heartbeat", (c) => {
    const row = scopedTicker(c.get("orgId"), c.req.param("id"));
    if (!row) return jsonError(c, 404, "not_found", "Ticker not found.");
    db.update(tickers).set({ lastHeartbeatAt: new Date() }).where(eq(tickers.id, row.id)).run();
    return c.json({ ok: true });
  });

  app.get("/v1/device-groups", (c) => {
    return c.json({
      items: db.select().from(deviceGroups).where(eq(deviceGroups.organizationId, c.get("orgId"))).all(),
    });
  });

  app.post("/v1/device-groups", async (c) => {
    const body = z.object({ name: z.string(), tickerIds: z.array(z.string()).default([]) }).parse(await c.req.json());
    const row = {
      id: id("grp"),
      organizationId: c.get("orgId"),
      name: body.name,
      tickerIdsJson: JSON.stringify(body.tickerIds),
    };
    db.insert(deviceGroups).values(row).run();
    return c.json(row, 201);
  });

  app.get("/v1/contents", (c) => {
    const items = db.select().from(contents).where(eq(contents.organizationId, c.get("orgId"))).all();
    return c.json({ items });
  });

  app.post("/v1/contents", async (c) => {
    if (!can(c.get("roleKey"), "content.write") && !can(c.get("roleKey"), "content.*")) {
      return jsonError(c, 403, "forbidden", "Not allowed.");
    }
    const body = z
      .object({
        title: z.string().min(1),
        document: z.unknown().optional(),
        templateId: z.string().optional(),
      })
      .parse(await c.req.json());
    let document = body.document as CompositionDocument | undefined;
    if (body.templateId) {
      const tpl = db.select().from(templates).where(eq(templates.id, body.templateId)).get();
      if (tpl) document = JSON.parse(tpl.documentJson) as CompositionDocument;
    }
    if (!document) {
      document = createDemoDocument({ width: 993, height: 32, colorMode: "full" }, body.title);
    }
    const contentId = id("cnt");
    const versionId = id("ver");
    db.insert(contents)
      .values({
        id: contentId,
        organizationId: c.get("orgId"),
        title: body.title,
        status: "draft",
        headDraftVersionId: versionId,
        publishedVersionId: null,
      })
      .run();
    db.insert(contentVersions)
      .values({
        id: versionId,
        contentId,
        organizationId: c.get("orgId"),
        documentJson: JSON.stringify(document),
        createdBy: c.get("userId"),
        createdAt: new Date(),
        parentVersionId: null,
      })
      .run();
    audit({
      organizationId: c.get("orgId"),
      actorUserId: c.get("userId"),
      action: "content.created",
      resourceType: "content",
      resourceId: contentId,
    });
    return c.json({ id: contentId, versionId, title: body.title, status: "draft", document }, 201);
  });

  app.get("/v1/contents/:id", (c) => {
    const item = scopedContent(c.get("orgId"), c.req.param("id"));
    if (!item) return jsonError(c, 404, "not_found", "Content not found.");
    const versions = db
      .select()
      .from(contentVersions)
      .where(and(eq(contentVersions.contentId, item.id), eq(contentVersions.organizationId, c.get("orgId"))))
      .all();
    const draft = versions.find((v) => v.id === item.headDraftVersionId);
    return c.json({
      ...item,
      document: draft ? JSON.parse(draft.documentJson) : null,
      versions: versions.map((v) => ({ id: v.id, createdAt: v.createdAt, createdBy: v.createdBy })),
    });
  });

  app.patch("/v1/contents/:id", async (c) => {
    if (!can(c.get("roleKey"), "content.write") && !can(c.get("roleKey"), "content.*")) {
      return jsonError(c, 403, "forbidden", "Not allowed.");
    }
    const item = scopedContent(c.get("orgId"), c.req.param("id"));
    if (!item) return jsonError(c, 404, "not_found", "Content not found.");
    const body = z
      .object({ title: z.string().optional(), document: z.unknown() })
      .parse(await c.req.json());
    const versionId = id("ver");
    db.insert(contentVersions)
      .values({
        id: versionId,
        contentId: item.id,
        organizationId: c.get("orgId"),
        documentJson: JSON.stringify(body.document),
        createdBy: c.get("userId"),
        createdAt: new Date(),
        parentVersionId: item.headDraftVersionId,
      })
      .run();
    db.update(contents)
      .set({
        headDraftVersionId: versionId,
        title: body.title ?? item.title,
        status: "draft",
      })
      .where(eq(contents.id, item.id))
      .run();
    return c.json({ id: item.id, versionId, status: "draft" });
  });

  app.post("/v1/contents/:id/publish", async (c) => {
    if (!can(c.get("roleKey"), "publish")) {
      return jsonError(c, 403, "forbidden", "Not allowed.");
    }
    const ents = await snapshotForOrg(c.get("orgId"));
    if (!ents.flags["content.publish"]) {
      return jsonError(c, 403, "subscription_inactive", "Publishing is blocked until the subscription is active.");
    }
    const item = scopedContent(c.get("orgId"), c.req.param("id"));
    if (!item?.headDraftVersionId) return jsonError(c, 404, "not_found", "Content not found.");
    const draft = db.select().from(contentVersions).where(eq(contentVersions.id, item.headDraftVersionId)).get();
    if (!draft) return jsonError(c, 404, "not_found", "Draft missing.");
    let tickerIds: string[] = [];
    try {
      const raw = await c.req.json();
      const parsed = z.object({ tickerIds: z.array(z.string()).optional() }).safeParse(raw ?? {});
      if (!parsed.success) {
        return jsonError(c, 400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid request body.");
      }
      tickerIds = parsed.data.tickerIds ?? [];
    } catch {
      tickerIds = [];
    }
    const targets = orgTickersOrError(c.get("orgId"), tickerIds);
    if ("error" in targets) return jsonError(c, 400, "invalid_ticker", targets.error);
    db.update(contents)
      .set({ publishedVersionId: draft.id, status: "published" })
      .where(eq(contents.id, item.id))
      .run();
    const jobId = id("job");
    const snapshot = {
      version: draft.id,
      contentId: item.id,
      document: JSON.parse(draft.documentJson),
      compiledAt: new Date().toISOString(),
    };
    db.insert(publishingJobs)
      .values({
        id: jobId,
        organizationId: c.get("orgId"),
        contentId: item.id,
        snapshotJson: JSON.stringify(snapshot),
        trigger: "manual",
        status: "completed",
        createdAt: new Date(),
      })
      .run();
    for (const tickerId of targets.ids) {
      const ticker = scopedTicker(c.get("orgId"), tickerId);
      db.insert(deviceDeliveries)
        .values({
          id: id("dlv"),
          organizationId: c.get("orgId"),
          jobId,
          tickerId,
          status: ticker?.lastHeartbeatAt ? "acked" : "pending",
          snapshotVersion: draft.id,
        })
        .run();
    }
    audit({
      organizationId: c.get("orgId"),
      actorUserId: c.get("userId"),
      action: "content.published",
      resourceType: "content",
      resourceId: item.id,
      source: c.req.header("x-source") === "ai" ? "ai" : "human",
    });
    return c.json({ jobId, snapshot, deliveries: targets.ids.length });
  });

  app.post("/v1/contents/:id/rollback", async (c) => {
    const item = scopedContent(c.get("orgId"), c.req.param("id"));
    if (!item) return jsonError(c, 404, "not_found", "Content not found.");
    const body = z.object({ versionId: z.string() }).parse(await c.req.json());
    const version = db
      .select()
      .from(contentVersions)
      .where(and(eq(contentVersions.id, body.versionId), eq(contentVersions.organizationId, c.get("orgId"))))
      .get();
    if (!version) return jsonError(c, 404, "not_found", "Version not found.");
    const newId = id("ver");
    db.insert(contentVersions)
      .values({
        id: newId,
        contentId: item.id,
        organizationId: c.get("orgId"),
        documentJson: version.documentJson,
        createdBy: c.get("userId"),
        createdAt: new Date(),
        parentVersionId: version.id,
      })
      .run();
    db.update(contents).set({ headDraftVersionId: newId, status: "draft" }).where(eq(contents.id, item.id)).run();
    return c.json({ versionId: newId });
  });

  app.get("/v1/templates", (c) => {
    const orgId = c.get("orgId");
    const items = db
      .select()
      .from(templates)
      .all()
      .filter((t) => t.visibility === "platform" || t.organizationId === orgId)
      .map((t) => ({ ...t, document: JSON.parse(t.documentJson) }));
    return c.json({ items });
  });

  app.get("/v1/animation-packs", async (c) => {
    const ents = await snapshotForOrg(c.get("orgId"));
    const items = db
      .select()
      .from(animationPacks)
      .all()
      .map((p) => ({
        ...p,
        items: JSON.parse(p.itemsJson),
        entitled: Boolean(ents.flags[p.entitlementKey as EntitlementKey]),
      }));
    return c.json({ items });
  });

  app.get("/v1/assets", (c) => {
    if (!can(c.get("roleKey"), "content.read") && !can(c.get("roleKey"), "content.*") && !can(c.get("roleKey"), "assets.read")) {
      return jsonError(c, 403, "forbidden", "Not allowed.");
    }
    const orgId = c.get("orgId");
    const items = db
      .select()
      .from(assets)
      .where(or(eq(assets.organizationId, orgId), isNull(assets.organizationId)))
      .all()
      .map(serializeAsset);
    return c.json({ items });
  });

  app.post("/v1/assets", async (c) => {
    if (!can(c.get("roleKey"), "content.write") && !can(c.get("roleKey"), "content.*") && !can(c.get("roleKey"), "assets.write")) {
      return jsonError(c, 403, "forbidden", "Not allowed.");
    }
    const form = await c.req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return jsonError(c, 400, "invalid_body", "A file is required.");
    }
    const nameField = form.get("name");
    const name = (typeof nameField === "string" && nameField.trim() ? nameField.trim() : file.name) || "asset";
    if (file.size > MAX_ASSET_BYTES) {
      return jsonError(c, 413, "file_too_large", `File exceeds the ${MAX_ASSET_BYTES} byte limit.`);
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > MAX_ASSET_BYTES) {
      return jsonError(c, 413, "file_too_large", `File exceeds the ${MAX_ASSET_BYTES} byte limit.`);
    }
    const classified = classifyAsset(bytes, file.type, file.name);
    if ("error" in classified) {
      return jsonError(c, 400, "invalid_asset", classified.error);
    }
    const assetId = id("ast");
    const storageKey = `${assetId}.${extensionForMime(classified.mimeType)}`;
    const storageContext = { organizationId: c.get("orgId") };
    const now = new Date();
    await writeAssetObject(assetStorage, storageKey, bytes, storageContext, () => {
      db.insert(assets)
        .values({
          id: assetId,
          organizationId: c.get("orgId"),
          kind: classified.kind,
          name,
          status: "ready",
          storageKey,
          mimeType: classified.mimeType,
          sizeBytes: bytes.length,
          createdAt: now,
          metaJson: "{}",
        })
        .run();
    });
    audit({
      organizationId: c.get("orgId"),
      actorUserId: c.get("userId"),
      action: "asset.uploaded",
      resourceType: "asset",
      resourceId: assetId,
    });
    const row = db.select().from(assets).where(eq(assets.id, assetId)).get();
    return c.json(serializeAsset(row!), 201);
  });

  app.get("/v1/assets/:id/content", async (c) => {
    if (!can(c.get("roleKey"), "content.read") && !can(c.get("roleKey"), "content.*") && !can(c.get("roleKey"), "assets.read")) {
      return jsonError(c, 403, "forbidden", "Not allowed.");
    }
    const row = scopedAsset(c.get("orgId"), c.req.param("id"));
    if (!row?.storageKey) return jsonError(c, 404, "not_found", "Asset not found.");
    const bytes = await assetStorage.read(row.storageKey, { organizationId: row.organizationId });
    if (!bytes) return jsonError(c, 404, "not_found", "Asset file is missing.");
    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "content-type": row.mimeType ?? "application/octet-stream",
        "content-length": String(bytes.length),
      },
    });
  });

  app.delete("/v1/assets/:id", async (c) => {
    if (!can(c.get("roleKey"), "content.write") && !can(c.get("roleKey"), "content.*") && !can(c.get("roleKey"), "assets.write")) {
      return jsonError(c, 403, "forbidden", "Not allowed.");
    }
    const row = scopedAsset(c.get("orgId"), c.req.param("id"));
    if (!row || row.organizationId !== c.get("orgId")) {
      return jsonError(c, 404, "not_found", "Asset not found.");
    }
    if (row.storageKey) await assetStorage.delete(row.storageKey, { organizationId: row.organizationId });
    db.delete(assets).where(eq(assets.id, row.id)).run();
    audit({
      organizationId: c.get("orgId"),
      actorUserId: c.get("userId"),
      action: "asset.deleted",
      resourceType: "asset",
      resourceId: row.id,
    });
    return c.json({ ok: true });
  });

  app.get("/v1/campaigns", (c) => {
    const items = db
      .select()
      .from(campaigns)
      .where(eq(campaigns.organizationId, c.get("orgId")))
      .all()
      .map(serializeCampaign);
    return c.json({ items });
  });

  app.post("/v1/campaigns", async (c) => {
    if (!can(c.get("roleKey"), "campaigns.write") && !can(c.get("roleKey"), "campaigns.*")) {
      return jsonError(c, 403, "forbidden", "Not allowed.");
    }
    const ents = await snapshotForOrg(c.get("orgId"));
    if (!ents.flags["scheduling.advanced"] && !ents.flags["content.publish"]) {
      return jsonError(c, 403, "entitlement_denied", "Scheduling is not available on this plan.");
    }
    const body = z
      .object({
        name: z.string().min(1),
        contentId: z.string(),
        startAt: z.string(),
        endAt: z.string(),
        priority: z.number().int().default(100),
        targetTickerIds: z.array(z.string()).default([]),
        status: z.enum(CAMPAIGN_STATUSES).optional(),
        recurrence: z.string().optional(),
      })
      .parse(await c.req.json());
    const content = scopedContent(c.get("orgId"), body.contentId);
    if (!content) {
      return jsonError(c, 400, "invalid_content", "Content must belong to this organization.");
    }
    const dates = campaignDatesOrError(body.startAt, body.endAt);
    if ("error" in dates) return jsonError(c, 400, "invalid_dates", dates.error);
    const targets = orgTickersOrError(c.get("orgId"), body.targetTickerIds);
    if ("error" in targets) return jsonError(c, 400, "invalid_ticker", targets.error);
    const publishedVersionId = content.publishedVersionId ?? null;
    const status = body.status ?? (publishedVersionId && targets.ids.length ? "scheduled" : "draft");
    const playableError = playableCampaignError(status, targets.ids, publishedVersionId);
    if (playableError) return jsonError(c, 400, "campaign_not_playable", playableError);
    const row = {
      id: id("cmp"),
      organizationId: c.get("orgId"),
      name: body.name,
      status,
      priority: body.priority,
      startAt: dates.start,
      endAt: dates.end,
      contentId: body.contentId,
      publishedVersionId: publishedVersionId,
      targetTickerIdsJson: JSON.stringify(targets.ids),
      recurrence: body.recurrence ?? null,
    };
    db.insert(campaigns).values(row).run();
    audit({
      organizationId: c.get("orgId"),
      actorUserId: c.get("userId"),
      action: "campaign.created",
      resourceType: "campaign",
      resourceId: row.id,
    });
    return c.json(serializeCampaign({ ...row, targetTickerIdsJson: row.targetTickerIdsJson }), 201);
  });

  app.patch("/v1/campaigns/:id", async (c) => {
    if (!can(c.get("roleKey"), "campaigns.write") && !can(c.get("roleKey"), "campaigns.*")) {
      return jsonError(c, 403, "forbidden", "Not allowed.");
    }
    const row = db
      .select()
      .from(campaigns)
      .where(and(eq(campaigns.id, c.req.param("id")), eq(campaigns.organizationId, c.get("orgId"))))
      .get();
    if (!row) return jsonError(c, 404, "not_found", "Campaign not found.");
    const body = z
      .object({
        name: z.string().min(1).optional(),
        contentId: z.string().optional(),
        startAt: z.string().optional(),
        endAt: z.string().optional(),
        targetTickerIds: z.array(z.string()).optional(),
        status: z.enum(CAMPAIGN_STATUSES).optional(),
      })
      .parse(await c.req.json());
    const content = scopedContent(c.get("orgId"), body.contentId ?? row.contentId);
    if (!content) {
      return jsonError(c, 400, "invalid_content", "Content must belong to this organization.");
    }
    const dates = campaignDatesOrError(
      body.startAt ?? row.startAt.toISOString(),
      body.endAt ?? row.endAt.toISOString(),
    );
    if ("error" in dates) return jsonError(c, 400, "invalid_dates", dates.error);
    const targets = orgTickersOrError(
      c.get("orgId"),
      body.targetTickerIds ?? parseCampaignTargets(row.targetTickerIdsJson),
    );
    if ("error" in targets) return jsonError(c, 400, "invalid_ticker", targets.error);
    const publishedVersionId = content.publishedVersionId ?? row.publishedVersionId ?? null;
    const status = body.status ?? row.status;
    const playableError = playableCampaignError(status, targets.ids, publishedVersionId);
    if (playableError) return jsonError(c, 400, "campaign_not_playable", playableError);
    db.update(campaigns)
      .set({
        name: body.name ?? row.name,
        contentId: content.id,
        startAt: dates.start,
        endAt: dates.end,
        targetTickerIdsJson: JSON.stringify(targets.ids),
        status,
        publishedVersionId: PLAYABLE_CAMPAIGN_STATUSES.has(status) ? publishedVersionId : row.publishedVersionId,
      })
      .where(eq(campaigns.id, row.id))
      .run();
    const updated = db.select().from(campaigns).where(eq(campaigns.id, row.id)).get();
    return c.json(serializeCampaign(updated!));
  });

  app.get("/v1/playlists", (c) => {
    return c.json({ items: db.select().from(playlists).where(eq(playlists.organizationId, c.get("orgId"))).all() });
  });

  app.get("/v1/publishing-jobs", (c) => {
    return c.json({
      items: db
        .select()
        .from(publishingJobs)
        .where(eq(publishingJobs.organizationId, c.get("orgId")))
        .orderBy(desc(publishingJobs.createdAt))
        .all(),
    });
  });

  app.get("/v1/deliveries", (c) => {
    return c.json({
      items: db.select().from(deviceDeliveries).where(eq(deviceDeliveries.organizationId, c.get("orgId"))).all(),
    });
  });

  app.get("/v1/memberships", (c) => {
    const rows = db.select().from(memberships).where(eq(memberships.organizationId, c.get("orgId"))).all();
    const items = rows.map((m) => {
      const u = db.select().from(users).where(eq(users.id, m.userId)).get();
      return { ...m, email: u?.email, name: u?.name };
    });
    return c.json({ items });
  });

  app.post("/v1/memberships", async (c) => {
    if (!can(c.get("roleKey"), "users.invite") && c.get("roleKey") !== "organization_owner") {
      return jsonError(c, 403, "forbidden", "Not allowed.");
    }
    const ents = await snapshotForOrg(c.get("orgId"));
    if ((ents.remaining.users ?? 0) <= 0) {
      return jsonError(c, 403, "entitlement_exceeded", "User limit reached.");
    }
    const body = z
      .object({
        email: z.string().email(),
        name: z.string(),
        roleKey: z.string().default("viewer"),
        password: z.string().min(8),
      })
      .parse(await c.req.json());
    let user = db.select().from(users).where(eq(users.email, body.email.toLowerCase())).get();
    if (!user) {
      const userId = id("usr");
      db.insert(users)
        .values({
          id: userId,
          email: body.email.toLowerCase(),
          passwordHash: hashPassword(body.password),
          name: body.name,
          audience: "tenant",
          createdAt: new Date(),
        })
        .run();
      user = db.select().from(users).where(eq(users.id, userId)).get();
    }
    db.insert(memberships)
      .values({
        id: id("mem"),
        userId: user!.id,
        organizationId: c.get("orgId"),
        roleKey: body.roleKey,
        status: "active",
      })
      .run();
    audit({
      organizationId: c.get("orgId"),
      actorUserId: c.get("userId"),
      action: "membership.invited",
      resourceType: "membership",
      resourceId: user!.id,
    });
    return c.json({ ok: true }, 201);
  });

  app.get("/v1/audit-logs", (c) => {
    const orgId = c.get("orgId");
    const items = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, orgId))
      .orderBy(desc(auditLogs.createdAt))
      .all()
      .slice(0, 100);
    return c.json({ items });
  });

  app.get("/v1/billing/subscription", async (c) => {
    const sub = db.select().from(subscriptions).where(eq(subscriptions.organizationId, c.get("orgId"))).get();
    const ents = await snapshotForOrg(c.get("orgId"));
    return c.json({
      subscription: sub,
      entitlements: ents,
      provider: "manual",
      note: "Stripe Billing will be connected later. Access is still enforced from subscription status.",
    });
  });

  app.post("/v1/billing/simulate-status", async (c) => {
    if (c.get("roleKey") !== "organization_owner" && c.get("audience") !== "platform") {
      return jsonError(c, 403, "forbidden", "Not allowed.");
    }
    const body = z.object({ status: z.string() }).parse(await c.req.json());
    db.update(subscriptions)
      .set({ status: body.status as SubscriptionStatus })
      .where(eq(subscriptions.organizationId, c.get("orgId")))
      .run();
    audit({
      organizationId: c.get("orgId"),
      actorUserId: c.get("userId"),
      action: "subscription.simulated",
      resourceType: "subscription",
      payload: body,
    });
    return c.json(await snapshotForOrg(c.get("orgId")));
  });

  app.post("/v1/ai/chat", async (c) => {
    const ents = await snapshotForOrg(c.get("orgId"));
    const body = z
      .object({
        channel: z.enum(["guide", "copilot"]).default("guide"),
        message: z.string(),
        route: z.string().optional(),
        confirmToken: z.string().optional(),
      })
      .parse(await c.req.json());
    if (body.channel === "copilot" && !ents.flags["content.publish"] && !ents.flags["ai.copilot"]) {
      // Copilot mutations still require an active org; guide always allowed.
    }
    const result = await handleAi({
      orgId: c.get("orgId"),
      userId: c.get("userId"),
      roleKey: c.get("roleKey"),
      channel: body.channel,
      message: body.message,
      route: body.route,
      confirmToken: body.confirmToken,
      entitlements: ents,
    });
    return c.json(result);
  });

  app.get("/v1/admin/organizations", (c) => {
    if (c.get("audience") !== "platform") return jsonError(c, 403, "forbidden", "Platform only.");
    const items = db
      .select()
      .from(organizations)
      .all()
      .map((org) => {
        const sub = db.select().from(subscriptions).where(eq(subscriptions.organizationId, org.id)).get();
        return { ...org, subscription: sub };
      });
    return c.json({ items });
  });

  app.get("/v1/admin/organizations/:id", async (c) => {
    if (c.get("audience") !== "platform") return jsonError(c, 403, "forbidden", "Platform only.");
    const org = db.select().from(organizations).where(eq(organizations.id, c.req.param("id"))).get();
    if (!org) return jsonError(c, 404, "not_found", "Organization not found.");
    const sub = db.select().from(subscriptions).where(eq(subscriptions.organizationId, org.id)).get();
    const plan = sub ? db.select().from(plans).where(eq(plans.id, sub.planId)).get() : undefined;
    const memberCount = db.select().from(memberships).where(eq(memberships.organizationId, org.id)).all().length;
    const tickerCount = db.select().from(tickers).where(eq(tickers.organizationId, org.id)).all().length;
    const entitlements = await snapshotForOrg(org.id);
    return c.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        timezone: org.timezone,
        createdAt: org.createdAt,
      },
      subscription: sub
        ? {
            status: sub.status,
            planId: sub.planId,
            currentPeriodEnd: sub.currentPeriodEnd,
            graceEndsAt: sub.graceEndsAt,
            provider: sub.provider,
          }
        : null,
      plan: plan ? { id: plan.id, name: plan.name, code: plan.code } : null,
      entitlements,
      memberCount,
      tickerCount,
    });
  });

  app.get("/v1/admin/organizations/:id/memberships", (c) => {
    if (c.get("audience") !== "platform") return jsonError(c, 403, "forbidden", "Platform only.");
    const org = db.select().from(organizations).where(eq(organizations.id, c.req.param("id"))).get();
    if (!org) return jsonError(c, 404, "not_found", "Organization not found.");
    const items = db
      .select()
      .from(memberships)
      .where(eq(memberships.organizationId, org.id))
      .all()
      .map((membership) => {
        const user = db.select().from(users).where(eq(users.id, membership.userId)).get();
        return {
          id: membership.id,
          userId: membership.userId,
          email: user?.email ?? null,
          name: user?.name ?? null,
          roleKey: membership.roleKey,
          status: membership.status,
        };
      });
    return c.json({ items });
  });

  app.get("/v1/admin/organizations/:id/audit-logs", (c) => {
    if (c.get("audience") !== "platform") return jsonError(c, 403, "forbidden", "Platform only.");
    const org = db.select().from(organizations).where(eq(organizations.id, c.req.param("id"))).get();
    if (!org) return jsonError(c, 404, "not_found", "Organization not found.");
    const items = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, org.id))
      .orderBy(desc(auditLogs.createdAt))
      .all()
      .slice(0, 100)
      .map((row) => ({
        id: row.id,
        organizationId: row.organizationId,
        actorUserId: row.actorUserId,
        action: row.action,
        resourceType: row.resourceType,
        resourceId: row.resourceId,
        source: row.source,
        payloadJson: row.payloadJson,
        createdAt: row.createdAt,
      }));
    return c.json({ items });
  });

  app.get("/v1/admin/organizations/:id/publishing-jobs", (c) => {
    if (c.get("audience") !== "platform") return jsonError(c, 403, "forbidden", "Platform only.");
    const org = db.select().from(organizations).where(eq(organizations.id, c.req.param("id"))).get();
    if (!org) return jsonError(c, 404, "not_found", "Organization not found.");
    const items = db
      .select()
      .from(publishingJobs)
      .where(eq(publishingJobs.organizationId, org.id))
      .orderBy(desc(publishingJobs.createdAt))
      .all()
      .slice(0, 100)
      .map((row) => ({
        id: row.id,
        contentId: row.contentId,
        versionId: versionIdFromSnapshot(row.snapshotJson),
        status: row.status,
        trigger: row.trigger,
        createdAt: row.createdAt,
      }));
    return c.json({ items });
  });

  app.get("/v1/admin/organizations/:id/deliveries", (c) => {
    if (c.get("audience") !== "platform") return jsonError(c, 403, "forbidden", "Platform only.");
    const org = db.select().from(organizations).where(eq(organizations.id, c.req.param("id"))).get();
    if (!org) return jsonError(c, 404, "not_found", "Organization not found.");
    const jobCreatedAt = new Map(
      db
        .select()
        .from(publishingJobs)
        .where(eq(publishingJobs.organizationId, org.id))
        .all()
        .map((job) => [job.id, job.createdAt?.getTime?.() ?? 0]),
    );
    const items = db
      .select()
      .from(deviceDeliveries)
      .where(eq(deviceDeliveries.organizationId, org.id))
      .all()
      .sort((a, b) => (jobCreatedAt.get(b.jobId) ?? 0) - (jobCreatedAt.get(a.jobId) ?? 0))
      .slice(0, 100)
      .map((row) => ({
        id: row.id,
        tickerId: row.tickerId,
        jobId: row.jobId,
        snapshotVersion: row.snapshotVersion,
        status: row.status,
      }));
    return c.json({ items });
  });

  app.post("/v1/admin/organizations/:id/status", async (c) => {
    if (c.get("audience") !== "platform") return jsonError(c, 403, "forbidden", "Platform only.");
    const parsed = z.object({ status: z.enum(["active", "suspended", "closed"]) }).safeParse(await c.req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return jsonError(c, 400, "invalid_body", issue?.message ?? "Invalid request body.");
    }
    const orgId = c.req.param("id");
    const org = db.select().from(organizations).where(eq(organizations.id, orgId)).get();
    if (!org) return jsonError(c, 404, "not_found", "Organization not found.");
    db.update(organizations).set({ status: parsed.data.status }).where(eq(organizations.id, org.id)).run();
    audit({
      organizationId: org.id,
      actorUserId: c.get("userId"),
      action: "organization.status",
      resourceType: "organization",
      resourceId: org.id,
      payload: parsed.data,
    });
    return c.json({ ok: true });
  });

  app.post("/v1/admin/organizations/:id/override", async (c) => {
    if (c.get("audience") !== "platform") return jsonError(c, 403, "forbidden", "Platform only.");
    const body = z
      .object({ key: z.string(), enabled: z.boolean(), reason: z.string() })
      .parse(await c.req.json());
    db.insert(entitlementOverrides)
      .values({
        id: id("ovr"),
        organizationId: c.req.param("id"),
        key: body.key,
        enabled: body.enabled,
        reason: body.reason,
        expiresAt: new Date(Date.now() + 7 * 86400000),
      })
      .run();
    audit({
      organizationId: c.req.param("id"),
      actorUserId: c.get("userId"),
      action: "organization.override",
      resourceType: "organization",
      resourceId: c.req.param("id"),
      payload: { key: body.key, enabled: body.enabled, reason: body.reason },
    });
    return c.json({ ok: true });
  });

  return app;
}

function scopedTicker(orgId: string, tickerId: string) {
  return db
    .select()
    .from(tickers)
    .where(and(eq(tickers.id, tickerId), eq(tickers.organizationId, orgId)))
    .get();
}

function scopedContent(orgId: string, contentId: string) {
  return db
    .select()
    .from(contents)
    .where(and(eq(contents.id, contentId), eq(contents.organizationId, orgId)))
    .get();
}

const CAMPAIGN_STATUSES = ["draft", "scheduled", "running", "paused", "cancelled", "ended"] as const;
const PLAYABLE_CAMPAIGN_STATUSES = new Set(["scheduled", "running"]);

function parseCampaignTargets(json: string): string[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function serializeCampaign(row: typeof campaigns.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    priority: row.priority,
    startAt: row.startAt,
    endAt: row.endAt,
    contentId: row.contentId,
    publishedVersionId: row.publishedVersionId,
    targetTickerIds: parseCampaignTargets(row.targetTickerIdsJson),
    recurrence: row.recurrence,
  };
}

function orgTickersOrError(orgId: string, ids: string[]): { ids: string[] } | { error: string } {
  const unique = [...new Set(ids.filter(Boolean))];
  for (const tickerId of unique) {
    if (!scopedTicker(orgId, tickerId)) {
      return { error: "Every target ticker must belong to this organization." };
    }
  }
  return { ids: unique };
}

function campaignDatesOrError(startAt: string, endAt: string): { start: Date; end: Date } | { error: string } {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "Start and end must be valid dates." };
  }
  if (start.getTime() >= end.getTime()) {
    return { error: "Start must be before end." };
  }
  return { start, end };
}

function playableCampaignError(status: string, targetTickerIds: string[], publishedVersionId: string | null): string | null {
  if (!PLAYABLE_CAMPAIGN_STATUSES.has(status)) return null;
  if (targetTickerIds.length < 1) return "At least one ticker is required for a scheduled campaign.";
  if (!publishedVersionId) return "Content must have a published version before the campaign can be scheduled.";
  return null;
}

function scopedAsset(orgId: string, assetId: string) {
  const row = db.select().from(assets).where(eq(assets.id, assetId)).get();
  if (!row) return null;
  if (row.organizationId === null || row.organizationId === orgId) return row;
  return null;
}

function serializeAsset(row: typeof assets.$inferSelect) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    kind: row.kind,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    status: row.status,
    createdAt: row.createdAt,
  };
}

function serializeTicker(row: typeof tickers.$inferSelect) {
  const now = Date.now();
  const online = Boolean(row.lastHeartbeatAt && now - row.lastHeartbeatAt.getTime() < 90_000);
  return { ...row, online, tags: JSON.parse(row.tagsJson) };
}

export function resolveNowPlaying(orgId: string, tickerId?: string) {
  const now = Date.now();
  const activeCampaigns = db
    .select()
    .from(campaigns)
    .where(eq(campaigns.organizationId, orgId))
    .all()
    .filter((cmp) => {
      if (!PLAYABLE_CAMPAIGN_STATUSES.has(cmp.status)) return false;
      if (cmp.startAt.getTime() > now || cmp.endAt.getTime() < now) return false;
      const targets = parseCampaignTargets(cmp.targetTickerIdsJson);
      if (!tickerId || targets.length === 0 || !targets.includes(tickerId)) return false;
      return true;
    })
    .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  for (const winner of activeCampaigns) {
    const content = scopedContent(orgId, winner.contentId);
    const versionId = content?.publishedVersionId ?? null;
    if (!content || !versionId) continue;
    const version = db
      .select()
      .from(contentVersions)
      .where(
        and(
          eq(contentVersions.id, versionId),
          eq(contentVersions.organizationId, orgId),
          eq(contentVersions.contentId, content.id),
        ),
      )
      .get();
    if (!version) continue;
    return {
      source: "campaign" as const,
      campaignId: winner.id,
      campaignName: winner.name,
      priority: winner.priority,
      contentId: winner.contentId,
      publishedVersionId: version.id,
      document: JSON.parse(version.documentJson) as CompositionDocument,
    };
  }
  if (tickerId) {
    const published = resolveTickerPublished(orgId, tickerId);
    if (published) return published;
  }
  return {
    source: "empty" as const,
    campaignId: null,
    campaignName: null,
    priority: 0,
    contentId: null,
    publishedVersionId: null,
    document: null,
  };
}

function resolveTickerPublished(orgId: string, tickerId: string) {
  const deliveries = db
    .select()
    .from(deviceDeliveries)
    .where(and(eq(deviceDeliveries.organizationId, orgId), eq(deviceDeliveries.tickerId, tickerId)))
    .all();
  let latest: { snapshotVersion: string; createdAt: number; id: string } | null = null;
  for (const delivery of deliveries) {
    const job = db
      .select()
      .from(publishingJobs)
      .where(and(eq(publishingJobs.id, delivery.jobId), eq(publishingJobs.organizationId, orgId)))
      .get();
    const createdAt = job?.createdAt?.getTime() ?? 0;
    if (!latest || createdAt > latest.createdAt || (createdAt === latest.createdAt && delivery.id > latest.id)) {
      latest = { snapshotVersion: delivery.snapshotVersion, createdAt, id: delivery.id };
    }
  }
  if (!latest) return null;
  const version = db
    .select()
    .from(contentVersions)
    .where(and(eq(contentVersions.id, latest.snapshotVersion), eq(contentVersions.organizationId, orgId)))
    .get();
  if (!version) return null;
  const content = scopedContent(orgId, version.contentId);
  if (!content) return null;
  return {
    source: "published" as const,
    campaignId: null,
    campaignName: null,
    priority: 0,
    contentId: content.id,
    publishedVersionId: version.id,
    document: JSON.parse(version.documentJson) as CompositionDocument,
  };
}

function serializePlayback(ticker: typeof tickers.$inferSelect, playing: ReturnType<typeof resolveNowPlaying>) {
  return {
    ticker: {
      id: ticker.id,
      width: ticker.width,
      height: ticker.height,
      colorMode: ticker.colorMode,
    },
    source: playing.source,
    contentId: playing.contentId,
    versionId: playing.publishedVersionId,
    campaignId: playing.campaignId,
    campaignName: playing.campaignName,
    document: playing.document,
  };
}

async function handleAi(input: {
  orgId: string;
  userId: string;
  roleKey: string;
  channel: "guide" | "copilot";
  message: string;
  route?: string;
  confirmToken?: string;
  entitlements: Awaited<ReturnType<typeof snapshotForOrg>>;
}) {
  const text = input.message.toLowerCase();
  const pending = id("ai");

  if (input.channel === "guide") {
    const routes: { q: RegExp; reply: string; href: string }[] = [
      { q: /ticker|device|display/, reply: "Open Tickers, then Add ticker to pair a display.", href: "/tickers" },
      { q: /subscription|billing|plan|pay/, reply: "Subscription and invoices live under Account → Subscription.", href: "/account/subscription" },
      { q: /animat/, reply: "Browse animation packs under Animations. Festival packs require the festivals entitlement.", href: "/animations" },
      { q: /campaign|diwali|schedule/, reply: "Create a dated campaign under Campaigns. Priority is numeric, not hard-coded.", href: "/campaigns" },
      { q: /template/, reply: "Start from Templates, then customize in the editor.", href: "/templates" },
      { q: /publish/, reply: "In the editor, Save draft, Preview, then Publish. Publish is blocked if the subscription is inactive.", href: "/content" },
    ];
    const hit = routes.find((r) => r.q.test(text));
    const reply = hit
      ? hit.reply
      : `You are on ${input.route ?? "the app"}. I can help with tickers, content, campaigns, and billing. Ask where something lives.`;
    persistAi(input, [{ role: "user", content: input.message }, { role: "assistant", content: reply }]);
    return { reply, href: hit?.href, actions: [] };
  }

  if (input.entitlements.restricted && /publish|create|schedule/.test(text)) {
    return {
      reply: "This organization is in restricted mode. Billing must be restored before copilot can change live content.",
      actions: [],
    };
  }

  if (/publish/.test(text)) {
    return {
      reply: "Publishing is a high-impact action. Confirm to publish the latest draft of all matching content.",
      confirmRequired: true,
      confirmToken: pending,
      actions: [{ tool: "publish_content", args: { confirmToken: pending } }],
    };
  }

  if (/dark blue|background/.test(text)) {
    const latest = db.select().from(contents).where(eq(contents.organizationId, input.orgId)).all()[0];
    if (!latest?.headDraftVersionId) return { reply: "Create a piece of content first, then I can restyle it.", actions: [] };
    const version = db.select().from(contentVersions).where(eq(contentVersions.id, latest.headDraftVersionId)).get();
    const doc = JSON.parse(version!.documentJson) as CompositionDocument;
    const next = {
      ...doc,
      layers: doc.layers.map((l) => (l.type === "fill" ? { ...l, props: { color: "#041428" } } : l)),
    };
    const versionId = id("ver");
    db.insert(contentVersions)
      .values({
        id: versionId,
        contentId: latest.id,
        organizationId: input.orgId,
        documentJson: JSON.stringify(next),
        createdBy: input.userId,
        createdAt: new Date(),
        parentVersionId: latest.headDraftVersionId,
      })
      .run();
    db.update(contents).set({ headDraftVersionId: versionId, status: "draft" }).where(eq(contents.id, latest.id)).run();
    audit({
      organizationId: input.orgId,
      actorUserId: input.userId,
      action: "ai.update_content",
      resourceType: "content",
      resourceId: latest.id,
      source: "ai",
    });
    return { reply: "Updated the background to dark blue on the current draft. Preview it in the editor before publishing.", actions: [{ tool: "update_content", args: { contentId: latest.id } }] };
  }

  if (/diwali|festive/.test(text)) {
    const document = createDemoDocument(
      { width: 993, height: 32, colorMode: "full" },
      "Happy Diwali  •  Gold lights  •  10s festive loop",
    );
    const contentId = id("cnt");
    const versionId = id("ver");
    db.insert(contents)
      .values({
        id: contentId,
        organizationId: input.orgId,
        title: "Diwali festive ticker",
        status: "draft",
        headDraftVersionId: versionId,
        publishedVersionId: null,
      })
      .run();
    db.insert(contentVersions)
      .values({
        id: versionId,
        contentId,
        organizationId: input.orgId,
        documentJson: JSON.stringify(document),
        createdBy: input.userId,
        createdAt: new Date(),
        parentVersionId: null,
      })
      .run();
    audit({
      organizationId: input.orgId,
      actorUserId: input.userId,
      action: "ai.create_content",
      resourceType: "content",
      resourceId: contentId,
      source: "ai",
    });
    return {
      reply: "Created a Diwali draft with gold-green LED text. Open the editor to preview, then publish when ready.",
      href: `/content/${contentId}/edit`,
      actions: [{ tool: "create_content", args: { contentId } }],
    };
  }

  persistAi(input, [
    { role: "user", content: input.message },
    { role: "assistant", content: "I can create festive content, restyle backgrounds, or explain where to publish. Try a specific prompt." },
  ]);
  return {
    reply: "Try: “Create a festive Diwali ticker”, “Change the background to dark blue”, or switch to Guide for navigation help.",
    actions: [],
  };
}

function persistAi(
  input: { orgId: string; userId: string; channel: string },
  messages: { role: string; content: string }[],
) {
  db.insert(aiConversations)
    .values({
      id: id("con"),
      organizationId: input.orgId,
      userId: input.userId,
      channel: input.channel,
      messagesJson: JSON.stringify(messages),
    })
    .run();
}
