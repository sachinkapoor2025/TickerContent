import { COLOR_MODES, type ColorMode } from "@ticker-cms/composition";

export const TICKERS_LOADING_MESSAGE = "Loading tickers…";
export const TICKERS_ERROR_MESSAGE = "Unable to load your tickers.";
export const TICKER_DETAIL_LOADING_MESSAGE = "Loading ticker…";
export const TICKER_DETAIL_ERROR_MESSAGE = "Unable to load this ticker.";
export const TICKERS_EMPTY_TITLE = "No tickers yet";
export const TICKERS_EMPTY_DESCRIPTION =
  "Add a ticker to start creating and publishing content for this workspace.";
export const TICKERS_PAGE_DESCRIPTION =
  "Manage the displays connected to this workspace and inspect their current configuration.";
export const TICKER_DETAIL_DESCRIPTION = "Display configuration and current published content.";
export const TICKER_NO_CONTENT = "No content is currently playing";
export const TICKER_CONTENT_UNAVAILABLE = "Content status unavailable";
export const TICKER_CREATE_ERROR = "Unable to add ticker.";
export const TICKER_SAVE_SUCCESS = "Display configuration saved.";
export const TICKER_SAVE_ERROR = "Unable to save display configuration.";
export const TICKER_ADDING_LABEL = "Adding…";
export const TICKER_SAVING_LABEL = "Saving…";
export const CUSTOMER_ASSISTANT_SAFE_PADDING_PX = 80;

export const TICKER_FORM_DEFAULTS = {
  name: "",
  width: 620,
  height: 64,
  colorMode: "full" as ColorMode,
};

export type TickerRecord = {
  id?: string;
  name?: string | null;
  location?: string | null;
  width?: number;
  height?: number;
  colorMode?: string | null;
  status?: string | null;
  online?: boolean;
  lastHeartbeatAt?: string | Date | null;
  nowPlaying?: TickerPlayback | null;
};

export type TickerPlayback = {
  source?: string | null;
  contentId?: string | null;
  versionId?: string | null;
  publishedVersionId?: string | null;
  campaignId?: string | null;
  campaignName?: string | null;
  document?: unknown | null;
};

export type TickerPlaybackState =
  | { available: true; playback: TickerPlayback | null }
  | { available: false };

export type TickerListRow = {
  id: string;
  name: string;
  href: string;
  profile: string;
  colorMode: string;
  statusLabel: string;
  statusClass: string;
  contentLabel: string;
};

export type TickersPageState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; total: number; empty: boolean; rows: TickerListRow[] };

export type TickerDetailView = {
  id: string;
  name: string;
  location: string | null;
  profile: string;
  colorMode: string;
  statusLabel: string;
  statusClass: string;
  contentLabel: string;
  document: unknown | null;
  previewEmpty: boolean;
  previewMessage: string;
};

export type TickerProfileInput = {
  name: unknown;
  width: unknown;
  height: unknown;
  colorMode: unknown;
};

export type TickerFieldErrors = Partial<Record<"name" | "width" | "height" | "colorMode", string>>;

export type TickerProfileValues = {
  name: string;
  width: number;
  height: number;
  colorMode: ColorMode;
};

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isColorMode(value: unknown): value is ColorMode {
  return typeof value === "string" && (COLOR_MODES as readonly string[]).includes(value);
}

export function displayProfileLabel(width: unknown, height: unknown): string {
  const w = typeof width === "number" ? width : Number(width);
  const h = typeof height === "number" ? height : Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h)) return "—";
  return `${w} × ${h} px`;
}

export function colorModeLabel(mode: unknown): string {
  if (mode === "full") return "Full color";
  if (mode === "mono") return "Monochrome";
  if (mode === "rg") return "Red-green";
  if (typeof mode === "string" && mode.trim()) return titleCase(mode);
  return "—";
}

export function tickerStatusLabel(status: unknown): string {
  if (typeof status !== "string" || !status.trim()) return "—";
  const value = status.trim().toLowerCase();
  if (value === "active") return "Active";
  if (value === "suspended") return "Suspended";
  if (value === "closed") return "Closed";
  if (value === "inactive") return "Inactive";
  return titleCase(status);
}

export function tickerStatusClass(status: unknown): string {
  const value = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (value === "active") return "pp-status pp-status--success";
  if (value === "suspended") return "pp-status pp-status--warning";
  if (value === "closed" || value === "inactive") return "pp-status pp-status--neutral";
  return "pp-status pp-status--neutral";
}

export function tickerContentLabel(playback: TickerPlayback | null | undefined, available = true): string {
  if (!available) return TICKER_CONTENT_UNAVAILABLE;
  if (!playback || playback.source === "empty") return TICKER_NO_CONTENT;
  if (playback.source === "campaign") {
    const name = playback.campaignName?.trim();
    return name || "Campaign";
  }
  if (playback.source === "published") return "Published content";
  if (playback.document != null) return "Published content";
  return TICKER_NO_CONTENT;
}

