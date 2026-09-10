import { useMemo, useState } from "react";
import { AdminContentPipeline } from "./AdminContentPipeline";
import {
  filterPublishedContent,
  findPublishedContent,
  publishedContentRows,
  publishedVersionsForContent,
  type PublishedContentKey,
  type PublishedContentRow,
  type PublishedVersionRow,
} from "./contentData";
import { formatWhen, statusClass, type AdminOrgListItem } from "./dashboardData";
import { useAdminFleetData } from "./useAdminFleetData";

type AdminDisplayContentProps = {
  token: string;
  orgs: AdminOrgListItem[];
  listError: string;
  listReady: boolean;
  onOpenOrganization: (id: string) => void;
  onOpenTemplates: () => void;
  onAuthFailure: (status: number, data: { error?: { message?: string } }, fallback: string) => boolean;
};

function display(value: string | number | null | undefined) {
  if (value == null || value === "") return "none";
  return String(value);
}

function displayWhen(value: string | Date | null | undefined) {
  return formatWhen(value) || "none";
}

export function AdminDisplayContent({
  token,
  orgs,
  listError,
  listReady,
  onOpenOrganization,
  onOpenTemplates,
  onAuthFailure,
}: AdminDisplayContentProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<PublishedContentKey | null>(null);
  const fleet = useAdminFleetData({ token, orgs, listReady, listError, onAuthFailure });

  const rows = useMemo(
    () => publishedContentRows(orgs, fleet.jobsByOrg, fleet.deliveriesByOrg),
    [orgs, fleet.jobsByOrg, fleet.deliveriesByOrg],
  );
  const filtered = useMemo(() => filterPublishedContent(rows, query), [rows, query]);
  const selectedRow = findPublishedContent(rows, selected);
  const versions = useMemo(
    () =>
      selectedRow
        ? publishedVersionsForContent(
            selectedRow.organizationId,
            selectedRow.contentId,
            fleet.jobsByOrg,
            fleet.deliveriesByOrg,
          )
        : [],
    [selectedRow, fleet.jobsByOrg, fleet.deliveriesByOrg],
  );
  const filtering = query.trim() !== "";

  if (!listReady) return <p>Loading display content…</p>;
  if (listError && orgs.length === 0) return <p className="pp-error">{listError}</p>;

  if (selectedRow) {
    return (
      <DisplayContentDetail
        row={selectedRow}
        versions={versions}
        jobsLoading={fleet.jobsLoading}
        deliveriesLoading={fleet.deliveriesLoading}
        onBack={() => setSelected(null)}
        onOpenOrganization={onOpenOrganization}
      />
    );
  }

  return (
    <div className="pp-orgs">
      <header className="pp-orgs__header">
        <div>
          <h1 className="pp-page-title">Display Content</h1>
          <p className="pp-page-desc">
            Platform Admin cannot list the tenant content library. This view shows content IDs that appear on publishing
            jobs — published snapshots that can be delivered to displays.
          </p>
        </div>
        <div className="pp-header-actions">
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenTemplates}>
            Templates
          </button>
        </div>
      </header>

      {listError ? <p className="pp-error">{listError}</p> : null}
      {fleet.jobsError ? <p className="pp-error">{fleet.jobsError}</p> : null}
      {fleet.deliveriesError ? <p className="pp-error">{fleet.deliveriesError}</p> : null}

      <AdminContentPipeline />

      <div className="pp-orgs__filters">
        <label className="pp-orgs__filter">
          <span className="pp-field">Search</span>
          <input
            className="pp-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Content ID, organization, or version"
          />
        </label>
      </div>

      <section className="pp-panel" aria-labelledby="published-content">
        <h2 id="published-content">Published content</h2>
        <p className="pp-panel__note">
          {fleet.jobsLoading
            ? "Loading publishing jobs…"
            : filtering
              ? `Showing ${filtered.length} of ${rows.length} content IDs`
              : `${rows.length} ${rows.length === 1 ? "content ID" : "content IDs"} from publishing jobs`}
        </p>
        {!fleet.jobsLoading && !fleet.jobsError && filtered.length === 0 && (
          <p>{filtering ? "No published content matches this search." : "No publishing jobs on loaded organizations."}</p>
        )}
        {filtered.length > 0 && (
          <>
            <div className="pp-table-wrap pp-content-table">
              <table className="pp-admin-table">
                <caption className="pp-sr-only">Content IDs from organization publishing jobs</caption>
                <thead>
                  <tr>
                    <th scope="col">Content</th>
                    <th scope="col">Organization</th>
                    <th scope="col">Latest version</th>
                    <th scope="col">Jobs</th>
                    <th scope="col">Deliveries</th>
                    <th scope="col">Published</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={`${row.organizationId}:${row.contentId}`}>
                      <td>
                        <div className="pp-org-cell__name">
                          <button
                            type="button"
                            className="pp-btn pp-btn--link"
                            onClick={() => setSelected({ organizationId: row.organizationId, contentId: row.contentId })}
                          >
                            {row.contentId}
                          </button>
                          <span className="pp-org-cell__slug">Title not available</span>
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="pp-btn pp-btn--link"
                          onClick={() => onOpenOrganization(row.organizationId)}
                        >
                          {row.organizationName}
                        </button>
                      </td>
                      <td className="pp-num">{display(row.latestVersionId)}</td>
                      <td className="pp-num">{row.jobCount}</td>
                      <td className="pp-num">{row.deliveryCount}</td>
                      <td>{displayWhen(row.latestCreatedAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="pp-btn pp-btn--ghost"
                          onClick={() => setSelected({ organizationId: row.organizationId, contentId: row.contentId })}
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
                <li key={`stack-${row.organizationId}:${row.contentId}`}>
                  <article className="pp-stack-item">
                    <h3>{row.contentId}</h3>
                    <dl className="pp-dl">
                      <dt>Organization</dt>
                      <dd>{row.organizationName}</dd>
                      <dt>Latest version</dt>
                      <dd>{display(row.latestVersionId)}</dd>
                      <dt>Jobs</dt>
                      <dd className="pp-num">{row.jobCount}</dd>
                      <dt>Deliveries</dt>
                      <dd className="pp-num">{row.deliveryCount}</dd>
                      <dt>Published</dt>
                      <dd>{displayWhen(row.latestCreatedAt)}</dd>
                    </dl>
                    <p className="pp-header-actions">
                      <button
                        type="button"
                        className="pp-btn pp-btn--ghost"
                        onClick={() => setSelected({ organizationId: row.organizationId, contentId: row.contentId })}
                      >
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

function DisplayContentDetail({
  row,
  versions,
  jobsLoading,
  deliveriesLoading,
  onBack,
  onOpenOrganization,
}: {
  row: PublishedContentRow;
  versions: PublishedVersionRow[];
  jobsLoading: boolean;
  deliveriesLoading: boolean;
  onBack: () => void;
  onOpenOrganization: (id: string) => void;
}) {
  return (
    <div className="pp-org-detail">
      <header className="pp-org-detail__header">
        <div>
          <p className="pp-org-detail__back">
            <button type="button" className="pp-btn pp-btn--ghost" onClick={onBack}>
              Back to Display Content
            </button>
          </p>
          <h1 className="pp-page-title">{row.contentId}</h1>
          <p className="pp-page-desc">
            This is a content ID from publishing jobs. Title, draft status, and composition documents are tenant-only.
          </p>
        </div>
        <button type="button" className="pp-btn pp-btn--ghost" onClick={() => onOpenOrganization(row.organizationId)}>
          Open organization
        </button>
      </header>

      <div className="pp-org-detail__summary pp-org-detail__summary--two">
        <section className="pp-panel" aria-labelledby="content-identity">
          <h2 id="content-identity">Content identity</h2>
          <dl className="pp-dl">
            <dt>Content ID</dt>
            <dd>{row.contentId}</dd>
            <dt>Title</dt>
            <dd>Not available</dd>
            <dt>Library status</dt>
            <dd>Not available</dd>
            <dt>Organization</dt>
            <dd>{row.organizationName}</dd>
            <dt>Organization status</dt>
            <dd>
              <span className={statusClass(row.organizationStatus)}>{row.organizationStatus}</span>
            </dd>
          </dl>
        </section>
        <section className="pp-panel" aria-labelledby="content-publish">
          <h2 id="content-publish">Publishing</h2>
          <dl className="pp-dl">
            <dt>Latest version</dt>
            <dd>{display(row.latestVersionId)}</dd>
            <dt>Latest job</dt>
            <dd>{row.latestJobId}</dd>
            <dt>Job status</dt>
            <dd>
              <span className={statusClass(row.latestJobStatus)}>{row.latestJobStatus}</span>
            </dd>
            <dt>Trigger</dt>
            <dd>{display(row.latestTrigger)}</dd>
            <dt>Published</dt>
            <dd>{displayWhen(row.latestCreatedAt)}</dd>
            <dt>Jobs</dt>
            <dd className="pp-num">{row.jobCount}</dd>
            <dt>Deliveries</dt>
            <dd className="pp-num">{row.deliveryCount}</dd>
            <dt>Tickers</dt>
            <dd className="pp-num">{row.tickerCount}</dd>
          </dl>
        </section>
      </div>

      <section className="pp-panel" aria-labelledby="content-preview">
        <h2 id="content-preview">Preview</h2>
        <p className="pp-panel__note">
          LED preview uses the shared composition renderer in the tenant editor and player. Admin publishing APIs omit
          snapshot JSON, so a real preview cannot be rendered here.
        </p>
        <p>Preview not available.</p>
      </section>

      <section className="pp-panel" aria-labelledby="content-versions">
        <h2 id="content-versions">Published versions</h2>
        <p className="pp-panel__note">
          These are version IDs from publishing jobs for this content ID. Draft versions that were never published are
          not listed.
        </p>
        {jobsLoading && <p>Loading publishing jobs…</p>}
        {!jobsLoading && versions.length === 0 && <p>No published versions for this content ID.</p>}
        {versions.length > 0 && (
          <ol className="pp-version-list">
            {versions.map((version) => (
              <li key={version.versionId || version.latestJobId}>
                <article>
                  <h3>
                    {version.versionId ? `Version ${version.versionId}` : "Version not recorded"}
                    <span className={statusClass(version.latestJobStatus)}>{version.latestJobStatus}</span>
                  </h3>
                  <p className="pp-panel__note">
                    {version.jobCount} {version.jobCount === 1 ? "job" : "jobs"}
                    {" · "}
                    {version.deliveryCount} {version.deliveryCount === 1 ? "delivery" : "deliveries"}
                    {" · "}
                    {displayWhen(version.latestCreatedAt)}
                  </p>
                  <div className="pp-table-wrap pp-content-table">
                    <table className="pp-admin-table">
                      <caption className="pp-sr-only">Publishing jobs for {version.versionId || "this version"}</caption>
                      <thead>
                        <tr>
                          <th scope="col">Job</th>
                          <th scope="col">Status</th>
                          <th scope="col">Trigger</th>
                          <th scope="col">Tickers</th>
                          <th scope="col">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {version.jobs.map((job) => (
                          <tr key={job.id}>
                            <td>{job.id}</td>
                            <td>
                              <span className={statusClass(job.status)}>{job.status}</span>
                            </td>
                            <td>{display(job.trigger)}</td>
                            <td>{job.tickerIds.length ? job.tickerIds.join(", ") : "none"}</td>
                            <td>{displayWhen(job.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="pp-stack-list">
                    {version.jobs.map((job) => (
                      <li key={`stack-${job.id}`}>
                        <article className="pp-stack-item">
                          <h3>{job.id}</h3>
                          <dl className="pp-dl">
                            <dt>Status</dt>
                            <dd>
                              <span className={statusClass(job.status)}>{job.status}</span>
                            </dd>
                            <dt>Trigger</dt>
                            <dd>{display(job.trigger)}</dd>
                            <dt>Tickers</dt>
                            <dd>{job.tickerIds.length ? job.tickerIds.join(", ") : "none"}</dd>
                            <dt>Created</dt>
                            <dd>{displayWhen(job.createdAt)}</dd>
                          </dl>
                        </article>
                      </li>
                    ))}
                  </ul>
                </article>
              </li>
            ))}
          </ol>
        )}
        {deliveriesLoading ? <p>Loading deliveries…</p> : null}
      </section>
    </div>
  );
}
