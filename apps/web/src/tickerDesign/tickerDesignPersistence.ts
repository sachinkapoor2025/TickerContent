import {
  CAMPAIGN_END_REQUIRED,
  CAMPAIGN_START_REQUIRED,
  campaignCreateBody,
  validateCampaignForm,
  type CampaignRecord,
} from "../campaignData";
import { type ContentRecord } from "../contentData";
import { customerAccess, type CustomerAccess } from "../customerAccess";
import { editorSaveBody } from "../editor/documentOps";
import { colorModeLabel, displayProfileLabel, type TickerPlayback, type TickerRecord } from "../tickerData";
import {
  persistDesignerDocument,
  readDesignerNodes,
  type DesignerNode,
  type DesignerStoredDocument,
} from "../tickerDesignerDemo/designerDocument";

export const TICKER_DESIGN_SAVE_ERROR = "Unable to save this ticker.";
export const TICKER_DESIGN_PUBLISH_ERROR = "Unable to publish this ticker.";
export const TICKER_DESIGN_SCHEDULE_ERROR = "Unable to save schedule.";
export const TICKER_DESIGN_SCHEDULE_UNPUBLISHED = "Publish this ticker before saving a schedule.";
export const TICKER_DESIGN_SCHEDULE_NEED_SAVE = "Save and publish this ticker before scheduling.";
export const TICKER_DESIGN_LEGACY_PUBLISH = "Add a design before replacing this ticker's published content.";

export function tickerDesignTitle(name: unknown): string {
  return typeof name === "string" && name.trim() ? name.trim() : "Ticker";
}

export function tickerDesignerChip(ticker: Pick<TickerRecord, "name" | "width" | "height" | "colorMode">): string {
  return `${tickerDesignTitle(ticker.name)} · ${displayProfileLabel(ticker.width, ticker.height)} · ${colorModeLabel(ticker.colorMode)}`;
}

export function tickerPublishBody(tickerId: string) {
  return { tickerIds: [tickerId] };
}

export function tickerPublishIsIsolated(tickerId: string, organizationTickerIds: string[]) {
  const body = tickerPublishBody(tickerId);
  if (!tickerId || body.tickerIds.length !== 1 || body.tickerIds[0] !== tickerId) return false;
  if (organizationTickerIds.length > 1 && body.tickerIds.length === organizationTickerIds.length) return false;
  return !organizationTickerIds.some((id) => id !== tickerId && body.tickerIds.includes(id));
}

export type TickerDesignerActions = {
  canEdit: boolean;
  canSave: boolean;
  canPublish: boolean;
  canSchedule: boolean;
};

export function tickerDesignerActions(
  roleKey: unknown,
  access: CustomerAccess = customerAccess(roleKey),
): TickerDesignerActions {
  return {
    canEdit: access.canWriteContent,
    canSave: access.canWriteContent,
    canPublish: access.canWriteContent && access.canPublish,
    canSchedule: access.canManageCampaigns,
  };
}

export function emptyDesignerHasDefaultCopy(document: DesignerStoredDocument): boolean {
  const text = document.layers
    .flatMap((layer) => (layer.type === "text" && typeof layer.props.text === "string" ? [layer.props.text] : []))
    .join(" ")
    .toLowerCase();
  return /hello|welcome|lobby hours|happy diwali/.test(text);
}

export function draftDoesNotReplacePlayback(input: {
  tickerId: string;
  publishedNodes: DesignerNode[];
  draftNodes: DesignerNode[];
  playbackDocument: unknown;
}): boolean {
  const playing = readDesignerNodes(input.playbackDocument, input.tickerId);
  if (!playing) return false;
  const same = (left: DesignerNode[], right: DesignerNode[]) => JSON.stringify(left) === JSON.stringify(right);
  if (same(input.draftNodes, input.publishedNodes)) return false;
  return same(playing, input.publishedNodes) && !same(playing, input.draftNodes);
}

export function designDidNotLeak(playbackDocument: unknown, sourceTickerId: string): boolean {
  return readDesignerNodes(playbackDocument, sourceTickerId) === null;
}

