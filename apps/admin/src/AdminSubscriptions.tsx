import { useMemo, useState } from "react";
import {
  entitlementFeatures,
  entitlementLimits,
  filterSubscriptionRows,
  findSubscription,
  subscriptionPlans,
  subscriptionRows,
  subscriptionStatuses,
  usageText,
  type SubscriptionRow,
} from "./billingData";
import { formatWhen, statusClass, type AdminOrgDetail, type AdminOrgListItem } from "./dashboardData";
import { useAdminOrgDetails } from "./useAdminOrgDetails";

type AdminSubscriptionsProps = {
  token: string;
  orgs: AdminOrgListItem[];
  listError: string;
  listReady: boolean;
  onOpenOrganization: (id: string) => void;
  onOpenPlans: () => void;
  onAuthFailure: (status: number, data: { error?: { message?: string } }, fallback: string) => boolean;
};

function display(value: string | number | null | undefined) {
  if (value == null || value === "") return "none";
  return String(value);
}

function displayWhen(value: string | Date | null | undefined) {
  return formatWhen(value) || "none";
}

function planLabel(row: SubscriptionRow, detailsLoading: boolean, hasDetail: boolean) {
  if (row.planName) return row.planName;
  if (row.planId) return detailsLoading && !hasDetail ? "…" : row.planId;
  return "none";
}

