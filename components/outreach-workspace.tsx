"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { ExternalLink, Handshake, X } from "lucide-react";
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
    <label><span>Follow-up date & time</span><input name="nextActionAt" type="datetime-local" defaultValue={localDateTime(candidate.outreach?.nextActionAt || "")} /></label>
    <details open className="outreach-details"><summary>Contact & notes</summary><div><label><span>Contact or message URL</span><input name="contactUrl" type="url" defaultValue={candidate.outreach?.contactUrl} placeholder="https://…" /></label><label><span>Last contacted</span><input name="lastContactedAt" type="datetime-local" defaultValue={localDateTime(candidate.outreach?.lastContactedAt || "")} /></label><label className="form-full"><span>Internal notes</span><textarea name="notes" defaultValue={candidate.outreach?.notes} placeholder="Context, response, terms, and the next human action." /></label></div></details>
    <button className="primary-button" disabled={pending}>{pending ? "Saving…" : candidate.outreach ? "Save" : "Start tracking"}</button>
    {state.error ? <p role="alert" className="action-error outcome-message">{state.error}</p> : null}{state.success ? <p role="status" className="action-success outcome-message">{state.success}</p> : null}
  </form>;
}

export function OutreachWorkspace({ brandSlug, candidates, migrationRequired }: { brandSlug: string; candidates: OutcomeCandidate[]; migrationRequired: boolean }) {
  const [query,setQuery]=useState("");
  const [status,setStatus]=useState("all");
  const [owner,setOwner]=useState("all");
  const [view,setView]=useState("all");
  const [sort,setSort]=useState("followup");
  const [page,setPage]=useState(1);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [now,setNow]=useState(0);
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const tick=()=>setNow(Date.now());tick();const timer=setInterval(tick,60000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    if(!selectedId || !dialog.current)return;
    const element=dialog.current,focus=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    element.showModal();document.body.style.overflow="hidden";
    return()=>{element.close();document.body.style.overflow=overflow;focus?.focus();};
  },[selectedId]);
  const selected=candidates.find(c=>c.matchId===selectedId);
  const stage=(c:OutcomeCandidate)=>c.outreach?.status || "not_started";
  const due=(c:OutcomeCandidate)=>Boolean(c.outreach?.nextActionAt && new Date(c.outreach.nextActionAt).getTime()<=now && !["agreed","declined","paused"].includes(stage(c)));
  const owners=[...new Set(candidates.map(c=>c.outreach?.ownerName).filter((v):v is string=>Boolean(v)))].sort();
  const visible=candidates.filter(c=>(status==="all" || stage(c)===status) && (owner==="all" || (owner==="unassigned" ? !c.outreach?.ownerName : c.outreach?.ownerName===owner)) && (view==="all" || (view==="due" ? due(c) : view==="new" ? stage(c)==="not_started" : stage(c)==="agreed")) && `${c.creatorName} ${c.assetTitle} ${c.outreach?.ownerName || ""}`.toLowerCase().includes(query.toLowerCase())).sort((a,b)=>sort==="name" ? a.creatorName.localeCompare(b.creatorName) : sort==="status" ? stage(a).localeCompare(stage(b)) : (a.outreach?.nextActionAt ? new Date(a.outreach.nextActionAt).getTime():Infinity)-(b.outreach?.nextActionAt ? new Date(b.outreach.nextActionAt).getTime():Infinity) || a.creatorName.localeCompare(b.creatorName));
  const pages=Math.max(1,Math.ceil(visible.length/15)),current=Math.min(page,pages);
  function reset(){setQuery("");setStatus("all");setOwner("all");setView("all");setPage(1);}
  const metrics=[['all','All conversations',candidates.length],['due','Follow-ups due',candidates.filter(due).length],['new','Not started',candidates.filter(c=>stage(c)==="not_started").length],['agreed','Agreed',candidates.filter(c=>stage(c)==="agreed").length]] as const;
  return <main className="page outreach-page"><div className="page-header"><div className="page-header-copy"><div className="eyebrow">Human-led collaboration</div><h1>Manual outreach</h1><p>Track conversations, owners and next steps. Messages are sent outside the platform.</p></div><Link className="secondary-button" href={`/app/brands/${brandSlug}/shortlists`}>View shortlists</Link></div>
    {migrationRequired ? <div className="surface migration-card"><Handshake /><div><strong>Slice 5 database update required</strong><p>Run <code>202609260008_outcome_tracking.sql</code>, then refresh.</p></div></div> : <>
      <div className="outreach-overview">{metrics.map(([key,label,count])=><button key={key} aria-pressed={view===key} onClick={()=>{reset();setView(key);}}><span>{label}</span><strong>{count}</strong><small>{key==="due" ? "Scheduled time has passed" : key==="new" ? "Ready for your first step" : key==="agreed" ? "Confirmed collaborations" : "Your approved creator matches"}</small></button>)}</div>
      <section className="surface outreach-pipeline">
        <div className="outreach-filterbar"><label className="field">Search conversations<input className="text-input" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Creator, content or owner"/></label><label className="field">Status<select className="text-input" value={status} onChange={e=>{setStatus(e.target.value);setPage(1);}}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="field">Owner<select className="text-input" value={owner} onChange={e=>{setOwner(e.target.value);setPage(1);}}><option value="all">Everyone</option><option value="unassigned">Unassigned</option>{owners.map(name=><option key={name}>{name}</option>)}</select></label><label className="field">Sort by<select className="text-input" value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="followup">Next follow-up</option><option value="name">Creator A–Z</option><option value="status">Status</option></select></label></div>
        <div className="outreach-result-count"><span role="status">{visible.length} conversations{view!=="all" ? ` · ${metrics.find(m=>m[0]===view)?.[1]}` : ""}</span><button className="secondary-button" onClick={reset}>Clear filters</button></div>
        <div className="outreach-table-wrap"><table className="outreach-compact-table"><thead><tr><th>Creator & content</th><th>Status</th><th>Owner</th><th>Next follow-up</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visible.slice((current-1)*15,current*15).map(candidate=><tr key={candidate.matchId}><td><strong>{candidate.creatorName}</strong><span className="outreach-asset-caption">{candidate.assetTitle}</span></td><td><span className={`outreach-stage stage-${stage(candidate)}`}>{statusLabels[stage(candidate)]}</span></td><td>{candidate.outreach?.ownerName || <span className="outreach-muted">Unassigned</span>}</td><td><span className={due(candidate)?"outreach-due":"outreach-muted"}>{candidate.outreach?.nextActionAt ? new Date(candidate.outreach.nextActionAt).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : "Not scheduled"}</span>{due(candidate) && <small className="outreach-due">Follow-up due</small>}</td><td><button className="secondary-button" aria-haspopup="dialog" onClick={()=>setSelectedId(candidate.matchId)}>{candidate.outreach ? "Manage" : "Start tracking"}</button></td></tr>)}</tbody></table></div>
        {!visible.length && <div className="outcome-empty"><Handshake/><h2>{candidates.length ? "No conversations match" : "Your next partnership starts here"}</h2><p>{candidates.length ? "Try another search or clear your filters." : "Shortlist a creator to start tracking your conversation."}</p>{candidates.length ? <button className="secondary-button" onClick={reset}>Show all conversations</button> : <Link className="primary-button" href={`/app/brands/${brandSlug}/creators`}>Find creators</Link>}</div>}
        <nav className="library-footer" aria-label="Outreach pages"><span>{visible.length ? `${(current-1)*15+1}–${Math.min(current*15,visible.length)} of ${visible.length}` : "0 results"}</span><button className="secondary-button" disabled={current===1} onClick={()=>setPage(current-1)}>Previous</button><span>{current} / {pages}</span><button className="secondary-button" disabled={current===pages} onClick={()=>setPage(current+1)}>Next</button></nav>
      </section>
      <dialog ref={dialog} className="content-library-drawer outreach-editor" aria-labelledby="outreach-editor-title" onCancel={()=>setSelectedId(null)} onClose={()=>setSelectedId(null)}><header className="content-library-drawer-header"><div><h2 id="outreach-editor-title">Manage conversation</h2><p>Save progress and plan your next step. This does not send a message.</p></div><button className="secondary-button" aria-label="Close conversation" onClick={()=>setSelectedId(null)}><X size={18}/></button></header><div className="content-library-drawer-body">{selected && <OutreachForm key={selected.matchId} brandSlug={brandSlug} candidate={selected}/>}</div></dialog>

    </>}
  </main>;
}
