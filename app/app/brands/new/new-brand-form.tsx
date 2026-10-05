"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createBrand, type CreateBrandState } from "./actions";
import { IndustrySelector } from "@/components/industry-selector";

const initialState: CreateBrandState = {};

export function NewBrandForm() {
  const [state, action, pending] = useActionState(createBrand, initialState);
  return (
    <form action={action} className="surface surface-pad">
      <div className="form-grid">
        <div className="field">
          <label htmlFor="name">Brand name</label>
          <input className="text-input" id="name" name="name" placeholder="Acme" required />
        </div>
        <div className="field">
          <label htmlFor="rootDomain">Root domain</label>
          <input className="text-input" id="rootDomain" name="rootDomain" placeholder="https://example.com" required />
        </div>
        <div className="field form-full">
          <label htmlFor="summary">What should this brand be trusted for?</label>
          <textarea className="text-input text-area" id="summary" name="summary" placeholder="Describe the subjects, customer problems, and expertise this brand should own." />
        </div>
        <fieldset className="industry-fields form-full">
          <legend>Target industries</legend>
          <p className="form-help">Search the broad organisational-buyer taxonomy, then choose up to five markets. If the right industry is missing, add your own without losing the original wording.</p>
          <IndustrySelector initialIndustries={[]} />
        </fieldset>
        <div className="field form-full"><label htmlFor="targetSegments">Target segments <span className="optional">Optional</span></label><textarea className="text-input" id="targetSegments" name="targetSegments" placeholder="K–12 schools, universities, EdTech companies" /><span className="form-help">Specific organisation types or sub-markets, separated by commas or new lines.</span></div>
        <div className="field form-full"><label htmlFor="industryTopics">Industry-specific topics <span className="optional">Optional</span></label><textarea className="text-input" id="industryTopics" name="industryTopics" placeholder="School marketing, student recruitment, parent ambassador programmes" /><span className="form-help">Language and problems discovery should combine with the brand’s core topics.</span></div>
        <div className="field form-full">
          <span className="form-help">You can add target questions, claims, audiences, and exclusions in the brand profile after creation.</span>
        </div>
      </div>
      {state.error ? <div className="auth-error" role="alert">{state.error}</div> : null}
      <div className="form-footer"><Link className="secondary-button" href="/app">Cancel</Link><button className="primary-button" disabled={pending} type="submit">{pending ? "Creating…" : "Create brand"}</button></div>
    </form>
  );
}
