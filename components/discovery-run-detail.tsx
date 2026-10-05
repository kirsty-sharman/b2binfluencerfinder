"use client";

import { audienceChannels, filtersFor, evidenceLabels } from "@/lib/channels/filters";
import { channelNames, type Channel } from "@/lib/channels/core";
import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, LoaderCircle, Play, RotateCcw } from "lucide-react";
import { startDiscoveryRun, recheckDiscoveryQuality, type DiscoveryActionState } from "@/app/app/brands/discovery-actions";
import type { DiscoveryRunDetail } from "@/lib/discovery";

const initialState: DiscoveryActionState = {};

export function DiscoveryRunView({ run, providers }: { run: DiscoveryRunDetail; providers: { dataForSeo: boolean; brightData: boolean; channels: Array<{channel:Channel;ready:boolean;requirement:string}> } }) {
  const [state, action, pending] = useActionState(startDiscoveryRun, initialState);
  const [qualityState,qualityAction,qualityPending]=useActionState(recheckDiscoveryQuality,initialState);
  const router = useRouter();
  const unavailable = providers.channels.filter(c=>(run.config.channels || ["linkedin"]).includes(c.channel) && !c.ready);
  const resumable = run.resumable;
  const editable = ["draft","failed"].includes(run.status) || Boolean(resumable);
  const active = ["queued", "running"].includes(run.status);
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => router.refresh(), 4000);
    return () => window.clearInterval(timer);
  }, [active, router]);
  return (
    <main className="page">
      <header className="page-header"><div className="page-header-copy"><Link className="text-link" href={`/app/brands/${run.brandSlug}/runs`}>← Search runs</Link><h1>{run.status === "draft" ? "Review your search settings" : active ? "Search in progress" : run.status === "failed" ? "Search needs attention" : "Search results"}</h1><p>{run.name}</p></div><Link className="primary-button" href={`/app/brands/${run.brandSlug}/runs#new-search`}>New influencer search</Link></header>
      <section className="surface surface-pad search-next"><div><h2>{run.status === "draft" ? "Your search plan is ready" : active ? "We’re looking for relevant creators" : run.status === "failed" ? "Some work could not finish" : "Review your matched creators"}</h2><p>{run.status === "draft" ? "Check your settings and planned searches below. When you’re happy, approve to start finding influencers." : active ? "Progress updates automatically. You can leave this page and return later." : run.status === "failed" ? "Completed work is saved. Review the channel status below and retry the unfinished work." : "Creators with a strong content match are available on the Creators page."}</p></div><div className="page-actions">{editable ? <button className="primary-button" form="search-execution" disabled={pending || Boolean(unavailable.length)}>{pending ? "Queuing…" : run.status === "draft" ? "Approve and start search" : "Retry / resume search"}</button> : null}<Link className="secondary-button" href={`/app/brands/${run.brandSlug}/creators`}>View creators</Link></div></section>
      <section className="run-summary-grid"><div className="surface surface-pad"><span>Status</span><strong className={`status-pill run-${run.status}`}>{run.status}</strong></div><div className="surface surface-pad"><span>Evidence items</span><strong>{run.uniqueContentCount}</strong></div><div className="surface surface-pad"><span>Profiles</span><strong>{run.profileCount}</strong></div><div className="surface surface-pad"><span>Provider cost</span><strong>${run.providerCost.toFixed(4)}</strong></div></section>
      <details className="surface surface-pad run-filter-summary search-disclosure" open={run.status === "draft"}><summary>Search settings</summary>{run.config.focus ? <p><strong>Search focus:</strong> {run.config.focus}</p> : null}<p>{run.config.maxProfiles} candidates per selected channel · Industries: {run.industries.join(", ")}</p><ul>{(run.config.channels||["linkedin"]).map(channel=>{const f=filtersFor(run.config,channel);return <li key={channel}><strong>{channelNames[channel]}</strong>: {evidenceLabels[channel]} — {f.evidenceLimit}; content from the last {f.publishedWithinDays} days.{audienceChannels.includes(channel)?` ${channel==="youtube"?"Subscribers":"Followers"}: ${f.minAudience??"no minimum"} to ${f.maxAudience??"no maximum"}; unknown audience ${f.includeUnknownAudience?"included":"excluded"}.`:" Audience size is not filtered."}</li>})}</ul><p>Only candidates with recent industry evidence and a strong active-content match can qualify.</p></details>
      {run.errorMessage ? <div className="auth-error run-error"><AlertCircle size={17} /><span>{run.errorMessage}</span></div> : null}
      {Boolean(unavailable.length) && editable ? <div className="migration-notice surface surface-pad"><h2>Provider credentials required</h2><p>{unavailable.map(c=>`${channelNames[c.channel]}: ${c.requirement}`).join(". ")}</p></div> : null}
      {run.channelJobs?.length ? <section className="surface surface-pad search-channel-progress"><h2>Channel progress</h2>{run.channelJobs.map(job=><div className="stage-row" key={job.channel}><strong>{channelNames[job.channel]}</strong><span>{job.status} · {job.candidate_count} candidates · {job.qualified_count} qualified</span>{job.error_message?<em>{job.error_message}</em>:null}</div>)}</section>:null}
      <details className="search-disclosure surface surface-pad" open={run.status === "draft"}><summary>{run.status === "draft" ? "Review planned searches" : "Search queries"} ({run.queryCount})</summary>
      <p>{run.config.queryPlanning ? "AI translated your brand, industries and content into search topics. These are suggestions, not measured search trends. Uncheck any you don’t want to run." : "This run uses the older keyword templates. Create a new run to generate an AI-assisted search plan."}</p>
      <form action={action} id="search-execution">
        <input type="hidden" name="brandSlug" value={run.brandSlug} /><input type="hidden" name="runId" value={run.id} />
        <section className="surface query-list">{run.queries.map((query) => <label className="query-row" key={query.id}><input defaultChecked={query.approved} disabled={!(editable)} name="approvedQueryId" type="checkbox" value={query.id} /><div><strong>{channelNames[query.channel]} · {run.config.queryPlanning?.explanations.find(e=>e.channel===query.channel && e.query===query.query)?.intent || query.industry}</strong><p>Target industry: {query.industry}</p>{run.config.queryPlanning?.explanations.filter(e=>e.channel===query.channel && e.query===query.query).map(e=><div key={e.query}><p>{e.reason}</p><small>{e.angle === "industry expertise" ? "Discover industry experts" : "Explore a content topic"}{e.assetId ? ` · Content: ${run.config.queryPlanning?.assets.find(a=>a.id===e.assetId)?.title || "Active asset"}` : ""}</small></div>)}<code>{query.query}</code>{query.error ? <em>{query.error}</em> : null}</div><span className={`status-pill query-${query.status}`}>{query.status}{query.resultCount ? ` · ${query.resultCount}` : ""}</span></label>)}</section>
        {state.error ? <div className="auth-error" role="alert">{state.error}</div> : null}{state.success ? <div className="save-success" role="status">{state.success}</div> : null}
        {editable ? <div className="run-start-bar"><div><strong>{run.status === "failed" ? "Retry safely" : "Ready to start?"}</strong><span>Completed work is saved; retries resume unfinished work.</span></div><button className="primary-button" disabled={pending || Boolean(unavailable.length)} type="submit">{run.status === "failed" ? <RotateCcw size={15} /> : <Play size={15} />}{pending ? "Queuing…" : resumable ? "Resume interrupted run" : run.status === "failed" ? "Retry failed run" : "Approve queries and start"}</button></div> : null}
      </form>
      </details>
      <details className="surface surface-pad search-disclosure"><summary>Technical details & collected candidates</summary>
      {run.stages.length ? <><div className="section-heading"><h2>LinkedIn collection pipeline</h2><span>{active ? "Updates automatically" : "Checkpointed stages"}</span></div>
      <section className="surface stage-list">{run.stages.map((stage, index) => <div className="stage-row" key={stage.id}><span className={`stage-icon ${stage.status}`}>{stage.status === "completed" ? <Check /> : stage.status === "running" ? <LoaderCircle className="spin" /> : stage.status === "failed" ? <AlertCircle /> : index + 1}</span><div><strong>{stage.label}</strong><span>{stage.provider || "Internal"}{stage.requestId ? ` · ${stage.requestId}` : ""}</span>{stage.error ? <em>{stage.error}</em> : null}</div><div className="stage-metrics"><span>{stage.itemCount} records</span>{stage.cost ? <span>${stage.cost.toFixed(4)}</span> : null}</div></div>)}</section></>:null}
      {run.collectedCandidates?.length ? <form action={qualityAction}><input type="hidden" name="brandSlug" value={run.brandSlug}/><input type="hidden" name="runId" value={run.id}/><button className="secondary-button" disabled={qualityPending || active}>{qualityPending ? "Checking evidence…" : "Recheck quality from saved evidence"}</button>{qualityState.error||qualityState.success?<p role="status">{qualityState.error||qualityState.success}</p>:null}</form>:null}
      {run.collectedCandidates?.length ? <details className="surface surface-pad"><summary>Review collected candidates ({run.collectedCandidates.length})</summary>{run.collectedCandidates.map(c=><article key={c.channel+c.url} className="surface-pad"><h3><a href={c.url} target="_blank" rel="noreferrer">{c.name}</a> · {channelNames[c.channel]}</h3><p>{c.qualification.qualified ? "Passed quality checks" : "Not qualified"}: {c.qualification.reason || "Awaiting assessment"}</p><ul>{c.evidence.slice(0,10).map((e,i)=><li key={e.url+i}><a href={e.url} target="_blank" rel="noreferrer">{e.title || "Source content"}</a> · {e.publishedAt || "Publication date unavailable"}</li>)}</ul></article>)}</details> : null}
      </details>
    </main>
  );
}
