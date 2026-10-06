import { BLOG_ORIGIN } from "@/lib/blog";
import type { Metadata } from "next";
import { MarketingNavigation } from "@/components/marketing-navigation";
import { MarketingFooter } from "@/components/marketing-footer";
import { ContactForm } from "@/components/contact-form";
import "../marketing.css";

export const metadata: Metadata = { alternates: { canonical: BLOG_ORIGIN + "/contact" }, title: "Contact us | B2B Influencer Finder" };
export default function ContactPage() {
  return <div className="marketing"><MarketingNavigation/><main className="marketing-access marketing-wrap">
    <section><span className="marketing-eyebrow">Contact us</span><h1>Let’s talk<br/><em>B2B creators.</em></h1><p>Have a question about the platform, managed outreach or early access? Send us a message.</p></section>
    <section className="marketing-access-card" aria-labelledby="contact-heading"><h2 id="contact-heading">How can we help?</h2><ContactForm/></section>
  </main><MarketingFooter/></div>;
}
