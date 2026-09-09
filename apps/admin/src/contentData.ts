import type { AdminOrgListItem } from "./dashboardData";
import type { AdminDeliveryItem, AdminJobItem } from "./opsData";

export type PublishedContentKey = {
  organizationId: string;
  contentId: string;
};

export type PublishedContentRow = PublishedContentKey & {
  organizationName: string;
  organizationStatus: string;
  jobCount: number;
  versionCount: number;
  latestVersionId: string;
  latestJobId: string;
  latestJobStatus: string;
  latestTrigger: string;
  latestCreatedAt?: string | Date;
  deliveryCount: number;
  tickerCount: number;
};

export type PublishedVersionRow = {
  versionId: string;
  jobCount: number;
  latestJobId: string;
  latestJobStatus: string;
  latestTrigger: string;
  latestCreatedAt?: string | Date;
  jobs: Array<{
    id: string;
    status: string;
    trigger: string;
    createdAt?: string | Date;
    deliveryCount: number;
    tickerIds: string[];
  }>;
  deliveryCount: number;
  tickerIds: string[];
};

function timeMs(value: string | Date | null | undefined): number | null {
  if (value == null || value === "") return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

function jobTime(job: AdminJobItem) {
  return timeMs(job.createdAt) ?? 0;
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function jobsForOrganization(jobsByOrg: Record<string, AdminJobItem[]> | null, organizationId: string) {
  return (jobsByOrg?.[organizationId] ?? []).filter((job) => Boolean(job.contentId));
}

function deliveriesForJobs(deliveries: AdminDeliveryItem[], jobIds: Set<string>) {
  return deliveries.filter((item) => jobIds.has(item.jobId));
}

export function publishedContentRows(
  orgs: AdminOrgListItem[],
  jobsByOrg: Record<string, AdminJobItem[]> | null,
  deliveriesByOrg: Record<string, AdminDeliveryItem[]> | null,
): PublishedContentRow[] {
  if (!jobsByOrg) return [];
  const rows: PublishedContentRow[] = [];
  for (const org of orgs) {
    const jobs = jobsForOrganization(jobsByOrg, org.id);
    const byContent = new Map<string, AdminJobItem[]>();
    for (const job of jobs) {
      const contentId = job.contentId!;
      const list = byContent.get(contentId) ?? [];
      list.push(job);
      byContent.set(contentId, list);
    }
    for (const [contentId, contentJobs] of byContent) {
      const sorted = [...contentJobs].sort((a, b) => jobTime(b) - jobTime(a));
      const latest = sorted[0];
      if (!latest) continue;
      const jobIds = new Set(sorted.map((job) => job.id));
      const deliveries = deliveriesForJobs(deliveriesByOrg?.[org.id] ?? [], jobIds);
      rows.push({
        organizationId: org.id,
        organizationName: org.name,
        organizationStatus: org.status,
        contentId,
        jobCount: sorted.length,
        versionCount: unique(sorted.map((job) => (job.versionId == null ? "" : String(job.versionId)))).length,
        latestVersionId: latest.versionId == null ? "" : String(latest.versionId),
        latestJobId: latest.id,
        latestJobStatus: latest.status,
        latestTrigger: latest.trigger ?? "",
        latestCreatedAt: latest.createdAt,
        deliveryCount: deliveries.length,
        tickerCount: unique(deliveries.map((item) => item.tickerId)).length,
      });
    }
  }
  rows.sort((a, b) => (timeMs(b.latestCreatedAt) ?? 0) - (timeMs(a.latestCreatedAt) ?? 0));
  return rows;
}

export function publishedVersionsForContent(
  organizationId: string,
  contentId: string,
  jobsByOrg: Record<string, AdminJobItem[]> | null,
  deliveriesByOrg: Record<string, AdminDeliveryItem[]> | null,
): PublishedVersionRow[] {
  if (!jobsByOrg) return [];
  const jobs = jobsForOrganization(jobsByOrg, organizationId).filter((job) => job.contentId === contentId);
  const byVersion = new Map<string, AdminJobItem[]>();
  for (const job of jobs) {
    const versionId = job.versionId == null ? "" : String(job.versionId);
    const list = byVersion.get(versionId) ?? [];
    list.push(job);
    byVersion.set(versionId, list);
  }
  const deliveries = deliveriesByOrg?.[organizationId] ?? [];
  const rows: PublishedVersionRow[] = [];
  for (const [versionId, versionJobs] of byVersion) {
    const sortedJobs = [...versionJobs].sort((a, b) => jobTime(b) - jobTime(a));
    const mappedJobs = sortedJobs.map((job) => {
      const jobDeliveries = deliveries.filter((item) => item.jobId === job.id);
      return {
        id: job.id,
        status: job.status,
        trigger: job.trigger ?? "",
        createdAt: job.createdAt,
        deliveryCount: jobDeliveries.length,
        tickerIds: unique(jobDeliveries.map((item) => item.tickerId)),
      };
    });
    const tickerIds = unique(mappedJobs.flatMap((job) => job.tickerIds));
    rows.push({
      versionId,
      jobCount: mappedJobs.length,
      latestJobId: mappedJobs[0]?.id ?? "",
      latestJobStatus: mappedJobs[0]?.status ?? "",
      latestTrigger: mappedJobs[0]?.trigger ?? "",
      latestCreatedAt: mappedJobs[0]?.createdAt,
      jobs: mappedJobs,
      deliveryCount: mappedJobs.reduce((sum, job) => sum + job.deliveryCount, 0),
      tickerIds,
    });
  }
  rows.sort((a, b) => (timeMs(b.latestCreatedAt) ?? 0) - (timeMs(a.latestCreatedAt) ?? 0));
  return rows;
}

export function filterPublishedContent(rows: PublishedContentRow[], query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    [
      row.contentId,
      row.organizationName,
      row.organizationId,
      row.latestVersionId,
      row.latestJobId,
    ].some((value) => value.toLowerCase().includes(needle)),
  );
}

export function findPublishedContent(
  rows: PublishedContentRow[],
  key: PublishedContentKey | null,
) {
  if (!key) return null;
  return rows.find((row) => row.organizationId === key.organizationId && row.contentId === key.contentId) ?? null;
}
