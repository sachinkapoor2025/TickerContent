import { describe, expect, it } from "vitest";
import {
  CONNECTIVITY_NOTE,
  DASHBOARD_ERROR_MESSAGE,
  DASHBOARD_LOADING_MESSAGE,
  DISPLAY_STATUS_VALUE,
  JOBS_EMPTY,
  NOW_PLAYING_EMPTY,
  NOW_PLAYING_STORAGE_PREFIX,
  dashboardPageState,
  dashboardTickerOptions,
  dashboardView,
  formatDashboardWhen,
  isNowPlayingEmpty,
  nowPlayingPlaybackPath,
  nowPlayingStorageKey,
  readPersistedNowPlayingTickerId,
  resolveNowPlayingTickerId,
  writePersistedNowPlayingTickerId,
  type DashboardResponse,
} from "./dashboardData.js";

const playingDocument = { schemaVersion: 1, profile: { width: 620, height: 64, colorMode: "full" }, layers: [] };

function populatedDashboard(): DashboardResponse {
  return {
    totals: { tickers: 4, online: 2, offline: 2, campaigns: 3 },
    entitlements: { status: "active", restricted: false },
    preview: {
      source: "campaign",
      campaignId: "cmp_1",
      campaignName: "Lobby promo",
      contentId: "cnt_1",
      publishedVersionId: "ver_1",
      document: playingDocument,
    },
    tickers: [{ id: "tkr_1", name: "Lobby ticker" }],
    recentJobs: [
      {
        id: "job_1",
        status: "completed",
        createdAt: "2026-01-15T12:00:00.000Z",
        contentId: "cnt_1",
        trigger: "manual",
      },
    ],
  };
}

describe("dashboard KPIs", () => {
  it("shows ticker counts without a campaigns KPI", () => {
    const view = dashboardView(populatedDashboard());
    expect(view.kpis).toEqual([
      { id: "tickers", label: "Tickers", value: "4" },
      { id: "display-status", label: "Display status", value: DISPLAY_STATUS_VALUE },
    ]);
    expect(view.kpis.some((kpi) => /campaign/i.test(kpi.label) || kpi.id === "campaigns")).toBe(false);
  });

  it("does not present heartbeat online/offline as connectivity KPIs", () => {
    const view = dashboardView(populatedDashboard());
    const labels = view.kpis.map((kpi) => kpi.label.toLowerCase());
    expect(labels.some((label) => label.includes("online") || label.includes("offline"))).toBe(false);
    expect(view.kpis.some((kpi) => kpi.value === "2")).toBe(false);
    expect(view.kpis.find((kpi) => kpi.id === "display-status")?.value).toBe("Not available");
    expect(view.connectivityNote).toBe(CONNECTIVITY_NOTE);
  });

  it("shows an empty ticker count without inventing devices", () => {
    const view = dashboardView({
      totals: { tickers: 0, online: 0, offline: 0, campaigns: 2 },
      tickers: [],
    });
    expect(view.kpis.find((kpi) => kpi.id === "tickers")?.value).toBe("0");
  });

  it("does not surface campaign counts on the customer dashboard", () => {
    const view = dashboardView({
      totals: { tickers: 2, online: 0, offline: 2, campaigns: 0 },
    });
    expect(view.kpis.find((kpi) => kpi.id === "tickers")?.value).toBe("2");
    expect(view.kpis.some((kpi) => kpi.id === "campaigns" || /campaign/i.test(kpi.label))).toBe(false);
  });
});

describe("now playing", () => {
  it("keeps a real composition document and caption", () => {
    const view = dashboardView(populatedDashboard());
    expect(view.nowPlayingEmpty).toBe(false);
    expect(view.nowPlayingDocument).toBe(playingDocument);
    expect(view.nowPlayingCaption).toBe("Lobby ticker · Lobby promo");
  });

  it("uses an honest empty state when nothing is playing", () => {
    const view = dashboardView({
      totals: { tickers: 1, campaigns: 0 },
      preview: {
        source: "empty",
        campaignId: null,
        campaignName: null,
        document: null,
      },
      tickers: [{ id: "tkr_1", name: "Lobby ticker" }],
    });
    expect(isNowPlayingEmpty({ source: "empty", document: null })).toBe(true);
    expect(view.nowPlayingEmpty).toBe(true);
    expect(view.nowPlayingDocument).toBeNull();
    expect(view.nowPlayingCaption).toBe("");
    expect(view.nowPlayingEmptyMessage).toBe(NOW_PLAYING_EMPTY);
  });

  it("does not treat a missing preview as playback", () => {
    const view = dashboardView({ totals: { tickers: 0, campaigns: 0 } });
    expect(view.nowPlayingEmpty).toBe(true);
    expect(view.nowPlayingDocument).toBeNull();
  });
});

describe("recent publishing activity", () => {
  it("maps only fields returned by recentJobs", () => {
    const view = dashboardView(populatedDashboard());
    expect(view.jobs).toEqual([
      {
        id: "job_1",
        when: formatDashboardWhen("2026-01-15T12:00:00.000Z"),
        status: "completed",
        contentId: "cnt_1",
        trigger: "manual",
      },
    ]);
  });

  it("shows an empty publishing activity state when there are no jobs", () => {
    const view = dashboardView({ totals: { tickers: 1, campaigns: 0 }, recentJobs: [] });
    expect(view.jobs).toEqual([]);
    expect(view.jobsEmptyMessage).toBe(JOBS_EMPTY);
  });
});