export function tickerScheduleName(tickerName: unknown): string {
  return `${tickerDesignTitle(tickerName)} schedule`;
}

export function designerSaveBody(title: string, document: DesignerStoredDocument) {
  return editorSaveBody(title, document);
}

export function storedDesignerDocument(input: {
  tickerId: string;
  nodes: DesignerNode[];
  width: number;
  height: number;
}): DesignerStoredDocument {
  return persistDesignerDocument(input);
}

export function contentBelongsToTickerDesign(
  content: { id?: string | null; document?: unknown } | null | undefined,
  tickerId: string,
): boolean {
  if (!content?.id || !tickerId) return false;
  return readDesignerNodes(content.document, tickerId) !== null;
}

export function emptyDesignerWouldReplaceLegacy(input: {
  nodes: DesignerNode[];
  tickerId: string;
  playbackDocument: unknown;
}): boolean {
  if (input.nodes.length > 0) return false;
  if (!input.playbackDocument) return false;
  return readDesignerNodes(input.playbackDocument, input.tickerId) === null;
}

export function selectTickerDesignContent(input: {
  tickerId: string;
  playbackContentId?: string | null;
  contents: ContentRecord[];
}): ContentRecord | null {
  const matches = input.contents.filter((item) => contentBelongsToTickerDesign(item, input.tickerId));
  if (input.playbackContentId) {
    const preferred = matches.find((item) => item.id === input.playbackContentId);
    if (preferred) return preferred;
  }
  return matches[0] ?? null;
}

export function loadedDesignerNodes(content: ContentRecord | null, tickerId: string): DesignerNode[] {
  if (!content) return [];
  return readDesignerNodes(content.document, tickerId) ?? [];
}

export function nextDesignerNodeSeq(nodes: DesignerNode[]): number {
  let max = 0;
  for (const node of nodes) {
    const match = /(\d+)$/.exec(node.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return max;
}

export function findTickerSchedule(
  campaigns: CampaignRecord[] | undefined,
  tickerId: string,
  contentId: string,
): CampaignRecord | null {
  if (!tickerId || !contentId || !Array.isArray(campaigns)) return null;
  return (
    campaigns.find((campaign) => {
      if (campaign.contentId !== contentId) return false;
      const ids = campaign.targetTickerIds;
      return Array.isArray(ids) && ids.length === 1 && ids[0] === tickerId;
    }) ?? null
  );
}

export function isoToDatetimeLocal(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toDatetimeLocalValue(value);
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return toDatetimeLocalValue(date);
  }
  return "";
}

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function buildTickerScheduleRequest(input: {
  tickerId: string;
  tickerName: string;
  contentId: string | null;
  startAt: string;
  endAt: string;
  contents: ContentRecord[];
}): { ok: true; body: ReturnType<typeof campaignCreateBody> } | { ok: false; error: string } {
  if (!input.contentId) {
    return { ok: false, error: TICKER_DESIGN_SCHEDULE_NEED_SAVE };
  }
  const result = validateCampaignForm(
    {
      name: tickerScheduleName(input.tickerName),
      contentId: input.contentId,
      targetTickerIds: [input.tickerId],
      status: "scheduled",
      startAt: input.startAt,
      endAt: input.endAt,
    },
    input.contents,
  );
  if (!result.ok) {
    const errors = result.fieldErrors;
    if (errors.published || errors.contentId) return { ok: false, error: TICKER_DESIGN_SCHEDULE_UNPUBLISHED };
    if (errors.startAt) return { ok: false, error: errors.startAt || CAMPAIGN_START_REQUIRED };
    if (errors.endAt) return { ok: false, error: errors.endAt || CAMPAIGN_END_REQUIRED };
    if (errors.targetTickerIds) return { ok: false, error: TICKER_DESIGN_SCHEDULE_ERROR };
    return { ok: false, error: TICKER_DESIGN_SCHEDULE_ERROR };
  }
  return { ok: true, body: campaignCreateBody(result.values) };
}

export function playbackBelongsToTicker(playback: TickerPlayback | null | undefined, tickerId: string): boolean {
  if (!playback?.document || !tickerId) return false;
  return readDesignerNodes(playback.document, tickerId) !== null;
}
