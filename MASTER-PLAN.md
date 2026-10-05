# B2B Creator Evidence Platform — Master Plan

Last updated: 26 September 2026

Implementation status: core journey and three key high-fidelity screens approved;
build specification ready in `BUILD-SPEC.md`.

## 1. Product vision

Build a multi-brand internal SaaS tool that finds genuine industry experts who
can interpret, critique, validate, and distribute a brand's strongest content.

The product is not an influencer marketplace and is not designed to generate
generic paid endorsements. Its purpose is to create useful, trustworthy,
third-party evidence that associates a brand with the exact subjects and
industries it wants to be credible in.

The desired loop is:

> Customer question → brand evidence → relevant expert → original expert
> interpretation → crawlable publication → search and AI visibility measurement

The central unit of value is the **creator × content asset × target question
match**, not the creator alone.

## 2. Confirmed product decisions

- LinkedIn is required in the first release because it is the primary B2B
  creator channel.
- Outreach and negotiation remain manual in the first release.
- Creator acceptance and the final impact score remain human-controlled.
- The system supports multiple brands from the beginning.
- Work persists across weeks; every discovery run, phrase list, content asset,
  creator, decision, and publication must be saved.
- The UI and future external API use the same application service layer.
- Vercel is the hosting platform.
- DataForSEO is the initial LinkedIn discovery provider.
- Bright Data is the initial post and profile enrichment provider.
- OpenAI may suggest matches, explanations, and scores, but must show the
  evidence used and must not silently accept creators.
- The product will not automate outreach in the first release.

## 3. Product principles

### Evidence before reach

Subject expertise, audience relevance, and a natural connection to the brand's
content matter more than follower count.

### Match content, not just keywords

A person can be an excellent match for one report and a poor match for another.
Every recommendation should be tied to a specific asset and target question.

### Expert interpretation, not copied promotion

The desired output is an original critique, application, comparison, teardown,
or explanation. Creators should not simply reproduce the brand's wording or
publish a disguised “buy this product” message.

### Honest validation

Creators must be free to add nuance or disagree. Paid relationships should be
appropriately disclosed. The tool should never imply independent validation
where none exists.

### Explain every recommendation

Each match must show the relevant posts, profile information, content asset,
proposed angle, score breakdown, and any risk flags.

### Humans make consequential decisions

The system finds, enriches, organizes, and suggests. A person approves the
shortlist, edits the score, conducts outreach, agrees terms, and confirms the
published result.

## 4. First-release scope

### Included

1. Simple authentication.
2. Multiple brands per account.
3. Brand intelligence and target-industry setup.
4. Saved master phrase lists.
5. Brand content scanning and a content-asset library.
6. Asynchronous LinkedIn discovery runs.
7. Post and person-profile enrichment.
8. Deterministic eligibility filters.
9. Explainable creator-to-asset matching.
10. Manual review, scoring, accept/reject, notes, and shortlist management.
11. Collaboration-angle suggestions.
12. Published-evidence tracking.
13. A small, manually run AI-visibility benchmark.
14. CSV export and API-ready internal services.

### Explicitly excluded

- Automated LinkedIn messages or email outreach.
- Automated negotiation, contracting, booking, or payment.
- Automatic creator acceptance.
- Guaranteed positive reviews or scripted endorsements.
- Mass generation of near-duplicate creator posts.
- Claims that a creator mention directly retrains or controls an LLM.
- Fully automated AI-visibility monitoring at scale.
- Channels other than LinkedIn, except for recording additional publication
  URLs when a collaboration also appears elsewhere.

## 5. First-release user journey

### Step 1: Sign in and choose a brand

The user signs in and can create, select, archive, or revisit brands. A brand is
the security and data boundary for phrases, content, creators, runs, and results.

### Step 2: Complete the brand intelligence profile

Capture:

- root domain and brand name;
- the brand's own product category, kept separate from its customer markets;
- one to five priority industries;
- ideal customer roles and company types;
- problems the product solves;
- subjects the brand should be trusted for;
- competitors and alternatives;
- geographic and language targets;
- claims to establish and proof supporting those claims;
- claims or subjects creators must avoid;
- target questions customers may ask search engines or AI assistants.

Priority industries are the markets the brand wants credibility and customers
in, not merely the category of the product itself. For example, a referral
software brand may target Education; that industry context should lead the
system toward school marketing, student recruitment, parent ambassador
programmes, and other education-specific evidence. At least one target industry
is required before creator discovery can start.

Industry selection uses a broad, searchable organisational-buyer taxonomy with
stable internal IDs, parent sectors, aliases, and provider mappings. It is not a
closed list: users can add a custom industry, the system preserves their exact
label, and a canonical mapping may be suggested later for approval. Keep target
industry, target segment, and industry-specific topics separate—for example,
Education; K–12 schools; and school marketing.

