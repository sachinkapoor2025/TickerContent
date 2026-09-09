import { describe, expect, it } from "vitest";
import {
  LIVE_ADMIN_SECTIONS,
  NOTIFICATION_CAPABILITIES,
  OPERATIONAL_SIGNALS,
  RELATED_VIEWS,
  UNAVAILABLE_INFRASTRUCTURE,
  availableNotificationTopics,
  findInfrastructure,
  findSignal,
  findTopic,
  operationalSignalStartIds,
  relatedViewIds,
} from "./notificationData";

describe("admin notification capability audit", () => {
  it("does not treat any notification-product capability as available", () => {
    expect(availableNotificationTopics()).toEqual([]);
    expect(NOTIFICATION_CAPABILITIES.every((item) => item.availability === "not_available")).toBe(true);
    expect(findTopic("in-app")?.availability).toBe("not_available");
    expect(findTopic("history")?.availability).toBe("not_available");
    expect(findTopic("read-state")?.availability).toBe("not_available");
    expect(findTopic("preferences")?.availability).toBe("not_available");
    expect(findTopic("email")?.availability).toBe("not_available");
    expect(findTopic("recipients")?.availability).toBe("not_available");
    expect(findTopic("templates")?.availability).toBe("not_available");
  });

  it("does not treat packs.alerts as a notification system", () => {
    expect(findInfrastructure("packs-alerts")).toMatchObject({
      availability: "not_available",
      inspectIn: "Plans, Subscriptions",
    });
    expect(findInfrastructure("packs-alerts")?.evidence).toMatch(/feature flag/i);
    expect(OPERATIONAL_SIGNALS.some((signal) => /alert|unread|notification/i.test(signal.signal))).toBe(false);
  });

  it("links operational signals only to live Admin sections", () => {
    const live = new Set<string>(LIVE_ADMIN_SECTIONS);
    expect(operationalSignalStartIds().every((id) => live.has(id))).toBe(true);
    expect(relatedViewIds().every((id) => live.has(id))).toBe(true);
    expect(RELATED_VIEWS.some((view) => view.id === "audit-logs")).toBe(false);
    expect(RELATED_VIEWS.some((view) => view.id === "notifications")).toBe(false);
  });

  it("documents operational signals without inventing a notification inbox", () => {
    expect(findSignal("publishing-jobs")).toMatchObject({
      signal: "Publishing job status",
      startId: "display-content",
    });
    expect(findSignal("delivery-status")).toMatchObject({
      signal: "Delivery status",
      startId: "monitoring",
    });
    expect(findSignal("organization-status")?.startId).toBe("organizations");
    expect(findSignal("subscription-status")?.startId).toBe("subscriptions");
    expect(findSignal("audit-activity")?.startId).toBe("dashboard");
    expect(OPERATIONAL_SIGNALS).toHaveLength(5);
  });

  it("leaves notification APIs, queues, and outbound email as absent or future", () => {
    expect(findInfrastructure("records")?.availability).toBe("not_available");
    expect(findInfrastructure("queues")?.availability).toBe("not_available");
    expect(findInfrastructure("ses-email")?.availability).toBe("future");
    expect(UNAVAILABLE_INFRASTRUCTURE.some((item) => item.availability === "available")).toBe(false);
  });
});
