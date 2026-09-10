import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  compositionFromPlayback,
  errorView,
  fetchPlayback,
  interpretPlayback,
  playbackRequestPath,
  readStoredToken,
  readTickerId,
  referencedAssetIds,
  type PlaybackResponse,
} from "./playback";

const sampleDoc = {
  schemaVersion: "1" as const,
  profile: { width: 100, height: 10, colorMode: "mono" as const },
  layers: [
    { id: "bg", type: "fill" as const, zIndex: 0, props: { color: "#000" } },
    { id: "img", type: "image" as const, assetId: "ast_img", x: 0, y: 0, width: 16, height: 16 },
    { id: "lot", type: "lottie" as const, assetId: "ast_lot", x: 16, y: 0, width: 16, height: 16 },
  ],
};

function playback(partial: Partial<PlaybackResponse> = {}): PlaybackResponse {
  return {
    ticker: { id: "tkr_1", width: 620, height: 64, colorMode: "full" },
    source: "published",
    contentId: "cnt_1",
    versionId: "ver_1",
    campaignId: null,
    campaignName: null,
    document: sampleDoc,
    ...partial,
  };
}

describe("ticker identification", () => {
  it("requires a tickerId query parameter", () => {
    expect(readTickerId("")).toBeNull();
    expect(readTickerId("?foo=bar")).toBeNull();
    expect(readTickerId("?tickerId=")).toBeNull();
    expect(readTickerId("?tickerId=tkr_123")).toBe("tkr_123");
  });
});

describe("playback request", () => {
  it("requests playback using tickerId", async () => {
    const urls: string[] = [];
    const result = await fetchPlayback("tkr_abc", {
      token: "tok",
      fetch: async (url, init) => {
        urls.push(url);
        expect((init?.headers as Headers).get("authorization")).toBe("Bearer tok");
        return new Response(JSON.stringify(playback()), { status: 200 });
      },
    });
    expect(playbackRequestPath("tkr_abc")).toBe("/v1/playback/tickers/tkr_abc");
    expect(urls).toEqual(["/v1/playback/tickers/tkr_abc"]);
    expect(result.status).toBe(200);
  });
});

describe("playback documents", () => {
  it("accepts a published document and uses the ticker profile", () => {
    const view = interpretPlayback(playback({ source: "published" }));
    expect(view.kind).toBe("ready");
    if (view.kind !== "ready") return;
    expect(view.source).toBe("published");
    expect(view.document.profile).toEqual({ width: 620, height: 64, colorMode: "full" });
    expect(view.document.layers).toEqual(sampleDoc.layers);
  });

  it("accepts a campaign document", () => {
    const view = interpretPlayback(
      playback({ source: "campaign", campaignId: "cmp_1", campaignName: "Lobby", versionId: "ver_camp" }),
    );
    expect(view.kind).toBe("ready");
    if (view.kind !== "ready") return;
    expect(view.source).toBe("campaign");
    expect(view.versionId).toBe("ver_camp");
  });

  it("produces an empty state without a composition", () => {
    const view = interpretPlayback(playback({ source: "empty", document: null, versionId: null, contentId: null }));
    expect(view).toEqual({ kind: "empty", ticker: { id: "tkr_1", width: 620, height: 64, colorMode: "full" } });
    expect(compositionFromPlayback(playback({ source: "empty", document: null }))).toBeNull();
  });

  it("maps API errors to error state", () => {
    expect(errorView(401).kind).toBe("error");
    expect(errorView(404).message).toMatch(/not found/i);
    expect(errorView(500, "Server exploded")).toMatchObject({ kind: "error", message: "Server exploded", status: 500 });
  });
});

describe("player architecture", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "main.tsx"), "utf8");
  const vite = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../vite.config.ts"), "utf8");

  it("does not call createDemoDocument", () => {
    expect(src).not.toContain("createDemoDocument");
  });

  it("uses shared renderFrame", () => {
    expect(src).toContain("renderFrame");
    expect(src).toContain('@ticker-cms/composition');
  });

  it("builds static assets under /player/ and still requests origin-root /v1 playback", () => {
    expect(vite).toContain('command === "build" ? "/player/" : "/"');
    expect(playbackRequestPath("tkr_1")).toBe("/v1/playback/tickers/tkr_1");
  });

  it("loads assetId references through the existing asset system", () => {
    expect(referencedAssetIds(sampleDoc)).toEqual({ images: ["ast_img"], lottie: ["ast_lot"] });
    expect(src).toContain("AssetMediaSession");
    expect(src).toContain("loadReferencedMedia");
    expect(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "loadMedia.ts"), "utf8")).toContain(
      "session.loadImage",
    );
    expect(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "loadMedia.ts"), "utf8")).toContain(
      "session.loadLottie",
    );
  });
});

describe("token storage", () => {
  it("reads the tenant JWT key and does not invent a token", () => {
    expect(readStoredToken({ getItem: () => null })).toBeNull();
    expect(readStoredToken({ getItem: (key) => (key === "ticker_cms_token" ? "abc" : null) })).toBe("abc");
  });
});
