import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, onSessionInvalidated, setToken, token } from "./api.js";

function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

describe("customer api session handling", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memoryStorage(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears the customer token on an authenticated 401", async () => {
    setToken("expired.jwt");
    const invalidated = vi.fn();
    const stop = onSessionInvalidated(invalidated);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: "unauthorized", message: "Invalid token." } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(api("/v1/tickers")).rejects.toMatchObject({ status: 401 });
    expect(token()).toBeNull();
    expect(invalidated).toHaveBeenCalledTimes(1);
    stop();
  });

  it("keeps login 401 errors without treating them as session expiry", async () => {
    setToken("leftover.jwt");
    const invalidated = vi.fn();
    const stop = onSessionInvalidated(invalidated);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: "invalid_credentials", message: "Email or password is incorrect." } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(api("/v1/auth/login", { method: "POST", body: "{}" })).rejects.toMatchObject({
      status: 401,
      code: "invalid_credentials",
    });
    expect(token()).toBe("leftover.jwt");
    expect(invalidated).not.toHaveBeenCalled();
    stop();
  });

  it("does not log out on 403", async () => {
    setToken("tenant.jwt");
    const invalidated = vi.fn();
    const stop = onSessionInvalidated(invalidated);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: "forbidden", message: "Not allowed." } }), {
          status: 403,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    await expect(api("/v1/tickers")).rejects.toMatchObject({ status: 403 });
    expect(token()).toBe("tenant.jwt");
    expect(invalidated).not.toHaveBeenCalled();
    stop();
  });

  it("does not force JSON content-type on multipart uploads", async () => {
    setToken("tenant.jwt");
    const form = new FormData();
    form.append("file", new Blob(["x"]), "x.png");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("content-type")).toBeNull();
        expect(headers.get("authorization")).toBe("Bearer tenant.jwt");
        return new Response(JSON.stringify({ id: "ast_1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    await expect(api("/v1/assets", { method: "POST", body: form })).resolves.toEqual({ id: "ast_1" });
  });
});
