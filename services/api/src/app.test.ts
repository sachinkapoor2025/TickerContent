import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "ticker-cms-"));
process.env.TICKER_DATA_DIR = dir;
process.env.JWT_SECRET = "test-secret";

const { migrate, db } = await import("./db.js");
const { seedCatalog } = await import("./seed.js");
const { createApp } = await import("./app.js");
const { MAX_ASSET_BYTES } = await import("./asset-storage.js");
const { auditLogs, organizations } = await import("./schema.js");

migrate();
seedCatalog();
const app = createApp();

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function json(res: Response) {
  return res.json() as Promise<any>;
}

function fileForm(bytes: Buffer, fileName: string, type: string, name?: string) {
  const form = new FormData();
  form.set("file", new File([new Uint8Array(bytes)], fileName, { type }));
  if (name) form.set("name", name);
  return form;
}

describe("tenant isolation and entitlements", () => {
  let tokenA = "";
  let tokenB = "";
  let tickerA = "";
  let contentA = "";

  beforeAll(async () => {
    const a = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "a@example.com",
          password: "password12",
          name: "Org A",
          organizationName: "Alpha",
        }),
      }),
    );
    const b = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "b@example.com",
          password: "password12",
          name: "Org B",
          organizationName: "Beta",
        }),
      }),
    );
    tokenA = a.token;
    tokenB = b.token;
  });

  it("health", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
  });

  it("creates a ticker in A that B cannot read", async () => {
    const created = await json(
      await app.request("/v1/tickers", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ name: "Lobby", width: 993, height: 32 }),
      }),
    );
    tickerA = created.id;
    expect(created.id).toBeTruthy();
    const denied = await app.request(`/v1/tickers/${tickerA}`, {
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(denied.status).toBe(404);
  });

  it("blocks publish when subscription is expired", async () => {
    const content = await json(
      await app.request("/v1/contents", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ title: "Promo" }),
      }),
    );
    contentA = content.id;
    await app.request("/v1/billing/simulate-status", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ status: "expired" }),
    });
    const pub = await app.request(`/v1/contents/${contentA}/publish`, {
      method: "POST",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(pub.status).toBe(403);
    await app.request("/v1/billing/simulate-status", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ status: "active" }),
    });
    const ok = await app.request(`/v1/contents/${contentA}/publish`, {
      method: "POST",
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(ok.status).toBe(200);
  });

  it("persists and updates a display profile and isolates tenants", async () => {
    const created = await json(
      await app.request("/v1/tickers", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ name: "Lobby 64", width: 620, height: 64, colorMode: "full" }),
      }),
    );
    expect(created.width).toBe(620);
    expect(created.height).toBe(64);
    expect(created.colorMode).toBe("full");

    const listed = await json(
      await app.request("/v1/tickers", { headers: { authorization: `Bearer ${tokenA}` } }),
    );
    const fromList = listed.items.find((t: { id: string }) => t.id === created.id);
    expect(fromList).toMatchObject({ width: 620, height: 64, colorMode: "full" });

    const got = await json(
      await app.request(`/v1/tickers/${created.id}`, { headers: { authorization: `Bearer ${tokenA}` } }),
    );
    expect(got.width).toBe(620);
    expect(got.height).toBe(64);
    expect(got.colorMode).toBe("full");

    const patched = await json(
      await app.request(`/v1/tickers/${created.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ width: 128, height: 16, colorMode: "mono" }),
      }),
    );
    expect(patched).toMatchObject({ id: created.id, width: 128, height: 16, colorMode: "mono" });

    const afterPatch = await json(
      await app.request(`/v1/tickers/${created.id}`, { headers: { authorization: `Bearer ${tokenA}` } }),
    );
    expect(afterPatch).toMatchObject({ width: 128, height: 16, colorMode: "mono" });

    const crossGet = await app.request(`/v1/tickers/${created.id}`, {
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(crossGet.status).toBe(404);
    const crossPatch = await app.request(`/v1/tickers/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ name: "Hacked" }),
    });
    expect(crossPatch.status).toBe(404);

    const invalidWidth = await app.request("/v1/tickers", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: "Bad", width: 0, height: 64, colorMode: "full" }),
    });
    expect(invalidWidth.status).toBe(400);
    const invalidMode = await app.request("/v1/tickers", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ name: "Bad", width: 620, height: 64, colorMode: "rgb" }),
    });
    expect(invalidMode.status).toBe(400);
    const invalidPatch = await app.request(`/v1/tickers/${created.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ height: -4 }),
    });
    expect(invalidPatch.status).toBe(400);
  });
});

describe("assets", () => {
  let tokenA = "";
  let tokenB = "";

  beforeAll(async () => {
    const a = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "assets-a@example.com",
          password: "password12",
          name: "Assets A",
          organizationName: "Assets Alpha",
        }),
      }),
    );
    const b = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "assets-b@example.com",
          password: "password12",
          name: "Assets B",
          organizationName: "Assets Beta",
        }),
      }),
    );
    tokenA = a.token;
    tokenB = b.token;
  });

  it("uploads an image, lists it, and returns content", async () => {
    const created = await json(
      await app.request("/v1/assets", {
        method: "POST",
        headers: { authorization: `Bearer ${tokenA}` },
        body: fileForm(PNG_1X1, "dot.png", "image/png", "Lobby logo"),
      }),
    );
    expect(created).toMatchObject({ name: "Lobby logo", kind: "image", mimeType: "image/png" });
    expect(created.storageKey).toBeUndefined();
    expect(created.sizeBytes).toBe(PNG_1X1.length);
    expect(existsSync(join(dir, "assets", `${created.id}.png`))).toBe(true);

    const listed = await json(await app.request("/v1/assets", { headers: { authorization: `Bearer ${tokenA}` } }));
    expect(listed.items.some((item: { id: string }) => item.id === created.id)).toBe(true);
    expect(listed.items.some((item: { id: string }) => item.id === "asset_platform_diya")).toBe(true);

    const content = await app.request(`/v1/assets/${created.id}/content`, {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(content.status).toBe(200);
    expect(content.headers.get("content-type")).toBe("image/png");
    const body = Buffer.from(await content.arrayBuffer());
    expect(body.equals(PNG_1X1)).toBe(true);
  });

  it("uploads lottie JSON and rejects invalid JSON and unsupported types", async () => {
    const lottie = Buffer.from(JSON.stringify({ v: "5.7.4", fr: 30, layers: [] }));
    const created = await json(
      await app.request("/v1/assets", {
        method: "POST",
        headers: { authorization: `Bearer ${tokenA}` },
        body: fileForm(lottie, "loop.json", "application/json", "Spark"),
      }),
    );
    expect(created.kind).toBe("lottie");
    const content = await app.request(`/v1/assets/${created.id}/content`, {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    const parsed = JSON.parse(Buffer.from(await content.arrayBuffer()).toString("utf8"));
    expect(parsed.layers).toEqual([]);

    const badJson = await app.request("/v1/assets", {
      method: "POST",
      headers: { authorization: `Bearer ${tokenA}` },
      body: fileForm(Buffer.from("{not-json"), "bad.json", "application/json"),
    });
    expect(badJson.status).toBe(400);

    const plain = await app.request("/v1/assets", {
      method: "POST",
      headers: { authorization: `Bearer ${tokenA}` },
      body: fileForm(Buffer.from("hello"), "note.txt", "text/plain"),
    });
    expect(plain.status).toBe(400);
  });

  it("rejects oversized uploads and cross-tenant content reads", async () => {
    const huge = await app.request("/v1/assets", {
      method: "POST",
      headers: { authorization: `Bearer ${tokenA}` },
      body: fileForm(Buffer.alloc(MAX_ASSET_BYTES + 1, 1), "big.png", "image/png"),
    });
    expect(huge.status).toBe(413);

    const created = await json(
      await app.request("/v1/assets", {
        method: "POST",
        headers: { authorization: `Bearer ${tokenA}` },
        body: fileForm(PNG_1X1, "secret.png", "image/png"),
      }),
    );
    const deniedList = await json(await app.request("/v1/assets", { headers: { authorization: `Bearer ${tokenB}` } }));
    expect(deniedList.items.some((item: { id: string }) => item.id === created.id)).toBe(false);
    const denied = await app.request(`/v1/assets/${created.id}/content`, {
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(denied.status).toBe(404);

    const deniedDelete = await app.request(`/v1/assets/${created.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${tokenB}` },
    });
    expect(deniedDelete.status).toBe(404);

    const deleted = await json(
      await app.request(`/v1/assets/${created.id}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${tokenA}` },
      }),
    );
    expect(deleted).toEqual({ ok: true });
    expect(existsSync(join(dir, "assets", `${created.id}.png`))).toBe(false);
    const missing = await app.request(`/v1/assets/${created.id}/content`, {
      headers: { authorization: `Bearer ${tokenA}` },
    });
    expect(missing.status).toBe(404);
  });
});

describe("campaign targeting", () => {
  let tokenA = "";
  let tokenB = "";
  let tickerA1 = "";
  let tickerA2 = "";
  let tickerA3 = "";
  let tickerB = "";
  let draftContent = "";
  let publishedContent = "";
  let publishedVersion = "";
  let campaignA = "";

  const range = () => ({
    startAt: new Date(Date.now() - 60_000).toISOString(),
    endAt: new Date(Date.now() + 86_400_000).toISOString(),
  });

  beforeAll(async () => {
    const a = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "camp-a@example.com",
          password: "password12",
          name: "Camp A",
          organizationName: "Camp Alpha",
        }),
      }),
    );
    const b = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "camp-b@example.com",
          password: "password12",
          name: "Camp B",
          organizationName: "Camp Beta",
        }),
      }),
    );
    tokenA = a.token;
    tokenB = b.token;
    tickerA1 = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({ name: "Lobby", width: 620, height: 64 }),
        }),
      )
    ).id;
    tickerA2 = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({ name: "Concourse", width: 620, height: 64 }),
        }),
      )
    ).id;
    tickerA3 = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({ name: "Unused", width: 620, height: 64 }),
        }),
      )
    ).id;
    tickerB = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${tokenB}` },
          body: JSON.stringify({ name: "Beta board", width: 620, height: 64 }),
        }),
      )
    ).id;
    draftContent = (
      await json(
        await app.request("/v1/contents", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
          body: JSON.stringify({ title: "Draft only" }),
        }),
      )
    ).id;
    const published = await json(
      await app.request("/v1/contents", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({ title: "Live board" }),
      }),
    );
    publishedContent = published.id;
    const pub = await json(
      await app.request(`/v1/contents/${publishedContent}/publish`, {
        method: "POST",
        headers: { authorization: `Bearer ${tokenA}` },
      }),
    );
    publishedVersion = pub.snapshot.version;
  });

  it("creates a campaign targeting one ticker and stores the published version", async () => {
    const created = await json(
      await app.request("/v1/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          name: "Lobby loop",
          contentId: publishedContent,
          targetTickerIds: [tickerA1],
          status: "scheduled",
          ...range(),
        }),
      }),
    );
    campaignA = created.id;
    expect(created.targetTickerIds).toEqual([tickerA1]);
    expect(created.publishedVersionId).toBe(publishedVersion);
    expect(created.status).toBe("scheduled");
  });

  it("creates a campaign targeting multiple tickers", async () => {
    const created = await json(
      await app.request("/v1/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          name: "Both boards",
          contentId: publishedContent,
          targetTickerIds: [tickerA1, tickerA2],
          status: "scheduled",
          ...range(),
        }),
      }),
    );
    expect(created.targetTickerIds).toEqual([tickerA1, tickerA2]);
  });

  it("rejects a cross-tenant ticker target", async () => {
    const res = await app.request("/v1/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: "Steal",
        contentId: publishedContent,
        targetTickerIds: [tickerB],
        status: "scheduled",
        ...range(),
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects an invalid date range", async () => {
    const res = await app.request("/v1/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: "Backwards",
        contentId: publishedContent,
        targetTickerIds: [tickerA1],
        status: "scheduled",
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        endAt: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects scheduling a campaign against draft content", async () => {
    const res = await app.request("/v1/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({
        name: "Too soon",
        contentId: draftContent,
        targetTickerIds: [tickerA1],
        status: "scheduled",
        ...range(),
      }),
    });
    expect(res.status).toBe(400);
    const draftOk = await json(
      await app.request("/v1/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          name: "Hold as draft",
          contentId: draftContent,
          targetTickerIds: [tickerA1],
          status: "draft",
          ...range(),
        }),
      }),
    );
    expect(draftOk.status).toBe("draft");
    expect(draftOk.publishedVersionId).toBeNull();
  });

  it("associates published content and isolates campaigns across tenants", async () => {
    const listedA = await json(await app.request("/v1/campaigns", { headers: { authorization: `Bearer ${tokenA}` } }));
    expect(listedA.items.some((item: { id: string }) => item.id === campaignA)).toBe(true);
    const listedB = await json(await app.request("/v1/campaigns", { headers: { authorization: `Bearer ${tokenB}` } }));
    expect(listedB.items.some((item: { id: string }) => item.id === campaignA)).toBe(false);
    const denied = await app.request(`/v1/campaigns/${campaignA}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ name: "Hacked" }),
    });
    expect(denied.status).toBe(404);
  });

  it("resolveNowPlaying returns the campaign only for targeted tickers", async () => {
    const lobby = await json(
      await app.request(`/v1/tickers/${tickerA1}`, { headers: { authorization: `Bearer ${tokenA}` } }),
    );
    expect(lobby.nowPlaying.source).toBe("campaign");
    expect(lobby.nowPlaying.campaignId).toBeTruthy();
    expect(lobby.nowPlaying.publishedVersionId).toBe(publishedVersion);
    expect(lobby.nowPlaying.document).toBeTruthy();

    const concourse = await json(
      await app.request(`/v1/tickers/${tickerA2}`, { headers: { authorization: `Bearer ${tokenA}` } }),
    );
    expect(concourse.nowPlaying.campaignId).not.toBe(campaignA);
    const both = await json(await app.request("/v1/campaigns", { headers: { authorization: `Bearer ${tokenA}` } }));
    const dual = both.items.find((item: { name: string }) => item.name === "Both boards");
    expect(concourse.nowPlaying.campaignId).toBe(dual.id);

    const unused = await json(
      await app.request(`/v1/tickers/${tickerA3}`, { headers: { authorization: `Bearer ${tokenA}` } }),
    );
    expect(unused.nowPlaying.source).not.toBe("campaign");
  });

  it("expired campaigns are not now playing", async () => {
    const expired = await json(
      await app.request("/v1/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenA}` },
        body: JSON.stringify({
          name: "Finished",
          contentId: publishedContent,
          targetTickerIds: [tickerA2],
          status: "scheduled",
          startAt: new Date(Date.now() - 86_400_000 * 3).toISOString(),
          endAt: new Date(Date.now() - 86_400_000).toISOString(),
        }),
      }),
    );
    const concourse = await json(
      await app.request(`/v1/tickers/${tickerA2}`, { headers: { authorization: `Bearer ${tokenA}` } }),
    );
    expect(concourse.nowPlaying.campaignId).not.toBe(expired.id);
  });

  it("does not resolve org B content onto org A tickers", async () => {
    const bContent = await json(
      await app.request("/v1/contents", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${tokenB}` },
        body: JSON.stringify({ title: "Beta secret" }),
      }),
    );
    await app.request(`/v1/contents/${bContent.id}/publish`, {
      method: "POST",
      headers: { authorization: `Bearer ${tokenB}` },
    });
    await app.request("/v1/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({
        name: "Beta only",
        contentId: bContent.id,
        targetTickerIds: [tickerB],
        status: "scheduled",
        ...range(),
      }),
    });
    const lobby = await json(
      await app.request(`/v1/tickers/${tickerA1}`, { headers: { authorization: `Bearer ${tokenA}` } }),
    );
    expect(lobby.nowPlaying.contentId).not.toBe(bContent.id);
    const betaTicker = await json(
      await app.request(`/v1/tickers/${tickerB}`, { headers: { authorization: `Bearer ${tokenB}` } }),
    );
    expect(betaTicker.nowPlaying.contentId).toBe(bContent.id);
  });
});

describe("playback api", () => {
  let tokenA = "";
  let tokenB = "";
  let emptyTicker = "";
  let playTicker = "";
  let otherTicker = "";
  let tickerB = "";
  let contentId = "";
  let publishedVersion = "";
  let publishedDocument: {
    schemaVersion: string;
    profile: { width: number; height: number; colorMode: string };
    layers: Array<Record<string, unknown>>;
  };
  let campaignId = "";

  const range = () => ({
    startAt: new Date(Date.now() - 60_000).toISOString(),
    endAt: new Date(Date.now() + 86_400_000).toISOString(),
  });

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  const playback = (tickerId: string, token: string) =>
    app.request(`/v1/playback/tickers/${tickerId}`, { headers: auth(token) });

  beforeAll(async () => {
    const a = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "play-a@example.com",
          password: "password12",
          name: "Play A",
          organizationName: "Playback Alpha",
        }),
      }),
    );
    const b = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "play-b@example.com",
          password: "password12",
          name: "Play B",
          organizationName: "Playback Beta",
        }),
      }),
    );
    tokenA = a.token;
    tokenB = b.token;
    emptyTicker = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: { "content-type": "application/json", ...auth(tokenA) },
          body: JSON.stringify({ name: "Empty board", width: 620, height: 64, colorMode: "full" }),
        }),
      )
    ).id;
    playTicker = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: { "content-type": "application/json", ...auth(tokenA) },
          body: JSON.stringify({ name: "Lobby play", width: 620, height: 64, colorMode: "full" }),
        }),
      )
    ).id;
    otherTicker = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: { "content-type": "application/json", ...auth(tokenA) },
          body: JSON.stringify({ name: "Concourse play", width: 480, height: 32, colorMode: "mono" }),
        }),
      )
    ).id;
    tickerB = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: { "content-type": "application/json", ...auth(tokenB) },
          body: JSON.stringify({ name: "Beta play", width: 620, height: 64 }),
        }),
      )
    ).id;
  });

  it("returns an explicit empty state when nothing is playable", async () => {
    const res = await playback(emptyTicker, tokenA);
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.source).toBe("empty");
    expect(body.contentId).toBeNull();
    expect(body.versionId).toBeNull();
    expect(body.document).toBeNull();
    expect(body.ticker).toEqual({ id: emptyTicker, width: 620, height: 64, colorMode: "full" });
  });

  it("never returns draft content on playback", async () => {
    await app.request("/v1/contents", {
      method: "POST",
      headers: { "content-type": "application/json", ...auth(tokenA) },
      body: JSON.stringify({ title: "Unpublished draft" }),
    });
    const body = await json(await playback(playTicker, tokenA));
    expect(body.source).toBe("empty");
    expect(body.document).toBeNull();
  });

  it("returns the ticker profile and immutable published version", async () => {
    publishedDocument = {
      schemaVersion: "1",
      profile: { width: 620, height: 64, colorMode: "full" },
      layers: [
        { id: "fill-1", type: "fill", zIndex: 0, props: { color: "#110000" } },
        { id: "img-1", type: "image", zIndex: 10, x: 0, y: 0, width: 32, height: 32, assetId: "ast_playback_ref" },
      ],
    };
    const created = await json(
      await app.request("/v1/contents", {
        method: "POST",
        headers: { "content-type": "application/json", ...auth(tokenA) },
        body: JSON.stringify({ title: "Playback live", document: publishedDocument }),
      }),
    );
    contentId = created.id;
    const pub = await json(
      await app.request(`/v1/contents/${contentId}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json", ...auth(tokenA) },
        body: JSON.stringify({ tickerIds: [playTicker] }),
      }),
    );
    publishedVersion = pub.snapshot.version;
    expect(pub.deliveries).toBe(1);
    const body = await json(await playback(playTicker, tokenA));
    expect(body.ticker).toEqual({ id: playTicker, width: 620, height: 64, colorMode: "full" });
    expect(body.source).toBe("published");
    expect(body.contentId).toBe(contentId);
    expect(body.versionId).toBe(publishedVersion);
    expect(body.document).toMatchObject(publishedDocument);
    expect(body.document.layers.find((layer: { type: string }) => layer.type === "image").assetId).toBe(
      "ast_playback_ref",
    );
    expect(JSON.stringify(body.document)).not.toMatch(/iVBORw0KGgo/);
  });

  it("does not return another ticker's published document", async () => {
    const unassigned = await json(await playback(emptyTicker, tokenA));
    expect(unassigned.source).toBe("empty");
    expect(unassigned.document).toBeNull();
    expect(unassigned.contentId).toBeNull();
    expect(unassigned.versionId).toBeNull();
    const other = await json(await playback(otherTicker, tokenA));
    expect(other.source).toBe("empty");
    expect(other.document).toBeNull();
  });

  it("keeps the published version after a later draft edit", async () => {
    await app.request(`/v1/contents/${contentId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...auth(tokenA) },
      body: JSON.stringify({
        document: {
          schemaVersion: "1",
          profile: { width: 620, height: 64, colorMode: "full" },
          layers: [{ id: "fill-draft", type: "fill", zIndex: 0, props: { color: "#ffffff" } }],
        },
      }),
    });
    const body = await json(await playback(playTicker, tokenA));
    expect(body.versionId).toBe(publishedVersion);
    expect(body.document.layers).toEqual(publishedDocument.layers);
  });

  it("returns a targeted campaign version instead of org published fallback", async () => {
    const created = await json(
      await app.request("/v1/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json", ...auth(tokenA) },
        body: JSON.stringify({
          name: "Lobby playback",
          contentId,
          targetTickerIds: [playTicker],
          status: "scheduled",
          ...range(),
        }),
      }),
    );
    campaignId = created.id;
    const targeted = await json(await playback(playTicker, tokenA));
    expect(targeted.source).toBe("campaign");
    expect(targeted.campaignId).toBe(campaignId);
    expect(targeted.versionId).toBe(publishedVersion);
    expect(targeted.document.layers).toEqual(publishedDocument.layers);
  });

  it("does not return an untargeted campaign", async () => {
    const untargeted = await json(await playback(otherTicker, tokenA));
    expect(untargeted.campaignId).not.toBe(campaignId);
    expect(untargeted.source).toBe("empty");
    expect(untargeted.document).toBeNull();
    expect(untargeted.ticker).toEqual({ id: otherTicker, width: 480, height: 32, colorMode: "mono" });
  });

  it("does not return an expired campaign and stays empty without ticker-specific published content", async () => {
    const expired = await json(
      await app.request("/v1/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json", ...auth(tokenA) },
        body: JSON.stringify({
          name: "Expired playback",
          contentId,
          targetTickerIds: [otherTicker],
          status: "scheduled",
          startAt: new Date(Date.now() - 86_400_000 * 3).toISOString(),
          endAt: new Date(Date.now() - 86_400_000).toISOString(),
        }),
      }),
    );
    const body = await json(await playback(otherTicker, tokenA));
    expect(body.campaignId).not.toBe(expired.id);
    expect(body.source).toBe("empty");
    expect(body.document).toBeNull();
  });

  it("does not return a paused campaign and stays empty without ticker-specific published content", async () => {
    const paused = await json(
      await app.request("/v1/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json", ...auth(tokenA) },
        body: JSON.stringify({
          name: "Paused playback",
          contentId,
          targetTickerIds: [otherTicker],
          status: "paused",
          ...range(),
        }),
      }),
    );
    const body = await json(await playback(otherTicker, tokenA));
    expect(body.campaignId).not.toBe(paused.id);
    expect(body.source).toBe("empty");
    expect(body.document).toBeNull();
  });

  it("returns a campaign on a ticker that has no published assignment", async () => {
    const created = await json(
      await app.request("/v1/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json", ...auth(tokenA) },
        body: JSON.stringify({
          name: "Concourse override",
          contentId,
          targetTickerIds: [otherTicker],
          status: "scheduled",
          ...range(),
        }),
      }),
    );
    const body = await json(await playback(otherTicker, tokenA));
    expect(body.source).toBe("campaign");
    expect(body.campaignId).toBe(created.id);
    expect(body.versionId).toBe(publishedVersion);
    expect(body.document).toMatchObject(publishedDocument);
    const paused = await json(
      await app.request(`/v1/campaigns/${created.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", ...auth(tokenA) },
        body: JSON.stringify({ status: "paused" }),
      }),
    );
    expect(paused.status).toBe("paused");
    const afterPause = await json(await playback(otherTicker, tokenA));
    expect(afterPause.source).toBe("empty");
    expect(afterPause.document).toBeNull();
  });

  it("falls back to ticker-specific published content after a paused campaign", async () => {
    await app.request(`/v1/contents/${contentId}/publish`, {
      method: "POST",
      headers: { "content-type": "application/json", ...auth(tokenA) },
      body: JSON.stringify({ tickerIds: [otherTicker] }),
    });
    const assigned = await json(await playback(otherTicker, tokenA));
    expect(assigned.source).toBe("published");
    expect(assigned.contentId).toBe(contentId);
    expect(assigned.document).toBeTruthy();
    expect(assigned.versionId).toBeTruthy();
    const assignedVersion = assigned.versionId;
    const assignedLayers = assigned.document.layers;
    const campaign = await json(
      await app.request("/v1/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json", ...auth(tokenA) },
        body: JSON.stringify({
          name: "Assigned then paused",
          contentId,
          targetTickerIds: [otherTicker],
          status: "scheduled",
          ...range(),
        }),
      }),
    );
    const live = await json(await playback(otherTicker, tokenA));
    expect(live.source).toBe("campaign");
    expect(live.campaignId).toBe(campaign.id);
    await app.request(`/v1/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", ...auth(tokenA) },
      body: JSON.stringify({ status: "paused" }),
    });
    const fallback = await json(await playback(otherTicker, tokenA));
    expect(fallback.source).toBe("published");
    expect(fallback.campaignId).toBeNull();
    expect(fallback.contentId).toBe(contentId);
    expect(fallback.versionId).toBe(assignedVersion);
    expect(fallback.document.layers).toEqual(assignedLayers);
    const stillAssigned = await json(await playback(playTicker, tokenA));
    expect(stillAssigned.source).toBe("campaign");
    const stillEmpty = await json(await playback(emptyTicker, tokenA));
    expect(stillEmpty.source).toBe("empty");
    expect(stillEmpty.document).toBeNull();
  });

  it("rejects cross-tenant ticker playback", async () => {
    const denied = await playback(playTicker, tokenB);
    expect(denied.status).toBe(404);
    const missing = await playback(tickerB, tokenA);
    expect(missing.status).toBe(404);
  });

  it("requires authentication", async () => {
    const res = await app.request(`/v1/playback/tickers/${playTicker}`);
    expect(res.status).toBe(401);
  });
});

describe("content and campaign rbac", () => {
  let ownerToken = "";
  let viewerToken = "";
  let designerToken = "";
  let managerToken = "";
  let adminToken = "";
  let tickerId = "";
  let contentId = "";
  let campaignId = "";

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const jsonHeaders = (token: string) => ({
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  });
  const range = () => ({
    startAt: new Date(Date.now() - 60_000).toISOString(),
    endAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  const draftDocument = {
    schemaVersion: "1",
    profile: { width: 32, height: 16, colorMode: "full" },
    layers: [],
  };

  async function login(email: string) {
    return json(
      await app.request("/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "password12" }),
      }),
    );
  }

  async function invite(roleKey: string, email: string, name: string) {
    const res = await app.request("/v1/memberships", {
      method: "POST",
      headers: jsonHeaders(ownerToken),
      body: JSON.stringify({ email, name, password: "password12", roleKey }),
    });
    expect(res.status).toBe(201);
    return (await login(email)).token as string;
  }

  beforeAll(async () => {
    const owner = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "rbac-owner@example.com",
          password: "password12",
          name: "RBAC Owner",
          organizationName: "RBAC Org",
        }),
      }),
    );
    ownerToken = owner.token;
    tickerId = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: jsonHeaders(ownerToken),
          body: JSON.stringify({ name: "RBAC board", width: 620, height: 64, colorMode: "full" }),
        }),
      )
    ).id;
    contentId = (
      await json(
        await app.request("/v1/contents", {
          method: "POST",
          headers: jsonHeaders(ownerToken),
          body: JSON.stringify({ title: "RBAC content" }),
        }),
      )
    ).id;
    viewerToken = await invite("viewer", "rbac-viewer@example.com", "RBAC Viewer");
    designerToken = await invite("designer", "rbac-designer@example.com", "RBAC Designer");
    managerToken = await invite("content_manager", "rbac-manager@example.com", "RBAC Manager");
    adminToken = await invite("organization_admin", "rbac-admin@example.com", "RBAC Admin");
  });

  it("rejects viewer content PATCH", async () => {
    const res = await app.request(`/v1/contents/${contentId}`, {
      method: "PATCH",
      headers: jsonHeaders(viewerToken),
      body: JSON.stringify({ title: "hacked", document: draftDocument }),
    });
    expect(res.status).toBe(403);
  });

  it("allows designer content PATCH", async () => {
    const res = await json(
      await app.request(`/v1/contents/${contentId}`, {
        method: "PATCH",
        headers: jsonHeaders(designerToken),
        body: JSON.stringify({ title: "designer draft", document: draftDocument }),
      }),
    );
    expect(res.versionId).toBeTruthy();
    expect(res.status).toBe("draft");
  });

  it("rejects viewer publish", async () => {
    const res = await app.request(`/v1/contents/${contentId}/publish`, {
      method: "POST",
      headers: auth(viewerToken),
    });
    expect(res.status).toBe(403);
  });

  it("rejects designer publish", async () => {
    const res = await app.request(`/v1/contents/${contentId}/publish`, {
      method: "POST",
      headers: auth(designerToken),
    });
    expect(res.status).toBe(403);
  });

  it("allows content_manager publish", async () => {
    const res = await app.request(`/v1/contents/${contentId}/publish`, {
      method: "POST",
      headers: auth(managerToken),
    });
    expect(res.status).toBe(200);
  });

  it("allows organization_admin publish", async () => {
    await app.request(`/v1/contents/${contentId}`, {
      method: "PATCH",
      headers: jsonHeaders(adminToken),
      body: JSON.stringify({ title: "admin draft", document: draftDocument }),
    });
    const res = await app.request(`/v1/contents/${contentId}/publish`, {
      method: "POST",
      headers: auth(adminToken),
    });
    expect(res.status).toBe(200);
  });

  it("rejects viewer campaign create", async () => {
    const res = await app.request("/v1/campaigns", {
      method: "POST",
      headers: jsonHeaders(viewerToken),
      body: JSON.stringify({
        name: "viewer campaign",
        contentId,
        targetTickerIds: [tickerId],
        status: "scheduled",
        ...range(),
      }),
    });
    expect(res.status).toBe(403);
  });

  it("allows content_manager campaign create", async () => {
    const created = await json(
      await app.request("/v1/campaigns", {
        method: "POST",
        headers: jsonHeaders(managerToken),
        body: JSON.stringify({
          name: "manager campaign",
          contentId,
          targetTickerIds: [tickerId],
          status: "scheduled",
          ...range(),
        }),
      }),
    );
    campaignId = created.id;
    expect(created.id).toBeTruthy();
    expect(created.targetTickerIds).toEqual([tickerId]);
  });

  it("rejects viewer campaign PATCH", async () => {
    const res = await app.request(`/v1/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: jsonHeaders(viewerToken),
      body: JSON.stringify({ name: "hacked campaign" }),
    });
    expect(res.status).toBe(403);
  });

  it("allows organization_admin campaign PATCH", async () => {
    const updated = await json(
      await app.request(`/v1/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: jsonHeaders(adminToken),
        body: JSON.stringify({ name: "admin campaign" }),
      }),
    );
    expect(updated.name).toBe("admin campaign");
  });

  it("still blocks owner publish when the subscription is expired", async () => {
    await app.request("/v1/billing/simulate-status", {
      method: "POST",
      headers: jsonHeaders(ownerToken),
      body: JSON.stringify({ status: "expired" }),
    });
    const denied = await app.request(`/v1/contents/${contentId}/publish`, {
      method: "POST",
      headers: auth(ownerToken),
    });
    expect(denied.status).toBe(403);
    const body = await json(denied);
    expect(body.error?.code).toBe("subscription_inactive");
    await app.request("/v1/billing/simulate-status", {
      method: "POST",
      headers: jsonHeaders(ownerToken),
      body: JSON.stringify({ status: "active" }),
    });
    const ok = await app.request(`/v1/contents/${contentId}/publish`, {
      method: "POST",
      headers: auth(ownerToken),
    });
    expect(ok.status).toBe(200);
  });
});

describe("active campaign follows current published version", () => {
  let tokenA = "";
  let tokenB = "";
  let tickerA = "";
  let tickerB = "";
  let otherTicker = "";
  let tickerOrgB = "";
  let contentId = "";
  let campaignId = "";
  let version1 = "";
  let version2 = "";
  const documentV1 = {
    schemaVersion: "1",
    profile: { width: 620, height: 64, colorMode: "full" },
    layers: [{ id: "v1", type: "fill", zIndex: 0, props: { color: "#110000" } }],
  };
  const documentV2 = {
    schemaVersion: "1",
    profile: { width: 620, height: 64, colorMode: "full" },
    layers: [{ id: "v2", type: "fill", zIndex: 0, props: { color: "#002200" } }],
  };
  const documentDraft = {
    schemaVersion: "1",
    profile: { width: 620, height: 64, colorMode: "full" },
    layers: [{ id: "draft", type: "fill", zIndex: 0, props: { color: "#ffffff" } }],
  };

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const jsonHeaders = (token: string) => ({
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  });
  const range = () => ({
    startAt: new Date(Date.now() - 60_000).toISOString(),
    endAt: new Date(Date.now() + 86_400_000).toISOString(),
  });
  const playback = (tickerId: string, token: string) =>
    app.request(`/v1/playback/tickers/${tickerId}`, { headers: auth(token) });

  beforeAll(async () => {
    const a = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "camp-follow-a@example.com",
          password: "password12",
          name: "Follow A",
          organizationName: "Follow Alpha",
        }),
      }),
    );
    const b = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "camp-follow-b@example.com",
          password: "password12",
          name: "Follow B",
          organizationName: "Follow Beta",
        }),
      }),
    );
    tokenA = a.token;
    tokenB = b.token;
    tickerA = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: jsonHeaders(tokenA),
          body: JSON.stringify({ name: "Follow lobby", width: 620, height: 64, colorMode: "full" }),
        }),
      )
    ).id;
    tickerB = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: jsonHeaders(tokenA),
          body: JSON.stringify({ name: "Follow concourse", width: 620, height: 64, colorMode: "full" }),
        }),
      )
    ).id;
    otherTicker = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: jsonHeaders(tokenA),
          body: JSON.stringify({ name: "Follow unused", width: 480, height: 32, colorMode: "mono" }),
        }),
      )
    ).id;
    tickerOrgB = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: jsonHeaders(tokenB),
          body: JSON.stringify({ name: "Follow beta", width: 620, height: 64 }),
        }),
      )
    ).id;
  });

  it("plays V1 for an active campaign, then V2 after republish without editing the campaign", async () => {
    const created = await json(
      await app.request("/v1/contents", {
        method: "POST",
        headers: jsonHeaders(tokenA),
        body: JSON.stringify({ title: "Follow content", document: documentV1 }),
      }),
    );
    contentId = created.id;
    const pub1 = await json(
      await app.request(`/v1/contents/${contentId}/publish`, {
        method: "POST",
        headers: jsonHeaders(tokenA),
        body: JSON.stringify({ tickerIds: [tickerA] }),
      }),
    );
    version1 = pub1.snapshot.version;
    const campaign = await json(
      await app.request("/v1/campaigns", {
        method: "POST",
        headers: jsonHeaders(tokenA),
        body: JSON.stringify({
          name: "Follow campaign",
          contentId,
          targetTickerIds: [tickerA],
          status: "scheduled",
          priority: 100,
          ...range(),
        }),
      }),
    );
    campaignId = campaign.id;
    expect(campaign.publishedVersionId).toBe(version1);
    const playV1 = await json(await playback(tickerA, tokenA));
    expect(playV1.source).toBe("campaign");
    expect(playV1.campaignId).toBe(campaignId);
    expect(playV1.versionId).toBe(version1);
    expect(playV1.document.layers).toEqual(documentV1.layers);

    await app.request(`/v1/contents/${contentId}`, {
      method: "PATCH",
      headers: jsonHeaders(tokenA),
      body: JSON.stringify({ document: documentV2 }),
    });
    const pub2 = await json(
      await app.request(`/v1/contents/${contentId}/publish`, {
        method: "POST",
        headers: jsonHeaders(tokenA),
        body: JSON.stringify({ tickerIds: [tickerA] }),
      }),
    );
    version2 = pub2.snapshot.version;
    expect(version2).not.toBe(version1);

    const listed = await json(await app.request(`/v1/contents/${contentId}`, { headers: auth(tokenA) }));
    expect(listed.versions.some((row: { id: string }) => row.id === version1)).toBe(true);
    expect(listed.versions.some((row: { id: string }) => row.id === version2)).toBe(true);
    const jobs = await json(await app.request("/v1/publishing-jobs", { headers: auth(tokenA) }));
    const v1Job = jobs.items.find((job: { snapshotJson: string }) => {
      const snapshot = JSON.parse(job.snapshotJson);
      return snapshot.version === version1;
    });
    expect(v1Job).toBeTruthy();
    expect(JSON.parse(v1Job.snapshotJson).document.layers).toEqual(documentV1.layers);

    const unchangedCampaign = (await json(await app.request("/v1/campaigns", { headers: auth(tokenA) }))).items.find(
      (item: { id: string }) => item.id === campaignId,
    );
    expect(unchangedCampaign.publishedVersionId).toBe(version1);

    const playV2 = await json(await playback(tickerA, tokenA));
    expect(playV2.source).toBe("campaign");
    expect(playV2.campaignId).toBe(campaignId);
    expect(playV2.versionId).toBe(version2);
    expect(playV2.document.layers).toEqual(documentV2.layers);
    expect(playV2.document.layers).not.toEqual(documentV1.layers);
  });

  it("does not play an unpublished draft while the campaign is active", async () => {
    await app.request(`/v1/contents/${contentId}`, {
      method: "PATCH",
      headers: jsonHeaders(tokenA),
      body: JSON.stringify({ document: documentDraft }),
    });
    const body = await json(await playback(tickerA, tokenA));
    expect(body.source).toBe("campaign");
    expect(body.versionId).toBe(version2);
    expect(body.document.layers).toEqual(documentV2.layers);
    const current = await json(await app.request(`/v1/contents/${contentId}`, { headers: auth(tokenA) }));
    expect(current.headDraftVersionId).not.toBe(version2);
    expect(current.document.layers).toEqual(documentDraft.layers);
  });

  it("pauses back to ticker-specific published content, not the draft", async () => {
    await app.request(`/v1/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: jsonHeaders(tokenA),
      body: JSON.stringify({ status: "paused" }),
    });
    const body = await json(await playback(tickerA, tokenA));
    expect(body.source).toBe("published");
    expect(body.campaignId).toBeNull();
    expect(body.versionId).toBe(version2);
    expect(body.document.layers).toEqual(documentV2.layers);
    const unused = await json(await playback(otherTicker, tokenA));
    expect(unused.source).toBe("empty");
    expect(unused.document).toBeNull();
  });

  it("uses campaign priority and targeting after republish", async () => {
    await app.request(`/v1/campaigns/${campaignId}`, {
      method: "PATCH",
      headers: jsonHeaders(tokenA),
      body: JSON.stringify({ status: "scheduled" }),
    });
    const otherContent = await json(
      await app.request("/v1/contents", {
        method: "POST",
        headers: jsonHeaders(tokenA),
        body: JSON.stringify({
          title: "Higher priority",
          document: {
            schemaVersion: "1",
            profile: { width: 620, height: 64, colorMode: "full" },
            layers: [{ id: "hi", type: "fill", zIndex: 0, props: { color: "#0000aa" } }],
          },
        }),
      }),
    );
    const otherPub = await json(
      await app.request(`/v1/contents/${otherContent.id}/publish`, {
        method: "POST",
        headers: jsonHeaders(tokenA),
        body: JSON.stringify({ tickerIds: [tickerA] }),
      }),
    );
    const high = await json(
      await app.request("/v1/campaigns", {
        method: "POST",
        headers: jsonHeaders(tokenA),
        body: JSON.stringify({
          name: "Higher campaign",
          contentId: otherContent.id,
          targetTickerIds: [tickerA],
          status: "scheduled",
          priority: 200,
          ...range(),
        }),
      }),
    );
    const onA = await json(await playback(tickerA, tokenA));
    expect(onA.source).toBe("campaign");
    expect(onA.campaignId).toBe(high.id);
    expect(onA.contentId).toBe(otherContent.id);
    expect(onA.versionId).toBe(otherPub.snapshot.version);
    const onB = await json(await playback(tickerB, tokenA));
    expect(onB.source).toBe("empty");
    expect(onB.campaignId).not.toBe(high.id);
    expect(onB.campaignId).not.toBe(campaignId);
  });

  it("rejects cross-tenant campaign playback", async () => {
    const denied = await playback(tickerA, tokenB);
    expect(denied.status).toBe(404);
    const missing = await playback(tickerOrgB, tokenA);
    expect(missing.status).toBe(404);
  });
});

