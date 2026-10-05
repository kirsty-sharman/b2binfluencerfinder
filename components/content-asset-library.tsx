"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ActionHelp } from "@/components/workspace-ui";
import { ExternalLink, Plus, X } from "lucide-react";
import { addContentAsset, scanContentAssets, updateContentAsset, curateContentAssets, type ResearchActionState } from "@/app/app/brands/research-actions";
import type { ContentAssetRecord } from "@/lib/research";
import { loadContentLibraryPage } from "@/app/app/brands/content-library-actions";
import { contentStatus as status, type LibraryOptions } from "@/lib/content-library-view";
const initialState: ResearchActionState = {};
export function ContentAssetLibrary({brandSlug,assets,total,migrationRequired}:{brandSlug:string;assets:ContentAssetRecord[];total:number;migrationRequired:boolean}) {
  const [curateState,curate,curating]=useActionState(curateContentAssets,initialState);
  const [scanState,scan,scanning]=useActionState(scanContentAssets,initialState);
  const [urlState,scanUrl,scanningUrl]=useActionState(addContentAsset,initialState);
  const [selectionState,select,selecting]=useActionState(updateContentAsset,initialState);
  const [noticeMode,setNoticeMode]=useState<"curate"|"scan"|"url"|"selection">("curate");
  const [browse,setBrowse]=useState(false);
  const [adding,setAdding]=useState(false);
  const addDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    if(!adding || !addDialog.current)return;
    const dialog=addDialog.current; const focus=document.activeElement as HTMLElement|null; const overflow=document.body.style.overflow;
    dialog.showModal();document.body.style.overflow="hidden";
    return ()=>{dialog.close();document.body.style.overflow=overflow;focus?.focus();};
  },[adding]);
  const [options,setOptions]=useState<LibraryOptions>({});
  function option(key:keyof LibraryOptions,value:string){setOptions(previous=>({...previous,[key]:value}));setPage(1);}
  function resetFilters(){setQuery("");setFilter("all");setOptions({});setPage(1);}
  const libraryDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    if(!browse)return;
    const dialog=libraryDialog.current;
    if(!dialog)return;
    const previousFocus=document.activeElement as HTMLElement|null;
    const previousOverflow=document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow="hidden";
    return ()=>{dialog.close();document.body.style.overflow=previousOverflow;previousFocus?.focus();};
  },[browse]);
  const [filter,setFilter]=useState("all");
  const [query,setQuery]=useState("");
  const [page,setPage]=useState(1);
  const active=assets.filter(a=>a.eligible).sort((a,b)=>(b.assessment?.score ?? -1)-(a.assessment?.score ?? -1));
  const labels:Record<string,string>={active:"Active",ready:"Ready to add",review:"Needs assessment",excluded:"Not eligible"};
  const [result,setResult]=useState<Awaited<ReturnType<typeof loadContentLibraryPage>> | null>(null);
  const [loading,setLoading]=useState(false);
  const [loadError,setLoadError]=useState("");
  useEffect(()=>{
    if (!browse) return;
    let cancelled=false;
    const timer=setTimeout(()=>{
      setLoading(true);setLoadError("");
      loadContentLibraryPage(brandSlug,query,filter,page,options).then(value=>{if(!cancelled)setResult(value);}).catch(()=>{if(!cancelled)setLoadError("Unable to load the library. Close and reopen to retry.");}).finally(()=>{if(!cancelled)setLoading(false);});
    },200);
    return ()=>{cancelled=true;clearTimeout(timer);};
  },[browse,brandSlug,query,filter,page,options,assets]);
  const candidates=result?.assets || [];
  const count=result?.count || 0;
  function openLibrary(){resetFilters();setBrowse(true);}
  const pages=result?.pages || 1;
  const current=result?.current || 1;
  const busy=curating || scanning || scanningUrl || selecting;
  const notices=[{curate:curateState,scan:scanState,url:urlState,selection:selectionState}[noticeMode]];
  function card(asset:ContentAssetRecord) {
    const audit=asset.assessment;
    return <article className="surface content-candidate" key={asset.id}>
      <div className="content-candidate-main"><div className="tag-row"><span className="tag">{asset.contentType}</span><span className="tag">{audit ? audit.matchedIndustries?.length ? `${audit.score}/100 creator fit` : "Creator fit not scored" : "Not assessed"}</span>{audit && !audit.matchedIndustries?.length ? <span className="tag">Outside target industries</span> : audit && !audit.ready ? <span className="tag">Limited creator evidence</span> : null}</div><h3>{asset.title}</h3>{audit?.matchedIndustries?.length ? <p><strong>Target industries:</strong> {audit.matchedIndustries.join(", ")}</p> : null}<details className="content-assessment"><summary>View creator fit & evidence</summary>{audit?.industryReason ? <p><strong>Industry fit:</strong> {audit.industryReason}</p> : null}{!audit || audit.matchedIndustries?.length ? <p>{audit?.reason || "AI has not assessed the evidence and creator potential of this page yet."}</p> : null}{audit?.angle ? <p><strong>Creator angle:</strong> {audit.angle}</p> : null}<details><summary>Source evidence</summary>{audit?.industryEvidence ? <><strong>Industry relevance</strong><blockquote>{audit.industryEvidence}</blockquote><strong>Creator potential</strong></> : null}<blockquote>{audit?.evidence || asset.summary?.slice(0,700) || "No readable evidence available."}</blockquote><p>AI assesses the supplied page text; it does not independently verify the brand’s claims.</p></details></details><a className="asset-url" href={asset.url} target="_blank" rel="noreferrer">Open source <ExternalLink size={14}/></a></div>
      <form action={select} onSubmit={()=>setNoticeMode("selection")}><input type="hidden" name="brandSlug" value={brandSlug}/><input type="hidden" name="assetId" value={asset.id}/><input type="hidden" name="eligible" value={asset.eligible ? "false" : "true"}/><button className="secondary-button" disabled={busy || (!asset.eligible && (active.length>=20 || audit?.industryReviewVersion!==2 || !audit?.industryVerified || !audit?.matchedIndustries?.length || !audit.ready || audit.score<70))}>{asset.eligible ? "Remove from active assets" : "Add to active assets"}</button></form>
    </article>;
  }
  if(migrationRequired) return <main className="page"><h1>Content assets</h1><p>Content storage is unavailable.</p></main>;
  return <main className="page content-page">
    <header className="page-header"><div className="page-header-copy"><div className="eyebrow">Quality before quantity</div><h1>Content assets</h1><p>Choose up to 20 strong pieces for creator matching.</p></div><div className="content-library-actions"><span className="status-pill success">{active.length} / 20 active</span><button className="primary-button" aria-haspopup="dialog" onClick={()=>setAdding(true)}><Plus size={18}/> Add content</button></div></header>
    <section className="surface surface-pad content-command"><div className="section-heading"><h2>Manage your library</h2><ActionHelp label="How content selection works">AI checks target-industry relevance before scoring research, case studies and original insights. Only active assets enter creator matching. Reselecting replaces your active selection; manually removed pages stay excluded. Scanning and assessment use provider and AI requests.</ActionHelp></div><div className="content-library-actions"><form action={curate} onSubmit={()=>setNoticeMode("curate")}><input type="hidden" name="brandSlug" value={brandSlug}/><button className="primary-button" disabled={busy || !total}>{curating ? "Assessing content and selecting…" : active.length ? "Reselect with AI" : "Let AI select up to 20"}</button></form><form action={scan} onSubmit={()=>{setBrowse(true);setNoticeMode("scan");}}><input type="hidden" name="brandSlug" value={brandSlug}/><button className="secondary-button" disabled={busy}>{scanning ? "Scanning and assessing…" : "Scan website & help guides"}</button></form><button className="secondary-button" aria-haspopup="dialog" aria-controls="content-library-drawer" onClick={openLibrary}>{`Browse library (${total})`}</button></div>{curating || scanning ? <p role="status">Reading and assessing page content. A large library can take several minutes; completed assessments are saved as they finish.</p> : null}</section>
    {notices.map((state,index)=><div key={index}>{state.error ? <p className="auth-error" role="alert">{state.error}</p> : null}{state.success ? <p className="save-success" role="status">{state.success}</p> : null}</div>)}
    <div className="section-heading"><h2>Active assets</h2><span>{active.length} / 20</span></div>
    {active.length>=20 ? <p className="coverage-warning">You have 20 active assets. Remove one before adding another.</p> : null}
    {active.length ? <div className="content-curated-list">{active.map(card)}</div> : <section className="surface empty-research"><h2>No active assets yet</h2><p>Let AI select the strongest pieces, or browse your library and choose them yourself.</p></section>}
    <dialog ref={libraryDialog} id="content-library-drawer" className="content-library-drawer" aria-labelledby="content-library-title" onCancel={()=>setBrowse(false)} onClose={()=>setBrowse(false)} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)setBrowse(false);}}}>
      <header className="content-library-drawer-header"><div><h2 id="content-library-title">Content library</h2><p>{total} saved pages · {active.length} / 20 active assets</p></div><button type="button" className="secondary-button" aria-label="Close library" onClick={()=>setBrowse(false)}><X size={18}/> Close</button></header>
      <div className="library-toolbar">
        <label className="field">Search library<input className="text-input" value={query} onChange={e=>{setQuery(e.target.value);setPage(1);}} placeholder="Search titles, URLs, topics or industries"/></label>
        <label className="field">Status<select className="text-input" value={filter} onChange={e=>{setFilter(e.target.value);setPage(1);}}><option value="all">All pages ({total})</option>{Object.entries(labels).map(([key,label])=><option key={key} value={key}>{label} ({result?.counts[key as keyof typeof result.counts] ?? "…"})</option>)}</select></label>
        <label className="field">Sort by<select className="text-input" value={options.sort || "score"} onChange={e=>option("sort",e.target.value)}><option value="score">Highest creator fit</option><option value="title">Title A–Z</option><option value="title-desc">Title Z–A</option></select></label>
        {([['type','Content type','types'],['industry','Matched industry','industries'],['source','Source website','sources']] as const).map(([key,label,facet])=><label className="field" key={key}>{label}<select className="text-input" value={options[key] || ""} onChange={e=>option(key,e.target.value)}><option value="">All</option>{result?.facets[facet].map(value=><option key={value} value={value}>{value}</option>)}</select></label>)}
        <label className="field">Minimum creator fit<select className="text-input" value={options.minScore || ""} onChange={e=>option("minScore",e.target.value)}><option value="">Any score</option><option value="70">70+ · Good</option><option value="80">80+ · Strong</option><option value="90">90+ · Exceptional</option></select></label>
        <div className="library-quick-filters"><span>Quick views</span>{[['ready','Ready to add'],['review','Needs assessment'],['active','Active assets']].map(([value,label])=><button type="button" className="secondary-button" aria-pressed={filter===value} key={value} onClick={()=>{resetFilters();setFilter(value);}}>{label}</button>)}<button type="button" className="secondary-button" onClick={resetFilters}>Clear filters</button></div>
        <p>Filters combine to narrow your library. Industry and score filters use assessed evidence; unassessed pages appear under Needs assessment.</p>
      </div>
      <section className="content-library-drawer-body">
        {scanning||scanningUrl?<p role="status">Scanning and assessing content. Results will appear here when ready.</p>:null}
        {notices.map((state,index)=><div key={index}>{state.error?<p className="auth-error" role="alert">{state.error}</p>:null}{state.success?<p className="save-success" role="status">{state.success}</p>:null}</div>)}
        {active.length>=20?<p className="coverage-warning">20 active assets. Remove one before adding another.</p>:null}
        {loading ? <p role="status">Loading library…</p> : null}{loadError ? <p role="alert">{loadError}</p> : null}<div className="library-results" aria-busy={loading}>{candidates.map(asset=>{
          const state=status(asset);const audit=asset.assessment;
          return <article className="library-row" key={asset.id}>
            <div className="tag-row"><span className={state==="active" ? "status-pill success" : "tag"}>{labels[state]}</span><span className="library-meta">{asset.contentType}{audit?.matchedIndustries?.length ? ` · ${audit.score}/100 creator fit` : ""}</span></div>
            <h3>{asset.title}</h3>
            {audit?.matchedIndustries?.length ? <p className="library-meta">{audit.matchedIndustries.join(", ")}</p> : null}
            <div className="library-row-actions"><a className="asset-url" href={asset.url} target="_blank" rel="noreferrer">Open source <ExternalLink size={14}/></a>
            {state==="active" || state==="ready" ? <form action={select} onSubmit={()=>setNoticeMode("selection")}><input type="hidden" name="brandSlug" value={brandSlug}/><input type="hidden" name="assetId" value={asset.id}/><input type="hidden" name="eligible" value={asset.eligible ? "false" : "true"}/><button className="secondary-button" disabled={busy || (!asset.eligible && active.length>=20)}>{asset.eligible ? "Remove from active" : "Add to active"}</button></form> : <span className="library-meta">{state==="review" ? "Needs AI assessment before adding" : "Does not meet selection criteria"}</span>}</div>
            <details><summary>View assessment</summary><p>{audit?.industryReason || "Industry fit has not been assessed."}</p>{audit?.reason ? <p>{audit.reason}</p>:null}{audit?.angle ? <p><strong>Creator angle:</strong> {audit.angle}</p>:null}{audit?.evidence ? <blockquote>{audit.evidence}</blockquote>:null}</details>
          </article>;
        })}</div>
        {!loading && result && !loadError && !candidates.length ? <div className="library-empty"><h3>No pages match this filter</h3><p>{filter==="ready" ? "There are no additional pages ready to add. You can still browse all saved pages and their assessments." : "Try another search or show all saved pages."}</p><button className="secondary-button" onClick={resetFilters}>Show all pages</button></div>:null}
      </section>
      <footer className="library-footer"><span role="status">{candidates.length ? `${(current-1)*10+1}–${Math.min(current*10,count)} of ${count} pages` : "0 pages"}</span>{pages>1 ? <nav aria-label="Content library pages"><button className="secondary-button" disabled={loading || current===1} onClick={()=>{setPage(current-1);libraryDialog.current?.querySelector(".content-library-drawer-body")?.scrollTo(0,0);}}>Previous</button><span>{current} / {pages}</span><button className="secondary-button" disabled={loading || current===pages} onClick={()=>{setPage(current+1);libraryDialog.current?.querySelector(".content-library-drawer-body")?.scrollTo(0,0);}}>Next</button></nav>:null}</footer>
    </dialog>
    <dialog ref={addDialog} className="content-library-drawer content-add-drawer" aria-labelledby="add-content-title" onCancel={()=>setAdding(false)} onClose={()=>setAdding(false)}>
      <header className="content-library-drawer-header"><div><h2 id="add-content-title">Add content</h2><p>Bring your strongest work into the library.</p></div><button type="button" className="secondary-button" onClick={()=>setAdding(false)}><X size={18}/> Close</button></header>
      <section className="content-library-drawer-body"><p>Paste a public article, case study or report URL. We’ll read the page and assess its industry relevance and creator potential before you choose whether to activate it.</p><form action={scanUrl} className="add-content-form" onSubmit={()=>setNoticeMode("url")}><input type="hidden" name="brandSlug" value={brandSlug}/><label className="field">Content URL<input className="text-input" name="url" type="url" placeholder="https://example.com/case-study" required/></label><button className="primary-button" disabled={busy}>{scanningUrl ? "Reading and assessing…" : "Save & assess content"}</button></form>{scanningUrl ? <p role="status">This can take a minute. Your page will be saved in the library.</p> : null}{urlState.error ? <p role="alert" className="auth-error">{urlState.error}</p>:null}{urlState.success ? <><p role="status" className="save-success">{urlState.success}</p><button className="secondary-button" onClick={()=>{setAdding(false);openLibrary();}}>Browse library</button></>:null}</section>
    </dialog>
  </main>;
}