### Step 3: Build the master phrase list

Import keyword candidates from a keyword-data provider using filters such as
position, search volume, and intent. The user can edit, group, approve, reject,
and save phrases before discovery.

The first release should support manual phrase entry and CSV import even if the
keyword provider is unavailable.

Phrase suggestions must be generated as a reviewable matrix of core brand
topics × selected target industries × buyer problems or target questions. The
user approves the resulting phrases; an industry label must never silently
expand into paid provider queries.

### Step 4: Build the brand content library

Scan the brand domain and identify useful assets such as:

- original research and statistics;
- case studies and customer outcomes;
- benchmark reports;
- frameworks and methodologies;
- how-to guides;
- comparisons and teardowns;
- templates, calculators, or tools;
- expert interviews and opinion pieces.

Each asset becomes a reviewable card containing its URL, title, summary,
topics, target industries, claims, supporting evidence, freshness, and quality.
The user chooses which assets are eligible for creator collaboration.

### Step 5: Run LinkedIn discovery

The user selects a brand, one or more saved target industries, phrase set,
geography, language, follower range, and result limit, then starts a background
run. The selected industries and their current labels are snapshotted on the run
so later results remain explainable even if the brand profile changes.

The system:

1. validates that every run has at least one target industry;
2. expands approved phrases into LinkedIn-specific queries using the selected
   industry context;
3. searches through DataForSEO;
4. normalizes and deduplicates content URLs;
5. retains the industry, source phrase, query, rank, snippet, URL, and collection date;
6. enriches a capped set of posts through Bright Data;
7. extracts the dedicated author URL rather than mentioned or recommended
   profiles;
8. separates people from company pages;
9. enriches eligible person profiles;
10. stores raw provider evidence and normalized application records.

### Step 6: Filter and qualify creators

Apply deterministic filters before AI scoring:

- individual rather than company account;
- configured follower range;
- relevant geography and language where required;
- sufficient profile data;
- recent activity where it can be verified;
- at least one strong or several supporting topical content signals;
- at least one supported target-industry signal, or an explicit adjacent-fit
  flag for human review;
- no obvious conflict or exclusion rule.

Failed candidates are retained with a reason rather than silently deleted.

### Step 7: Match creators to content assets

For each eligible person, evaluate individual brand assets and target questions.
The output must include:

- recommended asset;
- target customer question;
- why this person is relevant;
- which selected target industry they fit and the evidence supporting that fit;
- supporting creator posts;
- audience and profile evidence;
- one to three authentic collaboration angles;
- score breakdown;
- confidence and missing-data warnings;
- conflict or credibility flags.

The suggested score must keep topic expertise, target-industry expertise,
audience relevance, and natural asset fit as separate explainable dimensions.
A generic marketing creator must not receive a strong industry-fit score solely
because a post contains the brand's core keyword.

### Step 8: Human review and shortlist

The reviewer can:

- accept, reject, or mark “maybe”;
- edit the suggested 1–5 impact score;
- add notes and tags;
- change the matched asset;
- edit a proposed angle;
- add the creator to one or more named shortlists;
- record contact details and manual outreach status.

### Step 9: Track published evidence

When work is published, record:

- live URL;
- creator and brand;
- related content asset and target question;
- channel and format;
- publication date;
- whether the brand source is linked;
- disclosure status;
- indexability/check status;
- notes and agreed fee where appropriate;
- referral traffic or engagement entered manually or imported later.

The system may record supporting versions on newsletters, websites, podcasts,
YouTube, industry publications, or the brand site even though discovery is
LinkedIn-only in the first release.

### Step 10: Run a small AI-visibility benchmark

Save a controlled set of target questions and manually run a periodic benchmark
across selected answer engines. Record:

- whether the brand is mentioned or recommended;
- wording and accuracy of the description;
- cited domains and URLs;
- whether creator evidence is cited;
- which competitors appear;
- whether the source merely appears or materially supports the answer.

Treat this as directional evidence, not proof that one collaboration caused an
LLM response.

## 6. Scoring model

Use two separate decisions.

### Creator eligibility

A rule-based pass, fail, or insufficient-data result based on account type,
followers, activity, geography, language, conflicts, and data completeness.

### Creator–asset match

An explainable recommendation based on:

- demonstrated expertise;
- audience and industry fit;
- relevance to the specific content asset;
- relevance to the target customer question;
- ability to add an original expert perspective;
- engagement quality and content consistency;
- credibility and independence;
- publication format and likely retrievability.

