"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ExternalLink, Handshake } from "lucide-react";
import { saveOutreachRecord, type OutcomeActionState } from "@/app/app/brands/outcome-actions";
import type { OutcomeCandidate } from "@/lib/outcomes";

const initialState: OutcomeActionState = {};
const statusLabels: Record<string, string> = {
  not_started: "Not started", researching: "Researching", ready: "Ready to contact", contacted: "Contacted", replied: "Replied",
  negotiating: "Negotiating", agreed: "Agreed", declined: "Declined", paused: "Paused",
};

function localDateTime(value: string) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function OutreachForm({ brandSlug, candidate }: { brandSlug: string; candidate: OutcomeCandidate }) {
  const [state, action, pending] = useActionState(saveOutreachRecord, initialState);
  return <form action={action} className="outreach-row">
    <input type="hidden" name="brandSlug" value={brandSlug} /><input type="hidden" name="matchId" value={candidate.matchId} />
    <div className="outreach-person"><strong>{candidate.creatorName}</strong><span>{candidate.creatorHeadline}</span><div><a href={candidate.creatorUrl} target="_blank" rel="noreferrer">Profile <ExternalLink size={11} /></a><Link href={`/app/brands/${brandSlug}/creators/matches/${candidate.matchId}`}>View match</Link></div></div>
    <div className="outreach-context"><span>Asset</span><strong>{candidate.assetTitle}</strong><small>{candidate.selectedAngle || candidate.question}</small></div>
    <label><span>Status</span><select name="status" defaultValue={candidate.outreach?.status || "not_started"}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
    <label><span>Owner</span><input name="ownerName" defaultValue={candidate.outreach?.ownerName} placeholder="Team member" /></label>
    <label><span>Next action</span><input name="nextActionAt" type="datetime-local" defaultValue={localDateTime(candidate.outreach?.nextActionAt || "")} /></label>
    <details className="outreach-details"><summary>Contact & notes</summary><div><label><span>Contact or message URL</span><input name="contactUrl" type="url" defaultValue={candidate.outreach?.contactUrl} placeholder="https://…" /></label><label><span>Last contacted</span><input name="lastContactedAt" type="datetime-local" defaultValue={localDateTime(candidate.outreach?.lastContactedAt || "")} /></label><label className="form-full"><span>Internal notes</span><textarea name="notes" defaultValue={candidate.outreach?.notes} placeholder="Context, response, terms, and the next human action." /></label></div></details>
    <button className="secondary-button" disabled={pending}>{pending ? "Saving…" : candidate.outreach ? "Save" : "Start tracking"}</button>
    {state.error ? <p className="action-error outcome-message">{state.error}</p> : null}{state.success ? <p className="action-success outcome-message">{state.success}</p> : null}
  </form>;
}

export function OutreachWorkspace({ brandSlug, candidates, migrationRequired }: { brandSlug: string; candidates: OutcomeCandidate[]; migrationRequired: boolean }) {
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("all");
  const visible=candidates.filter(c=>(status==="all" || (c.outreach?.status||"not_started")===status) && `${c.creatorName} ${c.assetTitle}`.toLowerCase().includes(query.toLowerCase()));
  const active = candidates.filter((candidate) => candidate.outreach && !["declined", "paused"].includes(candidate.outreach.status)).length;
  const contacted = candidates.filter((candidate) => candidate.outreach && ["contacted", "replied", "negotiating", "agreed"].includes(candidate.outreach.status)).length;
  const agreed = candidates.filter((candidate) => candidate.outreach?.status === "agreed").length;
  return <main className="page outreach-page"><div className="page-header"><div className="page-header-copy"><div className="eyebrow">Human-led collaboration</div><h1>Manual outreach</h1><p>Track conversations, owners and next steps. Messages are sent outside the platform.</p></div></div>
    {migrationRequired ? <div className="surface migration-card"><Handshake /><div><strong>Slice 5 database update required</strong><p>Run <code>202609260008_outcome_tracking.sql</code>, then refresh.</p></div></div> : <>
      <section className="outcome-metrics"><div><span>Approved candidates</span><strong>{candidates.length}</strong></div><div><span>Active outreach</span><strong>{active}</strong></div><div><span>Contacted or beyond</span><strong>{contacted}</strong></div><div><span>Agreed</span><strong>{agreed}</strong></div></section>
      <div className="workspace-toolbar"><label>Search outreach<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Creator or matched content"/></label><label>Status<select value={status} onChange={e=>setStatus(e.target.value)}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><span>{visible.length} shown</span></div>
      {candidates.length ? <section className="surface outreach-list"><div className="outcome-section-head"><div><span className="eyebrow">Pipeline</span><h2>Your conversations</h2></div><span>{candidates.length} candidates</span></div>{visible.map((candidate) => <OutreachForm brandSlug={brandSlug} candidate={candidate} key={candidate.matchId} />)}{!visible.length && <div className="outcome-empty"><h2>No conversations match these filters</h2><p>Try another name or status.</p></div>}</section> : <section className="surface outcome-empty"><Handshake /><h2>No approved candidates yet</h2><p>Accept a creator–asset match or add it to a shortlist before starting outreach.</p><Link className="primary-button" href={`/app/brands/${brandSlug}/creators`}>Review matches</Link></section>}
    </>}
  </main>;
}
