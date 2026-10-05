import { MarketingFooter } from "@/components/marketing-footer";
import type { Metadata } from "next";
import Link from "next/link";
import { MarketingNavigation } from "@/components/marketing-navigation";
import { RateEstimator } from "@/components/rate-estimator";
import "../marketing.css";

export const metadata: Metadata = { title: "B2B Creator Rate Estimator | B2B Influencer Finder", description: "Plan a starting offer for an original LinkedIn post, X post, newsletter piece or YouTube video with our B2B creator rate estimator." };
export default function RateEstimatorPage() {
  return <div className="marketing"><MarketingNavigation/><main className="marketing-wrap rate-page"><div className="rate-page-heading"><span className="marketing-eyebrow">Plan your creator budget</span><h1>What should you offer<br/>a B2B creator?</h1><p>Choose a channel and enter their audience size to estimate a starting offer for an original educational piece.</p></div><RateEstimator/><p className="rate-public-cta">Need the right people first? <Link href="/sign-up">Join the waitlist for B2B Influencer Finder →</Link></p></main><MarketingFooter/></div>;
}
