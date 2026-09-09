import type { AdminOrgDetail, AdminOrgListItem } from "./dashboardData";

export type AdminDeliveryItem = {
  id: string;
  tickerId: string;
  jobId: string;
  snapshotVersion?: string | number | null;
  status: string;
};

export type AdminJobItem = {
  id: string;
  contentId?: string;
  versionId?: string | null;
  status: string;
  trigger?: string;
  createdAt?: string | Date;
};

export type DisplayOrgRow = {
  organizationId: string;
  organizationName: string;
  organizationStatus: string;
  registeredTickers: number | null;
  deliveryRecords: number;
  tickersWithDeliveries: number;
};

export type KnownTickerRow = {
  tickerId: string;
  organizationId: string;
  organizationName: string;
  deliveryCount: number;
  latestStatus: string;
  latestSnapshotVersion: string;
  latestJobId: string;
};

export type DeliveryStatusCounts = {
  acked: number;
  pending: number;
  other: number;
  total: number;
};

export type JobStatusCounts = {
  completed: number;
  other: number;
  total: number;
};

export function countDeliveryStatuses(items: AdminDeliveryItem[]): DeliveryStatusCounts {
  const counts: DeliveryStatusCounts = { acked: 0, pending: 0, other: 0, total: items.length };
  for (const item of items) {
    const status = item.status.toLowerCase();
    if (status === "acked") counts.acked += 1;
    else if (status === "pending") counts.pending += 1;
    else counts.other += 1;
  }
  return counts;
}

export function countJobStatuses(items: AdminJobItem[]): JobStatusCounts {
  const counts: JobStatusCounts = { completed: 0, other: 0, total: items.length };
  for (const item of items) {
    if (item.status.toLowerCase() === "completed") counts.completed += 1;
    else counts.other += 1;
  }
  return counts;
}

export function uniqueTickerIds(items: AdminDeliveryItem[]) {
  return [...new Set(items.map((item) => item.tickerId).filter(Boolean))];
}

export function displayRowsForOrganizations(
  orgs: AdminOrgListItem[],
  details: Record<string, AdminOrgDetail>,
  deliveriesByOrg: Record<string, AdminDeliveryItem[]> | null,
): DisplayOrgRow[] {
  return orgs.map((org) => {
    const detail = details[org.id];
    const deliveries = deliveriesByOrg?.[org.id] ?? [];
    return {
      organizationId: org.id,
      organizationName: org.name,
      organizationStatus: org.status,
      registeredTickers: detail ? detail.tickerCount : null,
      deliveryRecords: deliveriesByOrg ? deliveries.length : 0,
      tickersWithDeliveries: uniqueTickerIds(deliveries).length,
    };
  });
}

export function knownTickerRows(
  orgs: AdminOrgListItem[],
  deliveriesByOrg: Record<string, AdminDeliveryItem[]> | null,
): KnownTickerRow[] {
  if (!deliveriesByOrg) return [];
  const rows: KnownTickerRow[] = [];
  for (const org of orgs) {
    const seen = new Set<string>();
    for (const item of deliveriesByOrg[org.id] ?? []) {
      if (!item.tickerId || seen.has(item.tickerId)) continue;
      seen.add(item.tickerId);
      const forTicker = (deliveriesByOrg[org.id] ?? []).filter((row) => row.tickerId === item.tickerId);
      rows.push({
        tickerId: item.tickerId,
        organizationId: org.id,
        organizationName: org.name,
        deliveryCount: forTicker.length,
        latestStatus: item.status,
        latestSnapshotVersion: item.snapshotVersion == null ? "" : String(item.snapshotVersion),
        latestJobId: item.jobId,
      });
    }
  }
  return rows;
}

export function deliveriesForTicker(items: AdminDeliveryItem[], tickerId: string) {
  return items.filter((item) => item.tickerId === tickerId);
}

export function filterDisplayRows(rows: DisplayOrgRow[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    [row.organizationName, row.organizationId].some((value) => value.toLowerCase().includes(needle)),
  );
}

export function filterKnownTickers(rows: KnownTickerRow[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    [row.tickerId, row.organizationName, row.organizationId, row.latestSnapshotVersion].some((value) =>
      value.toLowerCase().includes(needle),
    ),
  );
}
