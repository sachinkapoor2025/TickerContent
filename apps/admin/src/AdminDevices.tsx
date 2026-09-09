import { useMemo, useState } from "react";
import { statusClass, type AdminOrgListItem } from "./dashboardData";
import {
  deliveriesForTicker,
  displayRowsForOrganizations,
  filterDisplayRows,
  filterKnownTickers,
  knownTickerRows,
} from "./opsData";
import { useAdminFleetData } from "./useAdminFleetData";

type AdminDevicesProps = {
  token: string;
  orgs: AdminOrgListItem[];
  listError: string;
  listReady: boolean;
  onOpenOrganization: (id: string) => void;
  onAuthFailure: (status: number, data: { error?: { message?: string } }, fallback: string) => boolean;
};

export function AdminDevices({
  token,
  orgs,
  listError,
  listReady,
  onOpenOrganization,
  onAuthFailure,
}: AdminDevicesProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<{ organizationId: string; tickerId: string } | null>(null);
  const fleet = useAdminFleetData({ token, orgs, listReady, listError, onAuthFailure });

  const orgRows = useMemo(
    () => displayRowsForOrganizations(orgs, fleet.details, fleet.deliveriesByOrg),
    [orgs, fleet.details, fleet.deliveriesByOrg],
  );
  const tickerRows = useMemo(
    () => knownTickerRows(orgs, fleet.deliveriesByOrg),
    [orgs, fleet.deliveriesByOrg],
  );
  const filteredOrgs = useMemo(() => filterDisplayRows(orgRows, query), [orgRows, query]);
  const filteredTickers = useMemo(() => filterKnownTickers(tickerRows, query), [tickerRows, query]);

  const selectedOrg = selected ? orgs.find((org) => org.id === selected.organizationId) : undefined;
  const selectedDeliveries = selected
    ? deliveriesForTicker(fleet.deliveriesByOrg?.[selected.organizationId] ?? [], selected.tickerId)
    : [];

  if (!listReady) return <p>Loading registered displays…</p>;
  if (listError && orgs.length === 0) return <p className="pp-error">{listError}</p>;

  if (selected) {
    return (
      <div className="pp-org-detail">
        <header className="pp-org-detail__header">
          <div>
            <p className="pp-org-detail__back">
              <button type="button" className="pp-btn pp-btn--ghost" onClick={() => setSelected(null)}>
                Back to Displays
              </button>
            </p>
            <h1 className="pp-page-title">{selected.tickerId}</h1>
            <p className="pp-page-desc">
              This is a registered ticker ID from delivery records. Ticker name, display profile, and live playback are
              not available on platform admin APIs.
            </p>
          </div>
          <button type="button" className="pp-btn pp-btn--ghost" onClick={() => onOpenOrganization(selected.organizationId)}>
            Open organization
          </button>
        </header>

        <div className="pp-org-detail__summary pp-org-detail__summary--two">
          <section className="pp-panel" aria-labelledby="ticker-identity">
            <h2 id="ticker-identity">Ticker display</h2>
            <dl className="pp-dl">
              <dt>Ticker ID</dt>
              <dd>{selected.tickerId}</dd>
              <dt>Organization</dt>
              <dd>{selectedOrg?.name ?? selected.organizationId}</dd>
              <dt>Organization status</dt>
              <dd>
                {selectedOrg ? <span className={statusClass(selectedOrg.status)}>{selectedOrg.status}</span> : "—"}
              </dd>
              <dt>Name</dt>
              <dd>Not available</dd>
              <dt>Display size</dt>
              <dd>Not available</dd>
              <dt>Color mode</dt>
              <dd>Not available</dd>
              <dt>Last seen</dt>
              <dd>Not available</dd>
            </dl>
          </section>
          <section className="pp-panel" aria-labelledby="ticker-preview">
            <h2 id="ticker-preview">Current display</h2>
            <p className="pp-panel__note">
              Live playback and composition preview require tenant playback APIs. Platform admin cannot load another
              organization’s player snapshot from this screen.
            </p>
            <p>Preview not available.</p>
          </section>
        </div>

        <section className="pp-panel" aria-labelledby="ticker-deliveries">
          <h2 id="ticker-deliveries">Delivery records</h2>
          {fleet.deliveriesLoading && <p>Loading deliveries…</p>}
          {fleet.deliveriesError && <p className="pp-error">{fleet.deliveriesError}</p>}
          {!fleet.deliveriesLoading && !fleet.deliveriesError && selectedDeliveries.length === 0 && (
            <p>No delivery records for this ticker ID.</p>
          )}
          {selectedDeliveries.length > 0 && (
            <>
              <div className="pp-table-wrap pp-content-table">
                <table className="pp-admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Delivery</th>
                      <th scope="col">Job</th>
                      <th scope="col">Version</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDeliveries.map((row) => (
                      <tr key={row.id}>
                        <td>{row.id}</td>
                        <td>{row.jobId}</td>
                        <td>{row.snapshotVersion ?? ""}</td>
                        <td>
                          <span className={statusClass(row.status)}>{row.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="pp-stack-list">
                {selectedDeliveries.map((row) => (
                  <li key={`stack-${row.id}`}>
                    <article className="pp-stack-item">
                      <h3>{row.id}</h3>
                      <dl className="pp-dl">
                        <dt>Job</dt>
                        <dd>{row.jobId}</dd>
                        <dt>Version</dt>
                        <dd>{row.snapshotVersion ?? "none"}</dd>
                        <dt>Status</dt>
                        <dd>
                          <span className={statusClass(row.status)}>{row.status}</span>
                        </dd>
                      </dl>
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

  return (
    <div className="pp-orgs">
      <header className="pp-orgs__header">
        <div>
          <h1 className="pp-page-title">Displays</h1>
          <p className="pp-page-desc">
            MVP records are ticker displays registered to organizations, not provisioned IoT devices. Live heartbeat,
            display profile, and current playback are not available on platform admin APIs.
          </p>
        </div>
        <p className="pp-orgs__count">
          {orgs.length} {orgs.length === 1 ? "organization" : "organizations"}
        </p>
      </header>

      {listError ? <p className="pp-error">{listError}</p> : null}
      {fleet.detailsError ? <p className="pp-error">{fleet.detailsError}</p> : null}
      {fleet.deliveriesError ? <p className="pp-error">{fleet.deliveriesError}</p> : null}

      <div className="pp-orgs__filters">
        <div className="pp-orgs__filter">
          <label className="pp-field" htmlFor="display-search">
            Search
          </label>
          <input
            id="display-search"
            className="pp-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Organization or ticker ID"
            autoComplete="off"
          />
        </div>
      </div>

      <section className="pp-panel" aria-labelledby="registered-displays">
        <h2 id="registered-displays">Registered ticker displays</h2>
        <p className="pp-panel__note">
          Registered counts come from organization detail records. Ticker names, sizes, color mode, and last seen are
          tenant-only.
        </p>
        {orgs.length === 0 && <p>No organizations.</p>}
        {orgs.length > 0 && filteredOrgs.length === 0 && <p>No organizations match this search.</p>}
        {filteredOrgs.length > 0 && (
          <>
            <div className="pp-table-wrap pp-content-table">
              <table className="pp-admin-table">
                <thead>
                  <tr>
                    <th scope="col">Organization</th>
                    <th scope="col">Status</th>
                    <th scope="col">Registered tickers</th>
                    <th scope="col">Tickers with deliveries</th>
                    <th scope="col">Delivery records</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrgs.map((row) => (
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
                      <td>
                        <span className={statusClass(row.organizationStatus)}>{row.organizationStatus}</span>
                      </td>
                      <td className="pp-num">
                        {fleet.detailsLoading && row.registeredTickers == null ? "…" : row.registeredTickers ?? "—"}
                      </td>
                      <td className="pp-num">{fleet.deliveriesLoading ? "…" : fleet.deliveriesByOrg ? row.tickersWithDeliveries : "—"}</td>
                      <td className="pp-num">{fleet.deliveriesLoading ? "…" : fleet.deliveriesByOrg ? row.deliveryRecords : "—"}</td>
                      <td>
                        <button type="button" className="pp-btn pp-btn--ghost" onClick={() => onOpenOrganization(row.organizationId)}>
                          Open organization
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="pp-stack-list">
              {filteredOrgs.map((row) => (
                <li key={`stack-${row.organizationId}`}>
                  <article className="pp-stack-item">
                    <h3>{row.organizationName}</h3>
                    <dl className="pp-dl">
                      <dt>Status</dt>
                      <dd>
                        <span className={statusClass(row.organizationStatus)}>{row.organizationStatus}</span>
                      </dd>
                      <dt>Registered tickers</dt>
                      <dd>{fleet.detailsLoading && row.registeredTickers == null ? "…" : row.registeredTickers ?? "—"}</dd>
                      <dt>Tickers with deliveries</dt>
                      <dd>{fleet.deliveriesLoading ? "…" : fleet.deliveriesByOrg ? row.tickersWithDeliveries : "—"}</dd>
                      <dt>Delivery records</dt>
                      <dd>{fleet.deliveriesLoading ? "…" : fleet.deliveriesByOrg ? row.deliveryRecords : "—"}</dd>
                    </dl>
                    <p className="pp-header-actions">
                      <button type="button" className="pp-btn pp-btn--ghost" onClick={() => onOpenOrganization(row.organizationId)}>
                        Open organization
                      </button>
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="pp-panel" aria-labelledby="known-tickers">
        <h2 id="known-tickers">Tickers with delivery records</h2>
        <p className="pp-panel__note">
          These ticker IDs appear on admin delivery records. This is not a complete display inventory and does not prove
          the display is online.
        </p>
        {fleet.deliveriesLoading && <p>Loading deliveries…</p>}
        {!fleet.deliveriesLoading && !fleet.deliveriesError && fleet.deliveriesByOrg && tickerRows.length === 0 && (
          <p>No delivery records.</p>
        )}
        {!fleet.deliveriesLoading && !fleet.deliveriesError && filteredTickers.length === 0 && tickerRows.length > 0 && (
          <p>No ticker IDs match this search.</p>
        )}
        {filteredTickers.length > 0 && (
          <>
            <div className="pp-table-wrap pp-content-table">
              <table className="pp-admin-table">
                <thead>
                  <tr>
                    <th scope="col">Ticker ID</th>
                    <th scope="col">Organization</th>
                    <th scope="col">Latest version</th>
                    <th scope="col">Latest delivery</th>
                    <th scope="col">Delivery records</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTickers.map((row) => (
                    <tr key={`${row.organizationId}:${row.tickerId}`}>
                      <td>
                        <button
                          type="button"
                          className="pp-btn pp-btn--link"
                          onClick={() => setSelected({ organizationId: row.organizationId, tickerId: row.tickerId })}
                        >
                          {row.tickerId}
                        </button>
                      </td>
                      <td>
                        <button type="button" className="pp-btn pp-btn--link" onClick={() => onOpenOrganization(row.organizationId)}>
                          {row.organizationName}
                        </button>
                      </td>
                      <td>{row.latestSnapshotVersion || "none"}</td>
                      <td>
                        <span className={statusClass(row.latestStatus)}>{row.latestStatus}</span>
                      </td>
                      <td className="pp-num">{row.deliveryCount}</td>
                      <td>
                        <button
                          type="button"
                          className="pp-btn pp-btn--ghost"
                          onClick={() => setSelected({ organizationId: row.organizationId, tickerId: row.tickerId })}
                        >
                          View deliveries
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="pp-stack-list">
              {filteredTickers.map((row) => (
                <li key={`stack-${row.organizationId}:${row.tickerId}`}>
                  <article className="pp-stack-item">
                    <h3>{row.tickerId}</h3>
                    <dl className="pp-dl">
                      <dt>Organization</dt>
                      <dd>{row.organizationName}</dd>
                      <dt>Latest version</dt>
                      <dd>{row.latestSnapshotVersion || "none"}</dd>
                      <dt>Latest delivery</dt>
                      <dd>
                        <span className={statusClass(row.latestStatus)}>{row.latestStatus}</span>
                      </dd>
                      <dt>Delivery records</dt>
                      <dd>{row.deliveryCount}</dd>
                    </dl>
                    <p className="pp-header-actions">
                      <button
                        type="button"
                        className="pp-btn pp-btn--ghost"
                        onClick={() => setSelected({ organizationId: row.organizationId, tickerId: row.tickerId })}
                      >
                        View deliveries
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
