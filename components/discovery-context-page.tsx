import Link from "next/link";
import { Search, ShieldCheck, Sparkles } from "lucide-react";

type DiscoveryContextPageProps = {
  brandSlug: string;
  title: string;
  description: string;
  targetIndustries: string[];
  approvedPhraseCount: number;
  eligibleAssetCount: number;
};

export function DiscoveryContextPage({
  brandSlug,
  title,
  description,
  targetIndustries,
  approvedPhraseCount,
  eligibleAssetCount,
}: DiscoveryContextPageProps) {
  const profileHref = `/app/brands/${brandSlug}/profile`;
  const phrasesHref = `/app/brands/${brandSlug}/phrases`;
  const contentHref = `/app/brands/${brandSlug}/content`;
  const ready = targetIndustries.length > 0 && approvedPhraseCount > 0 && eligibleAssetCount > 0;

  return (
    <main className="page">
      <header className="page-header">
        <div className="page-header-copy">
          <div className="eyebrow">Industry-aware discovery</div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="page-actions"><Link className="secondary-button" href={profileHref}>Edit target industries</Link></div>
      </header>

      <section className={`surface surface-pad discovery-readiness${ready ? " ready" : " blocked"}`}>
        <div>
          <span className={`status-pill ${ready ? "success" : "pink"}`}>{ready ? "Research inputs ready" : "Setup required"}</span>
          <h2>{ready ? "The first discovery run can now be planned" : "Complete the research inputs before creator discovery"}</h2>
          <p>{ready ? "Every run will cross approved phrases with all selected industries, then match qualified creators to eligible brand evidence." : "Discovery needs target markets, approved search language, and useful content evidence. This prevents broad keyword matches from being presented as relevant experts."}</p>
        </div>
        {targetIndustries.length ? <div className="tag-row">{targetIndustries.map((industry, index) => <span className={`tag${index === 0 ? " pink" : ""}`} key={industry}>{industry}</span>)}</div> : null}
      </section>

      <section className="readiness-checklist" aria-label="Discovery readiness">
        <Link className={`readiness-item${targetIndustries.length ? " complete" : ""}`} href={profileHref}><strong>{targetIndustries.length}/5</strong><span>Target industries</span></Link>
        <Link className={`readiness-item${approvedPhraseCount ? " complete" : ""}`} href={phrasesHref}><strong>{approvedPhraseCount}</strong><span>Approved phrases</span></Link>
        <Link className={`readiness-item${eligibleAssetCount ? " complete" : ""}`} href={contentHref}><strong>{eligibleAssetCount}</strong><span>Eligible content assets</span></Link>
      </section>

      <div className="decision-grid">
        <section className="surface surface-pad decision-card"><Search aria-hidden="true" /><h2>1. Search planning</h2><p>Cross the brand’s approved topics and customer questions with each selected industry and its language.</p></section>
        <section className="surface surface-pad decision-card"><ShieldCheck aria-hidden="true" /><h2>2. Qualification</h2><p>Require creator posts, profile history, or audience signals that demonstrate real relevance to the selected industry.</p></section>
        <section className="surface surface-pad decision-card"><Sparkles aria-hidden="true" /><h2>3. Matching</h2><p>Score industry expertise separately from topic expertise, audience relevance, and fit with a specific brand asset.</p></section>
      </div>
    </main>
  );
}
