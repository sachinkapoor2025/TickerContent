import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "./api";
import { useCustomerAccess } from "./CustomerRole";
import {
  TICKER_CREATE_SUCCESS,
  TICKER_FORM_DEFAULTS,
  TICKERS_EMPTY_DESCRIPTION,
  TICKERS_EMPTY_TITLE,
  TICKERS_PAGE_DESCRIPTION,
  colorModeLabel,
  displaySizeLabel,
  isPlaybackUnavailableError,
  tickerCreateBody,
  tickerCreateFailureMessage,
  tickerDesignHref,
  tickerSubmitLabel,
  tickersPageState,
  validateTickerProfile,
  type TickerFieldErrors,
  type TickerPlayback,
  type TickerPlaybackState,
  type TickerRecord,
} from "./tickerData";

export function Tickers() {
  const navigate = useNavigate();
  const { canManageTickers } = useCustomerAccess();
  const nameRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<TickerRecord[] | null>(null);
  const [playbackById, setPlaybackById] = useState<Record<string, TickerPlaybackState>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<TickerFieldErrors>({});
  const [name, setName] = useState(TICKER_FORM_DEFAULTS.name);
  const [toast, setToast] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const payload = await api<{ items: TickerRecord[] }>("/v1/tickers");
      const list = Array.isArray(payload.items) ? payload.items : [];
      const playbackEntries = await Promise.all(
        list.map(async (item) => {
          if (!item.id) return null;
          try {
            const playback = await api<TickerPlayback>(`/v1/playback/tickers/${item.id}`);
            return [item.id, { available: true as const, playback }] as const;
          } catch (err) {
            if (!isPlaybackUnavailableError(err as { status?: number })) throw err;
            return [item.id, { available: false as const }] as const;
          }
        }),
      );
      const nextPlayback: Record<string, TickerPlaybackState> = {};
      for (const entry of playbackEntries) {
        if (entry) nextPlayback[entry[0]] = entry[1];
      }
      setItems(list);
      setPlaybackById(nextPlayback);
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setItems(null);
      setPlaybackById({});
      setError((err as Error).message?.trim() || "Unable to load your tickers.");
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    nameRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeModal();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen, creating]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const page = tickersPageState({ loading, error, items, playbackById });

  function openModal() {
    setName(TICKER_FORM_DEFAULTS.name);
    setFieldErrors({});
    setCreateError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (creating) return;
    setModalOpen(false);
    setCreateError("");
    setFieldErrors({});
  }

  async function createTicker(event: { preventDefault(): void }) {
    event.preventDefault();
    if (creating) return;
    const validated = validateTickerProfile({
      name,
      width: TICKER_FORM_DEFAULTS.width,
      height: TICKER_FORM_DEFAULTS.height,
      colorMode: TICKER_FORM_DEFAULTS.colorMode,
    });
    if (!validated.ok) {
      setFieldErrors(validated.fieldErrors);
      setCreateError("");
      return;
    }
    setFieldErrors({});
    setCreating(true);
    try {
      const created = await api<TickerRecord>("/v1/tickers", {
        method: "POST",
        body: JSON.stringify(tickerCreateBody(validated.values)),
      });
      setCreateError("");
      setModalOpen(false);
      await load();
      setToast(TICKER_CREATE_SUCCESS);
      if (created.id) {
        navigate(tickerDesignHref(created.id), { state: { tickerCreated: true } });
        return;
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setCreateError(tickerCreateFailureMessage(err));
    } finally {
      setCreating(false);
    }
  }

  const heading = (
    <div className="top ticker-page-head">
      <div>
        <h1>My Tickers</h1>
        <p className="muted page-lead">{TICKERS_PAGE_DESCRIPTION}</p>
      </div>
      {canManageTickers ? (
        <button className="pp-btn pp-btn--primary" type="button" onClick={openModal}>
          + Add Ticker
        </button>
      ) : null}
    </div>
  );

  if (page.kind === "loading") {
    return (
      <>
        {heading}
        <p className="muted" aria-live="polite">
          {page.message}
        </p>
      </>
    );
  }

  if (page.kind === "error") {
    return (
      <>
        {heading}
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
      {heading}
      {page.empty ? (
        <div className="empty-state">
          <h2>{TICKERS_EMPTY_TITLE}</h2>
          <p className="muted">{TICKERS_EMPTY_DESCRIPTION}</p>
        </div>
      ) : (
        <ul className="ticker-card-list">
          {page.rows.map((row) => (
            <li key={row.id}>
              <article className="ticker-card">
                <div className="ticker-card__body">
                  <h2>
                    <Link className="ticker-card__title" to={row.href}>
                      {row.name}
                    </Link>
                  </h2>
                  <p className="ticker-card__meta">
                    {row.profile}
                    <span aria-hidden="true"> · </span>
                    {row.colorMode}
                    {row.statusLabel !== "—" ? (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className={row.statusClass}>{row.statusLabel}</span>
                      </>
                    ) : null}
                  </p>
                </div>
                <Link className="pp-btn pp-btn--primary ticker-card__action" to={row.designHref}>
                  Design Your Ticker
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
      {modalOpen ? (
        <div className="ticker-modal" role="presentation">
          <button className="ticker-modal__backdrop" type="button" aria-label="Close" onClick={closeModal} />
          <div className="ticker-modal__panel" role="dialog" aria-modal="true" aria-labelledby="add-ticker-title">
            <div className="ticker-modal__head">
              <h2 id="add-ticker-title">Add Ticker</h2>
              <button className="ticker-modal__close" type="button" aria-label="Close" onClick={closeModal} disabled={creating}>
                ×
              </button>
            </div>
            <form onSubmit={(event) => void createTicker(event)}>
              <div className="pp-field">
                <label htmlFor="ticker-create-name">Ticker name</label>
                <input
                  id="ticker-create-name"
                  ref={nameRef}
                  className="pp-input"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "ticker-create-name-error" : undefined}
                />
                {fieldErrors.name ? (
                  <p id="ticker-create-name-error" className="error" role="alert">
                    {fieldErrors.name}
                  </p>
                ) : null}
              </div>
              <p className="ticker-modal__fact">
                Display size
                <strong>
                  {displaySizeLabel(TICKER_FORM_DEFAULTS.width, TICKER_FORM_DEFAULTS.height)}
                </strong>
              </p>
              <p className="ticker-modal__fact">
                Color mode
                <strong>{colorModeLabel(TICKER_FORM_DEFAULTS.colorMode)}</strong>
              </p>
              {createError ? (
                <p className="error" role="alert">
                  {createError}
                </p>
              ) : null}
              <div className="ticker-modal__actions">
                <button className="pp-btn pp-btn--ghost" type="button" onClick={closeModal} disabled={creating}>
                  Cancel
                </button>
                <button className="pp-btn pp-btn--primary" type="submit" disabled={creating}>
                  {tickerSubmitLabel("create", creating)}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      {toast ? (
        <p className="customer-toast" role="status">
          {toast}
        </p>
      ) : null}
    </>
  );
}
