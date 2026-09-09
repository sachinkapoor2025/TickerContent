import { useEffect, useMemo, useState } from "react";
import {
  filterOrganizations,
  organizationStatuses,
  statusClass,
  type AdminOrgDetail,
  type AdminOrgListItem,
} from "./dashboardData";

type AdminOrganizationsProps = {
  token: string;
  orgs: AdminOrgListItem[];
  listError: string;
  listReady: boolean;
  statusBusy: boolean;
  onOpenOrganization: (id: string) => void;
  onToggleStatus: (org: { id: string; status: string }) => void;
  onAuthFailure: (status: number, data: { error?: { message?: string } }, fallback: string) => boolean;
};

function planLabel(org: AdminOrgListItem, detail?: AdminOrgDetail) {
  if (detail?.plan?.name) return detail.plan.name;
  if (org.subscription?.planId) return org.subscription.planId;
  return "none";
}

export function AdminOrganizations({
  token,
  orgs,
  listError,
  listReady,
  statusBusy,
  onOpenOrganization,
  onToggleStatus,
  onAuthFailure,
}: AdminOrganizationsProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [details, setDetails] = useState<Record<string, AdminOrgDetail>>({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  useEffect(() => {
    if (!token || !listReady) return;
    let cancelled = false;
    (async () => {
      if (orgs.length === 0) {
        setDetails({});
        setDetailsError("");
        setDetailsLoading(false);
        return;
      }
      setDetailsLoading(true);
      setDetailsError("");
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
    })();
    return () => {
      cancelled = true;
    };
  }, [token, orgs, listReady]);

  const statuses = useMemo(() => organizationStatuses(orgs), [orgs]);
  const filtered = useMemo(() => filterOrganizations(orgs, query, statusFilter), [orgs, query, statusFilter]);
  const filtering = query.trim() !== "" || statusFilter !== "all";

  if (!listReady) {
    return <p>Loading organizations…</p>;
  }

  if (listError && orgs.length === 0) {
    return <p className="pp-error">{listError}</p>;
  }

  return (
    <div className="pp-orgs">
      <header className="pp-orgs__header">
        <div>
          <h1 className="pp-page-title">Organizations</h1>
          <p className="pp-page-desc">Find a customer organization, inspect status and plan, then open it for members, audit, and publishing.</p>
        </div>
        <p className="pp-orgs__count">
          {filtering ? `Showing ${filtered.length} of ${orgs.length}` : `${orgs.length}`}{" "}
          {orgs.length === 1 ? "organization" : "organizations"}
        </p>
      </header>

      {listError ? <p className="pp-error">{listError}</p> : null}
      {detailsError ? <p className="pp-error">{detailsError}</p> : null}

      <div className="pp-orgs__filters">
        <div className="pp-orgs__filter">
          <label className="pp-field" htmlFor="org-search">
            Search
          </label>
          <input
            id="org-search"
            className="pp-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, slug, or ID"
            autoComplete="off"
          />
        </div>
        <div className="pp-orgs__filter">
          <label className="pp-field" htmlFor="org-status-filter">
            Status
          </label>
          <select
            id="org-status-filter"
            className="pp-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <section className="pp-panel" aria-labelledby="orgs-table-heading">
        <h2 id="orgs-table-heading" className="pp-sr-only">
          Organization list
        </h2>
        {orgs.length === 0 && <p>No organizations.</p>}
        {orgs.length > 0 && filtered.length === 0 && <p>No organizations match this search.</p>}
        {filtered.length > 0 && (
          <>
            <div className="pp-table-wrap pp-content-table">
              <table className="pp-admin-table">
                <caption className="pp-sr-only">Organizations currently loaded from the admin API</caption>
                <thead>
                  <tr>
                    <th scope="col">Organization</th>
                    <th scope="col">Status</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Members</th>
                    <th scope="col">Displays</th>
                    <th scope="col">Subscription</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((org) => {
                    const detail = details[org.id];
                    return (
                      <tr key={org.id}>
                        <td>
                          <div className="pp-org-cell__name">
                            <button type="button" className="pp-btn pp-btn--link" onClick={() => onOpenOrganization(org.id)}>
                              {org.name}
                            </button>
                            {org.slug ? <span className="pp-org-cell__slug">{org.slug}</span> : null}
                          </div>
                        </td>
                        <td>
                          <span className={statusClass(org.status)}>{org.status}</span>
                        </td>
                        <td>{detailsLoading && !detail ? "…" : planLabel(org, detail)}</td>
                        <td className="pp-num">{detailsLoading && !detail ? "…" : detail ? detail.memberCount : "—"}</td>
                        <td className="pp-num">{detailsLoading && !detail ? "…" : detail ? detail.tickerCount : "—"}</td>
                        <td>
                          {org.subscription?.status ? (
                            <span className={statusClass(org.subscription.status)}>{org.subscription.status}</span>
                          ) : (
                            "none"
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={org.status === "suspended" ? "pp-btn pp-btn--ghost" : "pp-btn pp-btn--danger"}
                            disabled={statusBusy}
                            onClick={() => onToggleStatus(org)}
                          >
                            {statusBusy ? "Updating…" : org.status === "suspended" ? "Activate" : "Suspend"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ul className="pp-stack-list">
              {filtered.map((org) => {
                const detail = details[org.id];
                return (
                  <li key={`stack-${org.id}`}>
                    <article className="pp-stack-item">
                      <h3>{org.name}</h3>
                      <dl className="pp-dl">
                        <dt>Status</dt>
                        <dd>
                          <span className={statusClass(org.status)}>{org.status}</span>
                        </dd>
                        <dt>Plan</dt>
                        <dd>{detailsLoading && !detail ? "…" : planLabel(org, detail)}</dd>
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
                      </dl>
                      <p className="pp-header-actions">
                        <button type="button" className="pp-btn pp-btn--ghost" onClick={() => onOpenOrganization(org.id)}>
                          Open
                        </button>
                        <button
                          type="button"
                          className={org.status === "suspended" ? "pp-btn pp-btn--ghost" : "pp-btn pp-btn--danger"}
                          disabled={statusBusy}
                          onClick={() => onToggleStatus(org)}
                        >
                          {statusBusy ? "Updating…" : org.status === "suspended" ? "Activate" : "Suspend"}
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
