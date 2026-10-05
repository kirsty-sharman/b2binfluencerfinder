"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { prefillBrand } from "@/app/app/brands/prefill-actions";
import { B2B_INDUSTRIES } from "@/lib/b2b-industries";
import type { SelectedIndustry } from "./industry-selector";

export function BrandAutofill({ domain, onIndustries }: { domain?: string; onIndustries: (industries: SelectedIndustry[]) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  return <section className="decision-note" style={{ marginBottom: 28 }}>
    <strong>Start with your website</strong>
    <span>AI reads your website and drafts your expertise, buyer industries and search topics. Review and edit before saving. Existing answers are kept.</span>
    <button className="secondary-button" type="button" disabled={busy} onClick={async event => {
      const form = event.currentTarget.form;
      if (!form) return;
      const website = () => domain || String(new FormData(form).get("rootDomain") || "");
      const requested = website();
      setBusy(true); setMessage("");
      try {
        const result = await prefillBrand(requested);
        if (website() !== requested) { setMessage("Website changed during the scan. Scan the new website to continue."); return; }
        if (!result.draft) { setMessage(result.error || "Could not scan this website."); return; }
        const draft = result.draft;
        let filled = 0;
        for (const [name, value] of Object.entries({ name: draft.name, summary: draft.summary, targetSegments: draft.targetSegments.join("\n"), industryTopics: draft.industryTopics.join("\n") })) {
          const input = form.elements.namedItem(name);
          if ((input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) && !input.value.trim() && value) { input.value = value; filled++; }
        }
        if (!new FormData(form).get("industry1") && draft.industryIds.length) {
          onIndustries(draft.industryIds.flatMap(id => { const i = B2B_INDUSTRIES.find(i => i.id === id); return i ? [{ name: i.label, taxonomyId: i.id, isCustom: false, sector: i.sector }] : []; })); filled++;
        }
        setSources(draft.sources);
        setMessage(filled ? `${filled} fields filled. Check the suggested buyer industries carefully, then save. Missing evidence stays blank.` : "Scan complete. Your existing answers were kept; no empty fields could be filled.");
      } catch { setMessage("Scan failed. Please retry or continue manually."); }
      finally { setBusy(false); }
    }}><Sparkles size={18} aria-hidden="true" />{busy ? "Reading website and drafting profile…" : "Autofill with AI"}</button>
    <span role="status" aria-live="polite">{busy ? "This may take about a minute. You can keep editing." : message}</span>
    {!!sources.length && <details><summary>Website sources ({sources.length})</summary>{sources.map(url => <div key={url}><a href={url} target="_blank" rel="noreferrer">{url}</a></div>)}</details>}
  </section>;
}
