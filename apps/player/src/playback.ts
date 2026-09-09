import { COLOR_MODES, type ColorMode, type CompositionDocument } from "@ticker-cms/composition";
import { invokeFetch, type FetchLike } from "../../web/src/media/assetClient";

export const TOKEN_KEY = "ticker_cms_token";
export const PLAYBACK_POLL_MS = 20_000;

export type PlaybackTicker = {
  id: string;
  width: number;
  height: number;
  colorMode: string;
};

export type PlaybackResponse = {
  ticker: PlaybackTicker;
  source: "campaign" | "published" | "empty";
  contentId: string | null;
  versionId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  document: CompositionDocument | null;
};

export type PlayerView =
  | { kind: "need_ticker" }
  | { kind: "need_auth" }
  | { kind: "loading" }
  | { kind: "empty"; ticker: PlaybackTicker }
  | { kind: "ready"; ticker: PlaybackTicker; document: CompositionDocument; source: "campaign" | "published"; versionId: string | null }
  | { kind: "error"; message: string; status?: number };

export function readTickerId(search: string): string | null {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const value = new URLSearchParams(query).get("tickerId")?.trim() ?? "";
  return value || null;
}

export function playbackRequestPath(tickerId: string): string {
  return `/v1/playback/tickers/${encodeURIComponent(tickerId)}`;
}

export function readStoredToken(storage: { getItem(key: string): string | null }): string | null {
  return storage.getItem(TOKEN_KEY);
}

export function tickerColorMode(value: string): ColorMode {
  return (COLOR_MODES as readonly string[]).includes(value) ? (value as ColorMode) : "full";
}

export function compositionFromPlayback(response: PlaybackResponse): CompositionDocument | null {
  if (response.source === "empty" || !response.document) return null;
  return {
    ...response.document,
    profile: {
      width: response.ticker.width,
      height: response.ticker.height,
      colorMode: tickerColorMode(response.ticker.colorMode),
    },
  };
}

export function playbackIdentity(response: PlaybackResponse): string {
  return [
    response.source,
    response.versionId ?? "",
    response.campaignId ?? "",
    response.ticker.width,
    response.ticker.height,
    response.ticker.colorMode,
  ].join(":");
}

export function referencedAssetIds(doc: CompositionDocument): { images: string[]; lottie: string[] } {
  const images: string[] = [];
  const lottie: string[] = [];
  for (const layer of doc.layers) {
    if (layer.type === "image" && layer.assetId) images.push(layer.assetId);
    if (layer.type === "lottie" && layer.assetId) lottie.push(layer.assetId);
  }
  return { images: [...new Set(images)], lottie: [...new Set(lottie)] };
}

export function interpretPlayback(response: PlaybackResponse): PlayerView {
  const document = compositionFromPlayback(response);
  if (!document) return { kind: "empty", ticker: response.ticker };
  if (response.source !== "campaign" && response.source !== "published") {
    return { kind: "empty", ticker: response.ticker };
  }
  return {
    kind: "ready",
    ticker: response.ticker,
    document,
    source: response.source,
    versionId: response.versionId,
  };
}

export function errorView(status: number, message?: string): PlayerView {
  if (status === 401) {
    return {
      kind: "error",
      status,
      message: "Sign in to Ticker CMS, then store the tenant session token as ticker_cms_token for this player origin.",
    };
  }
  if (status === 404) {
    return { kind: "error", status, message: message || "Ticker not found." };
  }
  return { kind: "error", status, message: message || "Playback failed." };
}

export async function fetchPlayback(
  tickerId: string,
  deps: { fetch: FetchLike; token: string },
): Promise<{ status: number; body: PlaybackResponse | { error?: { message?: string } } }> {
  const headers = new Headers();
  headers.set("authorization", `Bearer ${deps.token}`);
  const res = await invokeFetch(deps.fetch, playbackRequestPath(tickerId), { headers });
  const body = (await res.json().catch(() => ({}))) as PlaybackResponse | { error?: { message?: string } };
  return { status: res.status, body };
}
