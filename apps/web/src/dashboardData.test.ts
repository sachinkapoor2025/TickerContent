import { describe, expect, it } from "vitest";
import {
  CONNECTIVITY_NOTE,
  DASHBOARD_ERROR_MESSAGE,
  DASHBOARD_LOADING_MESSAGE,
  DISPLAY_STATUS_VALUE,
  JOBS_EMPTY,
  NOW_PLAYING_EMPTY,
  dashboardPageState,
  dashboardView,
  formatDashboardWhen,
  isNowPlayingEmpty,
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
  it("shows ticker and campaign counts from the dashboard payload", () => {
    const view = dashboardView(populatedDashboard());
    expect(view.kpis).toEqual([
      { id: "tickers", label: "Tickers", value: "4" },
      { id: "campaigns", label: "Campaigns", value: "3" },
      { id: "display-status", label: "Display status", value: DISPLAY_STATUS_VALUE },
    ]);
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

  it("shows an empty campaign count without inventing campaigns", () => {
    const view = dashboardView({
      totals: { tickers: 2, online: 0, offline: 2, campaigns: 0 },
    });
    expect(view.kpis.find((kpi) => kpi.id === "campaigns")?.value).toBe("0");
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
