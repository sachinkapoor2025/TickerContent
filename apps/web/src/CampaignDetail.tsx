import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiError } from "./api";
import { useCustomerAccess } from "./CustomerRole";
import {
  CAMPAIGN_DETAIL_DESCRIPTION,
  CAMPAIGN_DETAIL_ERROR_MESSAGE,
  CAMPAIGN_SAVE_ERROR,
  CAMPAIGN_SAVE_SUCCESS,
  CAMPAIGN_STATUSES,
  CAMPAIGN_STATUS_ERROR,
  campaignDetailPageState,
  campaignPatchBody,
  campaignPauseBody,
  campaignResumeBody,
  campaignStatusLabel,
  campaignSubmitLabel,
  findCampaign,
  toggleTickerSelection,
  unpublishedContentWarning,
  validateCampaignForm,
  type CampaignFieldErrors,
  type CampaignRecord,
  type CampaignStatus,
} from "./campaignData";
import type { ContentRecord } from "./contentData";
import type { TickerRecord } from "./tickerData";

const EMPTY_FIELD_ERRORS: CampaignFieldErrors = {};

export function CampaignDetail() {
  const { id } = useParams();
  const { canManageCampaigns } = useCustomerAccess();
  const [campaign, setCampaign] = useState<CampaignRecord | null>(null);
  const [contents, setContents] = useState<ContentRecord[] | null>(null);
  const [tickers, setTickers] = useState<TickerRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [statusError, setStatusError] = useState("");
  const [msg, setMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CampaignFieldErrors>(EMPTY_FIELD_ERRORS);
  const [name, setName] = useState("");
  const [contentId, setContentId] = useState("");
  const [targetTickerIds, setTargetTickerIds] = useState<string[]>([]);
  const [status, setStatus] = useState<CampaignStatus>("draft");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  function applyCampaign(row: CampaignRecord, nextContents: ContentRecord[], nextTickers: TickerRecord[]) {
    const page = campaignDetailPageState({
      loading: false,
      error: null,
      campaign: row,
      contents: nextContents,
      tickers: nextTickers,
    });
    if (page.kind !== "ready") return;
    setCampaign(row);
    setName(page.view.name === "Untitled campaign" && !row.name ? "" : page.view.name);
    setContentId(page.view.contentId);
    setTargetTickerIds(page.view.targetTickerIds);
    setStatus((CAMPAIGN_STATUSES as readonly string[]).includes(page.view.status) ? (page.view.status as CampaignStatus) : "draft");
    setStartAt(page.view.startLocal);
    setEndAt(page.view.endLocal);
  }

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [campaignPayload, contentPayload, tickerPayload] = await Promise.all([
        api<{ items: CampaignRecord[] }>("/v1/campaigns"),
        api<{ items: ContentRecord[] }>("/v1/contents"),
        api<{ items: TickerRecord[] }>("/v1/tickers"),
      ]);
      const nextContents = Array.isArray(contentPayload.items) ? contentPayload.items : [];
      const nextTickers = Array.isArray(tickerPayload.items) ? tickerPayload.items : [];
      const row = findCampaign(campaignPayload.items, id);
      setContents(nextContents);
      setTickers(nextTickers);
      if (!row) {
        setCampaign(null);
        setError(CAMPAIGN_DETAIL_ERROR_MESSAGE);
        setLoading(false);
        return;
      }
      applyCampaign(row, nextContents, nextTickers);
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setCampaign(null);
      setContents(null);
      setTickers(null);
      if (err instanceof ApiError && err.status === 403) {
        setError(err.message?.trim() || "Not allowed.");
      } else {
        setError(CAMPAIGN_DETAIL_ERROR_MESSAGE);
      }
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  const page = campaignDetailPageState({ loading, error, campaign, contents, tickers });
  const busy = saving || statusBusy;

  async function saveCampaign(event: { preventDefault(): void }) {
    event.preventDefault();
    if (busy || !id) return;
    const validated = validateCampaignForm(
      { name, contentId, targetTickerIds, status, startAt, endAt },
      contents ?? [],
    );
    if (!validated.ok) {
      setFieldErrors(validated.fieldErrors);
      setSaveError("");
      setMsg("");
      return;
    }
    setFieldErrors(EMPTY_FIELD_ERRORS);
    setSaving(true);
    try {
      const updated = await api<CampaignRecord>(`/v1/campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify(campaignPatchBody(validated.values)),
      });
      applyCampaign(updated, contents ?? [], tickers ?? []);
      setSaveError("");
      setStatusError("");
      setMsg(CAMPAIGN_SAVE_SUCCESS);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setSaveError(CAMPAIGN_SAVE_ERROR);
      setMsg("");
    } finally {
      setSaving(false);
    }
  }

  async function patchStatus(body: { status: "paused" | "scheduled" }) {
    if (busy || !id) return;
    setStatusBusy(true);
    try {
      const updated = await api<CampaignRecord>(`/v1/campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      applyCampaign(updated, contents ?? [], tickers ?? []);
      setStatusError("");
      setSaveError("");
      setMsg(CAMPAIGN_SAVE_SUCCESS);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setStatusError(CAMPAIGN_STATUS_ERROR);
      setMsg("");
    } finally {
      setStatusBusy(false);
    }
  }

  if (page.kind === "loading") {
    return (
      <>
        <h1>Campaigns</h1>
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
          <Link className="pp-btn pp-btn--link" to="/campaigns">
            Back to Campaigns
          </Link>
        </p>
        <h1>Campaigns</h1>
        <p className="error" role="alert">
          {page.message}
        </p>
        <button className="pp-btn pp-btn--ghost" type="button" onClick={() => void load()}>
          Try again
        </button>
      </>
    );
  }

  const { view, catalog } = page;
  const selectedContent = catalog.contents.find((item) => item.id === contentId);
  const unpublishedWarning = unpublishedContentWarning(selectedContent);
  const publishedAlert = unpublishedWarning || fieldErrors.published;

  return (
    <>
      <p>
        <Link className="pp-btn pp-btn--link" to="/campaigns">
          Back to Campaigns
        </Link>
      </p>
      <h1>{view.name}</h1>
      <p className="muted page-lead">{CAMPAIGN_DETAIL_DESCRIPTION}</p>
      <dl className="spec-block">
        <div>
          <dt>Status</dt>
          <dd>
            <span className={view.statusClass}>{view.statusLabel}</span>
          </dd>
        </div>
        <div>
          <dt>Content</dt>
          <dd>
            <Link className="pp-btn pp-btn--link" to={view.contentHref}>
              {view.contentTitle}
            </Link>
          </dd>
        </div>
        <div>
          <dt>Published version</dt>
          <dd>{view.publishedLabel}</dd>
        </div>
        <div>
          <dt>Target displays</dt>
          <dd>
            {view.displays.length ? (
              <ul className="campaign-display-list">
                {view.displays.map((ticker) => (
                  <li key={ticker.id}>
                    {ticker.name}
                    <span className="muted"> {ticker.profile}</span>
                  </li>
                ))}
              </ul>
            ) : (
              "—"
            )}
          </dd>
        </div>
        <div>
          <dt>Start</dt>
          <dd>{view.startLabel}</dd>
        </div>
        <div>
          <dt>End</dt>
          <dd>{view.endLabel}</dd>
        </div>
      </dl>
      {canManageCampaigns ? (
      <div className="campaign-detail-actions">
        {view.canPause ? (
          <button
            className="pp-btn pp-btn--ghost"
            type="button"
            disabled={busy}
            onClick={() => void patchStatus(campaignPauseBody())}
          >
            Pause campaign
          </button>
        ) : null}
        {view.canResume ? (
          <button
            className="pp-btn pp-btn--ghost"
            type="button"
            disabled={busy}
            onClick={() => void patchStatus(campaignResumeBody())}
          >
            Resume campaign
          </button>
        ) : null}
      </div>
      ) : null}
      {statusError ? (
        <p className="error" role="alert">
          {statusError}
        </p>
      ) : null}
      {canManageCampaigns ? (
      <form className="card campaign-edit" onSubmit={(event) => void saveCampaign(event)}>
        <h2>Edit campaign</h2>
        <div className="campaign-add__fields">
          <div>
            <label htmlFor="campaign-edit-name">Campaign name</label>
            <input
              id="campaign-edit-name"
              className="pp-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "campaign-edit-name-error" : undefined}
            />
            {fieldErrors.name ? (
              <p id="campaign-edit-name-error" className="error" role="alert">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="campaign-edit-status">Status</label>
            <select
              id="campaign-edit-status"
              className="pp-input"
              value={status}
              onChange={(e) => setStatus(e.target.value as CampaignStatus)}
            >
              {CAMPAIGN_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {campaignStatusLabel(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="campaign-add__wide">
            <label htmlFor="campaign-edit-content">Content</label>
            <select
              id="campaign-edit-content"
              className="pp-input"
              value={contentId}
              onChange={(e) => setContentId(e.target.value)}
              aria-invalid={Boolean(fieldErrors.contentId || publishedAlert)}
              aria-describedby={publishedAlert ? "campaign-edit-unpublished" : undefined}
            >
              <option value="">Select content</option>
              {(catalog.contents).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                  {item.published ? "" : " (Not published)"}
                </option>
              ))}
            </select>
            {fieldErrors.contentId ? (
              <p className="error" role="alert">
                {fieldErrors.contentId}
              </p>
            ) : null}
            {publishedAlert ? (
              <p id="campaign-edit-unpublished" className="error" role="alert">
                {publishedAlert}{" "}
                {selectedContent ? (
                  <Link className="pp-btn pp-btn--link" to={selectedContent.href}>
                    Open content
                  </Link>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="campaign-add__wide">
            <fieldset className="campaign-targets">
              <legend>Target displays</legend>
              {(catalog.tickers).map((ticker) => {
                const inputId = `campaign-edit-target-${ticker.id}`;
                return (
                  <label key={ticker.id} htmlFor={inputId}>
                    <input
                      id={inputId}
                      type="checkbox"
                      checked={targetTickerIds.includes(ticker.id)}
                      onChange={(e) =>
                        setTargetTickerIds(toggleTickerSelection(targetTickerIds, ticker.id, e.target.checked))
                      }
                    />
                    <span>
                      {ticker.name}
                      <small>{ticker.profile}</small>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            {fieldErrors.targetTickerIds ? (
              <p className="error" role="alert">
                {fieldErrors.targetTickerIds}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="campaign-edit-start">Start</label>
            <input
              id="campaign-edit-start"
              className="pp-input"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              aria-invalid={Boolean(fieldErrors.startAt)}
              aria-describedby={fieldErrors.startAt ? "campaign-edit-start-error" : undefined}
            />
            {fieldErrors.startAt ? (
              <p id="campaign-edit-start-error" className="error" role="alert">
                {fieldErrors.startAt}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="campaign-edit-end">End</label>
            <input
              id="campaign-edit-end"
              className="pp-input"
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              aria-invalid={Boolean(fieldErrors.endAt)}
              aria-describedby={fieldErrors.endAt ? "campaign-edit-end-error" : undefined}
            />
            {fieldErrors.endAt ? (
              <p id="campaign-edit-end-error" className="error" role="alert">
                {fieldErrors.endAt}
              </p>
            ) : null}
          </div>
        </div>
        {saveError ? (
          <p className="error" role="alert">
            {saveError}
          </p>
        ) : null}
        {msg ? <p className="muted">{msg}</p> : null}
        <button className="pp-btn pp-btn--primary" type="submit" disabled={busy}>
          {campaignSubmitLabel("save", saving)}
        </button>
      </form>
      ) : null}
    </>
  );
}
