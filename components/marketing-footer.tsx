import Link from "next/link";
import { Search, ArrowUpRight } from "lucide-react";

export function MarketingFooter() {
  return <footer className="site-footer"><div className="marketing-wrap">
    <div className="site-footer-grid"><div className="site-footer-brand"><Link className="marketing-brand" href="/"><span className="marketing-logo"><Search size={22} aria-hidden="true"/></span><span>B2B <strong>Influencer Finder</strong></span></Link><p>Find the niche voices<br/>your buyers already trust.</p><Link className="site-footer-cta" href="/sign-up">Join the waitlist <ArrowUpRight size={18} aria-hidden="true"/></Link></div>
    <nav aria-label="Company"><h2>Company</h2><Link href="/sign-up">Join the waitlist</Link><Link href="/sign-in">Login</Link><Link href="/#how-it-works">How it works</Link><Link href="/contact">Contact us</Link></nav>
    <nav aria-label="Resources"><h2>Resources</h2><Link href="/blog">Blog</Link><Link href="/#how-it-works">How it works</Link><Link href="/site-map">Sitemap</Link><Link href="/rate-estimator">Rate estimator <ArrowUpRight size={14} aria-hidden="true"/></Link></nav></div>
    <div className="site-footer-bottom"><span>© {new Date().getFullYear()} B2B Influencer Finder</span><span>Built for B2B. Focused on relevance.</span></div>
  </div></footer>;
}
