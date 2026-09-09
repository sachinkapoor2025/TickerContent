import { useEffect, useMemo, useState } from "react";
import { statusClass, type AdminOrgListItem } from "./dashboardData";
import {
  filterMemberships,
  membershipRoles,
  membershipRows,
  membershipStatuses,
  type AccessRow,
  type AdminMembershipItem,
} from "./accessData";

type AdminUsersProps = {
  token: string;
  orgs: AdminOrgListItem[];
  listError: string;
  listReady: boolean;
  onOpenOrganization: (id: string) => void;
  onAuthFailure: (status: number, data: { error?: { message?: string } }, fallback: string) => boolean;
};

function display(value: string | null | undefined) {
  if (value == null || value === "") return "none";
  return value;
}

export function AdminUsers({ token, orgs, listError, listReady, onOpenOrganization, onAuthFailure }: AdminUsersProps) {
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [membershipsByOrg, setMembershipsByOrg] = useState<Record<string, AdminMembershipItem[]> | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!token || !listReady) return;
    let cancelled = false;
    (async () => {
      if (orgs.length === 0) {
        setMembershipsByOrg(listError ? null : {});
        setLoadError("");
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError("");
      const next: Record<string, AdminMembershipItem[]> = {};
      let failed = false;
      await Promise.all(
        orgs.map(async (org) => {
          const res = await fetch(`/v1/admin/organizations/${org.id}/memberships`, {
            headers: { authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          if (cancelled) return;
          if (res.status === 401 || res.status === 403) {
            onAuthFailure(res.status, data, "Could not load members.");
            return;
          }
          if (!res.ok) {
            failed = true;
            return;
          }
          next[org.id] = Array.isArray(data.items) ? data.items : [];
        }),
      );
      if (cancelled) return;
      setLoading(false);
      if (failed) {
        setMembershipsByOrg(null);
        setLoadError("Could not load memberships.");
      } else {
        setMembershipsByOrg(next);
        setLoadError("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, orgs, listReady, listError]);

  const rows = useMemo(() => membershipRows(orgs, membershipsByOrg), [orgs, membershipsByOrg]);
  const filtered = useMemo(
    () => filterMemberships(rows, query, roleFilter, statusFilter),
    [rows, query, roleFilter, statusFilter],
  );
  const roles = useMemo(() => membershipRoles(rows), [rows]);
  const statuses = useMemo(() => membershipStatuses(rows), [rows]);
  const selected = filtered.find((row) => row.id === selectedId) ?? rows.find((row) => row.id === selectedId) ?? null;
  const filtering = query.trim() !== "" || roleFilter !== "all" || statusFilter !== "all";

  if (!listReady) return <p>Loading users…</p>;
  if (listError && orgs.length === 0) return <p className="pp-error">{listError}</p>;

  if (selected) {
    return (
      <AccessDetail
        row={selected}
        onBack={() => setSelectedId(null)}
        onOpenOrganization={onOpenOrganization}
      />
    );
  }

  return (
    <div className="pp-orgs">
      <header className="pp-orgs__header">
        <div>
          <h1 className="pp-page-title">Users</h1>
          <p className="pp-page-desc">
            Organization memberships currently visible to platform admin. This is not a global user directory. Platform
            operators without a tenant membership are not listed here.
          </p>
        </div>
        <p className="pp-orgs__count">
          {loading
            ? "Loading memberships…"
            : filtering
              ? `Showing ${filtered.length} of ${rows.length} memberships`
              : `${rows.length} ${rows.length === 1 ? "membership" : "memberships"}`}
        </p>
      </header>

      {listError ? <p className="pp-error">{listError}</p> : null}
      {loadError ? <p className="pp-error">{loadError}</p> : null}

      <div className="pp-orgs__filters">
        <div className="pp-orgs__filter">
          <label className="pp-field" htmlFor="user-search">
            Search
          </label>
          <input
            id="user-search"
            className="pp-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email, organization, or role"
            autoComplete="off"
          />
        </div>
        <div className="pp-orgs__filter">
          <label className="pp-field" htmlFor="user-role-filter">
            Role
          </label>
          <select
            id="user-role-filter"
            className="pp-input"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="all">All</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
        <div className="pp-orgs__filter">
          <label className="pp-field" htmlFor="user-status-filter">
            Status
          </label>
          <select
            id="user-status-filter"
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

      <section className="pp-panel" aria-labelledby="user-list">
        <h2 id="user-list">Organization memberships</h2>
        {loading && <p>Loading memberships…</p>}
        {!loading && !loadError && rows.length === 0 && <p>No memberships.</p>}
        {!loading && !loadError && rows.length > 0 && filtered.length === 0 && <p>No memberships match this search.</p>}
        {filtered.length > 0 && (
          <>
            <div className="pp-table-wrap pp-content-table">
              <table className="pp-admin-table">
                <caption className="pp-sr-only">Memberships loaded from organization admin APIs</caption>
                <thead>
                  <tr>
                    <th scope="col">User</th>
                    <th scope="col">Email</th>
                    <th scope="col">Organization</th>
                    <th scope="col">Role</th>
                    <th scope="col">Status</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={`${row.organizationId}:${row.id}`}>
                      <td>
                        <button type="button" className="pp-btn pp-btn--link" onClick={() => setSelectedId(row.id)}>
                          {row.name || row.email || row.userId}
                        </button>
                      </td>
                      <td>{row.email ?? ""}</td>
                      <td>
                        <button type="button" className="pp-btn pp-btn--link" onClick={() => onOpenOrganization(row.organizationId)}>
                          {row.organizationName}
                        </button>
                      </td>
                      <td>{row.roleKey}</td>
                      <td>
                        <span className={statusClass(row.status)}>{row.status}</span>
                      </td>
                      <td>
                        <button type="button" className="pp-btn pp-btn--ghost" onClick={() => setSelectedId(row.id)}>
                          View access
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="pp-stack-list">
              {filtered.map((row) => (
                <li key={`stack-${row.organizationId}:${row.id}`}>
                  <article className="pp-stack-item">
                    <h3>{row.name || row.email || row.userId}</h3>
                    <dl className="pp-dl">
                      <dt>Email</dt>
                      <dd>{row.email ?? "none"}</dd>
                      <dt>Organization</dt>
                      <dd>{row.organizationName}</dd>
                      <dt>Role</dt>
                      <dd>{row.roleKey}</dd>
                      <dt>Status</dt>
                      <dd>
                        <span className={statusClass(row.status)}>{row.status}</span>
                      </dd>
                    </dl>
                    <p className="pp-header-actions">
                      <button type="button" className="pp-btn pp-btn--ghost" onClick={() => setSelectedId(row.id)}>
                        View access
                      </button>
                      <button type="button" className="pp-btn pp-btn--ghost" onClick={() => onOpenOrganization(row.organizationId)}>
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

function AccessDetail({
  row,
  onBack,
  onOpenOrganization,
}: {
  row: AccessRow;
  onBack: () => void;
  onOpenOrganization: (id: string) => void;
}) {
  return (
    <div className="pp-org-detail">
      <header className="pp-org-detail__header">
        <div>
          <p className="pp-org-detail__back">
            <button type="button" className="pp-btn pp-btn--ghost" onClick={onBack}>
              Back to Users
            </button>
          </p>
          <h1 className="pp-page-title">{row.name || row.email || row.userId}</h1>
          <p className="pp-org-detail__status">
            <span className={statusClass(row.status)}>{row.status}</span>
          </p>
        </div>
        <button type="button" className="pp-btn pp-btn--ghost" onClick={() => onOpenOrganization(row.organizationId)}>
          Open organization
        </button>
      </header>

      <div className="pp-org-detail__summary pp-org-detail__summary--two">
        <section className="pp-panel" aria-labelledby="user-identity">
          <h2 id="user-identity">Identity</h2>
          <dl className="pp-dl">
            <dt>Name</dt>
            <dd>{display(row.name)}</dd>
            <dt>Email</dt>
            <dd>{display(row.email)}</dd>
            <dt>User ID</dt>
            <dd>{row.userId}</dd>
            <dt>Membership ID</dt>
            <dd>{row.id}</dd>
          </dl>
        </section>
        <section className="pp-panel" aria-labelledby="user-access">
          <h2 id="user-access">Access</h2>
          <dl className="pp-dl">
            <dt>Organization</dt>
            <dd>{row.organizationName}</dd>
            <dt>Organization status</dt>
            <dd>
              <span className={statusClass(row.organizationStatus)}>{row.organizationStatus}</span>
            </dd>
            <dt>Role</dt>
            <dd>{row.roleKey}</dd>
            <dt>Membership status</dt>
            <dd>
              <span className={statusClass(row.status)}>{row.status}</span>
            </dd>
          </dl>
        </section>
      </div>
    </div>
  );
}
