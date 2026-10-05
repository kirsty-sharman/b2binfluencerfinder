import { NewBrandForm } from "./new-brand-form";

export default function NewBrandPage() {
  return (
    <main className="page">
      <header className="page-header">
        <div className="page-header-copy"><div className="eyebrow">New workspace brand</div><h1>Add a brand</h1><p>Create the brand boundary first. Its industries, phrase lists, evidence assets, creators, and runs remain separate.</p></div>
      </header>
      <NewBrandForm />
    </main>
  );
}
