"use client";

import { type Channel } from "@/lib/channels/core";
import Link from "next/link";
import { DiscoveryRunPlanner } from "./discovery-run-planner";
import { ArrowRight, Search } from "lucide-react";
import type { DiscoveryRunSummary } from "@/lib/discovery";


export function DiscoveryRuns({ brandSlug, runs, industries, eligibleAssets, migrationRequired, channels }: { brandSlug: string; runs: DiscoveryRunSummary[]; industries: string[]; eligibleAssets: number; migrationRequired: boolean; channels: Array<{channel:Channel;label:string;ready:boolean;requirement:string}> }) {
  const ready = industries.length > 0 && eligibleAssets > 0;
  return (
    <main className="page">
      <header className="page-header"><div className="page-header-copy"><h1>Search runs</h1><p>Find more influencers for your brand. Start a new search or check a previous one.</p></div><Link className="secondary-button" href={`/app/brands/${brandSlug}/creators`}>View creators <ArrowRight size={15}/></Link></header>
      {migrationRequired ? <section className="surface surface-pad migration-notice"><h2>Database update required</h2><p>Apply migration <code>202609260005_discovery_runs.sql</code> before creating a run.</p></section> : (
        <>
          {ready ? <section id="new-search" className="surface surface-pad run-config search-launch"><header><span className="search-step">NEW SEARCH</span><h2><Search size={20}/> Find more influencers</h2><p>Choose your channels, start searching, then review your settings before the search runs.</p></header><DiscoveryRunPlanner brandSlug={brandSlug} industries={industries} channels={channels}/></section> : <section className="surface surface-pad"><h2>Set up your search</h2><p>Add target industries and at least one active content asset so we can find relevant creators.</p><div className="page-actions"><Link className="secondary-button" href={`/app/brands/${brandSlug}/profile`}>Set target industries</Link><Link className="secondary-button" href={`/app/brands/${brandSlug}/content`}>Choose content assets</Link></div></section>}
          <div className="section-heading"><h2>Previous searches</h2><span>{runs.length} total</span></div>
          <section className="surface research-list">{runs.length ? runs.map((run) => <Link className="run-history-row" href={`/app/brands/${brandSlug}/runs/${run.id}`} key={run.id}><span className={`status-pill run-${run.status}`}>{run.status === "failed" ? "Needs attention" : run.status === "draft" ? "Ready to review" : run.status}</span><div><strong>{run.name}</strong><span>{run.createdAt.slice(0, 16).replace("T", " ")} UTC · {run.queryCount} queries</span></div><div className="run-history-metrics"><span>{run.uniqueContentCount} evidence items</span><span>{run.profileCount} profiles</span></div><ArrowRight size={15} /></Link>) : <div className="empty-research"><h2>No searches yet</h2><p>Your first saved plan will appear here before discovery searches begin.</p></div>}</section>
        </>
      )}
    </main>
  );
}