describe("dashboard page states", () => {
  it("keeps loading distinct from missing data", () => {
    expect(dashboardPageState({ loading: true, error: null, data: null })).toEqual({
      kind: "loading",
      message: DASHBOARD_LOADING_MESSAGE,
    });
  });

  it("surfaces an error instead of looking like a load", () => {
    expect(
      dashboardPageState({ loading: false, error: "Request failed.", data: null }),
    ).toEqual({
      kind: "error",
      message: "Request failed.",
    });
    expect(dashboardPageState({ loading: false, error: null, data: null })).toEqual({
      kind: "error",
      message: DASHBOARD_ERROR_MESSAGE,
    });
  });

  it("renders a ready view from dashboard data", () => {
    const page = dashboardPageState({ loading: false, error: null, data: populatedDashboard() });
    expect(page.kind).toBe("ready");
    if (page.kind !== "ready") return;
    expect(page.view.kpis[0]?.value).toBe("4");
  });
});

describe("timestamp presentation", () => {
  it("does not invent timestamps for unparseable values", () => {
    expect(formatDashboardWhen(null)).toBe("—");
    expect(formatDashboardWhen("not-a-date")).toBe("—");
    expect(formatDashboardWhen("2026-01-15T12:00:00.000Z")).not.toBe("—");
  });
});

function memoryStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

const customerTickers = [
  { id: "tkr_lobby", name: "Lobby" },
  { id: "tkr_concourse", name: "Concourse" },
];

describe("now playing ticker selector", () => {
  it("builds selector options from the authenticated ticker list", () => {
    expect(dashboardTickerOptions(customerTickers)).toEqual([
      { id: "tkr_lobby", name: "Lobby" },
      { id: "tkr_concourse", name: "Concourse" },
    ]);
    expect(dashboardTickerOptions([{ id: "", name: "Ghost" }, { name: "No id" }])).toEqual([]);
  });

  it("defaults to the first available customer ticker", () => {
    expect(resolveNowPlayingTickerId(null, dashboardTickerOptions(customerTickers))).toBe("tkr_lobby");
  });

  it("restores a persisted selection when it still belongs to the customer", () => {
    const options = dashboardTickerOptions(customerTickers);
    expect(resolveNowPlayingTickerId("tkr_concourse", options)).toBe("tkr_concourse");
  });

  it("discards a deleted or inaccessible persisted ticker and falls back safely", () => {
    const options = dashboardTickerOptions(customerTickers);
    expect(resolveNowPlayingTickerId("tkr_deleted", options)).toBe("tkr_lobby");
    expect(resolveNowPlayingTickerId("tkr_other_org", options)).toBe("tkr_lobby");
    expect(resolveNowPlayingTickerId("tkr_lobby", [])).toBeNull();
  });

  it("loads playback for the selected ticker id", () => {
    expect(nowPlayingPlaybackPath("tkr_concourse")).toBe("/v1/playback/tickers/tkr_concourse");
  });

  it("never selects a ticker that is not in the current customer list", () => {
    const orgA = dashboardTickerOptions([{ id: "tkr_a", name: "Org A Lobby" }]);
    const orgB = dashboardTickerOptions([{ id: "tkr_b", name: "Org B Lobby" }]);
    expect(resolveNowPlayingTickerId("tkr_a", orgB)).toBe("tkr_b");
    expect(resolveNowPlayingTickerId("tkr_b", orgA)).toBe("tkr_a");
    expect(orgA.some((ticker) => ticker.id === "tkr_b")).toBe(false);
  });
});

describe("now playing selection persistence", () => {
  it("stores only the selected ticker id for the current user and organization", () => {
    const storage = memoryStorage();
    const key = nowPlayingStorageKey("usr_1", "org_1");
    expect(key).toBe(`${NOW_PLAYING_STORAGE_PREFIX}:usr_1:org_1`);
    writePersistedNowPlayingTickerId(storage, key, "tkr_concourse");
    expect(readPersistedNowPlayingTickerId(storage, key)).toBe("tkr_concourse");
  });

  it("does not reuse another organization or user's persisted ticker id", () => {
    const storage = memoryStorage();
    writePersistedNowPlayingTickerId(storage, nowPlayingStorageKey("usr_1", "org_1"), "tkr_a");
    writePersistedNowPlayingTickerId(storage, nowPlayingStorageKey("usr_1", "org_2"), "tkr_b");
    expect(readPersistedNowPlayingTickerId(storage, nowPlayingStorageKey("usr_1", "org_1"))).toBe("tkr_a");
    expect(readPersistedNowPlayingTickerId(storage, nowPlayingStorageKey("usr_1", "org_2"))).toBe("tkr_b");
    expect(readPersistedNowPlayingTickerId(storage, nowPlayingStorageKey("usr_2", "org_1"))).toBeNull();
  });

  it("survives a logout/login by remaining in storage after the session token is cleared", () => {
    const storage = memoryStorage({ ticker_cms_token: "session-token" });
    const key = nowPlayingStorageKey("usr_1", "org_1");
    writePersistedNowPlayingTickerId(storage, key, "tkr_concourse");
    storage.setItem("ticker_cms_token", "");
    expect(readPersistedNowPlayingTickerId(storage, key)).toBe("tkr_concourse");
    expect(resolveNowPlayingTickerId("tkr_concourse", dashboardTickerOptions(customerTickers))).toBe(
      "tkr_concourse",
    );
  });
});
