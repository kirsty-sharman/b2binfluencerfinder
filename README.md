# Creator Evidence

A multi-brand workspace for finding B2B experts, matching them to useful brand
content, and building human-reviewed creator shortlists.

## Current implementation

Build Slices 1–3 include:

- responsive Notion/Attio-inspired application shell;
- approved light visual system with the pink `#FF2D5F` accent;
- sign-in boundary with Supabase support;
- safe read-only preview mode when Supabase is not configured;
- multi-brand switcher and create-brand flow;
- searchable 220+ entry B2B buyer-industry taxonomy with custom entries,
  target segments, and industry-specific topics;
- brand overview backed only by saved database records, with truthful empty states;
- editable target questions;
- saved phrase library with draft, approved, and rejected states;
- content-asset library with manual URL entry, evidence review, and eligibility;
- initial Supabase schema, first-workspace provisioning, and row-level security;
- readiness checks that require industries, approved phrases, and eligible evidence before discovery;
- free, reviewable phrase × industry run planning before provider spend;
- checkpointed DataForSEO search and Bright Data post/profile enrichment;
- idempotent provider records, retry-safe stages, diagnostics, costs, and saved normalized evidence;
- deterministic person/follower-range qualification;
- placeholder routes for matching and outcomes;
- the working provider-spike runner.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Without Supabase values, the application opens in
local preview mode without seeded brand or provider data.

## Supabase setup

1. Create a Supabase project.
2. Apply the SQL files in `supabase/migrations/` in filename order.
3. Copy the project URL and publishable key into `.env.local`:

```ini
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
```

4. Create the first Auth user in Supabase.
5. Restart the development server and sign in.

The first brand creation provisions a workspace and owner membership through a
restricted authenticated database function. Every brand requires at least one
target industry; discovery and matching use those saved markets as explicit,
explainable inputs. Provider and service credentials must never be exposed
through `NEXT_PUBLIC_` variables.

## Checks

```bash
npm run typecheck
npm run lint
npm run build
```

## Provider spike

The reproducible LinkedIn provider experiment remains available:

```bash
npm run spike -- --stage=search --industries=Education
```

See `provider-spike/README.md` and `provider-spike/RESULTS.md` for details.

### Internal-link checks

Run `npm run check:links` while the local site is running (or pass a preview origin after `--`). The check crawls every XML-sitemap page, verifies internal destinations and section anchors, checks reachability from the homepage, and requires every published article to have an editorial inbound link. Run this after adding, removing or renaming pages/articles.

The footer's `/site-map` directory regenerates from public routes and published articles on deployment. For each new article, add relevant `relatedArticles` slugs and update at least one existing article to link back. Contextual links can be added to paragraph `sources` with a descriptive label and `/blog/<slug>` URL. Use destinations that genuinely expand the paragraph's subject; the check catches stale destinations but editorial relevance still needs review.
