"use client";

import { rejectionReasons } from "@/lib/creator-admission";
import { isNewCreator } from "@/lib/creator-queue";
import { channelNames } from "@/lib/channels/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { checkCreatorSearchStatus, refillCreatorQueue } from "@/app/app/brands/creator-agent-actions";
import { Fragment, useActionState, useEffect, useMemo, useState } from "react";
import { ArrowRight, BrainCircuit, Download, ExternalLink, Filter, Info, Search, Sparkles, Users } from "lucide-react";
import { saveCreatorDecision, refreshMatchSuggestions, startSemanticAnalysis, type ReviewActionState } from "@/app/app/brands/review-actions";
import type { CreatorResult } from "@/lib/matching";

type Filters = { query: string; industry: string; eligibility: string; review: string; impact: string; minFollowers: string; maxFollowers: string; geography: string; minEvidence: string; asset: string };
const initialState: ReviewActionState = {};

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatFollowers(value: number | null) {
  if (value === null) return "Unknown";
  return new Intl.NumberFormat("en", { notation: value >= 10000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function escapeCsv(value: unknown) {
  const string = String(value ?? "");
  return `"${string.replaceAll('"', '""')}"`;
}

function Help({ label, children }: { label: string; children: React.ReactNode }) {
  return <details className="creator-help"><summary aria-label={label}><Info size={15}/></summary><div role="note">{children}</div></details>;
}

function CreatorDecision({ brandSlug, creator }: { brandSlug: string; creator: CreatorResult }) {
  const [state, action, pending] = useActionState(saveCreatorDecision, initialState);
  return <form action={action} className="creator-decision" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
    <input type="hidden" name="brandSlug" value={brandSlug} /><input type="hidden" name="creatorId" value={creator.id} />
    <span className={`review-pill ${creator.reviewStatus}`}>{creator.reviewStatus === "pending" ? "To review" : creator.reviewStatus === "accepted" ? "Shortlisted" : creator.reviewStatus === "maybe" ? "Saved for later" : creator.reviewStatus}</span>
    <div className="creator-decision-buttons">
      {creator.reviewStatus !== "accepted" && <button className="secondary-button shortlist-button" name="decision" value="accepted" disabled={pending || !creator.eligible}>{pending ? "Saving…" : "Shortlist"}</button>}
      <details className="decision-menu"><summary aria-label={`Change decision for ${creator.name}`}>•••</summary><div>{([["pending","Back to review"],["maybe","Save for later"],] as const).filter(([value]) => value !== creator.reviewStatus).map(([value,label]) => <button key={value} name="decision" value={value} disabled={pending}>{label}</button>)}</div></details>
    </div>
    {!creator.eligible ? <small>Needs quality recheck</small> : null}
    <details><summary>Reject with feedback</summary><select name="reason" aria-label="Rejection reason"><option value="">Choose a reason</option>{rejectionReasons.map(reason=><option key={reason}>{reason}</option>)}</select><button name="decision" value="rejected" disabled={pending}>Reject creator</button></details>
    {state.error ? <span className="auth-error" role="alert">{state.error}</span> : null}
    {creator.reviewStatus === "accepted" ? <Link className="text-link" href={`/app/brands/${brandSlug}/shortlists`}>View shortlist →</Link> : null}
    {state.success ? <span className="save-success" role="status">{state.success}</span> : null}
  </form>;
}

export function CreatorResults({ brandSlug, creators, targetIndustries, assets, migrationRequired, semanticMigrationRequired, initialFilters }: { brandSlug: string; creators: CreatorResult[]; targetIndustries: string[]; assets: Array<{ id: string; title: string }>; shortlists: Array<{ id: string; name: string }>; migrationRequired: boolean; semanticMigrationRequired: boolean; initialFilters: Partial<Filters> & { creatorId?: string } }) {
  const [filters, setFilters] = useState<Filters>({ query: "", industry: "all", eligibility: "eligible", review: "pending", impact: "all", minFollowers: "", maxFollowers: "", geography: "", minEvidence: "0", asset: "all", ...initialFilters });
  const [selectedId, setSelectedId] = useState(initialFilters.creatorId || "");
  const router = useRouter();
  const [now, setNow] = useState(0);
  const [page, setPage] = useState(0);
  useEffect(()=>{ const update=()=>setNow(Date.now()); const first=setTimeout(update,0); const tick=setInterval(update,60000); return ()=>{clearTimeout(first);clearInterval(tick);}; },[]);

  const [agent, setAgent] = useState<{message:string;running?:boolean}>({message:"Checking your saved creators…"});
  const waitingCount = creators.filter(c=>c.eligible && c.reviewStatus==="pending").length;
  useEffect(()=>{
    if (waitingCount >= 10) return;
    let cancelled=false;
    refillCreatorQueue(brandSlug).then(result=>{if(!cancelled)setAgent(result);}).catch(()=>{if(!cancelled)setAgent({message:"Unable to check refills. Your saved creators are available."});});
    return ()=>{cancelled=true;};
  },[brandSlug,waitingCount]);
  useEffect(()=>{
    if(!agent.running)return;
    let cancelled = false;
    let pending = false;
    const timer = setInterval(async () => {
      if (pending || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const result = await checkCreatorSearchStatus(brandSlug);
        if (!cancelled && !result.running) {
          setAgent(result);
          router.refresh();
        }
      } catch { /* Retry the read-only status check on the next interval. */ } finally { pending = false; }
    }, 60000);
    return () => { cancelled = true; clearInterval(timer); };
  },[agent.running,brandSlug,router]);
  const [sort, setSort] = useState("impact-desc");
  const [channel, setChannel] = useState("all");
  const [refreshState, refreshAction, refreshing] = useActionState(refreshMatchSuggestions, initialState);
  const [analysisState, analysisAction, analysing] = useActionState(startSemanticAnalysis, initialState);

  function updateFilter(name: keyof Filters, value: string) {
    const next = { ...filters, [name]: value };
    setFilters(next);
    setPage(0);
    const params = new URLSearchParams();
    Object.entries(next).forEach(([key, item]) => { if (item && !["all", "0"].includes(item) && !(key === "eligibility" && item === "eligible")) params.set(key, item); });
    window.history.replaceState(null, "", `${window.location.pathname}${params.size ? `?${params}` : ""}`);
  }

  const filtered = useMemo(() => creators.filter((creator) => {
    if (channel !== "all" && !creator.channels.some(item => item.channel === channel)) return false;
    const haystack = `${creator.name} ${creator.headline} ${creator.location} ${creator.industries.join(" ")} ${creator.bestMatch?.assetTitle || ""}`.toLowerCase();
    if (filters.query && !haystack.includes(filters.query.toLowerCase())) return false;
    if (filters.industry !== "all" && !creator.industries.includes(filters.industry)) return false;
    if (filters.eligibility === "eligible" && !creator.eligible) return false;
    if (filters.eligibility === "ineligible" && creator.eligible) return false;
    if (filters.review === "all" && creator.reviewStatus === "rejected") return false;
    if (filters.review !== "all" && creator.reviewStatus !== filters.review) return false;
    if (filters.impact !== "all" && creator.bestMatch?.impact !== Number(filters.impact)) return false;
    if (filters.minFollowers && (creator.followers ?? -1) < Number(filters.minFollowers)) return false;
    if (filters.maxFollowers && (creator.followers ?? Number.POSITIVE_INFINITY) > Number(filters.maxFollowers)) return false;
    if (filters.geography && !creator.location.toLowerCase().includes(filters.geography.toLowerCase())) return false;
    if (creator.evidenceCount < Number(filters.minEvidence || 0)) return false;
    if (filters.asset !== "all" && !creator.matches.some((match) => match.assetId === filters.asset)) return false;
    return true;
  }).sort((a,b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    const direction = sort.endsWith("asc") ? 1 : -1;
    const value = (item: CreatorResult) => sort.startsWith("audience") ? item.followers : sort.startsWith("evidence") ? item.evidenceCount : item.bestMatch?.impact ?? null;
    const av = value(a), bv = value(b);
    if (av == null) return bv == null ? a.name.localeCompare(b.name) : 1;
    if (bv == null) return -1;
    return (av-bv)*direction || a.name.localeCompare(b.name);
  }), [creators, filters, sort, channel]);
  const currentPage = Math.min(page,Math.max(0,Math.ceil(filtered.length/20)-1));
  const coverage = targetIndustries.map((industry) => ({ industry, creators: creators.filter((creator) => creator.eligible && creator.industries.includes(industry)).length }));
  const missingCoverage = coverage.filter((item) => item.creators === 0);

  function exportCsv() {
    const header = ["Creator", "Headline", "Location", "Followers", "Eligible", "Evidence", "Industries", "Matched asset", "Suggested impact", "Creator decision", "Profile URL"];
    const rows = filtered.map((creator) => [creator.name, creator.headline, creator.location, creator.followers, creator.eligible, creator.evidenceCount, creator.industries.join("; "), creator.bestMatch?.assetTitle || "", creator.bestMatch?.impact || "", creator.reviewStatus, creator.linkedinUrl]);
    const blob = new Blob([[header, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${brandSlug}-creators.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (migrationRequired) return (
    <main className="page">
      <div className="page-header"><div className="page-header-copy"><div className="eyebrow">Matching & review</div><h1>Creators</h1><p>The interface is ready. Apply the Slice 4 migration to create matches, decisions, shortlists, and evidence records.</p></div></div>
      <div className="surface migration-card"><Sparkles /><div><strong>Database update required</strong><p>Run <code>supabase/migrations/202609260006_matching_review.sql</code> in Supabase, then refresh this page.</p></div></div>
    </main>
  );

  return (
    <main className="page creator-page">
      <div className="page-header creator-header">
        <div className="page-header-copy"><div className="eyebrow">Evidence-backed candidates</div><h1>Creators</h1><p>Review your matches. Shortlist the people you want to work with.</p></div>
        <div className="page-actions"><Link className="secondary-button" href={`/app/brands/${brandSlug}/shortlists`}>View shortlist</Link><Link className="primary-button" href={`/app/brands/${brandSlug}/runs`}>Find more creators <ArrowRight size={15}/></Link></div>
      </div>

      <div className="creator-summary-strip"><span><strong>{creators.length}</strong> Creators</span><span><strong>{creators.filter(item => item.reviewStatus === "pending").length}</strong> To review</span><span><strong>{creators.filter(item => item.reviewStatus === "accepted").length}</strong> Shortlisted</span></div>
      {creators.some(c=>!c.eligible) ? <p role="status">Some saved candidates need rechecking against the new quality rules. They are excluded from eligible results; existing shortlists are preserved.</p> : null}
      <p className="creator-agent-status" role="status"><Sparkles size={15}/>{waitingCount >= 10 ? `${waitingCount} creators ready to review. Saved matches are used first.` : agent.message}<Help label="About automatic refills">Refills start below 10 waiting creators while you use this page. Saved matches come first. New searches are limited to once per 24 hours and 10 per rolling 30 days per brand. An automatic refill assesses up to 5 candidates per channel using up to 6 saved queries. No new matches pauses refills.</Help></p>
      <details className="creator-tools surface"><summary>Content tools & industry coverage</summary><div className="creator-tool-actions">
      <div><form action={analysisAction}><input type="hidden" name="brandSlug" value={brandSlug}/><button className="secondary-button" disabled={analysing || semanticMigrationRequired}><BrainCircuit size={15}/>{analysing ? "Queuing…" : "Analyse evidence"}</button></form><Help label="About evidence analysis">Uses AI to assess saved content matches. Queues unanalysed or failed matches; AI usage may incur costs. It does not search for new creators.</Help></div>
      <div><form action={refreshAction}><input type="hidden" name="brandSlug" value={brandSlug}/><button className="secondary-button" disabled={refreshing}>{refreshing ? "Generating…" : "Refresh content matches"}</button></form><Help label="About refreshing matches">Generates content suggestions from your saved creators and active brand content. Use after updating your content library.</Help></div>
      </div>
      {semanticMigrationRequired ? <div className="coverage-warning"><strong>Semantic analysis is ready:</strong> apply <code>202609260007_semantic_matching.sql</code> to enable the evidence auditor.</div> : null}
      {analysisState.error ? <p className="auth-error">{analysisState.error}</p> : null}{analysisState.success ? <p className="save-success">{analysisState.success}</p> : null}

      <section className="industry-coverage" aria-label="Target industry coverage">
        <div><strong>Target-market coverage</strong><span>Qualified creators with attributed evidence</span></div>
        {coverage.map((item) => <button type="button" className={`${item.creators ? "covered" : "missing"}${filters.industry === item.industry ? " active" : ""}`} key={item.industry} onClick={() => updateFilter("industry", filters.industry === item.industry ? "all" : item.industry)}><span>{item.industry}</span><strong>{item.creators}</strong></button>)}
      </section>
      {missingCoverage.length ? <p className="coverage-warning">No eligible creators yet for {missingCoverage.map(item => item.industry).join(", ")}. <Link href={`/app/brands/${brandSlug}/runs`}>Search for more →</Link></p> : null}
      </details>


          <section className="surface creator-filters" aria-label="Creator filters">
            <label className="filter-search"><Search size={15} /><input value={filters.query} onChange={(event) => updateFilter("query", event.target.value)} placeholder="Search creators, focus, industry…" aria-label="Search creators" /></label>
            <label><span>Industry</span><select value={filters.industry} onChange={(event) => updateFilter("industry", event.target.value)}><option value="all">All industries</option>{targetIndustries.map((industry) => <option key={industry} value={industry}>{industry}</option>)}</select></label>
            <label><span>Status</span><select value={filters.review} onChange={(event) => updateFilter("review", event.target.value)}><option value="all">All except rejected</option><option value="pending">To review</option><option value="maybe">Saved for later</option><option value="accepted">Shortlisted</option><option value="rejected">Rejected</option></select></label>
            <label><span>Channel</span><select value={channel} onChange={event => {setChannel(event.target.value);setPage(0);}}><option value="all">All channels</option>{Object.entries(channelNames).map(([key,name]) => <option key={key} value={key}>{name}</option>)}</select></label>
            <details className="more-filters"><summary><Filter size={14} /> More filters</summary><div>            <label><span>Eligibility</span><select value={filters.eligibility} onChange={(event) => updateFilter("eligibility", event.target.value)}><option value="eligible">Eligible</option><option value="all">All</option><option value="ineligible">Ineligible</option></select></label>

            <label><span>Impact</span><select value={filters.impact} onChange={(event) => updateFilter("impact", event.target.value)}><option value="all">Any score</option>{[5,4,3,2,1].map((score) => <option key={score} value={score}>{score}/5</option>)}</select></label>
            <label><span>Min evidence</span><select value={filters.minEvidence} onChange={(event) => updateFilter("minEvidence", event.target.value)}>{[0,1,2,3,5].map((count) => <option key={count} value={count}>{count === 0 ? "Any" : `${count}+`}</option>)}</select></label>
            <label><span>Matched asset</span><select value={filters.asset} onChange={(event) => updateFilter("asset", event.target.value)}><option value="all">All assets</option>{assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.title}</option>)}</select></label>
<label><span>Location</span><input value={filters.geography} onChange={(event) => updateFilter("geography", event.target.value)} placeholder="e.g. London" /></label><label><span>Min followers</span><input type="number" value={filters.minFollowers} onChange={(event) => updateFilter("minFollowers", event.target.value)} /></label><label><span>Max followers</span><input type="number" value={filters.maxFollowers} onChange={(event) => updateFilter("maxFollowers", event.target.value)} /></label></div></details>
          </section>

          <div className="creator-list-toolbar"><span><strong>{filtered.length}</strong> creators shown <button type="button" className="text-link" onClick={() => {setFilters({query:"",industry:"all",eligibility:"eligible",review:"all",impact:"all",minFollowers:"",maxFollowers:"",geography:"",minEvidence:"0",asset:"all"});setChannel("all");window.history.replaceState(null,"",window.location.pathname);}}>Reset filters</button></span><div><label>Sort by <select value={sort} onChange={event => {setSort(event.target.value);setPage(0);}}><option value="impact-desc">Impact: high to low</option><option value="impact-asc">Impact: low to high</option><option value="audience-desc">Audience: largest first</option><option value="audience-asc">Audience: smallest first</option><option value="evidence-desc">Evidence: most first</option><option value="evidence-asc">Evidence: least first</option><option value="name">Name: A–Z</option></select></label><button className="secondary-button" onClick={exportCsv} disabled={!filtered.length}><Download size={14}/>Export</button><Help label="About export">Downloads the currently filtered and sorted creators as a CSV file.</Help></div></div>
          <div className="creator-workspace creator-workspace-full">
            <section className="surface creator-table-wrap">
              {filtered.length ? <table className="creator-table"><thead><tr><th>Creator</th><th>Decision <Help label="About shortlisting">Shortlist adds the creator and their best eligible content match to Accepted creators. No message is sent. Use ••• to save for later, reject or reset a decision; this removes them from Accepted creators.</Help></th><th>Focus</th><th>Audience</th><th>Evidence</th><th>Best asset match</th><th>Content fit <Help label="About content fit">Suggested content collaboration score out of 5. Open matches to review the supporting explanation.</Help></th><th>Matches</th></tr></thead><tbody>{filtered.slice(currentPage*20,currentPage*20+20).map((creator) => <Fragment key={creator.id}><tr><td><div className="creator-identity"><span className="creator-avatar">{initials(creator.name)}</span><div><strong>{creator.name} {isNewCreator(creator.firstAvailableAt, now) ? <span className="creator-new">New</span> : null}</strong><span>{creator.location}</span><div className="tag-row">{creator.channels.map(c=><a key={c.channel+c.url} className="tag" href={c.url} target="_blank" rel="noreferrer">{channelNames[c.channel]}</a>)}</div><a className="creator-profile-link" href={creator.linkedinUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>View profile <ExternalLink size={11} /></a></div></div></td><td><CreatorDecision brandSlug={brandSlug} creator={creator} /></td><td><span className="clamp-two">{creator.headline}</span><div className="table-industry-tags">{creator.industries.slice(0, 2).map((industry) => <span key={industry}>{industry}</span>)}{creator.eligible ? <span className="ai-checked">Quality checked</span> : null}</div></td><td>{formatFollowers(creator.followers)}</td><td><strong>{creator.evidenceCount}</strong><span className="table-sub"> items</span></td><td><span className="clamp-two">{creator.bestMatch?.assetTitle || "No suggestion yet"}</span></td><td>{creator.bestMatch ? <span className="impact-score">{creator.bestMatch.impact}<small>/5</small></span> : "—"}</td><td><button className="secondary-button" type="button" aria-expanded={selectedId === creator.id} aria-controls={`matches-${creator.id}`} onClick={() => setSelectedId(selectedId === creator.id ? "" : creator.id)}>{selectedId === creator.id ? "Close" : "Review"}</button></td></tr>{selectedId === creator.id ? <tr id={`matches-${creator.id}`} className="creator-matches-row"><td colSpan={8}><section aria-label={`Content matches for ${creator.name}`}><h3>Content matches for {creator.name}</h3>{creator.matches.map((match) => <div className="creator-content-match" key={match.id}><strong>{match.assetTitle}</strong><p><span className={`review-pill ${match.status}`}>{match.status}</span> · {match.impact}/5 suggested impact</p><p>{match.explanation}</p><Link className="secondary-button" href={`/app/brands/${brandSlug}/creators/matches/${match.id}`}>View content details <ArrowRight size={15} /></Link></div>)}</section></td></tr> : null}</Fragment>)}</tbody></table> : <div className="empty-filter-state"><Users size={24} /><h3>{creators.length ? "No creators match these filters" : "No creators with content matches yet"}</h3><p>{creators.length ? "Broaden your filters to see creators with content matches." : "Creators appear here once they have a saved match to eligible brand content."}</p></div>}
            </section>
            {filtered.length>20 && <div className="creator-list-toolbar"><span>Page {currentPage+1} of {Math.ceil(filtered.length/20)} · All saved creators remain available</span><div><button className="secondary-button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>Previous</button><button className="secondary-button" disabled={(currentPage+1)*20>=filtered.length} onClick={()=>setPage(currentPage+1)}>Next</button></div></div>}
          </div>


      {refreshState.error ? <p className="auth-error" role="alert">{refreshState.error}</p> : null}
      {refreshState.success ? <p className="save-success">{refreshState.success}</p> : null}
    </main>
  );
}
