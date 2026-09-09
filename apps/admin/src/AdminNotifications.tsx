import { Fragment } from "react";
import {
  NOTIFICATION_CAPABILITIES,
  OPERATIONAL_SIGNALS,
  RELATED_VIEWS,
  UNAVAILABLE_INFRASTRUCTURE,
  availabilityLabel,
  availabilityTone,
} from "./notificationData";

type AdminNotificationsProps = {
  onOpenDashboard: () => void;
  onOpenOrganizations: () => void;
  onOpenDisplays: () => void;
  onOpenMonitoring: () => void;
  onOpenDisplayContent: () => void;
  onOpenSubscriptions: () => void;
};

export function AdminNotifications({
  onOpenDashboard,
  onOpenOrganizations,
  onOpenDisplays,
  onOpenMonitoring,
  onOpenDisplayContent,
  onOpenSubscriptions,
}: AdminNotificationsProps) {
  function openSurface(id: string) {
    if (id === "dashboard") onOpenDashboard();
    if (id === "organizations") onOpenOrganizations();
    if (id === "devices") onOpenDisplays();
    if (id === "monitoring") onOpenMonitoring();
    if (id === "display-content") onOpenDisplayContent();
    if (id === "subscriptions") onOpenSubscriptions();
  }

  return (
    <div className="pp-orgs">
      <header className="pp-orgs__header">
        <div>
          <h1 className="pp-page-title">Notifications</h1>
          <p className="pp-page-desc">
            Notification delivery and preferences are not available in the current MVP. Operational publishing,
            delivery, subscription, and organization events remain available through existing Admin views.
          </p>
        </div>
        <div className="pp-header-actions">
          {RELATED_VIEWS.map((view) => (
            <button key={view.id} type="button" className="pp-btn pp-btn--ghost" onClick={() => openSurface(view.id)}>
              {view.label}
            </button>
          ))}
        </div>
      </header>

      <section className="pp-panel" aria-labelledby="notification-signals">
        <h2 id="notification-signals">Operational signals</h2>
        <p className="pp-panel__note">
          These are current operational records, not notifications. Use them when investigating publishing, delivery,
          organization, subscription, or audit activity.
        </p>
        <div className="pp-table-wrap pp-content-table">
          <table className="pp-admin-table">
            <caption className="pp-sr-only">Operational signals and the Admin views that hold them</caption>
            <thead>
              <tr>
                <th scope="col">Signal</th>
                <th scope="col">Current source</th>
                <th scope="col">Admin action</th>
              </tr>
            </thead>
            <tbody>
              {OPERATIONAL_SIGNALS.map((signal) => (
                <tr key={signal.id}>
                  <td>{signal.signal}</td>
                  <td>{signal.currentSource}</td>
                  <td>
                    <button type="button" className="pp-btn pp-btn--ghost" onClick={() => openSurface(signal.startId)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="pp-stack-list">
          {OPERATIONAL_SIGNALS.map((signal) => (
            <li key={`stack-${signal.id}`}>
              <article className="pp-stack-item">
                <h3>{signal.signal}</h3>
                <dl className="pp-dl">
                  <dt>Current source</dt>
                  <dd>{signal.currentSource}</dd>
                </dl>
                <p className="pp-header-actions">
                  <button type="button" className="pp-btn pp-btn--ghost" onClick={() => openSurface(signal.startId)}>
                    Open
                  </button>
                </p>
              </article>
            </li>
          ))}
        </ul>
      </section>

      <section className="pp-panel" aria-labelledby="notification-capability">
        <h2 id="notification-capability">Current capability</h2>
        <p className="pp-panel__note">
          Dedicated notification management is not available. The items below are notification-product capabilities, not
          operational counts.
        </p>
        <dl className="pp-dl">
          {NOTIFICATION_CAPABILITIES.map((item) => (
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

      <section className="pp-panel" aria-labelledby="notification-unavailable">
        <h2 id="notification-unavailable">Not available in the current MVP</h2>
        <p className="pp-panel__note">
          This is missing notification infrastructure. It is not a list of unread items, and this page does not invent
          alert counts.
        </p>
        <dl className="pp-dl">
          {UNAVAILABLE_INFRASTRUCTURE.map((item) => (
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
    </div>
  );
}
