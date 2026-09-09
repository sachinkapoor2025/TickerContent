import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ANALYTICS_ACTIVITY_LIMIT,
  HISTORICAL_BOUNDARIES,
  OPERATIONAL_SURFACES,
  availabilityLabel,
  availabilityTone,
  deliverySnapshotRows,
  jobSnapshotRows,
} from "./analyticsData";
import {
  formatWhen,
  mergeRecentActivity,
  statusClass,
  subscriptionOverview,
  sumCounts,
  type AdminAuditItem,
  type AdminOrgListItem,
} from "./dashboardData";
import { useAdminFleetData } from "./useAdminFleetData";

type AdminAnalyticsProps = {
  token: string;
  orgs: AdminOrgListItem[];
  listError: string;
  listReady: boolean;
  onOpenDashboard: () => void;
  onOpenMonitoring: () => void;
  onOpenDisplayContent: () => void;
  onOpenOrganizations: () => void;
  onOpenOrganization: (id: string) => void;
  onOpenDisplays: () => void;
  onOpenSubscriptions: () => void;
  onAuthFailure: (status: number, data: { error?: { message?: string } }, fallback: string) => boolean;
};

export function AdminAnalytics({
  token,
  orgs,
  listError,
  listReady,
  onOpenDashboard,
  onOpenMonitoring,
  onOpenDisplayContent,
  onOpenOrganizations,
  onOpenOrganization,
  onOpenDisplays,
  onOpenSubscriptions,
  onAuthFailure,
}: AdminAnalyticsProps) {
  const fleet = useAdminFleetData({ token, orgs, listReady, listError, onAuthFailure });
  const [auditsByOrg, setAuditsByOrg] = useState<Record<string, AdminAuditItem[]> | null>(null);
  const [auditsLoading, setAuditsLoading] = useState(true);
  const [auditsError, setAuditsError] = useState("");
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!token || !listReady) return;
    let cancelled = false;
    (async () => {
      if (orgs.length === 0) {
        setAuditsByOrg(listError ? null : {});
        setAuditsError("");
        setAuditsLoading(false);
        setLoadedAt(listError ? null : new Date());
        return;
      }
      setAuditsLoading(true);
      setAuditsError("");
      const nextAudits: Record<string, AdminAuditItem[]> = {};
      let auditFailed = false;
      await Promise.all(
        orgs.map(async (org) => {
          const res = await fetch(`/v1/admin/organizations/${org.id}/audit-logs`, {
            headers: { authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (res.status === 401 || res.status === 403) {
            onAuthFailure(res.status, data, "Could not load audit activity.");
            return;
          }
          if (!res.ok) {
            auditFailed = true;
            return;
          }
          nextAudits[org.id] = Array.isArray(data.items) ? data.items : [];
        }),
      );
      if (cancelled) return;
      setAuditsLoading(false);
      if (auditFailed) {
        setAuditsByOrg(null);
        setAuditsError("Could not load recent activity.");
      } else {
        setAuditsByOrg(nextAudits);
        setAuditsError("");
      }
      setLoadedAt(new Date());
    })();
    return () => {
      cancelled = true;
    };
  }, [token, orgs, listError, listReady]);

  const subs = useMemo(() => subscriptionOverview(orgs), [orgs]);
  const counts = useMemo(() => sumCounts(orgs.map((org) => fleet.details[org.id])), [orgs, fleet.details]);
  const allJobs = useMemo(() => (fleet.jobsByOrg ? Object.values(fleet.jobsByOrg).flat() : []), [fleet.jobsByOrg]);
  const allDeliveries = useMemo(
    () => (fleet.deliveriesByOrg ? Object.values(fleet.deliveriesByOrg).flat() : []),
    [fleet.deliveriesByOrg],
  );
  const jobRows = useMemo(() => jobSnapshotRows(allJobs), [allJobs]);
  const deliveryRows = useMemo(() => deliverySnapshotRows(allDeliveries), [allDeliveries]);
  const activity = useMemo(
    () => (auditsByOrg ? mergeRecentActivity(orgs, auditsByOrg, ANALYTICS_ACTIVITY_LIMIT) : []),
    [orgs, auditsByOrg],
  );

  function openSurface(id: string) {
    if (id === "dashboard") onOpenDashboard();
    if (id === "organizations") onOpenOrganizations();
    if (id === "devices") onOpenDisplays();
    if (id === "monitoring") onOpenMonitoring();
    if (id === "display-content") onOpenDisplayContent();
    if (id === "subscriptions") onOpenSubscriptions();
  }

  if (!listReady) return <p>Loading analytics…</p>;
  if (listError && orgs.length === 0) return <p className="pp-error">{listError}</p>;

  return (
    <div className="pp-dash">
      <header className="pp-dash__header">
        <div>
          <h1 className="pp-page-title">Analytics</h1>
          <p className="pp-page-desc">
            Operational metrics from current organization, publishing, delivery, and subscription records. Historical
            usage and display telemetry are not available in the current MVP.
          </p>
        </div>
        <div className="pp-dash__header-meta">
          {loadedAt ? <p className="pp-dash__updated">Loaded {loadedAt.toLocaleString()}</p> : null}
          <div className="pp-header-actions">
            <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenDashboard}>
              Dashboard
            </button>
            <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenMonitoring}>
              Monitoring
            </button>
            <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenOrganizations}>
              Organizations
            </button>
            <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenSubscriptions}>
              Subscriptions
            </button>
          </div>
        </div>
      </header>

      {listError ? <p className="pp-error pp-dash__banner">{listError}</p> : null}
      {fleet.detailsError ? <p className="pp-error pp-dash__banner">{fleet.detailsError}</p> : null}
      {fleet.jobsError ? <p className="pp-error pp-dash__banner">{fleet.jobsError}</p> : null}
      {fleet.deliveriesError ? <p className="pp-error pp-dash__banner">{fleet.deliveriesError}</p> : null}

      <section className="pp-kpi pp-kpi--sixth" aria-labelledby="analytics-kpi-orgs">
        <h2 id="analytics-kpi-orgs">Organizations</h2>
        <p className="pp-kpi__value">{orgs.length}</p>
        <p className="pp-kpi__meta">Organizations currently loaded from Admin APIs</p>
      </section>
      <section className="pp-kpi pp-kpi--sixth" aria-labelledby="analytics-kpi-users">
        <h2 id="analytics-kpi-users">Users</h2>
        <p className="pp-kpi__value">{fleet.detailsLoading ? "…" : counts.users}</p>
        <p className="pp-kpi__meta">Memberships across loaded organization details</p>
      </section>
      <section className="pp-kpi pp-kpi--sixth" aria-labelledby="analytics-kpi-displays">
        <h2 id="analytics-kpi-displays">Displays</h2>
        <p className="pp-kpi__value">{fleet.detailsLoading ? "…" : counts.devices}</p>
        <p className="pp-kpi__meta">Registered ticker displays across loaded organizations</p>
      </section>
      <section className="pp-kpi pp-kpi--sixth" aria-labelledby="analytics-kpi-jobs">
        <h2 id="analytics-kpi-jobs">Publishing jobs</h2>
        <p className="pp-kpi__value">{fleet.jobsLoading ? "…" : fleet.jobsByOrg ? allJobs.length : "—"}</p>
        <p className="pp-kpi__meta">Latest 100 publishing jobs per organization</p>
      </section>
      <section className="pp-kpi pp-kpi--sixth" aria-labelledby="analytics-kpi-deliveries">
        <h2 id="analytics-kpi-deliveries">Delivery records</h2>
        <p className="pp-kpi__value">
          {fleet.deliveriesLoading ? "…" : fleet.deliveriesByOrg ? allDeliveries.length : "—"}
        </p>
        <p className="pp-kpi__meta">Latest 100 delivery records per organization</p>
      </section>
      <section className="pp-kpi pp-kpi--sixth" aria-labelledby="analytics-kpi-subs">
        <h2 id="analytics-kpi-subs">Active subscriptions</h2>
        <p className="pp-kpi__value">{subs.active}</p>
        <p className="pp-kpi__meta">Active, trialing, or grace subscriptions on loaded organizations</p>
      </section>

      <section className="pp-panel pp-dash__third" aria-labelledby="analytics-jobs">
        <h2 id="analytics-jobs">Publishing job status</h2>
        <p className="pp-panel__note">
          Counts use the status stored on each loaded job. Current publish writes completed. This is not a historical
          trend.
        </p>
        {fleet.jobsLoading ? <p>Loading publishing jobs…</p> : null}
        {!fleet.jobsLoading && !fleet.jobsByOrg ? <p>Publishing jobs could not be loaded.</p> : null}
        {!fleet.jobsLoading && fleet.jobsByOrg && jobRows.length === 0 ? (
          <p>No publishing jobs in the current records.</p>
        ) : null}
        {!fleet.jobsLoading && fleet.jobsByOrg && jobRows.length > 0 ? (
          <ul className="pp-stat-list">
            {jobRows.map((row) => (
              <li key={row.status}>
                <span className={statusClass(row.status)}>{row.status}</span>
                <strong className="pp-kpi__value pp-kpi__value--inline">{row.count}</strong>
                <span>job records</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="pp-panel pp-dash__third" aria-labelledby="analytics-deliveries">
        <h2 id="analytics-deliveries">Current delivery records</h2>
        <p className="pp-panel__note">
          Acked and pending are the statuses written at publish time. Additional statuses appear only if present. This
          is not a delivery success rate.
        </p>
        {fleet.deliveriesLoading ? <p>Loading delivery records…</p> : null}
        {!fleet.deliveriesLoading && !fleet.deliveriesByOrg ? <p>Delivery records could not be loaded.</p> : null}
        {!fleet.deliveriesLoading && fleet.deliveriesByOrg ? (
          <ul className="pp-stat-list">
            {deliveryRows.map((row) => (
              <li key={row.status}>
                <span className={statusClass(row.status)}>{row.status}</span>
                <strong className="pp-kpi__value pp-kpi__value--inline">{row.count}</strong>
                <span>delivery records</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="pp-panel pp-dash__third" aria-labelledby="analytics-subs">
        <h2 id="analytics-subs">Subscription status</h2>
        <p className="pp-panel__note">
          Same current-state buckets as Dashboard. Expiring means the period ends within 14 days.
        </p>
        <ul className="pp-stat-list">
          <li>
            <span className="pp-status pp-status--success">Active</span>
            <strong className="pp-kpi__value pp-kpi__value--inline">{subs.active}</strong>
          </li>
          <li>
            <span className="pp-status pp-status--warning">Expiring</span>
            <strong className="pp-kpi__value pp-kpi__value--inline">{subs.expiring}</strong>
            <span>period ends within 14 days</span>
          </li>
          <li>
            <span className="pp-status pp-status--warning">Suspended</span>
            <strong className="pp-kpi__value pp-kpi__value--inline">{subs.suspended}</strong>
          </li>
          <li>
            <span className="pp-status pp-status--error">Cancelled</span>
            <strong className="pp-kpi__value pp-kpi__value--inline">{subs.cancelled}</strong>
          </li>
          {subs.none > 0 ? (
            <li>
              <span className="pp-status pp-status--neutral">None</span>
              <strong className="pp-kpi__value pp-kpi__value--inline">{subs.none}</strong>
            </li>
          ) : null}
          {subs.other > 0 ? (
            <li>
              <span className="pp-status pp-status--neutral">Other</span>
              <strong className="pp-kpi__value pp-kpi__value--inline">{subs.other}</strong>
              <span>expired, past due, or incomplete</span>
            </li>
          ) : null}
        </ul>
      </section>

      <section className="pp-panel pp-dash__activity" aria-labelledby="analytics-activity">
        <h2 id="analytics-activity">Recent operational activity</h2>
        <p className="pp-panel__note">
          Latest audit events from organization Admin APIs, newest first. Capped at {ANALYTICS_ACTIVITY_LIMIT} rows here.
          Dashboard lists a longer recent set.
        </p>
        {auditsLoading ? <p>Loading audit activity…</p> : null}
        {auditsError ? <p className="pp-error">{auditsError}</p> : null}
        {!auditsLoading && !auditsError && auditsByOrg && activity.length === 0 ? <p>No audit activity.</p> : null}
        {!auditsLoading && !auditsError && activity.length > 0 ? (
          <>
            <div className="pp-table-wrap pp-content-table">
              <table className="pp-admin-table">
                <caption className="pp-sr-only">Recent organization audit events</caption>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">Organization</th>
                    <th scope="col">Action</th>
                    <th scope="col">Actor</th>
                    <th scope="col">Target</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatWhen(entry.createdAt)}</td>
                      <td>
                        {entry.organizationId ? (
                          <button
                            type="button"
                            className="pp-btn pp-btn--link"
                            onClick={() => onOpenOrganization(entry.organizationId!)}
                          >
                            {entry.organizationName}
                          </button>
                        ) : (
                          entry.organizationName
                        )}
                      </td>
                      <td>{entry.action}</td>
                      <td>{entry.actorUserId ?? ""}</td>
                      <td>{[entry.resourceType, entry.resourceId].filter(Boolean).join(" ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="pp-stack-list">
              {activity.map((entry) => (
                <li key={`stack-${entry.id}`}>
                  <article className="pp-stack-item">
                    <h3>{entry.action}</h3>
                    <dl className="pp-dl">
                      <dt>When</dt>
                      <dd>{formatWhen(entry.createdAt) || "—"}</dd>
                      <dt>Organization</dt>
                      <dd>
                        {entry.organizationId ? (
                          <button
                            type="button"
                            className="pp-btn pp-btn--link"
                            onClick={() => onOpenOrganization(entry.organizationId!)}
                          >
                            {entry.organizationName}
                          </button>
                        ) : (
                          entry.organizationName
                        )}
                      </dd>
                      <dt>Actor</dt>
                      <dd>{entry.actorUserId || "—"}</dd>
                      <dt>Target</dt>
                      <dd>{[entry.resourceType, entry.resourceId].filter(Boolean).join(" ") || "—"}</dd>
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section className="pp-panel pp-dash__ops" aria-labelledby="analytics-historical">
        <h2 id="analytics-historical">Historical analytics</h2>
        <p className="pp-panel__note">
          Job and audit rows include createdAt, but each Admin endpoint returns at most 100 records per organization.
          Delivery records have no timestamp. That is not a time-series store.
        </p>
        <dl className="pp-dl">
          {HISTORICAL_BOUNDARIES.map((item) => (
            <Fragment key={item.id}>
              <dt>{item.topic}</dt>
              <dd>
                <div className="pp-org-cell__name">
                  <span className={`pp-status pp-status--${availabilityTone(item.availability)}`}>
                    {availabilityLabel(item.availability)}
                  </span>
                  <span className="pp-org-cell__slug">{item.evidence}</span>
                </div>
              </dd>
            </Fragment>
          ))}
        </dl>
      </section>

      <section className="pp-panel pp-dash__ops" aria-labelledby="analytics-related">
        <h2 id="analytics-related">Related operational views</h2>
        <p className="pp-panel__note">
          Use these screens for the underlying records. Organization audit remains on Organization detail. Audit Logs is
          not a separate Admin workspace in this MVP.
        </p>
        <div className="pp-table-wrap pp-content-table">
          <table className="pp-admin-table">
            <caption className="pp-sr-only">Existing Admin screens for operational records</caption>
            <thead>
              <tr>
                <th scope="col">Screen</th>
                <th scope="col">What it shows</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {OPERATIONAL_SURFACES.map((surface) => (
                <tr key={surface.id}>
                  <td>{surface.label}</td>
                  <td>{surface.summary}</td>
                  <td>
                    <button type="button" className="pp-btn pp-btn--ghost" onClick={() => openSurface(surface.id)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="pp-stack-list">
          {OPERATIONAL_SURFACES.map((surface) => (
            <li key={`stack-${surface.id}`}>
              <article className="pp-stack-item">
                <h3>{surface.label}</h3>
                <p className="pp-page-desc">{surface.summary}</p>
                <p className="pp-header-actions">
                  <button type="button" className="pp-btn pp-btn--ghost" onClick={() => openSurface(surface.id)}>
                    Open {surface.label}
                  </button>
                </p>
              </article>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
