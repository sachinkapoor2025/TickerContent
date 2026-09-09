import {
  ASSIGNMENT_CAPABILITIES,
  ASSIGNMENT_FLOW,
  ASSIGNMENT_SURFACES,
  assignmentAvailabilityLabel,
  assignmentAvailabilityTone,
  type AssignmentAvailability,
} from "./assignmentData";

type AdminAssignmentsProps = {
  onOpenDisplays: () => void;
  onOpenOrganizations: () => void;
  onOpenMonitoring: () => void;
  onOpenDisplayContent: () => void;
};

export function AdminAssignments({
  onOpenDisplays,
  onOpenOrganizations,
  onOpenMonitoring,
  onOpenDisplayContent,
}: AdminAssignmentsProps) {
  function openSurface(id: string) {
    if (id === "organizations") onOpenOrganizations();
    if (id === "devices") onOpenDisplays();
    if (id === "display-content") onOpenDisplayContent();
    if (id === "monitoring") onOpenMonitoring();
  }

  return (
    <div className="pp-orgs">
      <header className="pp-orgs__header">
        <div>
          <h1 className="pp-page-title">Assignments</h1>
          <p className="pp-page-desc">
            Platform-level assignment management is not available in the current MVP. Display targeting lives in tenant
            campaign and publishing workflows. Admin can inspect organizations, displays, published content, publishing
            jobs, and deliveries.
          </p>
        </div>
        <div className="pp-header-actions">
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenOrganizations}>
            Organizations
          </button>
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenDisplays}>
            Displays
          </button>
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenDisplayContent}>
            Display Content
          </button>
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenMonitoring}>
            Monitoring
          </button>
        </div>
      </header>

      <section className="pp-panel" aria-labelledby="assignment-capability">
        <h2 id="assignment-capability">Current capability</h2>
        <p className="pp-panel__note">
          There is no platform Admin API to create, edit, prioritize, or history-track display assignments. Device-group
          and playlist tables exist for tenants but are not used by playback. Platform assignment management is future
          scope.
        </p>
        <dl className="pp-dl">
          <dt>Platform assignment API</dt>
          <dd>
            <AvailabilityStatus availability="not_available" />
          </dd>
          <dt>Campaign targeting</dt>
          <dd>
            <AvailabilityStatus availability="tenant_only" />
          </dd>
          <dt>Assignment CRUD from Admin</dt>
          <dd>
            <AvailabilityStatus availability="not_available" />
          </dd>
        </dl>
        <div className="pp-table-wrap pp-content-table">
          <table className="pp-admin-table">
            <caption className="pp-sr-only">Assignment capabilities and whether platform Admin can access them</caption>
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">Availability</th>
                <th scope="col">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {ASSIGNMENT_CAPABILITIES.map((topic) => (
                <tr key={topic.id}>
                  <td>{topic.topic}</td>
                  <td>
                    <AvailabilityStatus availability={topic.availability} />
                  </td>
                  <td>{topic.evidence}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="pp-stack-list">
          {ASSIGNMENT_CAPABILITIES.map((topic) => (
            <li key={`stack-${topic.id}`}>
              <article className="pp-stack-item">
                <h3>{topic.topic}</h3>
                <dl className="pp-dl">
                  <dt>Availability</dt>
                  <dd>
                    <AvailabilityStatus availability={topic.availability} />
                  </dd>
                </dl>
                <p className="pp-page-desc">{topic.evidence}</p>
              </article>
            </li>
          ))}
        </ul>
      </section>

      <section className="pp-panel" aria-labelledby="assignment-flow">
        <h2 id="assignment-flow">Current platform view</h2>
        <p className="pp-panel__note">
          Assignment-related evidence currently appears after tenant targeting and publish. This path is informational.
          It is not an assignment editor.
        </p>
        <ol className="pp-flow">
          {ASSIGNMENT_FLOW.map((step, index) => (
            <li key={step.id} className="pp-flow__item">
              <div className="pp-flow__step">
                <p className="pp-flow__index">Step {index + 1}</p>
                <h3 className="pp-flow__title">{step.title}</h3>
                <p className="pp-flow__note">{step.note}</p>
              </div>
              {index < ASSIGNMENT_FLOW.length - 1 ? (
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

      <section className="pp-panel" aria-labelledby="assignment-inspect">
        <h2 id="assignment-inspect">Related Admin views</h2>
        <p className="pp-panel__note">
          Displays, Organizations, Display Content, and Monitoring show registered ticker counts, publishing jobs, and
          deliveries. Those views are not assignment managers. Organization audit records remain on Organization detail.
        </p>
        <div className="pp-table-wrap pp-content-table">
          <table className="pp-admin-table">
            <caption className="pp-sr-only">Existing Admin screens related to assignment evidence</caption>
            <thead>
              <tr>
                <th scope="col">Screen</th>
                <th scope="col">What Admin can inspect</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ASSIGNMENT_SURFACES.map((surface) => (
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
          {ASSIGNMENT_SURFACES.map((surface) => (
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
    </div>
  );
}

function AvailabilityStatus({ availability }: { availability: AssignmentAvailability }) {
  return (
    <span className={`pp-status pp-status--${assignmentAvailabilityTone(availability)}`}>
      {assignmentAvailabilityLabel(availability)}
    </span>
  );
}
