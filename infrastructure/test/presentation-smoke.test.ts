import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertHealthPayload,
  assertPlayerHtml,
  checkHealth,
  checkLoginReturnsJson,
  checkPlayerSurface,
  looksLikeHtml,
  parseApiJson,
} from "../lib/presentation-smoke";

test("rejects HTML SPA fallback as a failed API response", () => {
  assert.equal(looksLikeHtml("<!DOCTYPE html><html></html>", "text/html"), true);
  assert.throws(() => parseApiJson("<!DOCTYPE html><html><body>login</body></html>", "text/html; charset=utf-8"), /HTML/);
});

test("accepts the real API health JSON", () => {
  const payload = parseApiJson('{"ok":true,"service":"ticker-cms-api"}', "application/json");
  assertHealthPayload(payload);
});

test("health check uses JSON, not HTTP 200 HTML", async () => {
  await assert.rejects(
    () =>
      checkHealth("https://example.cloudfront.net", async () => {
        return new Response("<!DOCTYPE html><html><body>ok</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }),
    /HTML/,
  );
  await checkHealth("https://api.example", async () => {
    return new Response(JSON.stringify({ ok: true, service: "ticker-cms-api" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
});

test("login smoke check accepts JSON errors and rejects index.html", async () => {
  await checkLoginReturnsJson("https://customer.example", async () => {
    return new Response(JSON.stringify({ error: { code: "invalid_credentials" } }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  });
  await assert.rejects(
    () =>
      checkLoginReturnsJson("https://customer.example", async () => {
        return new Response("<!DOCTYPE html><html><body>Unexpected token</body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }),
    /HTML/,
  );
});

test("player HTML must be the Player app, not the Customer SPA", () => {
  const assets = assertPlayerHtml(
    `<!doctype html><html><head><title>Ticker Player</title><script type="module" crossorigin src="/player/assets/index-abc.js"></script><link rel="stylesheet" crossorigin href="/player/assets/index-abc.css"></head></html>`,
    "text/html",
  );
  assert.deepEqual(assets, ["/player/assets/index-abc.js", "/player/assets/index-abc.css"]);
  assert.throws(
    () =>
      assertPlayerHtml(
        `<!doctype html><html><head><title>Photonplay</title><script type="module" src="/assets/index-web.js"></script></head></html>`,
        "text/html",
      ),
    /Customer SPA/,
  );
});

test("player smoke fetches HTML then a /player/assets file, without login", async () => {
  const seen: string[] = [];
  await checkPlayerSurface("https://customer.example", async (url) => {
    seen.push(url);
    if (url.endsWith("/player/")) {
      return new Response(
        `<!doctype html><html><head><title>Ticker Player</title><script type="module" src="/player/assets/index-abc.js"></script></head></html>`,
        { status: 200, headers: { "content-type": "text/html" } },
      );
    }
    if (url.endsWith("/player/assets/index-abc.js")) {
      return new Response("console.log('player');", {
        status: 200,
        headers: { "content-type": "text/javascript" },
      });
    }
    return new Response("missing", { status: 404 });
  });
  assert.deepEqual(seen, ["https://customer.example/player/", "https://customer.example/player/assets/index-abc.js"]);
});
