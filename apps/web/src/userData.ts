export const USERS_LOADING_MESSAGE = "Loading users…";
export const USERS_ERROR_MESSAGE = "Unable to load your users.";
export const USERS_EMPTY_TITLE = "No users yet";
export const USERS_EMPTY_DESCRIPTION = "People in this workspace will appear here.";
export const USERS_PAGE_DESCRIPTION = "People who can access this workspace.";
export const USER_INVITE_ERROR = "Unable to add this user.";
export const USER_INVITE_SUCCESS = "User added.";
export const USER_INVITING_LABEL = "Adding…";
export const USER_NAME_REQUIRED = "Enter a name.";
export const USER_EMAIL_REQUIRED = "Enter an email.";
export const USER_PASSWORD_REQUIRED = "Enter a temporary password.";
export { canInviteUsers } from "./customerAccess";

export const USERS_STACK_MAX_PX = 720;

export const CUSTOMER_INVITE_ROLES = [
  { value: "viewer", label: "Viewer" },
  { value: "operator", label: "Operator" },
  { value: "designer", label: "Designer" },
  { value: "content_manager", label: "Content manager" },
  { value: "organization_admin", label: "Admin" },
] as const;

const ROLE_LABELS: Record<string, string> = {
  organization_owner: "Owner",
  organization_admin: "Admin",
  content_manager: "Content manager",
  designer: "Designer",
  operator: "Operator",
  viewer: "Viewer",
};

export type MembershipRecord = {
  id?: string;
  userId?: string | null;
  organizationId?: string | null;
  name?: string | null;
  email?: string | null;
  roleKey?: string | null;
  status?: string | null;
};

export type UserListRow = {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  statusLabel: string;
};

export type UsersPageState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; total: number; empty: boolean; rows: UserListRow[] };

export function workspaceRoleLabel(roleKey: unknown) {
  if (typeof roleKey !== "string" || !roleKey.trim()) return "—";
  return ROLE_LABELS[roleKey] ?? roleKey;
}

export function membershipStatusLabel(status: unknown) {
  if (typeof status !== "string" || !status.trim()) return "—";
  const value = status.trim().toLowerCase();
  if (value === "active") return "Active";
  if (value === "invited") return "Invited";
  if (value === "disabled") return "Disabled";
  return status.trim();
}

export function userInviteLabel(busy: boolean) {
  return busy ? USER_INVITING_LABEL : "Invite";
}

export function needsUserStackList(viewportWidth: number) {
  return viewportWidth <= USERS_STACK_MAX_PX;
}

export function validateUserInvite(input: { name: unknown; email: unknown; password: unknown; roleKey: unknown }) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const email = typeof input.email === "string" ? input.email.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";
  const roleKey =
    typeof input.roleKey === "string" && CUSTOMER_INVITE_ROLES.some((role) => role.value === input.roleKey)
      ? input.roleKey
      : "viewer";
  if (!name) return { ok: false as const, message: USER_NAME_REQUIRED };
  if (!email) return { ok: false as const, message: USER_EMAIL_REQUIRED };
  if (!password.trim()) return { ok: false as const, message: USER_PASSWORD_REQUIRED };
  return { ok: true as const, body: { name, email, password, roleKey } };
}

export function userListRows(items: MembershipRecord[] | undefined): UserListRow[] {
  if (!Array.isArray(items)) return [];
  return items
    .filter((item): item is MembershipRecord & { id: string } => typeof item?.id === "string" && item.id.length > 0)
    .map((item) => ({
      id: item.id,
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "Untitled user",
      email: typeof item.email === "string" && item.email.trim() ? item.email.trim() : "—",
      roleLabel: workspaceRoleLabel(item.roleKey),
      statusLabel: membershipStatusLabel(item.status),
    }));
}

export function usersPageState(input: {
  loading: boolean;
  error: string | null;
  items: MembershipRecord[] | null;
}): UsersPageState {
  if (input.loading) return { kind: "loading", message: USERS_LOADING_MESSAGE };
  const error = input.error?.trim();
  if (error || !input.items) return { kind: "error", message: error || USERS_ERROR_MESSAGE };
  const rows = userListRows(input.items);
  return { kind: "ready", total: rows.length, empty: rows.length === 0, rows };
}
