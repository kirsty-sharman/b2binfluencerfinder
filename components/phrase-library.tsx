"use client";

import Link from "next/link";
import { WorkspacePanel } from "@/components/workspace-ui";
import { useActionState, useState } from "react";
import { addPhrase, updatePhraseStatus, suggestPhrases, reviewPhraseSuggestion, type ResearchActionState } from "@/app/app/brands/research-actions";
import type { PhraseRecord } from "@/lib/research";

const initialState: ResearchActionState = {};

export function PhraseLibrary({ brandSlug, phrases, migrationRequired }: { brandSlug: string; phrases: PhraseRecord[]; migrationRequired: boolean }) {
  const [state, action, pending] = useActionState(addPhrase, initialState);
  const [suggestState, suggestAction, suggesting] = useActionState(suggestPhrases, initialState);
  const [reviewState, reviewAction, reviewing] = useActionState(reviewPhraseSuggestion, initialState);
  const [page, setPage] = useState(1);
  const suggestions = phrases.filter(p => p.source === "suggested" && p.status === "draft");
  const master = phrases.filter(p => !(p.source === "suggested" && p.status === "draft"));
  const pages = Math.max(1, Math.ceil(master.length / 10));
  const currentPage = Math.min(page, pages);
  const visible = master.slice((currentPage - 1) * 10, currentPage * 10);
  const approved = phrases.filter((phrase) => phrase.status === "approved").length;

  return (
    <main className="page questions-page">
      <header className="page-header"><div className="page-header-copy"><div className="eyebrow">AI visibility</div><h1>Questions to track</h1><p>Save the buyer questions you want to track in AI answers.</p><Link className="secondary-button" href={`/app/brands/${brandSlug}/visibility`}>Back to AI visibility</Link></div></header>
      {migrationRequired ? <section className="surface surface-pad migration-notice"><h2>Database update required</h2><p>Apply migration <code>202609260004_brand_research.sql</code> to enable saved phrases.</p></section> : (
        <>
          <WorkspacePanel title={`Suggested questions (${suggestions.length})`} description="Review AI ideas or generate new suggestions">
            <div className="section-heading"><h2>Suggested prompts</h2><span>{suggestions.length} ready to review</span></div>
            <p>AI suggestions based on your brand, audience and content, mixing buying questions with educational searches. These are ideas to track, not measured search-volume rankings.</p>
            <form action={suggestAction}><input type="hidden" name="brandSlug" value={brandSlug} /><button className="primary-button" disabled={suggesting || reviewing || suggestions.length >= 10}>{suggesting ? "Finding suggestions…" : suggestions.length ? "Top up suggestions" : "Generate 10 suggestions"}</button></form>
            <p>Accept a prompt to add it to the master list. We’ll find a replacement whenever you accept or dismiss one.</p>
            {reviewing ? <p role="status">Saving your decision and finding a replacement…</p> : null}
            {suggestState.error || reviewState.error ? <p className="auth-error" role="alert">{reviewState.error || suggestState.error}</p> : null}
            {reviewState.success || suggestState.success ? <p className="save-success" role="status">{reviewState.success || suggestState.success}</p> : null}
            <div className="research-list">{suggestions.map(item => <div className="research-row" key={item.id}><div><strong>{item.phrase}</strong><span>{item.intent === "informational" ? "Educational" : item.intent} · AI suggestion</span></div><form action={reviewAction} className="row-actions"><input type="hidden" name="brandSlug" value={brandSlug} /><input type="hidden" name="phraseId" value={item.id} /><button className="secondary-button" name="status" value="approved" disabled={suggesting || reviewing}>Accept</button><button className="quiet-button" name="status" value="rejected" disabled={suggesting || reviewing}>Dismiss</button></form></div>)}</div>
          </WorkspacePanel>
          <section className="surface surface-pad">
            <form action={action} className="inline-create-form">
              <input type="hidden" name="brandSlug" value={brandSlug} />
              <div className="field"><label htmlFor="phrase">Question</label><input className="text-input" id="phrase" name="phrase" placeholder="Which referral software works best for training providers?" required /></div>
              <div className="field"><label htmlFor="intent">Intent <span className="optional">Optional</span></label><select className="text-input" id="intent" name="intent"><option value="">Not set</option><option value="informational">Informational</option><option value="commercial">Commercial</option><option value="comparison">Comparison</option><option value="problem">Problem-led</option></select></div>
              <button className="primary-button" disabled={pending} type="submit">{pending ? "Adding…" : "Add question"}</button>
            </form>
            {state.error ? <div className="auth-error" role="alert">{state.error}</div> : null}
            {state.success ? <div className="save-success" role="status">{state.success}</div> : null}
          </section>

          <div className="section-heading"><h2>Saved questions</h2><span>{approved} approved · {master.length} total</span></div>
          <section className="surface research-list">
            {visible.length ? visible.map((item) => (
              <div className="research-row" key={item.id}>
                <div><strong>{item.phrase}</strong><span>{item.intent || "Intent not set"} · {item.source}</span></div>
                <span className={`status-pill ${item.status === "approved" ? "success" : item.status === "rejected" ? "muted-pill" : "pink"}`}>{item.status}</span>
                <form action={updatePhraseStatus} className="row-actions">
                  <input type="hidden" name="brandSlug" value={brandSlug} /><input type="hidden" name="phraseId" value={item.id} />
                  {item.status !== "approved" ? <button className="quiet-button" name="status" value="approved">Approve</button> : null}
                  {item.status !== "draft" ? <button className="quiet-button" name="status" value="draft">Draft</button> : null}
                  {item.status !== "rejected" ? <button className="quiet-button" name="status" value="rejected">Reject</button> : null}
                </form>
              </div>
            )) : <div className="empty-research"><h2>No questions yet</h2><p>Save questions your buyers ask, then use them in your AI visibility checks.</p></div>}
          </section>
          <nav className="phrase-pagination" aria-label="Saved questions pages"><button className="secondary-button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button><span>Page {currentPage} of {pages} · {master.length} phrases</span><button className="secondary-button" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button></nav>
        </>
      )}
    </main>
  );
}
