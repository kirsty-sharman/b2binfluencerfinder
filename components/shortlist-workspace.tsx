"use client";

import Link from "next/link";
import { WorkspacePanel } from "@/components/workspace-ui";
import { useActionState, useState } from "react";
import { ArrowRight, ExternalLink, Plus, Star } from "lucide-react";
import { createShortlist, type ReviewActionState } from "@/app/app/brands/review-actions";

const initialState: ReviewActionState = {};

type ShortlistData = { id: string; name: string; description: string | null; members: Array<{ id: string; matchId: string; name: string; headline: string; followers: number | null; linkedinUrl: string; assetTitle: string; impact: number }> };

export function ShortlistWorkspace({ brandSlug, shortlists, migrationRequired }: { brandSlug: string; shortlists: ShortlistData[]; migrationRequired: boolean }) {
  const [state, action, pending] = useActionState(createShortlist, initialState);
  const [query,setQuery]=useState("");
  const shown=shortlists.map(list=>({...list,members:list.members.filter(member=>`${member.name} ${member.headline} ${member.assetTitle}`.toLowerCase().includes(query.toLowerCase()))})).filter(list=>!query || list.members.length).sort((a,b)=>b.members.length-a.members.length);
  return <main className="page shortlists-page"><div className="page-header"><div className="page-header-copy"><div className="eyebrow">Human-approved candidates</div><h1>Shortlists</h1><p>Your selected creators, organised for the next conversation.</p></div><Link className="primary-button" href={`/app/brands/${brandSlug}/outreach`}>Start outreach <ArrowRight size={15} /></Link></div>
    {migrationRequired ? <div className="surface migration-card"><Star /><div><strong>Database update required</strong><p>Run the Slice 4 migration, then refresh this page.</p></div></div> : <>
      <WorkspacePanel title="Create a shortlist" description="Organise a campaign or target industry"><form action={action} className="shortlist-create"><div><strong>Create a shortlist</strong><span>Use a specific campaign, industry, or evidence theme.</span></div><input type="hidden" name="brandSlug" value={brandSlug} /><input name="name" placeholder="e.g. Education leaders" required /><input name="description" placeholder="Optional description" /><button className="primary-button" disabled={pending}><Plus size={15} /> {pending ? "Creating…" : "Create"}</button></form></WorkspacePanel>{state.error ? <p className="auth-error">{state.error}</p> : null}{state.success ? <p className="save-success">{state.success}</p> : null}
      <div className="workspace-toolbar"><label>Search shortlists<input placeholder="Creator, topic or matched content" value={query} onChange={e=>setQuery(e.target.value)}/></label><span>{shortlists.length} lists · {shortlists.reduce((n,list)=>n+list.members.length,0)} saved matches</span></div>{!shown.length && <div className="surface outcome-empty"><Star/><h2>{query ? "No matching creators" : "Build your first shortlist"}</h2><Link className="secondary-button" href={`/app/brands/${brandSlug}/creators`}>Review creators</Link></div>}<div className="shortlist-grid">{shown.map((shortlist) => <section className="surface shortlist-card" key={shortlist.id}><header><div><span className="eyebrow">Shortlist</span><h2>{shortlist.name}</h2><p>{shortlist.description || "No description added."}</p></div><strong>{shortlist.members.length}</strong></header>{shortlist.members.length ? <div>{shortlist.members.map((member) => <div className="shortlist-member" key={member.id}><div><strong>{member.name}</strong><span>{member.headline}</span></div><span>{member.followers?.toLocaleString() || "—"} followers</span><span className="clamp-two">{member.assetTitle}</span><span className="impact-score">{member.impact}<small>/5</small></span><a href={member.linkedinUrl} target="_blank" rel="noreferrer" aria-label={`Open ${member.name} profile`}><ExternalLink size={14} /></a><Link href={`/app/brands/${brandSlug}/creators/matches/${member.matchId}`} aria-label={`Review ${member.name}`}><ArrowRight size={14} /></Link></div>)}</div> : <div className="empty-shortlist"><Star size={20} /><p>This list has no saved creators yet.</p></div>}</section>)}</div>
    </>}
  </main>;
}
