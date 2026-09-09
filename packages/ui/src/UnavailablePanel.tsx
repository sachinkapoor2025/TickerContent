export function UnavailablePanel({ title }: { title: string }) {
  return (
    <section className="pp-unavailable">
      <h1 className="pp-page-title">{title}</h1>
      <p className="pp-page-desc">
        This section is not part of the current MVP. Existing routes and operations remain available from the
        workspace navigation.
      </p>
    </section>
  );
}
