"use client";

import Link from "next/link";
import { ArrowLeft, BrainCircuit, ExternalLink, Info, ShieldCheck, Sparkles } from "lucide-react";
import type { MatchReviewDetail } from "@/lib/matching";


function ScoreDots({ label, value }: { label: string; value: number }) {
  return <div className="score-row"><span>{label}</span><div aria-label={`${label}: ${value} out of 5`}>{[1,2,3,4,5].map((number) => <i className={number <= value ? "filled" : ""} key={number} />)}</div><strong>{value}</strong></div>;
}

export function MatchReview({ match }: { match: MatchReviewDetail }) {
  return <main className="review-page">
    <div className="review-topline"><Link href={`/app/brands/${match.brandSlug}/creators?creatorId=${match.creator.id}`}><ArrowLeft size={15} /> Back to creators</Link><span>Content pairing review</span></div>
    <div className="review-layout">
      <aside className="review-identity">
        <div className="creator-avatar review-avatar">{match.creator.name.split(/\s+/).map((part) => part[0]).join("").slice(0,2)}</div>
        <h1>{match.creator.name}</h1><p>{match.creator.headline}</p>
        <a className="text-link" href={match.creator.linkedinUrl} target="_blank" rel="noreferrer">Open creator profile <ExternalLink size={13} /></a>
        <dl className="creator-facts"><div><dt>Followers</dt><dd>{match.creator.followers?.toLocaleString() || "Unknown"}</dd></div><div><dt>Location</dt><dd>{match.creator.location}</dd></div><div><dt>Evidence</dt><dd>{match.creator.evidenceCount} posts</dd></div><div><dt>Eligibility</dt><dd><span className="status-pill success"><ShieldCheck size={12} /> Passed</span></dd></div></dl>
        <div className="profile-completeness"><span>Profile completeness</span><strong>{match.creator.followers && match.creator.headline && match.creator.location ? "Complete" : "Partial"}</strong></div>
      </aside>

      <section className="review-evidence-column">
        <div className="review-title"><div className="eyebrow">Creator × evidence asset</div><h2>{match.asset.title}</h2><div className="tag-row"><span className="tag pink">{match.asset.contentType}</span><span className="tag">{match.asset.evidenceStrength} evidence</span><span className="tag">{match.confidence} confidence</span></div></div>
        <article className="surface review-block"><div className="review-block-label">Why this match</div>{match.semantic?.status === "completed" ? <div className="semantic-audit-label"><BrainCircuit size={14} /><strong>{match.semantic.recommendation} evidence match</strong><span>AI evidence audit · {match.confidence} confidence</span></div> : null}<p className="review-explanation">{match.explanation}</p>{match.semantic?.profileSummary ? <p className="semantic-profile-summary">{match.semantic.profileSummary}</p> : null}{match.semantic?.industryAssessments.length ? <div className="industry-assessments">{match.semantic.industryAssessments.map((item) => <div key={item.industry}><span>{item.industry}</span><strong>{item.score}/5 · {item.relevance}</strong><p>{item.explanation}</p></div>)}</div> : null}<div className="score-breakdown"><ScoreDots label="Topic expertise" value={match.scores.topic} /><ScoreDots label="Industry expertise" value={match.scores.industry} /><ScoreDots label="Audience relevance" value={match.scores.audience} /><ScoreDots label="Natural asset fit" value={match.scores.assetFit} />{match.semantic?.credibility ? <ScoreDots label="Credibility" value={match.semantic.credibility} /> : null}</div></article>
        <article className="surface review-block asset-context"><div className="review-block-label">Brand evidence</div><a href={match.asset.url} target="_blank" rel="noreferrer"><strong>{match.asset.title}</strong><ExternalLink size={13} /></a><p>{match.asset.summary}</p><div className="target-question"><Sparkles size={15} /><div><span>Target customer question</span><strong>{match.question}</strong></div></div></article>
        <div className="evidence-heading"><h3>Direct creator evidence</h3><span>{match.evidence.length} attributed item{match.evidence.length === 1 ? "" : "s"}</span></div>
        {match.evidence.length ? match.evidence.map((item) => <article className="surface evidence-card" key={item.id}><div><span className={`evidence-strength ${item.strength}`}>{item.strength}</span><span className="tag">{item.industry}</span><span className="tag">{item.phrase}</span></div><blockquote>{item.excerpt}</blockquote><p>{item.explanation}</p><a href={item.url} target="_blank" rel="noreferrer">View source post <ExternalLink size={12} /></a></article>) : <div className="surface review-block"><p className="muted">No directly attributed post excerpt is available. Treat this recommendation as low confidence.</p></div>}
        {match.limitations.length ? <article className="surface limitations"><Info size={16} /><div><strong>Limitations</strong>{match.limitations.map((limitation) => <p key={limitation}>{limitation}</p>)}</div></article> : null}
      </section>

      <aside className="decision-panel"><h2>Next step</h2><p>Approve the creator once from Creators to add them and their best content match to a shortlist.</p><Link className="primary-button" href={`/app/brands/${match.brandSlug}/creators?creatorId=${match.creator.id}`}>Back to creators</Link><Link className="secondary-button" href={`/app/brands/${match.brandSlug}/shortlists`}>Open shortlists</Link></aside>
    </div>
  </main>;
}
