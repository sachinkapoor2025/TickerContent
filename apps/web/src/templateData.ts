export const TEMPLATES_LOADING_MESSAGE = "Loading templates…";
export const TEMPLATES_ERROR_MESSAGE = "Unable to load your templates.";
export const TEMPLATES_PAGE_DESCRIPTION = "Start new content from a template.";
export const TEMPLATES_EMPTY_TITLE = "No templates yet";
export const TEMPLATES_EMPTY_DESCRIPTION = "Templates will appear here when they are available to this workspace.";
export const TEMPLATE_USE_ERROR = "Unable to use this template.";
export const TEMPLATE_USING_LABEL = "Using…";
export const TEMPLATES_STACK_MAX_PX = 720;

export type TemplateRecord = {
  id?: string;
  title?: string | null;
  category?: string | null;
  visibility?: string | null;
  organizationId?: string | null;
  document?: unknown;
  documentJson?: string | null;
};

export type TemplateListRow = {
  id: string;
  name: string;
  category: string;
};

export type TemplatesPageState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; total: number; empty: boolean; rows: TemplateListRow[] };

function presentTitle(value: unknown) {
  if (typeof value === "string" && value.trim()) return value.trim();
  return "Untitled template";
}

export function templateUseLabel(busy: boolean) {
  return busy ? TEMPLATE_USING_LABEL : "Use template";
}

export function templateUseBody(title: string, templateId: string) {
  return { title, templateId };
}

export function needsTemplateStackList(viewportWidth: number) {
  return viewportWidth <= TEMPLATES_STACK_MAX_PX;
}

export function templateListRows(items: TemplateRecord[] | undefined): TemplateListRow[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is TemplateRecord & { id: string } => typeof item?.id === "string" && item.id.length > 0)
    .map((item) => ({
      id: item.id,
      name: presentTitle(item.title),
      category: typeof item.category === "string" && item.category.trim() ? item.category.trim() : "—",
    }));
}

export function templatesPageState(input: {
  loading: boolean;
  error: string | null;
  items: TemplateRecord[] | null;
}): TemplatesPageState {
  if (input.loading) return { kind: "loading", message: TEMPLATES_LOADING_MESSAGE };
  const error = input.error?.trim();
  if (error || !input.items) return { kind: "error", message: error || TEMPLATES_ERROR_MESSAGE };
  const rows = templateListRows(input.items);
  return { kind: "ready", total: rows.length, empty: rows.length === 0, rows };
}
