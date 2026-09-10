import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { COLOR_MODES, type ColorMode } from "@ticker-cms/composition";
import { api, ApiError } from "./api";
import { TickerDisplay } from "./components/TickerDisplay";
import { asCompositionDocument } from "./components/ledPresentation";
import { useCustomerAccess } from "./CustomerRole";
import {
  TICKER_DETAIL_DESCRIPTION,
  TICKER_FORM_DEFAULTS,
  TICKER_SAVE_ERROR,
  TICKER_SAVE_SUCCESS,
  colorModeLabel,
  isPlaybackUnavailableError,
  tickerDesignHref,
  tickerDetailPageState,
  tickerPatchBody,
  tickerSubmitLabel,
  validateTickerProfile,
  type TickerFieldErrors,
  type TickerPlayback,
  type TickerPlaybackState,
  type TickerRecord,
} from "./tickerData";

export function TickerDetail() {
  const { id } = useParams();
  const { canManageTickers } = useCustomerAccess();
  const [row, setRow] = useState<TickerRecord | null>(null);
  const [playback, setPlayback] = useState<TickerPlaybackState | null>(null);
  const [name, setName] = useState(TICKER_FORM_DEFAULTS.name);
  const [width, setWidth] = useState(TICKER_FORM_DEFAULTS.width);
  const [height, setHeight] = useState(TICKER_FORM_DEFAULTS.height);
  const [colorMode, setColorMode] = useState<ColorMode>(TICKER_FORM_DEFAULTS.colorMode);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<TickerFieldErrors>({});

  function applyTicker(data: TickerRecord) {
    setRow(data);
    setName(data.name ?? "");
    setWidth(typeof data.width === "number" ? data.width : Number(data.width) || TICKER_FORM_DEFAULTS.width);
    setHeight(typeof data.height === "number" ? data.height : Number(data.height) || TICKER_FORM_DEFAULTS.height);
    setColorMode((data.colorMode as ColorMode) || TICKER_FORM_DEFAULTS.colorMode);
  }

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<TickerRecord>(`/v1/tickers/${id}`);
      applyTicker(data);
      try {
        const playing = await api<TickerPlayback>(`/v1/playback/tickers/${id}`);
        setPlayback({ available: true, playback: playing });
      } catch (err) {
        if (!isPlaybackUnavailableError(err as { status?: number })) throw err;
        setPlayback({ available: false });
      }
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setRow(null);
      setPlayback(null);
      setError((err as Error).message?.trim() || "Unable to load this ticker.");
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  const page = tickerDetailPageState({ loading, error, row, playback });

  async function saveProfile(event: { preventDefault(): void }) {
    event.preventDefault();
    const validated = validateTickerProfile({ name, width, height, colorMode });
    if (!validated.ok) {
      setFieldErrors(validated.fieldErrors);
      setSaveError("");
      setMsg("");
      return;
    }
    setFieldErrors({});
    setSaving(true);
    try {
      const updated = await api<TickerRecord>(`/v1/tickers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(tickerPatchBody(validated.values)),
      });
      setRow({ ...row, ...updated });
      setName(validated.values.name);
      setWidth(validated.values.width);
      setHeight(validated.values.height);
      setColorMode(validated.values.colorMode);
      setSaveError("");
      setMsg(TICKER_SAVE_SUCCESS);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setSaveError(TICKER_SAVE_ERROR);
      setMsg("");
    } finally {
      setSaving(false);
    }
  }

  if (page.kind === "loading") {
    return (
      <>
        <h1>Ticker</h1>
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
          <Link className="pp-btn pp-btn--link" to="/tickers">
            My Tickers
          </Link>
        </p>
        <h1>Ticker</h1>
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
        <Link className="pp-btn pp-btn--link" to="/tickers">
          My Tickers
        </Link>
      </p>
      <h1>{view.name}</h1>
      <p className="muted page-lead">{TICKER_DETAIL_DESCRIPTION}</p>
      <p>
        <Link className="pp-btn pp-btn--primary" to={tickerDesignHref(view.id)}>
          Design Your Ticker
        </Link>
      </p>
      {view.location ? <p className="muted ticker-location">Location: {view.location}</p> : null}
      <dl className="spec-block">
        <div>
          <dt>Display profile</dt>
          <dd>{view.profile}</dd>
        </div>
        <div>
          <dt>Color mode</dt>
          <dd>{view.colorMode}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <span className={view.statusClass}>{view.statusLabel}</span>
          </dd>
        </div>
        <div>
          <dt>Now playing</dt>
          <dd>{view.contentLabel}</dd>
        </div>
      </dl>
      {canManageTickers ? (
      <form className="card ticker-edit" onSubmit={(event) => void saveProfile(event)}>
        <h2>Display configuration</h2>
        <label htmlFor="ticker-edit-name">Ticker name</label>
        <input
          id="ticker-edit-name"
          className="pp-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? "ticker-edit-name-error" : undefined}
        />
        {fieldErrors.name ? (
          <p id="ticker-edit-name-error" className="error" role="alert">
            {fieldErrors.name}
          </p>
        ) : null}
        <label htmlFor="ticker-edit-width">Width</label>
        <input
          id="ticker-edit-width"
          className="pp-input"
          type="number"
          min={1}
          step={1}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          aria-invalid={Boolean(fieldErrors.width)}
          aria-describedby={fieldErrors.width ? "ticker-edit-width-error" : undefined}
        />
        {fieldErrors.width ? (
          <p id="ticker-edit-width-error" className="error" role="alert">
            {fieldErrors.width}
          </p>
        ) : null}
        <label htmlFor="ticker-edit-height">Height</label>
        <input
          id="ticker-edit-height"
          className="pp-input"
          type="number"
          min={1}
          step={1}
          value={height}
          onChange={(e) => setHeight(Number(e.target.value))}
          aria-invalid={Boolean(fieldErrors.height)}
          aria-describedby={fieldErrors.height ? "ticker-edit-height-error" : undefined}
        />
        {fieldErrors.height ? (
          <p id="ticker-edit-height-error" className="error" role="alert">
            {fieldErrors.height}
          </p>
        ) : null}
        <label htmlFor="ticker-edit-color">Color mode</label>
        <select
          id="ticker-edit-color"
          className="pp-input"
          value={colorMode}
          onChange={(e) => setColorMode(e.target.value as ColorMode)}
          aria-invalid={Boolean(fieldErrors.colorMode)}
          aria-describedby={fieldErrors.colorMode ? "ticker-edit-color-error" : undefined}
        >
          {COLOR_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {colorModeLabel(mode)}
            </option>
          ))}
        </select>
        {fieldErrors.colorMode ? (
          <p id="ticker-edit-color-error" className="error" role="alert">
            {fieldErrors.colorMode}
          </p>
        ) : null}
        {saveError ? (
          <p className="error" role="alert">
            {saveError}
          </p>
        ) : null}
        {msg ? <p className="muted">{msg}</p> : null}
        <button className="pp-btn pp-btn--primary" type="submit" disabled={saving}>
          {tickerSubmitLabel("save", saving)}
        </button>
      </form>
      ) : null}
      <section className="dash-now" aria-labelledby="ticker-preview-heading">
        <div className="row dash-now-head">
          <h2 id="ticker-preview-heading">Preview</h2>
          <span className="muted">{view.contentLabel}</span>
        </div>
        <TickerDisplay
          document={asCompositionDocument(view.document)}
          profile={{ width, height, colorMode }}
          scale="large"
          label={view.name}
          emptyMessage={view.previewMessage}
        />
      </section>
    </>
  );
}
