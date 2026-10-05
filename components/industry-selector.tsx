"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { B2B_INDUSTRIES, type B2BIndustry } from "@/lib/b2b-industries";

export type SelectedIndustry = {
  name: string;
  taxonomyId: string | null;
  isCustom: boolean;
  sector?: string;
};

function matches(industry: B2BIndustry, query: string) {
  const haystack = [industry.label, industry.sector, ...industry.aliases].join(" ").toLocaleLowerCase();
  return haystack.includes(query.toLocaleLowerCase());
}

export function IndustrySelector({ initialIndustries }: { initialIndustries: SelectedIndustry[] }) {
  const [selected, setSelected] = useState(initialIndustries.slice(0, 5));
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const normalizedQuery = query.trim().toLocaleLowerCase();

  const suggestions = useMemo(() => {
    const available = B2B_INDUSTRIES.filter((industry) =>
      !selected.some((item) => item.taxonomyId === industry.id || item.name.toLocaleLowerCase() === industry.label.toLocaleLowerCase()),
    );
    if (!normalizedQuery) return available;
    return available.filter((industry) => matches(industry, normalizedQuery));
  }, [normalizedQuery, selected]);

  const groupedSuggestions = useMemo(() => suggestions.reduce<Record<string, B2BIndustry[]>>((groups, industry) => {
    (groups[industry.sector] ||= []).push(industry);
    return groups;
  }, {}), [suggestions]);

  const exactMatch = B2B_INDUSTRIES.some((industry) =>
    industry.label.toLocaleLowerCase() === normalizedQuery || industry.aliases.some((alias) => alias.toLocaleLowerCase() === normalizedQuery),
  );
  const selectedMatch = selected.some((industry) => industry.name.toLocaleLowerCase() === normalizedQuery);
  const canAddCustom = Boolean(query.trim()) && !exactMatch && !selectedMatch && selected.length < 5;

  function addCanonical(industry: B2BIndustry) {
    if (selected.length >= 5) return;
    setSelected((current) => [...current, { name: industry.label, taxonomyId: industry.id, isCustom: false, sector: industry.sector }]);
    setQuery("");
    setOpen(false);
  }

  function addCustom() {
    const name = query.trim();
    if (!canAddCustom) return;
    setSelected((current) => [...current, { name, taxonomyId: null, isCustom: true }]);
    setQuery("");
    setOpen(false);
  }

  function removeIndustry(index: number) {
    setSelected((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  return (
    <div className="industry-selector">
      {selected.map((industry, index) => (
        <div className="industry-selection" key={`${industry.taxonomyId || "custom"}-${industry.name}`}>
          <span className="industry-priority">{index + 1}</span>
          <span><strong>{industry.name}</strong><small>{industry.isCustom ? "Custom industry" : industry.sector}</small></span>
          <button type="button" aria-label={`Remove ${industry.name}`} onClick={() => removeIndustry(index)}><X aria-hidden="true" /></button>
          <input type="hidden" name={`industry${index + 1}`} value={industry.name} />
          <input type="hidden" name={`industry${index + 1}TaxonomyId`} value={industry.taxonomyId || ""} />
          <input type="hidden" name={`industry${index + 1}IsCustom`} value={industry.isCustom ? "true" : "false"} />
        </div>
      ))}

      {selected.length < 5 ? (
        <div className="industry-combobox">
          <Search aria-hidden="true" />
          <input
            aria-autocomplete="list"
            aria-controls="industry-options"
            aria-expanded={open}
            aria-label="Search target industries"
            autoComplete="off"
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (suggestions[0]) addCanonical(suggestions[0]);
                else addCustom();
              }
              if (event.key === "Escape") setOpen(false);
            }}
            placeholder={selected.length ? "Add another target industry…" : "Search 220+ B2B buyer industries…"}
            role="combobox"
            value={query}
          />
          {open ? (
            <div className="industry-options" id="industry-options" role="listbox">
              <div className="industry-options-summary">{normalizedQuery ? `${suggestions.length} matches across the full taxonomy` : `${suggestions.length} industries in ${Object.keys(groupedSuggestions).length} sectors`}</div>
              {Object.entries(groupedSuggestions).map(([sector, industries]) => (
                <div aria-label={sector} className="industry-option-group" key={sector} role="group">
                  <div className="industry-sector-heading">{sector}</div>
                  {industries.map((industry) => (
                    <button aria-selected="false" key={industry.id} onMouseDown={(event) => event.preventDefault()} onClick={() => addCanonical(industry)} role="option" type="button">
                      <span><strong>{industry.label}</strong><small>{industry.aliases.length ? industry.aliases.join(" · ") : sector}</small></span><Check aria-hidden="true" />
                    </button>
                  ))}
                </div>
              ))}
              {canAddCustom ? (
                <button aria-selected="false" className="industry-custom-option" onMouseDown={(event) => event.preventDefault()} onClick={addCustom} role="option" type="button">
                  <Plus aria-hidden="true" /><span><strong>Add “{query.trim()}”</strong><small>Save as a custom industry; it can be mapped later</small></span>
                </button>
              ) : null}
              {!suggestions.length && !canAddCustom ? <p>No additional matches.</p> : null}
            </div>
          ) : null}
        </div>
      ) : <p className="form-help">Maximum of five target industries selected.</p>}

      {selected.length === 0 ? <input aria-hidden="true" className="industry-required-proxy" required tabIndex={-1} /> : null}
    </div>
  );
}