describe("platform admin boundary", () => {
  let tenantToken = "";
  let tenantOrgId = "";
  let platformToken = "";

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const jsonHeaders = (token: string) => ({
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  });

  beforeAll(async () => {
    const tenant = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "platform-boundary-owner@example.com",
          password: "password12",
          name: "Boundary Owner",
          organizationName: "Boundary Org",
        }),
      }),
    );
    tenantToken = tenant.token;
    tenantOrgId = tenant.organizationId;
    const platform = await json(
      await app.request("/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@tickercms.local", password: "Admin@12345" }),
      }),
    );
    platformToken = platform.token;
    expect(platform.user.audience).toBe("platform");
  });

  it("rejects tenant JWT on GET /v1/admin/organizations", async () => {
    const res = await app.request("/v1/admin/organizations", { headers: auth(tenantToken) });
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe("forbidden");
  });

  it("rejects tenant JWT on POST /v1/admin/organizations/:id/status", async () => {
    const res = await app.request(`/v1/admin/organizations/${tenantOrgId}/status`, {
      method: "POST",
      headers: jsonHeaders(tenantToken),
      body: JSON.stringify({ status: "suspended" }),
    });
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe("forbidden");
  });

  it("allows platform JWT to GET /v1/admin/organizations", async () => {
    const res = await app.request("/v1/admin/organizations", { headers: auth(platformToken) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.items.some((org: { id: string }) => org.id === tenantOrgId)).toBe(true);
  });

  it("allows platform JWT to POST /v1/admin/organizations/:id/status", async () => {
    const suspended = await app.request(`/v1/admin/organizations/${tenantOrgId}/status`, {
      method: "POST",
      headers: jsonHeaders(platformToken),
      body: JSON.stringify({ status: "suspended" }),
    });
    expect(suspended.status).toBe(200);
    const restored = await app.request(`/v1/admin/organizations/${tenantOrgId}/status`, {
      method: "POST",
      headers: jsonHeaders(platformToken),
      body: JSON.stringify({ status: "active" }),
    });
    expect(restored.status).toBe(200);
  });

  it("rejects platform JWT on tenant-scoped routes that require org context", async () => {
    const tickers = await app.request("/v1/tickers", { headers: auth(platformToken) });
    expect(tickers.status).toBe(403);
    expect((await json(tickers)).error.code).toBe("forbidden");
    const contents = await app.request("/v1/contents", { headers: auth(platformToken) });
    expect(contents.status).toBe(403);
  });

  it("still allows a tenant JWT with orgId to call tenant routes", async () => {
    const res = await app.request("/v1/tickers", { headers: auth(tenantToken) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("rejects missing and invalid tokens on admin and tenant routes", async () => {
    const missingAdmin = await app.request("/v1/admin/organizations");
    expect(missingAdmin.status).toBe(401);
    expect((await json(missingAdmin)).error.code).toBe("unauthorized");
    const invalidAdmin = await app.request("/v1/admin/organizations", {
      headers: { authorization: "Bearer not-a-token" },
    });
    expect(invalidAdmin.status).toBe(401);
    const missingTenant = await app.request("/v1/tickers");
    expect(missingTenant.status).toBe(401);
    const invalidTenant = await app.request("/v1/tickers", {
      headers: { authorization: "Bearer not-a-token" },
    });
    expect(invalidTenant.status).toBe(401);
  });
});

describe("admin organization detail", () => {
  let platformToken = "";
  let tokenA = "";
  let orgA = "";
  let orgAName = "";
  let tokenB = "";
  let orgB = "";
  let orgBName = "";

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const jsonHeaders = (token: string) => ({
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  });

  beforeAll(async () => {
    const a = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "admin-detail-a@example.com",
          password: "password12",
          name: "Detail Owner A",
          organizationName: "Detail Org Alpha",
        }),
      }),
    );
    const b = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "admin-detail-b@example.com",
          password: "password12",
          name: "Detail Owner B",
          organizationName: "Detail Org Beta",
        }),
      }),
    );
    tokenA = a.token;
    orgA = a.organizationId;
    orgAName = "Detail Org Alpha";
    tokenB = b.token;
    orgB = b.organizationId;
    orgBName = "Detail Org Beta";

    await app.request("/v1/tickers", {
      method: "POST",
      headers: jsonHeaders(tokenA),
      body: JSON.stringify({ name: "Alpha board 1", width: 620, height: 64, colorMode: "full" }),
    });
    await app.request("/v1/tickers", {
      method: "POST",
      headers: jsonHeaders(tokenA),
      body: JSON.stringify({ name: "Alpha board 2", width: 620, height: 64, colorMode: "full" }),
    });
    await app.request("/v1/tickers", {
      method: "POST",
      headers: jsonHeaders(tokenB),
      body: JSON.stringify({ name: "Beta board", width: 320, height: 32, colorMode: "full" }),
    });
    const invited = await app.request("/v1/memberships", {
      method: "POST",
      headers: jsonHeaders(tokenA),
      body: JSON.stringify({
        email: "admin-detail-a-viewer@example.com",
        name: "Detail Viewer A",
        password: "password12",
        roleKey: "viewer",
      }),
    });
    expect(invited.status).toBe(201);

    const platform = await json(
      await app.request("/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@tickercms.local", password: "Admin@12345" }),
      }),
    );
    platformToken = platform.token;
  });

  it("returns organization detail for a platform JWT", async () => {
    const res = await app.request(`/v1/admin/organizations/${orgA}`, { headers: auth(platformToken) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.organization).toMatchObject({
      id: orgA,
      name: orgAName,
      status: "active",
    });
    expect(body.organization.slug).toBeTruthy();
    expect(body.organization.timezone).toBeTruthy();
    expect(body.organization.createdAt).toBeTruthy();
    expect(body.subscription).toMatchObject({
      status: "active",
      planId: "plan_developer",
      provider: "manual",
    });
    expect(body.subscription.currentPeriodEnd).toBeTruthy();
    expect(body.plan).toMatchObject({
      id: "plan_developer",
      name: "Developer",
      code: "developer",
    });
    expect(body.entitlements).toMatchObject({
      restricted: false,
      flags: expect.any(Object),
      limits: expect.any(Object),
      remaining: expect.any(Object),
    });
    expect(body.entitlements.flags["content.publish"]).toBe(true);
    expect(body.memberCount).toBe(2);
    expect(body.tickerCount).toBe(2);
  });

  it("returns 404 for an unknown organization", async () => {
    const res = await app.request("/v1/admin/organizations/org_missing_detail", { headers: auth(platformToken) });
    expect(res.status).toBe(404);
    expect((await json(res)).error.code).toBe("not_found");
  });

  it("rejects tenant JWT on organization detail", async () => {
    const res = await app.request(`/v1/admin/organizations/${orgA}`, { headers: auth(tokenA) });
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe("forbidden");
  });

  it("rejects missing and invalid tokens on organization detail", async () => {
    const missing = await app.request(`/v1/admin/organizations/${orgA}`);
    expect(missing.status).toBe(401);
    const invalid = await app.request(`/v1/admin/organizations/${orgA}`, {
      headers: { authorization: "Bearer not-a-token" },
    });
    expect(invalid.status).toBe(401);
  });

  it("does not include another organization's data in the detail response", async () => {
    const res = await app.request(`/v1/admin/organizations/${orgA}`, { headers: auth(platformToken) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.organization.id).toBe(orgA);
    expect(body.organization.name).toBe(orgAName);
    expect(body.tickerCount).toBe(2);
    expect(body.memberCount).toBe(2);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(orgB);
    expect(serialized).not.toContain(orgBName);
    const other = await json(await app.request(`/v1/admin/organizations/${orgB}`, { headers: auth(platformToken) }));
    expect(other.organization.id).toBe(orgB);
    expect(other.tickerCount).toBe(1);
    expect(other.memberCount).toBe(1);
  });
});

