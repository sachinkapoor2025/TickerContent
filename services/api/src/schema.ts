import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  audience: text("audience").notNull().default("tenant"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  status: text("status").notNull().default("active"),
  timezone: text("timezone").notNull().default("UTC"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const memberships = sqliteTable("memberships", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  organizationId: text("organization_id").notNull(),
  roleKey: text("role_key").notNull(),
  status: text("status").notNull().default("active"),
});

export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  entitlementsJson: text("entitlements_json").notNull(),
});

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull().unique(),
  planId: text("plan_id").notNull(),
  status: text("status").notNull(),
  currentPeriodEnd: integer("current_period_end", { mode: "timestamp_ms" }),
  graceEndsAt: integer("grace_ends_at", { mode: "timestamp_ms" }),
  provider: text("provider").notNull().default("manual"),
});

export const entitlementOverrides = sqliteTable("entitlement_overrides", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  key: text("key").notNull(),
  enabled: integer("enabled", { mode: "boolean" }),
  reason: text("reason"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
});

export const tickers = sqliteTable("tickers", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  location: text("location"),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  colorMode: text("color_mode").notNull().default("full"),
  orientation: text("orientation").notNull().default("landscape"),
  status: text("status").notNull().default("active"),
  lastHeartbeatAt: integer("last_heartbeat_at", { mode: "timestamp_ms" }),
  assignedPlaylistId: text("assigned_playlist_id"),
  tagsJson: text("tags_json").notNull().default("[]"),
});

export const deviceGroups = sqliteTable("device_groups", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  tickerIdsJson: text("ticker_ids_json").notNull().default("[]"),
});

export const contents = sqliteTable("contents", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  headDraftVersionId: text("head_draft_version_id"),
  publishedVersionId: text("published_version_id"),
});

export const contentVersions = sqliteTable("content_versions", {
  id: text("id").primaryKey(),
  contentId: text("content_id").notNull(),
  organizationId: text("organization_id").notNull(),
  documentJson: text("document_json").notNull(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  parentVersionId: text("parent_version_id"),
});

export const templates = sqliteTable("templates", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  title: text("title").notNull(),
  visibility: text("visibility").notNull(),
  category: text("category").notNull(),
  documentJson: text("document_json").notNull(),
});

export const animationPacks = sqliteTable("animation_packs", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  entitlementKey: text("entitlement_key").notNull(),
  itemsJson: text("items_json").notNull(),
});

export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("draft"),
  priority: integer("priority").notNull().default(100),
  startAt: integer("start_at", { mode: "timestamp_ms" }).notNull(),
  endAt: integer("end_at", { mode: "timestamp_ms" }).notNull(),
  contentId: text("content_id").notNull(),
  publishedVersionId: text("published_version_id"),
  targetTickerIdsJson: text("target_ticker_ids_json").notNull().default("[]"),
  recurrence: text("recurrence"),
});

export const playlists = sqliteTable("playlists", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  tickerId: text("ticker_id").notNull(),
  name: text("name").notNull(),
  itemIdsJson: text("item_ids_json").notNull().default("[]"),
});

export const publishingJobs = sqliteTable("publishing_jobs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  contentId: text("content_id").notNull(),
  snapshotJson: text("snapshot_json").notNull(),
  trigger: text("trigger").notNull(),
  status: text("status").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const deviceDeliveries = sqliteTable("device_deliveries", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  jobId: text("job_id").notNull(),
  tickerId: text("ticker_id").notNull(),
  status: text("status").notNull(),
  snapshotVersion: text("snapshot_version").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  actorUserId: text("actor_user_id"),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  source: text("source").notNull(),
  payloadJson: text("payload_json").notNull().default("{}"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export const aiConversations = sqliteTable("ai_conversations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id").notNull(),
  userId: text("user_id").notNull(),
  channel: text("channel").notNull(),
  messagesJson: text("messages_json").notNull(),
});

export const assets = sqliteTable("assets", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id"),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("ready"),
  storageKey: text("storage_key"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  metaJson: text("meta_json").notNull().default("{}"),
});
