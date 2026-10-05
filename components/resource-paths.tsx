import Link from "next/link";
import { getPosts } from "@/lib/blog";

export function ResourcePaths({ compact = false }: { compact?: boolean }) {
  const slugs = ["what-is-creator-aeo", "how-to-build-a-creator-aeo-strategy", "ai-share-of-voice"];
  const posts = getPosts().filter(post => post.status === "published");
  return <section className="resource-paths" aria-label="Guides and next steps">
    <h2>{compact ? "Put the ideas into practice" : "Learn, plan and find your creators"}</h2>
    <div className="resource-paths-grid">
      {!compact && slugs.map(slug => { const post = posts.find(p => p.slug === slug); return post ? <Link key={slug} href={`/blog/${slug}`}>{post.title} <span aria-hidden="true">→</span></Link> : null; })}
      <Link href="/#how-it-works">See how creator matching works →</Link>
      <Link href="/rate-estimator">Estimate your creator budget →</Link>
      <Link href="/contact">Talk to us about managed outreach →</Link>
    </div>
    {!compact && <p><Link href="/blog">Browse all guides →</Link></p>}
  </section>;
}
