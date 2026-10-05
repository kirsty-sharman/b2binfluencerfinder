import { Construction } from "lucide-react";

export function PlaceholderPage({ title, description }: { title: string; description: string }) {
  return (
    <main className="page">
      <header className="page-header"><div className="page-header-copy"><h1>{title}</h1></div></header><section className="surface placeholder">
        <div className="placeholder-icon"><Construction size={21} aria-hidden="true" /></div>
        <h2>Coming soon</h2>
        <p>{description}</p>
      </section>
    </main>
  );
}
