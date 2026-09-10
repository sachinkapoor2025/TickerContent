import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.TICKER_DATA_DIR ?? resolve(here, "../../../.data");
mkdirSync(dataDir, { recursive: true });
const dbFile = process.env.TICKER_DB_PATH ?? resolve(dataDir, "ticker-cms.sqlite");

export const DATA_DIR = dataDir;
export const sqlite = new Database(dbFile);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

export function migrate() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      audience TEXT NOT NULL DEFAULT 'tenant',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      timezone TEXT NOT NULL DEFAULT 'UTC',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      role_key TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
    );
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      entitlements_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL UNIQUE,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL,
      current_period_end INTEGER,
      grace_ends_at INTEGER,
      provider TEXT NOT NULL DEFAULT 'manual'
    );
    CREATE TABLE IF NOT EXISTS entitlement_overrides (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      key TEXT NOT NULL,
      enabled INTEGER,
      reason TEXT,
      expires_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS tickers (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      location TEXT,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      color_mode TEXT NOT NULL DEFAULT 'full',
      orientation TEXT NOT NULL DEFAULT 'landscape',
      status TEXT NOT NULL DEFAULT 'active',
      last_heartbeat_at INTEGER,
      assigned_playlist_id TEXT,
      tags_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS device_groups (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      ticker_ids_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS contents (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      head_draft_version_id TEXT,
      published_version_id TEXT
    );
    CREATE TABLE IF NOT EXISTS content_versions (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      document_json TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      parent_version_id TEXT
    );
    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      title TEXT NOT NULL,
      visibility TEXT NOT NULL,
      category TEXT NOT NULL,
      document_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS animation_packs (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      entitlement_key TEXT NOT NULL,
      items_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      priority INTEGER NOT NULL DEFAULT 100,
      start_at INTEGER NOT NULL,
      end_at INTEGER NOT NULL,
      content_id TEXT NOT NULL,
      published_version_id TEXT,
      target_ticker_ids_json TEXT NOT NULL DEFAULT '[]',
      recurrence TEXT
    );
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      ticker_id TEXT NOT NULL,
      name TEXT NOT NULL,
      item_ids_json TEXT NOT NULL DEFAULT '[]'
    );
    CREATE TABLE IF NOT EXISTS publishing_jobs (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      content_id TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      trigger TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS device_deliveries (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      ticker_id TEXT NOT NULL,
      status TEXT NOT NULL,
      snapshot_version TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      actor_user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      source TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      channel TEXT NOT NULL,
      messages_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      kind TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ready',
      storage_key TEXT,
      mime_type TEXT,
      size_bytes INTEGER,
      created_at INTEGER,
      meta_json TEXT NOT NULL DEFAULT '{}'
    );
  `);

  const tickerColumns = sqlite.prepare("PRAGMA table_info(tickers)").all() as { name: string }[];
  if (!tickerColumns.some((column) => column.name === "color_mode")) {
    sqlite.exec(`ALTER TABLE tickers ADD COLUMN color_mode TEXT NOT NULL DEFAULT 'full'`);
  }

  const assetColumns = sqlite.prepare("PRAGMA table_info(assets)").all() as { name: string }[];
  const assetNames = new Set(assetColumns.map((column) => column.name));
  if (!assetNames.has("storage_key")) sqlite.exec(`ALTER TABLE assets ADD COLUMN storage_key TEXT`);
  if (!assetNames.has("mime_type")) sqlite.exec(`ALTER TABLE assets ADD COLUMN mime_type TEXT`);
  if (!assetNames.has("size_bytes")) sqlite.exec(`ALTER TABLE assets ADD COLUMN size_bytes INTEGER`);
  if (!assetNames.has("created_at")) sqlite.exec(`ALTER TABLE assets ADD COLUMN created_at INTEGER`);

  const campaignColumns = sqlite.prepare("PRAGMA table_info(campaigns)").all() as { name: string }[];
  if (!campaignColumns.some((column) => column.name === "published_version_id")) {
    sqlite.exec(`ALTER TABLE campaigns ADD COLUMN published_version_id TEXT`);
  }
}
