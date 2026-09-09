import {
  CONTENT_NOT_PUBLISHED_LABEL,
  CONTENT_PUBLISHED_LABEL,
  contentPublishedLabel,
  createdContentHref,
  formatContentTimestamp,
  type ContentRecord,
} from "./contentData";
import { displayProfileLabel, type TickerRecord } from "./tickerData";

export const CAMPAIGNS_LOADING_MESSAGE = "Loading campaigns…";
export const CAMPAIGNS_ERROR_MESSAGE = "Unable to load your campaigns.";
export const CAMPAIGN_DETAIL_LOADING_MESSAGE = "Loading campaign…";
export const CAMPAIGN_DETAIL_ERROR_MESSAGE = "Unable to load this campaign.";
export const CAMPAIGNS_EMPTY_TITLE = "No campaigns yet";
export const CAMPAIGNS_EMPTY_DESCRIPTION = "Create a campaign to schedule published content on your displays.";
export const CAMPAIGNS_PAGE_DESCRIPTION = "Schedule published content across your displays.";
export const CAMPAIGN_DETAIL_DESCRIPTION = "Published content, target displays, and schedule for this campaign.";
export const CAMPAIGN_CREATE_ERROR = "Unable to create campaign.";
export const CAMPAIGN_SAVE_ERROR = "Unable to save campaign.";
export const CAMPAIGN_STATUS_ERROR = "Unable to update campaign status.";
export const CAMPAIGN_SAVE_SUCCESS = "Campaign saved.";
export const CAMPAIGN_NAME_REQUIRED = "Enter a campaign name.";
export const CAMPAIGN_CONTENT_REQUIRED = "Select content.";
export const CAMPAIGN_START_REQUIRED = "Enter a valid start date.";
export const CAMPAIGN_END_REQUIRED = "Enter a valid end date.";
export const CAMPAIGN_END_BEFORE_START = "End cannot be earlier than start.";
export const CAMPAIGN_UNPUBLISHED_MESSAGE = "This content has not been published yet.";
export const CAMPAIGN_TICKERS_REQUIRED = "Select at least one display.";
export const CAMPAIGN_STATUS_INVALID = "Select a valid status.";
export const CAMPAIGN_CREATING_LABEL = "Creating…";
export const CAMPAIGN_SAVING_LABEL = "Saving…";
export const CAMPAIGN_NO_CONTENT_TITLE = "No content available";
export const CAMPAIGN_NO_CONTENT_DESCRIPTION = "Create content before creating a campaign.";
export const CAMPAIGN_NO_DISPLAYS_TITLE = "No displays available";
export const CAMPAIGN_NO_DISPLAYS_DESCRIPTION = "Add a display before creating a campaign.";
export const CAMPAIGN_NO_PUBLISHED_TITLE = "No published content available";
export const CAMPAIGN_NO_PUBLISHED_DESCRIPTION = "Publish content from the editor before creating a campaign.";
export const CAMPAIGN_STACK_MAX_PX = 720;

export const CAMPAIGN_STATUSES = ["draft", "scheduled", "running", "paused", "cancelled", "ended"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];
export const PLAYABLE_CAMPAIGN_STATUSES = new Set<CampaignStatus>(["scheduled", "running"]);

export type CampaignRecord = {
  id?: string;
  name?: string | null;
  status?: string | null;
  priority?: number | null;
  startAt?: string | Date | number | null;
  endAt?: string | Date | number | null;
  contentId?: string | null;
  publishedVersionId?: string | null;
  targetTickerIds?: string[] | null;
  recurrence?: string | null;
  organizationId?: string | null;
};

export type ContentOption = {
  id: string;
  title: string;
  published: boolean;
  href: string;
};

export type DisplayOption = {
  id: string;
  name: string;
  profile: string;
  label: string;
};

export type CampaignCatalog = {
  contents: ContentOption[];
  tickers: DisplayOption[];
  hasContent: boolean;
  hasPublishedContent: boolean;
  hasDisplays: boolean;
};

export type CampaignListRow = {
  id: string;
  name: string;
  href: string;
  contentTitle: string;
  contentHref: string | null;
  displaysLabel: string;
  scheduleLabel: string;
  statusLabel: string;
  statusClass: string;
};

export type CampaignsPageState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; total: number; empty: boolean; rows: CampaignListRow[]; catalog: CampaignCatalog };

