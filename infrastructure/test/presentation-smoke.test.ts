import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assertHealthPayload,
  checkHealth,
  checkLoginReturnsJson,
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