The product displays a suggested **impact score from 1 to 5**, supporting
evidence, confidence, and warnings. The reviewer owns the final score.

Follower count must never be allowed to compensate for weak expertise or an
unnatural content match.

## 7. Information architecture and pages

### Authentication

- Sign in
- First-user setup

Use standard secure authentication rather than implementing a custom PIN-only
system. Email confirmation can be disabled for the initial controlled rollout.

### Global application shell

- Brand switcher
- Primary navigation
- Current run status
- Global search
- Account/settings menu

### Dashboard

- brands and their current status;
- recent and running discovery jobs;
- candidates awaiting review;
- shortlist counts;
- recently published evidence;
- provider failures or missing data.

### Brand area

- Brand overview
- Intelligence profile
- Target questions
- Phrase library
- Content library
- Discovery runs
- Creator matches
- Shortlists
- Published evidence
- AI visibility benchmark
- Brand settings

### Core detail pages

- Discovery run detail with stage, counts, cost where available, errors, and
  rerun controls
- Creator profile with evidence timeline and all brand-specific matches
- Match review with creator, asset, question, evidence, angles, and scoring in
  one workspace
- Content asset detail with matches and resulting publications
- Publication detail with verification and outcome notes

## 8. Data model

The initial schema should include:

- `users`
- `workspaces`
- `workspace_members`
- `brands`
- `brand_industries`
- `brand_audiences`
- `brand_claims`
- `target_questions`
- `phrase_lists`
- `phrases`
- `content_assets`
- `discovery_runs`
- `discovery_run_industries` as an immutable per-run snapshot;
- `run_queries`
- `provider_records`
- `creator_profiles`
- `creator_channels`
- `creator_content`
- `creator_asset_matches`
- `match_evidence`
- `review_decisions`
- `shortlists`
- `shortlist_members`
- `outreach_records`
- `publications`
- `visibility_benchmarks`
- `visibility_observations`
- `audit_events`

Provider payloads should be stored separately from normalized records. Every
normalized fact should retain its source provider, source URL, collection time,
and last verification time.

## 9. Run and job model

Discovery is asynchronous and resumable. A run moves through explicit stages:

`draft → queued → searching → enriching_posts → extracting_authors →
enriching_profiles → matching → ready_for_review`

It may also enter `partially_complete`, `failed`, or `cancelled`.

Requirements:

- hard per-run provider limits;
- idempotency so retries do not create duplicate spend;
- saved stage checkpoints;
- per-record failures rather than failing the entire run;
- visible progress and error messages;
- retry only failed or stale stages;
- provider request identifiers, timestamps, and reported cost;
- no API keys in browser code or application logs.

## 10. Technical architecture

### Recommended stack

- Next.js and TypeScript for the web application and API routes
- Vercel for hosting and deployments
- Supabase Postgres for relational data
- Supabase Auth for the controlled first-user login and later multi-user access
- Supabase Storage if stored exports or snapshots require object storage
- A durable background-job mechanism for provider runs and polling
- DataForSEO for indexed LinkedIn discovery
- Bright Data for LinkedIn post and person-profile enrichment
- OpenAI Responses API for evidence-grounded extraction and suggestions

Supabase is a good fit because Auth and Postgres integrate with Row Level
Security. Every brand-owned table should be scoped through workspace membership;
service-role credentials must remain server-only.

Long provider jobs must not depend on a browser tab remaining open. Use a
durable workflow/queue for execution and use scheduled jobs only for periodic
maintenance, stale-run recovery, or later monitoring.

### Provider abstraction

Implement adapters rather than embedding provider-specific fields throughout
the product:

- `KeywordProvider`
- `SearchDiscoveryProvider`
- `PostEnrichmentProvider`
- `ProfileEnrichmentProvider`
- `LanguageModelProvider`

This makes it possible to replace DataForSEO, Bright Data, a future keyword
provider, or the language model without redesigning the application.

### API readiness

Build internal services around stable operations such as:

- create/list/update brands;
- manage phrase lists and content assets;
- start and inspect discovery runs;
- list creators and matches;
- submit review decisions;
- manage shortlists;
- record publications;
- create visibility observations.

The UI calls these services. A versioned external API can later expose the same
operations with API-key authentication, scopes, rate limits, and webhooks.

## 11. Provider spike findings

The completed Referral Factory spike produced:

- 10 successful DataForSEO searches;
- 115 raw LinkedIn results;
- 109 unique LinkedIn content URLs;
- $0.1525 DataForSEO-reported cost;
- 30/30 Bright Data post records;
- 28 unique authors: 22 people and 6 companies;
- 20/20 Bright Data person profiles;
- complete names, URLs, and numeric follower counts for all 20 profiles;
- a follower range of 2,253 to 72,082;
- activity data for 19 profiles and article/post data for 13.