describe("admin organization status", () => {
  let platformToken = "";
  let tenantToken = "";
  let orgId = "";
  const missingId = "org_missing_status";

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const jsonHeaders = (token: string) => ({
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  });

  function statusAudits(resourceId: string) {
    return db
      .select()
      .from(auditLogs)
      .all()
      .filter((row) => row.action === "organization.status" && row.resourceId === resourceId);
  }

  async function adminOrg(id: string) {
    return json(await app.request(`/v1/admin/organizations/${id}`, { headers: auth(platformToken) }));
  }

  beforeAll(async () => {
    const tenant = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "admin-status-owner@example.com",
          password: "password12",
          name: "Status Owner",
          organizationName: "Status Org",
        }),
      }),
    );
    tenantToken = tenant.token;
    orgId = tenant.organizationId;
    const platform = await json(
      await app.request("/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@tickercms.local", password: "Admin@12345" }),
      }),
    );
    platformToken = platform.token;
  });

  it("suspends an existing organization for a platform JWT", async () => {
    const before = statusAudits(orgId).length;
    const res = await app.request(`/v1/admin/organizations/${orgId}/status`, {
      method: "POST",
      headers: jsonHeaders(platformToken),
      body: JSON.stringify({ status: "suspended" }),
    });
    expect(res.status).toBe(200);
    expect((await json(res)).ok).toBe(true);
    expect((await adminOrg(orgId)).organization.status).toBe("suspended");
    const audits = statusAudits(orgId);
    expect(audits.length).toBe(before + 1);
    expect(JSON.parse(audits.at(-1)!.payloadJson)).toEqual({ status: "suspended" });
  });

  it("activates an existing organization for a platform JWT", async () => {
    const before = statusAudits(orgId).length;
    const res = await app.request(`/v1/admin/organizations/${orgId}/status`, {
      method: "POST",
      headers: jsonHeaders(platformToken),
      body: JSON.stringify({ status: "active" }),
    });
    expect(res.status).toBe(200);
    expect((await adminOrg(orgId)).organization.status).toBe("active");
    const audits = statusAudits(orgId);
    expect(audits.length).toBe(before + 1);
    expect(JSON.parse(audits.at(-1)!.payloadJson)).toEqual({ status: "active" });
  });

  it("rejects tenant suspend and activate", async () => {
    const suspend = await app.request(`/v1/admin/organizations/${orgId}/status`, {
      method: "POST",
      headers: jsonHeaders(tenantToken),
      body: JSON.stringify({ status: "suspended" }),
    });
    expect(suspend.status).toBe(403);
    const activate = await app.request(`/v1/admin/organizations/${orgId}/status`, {
      method: "POST",
      headers: jsonHeaders(tenantToken),
      body: JSON.stringify({ status: "active" }),
    });
    expect(activate.status).toBe(403);
    expect((await adminOrg(orgId)).organization.status).toBe("active");
  });

  it("returns 404 for an unknown organization and does not write audit", async () => {
    const before = statusAudits(missingId).length;
    const res = await app.request(`/v1/admin/organizations/${missingId}/status`, {
      method: "POST",
      headers: jsonHeaders(platformToken),
      body: JSON.stringify({ status: "suspended" }),
    });
    expect(res.status).toBe(404);
    expect((await json(res)).error.code).toBe("not_found");
    expect(statusAudits(missingId).length).toBe(before);
    expect(db.select().from(organizations).all().some((org) => org.id === missingId)).toBe(false);
  });

  it("rejects an invalid status without changing the organization or writing audit", async () => {
    const beforeAudits = statusAudits(orgId).length;
    const res = await app.request(`/v1/admin/organizations/${orgId}/status`, {
      method: "POST",
      headers: jsonHeaders(platformToken),
      body: JSON.stringify({ status: "archived" }),
    });
    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("invalid_body");
    expect((await adminOrg(orgId)).organization.status).toBe("active");
    expect(statusAudits(orgId).length).toBe(beforeAudits);
  });
});