export function isPlaybackUnavailableError(err: { status?: number } | null | undefined): boolean {
  return err?.status !== 401;
}

export function createdTickerHref(id: string) {
  return `/tickers/${id}`;
}

export function tickerSubmitLabel(kind: "create" | "save", busy: boolean) {
  if (kind === "create") return busy ? TICKER_ADDING_LABEL : "Add ticker";
  return busy ? TICKER_SAVING_LABEL : "Save";
}

export function needsAssistantSafeSpace(viewportWidth: number) {
  return viewportWidth <= 960;
}

export function validateTickerProfile(input: TickerProfileInput):
  | { ok: true; values: TickerProfileValues; fieldErrors: TickerFieldErrors }
  | { ok: false; values: null; fieldErrors: TickerFieldErrors } {
  const fieldErrors: TickerFieldErrors = {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) fieldErrors.name = "Enter a ticker name.";
  const width = typeof input.width === "number" ? input.width : Number(input.width);
  if (!Number.isInteger(width) || width < 1) fieldErrors.width = "Width must be a positive number.";
  const height = typeof input.height === "number" ? input.height : Number(input.height);
  if (!Number.isInteger(height) || height < 1) fieldErrors.height = "Height must be a positive number.";
  if (!isColorMode(input.colorMode)) fieldErrors.colorMode = "Select a valid color mode.";
  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, values: null, fieldErrors };
  }
  return {
    ok: true,
    values: { name, width, height, colorMode: input.colorMode as ColorMode },
    fieldErrors,
  };
}

export function tickerCreateBody(values: TickerProfileValues) {
  return {
    name: values.name,
    width: values.width,
    height: values.height,
    colorMode: values.colorMode,
  };
}

export function tickerPatchBody(values: TickerProfileValues) {
  return tickerCreateBody(values);
}

export function tickerListRows(
  items: TickerRecord[] | undefined,
  playbackById: Record<string, TickerPlaybackState> = {},
): TickerListRow[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is TickerRecord & { id: string } => typeof item?.id === "string" && item.id.length > 0)
    .map((item) => {
      const playbackState = playbackById[item.id];
      const available = playbackState ? playbackState.available : false;
      const playback = playbackState && playbackState.available ? playbackState.playback : null;
      return {
        id: item.id,
        name: item.name?.trim() || "Ticker",
        href: `/tickers/${item.id}`,
        profile: displayProfileLabel(item.width, item.height),
        colorMode: colorModeLabel(item.colorMode),
        statusLabel: tickerStatusLabel(item.status),
        statusClass: tickerStatusClass(item.status),
        contentLabel: tickerContentLabel(playback, available),
      };
    });
}

export function tickersPageState(input: {
  loading: boolean;
  error: string | null;
  items: TickerRecord[] | null;
  playbackById?: Record<string, TickerPlaybackState>;
}): TickersPageState {
  if (input.loading) {
    return { kind: "loading", message: TICKERS_LOADING_MESSAGE };
  }
  const error = input.error?.trim();
  if (error || !input.items) {
    return { kind: "error", message: error || TICKERS_ERROR_MESSAGE };
  }
  const rows = tickerListRows(input.items, input.playbackById);
  return {
    kind: "ready",
    total: rows.length,
    empty: rows.length === 0,
    rows,
  };
}

export function tickerDetailView(
  row: TickerRecord,
  playbackState?: TickerPlaybackState | null,
): TickerDetailView | null {
  if (typeof row.id !== "string" || !row.id) return null;
  const playback =
    playbackState && playbackState.available
      ? playbackState.playback
      : playbackState
        ? null
        : row.nowPlaying ?? null;
  const available = playbackState ? playbackState.available : true;
  const contentLabel = tickerContentLabel(playback, available);
  const previewEmpty = !available || !playback || playback.source === "empty" || playback.document == null;
  return {
    id: row.id,
    name: row.name?.trim() || "Ticker",
    location: row.location?.trim() || null,
    profile: displayProfileLabel(row.width, row.height),
    colorMode: colorModeLabel(row.colorMode),
    statusLabel: tickerStatusLabel(row.status),
    statusClass: tickerStatusClass(row.status),
    contentLabel,
    document: previewEmpty ? null : playback?.document ?? null,
    previewEmpty,
    previewMessage: contentLabel,
  };
}

export function tickerDetailPageState(input: {
  loading: boolean;
  error: string | null;
  row: TickerRecord | null;
  playback?: TickerPlaybackState | null;
}): { kind: "loading"; message: string } | { kind: "error"; message: string } | { kind: "ready"; view: TickerDetailView } {
  if (input.loading) {
    return { kind: "loading", message: TICKER_DETAIL_LOADING_MESSAGE };
  }
  const error = input.error?.trim();
  const view = input.row ? tickerDetailView(input.row, input.playback) : null;
  if (error || !view) {
    return { kind: "error", message: error || TICKER_DETAIL_ERROR_MESSAGE };
  }
  return { kind: "ready", view };
}
