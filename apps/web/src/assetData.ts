export const ASSETS_LOADING_MESSAGE = "Loading assets…";
export const ASSETS_ERROR_MESSAGE = "Unable to load your assets.";
export const ASSET_DETAIL_LOADING_MESSAGE = "Loading asset…";
export const ASSET_DETAIL_ERROR_MESSAGE = "Unable to load this asset.";
export const ASSETS_EMPTY_TITLE = "No assets yet";
export const ASSETS_EMPTY_DESCRIPTION = "Upload an image or Lottie asset to use it in your content.";
export const ASSETS_EDITOR_NOTE = "Assets can be added to content from the editor.";
export const ASSETS_PAGE_DESCRIPTION = "Manage the images and media used in your content.";
export const ASSET_DETAIL_DESCRIPTION = "Preview and manage this asset.";
export const ASSET_UPLOAD_ERROR = "Unable to upload asset.";
export const ASSET_UPLOAD_SUCCESS = "Asset uploaded.";
export const ASSET_UPLOADING_LABEL = "Uploading…";
export const ASSET_FILE_REQUIRED = "Select a file to upload.";
export const ASSET_DELETE_PROMPT = "Delete asset?";
export const ASSET_DELETE_ERROR = "Unable to delete asset.";
export const ASSET_IMAGE_PREVIEW_UNAVAILABLE = "Preview unavailable";
export const ASSET_LOTTIE_PREVIEW_UNAVAILABLE = "Lottie preview unavailable";
export const ASSET_STACK_MAX_PX = 720;
export const ASSET_ACCEPT = "image/png,image/jpeg,image/webp,application/json,.json";

export type AssetRecord = {
  id?: string;
  name?: string | null;
  kind?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  status?: string | null;
  organizationId?: string | null;
  createdAt?: string | Date | number | null;
  storageKey?: string | null;
};

export type AssetListRow = {
  id: string;
  name: string;
  href: string;
  typeLabel: string;
  sizeLabel: string;
  canDelete: boolean;
  kind: "image" | "lottie" | string;
};

export type AssetsPageState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; total: number; empty: boolean; rows: AssetListRow[] };

export type AssetDetailView = {
  id: string;
  name: string;
  typeLabel: string;
  sizeLabel: string;
  kind: "image" | "lottie" | string;
  canDelete: boolean;
  previewKind: "image" | "lottie" | "none";
};

export type AssetDetailPageState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; view: AssetDetailView };

function presentName(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "Untitled asset";
}

export function assetTypeLabel(kind: unknown, mimeType?: unknown): string {
  const value = typeof kind === "string" ? kind.trim().toLowerCase() : "";
  if (value === "image") return "Image";
  if (value === "lottie") return "Lottie";
  if (typeof mimeType === "string" && mimeType.trim()) return mimeType.trim();
  return "—";
}

export function formatAssetSize(bytes: unknown): string {
  if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createdAssetHref(id: string) {
  return `/assets/${id}`;
}

export function assetSubmitLabel(busy: boolean) {
  return busy ? ASSET_UPLOADING_LABEL : "Upload";
}

export function needsAssetStackList(viewportWidth: number) {
  return viewportWidth <= ASSET_STACK_MAX_PX;
}

export function assetCanDelete(item: AssetRecord) {
  return Boolean(item.id) && item.organizationId != null && item.organizationId !== "";
}

export function validateAssetFile(file: unknown): { ok: true; file: File } | { ok: false; message: string } {
  if (typeof File !== "undefined" && file instanceof File) return { ok: true, file };
  return { ok: false, message: ASSET_FILE_REQUIRED };
}

export function assetUploadFormData(file: File, name?: string) {
  const body = new FormData();
  body.set("file", file);
  if (name?.trim()) body.set("name", name.trim());
  return body;
}

export function assetListRows(items: AssetRecord[] | undefined): AssetListRow[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is AssetRecord & { id: string } => typeof item?.id === "string" && item.id.length > 0)
    .map((item) => ({
      id: item.id,
      name: presentName(item.name),
      href: createdAssetHref(item.id),
      typeLabel: assetTypeLabel(item.kind, item.mimeType),
      sizeLabel: formatAssetSize(item.sizeBytes),
      canDelete: assetCanDelete(item),
      kind: typeof item.kind === "string" && item.kind.trim() ? item.kind.trim() : "unknown",
    }));
}

export function assetsPageState(input: {
  loading: boolean;
  error: string | null;
  items: AssetRecord[] | null;
}): AssetsPageState {
  if (input.loading) return { kind: "loading", message: ASSETS_LOADING_MESSAGE };
  const error = input.error?.trim();
  if (error || !input.items) return { kind: "error", message: error || ASSETS_ERROR_MESSAGE };
  const rows = assetListRows(input.items);
  return { kind: "ready", total: rows.length, empty: rows.length === 0, rows };
}

export function findAsset(items: AssetRecord[] | undefined, id: string | undefined) {
  if (!id || !Array.isArray(items)) return null;
  return items.find((item) => item.id === id) ?? null;
}

export function assetDetailView(item: AssetRecord): AssetDetailView | null {
  if (typeof item.id !== "string" || !item.id) return null;
  const kind = typeof item.kind === "string" ? item.kind.trim().toLowerCase() : "";
  return {
    id: item.id,
    name: presentName(item.name),
    typeLabel: assetTypeLabel(item.kind, item.mimeType),
    sizeLabel: formatAssetSize(item.sizeBytes),
    kind: kind || "unknown",
    canDelete: assetCanDelete(item),
    previewKind: kind === "image" || kind === "lottie" ? kind : "none",
  };
}

export function assetDetailPageState(input: {
  loading: boolean;
  error: string | null;
  item: AssetRecord | null;
}): AssetDetailPageState {
  if (input.loading) return { kind: "loading", message: ASSET_DETAIL_LOADING_MESSAGE };
  const error = input.error?.trim();
  if (error || !input.item) return { kind: "error", message: error || ASSET_DETAIL_ERROR_MESSAGE };
  const view = assetDetailView(input.item);
  if (!view) return { kind: "error", message: ASSET_DETAIL_ERROR_MESSAGE };
  return { kind: "ready", view };
}

export function lottieAssetRows(items: AssetRecord[] | undefined) {
  return assetListRows(items).filter((row) => row.kind === "lottie");
}
