import { COLOR_MODES, type ColorMode, type CompositionDocument, type DisplayProfile, type Layer } from "@ticker-cms/composition";
import { applyDisplayProfile, blankComposition, editorSaveBody, headDocumentFromContent } from "./documentOps";

export const EDITOR_LOADING_MESSAGE = "Loading editor…";
export const EDITOR_ERROR_MESSAGE = "Unable to load this content.";
export const EDITOR_SAVE_SUCCESS = "Version saved.";
export const EDITOR_SAVE_ERROR = "Unable to save this version.";
export const EDITOR_SAVING_LABEL = "Saving…";
export const EDITOR_SAVED_LABEL = "Saved";
export const EDITOR_UNSAVED_LABEL = "Unsaved changes";
export const EDITOR_EMPTY_MESSAGE = "Start designing this content.";
export const EDITOR_NO_IMAGE_ASSETS = "No image assets available.";
export const EDITOR_NO_LOTTIE_ASSETS = "No Lottie assets available.";
export const EDITOR_PUBLISHED_NOTE = "You are editing the draft. Saving does not change the published version.";
export const EDITOR_PREVIEW_LABEL = "LED content preview";
export const EDITOR_PUBLISH_SUCCESS = "Content published.";

export type EditorTicker = {
  id?: string;
  name?: string | null;
  width?: number;
  height?: number;
  colorMode?: string | null;
};

export type EditorAsset = {
  id?: string;
  name?: string | null;
  kind?: string | null;
};

export type EditorPageState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready" };

function isColorMode(value: unknown): value is ColorMode {
  return typeof value === "string" && (COLOR_MODES as readonly string[]).includes(value);
}

export function profileFromTicker(ticker: EditorTicker | null | undefined): DisplayProfile | null {
  if (!ticker) return null;
  const width = typeof ticker.width === "number" ? ticker.width : Number(ticker.width);
  const height = typeof ticker.height === "number" ? ticker.height : Number(ticker.height);
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1) return null;
  const colorMode = isColorMode(ticker.colorMode) ? ticker.colorMode : "full";
  return { width, height, colorMode };
}

export function resolveEditorProfile(input: {
  ticker?: EditorTicker | null;
  document?: CompositionDocument | null;
}): DisplayProfile | null {
  return profileFromTicker(input.ticker) ?? input.document?.profile ?? null;
}

export function documentForEditor(input: {
  payload: { document?: unknown };
  profile: DisplayProfile | null;
}): CompositionDocument | null {
  const loaded = headDocumentFromContent(input.payload);
  if (loaded) {
    return input.profile ? applyDisplayProfile(loaded, input.profile) : loaded;
  }
  if (input.profile) return blankComposition(input.profile);
  return null;
}

export function editorPageState(input: { loading: boolean; error: string | null; ready: boolean }): EditorPageState {
  if (input.loading) return { kind: "loading", message: EDITOR_LOADING_MESSAGE };
  const error = input.error?.trim();
  if (error || !input.ready) return { kind: "error", message: error || EDITOR_ERROR_MESSAGE };
  return { kind: "ready" };
}

export function editorDirty(input: { title: string; document: CompositionDocument | null; baseline: string | null }): boolean {
  if (!input.document || input.baseline == null) return false;
  return editorSnapshot(input.title, input.document) !== input.baseline;
}

export function editorSnapshot(title: string, document: CompositionDocument): string {
  return JSON.stringify({ title, document });
}

export function editorSaveStatus(input: { dirty: boolean; saving: boolean }): string {
  if (input.saving) return EDITOR_SAVING_LABEL;
  return input.dirty ? EDITOR_UNSAVED_LABEL : EDITOR_SAVED_LABEL;
}

export function editorSubmitLabel(saving: boolean): string {
  return saving ? EDITOR_SAVING_LABEL : "Save version";
}

export function assetsByKind(items: EditorAsset[] | undefined, kind: "image" | "lottie"): Array<EditorAsset & { id: string; name: string }> {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is EditorAsset & { id: string } => item.kind === kind && typeof item.id === "string" && item.id.length > 0)
    .map((item) => ({ ...item, name: item.name?.trim() || kind }));
}

export function assetNameMap(items: EditorAsset[] | undefined): Record<string, string> {
  const names: Record<string, string> = {};
  if (!Array.isArray(items)) return names;
  for (const item of items) {
    if (typeof item.id === "string" && item.id && item.name?.trim()) names[item.id] = item.name.trim();
  }
  return names;
}

export function parseEditorInteger(value: unknown, min: number): { ok: true; value: number } | { ok: false; message: string } {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(number)) return { ok: false, message: "Enter a whole number." };
  if (number < min) return { ok: false, message: min > 0 ? "Value must be greater than 0." : "Enter a valid number." };
  return { ok: true, value: number };
}

export function canSaveDocument(doc: CompositionDocument | null): { ok: true } | { ok: false; message: string } {
  if (!doc) return { ok: false, message: EDITOR_SAVE_ERROR };
  if (!Number.isInteger(doc.profile.width) || doc.profile.width < 1 || !Number.isInteger(doc.profile.height) || doc.profile.height < 1) {
    return { ok: false, message: "Display size must be a positive number." };
  }
  for (const layer of doc.layers) {
    if (layer.width != null && (!Number.isFinite(layer.width) || layer.width < 1)) {
      return { ok: false, message: "Width must be greater than 0." };
    }
    if (layer.height != null && (!Number.isFinite(layer.height) || layer.height < 1)) {
      return { ok: false, message: "Height must be greater than 0." };
    }
    if (layer.zIndex != null && !Number.isFinite(layer.zIndex)) {
      return { ok: false, message: "Z-index must be a number." };
    }
    if ((layer.type === "image" || layer.type === "lottie") && !layer.assetId) {
      return { ok: false, message: "Media layers must reference an asset." };
    }
  }
  return { ok: true };
}

export function saveDraftBody(title: string, doc: CompositionDocument) {
  return editorSaveBody(title, doc);
}

export function editorPublishMessage(input?: { selectedTickerId?: string | null; deliveries?: number }) {
  void input;
  return EDITOR_PUBLISH_SUCCESS;
}

export function publishedVersionUntouched(input: {
  publishedVersionId?: string | null;
  saveBody: { title: string; document: CompositionDocument };
}): boolean {
  const keys = Object.keys(input.saveBody);
  return keys.length === 2 && keys.includes("title") && keys.includes("document") && !("publishedVersionId" in input.saveBody);
}

export function hasPublishedVersion(publishedVersionId: unknown): boolean {
  return typeof publishedVersionId === "string" && publishedVersionId.trim().length > 0;
}

export function contentEditorBackHref(id: string) {
  return `/content/${id}`;
}

export function layerGeometryValue(layer: Layer, key: "x" | "y" | "width" | "height", fallback: number): number {
  const value = layer[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
