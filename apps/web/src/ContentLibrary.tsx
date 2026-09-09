import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "./api";
import { useCustomerAccess } from "./CustomerRole";
import {
  CONTENTS_EMPTY_DESCRIPTION,
  CONTENTS_EMPTY_TITLE,
  CONTENTS_PAGE_DESCRIPTION,
  CONTENT_CREATE_ERROR,
  contentCreateBody,
  contentsPageState,
  contentSubmitLabel,
  createdContentHref,
  validateContentName,
  type ContentRecord,
} from "./contentData";

export function ContentLibrary() {
  const navigate = useNavigate();
  const { canWriteContent } = useCustomerAccess();
  const [items, setItems] = useState<ContentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [nameError, setNameError] = useState("");
  const [name, setName] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const payload = await api<{ items: ContentRecord[] }>("/v1/contents");
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setItems(null);
      setError((err as Error).message?.trim() || "Unable to load your content.");
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const page = contentsPageState({ loading, error, items });

  async function createContent(event: { preventDefault(): void }) {
    event.preventDefault();
    const validated = validateContentName(name);
    if (!validated.ok) {
      setNameError(validated.message);
      setCreateError("");
      return;
    }
    setNameError("");
    setCreating(true);
    try {
      const created = await api<ContentRecord>("/v1/contents", {
        method: "POST",
        body: JSON.stringify(contentCreateBody(validated.title)),
      });
      setCreateError("");
      if (created.id) {
        navigate(createdContentHref(created.id));
        return;
      }
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setCreateError(CONTENT_CREATE_ERROR);
    } finally {
      setCreating(false);
    }
  }

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

  return (
    <>
      <div className="top">
        <div>
          <h1>Content</h1>
          <p className="muted page-lead">{CONTENTS_PAGE_DESCRIPTION}</p>
        </div>
      </div>
      {canWriteContent ? (
      <form id="create-content" className="card content-add" onSubmit={(event) => void createContent(event)}>
        <h2>Create content</h2>
        <div className="content-add__fields">
          <div>
            <label htmlFor="content-create-name">Content name</label>
            <input
              id="content-create-name"
              className="pp-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(nameError)}
              aria-describedby={nameError ? "content-create-name-error" : undefined}
            />
            {nameError ? (
              <p id="content-create-name-error" className="error" role="alert">
                {nameError}
              </p>
            ) : null}
          </div>
        </div>
        {createError ? (
          <p className="error" role="alert">
            {createError}
          </p>
        ) : null}
        <button className="pp-btn pp-btn--primary" type="submit" disabled={creating}>
          {contentSubmitLabel(creating)}
        </button>
      </form>
      ) : null}
      {page.empty ? (
        <div className="empty-state">
          <h2>{CONTENTS_EMPTY_TITLE}</h2>
          <p className="muted">{CONTENTS_EMPTY_DESCRIPTION}</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Content</th>
                  <th scope="col">Status</th>
                  <th scope="col">Published version</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>
                      <span className={row.statusClass}>{row.statusLabel}</span>
                    </td>
                    <td>{row.publishedLabel}</td>
                    <td>
                      <Link className="pp-btn pp-btn--link" to={row.href}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="stack-list">
            {page.rows.map((row) => (
              <li key={row.id}>
                <article>
                  <h2>{row.name}</h2>
                  <dl>
                    <dt>Status</dt>
                    <dd>
                      <span className={row.statusClass}>{row.statusLabel}</span>
                    </dd>
                    <dt>Published version</dt>
                    <dd>{row.publishedLabel}</dd>
                  </dl>
                  <Link className="pp-btn pp-btn--link" to={row.href}>
                    Open
                  </Link>
                </article>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
