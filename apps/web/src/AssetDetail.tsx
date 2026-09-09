import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { LottieLayer } from "@ticker-cms/composition";
import { api, ApiError, token } from "./api";
import { useCustomerAccess } from "./CustomerRole";
import {
  ASSET_DELETE_ERROR,
  ASSET_DELETE_PROMPT,
  ASSET_DETAIL_DESCRIPTION,
  ASSET_DETAIL_ERROR_MESSAGE,
  ASSET_IMAGE_PREVIEW_UNAVAILABLE,
  ASSET_LOTTIE_PREVIEW_UNAVAILABLE,
  assetDetailPageState,
  findAsset,
  type AssetDetailView,
  type AssetRecord,
} from "./assetData";
import { AssetMediaSession } from "./media/assetClient";
import { createLottieRenderer } from "./media/lottieRenderer";

export function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { canManageAssets } = useCustomerAccess();
  const [item, setItem] = useState<AssetRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const payload = await api<{ items: AssetRecord[] }>("/v1/assets");
      const row = findAsset(payload.items, id);
      if (!row) {
        setItem(null);
        setError(ASSET_DETAIL_ERROR_MESSAGE);
        setLoading(false);
        return;
      }
      setItem(row);
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setItem(null);
      if (err instanceof ApiError && err.status === 403) {
        setError(err.message?.trim() || "Not allowed.");
      } else {
        setError(ASSET_DETAIL_ERROR_MESSAGE);
      }
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  const page = assetDetailPageState({ loading, error, item });

  async function confirmDelete() {
    if (!id || deleting) return;
    setDeleting(true);
    try {
      await api(`/v1/assets/${id}`, { method: "DELETE" });
      navigate("/assets");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setDeleteError(ASSET_DELETE_ERROR);
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
        <p>
          <Link className="pp-btn pp-btn--link" to="/assets">
            Assets
          </Link>
        </p>
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

  const { view } = page;

  return (
    <>
      <p>
        <Link className="pp-btn pp-btn--link" to="/assets">
          Assets
        </Link>
      </p>
      <h1>{view.name}</h1>
      <p className="muted page-lead">{ASSET_DETAIL_DESCRIPTION}</p>
      <dl className="spec-block">
        <div>
          <dt>Type</dt>
          <dd>{view.typeLabel}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{view.sizeLabel}</dd>
        </div>
      </dl>
      <section aria-labelledby="asset-preview-heading">
        <h2 id="asset-preview-heading">Preview</h2>
        <AssetPreview view={view} />
      </section>
      {canManageAssets && view.canDelete ? (
        <div className="asset-detail-actions">
          {pendingDelete ? (
            <div className="asset-delete-confirm" role="group" aria-label={ASSET_DELETE_PROMPT}>
              <p role="alert">{ASSET_DELETE_PROMPT}</p>
              {deleteError ? (
                <p className="error" role="alert">
                  {deleteError}
                </p>
              ) : null}
              <button className="pp-btn pp-btn--ghost" type="button" onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </button>
              <button className="pp-btn pp-btn--link" type="button" onClick={() => setPendingDelete(false)} disabled={deleting}>
                Cancel
              </button>
            </div>
          ) : (
            <button className="pp-btn pp-btn--ghost" type="button" onClick={() => setPendingDelete(true)}>
              Delete
            </button>
          )}
        </div>
      ) : null}
    </>
  );
}

function AssetPreview({ view }: { view: AssetDetailView }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const session = useMemo(
    () =>
      new AssetMediaSession({
        fetch: globalThis.fetch.bind(globalThis),
        getToken: () => token(),
      }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    setStatus("loading");
    (async () => {
      try {
        if (view.previewKind === "image") {
          const image = await session.loadImage(view.id);
          if (cancelled) return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          const sourceWidth = "width" in image ? Number(image.width) || 1 : 1;
          const sourceHeight = "height" in image ? Number(image.height) || 1 : 1;
          const scale = Math.min(1, 320 / Math.max(sourceWidth, sourceHeight));
          canvas.width = Math.max(1, Math.round(sourceWidth * scale));
          canvas.height = Math.max(1, Math.round(sourceHeight * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setStatus("error");
            return;
          }
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          setStatus("ready");
          return;
        }
        if (view.previewKind === "lottie") {
          const json = await session.loadLottie(view.id);
          if (cancelled) return;
          const canvas = canvasRef.current;
          if (!canvas) return;
          canvas.width = 160;
          canvas.height = 160;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            setStatus("error");
            return;
          }
          const renderLottie = createLottieRenderer(new Map([[view.id, json]]));
          const layer: LottieLayer = { id: "preview", type: "lottie", assetId: view.id, loop: true, zIndex: 0 };
          const start = performance.now();
          const loop = (time: number) => {
            const frame = renderLottie({
              assetId: view.id,
              layer,
              timeMs: time - start,
              width: 160,
              height: 160,
            });
            ctx.clearRect(0, 0, 160, 160);
            if (frame) ctx.drawImage(frame, 0, 0, 160, 160);
            raf = requestAnimationFrame(loop);
          };
          setStatus("ready");
          raf = requestAnimationFrame(loop);
          return;
        }
        setStatus("error");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [session, view.id, view.previewKind]);

  if (view.previewKind === "none") {
    return <p className="muted">Preview is not available for this asset type.</p>;
  }

  const unavailable =
    view.previewKind === "lottie" ? ASSET_LOTTIE_PREVIEW_UNAVAILABLE : ASSET_IMAGE_PREVIEW_UNAVAILABLE;
  const label = view.previewKind === "lottie" ? `${view.name} Lottie preview` : `${view.name} image preview`;

  return (
    <div className="asset-preview">
      {status === "loading" ? (
        <p className="muted" aria-live="polite">
          Loading preview…
        </p>
      ) : null}
      {status === "error" ? (
        <p className="error" role="alert">
          {unavailable}
        </p>
      ) : null}
      <canvas
        ref={canvasRef}
        className="asset-preview__canvas"
        hidden={status !== "ready"}
        role="img"
        aria-label={label}
      />
    </div>
  );
}