describe("admin organization memberships", () => {
  let platformToken = "";
  let tokenA = "";
  let orgA = "";
  let tokenB = "";
  let orgB = "";
  const emptyOrgId = "org_empty_admin_members";

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const jsonHeaders = (token: string) => ({
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  });

  beforeAll(async () => {
    const a = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "admin-members-a@example.com",
          password: "password12",
          name: "Members Owner A",
          organizationName: "Members Org Alpha",
        }),
      }),
    );
    const b = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "admin-members-b@example.com",
          password: "password12",
          name: "Members Owner B",
          organizationName: "Members Org Beta",
        }),
      }),
    );
    tokenA = a.token;
    orgA = a.organizationId;
    tokenB = b.token;
    orgB = b.organizationId;
    const invited = await app.request("/v1/memberships", {
      method: "POST",
      headers: jsonHeaders(tokenA),
      body: JSON.stringify({
        email: "admin-members-a-viewer@example.com",
        name: "Members Viewer A",
        password: "password12",
        roleKey: "viewer",
      }),
    });
    expect(invited.status).toBe(201);
    db.insert(organizations)
      .values({
        id: emptyOrgId,
        slug: "empty-admin-members",
        name: "Empty Admin Members",
        status: "active",
        timezone: "UTC",
        createdAt: new Date(),
      })
      .run();
    const platform = await json(
      await app.request("/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@tickercms.local", password: "Admin@12345" }),
      }),
    );
    platformToken = platform.token;
  });

  it("returns the requested organization's members for a platform JWT", async () => {
    const res = await app.request(`/v1/admin/organizations/${orgA}/memberships`, { headers: auth(platformToken) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(2);
    const owner = body.items.find((item: { email: string }) => item.email === "admin-members-a@example.com");
    const viewer = body.items.find((item: { email: string }) => item.email === "admin-members-a-viewer@example.com");
    expect(owner).toMatchObject({
      name: "Members Owner A",
      roleKey: "organization_owner",
      status: "active",
    });
    expect(viewer).toMatchObject({
      name: "Members Viewer A",
      roleKey: "viewer",
      status: "active",
    });
    expect(owner.id).toBeTruthy();
    expect(owner.userId).toBeTruthy();
    expect(viewer.roleKey).toBe("viewer");
  });

  it("scopes the member list to the requested organization", async () => {
    const res = await app.request(`/v1/admin/organizations/${orgA}/memberships`, { headers: auth(platformToken) });
    const body = await json(res);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("admin-members-b@example.com");
    expect(serialized).not.toContain("Members Owner B");
    expect(serialized).not.toContain(orgB);
    const other = await json(
      await app.request(`/v1/admin/organizations/${orgB}/memberships`, { headers: auth(platformToken) }),
    );
    expect(other.items).toHaveLength(1);
    expect(other.items[0].email).toBe("admin-members-b@example.com");
    expect(other.items[0].roleKey).toBe("organization_owner");
  });

  it("returns 404 for an unknown organization", async () => {
    const res = await app.request("/v1/admin/organizations/org_missing_members/memberships", {
      headers: auth(platformToken),
    });
    expect(res.status).toBe(404);
    expect((await json(res)).error.code).toBe("not_found");
  });

  it("rejects tenant JWT", async () => {
    const res = await app.request(`/v1/admin/organizations/${orgA}/memberships`, { headers: auth(tokenA) });
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe("forbidden");
  });

  it("rejects missing and invalid tokens", async () => {
    const missing = await app.request(`/v1/admin/organizations/${orgA}/memberships`);
    expect(missing.status).toBe(401);
    const invalid = await app.request(`/v1/admin/organizations/${orgA}/memberships`, {
      headers: { authorization: "Bearer not-a-token" },
    });
    expect(invalid.status).toBe(401);
  });

  it("returns an empty list for an organization with no members", async () => {
    const res = await app.request(`/v1/admin/organizations/${emptyOrgId}/memberships`, {
      headers: auth(platformToken),
    });
    expect(res.status).toBe(200);
    expect((await json(res)).items).toEqual([]);
  });

  it("does not expose credentials or secrets", async () => {
    const res = await app.request(`/v1/admin/organizations/${orgA}/memberships`, { headers: auth(platformToken) });
    const body = await json(res);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toMatch(/passwordHash/i);
    expect(serialized).not.toMatch(/token/i);
    expect(serialized).not.toMatch(/secret/i);
    expect(serialized).not.toContain("password12");
    for (const item of body.items) {
      expect(item).not.toHaveProperty("password");
      expect(item).not.toHaveProperty("passwordHash");
      expect(item).not.toHaveProperty("token");
    }
  });
});

