import { useMemo, useState } from "react";
import { filterPlanRows, findPlan, planRows, type PlanRow } from "./billingData";
import { statusClass, type AdminOrgListItem } from "./dashboardData";
import { useAdminOrgDetails } from "./useAdminOrgDetails";

type AdminPlansProps = {
  token: string;
  orgs: AdminOrgListItem[];
  listError: string;
  listReady: boolean;
  onOpenOrganization: (id: string) => void;
  onOpenSubscriptions: () => void;
  onAuthFailure: (status: number, data: { error?: { message?: string } }, fallback: string) => boolean;
};

export function AdminPlans({
  token,
  orgs,
  listError,
  listReady,
  onOpenOrganization,
  onOpenSubscriptions,
  onAuthFailure,
}: AdminPlansProps) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const loaded = useAdminOrgDetails({ token, orgs, listReady, listError, onAuthFailure });
  const rows = useMemo(() => planRows(orgs, loaded.details), [orgs, loaded.details]);
  const filtered = useMemo(() => filterPlanRows(rows, query), [rows, query]);
  const selected = findPlan(rows, selectedId);
  const filtering = query.trim() !== "";

  if (!listReady) return <p>Loading plans…</p>;
  if (listError && orgs.length === 0) return <p className="pp-error">{listError}</p>;

  if (selected) {
    return (
      <PlanDetail
        row={selected}
        onBack={() => setSelectedId(null)}
        onOpenOrganization={onOpenOrganization}
        onOpenSubscriptions={onOpenSubscriptions}
      />
    );
  }

  return (
    <div className="pp-orgs">
      <header className="pp-orgs__header">
        <div>
          <h1 className="pp-page-title">Plans</h1>
          <p className="pp-page-desc">
            There is no Admin plan catalog API. This list is inferred from plans currently attached to organizations.
            Unused catalog plans are not returned.
          </p>
        </div>
        <div className="pp-header-actions">
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenSubscriptions}>
            Subscriptions
          </button>
        </div>
      </header>

      {listError ? <p className="pp-error">{listError}</p> : null}
      {loaded.error ? <p className="pp-error">{loaded.error}</p> : null}

      <div className="pp-orgs__filters">
        <label className="pp-orgs__filter">
          <span className="pp-field">Search</span>
          <input
            className="pp-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Plan, code, or organization"
            autoComplete="off"
          />
        </label>
      </div>

      <section className="pp-panel" aria-labelledby="plan-list">
        <h2 id="plan-list">Assigned plans</h2>
        <p className="pp-panel__note">
          {loaded.loading
            ? "Loading organization details…"
            : filtering
              ? `Showing ${filtered.length} of ${rows.length} plans`
              : `${rows.length} ${rows.length === 1 ? "plan" : "plans"} in use`}
        </p>
        {!loaded.loading && filtered.length === 0 && (
          <p>{filtering ? "No plans match this search." : "No organizations have an assigned plan."}</p>
        )}
        {filtered.length > 0 && (
          <>
            <div className="pp-table-wrap pp-content-table">
              <table className="pp-admin-table">
                <caption className="pp-sr-only">Plans currently attached to organizations</caption>
                <thead>
                  <tr>
                    <th scope="col">Plan</th>
                    <th scope="col">Code</th>
                    <th scope="col">Organizations</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.planId}>
                      <td>
                        <div className="pp-org-cell__name">
                          <button type="button" className="pp-btn pp-btn--link" onClick={() => setSelectedId(row.planId)}>
                            {row.name || row.planId}
                          </button>
                          <span className="pp-org-cell__slug">{row.planId}</span>
                        </div>
                      </td>
                      <td>{row.code || "—"}</td>
                      <td className="pp-num">{row.organizationCount}</td>
                      <td>
                        <button type="button" className="pp-btn pp-btn--ghost" onClick={() => setSelectedId(row.planId)}>
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="pp-stack-list">
              {filtered.map((row) => (
                <li key={`stack-${row.planId}`}>
                  <article className="pp-stack-item">
                    <h3>{row.name || row.planId}</h3>
                    <dl className="pp-dl">
                      <dt>Code</dt>
                      <dd>{row.code || "none"}</dd>
                      <dt>Plan ID</dt>
                      <dd>{row.planId}</dd>
                      <dt>Organizations</dt>
                      <dd className="pp-num">{row.organizationCount}</dd>
                    </dl>
                    <p className="pp-header-actions">
                      <button type="button" className="pp-btn pp-btn--ghost" onClick={() => setSelectedId(row.planId)}>
                        Open
                      </button>
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function PlanDetail({
  row,
  onBack,
  onOpenOrganization,
  onOpenSubscriptions,
}: {
  row: PlanRow;
  onBack: () => void;
  onOpenOrganization: (id: string) => void;
  onOpenSubscriptions: () => void;
}) {
  return (
    <div className="pp-org-detail">
      <header className="pp-org-detail__header">
        <div>
          <p className="pp-org-detail__back">
            <button type="button" className="pp-btn pp-btn--ghost" onClick={onBack}>
              Back to Plans
            </button>
          </p>
          <h1 className="pp-page-title">{row.name || row.planId}</h1>
          <p className="pp-page-desc">
            Plan definitions, catalog status, and entitlement JSON are not returned on Admin APIs. Feature limits are
            evaluated per organization on Subscriptions.
          </p>
        </div>
        <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenSubscriptions}>
          Subscriptions
        </button>
      </header>

      <section className="pp-panel" aria-labelledby="plan-identity">
        <h2 id="plan-identity">Plan identity</h2>
        <dl className="pp-dl">
          <dt>Name</dt>
          <dd>{row.name || "Not available"}</dd>
          <dt>Code</dt>
          <dd>{row.code || "Not available"}</dd>
          <dt>Plan ID</dt>
          <dd>{row.planId}</dd>
          <dt>Organizations</dt>
          <dd className="pp-num">{row.organizationCount}</dd>
        </dl>
      </section>

      <section className="pp-panel" aria-labelledby="plan-orgs">
        <h2 id="plan-orgs">Organizations using this plan</h2>
        <div className="pp-table-wrap pp-content-table">
          <table className="pp-admin-table">
            <caption className="pp-sr-only">Organizations currently assigned this plan</caption>
            <thead>
              <tr>
                <th scope="col">Organization</th>
                <th scope="col">Subscription status</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {row.organizations.map((org) => (
                <tr key={org.id}>
                  <td>
                    <button type="button" className="pp-btn pp-btn--link" onClick={() => onOpenOrganization(org.id)}>
                      {org.name}
                    </button>
                  </td>
                  <td>
                    <span className={statusClass(org.subscriptionStatus)}>{org.subscriptionStatus}</span>
                  </td>
                  <td>
                    <button type="button" className="pp-btn pp-btn--ghost" onClick={() => onOpenOrganization(org.id)}>
                      Open organization
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="pp-stack-list">
          {row.organizations.map((org) => (
            <li key={`stack-${org.id}`}>
              <article className="pp-stack-item">
                <h3>{org.name}</h3>
                <dl className="pp-dl">
                  <dt>Subscription status</dt>
                  <dd>
                    <span className={statusClass(org.subscriptionStatus)}>{org.subscriptionStatus}</span>
                  </dd>
                </dl>
                <p className="pp-header-actions">
                  <button type="button" className="pp-btn pp-btn--ghost" onClick={() => onOpenOrganization(org.id)}>
                    Open organization
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
