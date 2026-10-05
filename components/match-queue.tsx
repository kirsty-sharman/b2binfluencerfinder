"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import { refreshMatchSuggestions, type ReviewActionState } from "@/app/app/brands/review-actions";
import type { CreatorResult } from "@/lib/matching";

const initialState: ReviewActionState = {};

export function MatchQueue({ brandSlug, creators, migrationRequired }: { brandSlug: string; creators: CreatorResult[]; migrationRequired: boolean }) {
  const [state, action, pending] = useActionState(refreshMatchSuggestions, initialState);
  const reviewed = creators.filter((creator) => creator.bestMatch?.status !== "pending").length;
  const pendingCreators = creators.filter((creator) => creator.bestMatch?.status === "pending");
  return <main className="page">
    <div className="page-header"><div className="page-header-copy"><div className="eyebrow">Human review queue</div><h1>Match review</h1><p>Review the creator, source asset, target question, and direct evidence together. Suggested scores remain editable.</p></div><div className="page-actions"><form action={action}><input type="hidden" name="brandSlug" value={brandSlug} /><button className="secondary-button" disabled={pending || migrationRequired}><RefreshCw size={15} /> {pending ? "Refreshing…" : "Refresh suggestions"}</button></form>{pendingCreators[0]?.bestMatch ? <Link className="primary-button" href={`/app/brands/${brandSlug}/creators/matches/${pendingCreators[0].bestMatch.id}`}>Review next <ArrowRight size={15} /></Link> : null}</div></div>
    {migrationRequired ? <div className="surface migration-card"><Sparkles /><div><strong>Database update required</strong><p>Run <code>supabase/migrations/202609260006_matching_review.sql</code>, then refresh this page.</p></div></div> : <>
      <div className="review-progress surface"><div><strong>{reviewed} of {creators.length}</strong><span> matches reviewed</span></div><div className="review-progress-bar"><span style={{ width: `${creators.length ? (reviewed / creators.length) * 100 : 0}%` }} /></div><span>{pendingCreators.length} remaining</span></div>
      <section className="surface match-queue-list">{creators.length ? creators.map((creator) => <Link className="match-queue-row" href={`/app/brands/${brandSlug}/creators/matches/${creator.bestMatch?.id}`} key={creator.id}><span className="creator-avatar">{creator.name.split(/\s+/).map((part) => part[0]).join("").slice(0,2)}</span><div className="match-queue-person"><strong>{creator.name}</strong><span>{creator.headline}</span></div><div><span className="queue-label">Asset</span><strong>{creator.bestMatch?.assetTitle}</strong></div><div><span className="queue-label">Evidence</span><strong>{creator.evidenceCount} posts</strong></div><span className="impact-score">{creator.bestMatch?.impact}<small>/5</small></span><span className={`review-pill ${creator.bestMatch?.status}`}>{creator.bestMatch?.status === "accepted" ? <CheckCircle2 size={13} /> : null}{creator.bestMatch?.status}</span><ArrowRight size={16} /></Link>) : <div className="empty-research"><Sparkles size={24} /><h2>No matches yet</h2><p>Generate suggestions once eligible creators and eligible brand assets are available.</p></div>}</section>
      {state.error ? <p className="auth-error">{state.error}</p> : null}{state.success ? <p className="save-success">{state.success}</p> : null}
    </>}
  </main>;
}