describe("admin organization audit logs", () => {
  let platformToken = "";
  let tokenA = "";
  let orgA = "";
  let tokenB = "";
  let orgB = "";
  let tickerB = "";
  const emptyOrgId = "org_empty_admin_audit";
  const platformProbeId = "aud_platform_null_probe";

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const jsonHeaders = (token: string) => ({
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  });

  beforeAll(async () => {
    const a = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "admin-audit-a@example.com",
          password: "password12",
          name: "Audit Owner A",
          organizationName: "Audit Org Alpha",
        }),
      }),
    );
    const b = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "admin-audit-b@example.com",
          password: "password12",
          name: "Audit Owner B",
          organizationName: "Audit Org Beta",
        }),
      }),
    );
    tokenA = a.token;
    orgA = a.organizationId;
    tokenB = b.token;
    orgB = b.organizationId;
    tickerB = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: jsonHeaders(tokenB),
          body: JSON.stringify({ name: "Beta audit board", width: 620, height: 64, colorMode: "full" }),
        }),
      )
    ).id;
    db.insert(organizations)
      .values({
        id: emptyOrgId,
        slug: "empty-admin-audit",
        name: "Empty Admin Audit",
        status: "active",
        timezone: "UTC",
        createdAt: new Date(),
      })
      .run();
    db.insert(auditLogs)
      .values({
        id: platformProbeId,
        organizationId: null,
        actorUserId: null,
        action: "platform.probe",
        resourceType: "platform",
        resourceId: null,
        source: "human",
        payloadJson: "{}",
        createdAt: new Date(),
      })
      .run();
    const platform = await json(
      await app.request("/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@tickercms.local", password: "Admin@12345" }),
      }),
    );
    platformToken = platform.token;
  });

  it("returns organization audit events for a platform JWT including organization.status", async () => {
    const suspended = await app.request(`/v1/admin/organizations/${orgA}/status`, {
      method: "POST",
      headers: jsonHeaders(platformToken),
      body: JSON.stringify({ status: "suspended" }),
    });
    expect(suspended.status).toBe(200);
    const res = await app.request(`/v1/admin/organizations/${orgA}/audit-logs`, { headers: auth(platformToken) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items[0].action).toBe("organization.status");
    expect(JSON.parse(body.items[0].payloadJson)).toEqual({ status: "suspended" });
    expect(body.items.some((item: { action: string }) => item.action === "organization.created")).toBe(true);
    expect(body.items.every((item: { organizationId: string }) => item.organizationId === orgA)).toBe(true);
    await app.request(`/v1/admin/organizations/${orgA}/status`, {
      method: "POST",
      headers: jsonHeaders(platformToken),
      body: JSON.stringify({ status: "active" }),
    });
  });

  it("does not return another organization's events or platform-level null org events", async () => {
    const res = await app.request(`/v1/admin/organizations/${orgA}/audit-logs`, { headers: auth(platformToken) });
    const body = await json(res);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(orgB);
    expect(serialized).not.toContain(tickerB);
    expect(serialized).not.toContain("ticker.created");
    expect(serialized).not.toContain("platform.probe");
    expect(serialized).not.toContain(platformProbeId);
    expect(body.items.some((item: { organizationId: string | null }) => item.organizationId == null)).toBe(false);
    const other = await json(
      await app.request(`/v1/admin/organizations/${orgB}/audit-logs`, { headers: auth(platformToken) }),
    );
    expect(other.items.some((item: { action: string; resourceId: string }) => item.action === "ticker.created" && item.resourceId === tickerB)).toBe(true);
    expect(other.items.some((item: { action: string }) => item.action === "organization.status")).toBe(false);
  });

  it("returns 404 for an unknown organization", async () => {
    const res = await app.request("/v1/admin/organizations/org_missing_audit/audit-logs", {
      headers: auth(platformToken),
    });
    expect(res.status).toBe(404);
    expect((await json(res)).error.code).toBe("not_found");
  });

  it("rejects tenant JWT", async () => {
    const res = await app.request(`/v1/admin/organizations/${orgA}/audit-logs`, { headers: auth(tokenA) });
    expect(res.status).toBe(403);
    expect((await json(res)).error.code).toBe("forbidden");
  });

  it("rejects missing and invalid tokens", async () => {
    const missing = await app.request(`/v1/admin/organizations/${orgA}/audit-logs`);
    expect(missing.status).toBe(401);
    const invalid = await app.request(`/v1/admin/organizations/${orgA}/audit-logs`, {
      headers: { authorization: "Bearer not-a-token" },
    });
    expect(invalid.status).toBe(401);
  });

  it("returns an empty list when the organization has no audit records", async () => {
    const res = await app.request(`/v1/admin/organizations/${emptyOrgId}/audit-logs`, {
      headers: auth(platformToken),
    });
    expect(res.status).toBe(200);
    expect((await json(res)).items).toEqual([]);
  });

  it("does not expose credentials or secrets", async () => {
    const res = await app.request(`/v1/admin/organizations/${orgA}/audit-logs`, { headers: auth(platformToken) });
    const body = await json(res);
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toMatch(/passwordHash/i);
    expect(serialized).not.toContain("password12");
    expect(serialized).not.toMatch(/jwt/i);
    expect(serialized).not.toMatch(/secret/i);
    for (const item of body.items) {
      expect(item).not.toHaveProperty("password");
      expect(item).not.toHaveProperty("passwordHash");
      expect(item).not.toHaveProperty("token");
    }
  });
});

