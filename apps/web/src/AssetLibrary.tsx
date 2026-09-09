import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "./api";
import { useCustomerAccess } from "./CustomerRole";
import {
  ASSETS_EDITOR_NOTE,
  ASSETS_EMPTY_DESCRIPTION,
  ASSETS_EMPTY_TITLE,
  ASSETS_ERROR_MESSAGE,
  ASSETS_PAGE_DESCRIPTION,
  ASSET_ACCEPT,
  ASSET_DELETE_ERROR,
  ASSET_DELETE_PROMPT,
  ASSET_UPLOAD_ERROR,
  ASSET_UPLOAD_SUCCESS,
  assetSubmitLabel,
  assetUploadFormData,
  assetsPageState,
  validateAssetFile,
  type AssetRecord,
} from "./assetData";

export function AssetLibrary() {
  const { canManageAssets } = useCustomerAccess();
  const [items, setItems] = useState<AssetRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [fileError, setFileError] = useState("");
  const [msg, setMsg] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const payload = await api<{ items: AssetRecord[] }>("/v1/assets");
      setItems(Array.isArray(payload.items) ? payload.items : []);
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setItems(null);
      if (err instanceof ApiError && err.status === 403) {
        setError(err.message?.trim() || "Not allowed.");
      } else {
        setError(ASSETS_ERROR_MESSAGE);
      }
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const page = assetsPageState({ loading, error, items });

  async function uploadAsset(event: { preventDefault(): void; currentTarget: HTMLFormElement }) {
    event.preventDefault();
    if (uploading) return;
    const fileInput = event.currentTarget.elements.namedItem("file");
    const file = fileInput instanceof HTMLInputElement ? fileInput.files?.[0] : null;
    const validated = validateAssetFile(file);
    if (!validated.ok) {
      setFileError(validated.message);
      setUploadError("");
      setMsg("");
      return;
    }
    setFileError("");
    setUploading(true);
    try {
      await api<AssetRecord>("/v1/assets", {
        method: "POST",
        body: assetUploadFormData(validated.file),
      });
      setUploadError("");
      setMsg(ASSET_UPLOAD_SUCCESS);
      event.currentTarget.reset();
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setUploadError(ASSET_UPLOAD_ERROR);
      setMsg("");
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete(id: string) {
    if (deleting) return;
    setDeleting(true);
    try {
      await api(`/v1/assets/${id}`, { method: "DELETE" });
      setDeleteError("");
      setPendingDelete(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setDeleteError(ASSET_DELETE_ERROR);
    } finally {
      setDeleting(false);
    }
  }

  if (page.kind === "loading") {
    return (
      <>
        <h1>Assets</h1>
        <p className="muted" aria-live="polite">
          {page.message}
        </p>
      </>
    );
  }

  if (page.kind === "error") {
    return (
      <>
        <h1>Assets</h1>
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
          <h1>Assets</h1>
          <p className="muted page-lead">{ASSETS_PAGE_DESCRIPTION}</p>
        </div>
      </div>
      {canManageAssets ? (
      <form id="upload-asset" className="card asset-add" onSubmit={(event) => void uploadAsset(event)}>
        <h2>Upload asset</h2>
        <div className="asset-add__fields">
          <div>
            <label htmlFor="asset-upload-file">File</label>
            <input
              id="asset-upload-file"
              className="pp-input"
              type="file"
              name="file"
              accept={ASSET_ACCEPT}
              disabled={uploading}
              aria-invalid={Boolean(fileError)}
              aria-describedby={fileError ? "asset-upload-file-error" : "asset-upload-help"}
            />
            <p id="asset-upload-help" className="muted">
              PNG, JPEG, WebP, or Lottie JSON.
            </p>
            {fileError ? (
              <p id="asset-upload-file-error" className="error" role="alert">
                {fileError}
              </p>
            ) : null}
          </div>
        </div>
        {uploadError ? (
          <p className="error" role="alert">
            {uploadError}
          </p>
        ) : null}
        {msg ? <p className="muted">{msg}</p> : null}
        <button className="pp-btn pp-btn--primary" type="submit" disabled={uploading}>
          {assetSubmitLabel(uploading)}
        </button>
      </form>
      ) : null}
      {page.empty ? (
        <div className="empty-state">
          <h2>{ASSETS_EMPTY_TITLE}</h2>
          <p className="muted">{ASSETS_EMPTY_DESCRIPTION}</p>
          <p className="muted">{ASSETS_EDITOR_NOTE}</p>
        </div>
      ) : (
        <>
          <p className="muted">{ASSETS_EDITOR_NOTE}</p>
          {deleteError ? (
            <p className="error" role="alert">
              {deleteError}
            </p>
          ) : null}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Asset</th>
                  <th scope="col">Type</th>
                  <th scope="col">Size</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.typeLabel}</td>
                    <td>{row.sizeLabel}</td>
                    <td>
                      <AssetActions
                        href={row.href}
                        canDelete={canManageAssets && row.canDelete}
                        pending={pendingDelete === row.id}
                        deleting={deleting && pendingDelete === row.id}
                        onAskDelete={() => {
                          setPendingDelete(row.id);
                          setDeleteError("");
                        }}
                        onCancel={() => setPendingDelete(null)}
                        onConfirm={() => void confirmDelete(row.id)}
                      />
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
                    <dt>Type</dt>
                    <dd>{row.typeLabel}</dd>
                    <dt>Size</dt>
                    <dd>{row.sizeLabel}</dd>
                  </dl>
                  <AssetActions
                    href={row.href}
                    canDelete={canManageAssets && row.canDelete}
                    pending={pendingDelete === row.id}
                    deleting={deleting && pendingDelete === row.id}
                    onAskDelete={() => {
                      setPendingDelete(row.id);
                      setDeleteError("");
                    }}
                    onCancel={() => setPendingDelete(null)}
                    onConfirm={() => void confirmDelete(row.id)}
                  />
                </article>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function AssetActions({
  href,
  canDelete,
  pending,
  deleting,
  onAskDelete,
  onCancel,
  onConfirm,
}: {
  href: string;
  canDelete: boolean;
  pending: boolean;
  deleting: boolean;
  onAskDelete: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="asset-actions">
      <Link className="pp-btn pp-btn--link" to={href}>
        Open
      </Link>
      {canDelete && !pending ? (
        <button className="pp-btn pp-btn--ghost" type="button" onClick={onAskDelete}>
          Delete
        </button>
      ) : null}
      {canDelete && pending ? (
        <div className="asset-delete-confirm" role="group" aria-label={ASSET_DELETE_PROMPT}>
          <p role="alert">{ASSET_DELETE_PROMPT}</p>
          <button className="pp-btn pp-btn--ghost" type="button" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
          <button className="pp-btn pp-btn--link" type="button" onClick={onCancel} disabled={deleting}>
            Cancel
          </button>
        </div>
      ) : null}
    </div>
  );
}