The spike validated the provider combination. It also proved that author
extraction must use Bright Data's dedicated author field; recursively collecting
all LinkedIn URLs incorrectly includes tagged and recommended profiles.

See `provider-spike/RESULTS.md` for the full record.

## 12. Measurement framework

### Product quality

- percentage of enriched records successfully normalized;
- percentage of candidates passing deterministic filters;
- reviewer acceptance and rejection rates;
- rejection reasons;
- percentage of suggestions whose asset or score is edited;
- time from run start to review-ready;
- provider cost per review-ready candidate.

### Collaboration quality

- outreach-to-response rate, entered manually in the first release;
- accepted collaboration rate;
- publication completion rate;
- percentage containing an original expert contribution;
- percentage containing a valid link to the relevant brand source;
- engagement quality, referral visits, and conversions where available.

### Evidence and visibility

- publication indexed and still live;
- number and diversity of independent expert sources;
- target-question brand mention rate;
- target-question recommendation rate;
- citation/source rate;
- accuracy of brand descriptions;
- competitor share of observed recommendations;
- whether cited evidence materially supports the generated answer.

## 13. Delivery phases

### Phase 1: Foundation

- application shell and visual system;
- secure authentication;
- workspaces and multiple brands;
- brand intelligence profile;
- phrase and target-question libraries;
- database, row-level access policies, and audit foundation.

### Phase 2: Evidence and discovery

- site scan and content-asset library;
- DataForSEO and Bright Data adapters;
- asynchronous staged runs;
- normalization, deduplication, filtering, progress, and failure recovery;
- raw evidence inspection.

### Phase 3: Matching and review

- creator profiles and evidence timelines;
- creator-to-asset match generation;
- impact suggestions and explanations;
- review workspace, shortlists, notes, and CSV export;
- collaboration-angle suggestions.

### Phase 4: Outcomes

- manual outreach status;
- publication evidence tracker;
- small target-question benchmark;
- product, collaboration, and visibility reporting.

## 14. First-release acceptance criteria

The release is ready when the user can:

1. securely sign in and manage more than one brand;
2. save a brand intelligence profile, phrases, questions, and content assets;
3. select at least one target industry and start a bounded LinkedIn run that
   preserves its industry context, then safely leave the page;
4. return later and see progress, failures, costs, and recovered results;
5. inspect evidence-backed person profiles rather than company or mentioned
   profiles;
6. review an explainable creator–asset–question match;
7. edit the 1–5 score and add the person to a shortlist;
8. record manual outreach without the product sending it;
9. record a resulting publication and its brand link;
10. export the shortlist and retain every decision for future runs.

## 15. Visual and interaction design

The confirmed direction is a **Notion-style product interface with Attio-like
polish**. The first release should use a light, restrained, primarily monochrome
system with strong typography, fine borders, minimal shadow, generous page
spacing, and compact information-rich tables and review panels. One vivid warm
pink (`#FF2D5F`) provides a deliberate flash of personality.

Use a familiar workspace structure: a left sidebar, quiet breadcrumbs, clear
page titles, document-like editing, tables for collections, full pages for deep
research, and drawers for quick supporting detail. Cards should represent real
objects rather than serve as decoration. Pink is used selectively for active
states, highlights, progress, focus, and primary moments—not as a general page
background. Most of the visible interface remains warm white, charcoal, and
neutral gray.

The confirmed interaction principles are:

- evidence should be visible rather than hidden behind a score;
- dense research data must remain calm and easy to scan;
- status and progress must be obvious for long-running work;
- important human decisions should feel deliberate and reversible;
- provider internals should not dominate the everyday experience;
- the application should feel credible, focused, and useful rather than like a
  generic influencer marketplace.

The creator–content match page should make evidence the dominant element and
keep the editable score and accept/maybe/reject controls visible while the user
reviews. Motion should be subtle and functional.

The detailed direction and accessible pink scale are recorded in
`DESIGN-BRIEF.md`. Exact fonts and any reusable brand assets remain to be
selected during the visual-system implementation.

## 16. Open decisions

- Keyword provider for the initial phrase-discovery step
- Whether the first login uses email/password or a controlled magic-link flow
- Exact default follower, location, freshness, and evidence thresholds
- Which AI answer engines are included in the manual benchmark
- Retention period for raw provider responses
- Reusable brand assets and final product name

## 17. Reference guidance

- [OpenAI publisher and crawler guidance](https://help.openai.com/en/articles/12627856-publishers-and-developers-faq)
- [Google guidance for generative AI search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
