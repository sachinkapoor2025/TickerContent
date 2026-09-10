export const CONTENTS_LOADING_MESSAGE = "Loading content…";
export const CONTENTS_ERROR_MESSAGE = "Unable to load your content.";
export const CONTENT_DETAIL_LOADING_MESSAGE = "Loading content…";
export const CONTENT_DETAIL_ERROR_MESSAGE = "Unable to load this content.";
export const CONTENTS_EMPTY_TITLE = "No content yet";
export const CONTENTS_EMPTY_DESCRIPTION = "Create content to start designing messages for your displays.";
export const CONTENTS_PAGE_DESCRIPTION = "Create and manage the content used on your displays.";
export const CONTENT_DETAIL_DESCRIPTION = "Saved drafts, published versions, and the editor for this content.";
export const CONTENT_CREATE_ERROR = "Unable to create content.";
export const CONTENT_NAME_REQUIRED = "Enter a content name.";
export const CONTENT_CREATING_LABEL = "Creating…";
export const CONTENT_PUBLISHED_LABEL = "Published";
export const CONTENT_NOT_PUBLISHED_LABEL = "Not published";
export const CONTENT_STACK_MAX_PX = 720;

export type ContentVersionRecord = {
  id?: string;
  createdAt?: string | Date | number | null;
  createdBy?: string | null;
};

export type ContentRecord = {
  id?: string;
  title?: string | null;
  status?: string | null;
  headDraftVersionId?: string | null;
  publishedVersionId?: string | null;
  organizationId?: string | null;
  versions?: ContentVersionRecord[];
  document?: unknown;
};

export type ContentListRow = {
  id: string;
  name: string;
  href: string;
  editorHref: string;
  statusLabel: string;
  statusClass: string;
  publishedLabel: string;
};

export type ContentsPageState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; total: number; empty: boolean; rows: ContentListRow[] };

export type ContentVersionView = {
  id: string;
  createdLabel: string;
  statusLabel: string;
  statusClass: string;
  published: boolean;
  currentDraft: boolean;
  editorHref: string | null;
};

export type ContentDetailView = {
  id: string;
  name: string;
  statusLabel: string;
  statusClass: string;
  publishedLabel: string;
  editorHref: string;
  versions: ContentVersionView[];
};

export type ContentDetailPageState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; view: ContentDetailView };

function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function presentTitle(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "Untitled content";
}

export function contentStatusLabel(status: unknown): string {
  if (typeof status !== "string" || !status.trim()) return "—";
  const value = status.trim().toLowerCase();
  if (value === "draft") return "Draft";
  if (value === "published") return "Published";
  return titleCase(status);
}

export function contentStatusClass(status: unknown): string {
  const value = typeof status === "string" ? status.trim().toLowerCase() : "";
  if (value === "published") return "pp-status pp-status--success";
  if (value === "draft") return "pp-status pp-status--neutral";
  return "pp-status pp-status--neutral";
}

export function contentPublishedLabel(publishedVersionId: unknown): string {
  return typeof publishedVersionId === "string" && publishedVersionId.trim()
    ? CONTENT_PUBLISHED_LABEL
    : CONTENT_NOT_PUBLISHED_LABEL;
}

export function createdContentHref(id: string) {
  return `/content/${id}`;
}

export function contentEditorHref(id: string) {
  return `/content/${id}/edit`;
}

export function contentSubmitLabel(busy: boolean) {
  return busy ? CONTENT_CREATING_LABEL : "Create content";
}

export function needsContentStackList(viewportWidth: number) {
  return viewportWidth <= CONTENT_STACK_MAX_PX;
}

export function validateContentName(name: unknown): { ok: true; title: string } | { ok: false; message: string } {
  const title = typeof name === "string" ? name.trim() : "";
  if (!title) return { ok: false, message: CONTENT_NAME_REQUIRED };
  return { ok: true, title };
}

export function contentCreateBody(title: string) {
  return { title };
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

export function formatContentTimestamp(value: unknown): string {
  const date = parseTimestamp(value);
  if (!date) return "—";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export function contentListRows(items: ContentRecord[] | undefined): ContentListRow[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is ContentRecord & { id: string } => typeof item?.id === "string" && item.id.length > 0)
    .map((item) => ({
      id: item.id,
      name: presentTitle(item.title),
      href: createdContentHref(item.id),
      editorHref: contentEditorHref(item.id),
      statusLabel: contentStatusLabel(item.status),
      statusClass: contentStatusClass(item.status),
      publishedLabel: contentPublishedLabel(item.publishedVersionId),
    }));
}

export function contentsPageState(input: {
  loading: boolean;
  error: string | null;
  items: ContentRecord[] | null;
}): ContentsPageState {
  if (input.loading) {
    return { kind: "loading", message: CONTENTS_LOADING_MESSAGE };
  }
  const error = input.error?.trim();
  if (error || !input.items) {
    return { kind: "error", message: error || CONTENTS_ERROR_MESSAGE };
  }
  const rows = contentListRows(input.items);
  return {
    kind: "ready",
    total: rows.length,
    empty: rows.length === 0,
    rows,
  };
}

function versionStatus(versionId: string, row: ContentRecord): { label: string; published: boolean; currentDraft: boolean } {
  const published = row.publishedVersionId === versionId;
  const currentDraft = row.headDraftVersionId === versionId;
  if (published) return { label: CONTENT_PUBLISHED_LABEL, published: true, currentDraft };
  if (currentDraft) return { label: "Draft", published: false, currentDraft: true };
  return { label: CONTENT_NOT_PUBLISHED_LABEL, published: false, currentDraft: false };
}

export function contentVersionViews(row: ContentRecord): ContentVersionView[] {
  const versions = Array.isArray(row.versions) ? row.versions : [];
  return versions
    .filter((version): version is ContentVersionRecord & { id: string } => typeof version?.id === "string" && version.id.length > 0)
    .map((version) => {
      const parsed = parseTimestamp(version.createdAt);
      return {
        version,
        sort: parsed ? parsed.getTime() : 0,
      };
    })
    .sort((a, b) => b.sort - a.sort)
    .map(({ version }) => {
      const state = versionStatus(version.id, row);
      return {
        id: version.id,
        createdLabel: formatContentTimestamp(version.createdAt),
        statusLabel: state.label,
        statusClass: contentStatusClass(state.published ? "published" : "draft"),
        published: state.published,
        currentDraft: state.currentDraft,
        editorHref: state.currentDraft ? contentEditorHref(row.id ?? "") : null,
      };
    });
}

export function contentDetailPageState(input: {
  loading: boolean;
  error: string | null;
  row: ContentRecord | null;
}): ContentDetailPageState {
  if (input.loading) {
    return { kind: "loading", message: CONTENT_DETAIL_LOADING_MESSAGE };
  }
  const error = input.error?.trim();
  const contentId = input.row?.id;
  if (error || !input.row || !contentId) {
    return { kind: "error", message: error || CONTENT_DETAIL_ERROR_MESSAGE };
  }
  const row = input.row;
  return {
    kind: "ready",
    view: {
      id: contentId,
      name: presentTitle(row.title),
      statusLabel: contentStatusLabel(row.status),
      statusClass: contentStatusClass(row.status),
      publishedLabel: contentPublishedLabel(row.publishedVersionId),
      editorHref: contentEditorHref(contentId),
      versions: contentVersionViews(row),
    },
  };
}
