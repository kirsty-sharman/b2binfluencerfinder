import Link from "next/link";
import { ArrowRight, Pencil, Play } from "lucide-react";
import type { BrandOverviewData } from "@/lib/brand-types";

export function BrandOverview({ brand }: { brand: BrandOverviewData }) {
  const base = `/app/brands/${brand.slug}`;
  const run = brand.latestRun;
  const highlights = [
    {label:"Active content assets",value:brand.metrics[1]?.value || "0",href:"content"},
    {label:"Matched creators",value:brand.metrics[2]?.value || "0",href:"creators"},
    {label:"Shortlisted creators",value:brand.metrics[3]?.value || "0",href:"shortlists"},
  ];
  return <main className="page brand-dashboard">
    <header className="page-header"><div className="page-header-copy"><div className="eyebrow">Overview</div><h1>{brand.name}</h1></div><div className="page-actions"><Link className="secondary-button" href={`${base}/creators`}>Review creators</Link><Link className="primary-button" href={`${base}/runs`}><Play size={14}/> Find more creators</Link></div></header>
    <section className="dashboard-highlights" aria-label="Workspace highlights">{highlights.map(item=><Link className="surface dashboard-highlight" href={`${base}/${item.href}`} key={item.href}><span>{item.label}</span><strong>{item.value}</strong><ArrowRight size={18} aria-hidden="true"/></Link>)}</section>
    <div className="dashboard-panels">
      <section className="surface dashboard-panel"><header><h2>Latest discovery run</h2><Link href={`${base}/runs`}>All runs <ArrowRight size={14}/></Link></header>{run ? <><div className="dashboard-run-title"><span className={`status-pill run-${run.status}`}>{run.status === "ready" ? "Completed" : run.status === "failed" ? "Needs attention" : run.status}</span><h3>{run.name}</h3></div><div className="dashboard-run-stats"><div><strong>{run.queries}</strong><span>Searches planned</span></div><div><strong>{run.posts}</strong><span>Evidence items</span></div><div><strong>{run.profiles}</strong><span>Profiles collected</span></div></div><footer>{run.status==="failed" ? <p>This run needs attention. Open it to see what happened.</p> : <p>Open the run for results and progress.</p>}<Link className="secondary-button" href={`${base}/runs/${run.id}`}>{run.status==="failed" ? "Review run" : "View run"}<ArrowRight size={14}/></Link></footer></> : <div className="dashboard-empty"><h3>Your first discovery run starts here.</h3><p>Add your industries and active content, then generate a search plan.</p><Link className="secondary-button" href={`${base}/runs`}>Plan a run <ArrowRight size={14}/></Link></div>}</section>
      <section className="surface dashboard-panel"><header><h2>Brand focus</h2><Link className="secondary-button" href={`${base}/profile`}><Pencil size={14}/> Edit focus</Link></header><div className="dashboard-focus"><span className="dashboard-label">Target industries</span><div className="tag-row">{brand.industries.length ? brand.industries.map(industry=><span className="tag" key={industry}>{industry}</span>) : <p>No target industries selected.</p>}</div><span className="dashboard-label">About your brand</span><p className="dashboard-brand-summary">{brand.summary}</p><Link className="text-link" href={`${base}/profile`}>View full brand profile <ArrowRight size={14}/></Link></div></section>
    </div>
  </main>;
}
