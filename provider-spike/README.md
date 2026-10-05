# LinkedIn provider spike

This experiment tests a small public-data pipeline:

1. Search Google through DataForSEO for indexed LinkedIn posts.
2. Normalize and deduplicate the post URLs.
3. Enrich those posts through Bright Data.
4. Extract author profile URLs and enrich a capped set of profiles.
5. Rank the search evidence with a 1-5 impact rubric and produce JSON and CSV files for review.

The limits in `config.json` are deliberate spend controls. Raw and normalized
outputs are written beneath `provider-spike/runs/`, which is ignored by Git.

Run the complete provider pipeline:

```bash
npm run spike -- --industries=Education
```

Every run requires one to five explicit target industries. Pass a comma-separated
list with `--industries=Education,Healthcare`, or add `targetIndustries` to the
local config. Search records retain both the source phrase and target industry;
AI scoring treats industry fit as a separate evidence dimension and caps generic
candidates with no industry evidence.

The runner reserves at least one query for every selected industry before using
the remaining query budget. It rejects a run when `maxQueries` is too low to
cover all selected industries, so a capped run cannot silently skip an industry.
The local-only `plan` stage writes this allocation to `query-plan.json` without
calling a paid provider.

Run one stage:

```bash
npm run spike -- --stage=plan --industries=Education,Healthcare,Manufacturing,Hospitality,Retail
npm run spike -- --stage=search --industries=Education
npm run spike -- --stage=posts --run=provider-spike/runs/<run-id>
npm run spike -- --stage=authors --run=provider-spike/runs/<run-id>
npm run spike -- --stage=profiles --run=provider-spike/runs/<run-id>
npm run spike -- --stage=score --run=provider-spike/runs/<run-id>
```

Use `--limit=1` for a low-cost provider smoke test. The configured maximum still
acts as a hard ceiling even when a larger command-line limit is supplied.
The local-only `authors` stage rebuilds the author list from an existing post
snapshot without making another paid provider request.

The score stage can run from the normalized search results without Bright Data.
Post and profile enrichment require an active Bright Data customer account.

Credentials belong in the ignored `.env.local` file. Never commit that file.
