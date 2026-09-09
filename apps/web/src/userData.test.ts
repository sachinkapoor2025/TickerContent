import { describe, expect, it } from "vitest";
import {
  USERS_EMPTY_DESCRIPTION,
  USERS_EMPTY_TITLE,
  USERS_ERROR_MESSAGE,
  USERS_LOADING_MESSAGE,
  USERS_PAGE_DESCRIPTION,
  USER_INVITE_ERROR,
  USER_INVITING_LABEL,
  canInviteUsers,
  userInviteLabel,
  userListRows,
  usersPageState,
  validateUserInvite,
  workspaceRoleLabel,
  type MembershipRecord,
} from "./userData.js";

const owner: MembershipRecord = {
  id: "mem_owner",
  organizationId: "org_secret",
  userId: "usr_secret",
  name: "Demo Owner",
  email: "owner@demo.local",
  roleKey: "organization_owner",
  status: "active",
};

describe("users page mapping", () => {
  it("maps real membership fields and hides internal identifiers", () => {
    const rows = userListRows([owner, { name: "No id" }]);
    expect(rows).toEqual([
      {
        id: "mem_owner",
        name: "Demo Owner",
        email: "owner@demo.local",
        roleLabel: "Owner",
        statusLabel: "Active",
      },
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/org_secret|usr_secret|organizationId|userId/);
    expect(workspaceRoleLabel("viewer")).toBe("Viewer");
    expect(workspaceRoleLabel("organization_admin")).toBe("Admin");
  });

  it("covers loading, error, and empty states", () => {
    expect(usersPageState({ loading: true, error: null, items: null })).toEqual({
      kind: "loading",
      message: USERS_LOADING_MESSAGE,
    });
    expect(usersPageState({ loading: false, error: "nope", items: [] })).toEqual({
      kind: "error",
      message: "nope",
    });
    expect(usersPageState({ loading: false, error: null, items: null }).kind).toBe("error");
    const failed = usersPageState({ loading: false, error: "Unable to load your users.", items: null });
    expect(failed.kind).toBe("error");
    expect(failed).not.toMatchObject({ empty: true });
    expect(USERS_ERROR_MESSAGE).toBe("Unable to load your users.");
    expect(usersPageState({ loading: false, error: null, items: [] })).toMatchObject({
      kind: "ready",
      empty: true,
      total: 0,
    });
    expect(USERS_EMPTY_TITLE).toBe("No users yet");
    expect(USERS_EMPTY_DESCRIPTION).toContain("workspace");
    expect(USERS_PAGE_DESCRIPTION).toContain("workspace");
    expect(USERS_ERROR_MESSAGE).toBe("Unable to load your users.");
  });

  it("validates invite input without inventing roles or exposing secrets", () => {
    expect(validateUserInvite({ name: "", email: "a@b.c", password: "password12", roleKey: "viewer" }).ok).toBe(false);
    expect(validateUserInvite({ name: "Pat", email: "", password: "password12", roleKey: "viewer" }).ok).toBe(false);
    expect(validateUserInvite({ name: "Pat", email: "pat@demo.local", password: "   ", roleKey: "viewer" }).ok).toBe(false);
    const valid = validateUserInvite({
      name: " Pat ",
      email: "pat@demo.local",
      password: "password12",
      roleKey: "unknown",
    });
    expect(valid).toEqual({
      ok: true,
      body: { name: "Pat", email: "pat@demo.local", password: "password12", roleKey: "viewer" },
    });
    expect(userInviteLabel(true)).toBe(USER_INVITING_LABEL);
    expect(USER_INVITE_ERROR).toBe("Unable to add this user.");
  });

  it("only offers invite to roles the API already allows", () => {
    expect(canInviteUsers("organization_owner")).toBe(true);
    expect(canInviteUsers("organization_admin")).toBe(true);
    expect(canInviteUsers("viewer")).toBe(false);
    expect(canInviteUsers("designer")).toBe(false);
    expect(canInviteUsers("content_manager")).toBe(false);
  });
});
