import { Fragment } from "react";
import {
  CAPABILITY_MATRIX,
  ORGANIZATION_CONTROLS,
  PLATFORM_SCOPE,
  RELATED_VIEWS,
  UNAVAILABLE_SETTINGS,
  accessLabel,
  availabilityLabel,
  availabilityTone,
} from "./settingsData";

type AdminSettingsProps = {
  onOpenDashboard: () => void;
  onOpenOrganizations: () => void;
  onOpenSubscriptions: () => void;
  onOpenUsers: () => void;
};

export function AdminSettings({
  onOpenDashboard,
  onOpenOrganizations,
  onOpenSubscriptions,
  onOpenUsers,
}: AdminSettingsProps) {
  function openSurface(id: string) {
    if (id === "dashboard") onOpenDashboard();
    if (id === "organizations") onOpenOrganizations();
    if (id === "subscriptions") onOpenSubscriptions();
    if (id === "users") onOpenUsers();
  }

  return (
    <div className="pp-orgs">
      <header className="pp-orgs__header">
        <div>
          <h1 className="pp-page-title">Settings</h1>
          <p className="pp-page-desc">
            Platform-wide settings are not available in the current MVP. Admin can inspect organization configuration
            and subscription state through existing operational views; organization status is managed from Organization
            detail.
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

      <section className="pp-panel" aria-labelledby="settings-scope">
        <h2 id="settings-scope">Current platform scope</h2>
        <p className="pp-panel__note">
          This page is not a control panel. Login, logout, and sidebar collapse are session or browser chrome. They are
          not persisted account settings.
        </p>
        <dl className="pp-dl">
          {PLATFORM_SCOPE.map((item) => (
            <Fragment key={item.id}>
              <dt>{item.topic}</dt>
              <dd>
                <div className="pp-org-cell__name">
                  <span className={`pp-status pp-status--${availabilityTone(item.availability)}`}>
                    {availabilityLabel(item.availability)}
                  </span>
                  <span className="pp-org-cell__slug">{item.inspectIn}</span>
                </div>
              </dd>
            </Fragment>
          ))}
        </dl>
      </section>

      <section className="pp-panel" aria-labelledby="settings-matrix">
        <h2 id="settings-matrix">Capability matrix</h2>
        <p className="pp-panel__note">
          Inspectable means the current record is visible. Editable means Admin can change it from an existing
          organization workflow, not from this page.
        </p>
        <div className="pp-table-wrap pp-content-table">
          <table className="pp-admin-table">
            <caption className="pp-sr-only">Platform settings capabilities and where they live today</caption>
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">Capability</th>
                <th scope="col">Availability</th>
                <th scope="col">Current location</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {CAPABILITY_MATRIX.map((row) => (
                <tr key={row.id}>
                  <td>{row.area}</td>
                  <td>{row.capability}</td>
                  <td>
                    <span className={`pp-status pp-status--${availabilityTone(row.availability)}`}>
                      {availabilityLabel(row.availability)}
                    </span>
                  </td>
                  <td>{row.location}</td>
                  <td>
                    {row.startId ? (
                      <button
                        type="button"
                        className="pp-btn pp-btn--ghost"
                        onClick={() => {
                          if (row.startId) openSurface(row.startId);
                        }}
                      >
                        Open
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="pp-stack-list">
          {CAPABILITY_MATRIX.map((row) => (
            <li key={`stack-${row.id}`}>
              <article className="pp-stack-item">
                <h3>{row.capability}</h3>
                <dl className="pp-dl">
                  <dt>Area</dt>
                  <dd>{row.area}</dd>
                  <dt>Availability</dt>
                  <dd>
                    <span className={`pp-status pp-status--${availabilityTone(row.availability)}`}>
                      {availabilityLabel(row.availability)}
                    </span>
                  </dd>
                  <dt>Current location</dt>
                  <dd>{row.location}</dd>
                </dl>
                {row.startId ? (
                  <p className="pp-header-actions">
                    <button
                      type="button"
                      className="pp-btn pp-btn--ghost"
                      onClick={() => {
                        if (row.startId) openSurface(row.startId);
                      }}
                    >
                      Open
                    </button>
                  </p>
                ) : null}
              </article>
            </li>
          ))}
        </ul>
      </section>

      <section className="pp-panel" aria-labelledby="settings-controls">
        <h2 id="settings-controls">Real organization controls</h2>
        <p className="pp-panel__note">
          Organization status is the only Admin mutation on this portal. Open Organizations, then the record, to
          Activate or Suspend. Do not expect a Settings save action.
        </p>
        <div className="pp-table-wrap pp-content-table">
          <table className="pp-admin-table">
            <caption className="pp-sr-only">Organization controls that exist outside Settings</caption>
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">Inspectable</th>
                <th scope="col">Editable</th>
                <th scope="col">Where</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ORGANIZATION_CONTROLS.map((control) => (
                <tr key={control.id}>
                  <td>{control.capability}</td>
                  <td>{accessLabel(control.inspectable)}</td>
                  <td>{accessLabel(control.editable)}</td>
                  <td>{control.where}</td>
                  <td>
                    <button type="button" className="pp-btn pp-btn--ghost" onClick={() => openSurface(control.startId)}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="pp-stack-list">
          {ORGANIZATION_CONTROLS.map((control) => (
            <li key={`stack-control-${control.id}`}>
              <article className="pp-stack-item">
                <h3>{control.capability}</h3>
                <dl className="pp-dl">
                  <dt>Inspectable</dt>
                  <dd>{accessLabel(control.inspectable)}</dd>
                  <dt>Editable</dt>
                  <dd>{accessLabel(control.editable)}</dd>
                  <dt>Where</dt>
                  <dd>{control.where}</dd>
                </dl>
                <p className="pp-header-actions">
                  <button type="button" className="pp-btn pp-btn--ghost" onClick={() => openSurface(control.startId)}>
                    Open
                  </button>
                </p>
              </article>
            </li>
          ))}
        </ul>
      </section>

      <section className="pp-panel" aria-labelledby="settings-unavailable">
        <h2 id="settings-unavailable">Not available in the current MVP</h2>
        <p className="pp-panel__note">
          These are missing platform settings. They are not form fields, and this page does not invent save actions.
        </p>
        <dl className="pp-dl">
          {UNAVAILABLE_SETTINGS.map((item) => (
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
