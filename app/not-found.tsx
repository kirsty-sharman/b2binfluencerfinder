import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-panel" style={{ minHeight: "100vh" }}>
      <section className="auth-form">
        <div className="eyebrow">Not found</div>
        <h2>This workspace page does not exist.</h2>
        <p className="muted">Return to your workspace to continue.</p>
        <Link className="primary-button wide-button" href="/app">Return to workspace</Link>
      </section>
    </main>
  );
}
