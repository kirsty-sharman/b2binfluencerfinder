import { BrandLogo } from "@/components/brand-logo";
import Link from "next/link";
import { ArrowUpRight, ChevronDown } from "lucide-react";
export function MarketingNavigation() {
  return <header className="marketing-nav marketing-wrap"><BrandLogo/><nav aria-label="Main navigation"><Link href="/#how-it-works">How it works</Link><Link href="/#channels">Channels</Link><Link href="/#plans">Pricing</Link><details className="marketing-resources"><summary>Resources <ChevronDown size={14} aria-hidden="true"/></summary><div className="marketing-resources-menu"><Link href="/blog">Blog</Link><Link href="/rate-estimator">Rate estimator</Link></div></details></nav><div className="marketing-nav-actions"><Link href="/sign-in">Sign in</Link><Link className="marketing-cta" href="/sign-up">Apply for access <ArrowUpRight size={18}/></Link></div></header>;
}