describe("admin organization publishing and deliveries", () => {
  let platformToken = "";
  let tokenA = "";
  let orgA = "";
  let tokenB = "";
  let orgB = "";
  let tickerA = "";
  let tickerB = "";
  let contentA = "";
  let contentB = "";
  let jobA = "";
  let versionA = "";
  let jobB = "";
  const emptyOrgId = "org_empty_admin_jobs";

  const auth = (token: string) => ({ authorization: `Bearer ${token}` });
  const jsonHeaders = (token: string) => ({
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
  });

  beforeAll(async () => {
    const a = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "admin-jobs-a@example.com",
          password: "password12",
          name: "Jobs Owner A",
          organizationName: "Jobs Org Alpha",
        }),
      }),
    );
    const b = await json(
      await app.request("/v1/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "admin-jobs-b@example.com",
          password: "password12",
          name: "Jobs Owner B",
          organizationName: "Jobs Org Beta",
        }),
      }),
    );
    tokenA = a.token;
    orgA = a.organizationId;
    tokenB = b.token;
    orgB = b.organizationId;
    tickerA = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: jsonHeaders(tokenA),
          body: JSON.stringify({ name: "Jobs board A", width: 620, height: 64, colorMode: "full" }),
        }),
      )
    ).id;
    tickerB = (
      await json(
        await app.request("/v1/tickers", {
          method: "POST",
          headers: jsonHeaders(tokenB),
          body: JSON.stringify({ name: "Jobs board B", width: 320, height: 32, colorMode: "full" }),
        }),
      )
    ).id;
    contentA = (
      await json(
        await app.request("/v1/contents", {
          method: "POST",
          headers: jsonHeaders(tokenA),
          body: JSON.stringify({ title: "Jobs content A" }),
        }),
      )
    ).id;
    contentB = (
      await json(
        await app.request("/v1/contents", {
          method: "POST",
          headers: jsonHeaders(tokenB),
          body: JSON.stringify({ title: "Jobs content B" }),
        }),
      )
    ).id;
    const pubA = await json(
      await app.request(`/v1/contents/${contentA}/publish`, {
        method: "POST",
        headers: jsonHeaders(tokenA),
        body: JSON.stringify({ tickerIds: [tickerA] }),
      }),
    );
    const pubB = await json(
      await app.request(`/v1/contents/${contentB}/publish`, {
        method: "POST",
        headers: jsonHeaders(tokenB),
        body: JSON.stringify({ tickerIds: [tickerB] }),
      }),
    );
    jobA = pubA.jobId;
    versionA = pubA.snapshot.version;
    jobB = pubB.jobId;
    db.insert(organizations)
      .values({
        id: emptyOrgId,
        slug: "empty-admin-jobs",
        name: "Empty Admin Jobs",
        status: "active",
        timezone: "UTC",
        createdAt: new Date(),
      })
      .run();
    const platform = await json(
      await app.request("/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "admin@tickercms.local", password: "Admin@12345" }),
      }),
    );
    platformToken = platform.token;
  });

  it("returns the requested organization's publishing jobs for a platform JWT", async () => {
    const res = await app.request(`/v1/admin/organizations/${orgA}/publishing-jobs`, { headers: auth(platformToken) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      id: jobA,
      contentId: contentA,
      versionId: versionA,
      status: "completed",
    });
    expect(body.items[0].createdAt).toBeTruthy();
    expect(body.items[0]).not.toHaveProperty("snapshotJson");
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(jobB);
    expect(serialized).not.toContain(contentB);
    expect(serialized).not.toContain(orgB);
  });

  it("returns 404/403/401 for publishing jobs as required", async () => {
    const missingOrg = await app.request("/v1/admin/organizations/org_missing_jobs/publishing-jobs", {
      headers: auth(platformToken),
    });
    expect(missingOrg.status).toBe(404);
    const tenant = await app.request(`/v1/admin/organizations/${orgA}/publishing-jobs`, { headers: auth(tokenA) });
    expect(tenant.status).toBe(403);
    const missingToken = await app.request(`/v1/admin/organizations/${orgA}/publishing-jobs`);
    expect(missingToken.status).toBe(401);
    const invalidToken = await app.request(`/v1/admin/organizations/${orgA}/publishing-jobs`, {
      headers: { authorization: "Bearer not-a-token" },
    });
    expect(invalidToken.status).toBe(401);
  });

  it("returns an empty publishing job list when the organization has none", async () => {
    const res = await app.request(`/v1/admin/organizations/${emptyOrgId}/publishing-jobs`, {
      headers: auth(platformToken),
    });
    expect(res.status).toBe(200);
    expect((await json(res)).items).toEqual([]);
  });

  it("returns the requested organization's deliveries for a platform JWT", async () => {
    const res = await app.request(`/v1/admin/organizations/${orgA}/deliveries`, { headers: auth(platformToken) });
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({
      jobId: jobA,
      tickerId: tickerA,
      snapshotVersion: versionA,
      status: "pending",
    });
    expect(body.items[0].id).toBeTruthy();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(jobB);
    expect(serialized).not.toContain(tickerB);
    expect(serialized).not.toContain(orgB);
    const other = await json(
      await app.request(`/v1/admin/organizations/${orgB}/deliveries`, { headers: auth(platformToken) }),
    );
    expect(other.items).toHaveLength(1);
    expect(other.items[0].tickerId).toBe(tickerB);
    expect(other.items[0].jobId).toBe(jobB);
  });

  it("returns 404/403/401 for deliveries as required", async () => {
    const missingOrg = await app.request("/v1/admin/organizations/org_missing_deliveries/deliveries", {
      headers: auth(platformToken),
    });
    expect(missingOrg.status).toBe(404);
    const tenant = await app.request(`/v1/admin/organizations/${orgA}/deliveries`, { headers: auth(tokenA) });
    expect(tenant.status).toBe(403);
    const missingToken = await app.request(`/v1/admin/organizations/${orgA}/deliveries`);
    expect(missingToken.status).toBe(401);
    const invalidToken = await app.request(`/v1/admin/organizations/${orgA}/deliveries`, {
      headers: { authorization: "Bearer not-a-token" },
    });
    expect(invalidToken.status).toBe(401);
  });

  it("returns an empty delivery list when the organization has none", async () => {
    const res = await app.request(`/v1/admin/organizations/${emptyOrgId}/deliveries`, {
      headers: auth(platformToken),
    });
    expect(res.status).toBe(200);
    expect((await json(res)).items).toEqual([]);
  });

  it("does not expose credentials, secrets, or composition snapshots", async () => {
    const jobs = await json(
      await app.request(`/v1/admin/organizations/${orgA}/publishing-jobs`, { headers: auth(platformToken) }),
    );
    const deliveries = await json(
      await app.request(`/v1/admin/organizations/${orgA}/deliveries`, { headers: auth(platformToken) }),
    );
    const serialized = JSON.stringify({ jobs, deliveries });
    expect(serialized).not.toMatch(/password/i);
    expect(serialized).not.toMatch(/passwordHash/i);
    expect(serialized).not.toContain("password12");
    expect(serialized).not.toMatch(/jwt/i);
    expect(serialized).not.toMatch(/secret/i);
    expect(serialized).not.toMatch(/snapshotJson/);
    expect(serialized).not.toMatch(/document/);
    for (const item of [...jobs.items, ...deliveries.items]) {
      expect(item).not.toHaveProperty("password");
      expect(item).not.toHaveProperty("token");
      expect(item).not.toHaveProperty("snapshotJson");
    }
  });
});


