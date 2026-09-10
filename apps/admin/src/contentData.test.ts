import { describe, expect, it } from "vitest";
import {
  filterPublishedContent,
  findPublishedContent,
  publishedContentRows,
  publishedVersionsForContent,
} from "./contentData";

const orgs = [
  { id: "org_a", name: "Org A", status: "active" },
  { id: "org_b", name: "Org B", status: "suspended" },
];

describe("admin published content aggregations", () => {
  it("groups publishing jobs by organization and content without mixing tenants", () => {
    const rows = publishedContentRows(
      orgs,
      {
        org_a: [
          {
            id: "job_2",
            contentId: "cnt_a",
            versionId: "ver_2",
            status: "completed",
            trigger: "manual",
            createdAt: "2026-09-08T12:00:00Z",
          },
          {
            id: "job_1",
            contentId: "cnt_a",
            versionId: "ver_1",
            status: "completed",
            trigger: "manual",
            createdAt: "2026-09-01T12:00:00Z",
          },
        ],
        org_b: [
          {
            id: "job_9",
            contentId: "cnt_b",
            versionId: "ver_9",
            status: "completed",
            trigger: "manual",
            createdAt: "2026-09-09T12:00:00Z",
          },
        ],
      },
      {
        org_a: [
          { id: "d1", tickerId: "tkr_a", jobId: "job_1", status: "acked" },
          { id: "d2", tickerId: "tkr_b", jobId: "job_2", status: "pending" },
        ],
        org_b: [{ id: "d3", tickerId: "tkr_z", jobId: "job_9", status: "acked" }],
      },
    );
    expect(rows.map((row) => `${row.organizationId}:${row.contentId}`)).toEqual(["org_b:cnt_b", "org_a:cnt_a"]);
    expect(rows[1]).toMatchObject({
      contentId: "cnt_a",
      organizationId: "org_a",
      organizationName: "Org A",
      jobCount: 2,
      versionCount: 2,
      latestVersionId: "ver_2",
      latestJobId: "job_2",
      deliveryCount: 2,
      tickerCount: 2,
    });
    expect(rows[0].organizationId).toBe("org_b");
    expect(rows[0].contentId).toBe("cnt_b");
  });

  it("returns no content rows when publishing jobs failed to load", () => {
    expect(publishedContentRows(orgs, null, {})).toEqual([]);
  });

  it("ignores jobs without a content ID", () => {
    const rows = publishedContentRows(
      [orgs[0]],
      { org_a: [{ id: "job_x", status: "completed", createdAt: "2026-09-01T00:00:00Z" }] },
      { org_a: [] },
    );
    expect(rows).toEqual([]);
  });

  it("lists published versions newest first and keeps deliveries on their job", () => {
    const versions = publishedVersionsForContent("org_a", "cnt_a", {
      org_a: [
        {
          id: "job_1",
          contentId: "cnt_a",
          versionId: "ver_1",
          status: "completed",
          trigger: "manual",
          createdAt: "2026-09-01T00:00:00Z",
        },
        {
          id: "job_2",
          contentId: "cnt_a",
          versionId: "ver_2",
          status: "completed",
          trigger: "manual",
          createdAt: "2026-09-08T00:00:00Z",
        },
        {
          id: "job_3",
          contentId: "cnt_other",
          versionId: "ver_9",
          status: "completed",
          createdAt: "2026-09-09T00:00:00Z",
        },
      ],
      org_b: [
        {
          id: "job_b",
          contentId: "cnt_a",
          versionId: "ver_b",
          status: "completed",
          createdAt: "2026-09-10T00:00:00Z",
        },
      ],
    }, {
      org_a: [
        { id: "d1", tickerId: "tkr_a", jobId: "job_2", status: "acked" },
        { id: "d2", tickerId: "tkr_b", jobId: "job_2", status: "pending" },
        { id: "d3", tickerId: "tkr_a", jobId: "job_1", status: "acked" },
      ],
      org_b: [{ id: "d9", tickerId: "tkr_z", jobId: "job_b", status: "acked" }],
    });
    expect(versions.map((row) => row.versionId)).toEqual(["ver_2", "ver_1"]);
    expect(versions[0].tickerIds).toEqual(["tkr_a", "tkr_b"]);
    expect(versions[0].jobs[0].id).toBe("job_2");
    expect(versions[1].deliveryCount).toBe(1);
  });

  it("filters published content by content, organization, or version IDs", () => {
    const rows = publishedContentRows(
      orgs,
      {
        org_a: [{ id: "job_1", contentId: "cnt_lobby", versionId: "ver_1", status: "completed" }],
        org_b: [{ id: "job_2", contentId: "cnt_other", versionId: "ver_9", status: "completed" }],
      },
      { org_a: [], org_b: [] },
    );
    expect(filterPublishedContent(rows, "lobby")).toHaveLength(1);
    expect(filterPublishedContent(rows, "Org B")).toHaveLength(1);
    expect(filterPublishedContent(rows, "ver_9")).toHaveLength(1);
    expect(filterPublishedContent(rows, "missing")).toEqual([]);
  });

  it("finds content only within the selected organization", () => {
    const rows = publishedContentRows(
      orgs,
      {
        org_a: [{ id: "job_1", contentId: "cnt_same", versionId: "ver_1", status: "completed" }],
        org_b: [{ id: "job_2", contentId: "cnt_same", versionId: "ver_2", status: "completed" }],
      },
      { org_a: [], org_b: [] },
    );
    expect(findPublishedContent(rows, { organizationId: "org_a", contentId: "cnt_same" })?.latestVersionId).toBe("ver_1");
    expect(findPublishedContent(rows, { organizationId: "org_b", contentId: "cnt_same" })?.latestVersionId).toBe("ver_2");
    expect(findPublishedContent(rows, null)).toBeNull();
  });
});
