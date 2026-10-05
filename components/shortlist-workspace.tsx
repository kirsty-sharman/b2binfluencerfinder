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
  const [sort,setSort]=useState("name");
  const [filter,setFilter]=useState("all");
  const [page,setPage]=useState(1);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [memberQuery,setMemberQuery]=useState("");
  const [memberPage,setMemberPage]=useState(1);
  const shown=shortlists.filter(list=>{
    const text=[list.name,list.description,...list.members.flatMap(m=>[m.name,m.headline,m.assetTitle])].join(" ").toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (filter==="all" || (filter==="populated" ? list.members.length>0 : list.members.length===0));
  }).sort((a,b)=>sort==="most" ? b.members.length-a.members.length || a.name.localeCompare(b.name) : sort==="fewest" ? a.members.length-b.members.length || a.name.localeCompare(b.name) : a.name.localeCompare(b.name));
  const pages=Math.max(1,Math.ceil(shown.length/12));
  const current=Math.min(page,pages);
  const selected=shortlists.find(list=>list.id===selectedId);
  const members=selected?.members.filter(m=>[m.name,m.headline,m.assetTitle].join(" ").toLowerCase().includes(memberQuery.trim().toLowerCase())) || [];
  const memberPages=Math.max(1,Math.ceil(members.length/15));
  const currentMemberPage=Math.min(memberPage,memberPages);
  if(selected) return <main className="page shortlists-page">
    <button className="secondary-button" onClick={()=>setSelectedId(null)}>← All shortlists</button>
    <header className="page-header"><div className="page-header-copy"><div className="eyebrow">Shortlist · {selected.members.length} saved matches</div><h1>{selected.name}</h1><p>{selected.description || "Your saved creator matches."}</p></div><Link className="secondary-button" href={`/app/brands/${brandSlug}/outreach`}>Track manual outreach <ArrowRight size={15}/></Link></header>
    <div className="workspace-toolbar"><label>Search this shortlist<input value={memberQuery} placeholder="Creator or matched content" onChange={e=>{setMemberQuery(e.target.value);setMemberPage(1);}}/></label><span>{members.length} matching results</span></div>
    <section className="surface shortlist-card"><div>{members.slice((currentMemberPage-1)*15,currentMemberPage*15).map(member=><div className="shortlist-member" key={member.id}><div><strong>{member.name}</strong><span>{member.headline}</span></div><span>{member.followers?.toLocaleString() ?? "—"} followers</span><span className="clamp-two">{member.assetTitle}</span><span className="impact-score" title="Content fit">{member.impact}<small>/5</small></span><a href={member.linkedinUrl} target="_blank" rel="noreferrer" aria-label={`Open ${member.name} profile`}><ExternalLink size={14}/></a><Link href={`/app/brands/${brandSlug}/creators/matches/${member.matchId}`} aria-label={`Review ${member.name}`}><ArrowRight size={14}/></Link></div>)}</div>{!members.length && <div className="empty-shortlist"><p>{memberQuery ? "No creators match your search." : "No creators saved in this shortlist yet."}</p>{memberQuery && <button className="secondary-button" onClick={()=>setMemberQuery("")}>Clear search</button>}</div>}</section>
    <nav className="library-footer" aria-label="Shortlist creator pages"><span>{members.length ? `${(currentMemberPage-1)*15+1}–${Math.min(currentMemberPage*15,members.length)} of ${members.length}` : "0 results"}</span><button className="secondary-button" disabled={currentMemberPage===1} onClick={()=>setMemberPage(currentMemberPage-1)}>Previous</button><span>{currentMemberPage} / {memberPages}</span><button className="secondary-button" disabled={currentMemberPage===memberPages} onClick={()=>setMemberPage(currentMemberPage+1)}>Next</button></nav>
  </main>;
  return <main className="page shortlists-page"><div className="page-header"><div className="page-header-copy"><div className="eyebrow">Human-approved candidates</div><h1>Shortlists</h1><p>Your selected creators, organised for the next conversation.</p></div><Link className="secondary-button" href={`/app/brands/${brandSlug}/outreach`}>Track manual outreach <ArrowRight size={15} /></Link></div>
    {migrationRequired ? <div className="surface migration-card"><Star /><div><strong>Database update required</strong><p>Run the Slice 4 migration, then refresh this page.</p></div></div> : <>
      <aside className="shortlist-managed-strip"><div><strong>Ready to reach out? Get human help with Managed.</strong><p>Outreach, follow-ups and bookings · $800/month. Creator fees are separate.</p></div><Link className="secondary-button" href="/contact">Explore Managed <ArrowRight size={16}/></Link></aside>
      <WorkspacePanel title="Create a shortlist" description="Organise a campaign or target industry"><form action={action} className="shortlist-create"><div><strong>Create a shortlist</strong><span>Use a specific campaign, industry, or evidence theme.</span></div><input type="hidden" name="brandSlug" value={brandSlug} /><input name="name" placeholder="e.g. Education leaders" required /><input name="description" placeholder="Optional description" /><button className="primary-button" disabled={pending}><Plus size={15} /> {pending ? "Creating…" : "Create"}</button></form></WorkspacePanel>{state.error ? <p className="auth-error">{state.error}</p> : null}{state.success ? <p className="save-success">{state.success}</p> : null}
      <div className="shortlist-directory-tools">
        <label className="field">Search lists or creators<input className="text-input" placeholder="List name, description, creator or content…" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}}/></label>
        <label className="field">Show<select className="text-input" value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}><option value="all">All shortlists</option><option value="populated">With creators</option><option value="empty">Empty lists</option></select></label>
        <label className="field">Sort by<select className="text-input" value={sort} onChange={e=>{setSort(e.target.value);setPage(1);}}><option value="name">Name A–Z</option><option value="most">Most saved matches</option><option value="fewest">Fewest saved matches</option></select></label>
      </div>
      <p className="shortlist-directory-count" role="status">{shown.length} of {shortlists.length} shortlists · {shortlists.reduce((n,list)=>n+list.members.length,0)} saved matches</p>
      <div className="shortlist-directory">{shown.slice((current-1)*12,current*12).map(list=><button className="shortlist-directory-row" key={list.id} onClick={()=>{setSelectedId(list.id);setMemberQuery("");setMemberPage(1);window.scrollTo(0,0);}}><span className="shortlist-directory-icon"><Star size={20}/></span><span className="shortlist-directory-copy"><strong>{list.name}</strong><span>{list.description || "No description added"}</span></span><span className="shortlist-directory-size">{list.members.length}<small>saved matches</small></span><span className="shortlist-directory-open">Open <ArrowRight size={16}/></span></button>)}</div>
      {!shown.length && <div className="surface outcome-empty"><Star/><h2>{shortlists.length ? "No matching shortlists" : "Create your first shortlist"}</h2><p>{shortlists.length ? "Try another name, creator or filter." : "Use Create a shortlist above to organise your creators."}</p>{shortlists.length>0 && <button className="secondary-button" onClick={()=>{setQuery("");setFilter("all");setPage(1);}}>Clear filters</button>}</div>}
      <nav className="library-footer" aria-label="Shortlist directory pages"><span>{shown.length ? `${(current-1)*12+1}–${Math.min(current*12,shown.length)} of ${shown.length} lists` : "0 lists"}</span><button className="secondary-button" disabled={current===1} onClick={()=>setPage(current-1)}>Previous</button><span>{current} / {pages}</span><button className="secondary-button" disabled={current===pages} onClick={()=>setPage(current+1)}>Next</button></nav>

    </>}
  </main>;
}
