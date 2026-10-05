"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updateBrandProfile, type BrandProfileState } from "@/app/app/brands/profile-actions";
import type { BrandProfileData } from "@/lib/brands";
import { IndustrySelector } from "@/components/industry-selector";

const initialState: BrandProfileState = {};

export function BrandProfileForm({ brand }: { brand: BrandProfileData }) {
  const [state, action, pending] = useActionState(updateBrandProfile, initialState);
  return (
    <main className="page profile-page">
      <header className="page-header">
        <div className="page-header-copy">
          <div className="eyebrow">Creator-search context</div>
          <h1>Brand profile</h1>
          <p>Tell us what you do and who you want to reach.</p>
        </div>
      </header>

      <form action={action} className="surface surface-pad">
        <input type="hidden" name="brandId" value={brand.id} />
        <input type="hidden" name="brandSlug" value={brand.slug} />
        <div className="form-grid"><div className="workspace-form-heading form-full"><span>01</span><div><h2>Your brand</h2><p>The expertise and customer problems behind your creator matches.</p></div></div>
          <div className="field"><label>Brand name</label><input className="text-input" value={brand.name} readOnly /></div>
          <div className="field"><label>Root domain</label><input className="text-input" value={brand.rootDomain} readOnly /></div>
          <div className="field form-full">
            <label htmlFor="summary">What should this brand be trusted for?</label>
            <textarea className="text-input text-area" id="summary" name="summary" defaultValue={brand.summary} placeholder="Describe the subjects, customer problems, and expertise this brand should own." />
          </div>
          <fieldset className="industry-fields form-full">
            <legend>02 · Target industries</legend>
            <p className="form-help">Search the broad organisational-buyer taxonomy and select up to five. Custom industries remain usable and can be mapped later without replacing your wording.</p>
            <IndustrySelector initialIndustries={brand.targetIndustries.map((industry) => ({ name: industry.name, taxonomyId: industry.taxonomyId, isCustom: industry.isCustom }))} />
            <div className="decision-note"><strong>How this changes discovery</strong><span>Core topics are crossed with each selected industry; creator evidence must then demonstrate industry relevance, not just a generic keyword mention.</span></div>
          </fieldset>
          <div className="workspace-form-heading form-full"><span>03</span><div><h2>Audience & topics</h2><p>Add detail to help focus discovery.</p></div></div><div className="field form-full"><label htmlFor="targetSegments">Target segments <span className="optional">Optional</span></label><textarea className="text-input" id="targetSegments" name="targetSegments" defaultValue={(brand.targetSegments || []).join(", ")} placeholder="K–12 schools, universities, EdTech companies" /><span className="form-help">Specific organisation types or sub-markets, separated by commas or new lines.</span></div>
          <div className="field form-full"><label htmlFor="industryTopics">Industry-specific topics <span className="optional">Optional</span></label><textarea className="text-input" id="industryTopics" name="industryTopics" defaultValue={(brand.industryTopics || []).join(", ")} placeholder="School marketing, student recruitment, parent ambassador programmes" /><span className="form-help">Language and problems that discovery should cross with the brand’s core topics.</span></div>
          <div className="field form-full"><label htmlFor="targetQuestions">Target customer questions <span className="optional">One per line</span></label><textarea className="text-input text-area" id="targetQuestions" name="targetQuestions" defaultValue={(brand.targetQuestions || []).join("\n")} placeholder={"How can schools grow referrals from parents?\nWhat is the best referral software for education businesses?"} /><span className="form-help">Questions buyers may ask search engines or AI assistants. These connect discovery evidence to a real recommendation context.</span></div>
        </div>
        {state.error ? <div className="auth-error" role="alert">{state.error}</div> : null}
        {state.success ? <div className="save-success" role="status">{state.success}</div> : null}
        <div className="form-footer"><Link className="secondary-button" href={`/app/brands/${brand.slug}`}>Cancel</Link><button className="primary-button" disabled={pending} type="submit">{pending ? "Saving…" : "Save brand profile"}</button></div>
      </form>
    </main>
  );
}
