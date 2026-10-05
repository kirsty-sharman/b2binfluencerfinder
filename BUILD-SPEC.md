# B2B Creator Evidence Platform — Build Specification

Status: Approved for implementation

Design approval date: 26 September 2026

Source documents:

- `MASTER-PLAN.md`
- `DESIGN-BRIEF.md`
- approved low-fidelity core journey
- approved high-fidelity brand overview, creator results, and match review

## 1. Implementation objective

Build the first usable vertical slice of the multi-brand creator-evidence
platform. A user must be able to create a brand, save research inputs, run the
proven LinkedIn provider pipeline, inspect evidence-backed creator matches, and
make manual shortlist decisions.

The first implementation should optimize for one real user and one real brand
without creating architectural shortcuts that prevent multiple brands, users,
or API access later.

## 2. Technical foundation

- Next.js with TypeScript
- App Router
- Server Components by default
- Client Components only for interactive tables, filters, review controls, and
  live run progress
- Supabase Postgres
- Supabase Auth
- Row Level Security on every workspace-owned table
- Vercel deployment
- Durable background job execution for provider stages
- DataForSEO discovery adapter
- Bright Data post and person-profile adapters
- OpenAI Responses API for evidence-grounded matching suggestions

Provider secrets and the Supabase service role remain server-only.

## 3. Route map

### Authentication

- `/sign-in`

### Workspace

- `/app`
- `/app/brands/new`
- `/app/brands/[brandId]`
- `/app/brands/[brandId]/profile`
- `/app/brands/[brandId]/phrases`
- `/app/brands/[brandId]/content`
- `/app/brands/[brandId]/runs`
- `/app/brands/[brandId]/runs/new`
- `/app/brands/[brandId]/runs/[runId]`
- `/app/brands/[brandId]/creators`
- `/app/brands/[brandId]/matches/[matchId]`
- `/app/brands/[brandId]/shortlists`
- `/app/brands/[brandId]/shortlists/[shortlistId]`
- `/app/brands/[brandId]/publications`
- `/app/brands/[brandId]/visibility`
- `/app/settings`

The currently selected brand should be represented in the URL, not only in
client state, so pages can be bookmarked and revisited safely.

## 4. Approved visual system

### Typography

- Primary font: Inter
- Headings: weight 500 with tight letter spacing
- Body: weight 400
- Controls and important labels: weight 500
- Avoid heavy bold weights and decorative display fonts

### Core colors

- Canvas: `#FDFDFC`
- Sidebar: `#F3F3F1`
- Raised surface: `#FFFFFF`
- Strong text: `#20201E`
- Muted text: `#777570`
- Quiet text: `#9C9A95`
- Border: `#E1E0DC`
- Subtle divider: `#EFEEEA`
- Signature pink: `#FF2D5F`
- Accessible primary pink: `#E8174F`
- Pink hover: `#D90F45`
- Soft pink: `#FFF0F4`
- Deep pink text: `#A80D38`
- Success surface/text: `#EDF7F1` / `#286A47`
- Warning surface/text: `#FAF3DF` / `#795B1E`

### Shape and depth

- Primary radius: 8px
- Large surface radius: 11–14px
- Full-radius status pills
- Thin neutral borders
- No shadow on ordinary cards
- Soft shadow only for menus, dialogs, popovers, and deliberate elevation

### Color discipline

Pink should occupy approximately 5–10% of a typical screen. Use it for primary
actions, active navigation, selection, progress, focus, impact scores, and
important evidence emphasis. Do not use pink as a replacement for warning,
success, or destructive semantic colors.

## 5. Application shell

### Left sidebar

Persistent desktop navigation containing:

- brand switcher;
- brand overview;
- brand profile;
- phrase library with count;
- content assets with count;
- discovery runs with count;
- creators with count;
- match-review queue with count;
- shortlists with count;
- published evidence;
- settings and signed-in user.

The active route uses the soft-pink surface and deep-pink text. The sidebar
collapses to icons at medium widths and becomes an accessible menu on small
screens.

### Top bar

- breadcrumb showing brand and current page;
- workspace search placeholder in the first release;
- compact provider-health status;
- no global primary action unless it applies across the current page.

### Page header

