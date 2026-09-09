import { describe, expect, it } from "vitest";
import { shouldInvalidateSession } from "./session.js";
import {
  CUSTOMER_ASSISTANT_SAFE_PADDING_PX,
  TICKER_CONTENT_UNAVAILABLE,
  TICKER_CREATE_ERROR,
  TICKER_DETAIL_ERROR_MESSAGE,
  TICKER_DETAIL_LOADING_MESSAGE,
  TICKER_FORM_DEFAULTS,
  TICKER_NO_CONTENT,
  TICKER_SAVE_ERROR,
  TICKER_SAVE_SUCCESS,
  TICKERS_ERROR_MESSAGE,
  TICKERS_LOADING_MESSAGE,
  colorModeLabel,
  createdTickerHref,
  displayProfileLabel,
  isPlaybackUnavailableError,
  needsAssistantSafeSpace,
  tickerContentLabel,
  tickerCreateBody,
  tickerDetailPageState,
  tickerListRows,
  tickerPatchBody,
  tickerStatusLabel,
  tickerSubmitLabel,
  tickersPageState,
  validateTickerProfile,
  type TickerRecord,
} from "./tickerData.js";

const lobby: TickerRecord = {
  id: "tkr_1",
  name: "Lobby ticker",
  width: 620,
  height: 64,
  colorMode: "full",
  status: "active",
  online: true,
  lastHeartbeatAt: "2026-09-09T10:02:14.459Z",
};

const concourse: TickerRecord = {
  id: "tkr_2",
  name: "Concourse ticker",
  width: 128,
  height: 32,
  colorMode: "mono",
  status: "suspended",
  online: false,
};

const spare: TickerRecord = {
  id: "tkr_3",
  name: "Spare ticker",
  width: 993,
  height: 32,
  colorMode: "rg",
  status: "active",
  online: false,
};

describe("add ticker form", () => {
  it("keeps existing create defaults", () => {
    expect(TICKER_FORM_DEFAULTS).toEqual({ name: "", width: 620, height: 64, colorMode: "full" });
  });

  it("accepts a valid ticker profile for create and patch", () => {
    const result = validateTickerProfile({
      name: "  Lobby ticker  ",
      width: 620,
      height: 64,
      colorMode: "full",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(tickerCreateBody(result.values)).toEqual({
      name: "Lobby ticker",
      width: 620,
      height: 64,
      colorMode: "full",
    });
    expect(tickerPatchBody(result.values)).toEqual(tickerCreateBody(result.values));
    expect(createdTickerHref("tkr_9")).toBe("/tickers/tkr_9");
  });

  it("rejects an empty name without inventing one", () => {
    const result = validateTickerProfile({ ...TICKER_FORM_DEFAULTS, name: "   " });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.name).toBe("Enter a ticker name.");
  });

  it("rejects a non-positive width", () => {
    const result = validateTickerProfile({ ...TICKER_FORM_DEFAULTS, name: "Lobby", width: 0 });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.width).toBe("Width must be a positive number.");
  });

  it("rejects a non-positive height", () => {
    const result = validateTickerProfile({ ...TICKER_FORM_DEFAULTS, name: "Lobby", height: -4 });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.height).toBe("Height must be a positive number.");
  });

  it("rejects an invalid color mode", () => {
    const result = validateTickerProfile({ ...TICKER_FORM_DEFAULTS, name: "Lobby", colorMode: "rgb" });
    expect(result.ok).toBe(false);
    expect(result.fieldErrors.colorMode).toBe("Select a valid color mode.");
  });

  it("uses submitting labels while create or save is in progress", () => {
    expect(tickerSubmitLabel("create", false)).toBe("Add ticker");
    expect(tickerSubmitLabel("create", true)).toBe("Adding…");
    expect(tickerSubmitLabel("save", false)).toBe("Save");
    expect(tickerSubmitLabel("save", true)).toBe("Saving…");
  });

  it("keeps success navigation on the created ticker", () => {
    const created = { id: "tkr_new", name: "Lobby ticker", width: 620, height: 64, colorMode: "full" };
    expect(createdTickerHref(created.id)).toBe("/tickers/tkr_new");
  });

  it("uses a generic create failure message when the API does not succeed", () => {
    expect(TICKER_CREATE_ERROR).toBe("Unable to add ticker.");
  });
});

describe("ticker list presentation", () => {
  it("renders a successful list with real names and profiles", () => {
    const rows = tickerListRows([lobby, concourse], {
      tkr_1: {
        available: true,
        playback: { source: "campaign", campaignName: "Lobby campaign", document: { layers: [] } },
      },
      tkr_2: { available: true, playback: { source: "empty", document: null } },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      name: "Lobby ticker",
      href: "/tickers/tkr_1",
      profile: "620 × 64 px",
      colorMode: "Full color",
      statusLabel: "Active",
      contentLabel: "Lobby campaign",
    });
    expect(rows[1]?.contentLabel).toBe(TICKER_NO_CONTENT);
  });

  it("formats multiple color modes without exposing raw internal values as the only label", () => {
    expect(colorModeLabel("full")).toBe("Full color");
    expect(colorModeLabel("mono")).toBe("Monochrome");
    expect(colorModeLabel("rg")).toBe("Red-green");
  });

  it("treats ticker status as administrative, never online/offline", () => {
    expect(tickerStatusLabel("active")).toBe("Active");
    expect(tickerStatusLabel("suspended")).toBe("Suspended");
    const rows = tickerListRows([lobby, concourse], {
      tkr_1: { available: true, playback: { source: "empty" } },
      tkr_2: { available: true, playback: { source: "empty" } },
    });
    expect(rows.map((row) => row.statusLabel)).toEqual(["Active", "Suspended"]);
    expect(rows.some((row) => /online|offline/i.test(row.statusLabel))).toBe(false);
    expect(displayProfileLabel(lobby.width, lobby.height)).toBe("620 × 64 px");
  });

  it("does not invent content when playback is unavailable", () => {
    expect(tickerContentLabel({ source: "campaign", campaignName: "Lobby campaign" }, false)).toBe(
      TICKER_CONTENT_UNAVAILABLE,
    );
  });
});

