import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "./api";
import {
  CONTENT_DETAIL_DESCRIPTION,
  contentDetailPageState,
  type ContentRecord,
} from "./contentData";

export function ContentDetail() {
  const { id } = useParams();
  const [row, setRow] = useState<ContentRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<ContentRecord>(`/v1/contents/${id}`);
      setRow(data);
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setRow(null);
      setError((err as Error).message?.trim() || "Unable to load this content.");
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  const page = contentDetailPageState({ loading, error, row });

  if (page.kind === "loading") {
    return (
      <>
        <h1>Content</h1>
        <p className="muted" aria-live="polite">
          {page.message}
        </p>
      </>
    );
  }

  if (page.kind === "error") {
    return (
      <>
        <p>
          <Link className="pp-btn pp-btn--link" to="/content">
            Content
          </Link>
        </p>
        <h1>Content</h1>
        <p className="error" role="alert">
          {page.message}
        </p>
        <button className="pp-btn pp-btn--ghost" type="button" onClick={() => void load()}>
          Try again
        </button>
      </>
    );
  }

  const { view } = page;
  return (
    <>
      <p>
        <Link className="pp-btn pp-btn--link" to="/content">
          Content
        </Link>
      </p>
      <h1>{view.name}</h1>
      <p className="muted page-lead">{CONTENT_DETAIL_DESCRIPTION}</p>
      <dl className="spec-block">
        <div>
          <dt>Status</dt>
          <dd>
            <span className={view.statusClass}>{view.statusLabel}</span>
          </dd>
        </div>
        <div>
          <dt>Published version</dt>
          <dd>{view.publishedLabel}</dd>
        </div>
      </dl>
      <p>
        <Link className="pp-btn pp-btn--primary" to={view.editorHref}>
          Open editor
        </Link>
      </p>
      <section className="content-versions" aria-labelledby="content-versions-heading">
        <h2 id="content-versions-heading">Versions</h2>
        {view.versions.length === 0 ? (
          <p className="muted">No versions are available for this content.</p>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Version</th>
                    <th scope="col">Created</th>
                    <th scope="col">Status</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {view.versions.map((version) => (
                    <tr key={version.id}>
                      <td>{version.id}</td>
                      <td>{version.createdLabel}</td>
                      <td>
                        <span className={version.statusClass}>{version.statusLabel}</span>
                      </td>
                      <td>
                        {version.editorHref ? (
                          <Link className="pp-btn pp-btn--link" to={version.editorHref}>
                            Open editor
                          </Link>
                        ) : version.published ? (
                          "Published snapshot"
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="stack-list">
              {view.versions.map((version) => (
                <li key={version.id}>
                  <article>
                    <h3>{version.id}</h3>
                    <dl>
                      <dt>Created</dt>
                      <dd>{version.createdLabel}</dd>
                      <dt>Status</dt>
                      <dd>
                        <span className={version.statusClass}>{version.statusLabel}</span>
                      </dd>
                    </dl>
                    {version.editorHref ? (
                      <Link className="pp-btn pp-btn--link" to={version.editorHref}>
                        Open editor
                      </Link>
                    ) : version.published ? (
                      <p className="muted">Published snapshot</p>
                    ) : null}
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </>
  );
}