- short eyebrow;
- one clear page title;
- one-sentence purpose;
- no more than two prominent actions;
- primary action on the right.

## 6. Shared component inventory

Build reusable components before individual pages:

- `AppShell`
- `WorkspaceSidebar`
- `BrandSwitcher`
- `TopBar`
- `PageHeader`
- `PrimaryButton`
- `SecondaryButton`
- `QuietButton`
- `DestructiveButton`
- `StatusPill`
- `ImpactScore`
- `MetricStrip`
- `DataTable`
- `FilterBar`
- `EmptyState`
- `LoadingSkeleton`
- `InlineError`
- `ProviderStatus`
- `RunProgress`
- `CreatorIdentity`
- `EvidenceItem`
- `ContentAssetSummary`
- `MatchExplanation`
- `ReviewDecisionPanel`
- `ConfirmDialog`
- `Toast`

All components must support keyboard navigation and visible focus states.

## 7. Screen specification: brand overview

Route: `/app/brands/[brandId]`

### Purpose

Orient the user and expose the next useful action without turning the page into
a generic analytics dashboard.

### Header

- eyebrow: `Brand intelligence`
- brand name
- concise brand purpose summary
- secondary action: Edit brand
- primary action: Review creators when a queue exists; otherwise Start run

### Metric strip

Display only operational counts:

- approved phrases;
- strong content assets;
- review-ready creators;
- shortlisted experts.

Each metric links to the relevant collection.

### Latest run

Show:

- name;
- status;
- completion date;
- progress;
- queries;
- unique posts;
- enriched people;
- awaiting-review count;
- known provider cost;
- Review results and View run actions.

### Priority evidence

List the three highest-priority eligible content assets with:

- title;
- content type;
- target industry;
- current creator-match count.

### Brand focus

Compact summary of:

- priority industries;
- trusted subjects;
- one current target question.

### Next action

One contextual panel, normally the outstanding review queue. Do not invent a
secondary dashboard of charts.

### States

- first brand with no phrases or assets;
- ready to run discovery;
- run in progress;
- review queue available;
- provider failure requiring attention.

## 8. Screen specification: creator discovery results

Route: `/app/brands/[brandId]/creators`

### Purpose

Help the user compare candidates while keeping the preliminary nature of the
ranking clear.

### Header actions

- Export CSV
- Start/continue review

### Filters

- eligibility;
- review state;
- suggested impact;
- follower range;
- geography;
- relevant content count;
- matched content asset.

Filters update the URL query string and survive reloads.

### Table columns

- creator identity;
- professional focus;
- follower count;
- relevant evidence count;
- best matched content asset;
- suggested impact score;
- review state.

Default sort: strongest evidence-backed match, then data completeness. Do not
default to follower count.

### Row interaction

Selecting a row opens a desktop preview panel containing:

- name and follower count;
- eligibility status;
- suggested impact score;
- best matched asset;
- concise match explanation;
- strongest evidence excerpt;
- proposed collaboration angle;
- Review full match action.

On small screens, open the preview as a full-width drawer.

### Bulk actions

First release supports export and adding already-reviewed creators to a
shortlist. It must not bulk-accept unreviewed candidates.

### States

- loading;
- results available;
- no results for current filters;
- incomplete provider records;
- partial run;
- export preparing/ready/failed.

## 9. Screen specification: creator–content match review

Route: `/app/brands/[brandId]/matches/[matchId]`

### Purpose

Make a deliberate human decision using creator evidence, the exact brand asset,
and the target customer question together.

### Desktop layout

Three columns:

1. creator identity and eligibility;
2. content match, explanation, evidence, limitations, and collaboration angles;
3. sticky decision panel.

At medium and small widths, stack identity, evidence, then decision controls.

### Creator identity column

- name;
- professional focus;
- follower count;
- location;
- evidence count;
- profile completeness;
- eligibility status;
- profile link.

### Match column

- matched content asset;
- asset type and evidence-strength status;
- summary;
- target customer question;
- evidence-backed explanation;
- direct relevance evidence;
- expertise signal;
- data limitations and warnings;
- one to three editable collaboration angles.

The evidence must occupy more visual space than the suggested score.

### Decision panel

- editable impact score from 1 to 5;
- collaboration-angle selector;
- reviewer notes;
- shortlist selector;
- Reject, Maybe, and Accept actions;
- Save and review next.

