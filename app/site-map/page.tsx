import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNavigation } from "@/components/marketing-navigation";
import { MarketingFooter } from "@/components/marketing-footer";
import { discoverPublicPages } from "@/lib/public-pages";
import { getAllPosts, BLOG_ORIGIN } from "@/lib/blog";
import "../marketing.css";
export const metadata: Metadata = { title: "Sitemap | B2B Influencer Finder", description: "Browse every public page and published guide on B2B Influencer Finder.", alternates: { canonical: `${BLOG_ORIGIN}/site-map` } };
const names: Record<string,string> = { "/": "Home", "/blog": "Blog and resources", "/contact": "Contact us", "/rate-estimator": "Creator rate estimator", "/site-map": "Sitemap" };
export default function SiteMap() {
  const posts = getAllPosts().filter(p => p.status === "published");
  return <div className="marketing"><MarketingNavigation/><main className="marketing-wrap resource-paths"><h1>Sitemap</h1><p>Explore the product, plan a collaboration or read our practical guides.</p><h2>Website pages</h2><ul>{discoverPublicPages().map(route => <li key={route}><Link href={route}>{names[route] || route.split("/").filter(Boolean).join(" / ").replaceAll("-", " ")}</Link></li>)}</ul><h2>All guides</h2><ul>{posts.map(p => <li key={p.slug}><Link href={`/blog/${p.slug}`}>{p.title}</Link></li>)}</ul><p><a href="/sitemap.xml">XML sitemap</a> · <a href="/llms.txt">LLM resource index</a></p></main><MarketingFooter/></div>;
}
