import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { layerZIndex, type ColorMode, type CompositionDocument, type Layer } from "@ticker-cms/composition";
import { api, ApiError } from "./api";
import { useCustomerAccess } from "./CustomerRole";
import { TickerDisplay } from "./components/TickerDisplay";
import {
  addFillLayer,
  addImageLayer,
  addLottieLayer,
  addTextLayer,
  applyDisplayProfile,
  layerLabel,
  layerTypeLabel,
  layersByStack,
  moveLayer,
  removeLayer,
  setLayerGeometry,
  setLayerVisible,
  updateLayer,
} from "./editor/documentOps";
import {
  EDITOR_EMPTY_MESSAGE,
  EDITOR_ERROR_MESSAGE,
  EDITOR_NO_IMAGE_ASSETS,
  EDITOR_NO_LOTTIE_ASSETS,
  EDITOR_PREVIEW_LABEL,
  EDITOR_PUBLISHED_NOTE,
  EDITOR_SAVE_ERROR,
  EDITOR_SAVE_SUCCESS,
  assetNameMap,
  assetsByKind,
  canSaveDocument,
  contentEditorBackHref,
  documentForEditor,
  editorDirty,
  editorPageState,
  editorPublishMessage,
  editorSaveStatus,
  editorSnapshot,
  editorSubmitLabel,
  hasPublishedVersion,
  parseEditorInteger,
  profileFromTicker,
  resolveEditorProfile,
  saveDraftBody,
  tickerEditorBackHref,
  type EditorAsset,
} from "./editor/editorState";
import { useCompositionMedia } from "./editor/useCompositionMedia";
import { TICKER_DESIGN_TITLE, TICKER_DETAIL_ERROR_MESSAGE, colorModeLabel, displayProfileLabel } from "./tickerData";

type TickerRow = { id: string; name: string; width: number; height: number; colorMode?: ColorMode };
type AssetRow = { id: string; name: string; kind: string };

type ContentPayload = {
  title: string;
  document?: unknown;
  headDraftVersionId?: string | null;
  publishedVersionId?: string | null;
};

