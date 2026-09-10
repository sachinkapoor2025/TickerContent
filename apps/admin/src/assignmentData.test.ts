import { describe, expect, it } from "vitest";
import {
  ASSIGNMENT_CAPABILITIES,
  ASSIGNMENT_FLOW,
  ASSIGNMENT_SURFACES,
  LIVE_ASSIGNMENT_SECTIONS,
  assignmentAvailabilityLabel,
  assignmentFlowIds,
  assignmentSurfaceIds,
  findAssignmentTopic,
} from "./assignmentData";

describe("admin assignments capability audit", () => {
  it("does not treat a platform assignment API as available", () => {
    expect(findAssignmentTopic("admin-api")?.availability).toBe("not_available");
    expect(findAssignmentTopic("playlists")?.availability).toBe("not_available");
    expect(ASSIGNMENT_CAPABILITIES.every((topic) => topic.availability === "not_available" || topic.availability === "tenant_only")).toBe(true);
    expect(assignmentAvailabilityLabel("not_available")).toBe("Not available");
  });

  it("keeps campaign targeting and device groups on the tenant workspace", () => {
    expect(findAssignmentTopic("campaign-targeting")?.availability).toBe("tenant_only");
    expect(findAssignmentTopic("device-groups")?.availability).toBe("tenant_only");
    expect(assignmentAvailabilityLabel("tenant_only")).toBe("Tenant-only");
  });

  it("documents the current operational path without assignment CRUD", () => {
    expect(assignmentFlowIds()).toEqual(["organization", "targeting", "content", "job", "delivery"]);
    expect(ASSIGNMENT_FLOW).toHaveLength(5);
  });

  it("only links inspection to live Admin sections", () => {
    const live = new Set<string>(LIVE_ASSIGNMENT_SECTIONS);
    expect(assignmentSurfaceIds().every((id) => live.has(id))).toBe(true);
    expect(ASSIGNMENT_SURFACES.some((surface) => surface.id === "assignments")).toBe(false);
  });
});
