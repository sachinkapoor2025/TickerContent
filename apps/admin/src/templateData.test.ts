import { describe, expect, it } from "vitest";
import {
  LIVE_TEMPLATE_SECTIONS,
  TEMPLATE_CAPABILITIES,
  TEMPLATE_SURFACES,
  findTemplateTopic,
  templateAvailabilityLabel,
  templateSurfaceIds,
} from "./templateData";

describe("admin templates capability audit", () => {
  it("does not treat a global template catalog as available", () => {
    expect(findTemplateTopic("catalog")?.availability).toBe("not_available");
    expect(findTemplateTopic("crud")?.availability).toBe("not_available");
    expect(findTemplateTopic("publish")?.availability).toBe("not_available");
    expect(TEMPLATE_CAPABILITIES.every((topic) => topic.availability === "not_available" || topic.availability === "tenant_only")).toBe(true);
  });

  it("keeps template composition on the tenant catalog", () => {
    expect(findTemplateTopic("document")).toMatchObject({
      availability: "tenant_only",
    });
    expect(templateAvailabilityLabel("tenant_only")).toBe("Tenant-only");
    expect(templateAvailabilityLabel("not_available")).toBe("Not available");
  });

  it("only links inspection to live Admin sections", () => {
    const live = new Set<string>(LIVE_TEMPLATE_SECTIONS);
    expect(templateSurfaceIds().every((id) => live.has(id))).toBe(true);
    expect(TEMPLATE_SURFACES.some((surface) => surface.id === "templates")).toBe(false);
  });
});