export function Editor({ boundTickerId }: { boundTickerId?: string } = {}) {
  const { id } = useParams();
  const { canWriteContent, canPublish } = useCustomerAccess();
  const tickerBound = Boolean(boundTickerId);
  const [title, setTitle] = useState("");
  const [doc, setDoc] = useState<CompositionDocument | null>(null);
  const [baseline, setBaseline] = useState<string | null>(null);
  const [headVersionId, setHeadVersionId] = useState<string | null>(null);
  const [publishedVersionId, setPublishedVersionId] = useState<string | null>(null);
  const [tickers, setTickers] = useState<TickerRow[]>([]);
  const [tickerId, setTickerId] = useState("");
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | "image" | "lottie">(null);
  const [msg, setMsg] = useState("");
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { resources, error: mediaError } = useCompositionMedia(doc);

  async function loadAssets() {
    try {
      const assetsPayload = await api<{ items: AssetRow[] }>("/v1/assets");
      return Array.isArray(assetsPayload.items) ? assetsPayload.items : [];
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) throw err;
      return [] as AssetRow[];
    }
  }

  async function loadTickerList() {
    try {
      const tickersPayload = await api<{ items: TickerRow[] }>("/v1/tickers");
      return Array.isArray(tickersPayload.items) ? tickersPayload.items : [];
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) throw err;
      return [] as TickerRow[];
    }
  }

  async function load() {
    if (boundTickerId) {
      setLoading(true);
      setError(null);
      try {
        const ticker = await api<TickerRow>(`/v1/tickers/${boundTickerId}`);
        const tickerList = await loadTickerList();
        const assetList = await loadAssets();
        const selectedTicker = tickerList.find((item) => item.id === boundTickerId) ?? ticker;
        const nextList = tickerList.some((item) => item.id === boundTickerId) ? tickerList : [ticker, ...tickerList];
        const profile = resolveEditorProfile({ ticker: selectedTicker, document: null });
        const nextDoc = documentForEditor({ payload: {}, profile });
        if (!nextDoc) {
          setDoc(null);
          setError(TICKER_DETAIL_ERROR_MESSAGE);
          setLoading(false);
          return;
        }
        const nextTitle = selectedTicker.name?.trim() || TICKER_DESIGN_TITLE;
        setTitle(nextTitle);
        setDoc(nextDoc);
        setBaseline(editorSnapshot(nextTitle, nextDoc));
        setHeadVersionId(null);
        setPublishedVersionId(null);
        setTickers(nextList);
        setTickerId(boundTickerId);
        setAssets(assetList);
        setSelectedId(nextDoc.layers[0]?.id ?? null);
        setMsg("");
        setSaveError("");
        setLoading(false);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
        setDoc(null);
        setError(TICKER_DETAIL_ERROR_MESSAGE);
        setLoading(false);
      }
      return;
    }
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const row = await api<ContentPayload>(`/v1/contents/${id}`);
      let tickerList: TickerRow[] = [];
      let assetList: AssetRow[] = [];
      try {
        tickerList = await loadTickerList();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
      }
      try {
        assetList = await loadAssets();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return;
      }
      const nextTickerId = tickerId || tickerList[0]?.id || "";
      const selectedTicker = tickerList.find((ticker) => ticker.id === nextTickerId) ?? null;
      const stored = documentForEditor({ payload: row, profile: null });
      const profile = resolveEditorProfile({ ticker: selectedTicker, document: stored });
      const nextDoc = documentForEditor({ payload: row, profile });
      if (!nextDoc) {
        setDoc(null);
        setError(EDITOR_ERROR_MESSAGE);
        setLoading(false);
        return;
      }
      const nextTitle = row.title ?? "";
      setTitle(nextTitle);
      setDoc(nextDoc);
      setBaseline(editorSnapshot(nextTitle, nextDoc));
      setHeadVersionId(row.headDraftVersionId ?? null);
      setPublishedVersionId(row.publishedVersionId ?? null);
      setTickers(tickerList);
      setTickerId(nextTickerId);
      setAssets(assetList);
      setSelectedId(nextDoc.layers[0]?.id ?? null);
      setMsg("");
      setSaveError("");
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setDoc(null);
      setError((err as Error).message?.trim() || EDITOR_ERROR_MESSAGE);
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id, boundTickerId]);

  const selectedTicker = tickers.find((ticker) => ticker.id === tickerId) ?? null;
  const profile = doc?.profile ?? profileFromTicker(selectedTicker);
  const selected = doc?.layers.find((layer) => layer.id === selectedId) ?? null;
  const imageAssets = useMemo(() => assetsByKind(assets, "image"), [assets]);
  const lottieAssets = useMemo(() => assetsByKind(assets, "lottie"), [assets]);
  const names = useMemo(() => assetNameMap(assets), [assets]);
  const dirty = editorDirty({ title, document: doc, baseline });
  const page = editorPageState({ loading, error, ready: Boolean(doc && profile) });

  const mutate = (next: CompositionDocument, selectId?: string) => {
    setDoc(next);
    if (selectId) setSelectedId(selectId);
    setMsg("");
    setSaveError("");
  };

  async function saveVersion() {
    if (tickerBound || !id || !doc) return;
    const valid = canSaveDocument(doc);
    if (!valid.ok) {
      setSaveError(valid.message);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const saved = await api<{ versionId: string }>(`/v1/contents/${id}`, {
        method: "PATCH",
        body: JSON.stringify(saveDraftBody(title, doc)),
      });
      setHeadVersionId(saved.versionId);
      setBaseline(editorSnapshot(title, doc));
      setMsg(EDITOR_SAVE_SUCCESS);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setSaveError(EDITOR_SAVE_ERROR);
    } finally {
      setSaving(false);
    }
  }

  if (page.kind === "loading") {
    return (
      <>
        <h1>{tickerBound ? TICKER_DESIGN_TITLE : "Editor"}</h1>
        <p className="muted" aria-live="polite">
          {page.message}
        </p>
      </>
    );
  }

  if (page.kind === "error") {
    return (
      <>
        {tickerBound || id ? (
        <p>
          <Link className="pp-btn pp-btn--link" to={tickerBound ? tickerEditorBackHref() : contentEditorBackHref(id ?? "")}>
            {tickerBound ? "My Tickers" : "Content"}
          </Link>
        </p>
        ) : null}
        <h1>{tickerBound ? TICKER_DESIGN_TITLE : "Editor"}</h1>
        <p className="error" role="alert">
          {page.message}
        </p>
        <button className="pp-btn pp-btn--ghost" type="button" onClick={() => void load()}>
          Try again
        </button>
      </>
    );
  }

  if (!doc || !profile) return null;

  return (
    <>
      <div className="editor-header">
        <p>
          <Link className="pp-btn pp-btn--link" to={tickerBound ? tickerEditorBackHref() : contentEditorBackHref(id ?? "")}>
            {tickerBound ? "My Tickers" : "Content"}
          </Link>
        </p>
        <div className="top">
          <div>
            <h1>{tickerBound ? TICKER_DESIGN_TITLE : title.trim() || "Untitled content"}</h1>
            <p className="muted page-lead">
              {selectedTicker?.name ? `${selectedTicker.name} · ` : ""}
              {displayProfileLabel(profile.width, profile.height)} · {colorModeLabel(profile.colorMode)}
            </p>
          </div>
          {tickerBound ? null : (
          <p className="muted" aria-live="polite">
            {editorSaveStatus({ dirty, saving })}
          </p>
          )}
        </div>
      </div>
      <div className="editor-toolbar" role="toolbar" aria-label="Editor tools">
        {canWriteContent ? (
          <>
        <button
          className="pp-btn pp-btn--ghost"
          type="button"
          onClick={() => {
            const next = addTextLayer(doc);
            mutate(next, next.layers[next.layers.length - 1]?.id);
          }}
        >
          Add text
        </button>
        <button className="pp-btn pp-btn--ghost" type="button" onClick={() => setPicker("image")}>
          Add image
        </button>
        <button className="pp-btn pp-btn--ghost" type="button" onClick={() => setPicker("lottie")}>
          Add Lottie
        </button>
        {tickerBound ? null : (
        <button className="pp-btn pp-btn--primary" type="button" onClick={() => void saveVersion()} disabled={saving}>
          {editorSubmitLabel(saving)}
        </button>
        )}
          </>
        ) : null}
        {canPublish && !tickerBound ? (
        <button
          className="pp-btn pp-btn--ghost"
          type="button"
          onClick={async () => {
            try {
              const published = await api<{ snapshot?: { version?: string }; deliveries?: number }>(`/v1/contents/${id}/publish`, {
                method: "POST",
                body: JSON.stringify({ tickerIds: tickerId ? [tickerId] : [] }),
              });
              if (published.snapshot?.version) setPublishedVersionId(published.snapshot.version);
              setMsg(editorPublishMessage({ selectedTickerId: tickerId, deliveries: published.deliveries }));
            } catch (err) {
              if (err instanceof ApiError && err.status === 401) return;
              setSaveError((err as Error).message?.trim() || "Unable to publish.");
            }
          }}
        >
          Publish
        </button>
        ) : null}
      </div>
      {tickerBound || !hasPublishedVersion(publishedVersionId) ? null : <p className="muted">{EDITOR_PUBLISHED_NOTE}</p>}
      {saveError ? (
        <p className="error" role="alert">
          {saveError}
        </p>
      ) : null}
      {msg ? (
        <p className="muted" role="status">
          {msg}
        </p>
      ) : null}
      {mediaError ? (
        <p className="error" role="alert">
          {mediaError}
        </p>
      ) : null}
      {picker ? (
        <div className="card editor-picker">
          <h2>{picker === "image" ? "Select image asset" : "Select Lottie asset"}</h2>
          {(picker === "image" ? imageAssets : lottieAssets).length === 0 ? (
            <p className="muted">{picker === "image" ? EDITOR_NO_IMAGE_ASSETS : EDITOR_NO_LOTTIE_ASSETS}</p>
          ) : (
            <label htmlFor="editor-asset-picker">{picker === "image" ? "Image asset" : "Lottie asset"}</label>
          )}
          {(picker === "image" ? imageAssets : lottieAssets).length > 0 ? (
            <select
              id="editor-asset-picker"
              className="pp-input"
              defaultValue=""
              onChange={(event) => {
                const assetId = event.target.value;
                if (!assetId) return;
                const next = picker === "image" ? addImageLayer(doc, assetId) : addLottieLayer(doc, assetId);
                mutate(next, next.layers[next.layers.length - 1]?.id);
                setPicker(null);
              }}
            >
              <option value="">Choose…</option>
              {(picker === "image" ? imageAssets : lottieAssets).map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          ) : null}
          <button className="pp-btn pp-btn--ghost" type="button" onClick={() => setPicker(null)}>
            Cancel
          </button>
        </div>
      ) : null}
      <div className="editor">
        <div className="editor-stage">
          {tickerBound ? null : (
            <>
          <label htmlFor="editor-title">Content name</label>
          <input
            id="editor-title"
            className="pp-input"
            type="text"
            value={title}
            readOnly={!canWriteContent}
            onChange={(event) => {
              setTitle(event.target.value);
              setMsg("");
            }}
          />
            </>
          )}
          <label htmlFor="editor-ticker">{tickerBound ? "Ticker" : "Display profile"}</label>
          <select
            id="editor-ticker"
            className="pp-input"
            value={tickerId}
            disabled={tickerBound || !canWriteContent}
            onChange={(event) => {
              const nextId = event.target.value;
              setTickerId(nextId);
              const ticker = tickers.find((item) => item.id === nextId);
              const nextProfile = profileFromTicker(ticker);
              if (nextProfile) mutate(applyDisplayProfile(doc, nextProfile));
            }}
          >
            {tickers.length === 0 ? <option value="">No tickers — using saved profile</option> : null}
            {tickers.map((ticker) => (
              <option key={ticker.id} value={ticker.id}>
                {ticker.name} ({ticker.width}×{ticker.height})
              </option>
            ))}
          </select>
          <div className="editor-preview">
            {doc.layers.length === 0 ? <p className="muted editor-empty">{EDITOR_EMPTY_MESSAGE}</p> : null}
            <TickerDisplay document={doc} resources={resources} label={EDITOR_PREVIEW_LABEL} scale="large" />
          </div>
          {tickerBound || !headVersionId ? null : <p className="muted">Draft version {headVersionId}</p>}
        </div>
        <div className="card editor-panel">
          <h2>Layers</h2>
          {doc.layers.length === 0 ? (
            <p className="muted">No layers yet.</p>
          ) : (
            <div className="layer-list">
              {layersByStack(doc.layers).map((layer) => (
                <button
                  key={layer.id}
                  type="button"
                  className={`layer-item ${layer.id === selectedId ? "selected" : ""}`}
                  aria-pressed={layer.id === selectedId}
                  onClick={() => setSelectedId(layer.id)}
                >
                  <span>{layerLabel(layer, names)}</span>
                  <small>
                    {layerTypeLabel(layer)} · z {layerZIndex(layer)}
                    {layer.visible === false ? " · hidden" : ""}
                  </small>
                </button>
              ))}
            </div>
          )}
          {canWriteContent && !doc.layers.some((layer) => layer.type === "fill") ? (
            <button
              className="pp-btn pp-btn--ghost"
              type="button"
              onClick={() => {
                const next = addFillLayer(doc);
                mutate(next, next.layers.find((layer) => layer.type === "fill")?.id);
              }}
            >
              Add background
            </button>
          ) : null}
          {selected ? (
            <LayerProperties
              layer={selected}
              doc={doc}
              imageAssets={imageAssets}
              lottieAssets={lottieAssets}
              canWrite={canWriteContent}
              onChange={mutate}
              onSelect={setSelectedId}
            />
          ) : (
            <p className="muted">Select a layer to edit its properties.</p>
          )}
        </div>
      </div>
    </>
  );
}

