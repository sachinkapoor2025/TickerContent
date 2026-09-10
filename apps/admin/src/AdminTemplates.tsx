import { AdminContentPipeline } from "./AdminContentPipeline";
import {
  TEMPLATE_CAPABILITIES,
  TEMPLATE_SURFACES,
  templateAvailabilityLabel,
  templateAvailabilityTone,
  type TemplateAvailability,
} from "./templateData";

type AdminTemplatesProps = {
  onOpenDisplayContent: () => void;
  onOpenOrganizations: () => void;
  onOpenMonitoring: () => void;
};

export function AdminTemplates({
  onOpenDisplayContent,
  onOpenOrganizations,
  onOpenMonitoring,
}: AdminTemplatesProps) {
  function openSurface(id: string) {
    if (id === "organizations") onOpenOrganizations();
    if (id === "display-content") onOpenDisplayContent();
    if (id === "monitoring") onOpenMonitoring();
  }

  return (
    <div className="pp-orgs">
      <header className="pp-orgs__header">
        <div>
          <h1 className="pp-page-title">Templates</h1>
          <p className="pp-page-desc">
            Platform template management is not available in the current MVP. Templates are currently managed in the
            customer workspace catalog. Platform Admin can inspect organizations and publishing records, but does not
            have a global template catalog API.
          </p>
        </div>
        <div className="pp-header-actions">
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenOrganizations}>
            Organizations
          </button>
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenDisplayContent}>
            Display Content
          </button>
          <button type="button" className="pp-btn pp-btn--ghost" onClick={onOpenMonitoring}>
            Monitoring
          </button>
        </div>
      </header>

      <section className="pp-panel" aria-labelledby="template-capability">
        <h2 id="template-capability">Current capability</h2>
        <p className="pp-panel__note">
          There is no platform Admin API for template records. Tenant GET /v1/templates is not used here. A global Admin
          template catalog is future scope.
        </p>
        <dl className="pp-dl">
          <dt>Global template catalog</dt>
          <dd>
            <AvailabilityStatus availability="not_available" />
          </dd>
          <dt>Template CRUD from Admin</dt>
          <dd>
            <AvailabilityStatus availability="not_available" />
          </dd>
          <dt>Platform template publishing</dt>
          <dd>
            <AvailabilityStatus availability="not_available" />
          </dd>
        </dl>
        <div className="pp-table-wrap pp-content-table">
          <table className="pp-admin-table">
            <caption className="pp-sr-only">Template capabilities and whether platform Admin can access them</caption>
            <thead>
              <tr>
                <th scope="col">Capability</th>
                <th scope="col">Availability</th>
                <th scope="col">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {TEMPLATE_CAPABILITIES.map((topic) => (
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
          {TEMPLATE_CAPABILITIES.map((topic) => (
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

      <section className="pp-panel" aria-labelledby="template-managed">
        <h2 id="template-managed">Where templates are currently managed</h2>
        <p className="pp-panel__note">
          Template functionality exists in the customer workspace. Customers create content from the tenant catalog.
          Platform Admin does not impersonate a tenant and does not open a template manager from this portal.
        </p>
      </section>

      <section className="pp-panel" aria-labelledby="template-inspect">
        <h2 id="template-inspect">Related operational views</h2>
        <p className="pp-panel__note">
          Admin can inspect organizations, published display content, publishing jobs, deliveries, and per-organization
          audit records. Those views are not a template catalog.
        </p>
        <div className="pp-table-wrap pp-content-table">
          <table className="pp-admin-table">
            <caption className="pp-sr-only">Existing Admin screens related to templates</caption>
            <thead>
              <tr>
                <th scope="col">Screen</th>
                <th scope="col">What Admin can inspect</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {TEMPLATE_SURFACES.map((surface) => (
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
          {TEMPLATE_SURFACES.map((surface) => (
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

      <AdminContentPipeline />
    </div>
  );
}

function AvailabilityStatus({ availability }: { availability: TemplateAvailability }) {
  return (
    <span className={`pp-status pp-status--${templateAvailabilityTone(availability)}`}>
      {templateAvailabilityLabel(availability)}
    </span>
  );
}
