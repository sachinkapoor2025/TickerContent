import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "./api";
import { useCustomerAccess } from "./CustomerRole";
import { contentEditorHref } from "./contentData";
import {
  TEMPLATES_EMPTY_DESCRIPTION,
  TEMPLATES_EMPTY_TITLE,
  TEMPLATES_ERROR_MESSAGE,
  TEMPLATES_PAGE_DESCRIPTION,
  TEMPLATE_USE_ERROR,
  templateUseBody,
  templateUseLabel,
  templatesPageState,
  type TemplateRecord,
} from "./templateData";

export function TemplateLibrary() {
  const navigate = useNavigate();
  const { canUseTemplate } = useCustomerAccess();
  const [items, setItems] = useState<TemplateRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [usingId, setUsingId] = useState<string | null>(null);
  const [useError, setUseError] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const payload = await api<{ items: TemplateRecord[] }>("/v1/templates");
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setItems(null);
      if (err instanceof ApiError && err.status === 403) {
        setError(err.message?.trim() || "Not allowed.");
      } else {
        setError(TEMPLATES_ERROR_MESSAGE);
      }
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const page = templatesPageState({ loading, error, items });

  async function useTemplate(templateId: string, title: string) {
    if (usingId) return;
    setUsingId(templateId);
    try {
      const created = await api<{ id?: string }>("/v1/contents", {
        method: "POST",
        body: JSON.stringify(templateUseBody(title, templateId)),
      });
      setUseError("");
      if (created.id) {
        navigate(contentEditorHref(created.id));
        return;
      }
      setUseError(TEMPLATE_USE_ERROR);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setUseError(TEMPLATE_USE_ERROR);
    } finally {
      setUsingId(null);
    }
  }

  if (page.kind === "loading") {
    return (
      <>
        <h1>Templates</h1>
        <p className="muted" aria-live="polite">
          {page.message}
        </p>
      </>
    );
  }

  if (page.kind === "error") {
    return (
      <>
        <h1>Templates</h1>
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
          <h1>Templates</h1>
          <p className="muted page-lead">{TEMPLATES_PAGE_DESCRIPTION}</p>
        </div>
      </div>
      {useError ? (
        <p className="error" role="alert">
          {useError}
        </p>
      ) : null}
      {page.empty ? (
        <div className="empty-state">
          <h2>{TEMPLATES_EMPTY_TITLE}</h2>
          <p className="muted">{TEMPLATES_EMPTY_DESCRIPTION}</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Template</th>
                  <th scope="col">Category</th>
                  {canUseTemplate ? <th scope="col">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.category}</td>
                    {canUseTemplate ? (
                    <td>
                      <button
                        className="pp-btn pp-btn--link"
                        type="button"
                        disabled={Boolean(usingId)}
                        onClick={() => void useTemplate(row.id, row.name)}
                      >
                        {templateUseLabel(usingId === row.id)}
                      </button>
                    </td>
                    ) : null}
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
                    <dt>Category</dt>
                    <dd>{row.category}</dd>
                  </dl>
                  {canUseTemplate ? (
                  <button
                    className="pp-btn pp-btn--link"
                    type="button"
                    disabled={Boolean(usingId)}
                    onClick={() => void useTemplate(row.id, row.name)}
                  >
                    {templateUseLabel(usingId === row.id)}
                  </button>
                  ) : null}
                </article>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
