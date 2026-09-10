import { describe, expect, it } from "vitest";
import {
  CAPABILITY_MATRIX,
  LIVE_ADMIN_SECTIONS,
  ORGANIZATION_CONTROLS,
  availablePlatformSettings,
  findControl,
  findMatrixRow,
  findTopic,
  matrixStartIds,
  relatedViewIds,
} from "./settingsData";

describe("admin settings capability audit", () => {
  it("does not treat platform settings as inspectable or editable", () => {
    expect(availablePlatformSettings()).toEqual([]);
    expect(findTopic("platform-config")?.availability).toBe("not_available");
    expect(findMatrixRow("platform-api")?.availability).toBe("not_available");
    expect(findMatrixRow("system-config")?.availability).toBe("not_available");
  });

  it("keeps organization configuration on existing Admin screens, not a Settings form", () => {
    expect(findMatrixRow("org-status")).toMatchObject({
      availability: "editable",
      startId: "organizations",
    });
    expect(findControl("org-status")).toMatchObject({ inspectable: true, editable: true });
    expect(findMatrixRow("org-timezone")).toMatchObject({
      availability: "inspectable",
      startId: "organizations",
    });
    expect(findControl("org-timezone")?.editable).toBe(false);
    expect(findMatrixRow("subscription-state")?.startId).toBe("subscriptions");
  });

  it("treats entitlements as inspectable in the Admin UI even though an override API exists", () => {
    expect(findMatrixRow("entitlements-read")?.availability).toBe("inspectable");
    expect(findControl("entitlements-read")).toMatchObject({ inspectable: true, editable: false });
    expect(findControl("entitlements-read")?.where).toMatch(/override/);
  });

  it("does not treat profile, password, or session chrome as settings APIs", () => {
    expect(findTopic("account-profile")?.availability).toBe("not_available");
    expect(findMatrixRow("password-change")?.availability).toBe("not_available");
    expect(findMatrixRow("email-preferences")?.availability).toBe("not_available");
  });

  it("only links live controls to existing Admin sections", () => {
    const live = new Set<string>(LIVE_ADMIN_SECTIONS);
    expect(relatedViewIds().every((id) => live.has(id))).toBe(true);
    expect(matrixStartIds().every((id) => live.has(id))).toBe(true);
    expect(ORGANIZATION_CONTROLS.every((control) => live.has(control.startId))).toBe(true);
    expect(CAPABILITY_MATRIX.some((row) => row.startId === "settings")).toBe(false);
  });

  it("leaves MFA, SSO, API keys, and integrations as future or unavailable", () => {
    expect(findMatrixRow("mfa")?.availability).toBe("future");
    expect(findMatrixRow("sso")?.availability).toBe("future");
    expect(findMatrixRow("api-keys")?.availability).toBe("not_available");
    expect(findMatrixRow("integrations")?.availability).toBe("not_available");
    expect(CAPABILITY_MATRIX.filter((row) => row.area === "Security").every((row) => row.availability !== "editable")).toBe(
      true,
    );
  });
});
