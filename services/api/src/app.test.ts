import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "ticker-cms-"));
process.env.TICKER_DATA_DIR = dir;
process.env.JWT_SECRET = "test-secret";

const { migrate } = await import("./db.js");
const { seedCatalog } = await import("./seed.js");
const { createApp } = await import("./app.js");

migrate();
seedCatalog();
const app = createApp();

async function json(res: Response) {
  return res.json() as Promise<any>;
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
});
