import { describe, expect, it } from "vitest";
import {
  countDeliveryStatuses,
  countJobStatuses,
  displayRowsForOrganizations,
  filterKnownTickers,
  knownTickerRows,
  uniqueTickerIds,
} from "./opsData";

describe("admin operations aggregations", () => {
  it("counts real delivery statuses without inventing online/offline", () => {
    expect(
      countDeliveryStatuses([
        { id: "d1", tickerId: "tkr_a", jobId: "job_1", status: "acked" },
        { id: "d2", tickerId: "tkr_b", jobId: "job_1", status: "pending" },
        { id: "d3", tickerId: "tkr_a", jobId: "job_2", status: "acked" },
      ]),
    ).toEqual({ acked: 2, pending: 1, other: 0, total: 3 });
  });

  it("counts unique ticker IDs from delivery records", () => {
    expect(
      uniqueTickerIds([
        { id: "d1", tickerId: "tkr_a", jobId: "job_1", status: "acked" },
        { id: "d2", tickerId: "tkr_a", jobId: "job_2", status: "pending" },
        { id: "d3", tickerId: "tkr_b", jobId: "job_1", status: "pending" },
      ]),
    ).toEqual(["tkr_a", "tkr_b"]);
  });

  it("keeps ticker delivery rows scoped to their organization", () => {
    const rows = knownTickerRows(
      [
        { id: "org_a", name: "Org A", status: "active" },
        { id: "org_b", name: "Org B", status: "active" },
      ],
      {
        org_a: [
          { id: "d1", tickerId: "tkr_a", jobId: "job_1", snapshotVersion: "ver_1", status: "acked" },
          { id: "d2", tickerId: "tkr_a", jobId: "job_2", snapshotVersion: "ver_2", status: "pending" },
        ],
        org_b: [{ id: "d3", tickerId: "tkr_b", jobId: "job_3", snapshotVersion: "ver_9", status: "pending" }],
      },
    );
    expect(rows).toEqual([
      {
        tickerId: "tkr_a",
        organizationId: "org_a",
        organizationName: "Org A",
        deliveryCount: 2,
        latestStatus: "acked",
        latestSnapshotVersion: "ver_1",
        latestJobId: "job_1",
      },
      {
        tickerId: "tkr_b",
        organizationId: "org_b",
        organizationName: "Org B",
        deliveryCount: 1,
        latestStatus: "pending",
        latestSnapshotVersion: "ver_9",
        latestJobId: "job_3",
      },
    ]);
  });

  it("uses registered ticker counts from organization details only", () => {
    const rows = displayRowsForOrganizations(
      [{ id: "org_a", name: "Org A", status: "active" }],
      {
        org_a: {
          organization: { id: "org_a", name: "Org A", status: "active" },
          subscription: null,
          plan: null,
          memberCount: 1,
          tickerCount: 4,
        },
      },
      { org_a: [{ id: "d1", tickerId: "tkr_a", jobId: "job_1", status: "acked" }] },
    );
    expect(rows[0]).toMatchObject({
      registeredTickers: 4,
      deliveryRecords: 1,
      tickersWithDeliveries: 1,
    });
  });

  it("does not invent ticker rows when deliveries failed to load", () => {
    expect(knownTickerRows([{ id: "org_a", name: "Org A", status: "active" }], null)).toEqual([]);
  });

  it("counts publishing job statuses from loaded records", () => {
    expect(
      countJobStatuses([
        { id: "job_1", status: "completed" },
        { id: "job_2", status: "completed" },
        { id: "job_3", status: "failed" },
      ]),
    ).toEqual({ completed: 2, other: 1, total: 3 });
  });

  it("filters known ticker IDs without extra API fields", () => {
    const rows = [
      {
        tickerId: "tkr_a",
        organizationId: "org_a",
        organizationName: "Demo Venue",
        deliveryCount: 1,
        latestStatus: "acked",
        latestSnapshotVersion: "ver_1",
        latestJobId: "job_1",
      },
    ];
    expect(filterKnownTickers(rows, "tkr_a")).toHaveLength(1);
    expect(filterKnownTickers(rows, "missing")).toEqual([]);
  });
});
