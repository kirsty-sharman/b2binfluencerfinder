export default function WorkspaceLoading() {
  return <main className="page" aria-busy="true" aria-label="Loading page">
    <p role="status">Loading your workspace…</p>
    <div className="workspace-skeleton" aria-hidden="true">
      <div /><div /><div /><div />
    </div>
  </main>;
}