export type CampaignDetailView = {
  id: string;
  name: string;
  status: CampaignStatus | string;
  statusLabel: string;
  statusClass: string;
  contentId: string;
  contentTitle: string;
  contentHref: string;
  publishedLabel: string;
  published: boolean;
  displays: DisplayOption[];
  displaysLabel: string;
  startLabel: string;
  endLabel: string;
  startLocal: string;
  endLocal: string;
  targetTickerIds: string[];
  canPause: boolean;
  canResume: boolean;
};

export type CampaignDetailPageState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; view: CampaignDetailView; catalog: CampaignCatalog };

export type CampaignFormInput = {
  name: unknown;
  contentId: unknown;
  targetTickerIds: unknown;
  status: unknown;
  startAt: unknown;
  endAt: unknown;
};

export type CampaignFieldErrors = {
  name?: string;
  contentId?: string;
  targetTickerIds?: string;
  status?: string;
  startAt?: string;
  endAt?: string;
  published?: string;
};

export type CampaignFormValues = {
  name: string;
  contentId: string;
  targetTickerIds: string[];
  status: CampaignStatus;
  startAt: string;
  endAt: string;
};

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function presentCampaignName(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "Untitled campaign";
}

function presentContentTitle(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "Untitled content";
}

function presentTickerName(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "Ticker";
}

export function isCampaignStatus(value: unknown): value is CampaignStatus {
  return typeof value === "string" && (CAMPAIGN_STATUSES as readonly string[]).includes(value);
}

export function isPlayableCampaignStatus(status: unknown) {
  return isCampaignStatus(status) && PLAYABLE_CAMPAIGN_STATUSES.has(status);
}

export function contentIsPublished(content: ContentRecord | undefined | null) {
  return Boolean(typeof content?.publishedVersionId === "string" && content.publishedVersionId.trim());
}

export function campaignStatusLabel(status: unknown): string {
  if (typeof status !== "string" || !status.trim()) return "—";
  const value = status.trim().toLowerCase();
  if (value === "draft") return "Draft";
  if (value === "scheduled") return "Scheduled";
  if (value === "running") return "Running";
  if (value === "paused") return "Paused";
  if (value === "cancelled") return "Cancelled";
  if (value === "ended") return "Ended";
  return titleCase(status);
}

export function campaignStatusClass(status: unknown): string {
  const value = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (value === "scheduled" || value === "running") return "pp-status pp-status--success";
  if (value === "paused") return "pp-status pp-status--warning";
  return "pp-status pp-status--neutral";
}

export function createdCampaignHref(id: string) {
  return `/campaigns/${id}`;
}

export function campaignSubmitLabel(mode: "create" | "save", busy: boolean) {
  if (mode === "create") return busy ? CAMPAIGN_CREATING_LABEL : "Create campaign";
  return busy ? CAMPAIGN_SAVING_LABEL : "Save";
}

export function needsCampaignStackList(viewportWidth: number) {
  return viewportWidth <= CAMPAIGN_STACK_MAX_PX;
}

export function contentOptions(items: ContentRecord[] | undefined): ContentOption[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is ContentRecord & { id: string } => typeof item?.id === "string" && item.id.length > 0)
    .map((item) => ({
      id: item.id,
      title: presentContentTitle(item.title),
      published: contentIsPublished(item),
      href: createdContentHref(item.id),
    }));
}

export function displayOptions(items: TickerRecord[] | undefined): DisplayOption[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is TickerRecord & { id: string } => typeof item?.id === "string" && item.id.length > 0)
    .map((item) => {
      const name = presentTickerName(item.name);
      const profile = displayProfileLabel(item.width, item.height);
      return {
        id: item.id,
        name,
        profile,
        label: `${name} ${profile}`,
      };
    });
}

export function campaignCatalog(contents: ContentRecord[] | undefined, tickers: TickerRecord[] | undefined): CampaignCatalog {
  const contentRows = contentOptions(contents);
  const tickerRows = displayOptions(tickers);
  return {
    contents: contentRows,
    tickers: tickerRows,
    hasContent: contentRows.length > 0,
    hasPublishedContent: contentRows.some((item) => item.published),
    hasDisplays: tickerRows.length > 0,
  };
}

export function toggleTickerSelection(selected: string[], tickerId: string, checked: boolean): string[] {
  if (!tickerId) return selected;
  if (checked) {
    return selected.includes(tickerId) ? selected : [...selected, tickerId];
  }
  return selected.filter((id) => id !== tickerId);
}

function contentById(contents: ContentRecord[] | undefined, id: unknown) {
  if (typeof id !== "string" || !id || !Array.isArray(contents)) return undefined;
  return contents.find((item) => item.id === id);
}

