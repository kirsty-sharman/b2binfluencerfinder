# Live multi-channel pilot — 29 September 2026

Scope: Referral Factory, 11 active assets, banking and financial advisory search queries. User-authorized ceiling: $5 total. Two bounded runs, not an exhaustive market survey.

- Initial run: `9e1464f8-ba4b-49fc-940d-ecd04614ba59` — six queries, all six channels completed after retry; no final qualified creators.
- Expanded run: `5ef91835-0a8f-4182-ae04-52284c98b4b4` — twelve queries, two candidates per channel, three LinkedIn post enrichments. All six channels completed. Final quality reassessment retained two new publication/channel matches.

## Final results

| Channel | Candidates assessed | Qualified |
| --- | ---: | ---: |
| LinkedIn | 1 | 0 |
| Newsletters | 2 | 1 |
| Blogs | 2 | 0 |
| YouTube | 2 | 0 |
| Podcasts | 2 | 1 |
| X | 2 | 0 |

Retained: Don Connelly's publication (newsletter discovery) and ABA Banking Journal Podcast. Creators table increased from 10 to 12; existing user acceptance and shortlist counts returned to their original state after testing.

Rejected examples: Referral Factory's own YouTube account; a credit union's X product promotions; general entrepreneurship videos; articles without enough recent distinct evidence. LinkedIn's Michael Kitces had only one collected item in this bounded sample, which is insufficient for the three-item gate. This is a sampling limitation, not a claim that the person lacks expertise.

Industry assessment is conservative and can reject good publications when its generated quotations fail exact verification. Kitces and AdvisorEngine examples demonstrated this false-negative risk. More retrieval and calibration work is needed before claiming high recall. Final matching uses GPT-4.1 by default; accounts/publications are evaluated as publishing entities without inventing individual ownership.

## Changes prompted by live testing

- Industry gate requires exact quotations from two distinct recent source items. Generic business advice no longer qualifies as banking expertise.
- At least three substantive dated items within 180 days, plus a strong active-asset match, remain mandatory.
- Promotional sales/support accounts are excluded; editorial publications and interview podcasts remain eligible.
- Brand-name-identical channels are excluded before AI calls; this caught Referral Factory's own YouTube account.
- Publication accounts can qualify on their publication's evidence; no human owner is invented or merged with a guest. Verified personal ownership remains a separate limitation.
- Broader industry discovery for newsletters, blogs, podcasts and X; asset fit is evaluated after collection.
- Public RSS and author-page evidence collection improved.
- LinkedIn input URLs preserved when enrichment returns a different post URL; profile capitalization/region canonicalized. Legacy LinkedIn assessment no longer includes other channels' content.
- Malformed evidence/identity URLs excluded rather than failing the entire channel. Duplicate evidence normalized before storage.
- Bright Data snapshot IDs checkpointed before polling, so a retry reuses an already-triggered scrape. Completed channels and search records are reused.
- Current channel qualifications now control which suggested assets are shown and eligible for acceptance; obsolete suggestions cannot be accepted through the new-quality flow.
- Run detail exposes collected candidates, evidence and rejection reasons. Quality can be reassessed from saved evidence.
- Rejected creators excluded from the default view and available through the Rejected filter.

## Verified workflow and checks

Live UI: Andrew Hooper was temporarily accepted, appeared in Accepted creators with his asset, was rejected and disappeared from the default view, then restored to his original pending state. Kelly Dowell's pre-existing acceptance was preserved. The newly qualified ABA podcast also passed Accept & shortlist with the current-quality guard, and was restored to pending for the user to review. No outreach sent. Test actions remain in the audit history.

Local verification: lint, TypeScript, production build and 25 automated tests passed. Tests include feed attribution, channel identity, hidden audience counts, X enablement, fabricated evidence, exact industry quotations, URL normalization, self-brand exclusion, asset selection limits and phrase replenishment.

## Costs

Recorded Google search charges: $0.044 + $0.088 = **$0.132**. This is not the complete invoice. Bright Data enrichment, X reads and OpenAI quality checks are billed separately. Based on bounded request counts and payload sizes, total pilot usage is conservatively estimated below $4, within the $5 ceiling; provider dashboards are authoritative for actual billing. No subscriptions or automatic recharges enabled.

## Limits of this pilot

- Small sample; does not establish a market-wide precision or recall rate.
- YouTube evidence uses public video metadata/descriptions, not arbitrary video transcripts.
- Podcast show accounts are separate from guests; a named host is not automatically verified. Shows reusing one URL across episodes can fail the distinct-evidence test.
- Newsletter/blog fetching depends on public feeds, accessible HTML and author metadata; blocked or unreadable sources are reported.
- X discovery covers recent search and bounded own-post timelines. No claim of exhaustive historical coverage.
- Exact URL/cross-link identity merging is supported and tested with fixtures; a real same-person cross-channel merge and reject-then-rediscover replay were not demonstrated in this small live sample.
- Existing historical creators were not all requalified with the new gate. Their old matches can be weaker than new-run requirements.
- Jobs have checkpoints and leases, but automatic recovery still needs a durable production worker/scheduler. Manual retry is available locally.
- The in-app cost total records search charges, not a fully reconciled provider-wide spend ledger.
