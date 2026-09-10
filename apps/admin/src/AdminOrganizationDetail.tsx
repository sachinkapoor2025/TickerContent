import type { ReactNode } from "react";
import { formatWhen, statusClass, type AdminOrgDetail } from "./dashboardData";

type MemberRow = {
  id: string;
  email?: string | null;
  name?: string | null;
  roleKey?: string;
  status?: string;
};

type AuditRow = {
  id: string;
  createdAt?: string | Date;
  action?: string;
  actorUserId?: string | null;
  resourceType?: string | null;
  resourceId?: string | null;
  payloadJson?: string;
};

type JobRow = {
  id: string;
  createdAt?: string | Date;
  contentId?: string;
  versionId?: string | null;
  status?: string;
};

type DeliveryRow = {
  id: string;
  tickerId?: string;
  jobId?: string;
  snapshotVersion?: string | number | null;
  status?: string;
};

type AdminOrganizationDetailProps = {
  error: string;
  detail: AdminOrgDetail | null;
  detailLoading: boolean;
  statusBusy: boolean;
  members: MemberRow[] | null;
  membersLoading: boolean;
  membersError: string;
  audits: AuditRow[] | null;
  auditsLoading: boolean;
  auditsError: string;
  jobs: JobRow[] | null;
  jobsLoading: boolean;
  jobsError: string;
  deliveries: DeliveryRow[] | null;
  deliveriesLoading: boolean;
  deliveriesError: string;
  onBack: () => void;
  onToggleStatus: (org: { id: string; status: string }) => void;
};

function formatAuditPayload(payloadJson: string) {
  try {
    const parsed = JSON.parse(payloadJson);
    if (!parsed || (typeof parsed === "object" && !Array.isArray(parsed) && Object.keys(parsed).length === 0)) {
      return "";
    }
    return JSON.stringify(parsed);
  } catch {
    return payloadJson;
  }
}

function display(value: unknown) {
  if (value == null || value === "") return "none";
  return String(value);
}

function displayWhen(value: string | Date | null | undefined) {
  return formatWhen(value) || "none";
}

function TableState({
  loading,
  loadingLabel,
  error,
  items,
  empty,
  children,
}: {
  loading: boolean;
  loadingLabel: string;
  error: string;
  items: unknown[] | null;
  empty: string;
  children: ReactNode;
}) {
  if (loading) return <p>{loadingLabel}</p>;
  if (error) return <p className="pp-error">{error}</p>;
  if (items && items.length === 0) return <p>{empty}</p>;
  if (items && items.length > 0) return <>{children}</>;
  return null;
}

