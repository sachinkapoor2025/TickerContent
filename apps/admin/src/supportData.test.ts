import { describe, expect, it } from "vitest";
import {
  INVESTIGATION_PATHS,
  INVESTIGATION_SURFACES,
  LIVE_ADMIN_SECTIONS,
  SUPPORT_FLOW,
  UNAVAILABLE_SUPPORT_CAPABILITIES,
  findTopic,
  investigationPathStartIds,
  investigationSurfaceIds,
  supportFlowIds,
  ticketLikeTopics,
} from "./supportData";

describe("admin support capability audit", () => {
  it("does not treat ticketing concepts as available Admin workflows", () => {
    for (const topic of ticketLikeTopics()) {
      expect(["not_available", "future"]).toContain(topic.availability);
    }
    expect(findTopic("tickets")?.availability).toBe("not_available");
    expect(UNAVAILABLE_SUPPORT_CAPABILITIES.every((item) => item.availability !== "available")).toBe(true);
  });

  it("only links investigation to live Admin sections", () => {
    const live = new Set<string>(LIVE_ADMIN_SECTIONS);
    expect(investigationSurfaceIds().every((id) => live.has(id))).toBe(true);
    expect(investigationPathStartIds().every((id) => live.has(id))).toBe(true);
    expect(INVESTIGATION_SURFACES.some((surface) => surface.id === "audit-logs")).toBe(false);
  });

  it("keeps per-organization audit on existing Admin screens, not a ticket inbox", () => {
    expect(findTopic("audit-inspect")).toMatchObject({
      availability: "available",
      inspectIn: "Organization detail, Dashboard",
    });
  });

  it("does not use tenant support-adjacent APIs from Admin", () => {
    expect(findTopic("tenant-audit")?.availability).toBe("tenant_only");
    expect(findTopic("tenant-jobs")?.availability).toBe("tenant_only");
    expect(findTopic("tenant-ai-help")?.availability).toBe("tenant_only");
  });

  it("leaves notifications, impersonation, and SLA as future", () => {
    expect(findTopic("notifications-api")?.availability).toBe("future");
    expect(findTopic("view-as-tenant")?.availability).toBe("future");
    expect(findTopic("sla")?.availability).toBe("future");
  });

  it("documents an investigation workflow without inventing tickets or heartbeat", () => {
    expect(supportFlowIds()).toEqual([
      "organization",
      "members",
      "displays",
      "publishing",
      "delivery",
      "subscription",
      "audit",
    ]);
    expect(SUPPORT_FLOW.some((step) => /heartbeat is not available/i.test(step.note))).toBe(true);
  });

  it("keeps investigation paths on records Admin can actually inspect", () => {
    expect(INVESTIGATION_PATHS.map((path) => path.id)).toEqual([
      "display-blank",
      "publish-stuck",
      "wrong-content",
      "access",
      "subscription",
      "unexpected-change",
    ]);
    expect(INVESTIGATION_PATHS.every((path) => !/player log|network diagnostic|delivery latency/i.test(path.thenInspect))).toBe(
      true,
    );
    expect(INVESTIGATION_PATHS.find((path) => path.id === "display-blank")?.thenInspect).toMatch(/heartbeat is not available/i);
    expect(INVESTIGATION_PATHS.find((path) => path.id === "wrong-content")?.thenInspect).toMatch(/tenant-only/i);
    expect(UNAVAILABLE_SUPPORT_CAPABILITIES.map((item) => item.id)).toEqual([
      "tickets",
      "case-assignment",
      "agent-workflow",
      "messages",
      "sla",
      "incidents",
    ]);
  });
});
