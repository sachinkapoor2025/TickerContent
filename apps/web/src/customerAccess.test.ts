import { describe, expect, it } from "vitest";
import {
  canInviteUsers,
  canManageAssets,
  canManageCampaigns,
  canManageTickers,
  canPublish,
  canSimulateSubscription,
  canUseTemplate,
  canWriteContent,
  customerAccess,
} from "./customerAccess.js";

const VIEWER = "viewer";
const EDITOR = "designer";
const ADMIN = "organization_admin";
const OWNER = "organization_owner";

describe("customer mutation visibility", () => {
  it("hides ticker, content, publish, asset, and campaign mutations from viewers", () => {
    const access = customerAccess(VIEWER);
    expect(access.canManageTickers).toBe(false);
    expect(access.canWriteContent).toBe(false);
    expect(access.canPublish).toBe(false);
    expect(access.canManageAssets).toBe(false);
    expect(access.canManageCampaigns).toBe(false);
    expect(access.canUseTemplate).toBe(false);
    expect(access.canInviteUsers).toBe(false);
    expect(access.canSimulateSubscription).toBe(false);
  });

  it("lets the content editor write content without publish, campaigns, or ticker mutation", () => {
    expect(canWriteContent(EDITOR)).toBe(true);
    expect(canManageAssets(EDITOR)).toBe(true);
    expect(canUseTemplate(EDITOR)).toBe(true);
    expect(canPublish(EDITOR)).toBe(false);
    expect(canManageCampaigns(EDITOR)).toBe(false);
    expect(canManageTickers(EDITOR)).toBe(false);
    expect(canInviteUsers(EDITOR)).toBe(false);
    expect(canSimulateSubscription(EDITOR)).toBe(false);
  });

  it("keeps owner and admin actions that the API already allows", () => {
    const owner = customerAccess(OWNER);
    const admin = customerAccess(ADMIN);
    expect(owner.canManageTickers).toBe(true);
    expect(owner.canWriteContent).toBe(true);
    expect(owner.canPublish).toBe(true);
    expect(owner.canManageAssets).toBe(true);
    expect(owner.canManageCampaigns).toBe(true);
    expect(owner.canInviteUsers).toBe(true);
    expect(owner.canSimulateSubscription).toBe(true);
    expect(admin.canManageTickers).toBe(true);
    expect(admin.canWriteContent).toBe(true);
    expect(admin.canPublish).toBe(true);
    expect(admin.canManageAssets).toBe(true);
    expect(admin.canManageCampaigns).toBe(true);
    expect(admin.canInviteUsers).toBe(true);
    expect(canSimulateSubscription(ADMIN)).toBe(false);
  });
});