export function AdminOrganizationDetail({
  error,
  detail,
  detailLoading,
  statusBusy,
  members,
  membersLoading,
  membersError,
  audits,
  auditsLoading,
  auditsError,
  jobs,
  jobsLoading,
  jobsError,
  deliveries,
  deliveriesLoading,
  deliveriesError,
  onBack,
  onToggleStatus,
}: AdminOrganizationDetailProps) {
  const org = detail?.organization;
  const subscription = detail?.subscription;
  const entitlements = detail?.entitlements;
  const flagEntries = Object.entries(entitlements?.flags ?? {});
  const limitEntries = Object.entries(entitlements?.limits ?? {});

  return (
    <div className="pp-org-detail">
      <header className="pp-org-detail__header">
        <div>
          <p className="pp-org-detail__back">
            <button type="button" className="pp-btn pp-btn--ghost" onClick={onBack}>
              Back to Organizations
            </button>
          </p>
          <h1 className="pp-page-title">{org?.name ?? "Organization"}</h1>
          {org ? (
            <p className="pp-org-detail__status">
              <span className={statusClass(org.status)}>{org.status}</span>
            </p>
          ) : null}
        </div>
        {org ? (
          <button
            type="button"
            className={org.status === "suspended" ? "pp-btn pp-btn--primary" : "pp-btn pp-btn--danger"}
            disabled={statusBusy}
            onClick={() => onToggleStatus(org)}
          >
            {statusBusy ? "Updating…" : org.status === "suspended" ? "Activate" : "Suspend"}
          </button>
        ) : null}
      </header>

      {error ? <p className="pp-error">{error}</p> : null}
      {detailLoading ? <p>Loading organization…</p> : null}

      {!detailLoading && org && detail ? (
        <>
          <div className="pp-org-detail__summary">
            <section className="pp-panel" aria-labelledby="org-identity">
              <h2 id="org-identity">Organization</h2>
              <dl className="pp-dl">
                <dt>Name</dt>
                <dd>{org.name}</dd>
                <dt>ID</dt>
                <dd>{org.id}</dd>
                <dt>Slug</dt>
                <dd>{display(org.slug)}</dd>
                <dt>Timezone</dt>
                <dd>{display(org.timezone)}</dd>
                <dt>Created</dt>
                <dd>{displayWhen(org.createdAt)}</dd>
                <dt>Status</dt>
                <dd>
                  <span className={statusClass(org.status)}>{org.status}</span>
                </dd>
              </dl>
            </section>

            <section className="pp-panel" aria-labelledby="org-subscription">
              <h2 id="org-subscription">Subscription / Plan</h2>
              <dl className="pp-dl">
                <dt>Plan</dt>
                <dd>{detail.plan?.name ?? "none"}</dd>
                <dt>Plan ID</dt>
                <dd>{detail.plan?.id ?? subscription?.planId ?? "none"}</dd>
                <dt>Status</dt>
                <dd>
                  {subscription?.status ? (
                    <span className={statusClass(subscription.status)}>{subscription.status}</span>
                  ) : (
                    "none"
                  )}
                </dd>
                <dt>Provider</dt>
                <dd>{display(subscription?.provider)}</dd>
                <dt>Period end</dt>
                <dd>{displayWhen(subscription?.currentPeriodEnd)}</dd>
                <dt>Grace period</dt>
                <dd>{displayWhen(subscription?.graceEndsAt)}</dd>
              </dl>
            </section>

            <section className="pp-panel" aria-labelledby="org-usage">
              <h2 id="org-usage">Usage</h2>
              <dl className="pp-dl">
                <dt>Members</dt>
                <dd className="pp-num">{detail.memberCount}</dd>
                <dt>Displays</dt>
                <dd className="pp-num">{detail.tickerCount}</dd>
              </dl>
            </section>
          </div>

          <section className="pp-panel" aria-labelledby="org-entitlements">
            <h2 id="org-entitlements">Entitlements</h2>
            {!entitlements ? (
              <p>No entitlement snapshot.</p>
            ) : (
              <>
                <dl className="pp-dl">
                  <dt>Status</dt>
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
                  <dt>Remaining users</dt>
                  <dd className="pp-num">{display(entitlements.remaining?.users)}</dd>
                  <dt>Remaining displays</dt>
                  <dd className="pp-num">{display(entitlements.remaining?.devices)}</dd>
                  <dt>Remaining storage</dt>
                  <dd className="pp-num">{display(entitlements.remaining?.storageBytes)}</dd>
                </dl>

                <h3 className="pp-subhead">Flags</h3>
                {flagEntries.length === 0 ? (
                  <p>No flags.</p>
                ) : (
                  <div className="pp-table-wrap">
                    <table className="pp-admin-table">
                      <thead>
                        <tr>
                          <th scope="col">Flag</th>
                          <th scope="col">Enabled</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flagEntries.map(([key, enabled]) => (
                          <tr key={key}>
                            <td>{key}</td>
                            <td>
                              <span className={enabled ? "pp-status pp-status--success" : "pp-status pp-status--neutral"}>
                                {enabled ? "enabled" : "disabled"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <h3 className="pp-subhead">Limits</h3>
                {limitEntries.length === 0 ? (
                  <p>No limits.</p>
                ) : (
                  <div className="pp-table-wrap">
                    <table className="pp-admin-table">
                      <thead>
                        <tr>
                          <th scope="col">Limit</th>
                          <th scope="col">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {limitEntries.map(([key, value]) => (
                          <tr key={key}>
                            <td>{key}</td>
                            <td className="pp-num">{display(value)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="pp-panel" aria-labelledby="org-members">
            <h2 id="org-members">Members</h2>
            <TableState loading={membersLoading} loadingLabel="Loading members…" error={membersError} items={members} empty="No members.">
              <div className="pp-table-wrap pp-content-table">
                <table className="pp-admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Email</th>
                      <th scope="col">Name</th>
                      <th scope="col">Role</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members?.map((member) => (
                      <tr key={member.id}>
                        <td>{member.email ?? ""}</td>
                        <td>{member.name ?? ""}</td>
                        <td>{member.roleKey}</td>
                        <td>
                          {member.status ? <span className={statusClass(member.status)}>{member.status}</span> : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="pp-stack-list">
                {members?.map((member) => (
                  <li key={`stack-${member.id}`}>
                    <article className="pp-stack-item">
                      <h3>{member.name || member.email || member.id}</h3>
                      <dl className="pp-dl">
                        <dt>Email</dt>
                        <dd>{member.email || "none"}</dd>
                        <dt>Role</dt>
                        <dd>{member.roleKey || "none"}</dd>
                        <dt>Status</dt>
                        <dd>
                          {member.status ? <span className={statusClass(member.status)}>{member.status}</span> : "none"}
                        </dd>
                      </dl>
                    </article>
                  </li>
                ))}
              </ul>
            </TableState>
          </section>

          <section className="pp-panel" aria-labelledby="org-audit">
            <h2 id="org-audit">Audit Logs</h2>
            <TableState loading={auditsLoading} loadingLabel="Loading audit activity…" error={auditsError} items={audits} empty="No audit activity.">
              <div className="pp-table-wrap pp-content-table">
                <table className="pp-admin-table">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Action</th>
                      <th scope="col">Actor</th>
                      <th scope="col">Target</th>
                      <th scope="col">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audits?.map((entry) => (
                      <tr key={entry.id}>
                        <td>{formatWhen(entry.createdAt)}</td>
                        <td>{entry.action}</td>
                        <td>{entry.actorUserId ?? ""}</td>
                        <td>{[entry.resourceType, entry.resourceId].filter(Boolean).join(" ")}</td>
                        <td>{formatAuditPayload(entry.payloadJson ?? "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="pp-stack-list">
                {audits?.map((entry) => (
                  <li key={`stack-${entry.id}`}>
                    <article className="pp-stack-item">
                      <h3>{entry.action}</h3>
                      <dl className="pp-dl">
                        <dt>When</dt>
                        <dd>{formatWhen(entry.createdAt)}</dd>
                        <dt>Actor</dt>
                        <dd>{entry.actorUserId || "none"}</dd>
                        <dt>Target</dt>
                        <dd>{[entry.resourceType, entry.resourceId].filter(Boolean).join(" ") || "none"}</dd>
                        <dt>Details</dt>
                        <dd>{formatAuditPayload(entry.payloadJson ?? "") || "none"}</dd>
                      </dl>
                    </article>
                  </li>
                ))}
              </ul>
            </TableState>
          </section>

          <section className="pp-panel" aria-labelledby="org-jobs">
            <h2 id="org-jobs">Publishing Jobs</h2>
            <TableState loading={jobsLoading} loadingLabel="Loading publishing jobs…" error={jobsError} items={jobs} empty="No publishing jobs.">
              <div className="pp-table-wrap pp-content-table">
                <table className="pp-admin-table">
                  <thead>
                    <tr>
                      <th scope="col">When</th>
                      <th scope="col">Job</th>
                      <th scope="col">Content</th>
                      <th scope="col">Version</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs?.map((job) => (
                      <tr key={job.id}>
                        <td>{formatWhen(job.createdAt)}</td>
                        <td>{job.id}</td>
                        <td>{job.contentId}</td>
                        <td>{job.versionId ?? ""}</td>
                        <td>{job.status ? <span className={statusClass(job.status)}>{job.status}</span> : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="pp-stack-list">
                {jobs?.map((job) => (
                  <li key={`stack-${job.id}`}>
                    <article className="pp-stack-item">
                      <h3>{job.id}</h3>
                      <dl className="pp-dl">
                        <dt>When</dt>
                        <dd>{formatWhen(job.createdAt)}</dd>
                        <dt>Content</dt>
                        <dd>{job.contentId || "none"}</dd>
                        <dt>Version</dt>
                        <dd>{job.versionId || "none"}</dd>
                        <dt>Status</dt>
                        <dd>{job.status ? <span className={statusClass(job.status)}>{job.status}</span> : "none"}</dd>
                      </dl>
                    </article>
                  </li>
                ))}
              </ul>
            </TableState>
          </section>

          <section className="pp-panel" aria-labelledby="org-deliveries">
            <h2 id="org-deliveries">Deliveries</h2>
            <TableState loading={deliveriesLoading} loadingLabel="Loading deliveries…" error={deliveriesError} items={deliveries} empty="No deliveries.">
              <div className="pp-table-wrap pp-content-table">
                <table className="pp-admin-table">
                  <thead>
                    <tr>
                      <th scope="col">Delivery</th>
                      <th scope="col">Ticker</th>
                      <th scope="col">Job</th>
                      <th scope="col">Version</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries?.map((delivery) => (
                      <tr key={delivery.id}>
                        <td>{delivery.id}</td>
                        <td>{delivery.tickerId}</td>
                        <td>{delivery.jobId}</td>
                        <td>{delivery.snapshotVersion ?? ""}</td>
                        <td>
                          {delivery.status ? <span className={statusClass(delivery.status)}>{delivery.status}</span> : ""}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="pp-stack-list">
                {deliveries?.map((delivery) => (
                  <li key={`stack-${delivery.id}`}>
                    <article className="pp-stack-item">
                      <h3>{delivery.id}</h3>
                      <dl className="pp-dl">
                        <dt>Ticker</dt>
                        <dd>{delivery.tickerId || "none"}</dd>
                        <dt>Job</dt>
                        <dd>{delivery.jobId || "none"}</dd>
                        <dt>Version</dt>
                        <dd>{delivery.snapshotVersion ?? "none"}</dd>
                        <dt>Status</dt>
                        <dd>
                          {delivery.status ? <span className={statusClass(delivery.status)}>{delivery.status}</span> : "none"}
                        </dd>
                      </dl>
                    </article>
                  </li>
                ))}
              </ul>
            </TableState>
          </section>
        </>
      ) : null}
    </div>
  );
}