function displaysLabel(ids: string[], tickers: DisplayOption[]): string {
  if (ids.length === 0) return "—";
  const names = ids.map((id) => tickers.find((ticker) => ticker.id === id)?.name ?? "Ticker");
  return names.join(", ");
}

export function campaignScheduleLabel(startAt: unknown, endAt: unknown): string {
  const start = formatContentTimestamp(startAt);
  const end = formatContentTimestamp(endAt);
  if (start === "—" && end === "—") return "—";
  return `${start} – ${end}`;
}

function toDatetimeLocalValue(value: unknown): string {
  const date = parseTimestamp(value);
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseTimestamp(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

export function datetimeLocalToIso(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function campaignListRows(
  campaigns: CampaignRecord[] | undefined,
  contents: ContentRecord[] | undefined,
  tickers: TickerRecord[] | undefined,
): CampaignListRow[] {
  if (!Array.isArray(campaigns)) return [];
  const contentRows = contentOptions(contents);
  const tickerRows = displayOptions(tickers);
  return campaigns
    .filter((item): item is CampaignRecord & { id: string } => typeof item?.id === "string" && item.id.length > 0)
    .map((item) => {
      const content = contentRows.find((row) => row.id === item.contentId);
      const targetIds = Array.isArray(item.targetTickerIds) ? item.targetTickerIds.filter((id) => typeof id === "string") : [];
      return {
        id: item.id,
        name: presentCampaignName(item.name),
        href: createdCampaignHref(item.id),
        contentTitle: content?.title ?? "Untitled content",
        contentHref: typeof item.contentId === "string" && item.contentId ? createdContentHref(item.contentId) : null,
        displaysLabel: displaysLabel(targetIds, tickerRows),
        scheduleLabel: campaignScheduleLabel(item.startAt, item.endAt),
        statusLabel: campaignStatusLabel(item.status),
        statusClass: campaignStatusClass(item.status),
      };
    });
}

export function campaignsPageState(input: {
  loading: boolean;
  error: string | null;
  campaigns: CampaignRecord[] | null;
  contents: ContentRecord[] | null;
  tickers: TickerRecord[] | null;
}): CampaignsPageState {
  if (input.loading) {
    return { kind: "loading", message: CAMPAIGNS_LOADING_MESSAGE };
  }
  const error = input.error?.trim();
  if (error || !input.campaigns || !input.contents || !input.tickers) {
    return { kind: "error", message: error || CAMPAIGNS_ERROR_MESSAGE };
  }
  const rows = campaignListRows(input.campaigns, input.contents, input.tickers);
  return {
    kind: "ready",
    total: rows.length,
    empty: rows.length === 0,
    rows,
    catalog: campaignCatalog(input.contents, input.tickers),
  };
}

export function campaignDetailView(
  campaign: CampaignRecord,
  contents: ContentRecord[] | undefined,
  tickers: TickerRecord[] | undefined,
): CampaignDetailView | null {
  if (typeof campaign.id !== "string" || !campaign.id) return null;
  const catalog = campaignCatalog(contents, tickers);
  const content = catalog.contents.find((item) => item.id === campaign.contentId);
  const targetIds = Array.isArray(campaign.targetTickerIds)
    ? campaign.targetTickerIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const displays = targetIds.map((id) => catalog.tickers.find((ticker) => ticker.id === id) ?? {
    id,
    name: "Ticker",
    profile: "—",
    label: "Ticker",
  });
  const published = Boolean(typeof campaign.publishedVersionId === "string" && campaign.publishedVersionId.trim());
  const status = isCampaignStatus(campaign.status) ? campaign.status : String(campaign.status ?? "");
  const contentPublished = contentIsPublished(contentById(contents, campaign.contentId));
  return {
    id: campaign.id,
    name: presentCampaignName(campaign.name),
    status,
    statusLabel: campaignStatusLabel(campaign.status),
    statusClass: campaignStatusClass(campaign.status),
    contentId: typeof campaign.contentId === "string" ? campaign.contentId : "",
    contentTitle: content?.title ?? "Untitled content",
    contentHref: typeof campaign.contentId === "string" && campaign.contentId ? createdContentHref(campaign.contentId) : "/content",
    publishedLabel: contentPublishedLabel(campaign.publishedVersionId),
    published,
    displays,
    displaysLabel: displaysLabel(targetIds, catalog.tickers),
    startLabel: formatContentTimestamp(campaign.startAt),
    endLabel: formatContentTimestamp(campaign.endAt),
    startLocal: toDatetimeLocalValue(campaign.startAt),
    endLocal: toDatetimeLocalValue(campaign.endAt),
    targetTickerIds: targetIds,
    canPause: isPlayableCampaignStatus(status),
    canResume: status === "paused" && (published || contentPublished) && targetIds.length > 0,
  };
}

export function campaignDetailPageState(input: {
  loading: boolean;
  error: string | null;
  campaign: CampaignRecord | null;
  contents: ContentRecord[] | null;
  tickers: TickerRecord[] | null;
}): CampaignDetailPageState {
  if (input.loading) {
    return { kind: "loading", message: CAMPAIGN_DETAIL_LOADING_MESSAGE };
  }
  const error = input.error?.trim();
  if (error || !input.campaign || !input.contents || !input.tickers) {
    return { kind: "error", message: error || CAMPAIGN_DETAIL_ERROR_MESSAGE };
  }
  const view = campaignDetailView(input.campaign, input.contents, input.tickers);
  if (!view) {
    return { kind: "error", message: CAMPAIGN_DETAIL_ERROR_MESSAGE };
  }
  return {
    kind: "ready",
    view,
    catalog: campaignCatalog(input.contents, input.tickers),
  };
}

export function findCampaign(items: CampaignRecord[] | undefined, id: string | undefined) {
  if (!id || !Array.isArray(items)) return null;
  return items.find((item) => item.id === id) ?? null;
}

export function unpublishedContentWarning(content: ContentRecord | ContentOption | undefined | null) {
  if (!content) return null;
  const published =
    "published" in content ? Boolean(content.published) : contentIsPublished(content as ContentRecord);
  return published ? null : CAMPAIGN_UNPUBLISHED_MESSAGE;
}

export function validateCampaignForm(
  input: CampaignFormInput,
  contents: ContentRecord[] | undefined,
):
  | { ok: true; values: CampaignFormValues; fieldErrors: CampaignFieldErrors }
  | { ok: false; values: null; fieldErrors: CampaignFieldErrors } {
  const fieldErrors: CampaignFieldErrors = {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) fieldErrors.name = CAMPAIGN_NAME_REQUIRED;

  const contentId = typeof input.contentId === "string" ? input.contentId.trim() : "";
  if (!contentId) fieldErrors.contentId = CAMPAIGN_CONTENT_REQUIRED;

  const status = input.status;
  if (!isCampaignStatus(status)) fieldErrors.status = CAMPAIGN_STATUS_INVALID;

  const targetTickerIds = Array.isArray(input.targetTickerIds)
    ? input.targetTickerIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  const startIso = datetimeLocalToIso(input.startAt);
  if (!startIso) fieldErrors.startAt = CAMPAIGN_START_REQUIRED;
  const endIso = datetimeLocalToIso(input.endAt);
  if (!endIso) fieldErrors.endAt = CAMPAIGN_END_REQUIRED;
  if (startIso && endIso) {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    if (end <= start) fieldErrors.endAt = CAMPAIGN_END_BEFORE_START;
  }

  const content = contentById(contents, contentId);
  const published = contentIsPublished(content);
  if (contentId && content && !published) {
    fieldErrors.published = CAMPAIGN_UNPUBLISHED_MESSAGE;
  }
  if (isPlayableCampaignStatus(status)) {
    if (!published) fieldErrors.published = CAMPAIGN_UNPUBLISHED_MESSAGE;
    if (targetTickerIds.length < 1) fieldErrors.targetTickerIds = CAMPAIGN_TICKERS_REQUIRED;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, values: null, fieldErrors };
  }

  return {
    ok: true,
    values: {
      name,
      contentId,
      targetTickerIds,
      status: status as CampaignStatus,
      startAt: startIso!,
      endAt: endIso!,
    },
    fieldErrors: {},
  };
}

export function campaignCreateBody(values: CampaignFormValues) {
  return {
    name: values.name,
    contentId: values.contentId,
    targetTickerIds: values.targetTickerIds,
    status: values.status,
    startAt: values.startAt,
    endAt: values.endAt,
  };
}

export function campaignPatchBody(values: CampaignFormValues) {
  return campaignCreateBody(values);
}

export function campaignPauseBody() {
  return { status: "paused" as const };
}

export function campaignResumeBody() {
  return { status: "scheduled" as const };
}

export const CONTENT_PUBLISHED = CONTENT_PUBLISHED_LABEL;
export const CONTENT_NOT_PUBLISHED = CONTENT_NOT_PUBLISHED_LABEL;