### Decision behaviour

- save every decision with reviewer and timestamp;
- retain previous score and notes in the audit log;
- Accept can add the match to a selected shortlist;
- Maybe keeps it in a reviewable state;
- Reject requires an optional structured reason and retains the record;
- Save and review next follows the active queue/filter context.

### Keyboard behaviour

- number keys 1–5 set impact score when focus is not inside a field;
- `A` opens Accept confirmation;
- `M` saves Maybe;
- `R` opens Reject confirmation;
- shortcuts are discoverable and can be disabled.

## 10. Supporting page requirements

### Sign in

- email and password;
- controlled private-release account creation;
- no unnecessary marketing layout inside the app;
- clear error, loading, and expired-session states.

### Brand profile

Editable brand intelligence fields defined in `MASTER-PLAN.md`, including
industries, audiences, trusted subjects, competitors, claims, exclusions,
geography, language, and target questions.

The UI must distinguish the brand's product category from the industries it
targets. Require one to five target industries before discovery. Explain that
these values drive phrase expansion, run configuration, creator qualification,
and matching; do not present inferred or demo industries as saved user data.

Use a searchable, creatable multi-select backed by a broad organisational-buyer
taxonomy rather than a short closed dropdown. Canonical selections store a
stable internal taxonomy ID and version; custom selections preserve the user's
original wording and remain usable. Capture target segments and industry-specific
topics separately. External mappings such as LinkedIn or NAICS are adapters,
not the product's primary identity.

### Phrase library

- inline create/edit/archive;
- manual entry and CSV import;
- approval state;
- intent and source;
- usage count;
- selection for discovery runs.

### Content assets

- website scan and manual URL entry;
- title, URL, type, summary, topics, industries, claims, freshness, and evidence
  strength;
- eligibility toggle;
- linked target questions;
- creator-match count.

### Discovery runs

- run configuration;
- one or more selected target industries, required and snapshotted on the run;
- a preview of the approved topic × industry query matrix before provider spend;
- explicit stages and progress;
- provider counts and request IDs;
- errors by stage and record;
- retry failed stage;
- known cost;
- safe navigation away from the page.

### Shortlists

- named lists;
- approved creator–asset matches rather than bare profiles;
- manual outreach status;
- owner, notes, and export.

### Published evidence

- URL, creator, asset, question, channel, format, date, link status, disclosure,
  verification status, and outcome notes;
- useful empty state before the first publication.

## 11. Core database records

The first migration should implement:

- workspaces and membership;
- brands;
- brand industries, audiences, subjects, claims, and target questions;
- canonical/custom industry identity, taxonomy version, target segments, and
  industry-specific topics;
- phrase lists and phrases;
- content assets;
- discovery runs, run stages, and run queries;
- discovery-run industry snapshots and the industry/source-phrase attribution
  for every generated query;
- provider records;
- creator profiles and creator content;
- creator–asset matches and match evidence;
- review decisions;
- shortlists and shortlist members;
- outreach records;
- publications;
- audit events.

Every workspace-owned table includes `workspace_id`. Every brand-owned table
also includes `brand_id`. Use UUID primary keys and created/updated timestamps.

## 12. Internal service boundaries

### Brand service

- create/update/archive brand;
- update brand intelligence;
- manage target questions.

### Research service

- manage phrases and phrase lists;
- scan/manage content assets.

### Discovery service

- configure and start run;
- reject run creation without a selected saved target industry;
- generate reviewable topic × industry query candidates and persist the user's
  approved set;
- expose run status;
- retry a safe stage;
- normalize provider records;
- calculate deterministic eligibility.

### Matching service

- construct evidence packet;
- generate creator–asset suggestions;
- score target-industry evidence separately from topical expertise, audience
  relevance, and asset fit;
- store explanations, confidence, and limitations;
- never write a human decision.

### Review service

- save impact score;
- accept/maybe/reject;
- manage shortlist membership;
- write audit event.

### Outcome service

- manage outreach status;
- record publication evidence;
- save visibility observations.

## 13. Background workflow

The LinkedIn run executes as checkpointed stages:

