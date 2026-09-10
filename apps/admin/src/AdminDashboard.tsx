import { useEffect, useMemo, useState } from "react";
import {
  formatWhen,
  mergeRecentActivity,
  orgNeedsAttention,
  statusClass,
  subscriptionOverview,
  sumCounts,
  type AdminAuditItem,
  type AdminOrgDetail,
  type AdminOrgListItem,
} from "./dashboardData";

type AdminDashboardProps = {
  token: string;
  orgs: AdminOrgListItem[];
  listError: string;
  listReady: boolean;
  onOpenOrganization: (id: string) => void;
  onOpenOrganizations: () => void;
  onAuthFailure: (status: number, data: { error?: { message?: string } }, fallback: string) => boolean;
};

export function AdminDashboard({
  token,
  orgs,
  listError,
  listReady,
  onOpenOrganization,
  onOpenOrganizations,
  onAuthFailure,
}: AdminDashboardProps) {
  const [details, setDetails] = useState<Record<string, AdminOrgDetail>>({});
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState("");
  const [auditsByOrg, setAuditsByOrg] = useState<Record<string, AdminAuditItem[]> | null>(null);
  const [auditsLoading, setAuditsLoading] = useState(true);
  const [auditsError, setAuditsError] = useState("");
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!token || !listReady) return;
    let cancelled = false;
    (async () => {
      if (orgs.length === 0) {
        setDetails({});
        setDetailsError("");
        setDetailsLoading(false);
        setAuditsByOrg(listError ? null : {});
        setAuditsError("");
        setAuditsLoading(false);
        setLoadedAt(listError ? null : new Date());
        return;
      }
      setDetailsLoading(true);
      setAuditsLoading(true);
      setDetailsError("");
      setAuditsError("");
      const nextDetails: Record<string, AdminOrgDetail> = {};
      let detailFailed = false;
      await Promise.all(
        orgs.map(async (org) => {
          const res = await fetch(`/v1/admin/organizations/${org.id}`, {
            headers: { authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (res.status === 401 || res.status === 403) {
            onAuthFailure(res.status, data, "Could not load organization.");
            return;
          }
          if (!res.ok) {
            detailFailed = true;
            return;
          }
          nextDetails[org.id] = data as AdminOrgDetail;
        }),
      );
      if (cancelled) return;
      setDetails(nextDetails);
      setDetailsLoading(false);
      if (detailFailed) setDetailsError("Some organization details could not be loaded.");

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
  const counts = useMemo(() => sumCounts(orgs.map((org) => details[org.id])), [orgs, details]);
  const attentionOrgs = useMemo(
    () => orgs.filter((org) => orgNeedsAttention(org, details[org.id]).attention),
    [orgs, details],
  );
  const activity = useMemo(
    () => (auditsByOrg ? mergeRecentActivity(orgs, auditsByOrg) : []),
    [orgs, auditsByOrg],
  );

  if (!listReady) {
    return <p>Loading dashboard…</p>;
  }

  if (listError && orgs.length === 0) {
    return <p className="pp-error">{listError}</p>;
  }

  return (
    <div className="pp-dash">
      <header className="pp-dash__header">
        <div>
          <h1 className="pp-page-title">Dashboard</h1>
          <p className="pp-page-desc">Platform operations overview from current organization records.</p>
        </div>
        <div className="pp-dash__header-meta">
          {loadedAt ? <p className="pp-dash__updated">Loaded {loadedAt.toLocaleString()}</p> : null}
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenOrganizations}>
            Organizations
          </button>
        </div>
      </header>

      <section className="pp-kpi pp-kpi--orgs" aria-labelledby="kpi-orgs">
        <h2 id="kpi-orgs">Organizations</h2>
        <p className="pp-kpi__value">{orgs.length}</p>
        <p className="pp-kpi__meta">{orgs.filter((org) => org.status === "active").length} active</p>
      </section>
      <section className="pp-kpi" aria-labelledby="kpi-users">
        <h2 id="kpi-users">Users</h2>
        <p className="pp-kpi__value">{detailsLoading ? "…" : counts.users}</p>
        <p className="pp-kpi__meta">Memberships across loaded organizations</p>
      </section>
      <section className="pp-kpi" aria-labelledby="kpi-devices">
        <h2 id="kpi-devices">Displays</h2>
        <p className="pp-kpi__value">{detailsLoading ? "…" : counts.devices}</p>
        <p className="pp-kpi__meta">Ticker displays registered to organizations</p>
      </section>
      <section className="pp-kpi" aria-labelledby="kpi-subs">
        <h2 id="kpi-subs">Subscriptions</h2>
        <p className="pp-kpi__value">{orgs.filter((org) => org.subscription).length}</p>
        <p className="pp-kpi__meta">{subs.active} active</p>
      </section>

      {detailsError ? <p className="pp-error pp-dash__banner">{detailsError}</p> : null}

      <section className="pp-panel pp-dash__health" aria-labelledby="device-health">
        <h2 id="device-health">Display health</h2>
        <p className="pp-panel__note">
          Online and offline heartbeat is not available on platform admin APIs. Registered counts use organization ticker
          totals. Attention uses organization and subscription records.
        </p>
        <ul className="pp-stat-list">
          <li>
            <span className="pp-status pp-status--info">Registered</span>
            <strong className="pp-kpi__value pp-kpi__value--inline">{detailsLoading ? "…" : counts.devices}</strong>
          </li>
          <li>
            <span className="pp-status pp-status--success">Online</span>
            <span>Not available</span>
          </li>
          <li>
            <span className="pp-status pp-status--warning">Attention</span>
            <strong className="pp-kpi__value pp-kpi__value--inline">{attentionOrgs.length}</strong>
            <span>organizations need review</span>
          </li>
          <li>
            <span className="pp-status pp-status--neutral">Offline</span>
            <span>Not available</span>
          </li>
        </ul>
      </section>

      <section className="pp-panel pp-dash__subs" aria-labelledby="sub-overview">
        <h2 id="sub-overview">Subscription overview</h2>
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

      <section className="pp-panel pp-dash__activity" aria-labelledby="recent-activity">
        <h2 id="recent-activity">Recent activity</h2>
        {auditsLoading && <p>Loading audit activity…</p>}
        {auditsError && <p className="pp-error">{auditsError}</p>}
        {!auditsLoading && !auditsError && auditsByOrg && activity.length === 0 && <p>No audit activity.</p>}
        {!auditsLoading && !auditsError && activity.length > 0 && (
          <>
            <div className="pp-table-wrap pp-content-table">
              <table className="pp-admin-table">
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
                          <button type="button" className="pp-btn pp-btn--link" onClick={() => onOpenOrganization(entry.organizationId!)}>
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
                      <dd>{formatWhen(entry.createdAt)}</dd>
                      <dt>Organization</dt>
                      <dd>
                        {entry.organizationId ? (
                          <button type="button" className="pp-btn pp-btn--link" onClick={() => onOpenOrganization(entry.organizationId!)}>
                            {entry.organizationName}
                          </button>
                        ) : (
                          entry.organizationName
                        )}
                      </dd>
                      <dt>Actor</dt>
                      <dd>{entry.actorUserId || "none"}</dd>
                      <dt>Target</dt>
                      <dd>{[entry.resourceType, entry.resourceId].filter(Boolean).join(" ") || "none"}</dd>
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="pp-panel pp-dash__ops" aria-labelledby="ops-overview">
        <h2 id="ops-overview">Organization operations</h2>
        {orgs.length === 0 && !listError && <p>No organizations.</p>}
        {orgs.length > 0 && (
          <>
            <div className="pp-table-wrap pp-content-table">
              <table className="pp-admin-table">
                <thead>
                  <tr>
                    <th scope="col">Organization</th>
                    <th scope="col">Status</th>
                    <th scope="col">Members</th>
                    <th scope="col">Displays</th>
                    <th scope="col">Subscription</th>
                    <th scope="col">Attention</th>
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => {
                    const detail = details[org.id];
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
                        <td className="pp-num">{detailsLoading && !detail ? "…" : detail ? detail.memberCount : "—"}</td>
                        <td className="pp-num">{detailsLoading && !detail ? "…" : detail ? detail.tickerCount : "—"}</td>
                        <td>
                          {org.subscription?.status ? (
                            <span className={statusClass(org.subscription.status)}>{org.subscription.status}</span>
                          ) : (
                            "none"
                          )}
                        </td>
                        <td>{attention.attention ? attention.reasons.join("; ") : "none"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="pp-stack-list">
              {orgs.map((org) => {
                const detail = details[org.id];
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
                        <dt>Members</dt>
                        <dd>{detailsLoading && !detail ? "…" : detail ? detail.memberCount : "—"}</dd>
                        <dt>Displays</dt>
                        <dd>{detailsLoading && !detail ? "…" : detail ? detail.tickerCount : "—"}</dd>
                        <dt>Subscription</dt>
                        <dd>
                          {org.subscription?.status ? (
                            <span className={statusClass(org.subscription.status)}>{org.subscription.status}</span>
                          ) : (
                            "none"
                          )}
                        </dd>
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
