import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiError } from "./api";
import { useCustomerAccess } from "./CustomerRole";
import {
  CAMPAIGNS_EMPTY_DESCRIPTION,
  CAMPAIGNS_EMPTY_TITLE,
  CAMPAIGNS_ERROR_MESSAGE,
  CAMPAIGNS_PAGE_DESCRIPTION,
  CAMPAIGN_CREATE_ERROR,
  CAMPAIGN_NO_CONTENT_DESCRIPTION,
  CAMPAIGN_NO_CONTENT_TITLE,
  CAMPAIGN_NO_DISPLAYS_DESCRIPTION,
  CAMPAIGN_NO_DISPLAYS_TITLE,
  CAMPAIGN_NO_PUBLISHED_DESCRIPTION,
  CAMPAIGN_NO_PUBLISHED_TITLE,
  CAMPAIGN_STATUSES,
  campaignCreateBody,
  createdCampaignHref,
  campaignStatusLabel,
  campaignSubmitLabel,
  campaignsPageState,
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

export function CampaignLibrary() {
  const navigate = useNavigate();
  const { canManageCampaigns } = useCustomerAccess();
  const [campaigns, setCampaigns] = useState<CampaignRecord[] | null>(null);
  const [contents, setContents] = useState<ContentRecord[] | null>(null);
  const [tickers, setTickers] = useState<TickerRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<CampaignFieldErrors>(EMPTY_FIELD_ERRORS);
  const [name, setName] = useState("");
  const [contentId, setContentId] = useState("");
  const [targetTickerIds, setTargetTickerIds] = useState<string[]>([]);
  const [status, setStatus] = useState<CampaignStatus>("scheduled");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [campaignPayload, contentPayload, tickerPayload] = await Promise.all([
        api<{ items: CampaignRecord[] }>("/v1/campaigns"),
        api<{ items: ContentRecord[] }>("/v1/contents"),
        api<{ items: TickerRecord[] }>("/v1/tickers"),
      ]);
      setCampaigns(Array.isArray(campaignPayload.items) ? campaignPayload.items : []);
      setContents(Array.isArray(contentPayload.items) ? contentPayload.items : []);
      setTickers(Array.isArray(tickerPayload.items) ? tickerPayload.items : []);
      setLoading(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setCampaigns(null);
      setContents(null);
      setTickers(null);
      if (err instanceof ApiError && err.status === 403) {
        setError(err.message?.trim() || "Not allowed.");
      } else {
        setError(CAMPAIGNS_ERROR_MESSAGE);
      }
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const page = campaignsPageState({ loading, error, campaigns, contents, tickers });

  async function createCampaign(event: { preventDefault(): void }) {
    event.preventDefault();
    if (creating) return;
    const validated = validateCampaignForm(
      { name, contentId, targetTickerIds, status, startAt, endAt },
      contents ?? [],
    );
    if (!validated.ok) {
      setFieldErrors(validated.fieldErrors);
      setCreateError("");
      return;
    }
    setFieldErrors(EMPTY_FIELD_ERRORS);
    setCreating(true);
    try {
      const created = await api<CampaignRecord>("/v1/campaigns", {
        method: "POST",
        body: JSON.stringify(campaignCreateBody(validated.values)),
      });
      setCreateError("");
      if (created.id) {
        navigate(createdCampaignHref(created.id));
        return;
      }
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      setCreateError(CAMPAIGN_CREATE_ERROR);
    } finally {
      setCreating(false);
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

  const catalog = page.catalog;
  const selectedContent = catalog.contents.find((item) => item.id === contentId);
  const unpublishedWarning = unpublishedContentWarning(selectedContent);
  const publishedAlert = unpublishedWarning || fieldErrors.published;

  return (
    <>
      <div className="top">
        <div>
          <h1>Campaigns</h1>
          <p className="muted page-lead">{CAMPAIGNS_PAGE_DESCRIPTION}</p>
        </div>
      </div>
      {canManageCampaigns ? (
      <form id="create-campaign" className="card campaign-add" onSubmit={(event) => void createCampaign(event)}>
        <h2>Create campaign</h2>
        <div className="campaign-add__fields">
          <div>
            <label htmlFor="campaign-create-name">Campaign name</label>
            <input
              id="campaign-create-name"
              className="pp-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
              aria-invalid={Boolean(fieldErrors.name)}
              aria-describedby={fieldErrors.name ? "campaign-create-name-error" : undefined}
            />
            {fieldErrors.name ? (
              <p id="campaign-create-name-error" className="error" role="alert">
                {fieldErrors.name}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="campaign-create-status">Status</label>
            <select
              id="campaign-create-status"
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
            <label htmlFor="campaign-create-content">Content</label>
            {catalog.hasContent ? (
              <select
                id="campaign-create-content"
                className="pp-input"
                value={contentId}
                onChange={(e) => setContentId(e.target.value)}
                aria-invalid={Boolean(fieldErrors.contentId || publishedAlert)}
                aria-describedby={
                  fieldErrors.contentId
                    ? "campaign-create-content-error"
                    : publishedAlert
                      ? "campaign-create-unpublished"
                      : undefined
                }
              >
                <option value="">Select content</option>
                {catalog.contents.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                    {item.published ? "" : " (Not published)"}
                  </option>
                ))}
              </select>
            ) : (
              <p className="muted">{CAMPAIGN_NO_CONTENT_TITLE}</p>
            )}
            {fieldErrors.contentId ? (
              <p id="campaign-create-content-error" className="error" role="alert">
                {fieldErrors.contentId}
              </p>
            ) : null}
            {publishedAlert ? (
              <p id="campaign-create-unpublished" className="error" role="alert">
                {publishedAlert}{" "}
                {selectedContent ? (
                  <Link className="pp-btn pp-btn--link" to={selectedContent.href}>
                    Open content
                  </Link>
                ) : null}
              </p>
            ) : null}
            {!catalog.hasContent ? (
              <p className="muted">
                {CAMPAIGN_NO_CONTENT_DESCRIPTION}{" "}
                <Link className="pp-btn pp-btn--link" to="/content">
                  Content
                </Link>
              </p>
            ) : null}
            {catalog.hasContent && !catalog.hasPublishedContent ? (
              <p className="muted">
                {CAMPAIGN_NO_PUBLISHED_TITLE}. {CAMPAIGN_NO_PUBLISHED_DESCRIPTION}
              </p>
            ) : null}
          </div>
          <div className="campaign-add__wide">
            <fieldset className="campaign-targets">
              <legend>Target displays</legend>
              {catalog.hasDisplays ? (
                catalog.tickers.map((ticker) => {
                  const inputId = `campaign-target-${ticker.id}`;
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
                })
              ) : (
                <p className="muted">{CAMPAIGN_NO_DISPLAYS_TITLE}</p>
              )}
            </fieldset>
            {fieldErrors.targetTickerIds ? (
              <p className="error" role="alert">
                {fieldErrors.targetTickerIds}
              </p>
            ) : null}
            {!catalog.hasDisplays ? (
              <p className="muted">
                {CAMPAIGN_NO_DISPLAYS_DESCRIPTION}{" "}
                <Link className="pp-btn pp-btn--link" to="/tickers">
                  My Tickers
                </Link>
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="campaign-create-start">Start</label>
            <input
              id="campaign-create-start"
              className="pp-input"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              aria-invalid={Boolean(fieldErrors.startAt)}
              aria-describedby={fieldErrors.startAt ? "campaign-create-start-error" : undefined}
            />
            {fieldErrors.startAt ? (
              <p id="campaign-create-start-error" className="error" role="alert">
                {fieldErrors.startAt}
              </p>
            ) : null}
          </div>
          <div>
            <label htmlFor="campaign-create-end">End</label>
            <input
              id="campaign-create-end"
              className="pp-input"
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              aria-invalid={Boolean(fieldErrors.endAt)}
              aria-describedby={fieldErrors.endAt ? "campaign-create-end-error" : undefined}
            />
            {fieldErrors.endAt ? (
              <p id="campaign-create-end-error" className="error" role="alert">
                {fieldErrors.endAt}
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
          {campaignSubmitLabel("create", creating)}
        </button>
      </form>
      ) : null}
      {page.empty ? (
        <div className="empty-state">
          <h2>{CAMPAIGNS_EMPTY_TITLE}</h2>
          <p className="muted">{CAMPAIGNS_EMPTY_DESCRIPTION}</p>
        </div>
      ) : (
        <>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Campaign</th>
                  <th scope="col">Content</th>
                  <th scope="col">Displays</th>
                  <th scope="col">Schedule</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td>{row.contentTitle}</td>
                    <td>{row.displaysLabel}</td>
                    <td>{row.scheduleLabel}</td>
                    <td>
                      <span className={row.statusClass}>{row.statusLabel}</span>
                    </td>
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
                    <dt>Content</dt>
                    <dd>{row.contentTitle}</dd>
                    <dt>Target displays</dt>
                    <dd>{row.displaysLabel}</dd>
                    <dt>Schedule</dt>
                    <dd>{row.scheduleLabel}</dd>
                    <dt>Status</dt>
                    <dd>
                      <span className={row.statusClass}>{row.statusLabel}</span>
                    </dd>
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
