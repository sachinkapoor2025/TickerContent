export function AdminContentPipeline() {
  const stages = [
    {
      stage: "Template",
      what: "A reusable composition used to start tenant content.",
      visibility: "Not available on Admin APIs",
    },
    {
      stage: "Content",
      what: "A tenant library item with title, status, and organization ownership.",
      visibility: "Content ID appears on publishing jobs",
    },
    {
      stage: "Version",
      what: "An immutable document snapshot. Publish uses the current draft version.",
      visibility: "Published version IDs on jobs and deliveries",
    },
    {
      stage: "Design",
      what: "Tenant editor updates create new draft versions.",
      visibility: "Not available",
    },
    {
      stage: "Preview",
      what: "Tenant LED preview uses the shared composition renderer.",
      visibility: "Document and assets are not returned to Admin",
    },
    {
      stage: "Publishing",
      what: "A job stores a snapshot and can create deliveries for selected ticker IDs.",
      visibility: "Jobs and deliveries on Admin APIs",
    },
  ];

  return (
    <section className="pp-panel" aria-labelledby="content-pipeline">
      <h2 id="content-pipeline">Content to publish</h2>
      <p className="pp-panel__note">
        Tenant users design and publish. Platform Admin can inspect publishing jobs and deliveries. Template, draft, and
        preview documents are not returned on Admin APIs.
      </p>
      <div className="pp-table-wrap pp-content-table">
        <table className="pp-admin-table">
          <caption className="pp-sr-only">How content reaches a display in the current MVP</caption>
          <thead>
            <tr>
              <th scope="col">Stage</th>
              <th scope="col">What it is</th>
              <th scope="col">Admin visibility</th>
            </tr>
          </thead>
          <tbody>
            {stages.map((row) => (
              <tr key={row.stage}>
                <td>{row.stage}</td>
                <td>{row.what}</td>
                <td>{row.visibility}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="pp-stack-list">
        {stages.map((row) => (
          <li key={`stack-${row.stage}`}>
            <article className="pp-stack-item">
              <h3>{row.stage}</h3>
              <dl className="pp-dl">
                <dt>What it is</dt>
                <dd>{row.what}</dd>
                <dt>Admin visibility</dt>
                <dd>{row.visibility}</dd>
              </dl>
            </article>
          </li>
        ))}
      </ul>
    </section>
  );
}
