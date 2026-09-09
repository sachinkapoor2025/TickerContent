import { Fragment } from "react";
import {
  INVESTIGATION_PATHS,
  INVESTIGATION_SURFACES,
  SUPPORT_FLOW,
  UNAVAILABLE_SUPPORT_CAPABILITIES,
  availabilityLabel,
  availabilityTone,
} from "./supportData";

type AdminSupportProps = {
  onOpenDashboard: () => void;
  onOpenOrganizations: () => void;
  onOpenDisplays: () => void;
  onOpenMonitoring: () => void;
  onOpenDisplayContent: () => void;
  onOpenSubscriptions: () => void;
  onOpenUsers: () => void;
};

export function AdminSupport({
  onOpenDashboard,
  onOpenOrganizations,
  onOpenDisplays,
  onOpenMonitoring,
  onOpenDisplayContent,
  onOpenSubscriptions,
  onOpenUsers,
}: AdminSupportProps) {
  function openSurface(id: string) {
    if (id === "dashboard") onOpenDashboard();
    if (id === "organizations") onOpenOrganizations();
    if (id === "devices") onOpenDisplays();
    if (id === "monitoring") onOpenMonitoring();
    if (id === "display-content") onOpenDisplayContent();
    if (id === "subscriptions") onOpenSubscriptions();
    if (id === "users") onOpenUsers();
  }

  return (
    <div className="pp-orgs">
      <header className="pp-orgs__header">
        <div>
          <h1 className="pp-page-title">Support</h1>
          <p className="pp-page-desc">
            Support ticketing and case management are not available in the current MVP. Use the operational views below
            to investigate organization, display, publishing, subscription, and audit issues.
          </p>
        </div>
        <div className="pp-header-actions">
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenOrganizations}>
            Organizations
          </button>
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenDisplays}>
            Displays
          </button>
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenMonitoring}>
            Monitoring
          </button>
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenDisplayContent}>
            Display Content
          </button>
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenSubscriptions}>
            Subscriptions
          </button>
        </div>
      </header>

      <section className="pp-panel" aria-labelledby="support-views">
        <h2 id="support-views">Investigation views</h2>
        <p className="pp-panel__note">
          Dedicated support tickets are not available. These existing Admin screens are the investigation path when a
          customer reports a problem. Audit Logs is not a separate workspace; organization audit is on Organization
          detail and Dashboard.
        </p>
        <div className="pp-table-wrap pp-content-table">
          <table className="pp-admin-table">
            <caption className="pp-sr-only">Existing Admin screens for investigating a customer issue</caption>
            <thead>
              <tr>
                <th scope="col">Screen</th>
                <th scope="col">What Admin can inspect</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {INVESTIGATION_SURFACES.map((surface) => (
                <tr key={surface.id}>
                  <td>{surface.label}</td>
                  <td>{surface.summary}</td>
                  <td>
                    <button type="button" className="pp-btn pp-btn--ghost" onClick={() => openSurface(surface.id)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="pp-stack-list">
          {INVESTIGATION_SURFACES.map((surface) => (
            <li key={`stack-${surface.id}`}>
              <article className="pp-stack-item">
                <h3>{surface.label}</h3>
                <p className="pp-page-desc">{surface.summary}</p>
                <p className="pp-header-actions">
                  <button type="button" className="pp-btn pp-btn--ghost" onClick={() => openSurface(surface.id)}>
                    Open {surface.label}
                  </button>
                </p>
              </article>
            </li>
          ))}
        </ul>
      </section>

      <section className="pp-panel" aria-labelledby="support-flow">
        <h2 id="support-flow">Investigation workflow</h2>
        <p className="pp-panel__note">
          Work through these records in order. This path is instructional. It is not a ticket queue and does not change
          tenant data.
        </p>
        <ol className="pp-flow">
          {SUPPORT_FLOW.map((step, index) => (
            <li key={step.id} className="pp-flow__item">
              <div className="pp-flow__step">
                <p className="pp-flow__index">Step {index + 1}</p>
                <h3 className="pp-flow__title">{step.title}</h3>
                <p className="pp-flow__note">{step.note}</p>
              </div>
              {index < SUPPORT_FLOW.length - 1 ? (
                <>
                  <span className="pp-flow__connector pp-flow__connector--row" aria-hidden="true">
                    →
                  </span>
                  <span className="pp-flow__connector pp-flow__connector--col" aria-hidden="true">
                    ↓
                  </span>
                </>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="pp-panel" aria-labelledby="support-matrix">
        <h2 id="support-matrix">Investigation matrix</h2>
        <p className="pp-panel__note">
          Start with the Admin view that already holds the relevant records. Do not expect player logs, network
          diagnostics, delivery latency, or live device telemetry.
        </p>
        <div className="pp-table-wrap pp-content-table">
          <table className="pp-admin-table">
            <caption className="pp-sr-only">Where to investigate common customer-reported issues</caption>
            <thead>
              <tr>
                <th scope="col">Customer issue</th>
                <th scope="col">Start here</th>
                <th scope="col">Then inspect</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {INVESTIGATION_PATHS.map((path) => (
                <tr key={path.id}>
                  <td>{path.issue}</td>
                  <td>{path.startHere}</td>
                  <td>{path.thenInspect}</td>
                  <td>
                    <button type="button" className="pp-btn pp-btn--ghost" onClick={() => openSurface(path.startId)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="pp-stack-list">
          {INVESTIGATION_PATHS.map((path) => (
            <li key={`stack-${path.id}`}>
              <article className="pp-stack-item">
                <h3>{path.issue}</h3>
                <dl className="pp-dl">
                  <dt>Start here</dt>
                  <dd>{path.startHere}</dd>
                  <dt>Then inspect</dt>
                  <dd>{path.thenInspect}</dd>
                </dl>
                <p className="pp-header-actions">
                  <button type="button" className="pp-btn pp-btn--ghost" onClick={() => openSurface(path.startId)}>
                    Open {path.startHere}
                  </button>
                </p>
              </article>
            </li>
          ))}
        </ul>
      </section>

      <section className="pp-panel" aria-labelledby="support-unavailable">
        <h2 id="support-unavailable">Not available in the current MVP</h2>
        <p className="pp-panel__note">
          These are support-product capabilities. They are not operational counts, and this page does not invent ticket
          or SLA metrics.
        </p>
        <dl className="pp-dl">
          {UNAVAILABLE_SUPPORT_CAPABILITIES.map((item) => (
            <Fragment key={item.id}>
              <dt>{item.topic}</dt>
              <dd>
                <div className="pp-org-cell__name">
                  <span className={`pp-status pp-status--${availabilityTone(item.availability)}`}>
                    {availabilityLabel(item.availability)}
                  </span>
                  <span className="pp-org-cell__slug">{item.evidence}</span>
                </div>
              </dd>
            </Fragment>
          ))}
        </dl>
      </section>

      <section className="pp-panel" aria-labelledby="support-notes">
        <h2 id="support-notes">Operational notes</h2>
        <p className="pp-panel__note">
          Admin cannot impersonate a tenant, inspect player logs, or view live display heartbeat. Dashboard attention
          uses organization status, subscription status, and entitlement restriction. Those are current records, not
          support cases.
        </p>
      </section>
    </div>
  );
}
