import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check, Mail, Search, Handshake } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import "../marketing.css";
import "./thank-you.css";

export const metadata: Metadata = {
  title: "Application received | B2B Influencer Finder",
  description: "Thanks for applying. We’ll review your application and email you within 1–3 business days with next steps.",
  robots: { index: false, follow: false },
  alternates: { canonical: "https://b2binfluencerfinder.com/thank-you" },
};

export default function ThankYouPage() {
  return <div className="marketing thanks-page">
    <header className="marketing-nav marketing-wrap"><BrandLogo/><Link className="thanks-home" href="/">Back to home <ArrowUpRight size={16} aria-hidden="true"/></Link></header>
    <main className="marketing-wrap">
      <section className="thanks-hero" aria-labelledby="thanks-title">
        <div>
          <span className="thanks-status"><Check size={16} aria-hidden="true"/> Application received</span>
          <h1 id="thanks-title">Great partnerships<br/>start with a <em>hello.</em></h1>
          <p className="thanks-intro">Thanks for yours. We’re excited to learn about your brand and the conversations you want to be part of.</p>
          <p className="thanks-promise">We’ll review your application and reach out by email within <strong>1–3 business days.</strong></p>
          <div className="thanks-note"><Mail size={20} aria-hidden="true"/><span>Keep an eye on the work email you applied with.<br/>No need to apply again — we’ll take it from here.</span></div>
        </div>
        <aside className="thanks-next" aria-labelledby="next-title">
          <span className="marketing-eyebrow">Your next chapter</span>
          <h2 id="next-title">Here’s what happens next.</h2>
          <ol>
            <li className="thanks-complete"><span aria-hidden="true"><Check size={18}/></span><div><h3>You’ve made the introduction</h3><p>Your application is with us.</p></div></li>
            <li><span aria-hidden="true">02</span><div><h3>We get to know your brand</h3><p>We’ll review your website and application to understand whether we’re a good fit.</p></div></li>
            <li><span aria-hidden="true">03</span><div><h3>Look out for our email</h3><p>Expect next steps in 1–3 business days. If approved, you’ll receive instructions to access your workspace.</p></div></li>
          </ol>
          <div className="thanks-next-foot">Application received. Possibilities ahead.</div>
        </aside>
      </section>
      <section className="thanks-services" aria-labelledby="services-title">
        <div className="thanks-section-heading"><span className="marketing-eyebrow">A reminder of what we can do together</span><h2 id="services-title">Your expertise.<br/><em>The right people talking about it.</em></h2><p>Find relevant industry voices, give them a reason to care, and build creator partnerships around your strongest content.</p></div>
        <div className="thanks-service-grid">
          <article><Search size={26} aria-hidden="true"/><span className="marketing-eyebrow">Finder · Software</span><h3>Find your people.<br/>Make your next move.</h3><p>Discover B2B creators across LinkedIn, YouTube, podcasts, newsletters, blogs and X. See why they fit, explore collaboration ideas and build your shortlist.</p><div className="thanks-service-footer"><span>You handle outreach and partnerships.</span><Link href="/#plans">Explore Finder <ArrowUpRight size={16} aria-hidden="true"/></Link></div></article>
          <article><Handshake size={26} aria-hidden="true"/><span className="marketing-eyebrow">Managed · Software + support</span><h3>The right matches.<br/>A team to help you connect.</h3><p>Get everything in Finder, plus human-reviewed matches, personalized creator outreach, follow-ups and collaboration support.</p><div className="thanks-service-footer"><span>You approve the creators. We handle outreach.<br/>Creator fees are separate.</span><Link href="/#plans">Explore Managed <ArrowUpRight size={16} aria-hidden="true"/></Link></div></article>
        </div>
      </section>
      <section className="thanks-reading" aria-labelledby="reading-title"><div><span className="marketing-eyebrow">While we get acquainted</span><h2 id="reading-title">A little inspiration for what’s next.</h2><p>From your first shortlist to a repeatable creator program — here’s where to start.</p></div><Link href="/blog/how-to-build-a-winning-b2b-creator-program">How to build a winning<br/>B2B creator program <ArrowUpRight size={24} aria-hidden="true"/></Link></section>
    </main>
    <footer className="marketing-footer marketing-wrap"><span>B2B Influencer Finder</span><Link href="/contact">Have a question? Get in touch →</Link></footer>
  </div>;
}