1. validate limits, selected phrases, and at least one selected target industry;
2. create DataForSEO queries from the approved topic × industry matrix;
3. search and store raw results;
4. normalize and deduplicate LinkedIn content URLs;
5. select the capped post set;
6. request and poll Bright Data post snapshot;
7. extract dedicated authors;
8. exclude company pages;
9. request and poll capped person-profile snapshot;
10. normalize profiles and apply eligibility rules;
11. create evidence packets;
12. generate provisional creator–asset matches;
13. mark the run ready for review.

Each external call uses an idempotency record so a retry cannot silently create
a second paid request.

## 14. Loading, error, and empty states

Every implemented screen must include:

- immediate loading skeleton matching the eventual layout;
- an inline recoverable error with a clear retry action;
- a useful empty state with one primary action;
- partial-data rendering where safe;
- inaccessible or stale source indicators;
- no blank page during server or provider failures.

Provider terminology belongs in run details and diagnostics, not in ordinary
creator-review language.

## 15. Responsive requirements

### Desktop

- full sidebar;
- results table and preview side by side;
- three-column match review;
- sticky decision panel.

### Tablet

- icon sidebar;
- narrower tables with horizontal containment;
- stacked match-review columns;
- decision panel remains fully accessible.

### Mobile

- sidebar becomes a menu;
- tables become horizontally contained or use purpose-built list rows;
- creator preview becomes a drawer/full page;
- review sequence becomes creator → evidence → decision;
- controls remain at least 44px in effective touch size.

## 16. Accessibility requirements

- WCAG AA color contrast for ordinary text and controls;
- darker `#E8174F` for small white button text;
- native semantic controls;
- visible keyboard focus;
- logical headings and landmarks;
- labels for every input;
- table captions or accessible names;
- status updates announced without excessive repetition;
- no meaning communicated by color alone;
- prefers-reduced-motion respected.

## 17. Security requirements

- Supabase RLS verifies workspace membership;
- no client access to provider credentials, OpenAI key, or service role;
- all provider limits validated server-side;
- raw provider payload access restricted to authorized workspace users;
- user-supplied URLs validated before provider calls;
- audit consequential review and shortlist changes;
- rate-limit run creation and external API endpoints;
- redact credentials and authorization headers from logs.

## 18. Test strategy

### Unit tests

- URL normalization and deduplication;
- author extraction using the dedicated author field;
- person/company classification;
- follower and eligibility rules;
- target-industry evidence classification and adjacent-industry handling;
- score validation;
- provider payload normalization;
- review state transitions.

### Integration tests

- workspace and brand access isolation;
- create and resume discovery run;
- prevent an industry-less run and preserve its industry snapshot after the
  brand profile changes;
- provider failure and retry without duplicate request;
- save/reload review decision;
- shortlist membership;
- CSV export.

### End-to-end path

1. sign in;
2. create/select brand;
3. add phrases and content asset;
4. start bounded discovery run;
5. wait for review-ready state;
6. filter/select creator;
7. review evidence;
8. edit score and accept;
9. verify shortlist entry;
10. record a publication.

## 19. Build sequence

### Slice 1: Foundation and approved shell

- scaffold application;
- implement visual tokens and core components;
- configure Supabase and authentication;
- implement workspace/brand database boundary;
- build responsive application shell;
- deploy protected preview to Vercel.

### Slice 2: Brand intelligence

- brand overview;
- brand profile;
- target questions;
- phrase library;
- content-asset library with manual URL entry.

### Slice 3: Provider workflow

- move proven spike code behind typed adapters;
- create background run records and stages;
- add DataForSEO and Bright Data execution;
- build run progress and diagnostics;
- persist normalized creators and content.

### Slice 4: Matching and review

- evidence packets;
- creator–asset matching;
- creator results screen;
- match-review screen;
- review decisions and shortlists;
- CSV export.

### Slice 5: Outcomes

- manual outreach status;
- publication tracking;
- small visibility-observation workflow;
- final acceptance testing.

## 20. Definition of done for the first build slice

- deployed authenticated preview;
- approved Notion/Attio/pink visual system implemented as reusable tokens;
- responsive sidebar and top bar;
- user can create and switch between brands;
- brand overview renders real database records;
- RLS prevents cross-workspace access;
- empty/loading/error states are present;
- automated checks pass;
- no provider or service-role secrets appear in client code.
