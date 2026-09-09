import { useMemo } from "react";
import {
  orgNeedsAttention,
  statusClass,
  sumCounts,
  type AdminOrgListItem,
} from "./dashboardData";
import { countDeliveryStatuses, countJobStatuses, knownTickerRows } from "./opsData";
import { useAdminFleetData } from "./useAdminFleetData";

type AdminMonitoringProps = {
  token: string;
  orgs: AdminOrgListItem[];
  listError: string;
  listReady: boolean;
  onOpenOrganization: (id: string) => void;
  onOpenOrganizations: () => void;
  onOpenDevices: () => void;
  onAuthFailure: (status: number, data: { error?: { message?: string } }, fallback: string) => boolean;
};

export function AdminMonitoring({
  token,
  orgs,
  listError,
  listReady,
  onOpenOrganization,
  onOpenOrganizations,
  onOpenDevices,
  onAuthFailure,
}: AdminMonitoringProps) {
  const fleet = useAdminFleetData({ token, orgs, listReady, listError, onAuthFailure });
  const counts = useMemo(() => sumCounts(orgs.map((org) => fleet.details[org.id])), [orgs, fleet.details]);
  const allDeliveries = useMemo(
    () => (fleet.deliveriesByOrg ? Object.values(fleet.deliveriesByOrg).flat() : []),
    [fleet.deliveriesByOrg],
  );
  const allJobs = useMemo(() => (fleet.jobsByOrg ? Object.values(fleet.jobsByOrg).flat() : []), [fleet.jobsByOrg]);
  const deliveryCounts = useMemo(() => countDeliveryStatuses(allDeliveries), [allDeliveries]);
  const jobCounts = useMemo(() => countJobStatuses(allJobs), [allJobs]);
  const knownTickers = useMemo(
    () => knownTickerRows(orgs, fleet.deliveriesByOrg).length,
    [orgs, fleet.deliveriesByOrg],
  );
  const attentionOrgs = useMemo(
    () => orgs.filter((org) => orgNeedsAttention(org, fleet.details[org.id]).attention),
    [orgs, fleet.details],
  );

  if (!listReady) return <p>Loading monitoring…</p>;
  if (listError && orgs.length === 0) return <p className="pp-error">{listError}</p>;

  return (
    <div className="pp-dash">
      <header className="pp-dash__header">
        <div>
          <h1 className="pp-page-title">Monitoring</h1>
          <p className="pp-page-desc">
            Operational state from organization, delivery, and publishing records. Live device heartbeat is not
            available.
          </p>
        </div>
        <div className="pp-dash__header-meta">
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenDevices}>
            Displays
          </button>
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenOrganizations}>
            Organizations
          </button>
        </div>
      </header>

      {listError ? <p className="pp-error pp-dash__banner">{listError}</p> : null}
      {fleet.detailsError ? <p className="pp-error pp-dash__banner">{fleet.detailsError}</p> : null}
      {fleet.deliveriesError ? <p className="pp-error pp-dash__banner">{fleet.deliveriesError}</p> : null}
      {fleet.jobsError ? <p className="pp-error pp-dash__banner">{fleet.jobsError}</p> : null}

      <section className="pp-panel pp-dash__health" aria-labelledby="connectivity">
        <h2 id="connectivity">Connectivity</h2>
        <p className="pp-panel__note">Live device heartbeat is not available on platform admin APIs.</p>
        <ul className="pp-stat-list">
          <li>
            <span className="pp-status pp-status--success">Online</span>
            <span>Not available</span>
          </li>
          <li>
            <span className="pp-status pp-status--neutral">Offline</span>
            <span>Not available</span>
          </li>
          <li>
            <span className="pp-status pp-status--neutral">Last seen</span>
            <span>Not available</span>
          </li>
        </ul>
      </section>

      <section className="pp-panel pp-dash__subs" aria-labelledby="registration">
        <h2 id="registration">Registration and publishing</h2>
        <p className="pp-panel__note">
          These counts are records, not live connectivity. Acknowledged deliveries mean a heartbeat existed at publish
          time, not that the ticker is currently online.
        </p>
        <ul className="pp-stat-list">
          <li>
            <span className="pp-status pp-status--info">Registered</span>
            <strong className="pp-kpi__value pp-kpi__value--inline">{fleet.detailsLoading ? "…" : counts.devices}</strong>
            <span>ticker displays on organization records</span>
          </li>
          <li>
            <span className="pp-status pp-status--info">Known from deliveries</span>
            <strong className="pp-kpi__value pp-kpi__value--inline">
              {fleet.deliveriesLoading ? "…" : fleet.deliveriesByOrg ? knownTickers : "—"}
            </strong>
            <span>unique ticker IDs on delivery records</span>
          </li>
          <li>
            <span className="pp-status pp-status--success">Acknowledged</span>
            <strong className="pp-kpi__value pp-kpi__value--inline">
              {fleet.deliveriesLoading ? "…" : fleet.deliveriesByOrg ? deliveryCounts.acked : "—"}
            </strong>
            <span>delivery records</span>
          </li>
          <li>
            <span className="pp-status pp-status--warning">Pending</span>
            <strong className="pp-kpi__value pp-kpi__value--inline">
              {fleet.deliveriesLoading ? "…" : fleet.deliveriesByOrg ? deliveryCounts.pending : "—"}
            </strong>
            <span>delivery records</span>
          </li>
          <li>
            <span className="pp-status pp-status--info">Publishing jobs</span>
            <strong className="pp-kpi__value pp-kpi__value--inline">
              {fleet.jobsLoading ? "…" : fleet.jobsByOrg ? jobCounts.total : "—"}
            </strong>
            <span>{fleet.jobsByOrg ? `${jobCounts.completed} completed` : "not loaded"}</span>
          </li>
          <li>
            <span className="pp-status pp-status--warning">Attention</span>
            <strong className="pp-kpi__value pp-kpi__value--inline">{fleet.detailsLoading ? "…" : attentionOrgs.length}</strong>
            <span>organizations need review</span>
          </li>
        </ul>
      </section>

      <section className="pp-panel pp-dash__ops" aria-labelledby="org-health">
        <h2 id="org-health">Organizations</h2>
        {orgs.length === 0 && !listError && <p>No organizations.</p>}
        {orgs.length > 0 && (
          <>
            <div className="pp-table-wrap pp-content-table">
              <table className="pp-admin-table">
                <thead>
                  <tr>
                    <th scope="col">Organization</th>
                    <th scope="col">Status</th>
                    <th scope="col">Registered</th>
                    <th scope="col">Delivery records</th>
                    <th scope="col">Acknowledged</th>
                    <th scope="col">Pending</th>
                    <th scope="col">Jobs</th>
                    <th scope="col">Attention</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => {
                    const detail = fleet.details[org.id];
                    const deliveries = fleet.deliveriesByOrg?.[org.id] ?? [];
                    const jobs = fleet.jobsByOrg?.[org.id] ?? [];
                    const delivery = countDeliveryStatuses(deliveries);
                    const attention = orgNeedsAttention(org, detail);
                    return (
                      <tr key={org.id}>
                        <td>
                          <button type="button" className="pp-btn pp-btn--link" onClick={() => onOpenOrganization(org.id)}>
                            {org.name}
                          </button>
                        </td>
                        <td>
                          <span className={statusClass(org.status)}>{org.status}</span>
                        </td>
                        <td className="pp-num">{fleet.detailsLoading && !detail ? "…" : detail ? detail.tickerCount : "—"}</td>
                        <td className="pp-num">
                          {fleet.deliveriesLoading ? "…" : fleet.deliveriesByOrg ? deliveries.length : "—"}
                        </td>
                        <td className="pp-num">{fleet.deliveriesLoading ? "…" : fleet.deliveriesByOrg ? delivery.acked : "—"}</td>
                        <td className="pp-num">
                          {fleet.deliveriesLoading ? "…" : fleet.deliveriesByOrg ? delivery.pending : "—"}
                        </td>
                        <td className="pp-num">{fleet.jobsLoading ? "…" : fleet.jobsByOrg ? jobs.length : "—"}</td>
                        <td>{attention.attention ? attention.reasons.join("; ") : "none"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="pp-stack-list">
              {orgs.map((org) => {
                const detail = fleet.details[org.id];
                const deliveries = fleet.deliveriesByOrg?.[org.id] ?? [];
                const jobs = fleet.jobsByOrg?.[org.id] ?? [];
                const delivery = countDeliveryStatuses(deliveries);
                const attention = orgNeedsAttention(org, detail);
                return (
                  <li key={`stack-${org.id}`}>
                    <article className="pp-stack-item">
                      <h3>{org.name}</h3>
                      <dl className="pp-dl">
                        <dt>Status</dt>
                        <dd>
                          <span className={statusClass(org.status)}>{org.status}</span>
                        </dd>
                        <dt>Registered</dt>
                        <dd>{fleet.detailsLoading && !detail ? "…" : detail ? detail.tickerCount : "—"}</dd>
                        <dt>Delivery records</dt>
                        <dd>{fleet.deliveriesLoading ? "…" : fleet.deliveriesByOrg ? deliveries.length : "—"}</dd>
                        <dt>Acknowledged</dt>
                        <dd>{fleet.deliveriesLoading ? "…" : fleet.deliveriesByOrg ? delivery.acked : "—"}</dd>
                        <dt>Pending</dt>
                        <dd>{fleet.deliveriesLoading ? "…" : fleet.deliveriesByOrg ? delivery.pending : "—"}</dd>
                        <dt>Jobs</dt>
                        <dd>{fleet.jobsLoading ? "…" : fleet.jobsByOrg ? jobs.length : "—"}</dd>
                        <dt>Attention</dt>
                        <dd>{attention.attention ? attention.reasons.join("; ") : "none"}</dd>
                      </dl>
                      <p className="pp-header-actions">
                        <button type="button" className="pp-btn pp-btn--ghost" onClick={() => onOpenOrganization(org.id)}>
                          Open
                        </button>
                      </p>
                    </article>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}
