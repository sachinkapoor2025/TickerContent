export const DASHBOARD_LOADING_MESSAGE = "Loading dashboard…";
export const DASHBOARD_ERROR_MESSAGE = "Unable to load the dashboard.";
export const DISPLAY_STATUS_VALUE = "Not available";
export const CONNECTIVITY_NOTE = "Live display connectivity is not available in the current MVP.";
export const NOW_PLAYING_EMPTY = "No content is currently playing";
export const NOW_PLAYING_SELECT_LABEL = "Select ticker";
export const NOW_PLAYING_LOADING_MESSAGE = "Loading ticker…";
export const NOW_PLAYING_PLAYBACK_ERROR = "Unable to load this ticker.";
export const NOW_PLAYING_NO_TICKERS_ACTION = "Go to My Tickers to add a ticker.";
export const JOBS_EMPTY = "No publishing activity yet.";
export const NOW_PLAYING_STORAGE_PREFIX = "ticker_cms_now_playing";

export type DashboardPreview = {
  source?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  contentId?: string | null;
  publishedVersionId?: string | null;
  document?: unknown | null;
};

export type DashboardJob = {
  id?: string;
  status?: string | null;
  createdAt?: string | Date | null;
  contentId?: string | null;
  trigger?: string | null;
};

export type DashboardTicker = {
  id?: string;
  name?: string | null;
};

export type DashboardTickerOption = {
  id: string;
  name: string;
};

type NowPlayingStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

export type DashboardResponse = {
  totals?: {
    tickers?: number;
    online?: number;
    offline?: number;
    campaigns?: number;
  };
  entitlements?: {
    status?: string;
    restricted?: boolean;
  };
  recentJobs?: DashboardJob[];
  preview?: DashboardPreview | null;
  tickers?: DashboardTicker[];
};

export type DashboardKpi = {
  id: "tickers" | "display-status";
  label: string;
  value: string;
};

export type PublishingActivityRow = {
  id: string;
  when: string;
  status: string;
  contentId: string;
  trigger: string;
};

export type DashboardView = {
  kpis: DashboardKpi[];
  connectivityNote: string;
  planStatus: string | null;
  restricted: boolean;
  nowPlayingEmpty: boolean;
  nowPlayingDocument: unknown | null;
  nowPlayingCaption: string;
  nowPlayingEmptyMessage: string;
  jobs: PublishingActivityRow[];
  jobsEmptyMessage: string;
};

export type DashboardPageState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; view: DashboardView };

function countNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function presentText(value: unknown): string {
  if (typeof value !== "string") return "—";
  const text = value.trim();
  return text || "—";
}

export function formatDashboardWhen(value: unknown): string {
  if (value == null || value === "") return "—";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function isNowPlayingEmpty(preview?: DashboardPreview | null): boolean {
  if (!preview) return true;
  if (preview.source === "empty") return true;
  return preview.document == null;
}

export function dashboardTickerOptions(tickers: DashboardTicker[] | undefined): DashboardTickerOption[] {
  if (!Array.isArray(tickers)) return [];
  const options: DashboardTickerOption[] = [];
  for (const ticker of tickers) {
    if (typeof ticker.id !== "string" || !ticker.id.trim()) continue;
    const name = typeof ticker.name === "string" ? ticker.name.trim() : "";
    options.push({ id: ticker.id, name: name || "Ticker" });
  }
  return options;
}

export function resolveNowPlayingTickerId(
  persistedId: string | null | undefined,
  tickers: DashboardTickerOption[],
): string | null {
  if (tickers.length === 0) return null;
  if (typeof persistedId === "string" && tickers.some((ticker) => ticker.id === persistedId)) {
    return persistedId;
  }
  return tickers[0]?.id ?? null;
}

export function nowPlayingStorageKey(userId: unknown, organizationId: unknown): string | null {
  if (typeof userId !== "string" || !userId.trim()) return null;
  if (typeof organizationId !== "string" || !organizationId.trim()) return null;
  return `${NOW_PLAYING_STORAGE_PREFIX}:${userId.trim()}:${organizationId.trim()}`;
}

export function readPersistedNowPlayingTickerId(
  storage: NowPlayingStorage | null | undefined,
  key: string | null | undefined,
): string | null {
  if (!storage || !key) return null;
  try {
    const value = storage.getItem(key);
    return typeof value === "string" && value.trim() ? value.trim() : null;
  } catch {
    return null;
  }
}

export function writePersistedNowPlayingTickerId(
  storage: NowPlayingStorage | null | undefined,
  key: string | null | undefined,
  tickerId: string | null | undefined,
): void {
  if (!storage || !key || typeof tickerId !== "string" || !tickerId.trim()) return;
  try {
    storage.setItem(key, tickerId.trim());
  } catch {
    // Ignore quota or private-mode failures; selection still works for this session.
  }
}

export function nowPlayingPlaybackPath(tickerId: string): string {
  return `/v1/playback/tickers/${tickerId}`;
}

export function nowPlayingCaption(preview?: DashboardPreview | null, tickerName?: string | null): string {
  if (isNowPlayingEmpty(preview)) return "";
  const parts: string[] = [];
  const name = tickerName?.trim();
  if (name) parts.push(name);
  if (preview?.source === "campaign") {
    const campaign = preview.campaignName?.trim();
    if (campaign) parts.push(campaign);
  } else if (preview?.source === "published") {
    parts.push("Published content");
  }
  return parts.join(" · ");
}

export function recentPublishingActivity(jobs: DashboardJob[] | undefined): PublishingActivityRow[] {
  if (!Array.isArray(jobs)) return [];
  return jobs
    .filter((job): job is DashboardJob & { id: string } => typeof job?.id === "string" && job.id.length > 0)
    .map((job) => ({
      id: job.id,
      when: formatDashboardWhen(job.createdAt),
      status: presentText(job.status),
      contentId: presentText(job.contentId),
      trigger: presentText(job.trigger),
    }));
}

export function dashboardKpis(data: DashboardResponse): DashboardKpi[] {
  return [
    { id: "tickers", label: "Tickers", value: String(countNumber(data.totals?.tickers)) },
    { id: "display-status", label: "Display status", value: DISPLAY_STATUS_VALUE },
  ];
}

export function dashboardView(data: DashboardResponse): DashboardView {
  const preview = data.preview ?? null;
  const empty = isNowPlayingEmpty(preview);
  return {
    kpis: dashboardKpis(data),
    connectivityNote: CONNECTIVITY_NOTE,
    planStatus: data.entitlements?.status?.trim() || null,
    restricted: Boolean(data.entitlements?.restricted),
    nowPlayingEmpty: empty,
    nowPlayingDocument: empty ? null : preview?.document ?? null,
    nowPlayingCaption: nowPlayingCaption(preview, data.tickers?.[0]?.name),
    nowPlayingEmptyMessage: NOW_PLAYING_EMPTY,
    jobs: recentPublishingActivity(data.recentJobs),
    jobsEmptyMessage: JOBS_EMPTY,
  };
}

export function dashboardPageState(input: {
  loading: boolean;
  error: string | null;
  data: DashboardResponse | null;
}): DashboardPageState {
  if (input.loading) {
    return { kind: "loading", message: DASHBOARD_LOADING_MESSAGE };
  }
  const error = input.error?.trim();
  if (error || !input.data) {
    return { kind: "error", message: error || DASHBOARD_ERROR_MESSAGE };
  }
  return { kind: "ready", view: dashboardView(input.data) };
}
