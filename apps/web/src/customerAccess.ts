export type CustomerAccess = {
  canManageTickers: boolean;
  canWriteContent: boolean;
  canPublish: boolean;
  canManageAssets: boolean;
  canManageCampaigns: boolean;
  canInviteUsers: boolean;
  canSimulateSubscription: boolean;
  canUseTemplate: boolean;
};

const TICKER_WRITE = new Set(["organization_owner", "organization_admin", "operator"]);
const CONTENT_WRITE = new Set(["organization_owner", "organization_admin", "content_manager", "designer"]);
const PUBLISH = new Set(["organization_owner", "organization_admin", "content_manager", "operator"]);
const CAMPAIGN_WRITE = new Set(["organization_owner", "organization_admin", "content_manager"]);
const USER_INVITE = new Set(["organization_owner", "organization_admin"]);

function roleKeyOf(roleKey: unknown) {
  return typeof roleKey === "string" ? roleKey : "";
}

export function canManageTickers(roleKey: unknown) {
  return TICKER_WRITE.has(roleKeyOf(roleKey));
}

export function canWriteContent(roleKey: unknown) {
  return CONTENT_WRITE.has(roleKeyOf(roleKey));
}

export function canPublish(roleKey: unknown) {
  return PUBLISH.has(roleKeyOf(roleKey));
}

export function canManageAssets(roleKey: unknown) {
  return canWriteContent(roleKey);
}

export function canManageCampaigns(roleKey: unknown) {
  return CAMPAIGN_WRITE.has(roleKeyOf(roleKey));
}

export function canInviteUsers(roleKey: unknown) {
  return USER_INVITE.has(roleKeyOf(roleKey));
}

export function canSimulateSubscription(roleKey: unknown) {
  return roleKeyOf(roleKey) === "organization_owner";
}

export function canUseTemplate(roleKey: unknown) {
  return canWriteContent(roleKey);
}

export function customerAccess(roleKey: unknown): CustomerAccess {
  return {
    canManageTickers: canManageTickers(roleKey),
    canWriteContent: canWriteContent(roleKey),
    canPublish: canPublish(roleKey),
    canManageAssets: canManageAssets(roleKey),
    canManageCampaigns: canManageCampaigns(roleKey),
    canInviteUsers: canInviteUsers(roleKey),
    canSimulateSubscription: canSimulateSubscription(roleKey),
    canUseTemplate: canUseTemplate(roleKey),
  };
}
