import type { Metadata } from "next";
import Link from "next/link";
import { SignInForm } from "./sign-in-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { MarketingNavigation } from "@/components/marketing-navigation";
import "../marketing.css";
export const metadata:Metadata={title:"Sign in | B2B Influencer Finder"};
export default function SignInPage(){return <div className="marketing"><MarketingNavigation/><main className="marketing-access marketing-wrap"><section><span className="marketing-eyebrow">Your discovery workspace</span><h1>Great partnerships<br/>start with<br/><em>a relevant match.</em></h1><p>Pick up where you left off. Explore influencers and creators, review the evidence and build your next shortlist.</p></section><section className="marketing-access-card"><SignInForm previewMode={!isSupabaseConfigured()}/><div className="marketing-access-switch">New to B2B Influencer Finder? <Link href="/sign-up">Join the waitlist →</Link></div></section></main><footer className="marketing-footer marketing-wrap"><Link href="/">← Back to home</Link></footer></div>;}