export function AdminSubscriptions({
  token,
  orgs,
  listError,
  listReady,
  onOpenOrganization,
  onOpenPlans,
  onAuthFailure,
}: AdminSubscriptionsProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [planFilter, setPlanFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const loaded = useAdminOrgDetails({ token, orgs, listReady, listError, onAuthFailure });
  const rows = useMemo(() => subscriptionRows(orgs, loaded.details), [orgs, loaded.details]);
  const filtered = useMemo(
    () => filterSubscriptionRows(rows, query, statusFilter, planFilter),
    [rows, query, statusFilter, planFilter],
  );
  const statuses = useMemo(() => subscriptionStatuses(rows), [rows]);
  const plans = useMemo(() => subscriptionPlans(rows), [rows]);
  const selected = findSubscription(rows, selectedId);
  const selectedDetail = selected ? loaded.details[selected.organizationId] : undefined;
  const filtering = query.trim() !== "" || statusFilter !== "all" || planFilter !== "all";

  if (!listReady) return <p>Loading subscriptions…</p>;
  if (listError && orgs.length === 0) return <p className="pp-error">{listError}</p>;

  if (selected) {
    return (
      <SubscriptionDetail
        row={selected}
        detail={selectedDetail}
        detailLoading={loaded.loading && !selectedDetail}
        onBack={() => setSelectedId(null)}
        onOpenOrganization={onOpenOrganization}
        onOpenPlans={onOpenPlans}
      />
    );
  }

  return (
    <div className="pp-orgs">
      <header className="pp-orgs__header">
        <div>
          <h1 className="pp-page-title">Subscriptions</h1>
          <p className="pp-page-desc">
            Current plan and subscription state for each organization. This is not a Stripe billing ledger. Invoices,
            payments, and checkout are not available.
          </p>
        </div>
        <div className="pp-header-actions">
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenPlans}>
            Plans
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
            placeholder="Organization, plan, or provider"
            autoComplete="off"
          />
        </label>
        <label className="pp-orgs__filter">
          <span className="pp-field">Status</span>
          <select className="pp-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label className="pp-orgs__filter">
          <span className="pp-field">Plan</span>
          <select className="pp-input" value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
            <option value="all">All</option>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {plan.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="pp-panel" aria-labelledby="subscription-list">
        <h2 id="subscription-list">Organization subscriptions</h2>
        <p className="pp-panel__note">
          {loaded.loading
            ? "Loading organization details…"
            : filtering
              ? `Showing ${filtered.length} of ${rows.length} organizations`
              : `${rows.length} ${rows.length === 1 ? "organization" : "organizations"}`}
        </p>
        {filtered.length === 0 && (
          <p>{filtering ? "No subscriptions match this search." : "No organizations."}</p>
        )}
        {filtered.length > 0 && (
          <>
            <div className="pp-table-wrap pp-content-table">
              <table className="pp-admin-table">
                <caption className="pp-sr-only">Organization subscription records from admin organization APIs</caption>
                <thead>
                  <tr>
                    <th scope="col">Organization</th>
                    <th scope="col">Plan</th>
                    <th scope="col">Status</th>
                    <th scope="col">Period end</th>
                    <th scope="col">Grace period</th>
                    <th scope="col">Provider</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.organizationId}>
                      <td>
                        <button
                          type="button"
                          className="pp-btn pp-btn--link"
                          onClick={() => onOpenOrganization(row.organizationId)}
                        >
                          {row.organizationName}
                        </button>
                      </td>
                      <td>{planLabel(row, loaded.loading, Boolean(loaded.details[row.organizationId]))}</td>
                      <td>
                        <span className={statusClass(row.status)}>{row.status}</span>
                      </td>
                      <td>{displayWhen(row.currentPeriodEnd)}</td>
                      <td>{displayWhen(row.graceEndsAt)}</td>
                      <td>{display(row.provider)}</td>
                      <td>
                        <button
                          type="button"
                          className="pp-btn pp-btn--ghost"
                          onClick={() => setSelectedId(row.organizationId)}
                        >
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
                <li key={`stack-${row.organizationId}`}>
                  <article className="pp-stack-item">
                    <h3>{row.organizationName}</h3>
                    <dl className="pp-dl">
                      <dt>Plan</dt>
                      <dd>{planLabel(row, loaded.loading, Boolean(loaded.details[row.organizationId]))}</dd>
                      <dt>Status</dt>
                      <dd>
                        <span className={statusClass(row.status)}>{row.status}</span>
                      </dd>
                      <dt>Period end</dt>
                      <dd>{displayWhen(row.currentPeriodEnd)}</dd>
                      <dt>Provider</dt>
                      <dd>{display(row.provider)}</dd>
                    </dl>
                    <p className="pp-header-actions">
                      <button type="button" className="pp-btn pp-btn--ghost" onClick={() => setSelectedId(row.organizationId)}>
                        Open
                      </button>
                      <button
                        type="button"
                        className="pp-btn pp-btn--ghost"
                        onClick={() => onOpenOrganization(row.organizationId)}
                      >
                        Organization
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

function SubscriptionDetail({
  row,
  detail,
  detailLoading,
  onBack,
  onOpenOrganization,
  onOpenPlans,
}: {
  row: SubscriptionRow;
  detail?: AdminOrgDetail;
  detailLoading: boolean;
  onBack: () => void;
  onOpenOrganization: (id: string) => void;
  onOpenPlans: () => void;
}) {
  const entitlements = detail?.entitlements;
  const features = entitlementFeatures(entitlements?.flags);
  const limits = entitlementLimits(entitlements, detail?.memberCount, detail?.tickerCount);

  return (
    <div className="pp-org-detail">
      <header className="pp-org-detail__header">
        <div>
          <p className="pp-org-detail__back">
            <button type="button" className="pp-btn pp-btn--ghost" onClick={onBack}>
              Back to Subscriptions
            </button>
          </p>
          <h1 className="pp-page-title">{row.organizationName}</h1>
          <p className="pp-org-detail__status">
            <span className={statusClass(row.status)}>{row.status}</span>
          </p>
        </div>
        <div className="pp-header-actions">
          <button type="button" className="pp-btn pp-btn--ghost" onClick={() => onOpenOrganization(row.organizationId)}>
            Open organization
          </button>
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenPlans}>
            Plans
          </button>
        </div>
      </header>

      <div className="pp-org-detail__summary pp-org-detail__summary--two">
        <section className="pp-panel" aria-labelledby="sub-identity">
          <h2 id="sub-identity">Subscription</h2>
          <dl className="pp-dl">
            <dt>Organization</dt>
            <dd>{row.organizationName}</dd>
            <dt>Organization status</dt>
            <dd>
              <span className={statusClass(row.organizationStatus)}>{row.organizationStatus}</span>
            </dd>
            <dt>Plan</dt>
            <dd>{row.planName || row.planId || "none"}</dd>
            <dt>Plan code</dt>
            <dd>{display(row.planCode)}</dd>
            <dt>Plan ID</dt>
            <dd>{display(row.planId)}</dd>
            <dt>Status</dt>
            <dd>
              <span className={statusClass(row.status)}>{row.status}</span>
            </dd>
            <dt>Provider</dt>
            <dd>{display(row.provider)}</dd>
            <dt>Period end</dt>
            <dd>{displayWhen(row.currentPeriodEnd)}</dd>
            <dt>Grace period</dt>
            <dd>{displayWhen(row.graceEndsAt)}</dd>
          </dl>
        </section>
        <section className="pp-panel" aria-labelledby="sub-entitlement-state">
          <h2 id="sub-entitlement-state">Entitlement state</h2>
          {detailLoading && <p>Loading entitlements…</p>}
          {!detailLoading && !entitlements && <p>Entitlement snapshot not available.</p>}
          {entitlements && (
            <dl className="pp-dl">
              <dt>Evaluated status</dt>
              <dd>
                {entitlements.status ? (
                  <span className={statusClass(entitlements.status)}>{entitlements.status}</span>
                ) : (
                  "none"
                )}
              </dd>
              <dt>Restricted</dt>
              <dd>
                <span className={entitlements.restricted ? "pp-status pp-status--warning" : "pp-status pp-status--success"}>
                  {entitlements.restricted ? "restricted" : "not restricted"}
                </span>
              </dd>
              <dt>Reason</dt>
              <dd>{display(entitlements.reason)}</dd>
            </dl>
          )}
        </section>
      </div>

      <section className="pp-panel" aria-labelledby="sub-features">
        <h2 id="sub-features">Features</h2>
        <p className="pp-panel__note">
          These flags come from the organization entitlement snapshot. They can differ from the plan definition when the
          subscription is restricted.
        </p>
        {features.length === 0 && <p>{detailLoading ? "Loading…" : "No feature flags."}</p>}
        {features.length > 0 && (
          <div className="pp-table-wrap">
            <table className="pp-admin-table">
              <caption className="pp-sr-only">Entitlement feature flags for this organization</caption>
              <thead>
                <tr>
                  <th scope="col">Feature</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {features.map((feature) => (
                  <tr key={feature.key}>
                    <td>
                      <div className="pp-org-cell__name">
                        <span>{feature.label}</span>
                        <span className="pp-org-cell__slug">{feature.key}</span>
                      </div>
                    </td>
                    <td>
                      <span className={feature.enabled ? "pp-status pp-status--success" : "pp-status pp-status--neutral"}>
                        {feature.enabled ? "Enabled" : "Disabled"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="pp-panel" aria-labelledby="sub-limits">
        <h2 id="sub-limits">Limits</h2>
        <p className="pp-panel__note">
          Display and user counts are registered memberships and tickers. Storage usage is not returned on Admin APIs.
        </p>
        {limits.length === 0 && <p>{detailLoading ? "Loading…" : "No limits."}</p>}
        {limits.length > 0 && (
          <div className="pp-table-wrap">
            <table className="pp-admin-table">
              <caption className="pp-sr-only">Entitlement limits for this organization</caption>
              <thead>
                <tr>
                  <th scope="col">Limit</th>
                  <th scope="col">Usage</th>
                </tr>
              </thead>
              <tbody>
                {limits.map((limit) => (
                  <tr key={limit.key}>
                    <td>
                      <div className="pp-org-cell__name">
                        <span>{limit.label}</span>
                        <span className="pp-org-cell__slug">{limit.key}</span>
                      </div>
                    </td>
                    <td className="pp-num">{usageText(limit.used, limit.limit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