describe("tickers page states", () => {
  it("shows a zero-ticker empty state after a successful load", () => {
    const page = tickersPageState({ loading: false, error: null, items: [] });
    expect(page).toEqual({ kind: "ready", total: 0, empty: true, rows: [] });
  });

  it("keeps loading distinct from an empty list", () => {
    expect(tickersPageState({ loading: true, error: null, items: null })).toEqual({
      kind: "loading",
      message: TICKERS_LOADING_MESSAGE,
    });
  });

  it("surfaces an API error instead of an empty list", () => {
    expect(tickersPageState({ loading: false, error: "Request failed.", items: null })).toEqual({
      kind: "error",
      message: "Request failed.",
    });
    expect(tickersPageState({ loading: false, error: null, items: null })).toMatchObject({
      kind: "error",
      message: TICKERS_ERROR_MESSAGE,
    });
  });
});

describe("ticker detail helpers", () => {
  it("shows loading and error states without fake device fields", () => {
    expect(tickerDetailPageState({ loading: true, error: null, row: null })).toEqual({
      kind: "loading",
      message: TICKER_DETAIL_LOADING_MESSAGE,
    });
    expect(tickerDetailPageState({ loading: false, error: null, row: null })).toEqual({
      kind: "error",
      message: TICKER_DETAIL_ERROR_MESSAGE,
    });
  });

  it("shows profile editing values from the ticker record", () => {
    const page = tickerDetailPageState({ loading: false, error: null, row: lobby });
    expect(page.kind).toBe("ready");
    if (page.kind !== "ready") return;
    expect(page.view.profile).toBe("620 × 64 px");
    expect(page.view.colorMode).toBe("Full color");
    expect(page.view.statusLabel).toBe("Active");
  });

  it("uses save success and failure copy without blocking toasts", () => {
    expect(TICKER_SAVE_SUCCESS).toBe("Display configuration saved.");
    expect(TICKER_SAVE_ERROR).toBe("Unable to save display configuration.");
  });

  it("shows campaign playback from the playback payload", () => {
    const page = tickerDetailPageState({
      loading: false,
      error: null,
      row: lobby,
      playback: {
        available: true,
        playback: { source: "campaign", campaignName: "Lobby campaign", document: { layers: [] } },
      },
    });
    expect(page.kind).toBe("ready");
    if (page.kind !== "ready") return;
    expect(page.view.contentLabel).toBe("Lobby campaign");
    expect(page.view.previewEmpty).toBe(false);
    expect(page.view.document).toEqual({ layers: [] });
  });

  it("shows published-content playback", () => {
    const page = tickerDetailPageState({
      loading: false,
      error: null,
      row: lobby,
      playback: { available: true, playback: { source: "published", document: { layers: [] } } },
    });
    expect(page.kind).toBe("ready");
    if (page.kind !== "ready") return;
    expect(page.view.contentLabel).toBe("Published content");
    expect(page.view.previewEmpty).toBe(false);
  });

  it("shows an honest empty playback state without a fake composition", () => {
    const page = tickerDetailPageState({
      loading: false,
      error: null,
      row: spare,
      playback: { available: true, playback: { source: "empty", document: null } },
    });
    expect(page.kind).toBe("ready");
    if (page.kind !== "ready") return;
    expect(page.view.contentLabel).toBe(TICKER_NO_CONTENT);
    expect(page.view.previewEmpty).toBe(true);
    expect(page.view.document).toBeNull();
    expect(page.view.previewMessage).not.toMatch(/your message here/i);
  });

  it("does not interpret heartbeat online flags as connectivity status", () => {
    const page = tickerDetailPageState({
      loading: false,
      error: null,
      row: { ...lobby, online: true },
      playback: { available: true, playback: { source: "empty" } },
    });
    expect(page.kind).toBe("ready");
    if (page.kind !== "ready") return;
    expect(page.view.statusLabel).toBe("Active");
    expect(`${page.view.statusLabel} ${page.view.contentLabel}`).not.toMatch(/online|offline/i);
  });
});

describe("mobile layout helpers", () => {
  it("reserves assistant-safe space on compact viewports", () => {
    expect(needsAssistantSafeSpace(390)).toBe(true);
    expect(needsAssistantSafeSpace(1440)).toBe(false);
    expect(CUSTOMER_ASSISTANT_SAFE_PADDING_PX).toBeGreaterThanOrEqual(72);
  });
});

describe("ticker API session behavior", () => {
  it("logs out on authenticated 401 through the existing API layer, not 403", () => {
    expect(shouldInvalidateSession("/v1/tickers", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/playback/tickers/tkr_1", 401)).toBe(true);
    expect(shouldInvalidateSession("/v1/tickers", 403)).toBe(false);
    expect(isPlaybackUnavailableError({ status: 500 })).toBe(true);
    expect(isPlaybackUnavailableError({ status: 401 })).toBe(false);
  });
});
