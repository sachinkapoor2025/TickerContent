export const AUDIT_LOADING_MESSAGE = "Loading audit events…";
export const AUDIT_ERROR_MESSAGE = "Unable to load your audit log.";
export const AUDIT_EMPTY_TITLE = "No audit events yet";
export const AUDIT_EMPTY_DESCRIPTION = "Workspace activity will appear here after important actions.";
export const AUDIT_PAGE_DESCRIPTION = "Important actions in this workspace.";
export const AUDIT_STACK_MAX_PX = 720;

export type AuditRecord = {
  id?: string;
  organizationId?: string | null;
  actorUserId?: string | null;
  action?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  source?: string | null;
  payloadJson?: string | null;
  createdAt?: string | Date | number | null;
};

export type AuditListRow = {
  id: string;
  when: string;
  action: string;
  source: string;
};

export type AuditPageState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; total: number; empty: boolean; rows: AuditListRow[] };

export function formatAuditWhen(value: unknown) {
  if (value == null || value === "") return "—";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function needsAuditStackList(viewportWidth: number) {
  return viewportWidth <= AUDIT_STACK_MAX_PX;
}

export function auditListRows(items: AuditRecord[] | undefined): AuditListRow[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is AuditRecord & { id: string } => typeof item?.id === "string" && item.id.length > 0)
    .map((item) => ({
      id: item.id,
      when: formatAuditWhen(item.createdAt),
      action: typeof item.action === "string" && item.action.trim() ? item.action.trim() : "—",
      source: typeof item.source === "string" && item.source.trim() ? item.source.trim() : "—",
    }));
}

export function auditPageState(input: {
  loading: boolean;
  error: string | null;
  items: AuditRecord[] | null;
}): AuditPageState {
  if (input.loading) return { kind: "loading", message: AUDIT_LOADING_MESSAGE };
  const error = input.error?.trim();
  if (error || !input.items) return { kind: "error", message: error || AUDIT_ERROR_MESSAGE };
  const rows = auditListRows(input.items);
  return { kind: "ready", total: rows.length, empty: rows.length === 0, rows };
}
