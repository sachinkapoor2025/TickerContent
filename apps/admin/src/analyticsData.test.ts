import { describe, expect, it } from "vitest";
import {
  ANALYTICS_ACTIVITY_LIMIT,
  ANALYTICS_TOPICS,
  HISTORICAL_BOUNDARIES,
  LIVE_ANALYTICS_SECTIONS,
  OPERATIONAL_SURFACES,
  deliverySnapshotRows,
  findTopic,
  historicalTopics,
  jobSnapshotRows,
  justifiedCharts,
  operationalSurfaceIds,
  snapshotTopics,
} from "./analyticsData";

describe("admin analytics capability audit", () => {
  it("does not mark historical topics as available platform analytics", () => {
    expect(historicalTopics().every((topic) => topic.availability !== "available")).toBe(true);
    expect(HISTORICAL_BOUNDARIES.every((item) => item.availability !== "available")).toBe(true);
  });

  it("does not justify charts without a complete time-series store", () => {
    expect(justifiedCharts()).toEqual([]);
    expect(ANALYTICS_TOPICS.every((topic) => topic.chart === false)).toBe(true);
  });

  it("keeps current operational snapshots distinct from trends", () => {
    const snapshotIds = snapshotTopics().map((topic) => topic.id);
    expect(snapshotIds).toEqual([
      "org-snapshot",
      "subscription-distribution",
      "publishing-by-org",
      "orgs-publishing",
      "job-status-distribution",
      "delivery-status-distribution",
      "recent-audit",
    ]);
  });

  it("classifies delivery-over-time as unavailable because deliveries have no timestamp", () => {
    expect(findTopic("deliveries-over-time")).toMatchObject({
      kind: "historical",
      availability: "not_available",
      chart: false,
    });
  });

  it("classifies jobs-over-time as derivable from truncated job createdAt, not a trend store", () => {
    expect(findTopic("jobs-over-time")).toMatchObject({
      kind: "historical",
      availability: "derivable",
      chart: false,
    });
  });

  it("leaves the documented analytics overview API as future", () => {
    expect(findTopic("analytics-overview-api")?.availability).toBe("future");
  });

  it("counts actual job statuses and does not invent published, publishing, or failed buckets", () => {
    expect(jobSnapshotRows([{ status: "completed" }, { status: "completed" }, { status: "failed" }])).toEqual([
      { status: "completed", count: 2 },
      { status: "failed", count: 1 },
    ]);
    expect(jobSnapshotRows([{ status: "completed" }]).map((row) => row.status)).toEqual(["completed"]);
  });

  it("keeps acked and pending delivery buckets and only adds statuses that exist", () => {
    expect(deliverySnapshotRows([{ status: "acked" }, { status: "pending" }, { status: "acked" }])).toEqual([
      { status: "acked", count: 2 },
      { status: "pending", count: 1 },
    ]);
    expect(deliverySnapshotRows([{ status: "pending" }, { status: "failed" }])).toEqual([
      { status: "acked", count: 0 },
      { status: "pending", count: 1 },
      { status: "failed", count: 1 },
    ]);
  });

  it("only links related views to live Admin sections and keeps recent activity compact", () => {
    const live = new Set<string>(LIVE_ANALYTICS_SECTIONS);
    expect(operationalSurfaceIds().every((id) => live.has(id))).toBe(true);
    expect(OPERATIONAL_SURFACES.some((surface) => surface.id === "audit-logs")).toBe(false);
    expect(ANALYTICS_ACTIVITY_LIMIT).toBe(8);
  });
});