function LayerProperties({
  layer,
  doc,
  imageAssets,
  lottieAssets,
  canWrite,
  onChange,
  onSelect,
}: {
  layer: Layer;
  doc: CompositionDocument;
  imageAssets: Array<EditorAsset & { id: string; name: string }>;
  lottieAssets: Array<EditorAsset & { id: string; name: string }>;
  canWrite: boolean;
  onChange: (next: CompositionDocument, selectId?: string) => void;
  onSelect: (id: string | null) => void;
}) {
  const [fieldError, setFieldError] = useState("");

  useEffect(() => {
    setFieldError("");
  }, [layer.id]);

  function applyNumber(key: "x" | "y" | "width" | "height" | "zIndex", raw: string, min: number) {
    const parsed = parseEditorInteger(raw, min);
    if (!parsed.ok) {
      setFieldError(parsed.message);
      return;
    }
    setFieldError("");
    onChange(setLayerGeometry(doc, layer.id, { [key]: parsed.value }));
  }

  const hideLabel = `Hide ${layerTypeLabel(layer)} layer`;
  const showLabel = `Show ${layerTypeLabel(layer)} layer`;

  return (
    <div className="editor-props">
      <h3>Properties</h3>
      {canWrite ? (
      <div className="row editor-props-actions">
        <button className="pp-btn pp-btn--ghost" type="button" onClick={() => onChange(moveLayer(doc, layer.id, "up"))}>
          Move up
        </button>
        <button className="pp-btn pp-btn--ghost" type="button" onClick={() => onChange(moveLayer(doc, layer.id, "down"))}>
          Move down
        </button>
        <button
          className="pp-btn pp-btn--ghost"
          type="button"
          onClick={() => {
            const next = removeLayer(doc, layer.id);
            onChange(next);
            onSelect(next.layers[0]?.id ?? null);
          }}
        >
          Remove
        </button>
      </div>
      ) : null}
      <fieldset className="editor-props-readonly" disabled={!canWrite}>
      <label className="editor-check">
        <input
          type="checkbox"
          checked={layer.visible !== false}
          aria-label={layer.visible === false ? showLabel : hideLabel}
          onChange={(event) => onChange(setLayerVisible(doc, layer.id, event.target.checked))}
        />
        Visible
      </label>
      <label htmlFor="layer-x">X</label>
      <input
        id="layer-x"
        className="pp-input"
        type="number"
        min={0}
        step={1}
        value={layer.x ?? 0}
        onChange={(event) => applyNumber("x", event.target.value, 0)}
      />
      <label htmlFor="layer-y">Y</label>
      <input
        id="layer-y"
        className="pp-input"
        type="number"
        min={0}
        step={1}
        value={layer.y ?? 0}
        onChange={(event) => applyNumber("y", event.target.value, 0)}
      />
      <label htmlFor="layer-width">Width</label>
      <input
        id="layer-width"
        className="pp-input"
        type="number"
        min={1}
        step={1}
        value={layer.width ?? doc.profile.width}
        onChange={(event) => applyNumber("width", event.target.value, 1)}
      />
      <label htmlFor="layer-height">Height</label>
      <input
        id="layer-height"
        className="pp-input"
        type="number"
        min={1}
        step={1}
        value={layer.height ?? doc.profile.height}
        onChange={(event) => applyNumber("height", event.target.value, 1)}
      />
      <label htmlFor="layer-z">Z-index</label>
      <input
        id="layer-z"
        className="pp-input"
        type="number"
        step={1}
        value={layerZIndex(layer)}
        onChange={(event) => applyNumber("zIndex", event.target.value, Number.MIN_SAFE_INTEGER)}
      />
      {fieldError ? (
        <p className="error" role="alert">
          {fieldError}
        </p>
      ) : null}
      {layer.type === "fill" ? (
        <>
          <label htmlFor="layer-fill-color">Background color</label>
          <input
            id="layer-fill-color"
            className="pp-input"
            value={layer.props.color}
            onChange={(event) =>
              onChange(
                updateLayer(doc, layer.id, (current) =>
                  current.type === "fill" ? { ...current, props: { color: event.target.value } } : current,
                ),
              )
            }
          />
        </>
      ) : null}
      {layer.type === "text" ? (
        <>
          <label htmlFor="layer-text">Text</label>
          <textarea
            id="layer-text"
            className="pp-input"
            rows={3}
            value={layer.props.text}
            onChange={(event) =>
              onChange(
                updateLayer(doc, layer.id, (current) =>
                  current.type === "text" ? { ...current, props: { ...current.props, text: event.target.value } } : current,
                ),
              )
            }
          />
          <label htmlFor="layer-text-color">Color</label>
          <input
            id="layer-text-color"
            className="pp-input"
            value={layer.props.color}
            onChange={(event) =>
              onChange(
                updateLayer(doc, layer.id, (current) =>
                  current.type === "text" ? { ...current, props: { ...current.props, color: event.target.value } } : current,
                ),
              )
            }
          />
          <label htmlFor="layer-font">Font size</label>
          <input
            id="layer-font"
            className="pp-input"
            type="number"
            min={1}
            step={1}
            value={layer.props.fontPx ?? Math.max(10, doc.profile.height - 8)}
            onChange={(event) => {
              const parsed = parseEditorInteger(event.target.value, 1);
              if (!parsed.ok) {
                setFieldError(parsed.message);
                return;
              }
              setFieldError("");
              onChange(
                updateLayer(doc, layer.id, (current) =>
                  current.type === "text" ? { ...current, props: { ...current.props, fontPx: parsed.value } } : current,
                ),
              );
            }}
          />
          <label htmlFor="layer-scroll">Scroll (px/sec)</label>
          <input
            id="layer-scroll"
            className="pp-input"
            type="number"
            min={0}
            step={1}
            value={layer.props.scrollPxPerSec ?? 0}
            onChange={(event) => {
              const parsed = parseEditorInteger(event.target.value, 0);
              if (!parsed.ok) {
                setFieldError(parsed.message);
                return;
              }
              setFieldError("");
              onChange(
                updateLayer(doc, layer.id, (current) =>
                  current.type === "text" ? { ...current, props: { ...current.props, scrollPxPerSec: parsed.value } } : current,
                ),
              );
            }}
          />
        </>
      ) : null}
      {layer.type === "image" ? (
        <>
          <label htmlFor="layer-image-asset">Asset</label>
          {imageAssets.length === 0 ? (
            <p className="muted">{EDITOR_NO_IMAGE_ASSETS}</p>
          ) : (
            <select
              id="layer-image-asset"
              className="pp-input"
              value={layer.assetId}
              onChange={(event) =>
                onChange(
                  updateLayer(doc, layer.id, (current) =>
                    current.type === "image" ? { ...current, assetId: event.target.value } : current,
                  ),
                )
              }
            >
              {imageAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          )}
        </>
      ) : null}
      {layer.type === "lottie" ? (
        <>
          <label htmlFor="layer-lottie-asset">Asset</label>
          {lottieAssets.length === 0 ? (
            <p className="muted">{EDITOR_NO_LOTTIE_ASSETS}</p>
          ) : (
            <select
              id="layer-lottie-asset"
              className="pp-input"
              value={layer.assetId}
              onChange={(event) =>
                onChange(
                  updateLayer(doc, layer.id, (current) =>
                    current.type === "lottie" ? { ...current, assetId: event.target.value } : current,
                  ),
                )
              }
            >
              {lottieAssets.map((asset) => (
                <option key={asset.id} value={asset.id}>
                  {asset.name}
                </option>
              ))}
            </select>
          )}
          <label className="editor-check">
            <input
              type="checkbox"
              checked={layer.loop !== false}
              onChange={(event) =>
                onChange(
                  updateLayer(doc, layer.id, (current) =>
                    current.type === "lottie" ? { ...current, loop: event.target.checked } : current,
                  ),
                )
              }
            />
            Loop
          </label>
        </>
      ) : null}
      </fieldset>
    </div>
  );
}
