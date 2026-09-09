import { describe, expect, it } from "vitest";
import { AssetLoadError, fetchAssetContent, parseLottieJson } from "./assetClient.js";

describe("parseLottieJson", () => {
  it("loads a JSON object", () => {
    const json = parseLottieJson(JSON.stringify({ v: "5.7.4", fr: 30, layers: [] }));
    expect(json.v).toBe("5.7.4");
    expect(json.layers).toEqual([]);
  });

  it("rejects invalid JSON", () => {
    expect(() => parseLottieJson("{nope")).toThrow(AssetLoadError);
  });
});

describe("fetchAssetContent", () => {
  it("returns bytes from a successful response", async () => {
    const bytes = new Uint8Array([1, 2, 3]).buffer;
    const result = await fetchAssetContent("ast_1", {
      token: "tok",
      fetch: async (url, init) => {
        expect(url).toBe("/v1/assets/ast_1/content");
        expect((init?.headers as Headers).get("authorization")).toBe("Bearer tok");
        return new Response(bytes, { status: 200, headers: { "content-type": "image/png" } });
      },
    });
    expect(result.contentType).toBe("image/png");
    expect(new Uint8Array(result.buffer)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("handles HTTP failure", async () => {
    await expect(
      fetchAssetContent("missing", {
        token: null,
        fetch: async () => new Response("nope", { status: 404 }),
      }),
    ).rejects.toMatchObject({ name: "AssetLoadError", status: 404 });
  });
});
