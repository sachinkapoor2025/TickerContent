export const DASHBOARD_LOADING_MESSAGE = "Loading dashboard…";
export const DASHBOARD_ERROR_MESSAGE = "Unable to load the dashboard.";
export const DISPLAY_STATUS_VALUE = "Not available";
export const CONNECTIVITY_NOTE = "Live display connectivity is not available in the current MVP.";
export const NOW_PLAYING_EMPTY = "No content is currently playing";
export const JOBS_EMPTY = "No publishing activity yet.";

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
  id: "tickers" | "campaigns" | "display-status";
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
    { id: "campaigns", label: "Campaigns", value: String(countNumber(data.totals?.campaigns)) },
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
