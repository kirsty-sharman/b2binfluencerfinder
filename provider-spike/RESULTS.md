# LinkedIn provider spike results

Date: 26 September 2026

## Decision

Use DataForSEO as the first-release LinkedIn discovery source, then enrich the
shortlisted post authors with Bright Data. Both providers passed their capped
technical tests. The end-to-end provider combination is suitable for the first
release, subject to manual relevance review and cost monitoring on larger runs.

This is suitable for an asynchronous, review-led workflow. It is not yet strong
enough for fully automatic creator acceptance.

## What was tested

- Five Referral Factory seed phrases.
- Two Google patterns per phrase: indexed LinkedIn posts and articles.
- United States, English, depth 20.
- Ten DataForSEO queries in total.
- A capped 20-candidate OpenAI evidence-ranking pass using the brief's 1-5
  impact score.
- One-record Bright Data post and profile smoke tests before the capped batches.
- A 30-post Bright Data batch and a 20-person profile batch.

## Results

| Test | Result |
| --- | --- |
| DataForSEO queries | 10/10 completed |
| Raw LinkedIn results | 115 |
| Unique LinkedIn content URLs | 109 |
| DataForSEO reported cost | $0.1525 |
| Candidates sent to AI ranking | 20 |
| AI ranking usage | 8,137 tokens |
| Bright Data post enrichment | 30/30 records returned |
| Unique authors | 28: 22 people and 6 companies |
| Bright Data profile enrichment | 20/20 person profiles returned |
| Profiles with name, URL, and follower count | 20/20 |
| Profiles in configured 1,000-100,000 follower range | 20/20 |
| Enriched follower range | 2,253-72,082 |
| Profiles with activity data | 19/20 |
| Profiles with article/post data | 13/20 |

DataForSEO returned genuinely relevant individual posts, but also handles that
may be organizations, weak matches, and content whose current freshness cannot
be established from the search result alone. That makes it a good candidate
generator, not a complete creator database. Bright Data then supplied the
identity, account type, follower count, location, biography, experience, and
available activity/content needed for verification.

The post response also contains linked and recommended profiles. An initial
recursive URL extractor therefore produced 79 apparent candidates from 30
posts. The implementation was corrected to use Bright Data's dedicated author
URL field only, producing 28 actual authors. This is an important production
guardrail.

## Provisional shortlist

These are the five strongest candidates from indexed snippets. The capped
profile batch covered only part of this list, and all candidates still require
human review.

| Candidate | Impact | Evidence signal |
| --- | ---: | --- |
| John Jantsch | 5 | Author and practitioner discussing a systemized referral-marketing framework |
| Olumide Lawrence | 5 | Practical B2B referral strategy and trust-transfer framing |
| Steve Paoli | 5 | Operational SaaS referral-program details and integrations |
| Michał Śledziowski | 5 | Nuanced distinction between affiliate and SaaS referral mechanics |
| Ryan Reisert | 5 | Useful SaaS referral audit checklist; Bright Data resolved the opaque handle to a person with 43,029 followers |

The fifth result illustrates the value of profile enrichment: search exposed
only the handle `salesdevelopmentrepresentative`, while Bright Data resolved
the person's name and follower count.

## Recommended first-release pipeline

1. Expand a saved phrase list into LinkedIn-specific Google queries.
2. Run the queries asynchronously through DataForSEO.
3. Normalize and deduplicate content URLs, retaining query, rank, snippet, and
   collection date as evidence.
4. Use Bright Data to fetch the capped set of posts, extract their authors, and
   enrich individual profiles.
5. Apply deterministic filters first: individual account, follower range,
   recent activity, enough relevant posts, and no obvious company/brand page.
6. Generate a 1-5 impact suggestion from the collected evidence.
7. Present the candidate, evidence links, provider data, and suggested score for
   manual accept/reject/edit before saving to the master creator list.

The app should store each run and each provider response as time-stamped
evidence. Searches will run over minutes and may be revisited over weeks, so
this belongs in a background job rather than a single synchronous page request.

## Release gate

The provider integration gate has passed. Before broadening the first release,
manually inspect the 20 enriched candidates and record:

- percentage active in the last 90 days, using dated content evidence;
- percentage a reviewer would genuinely shortlist;
- Bright Data cost from the account dashboard, because the dataset response did
  not include a per-snapshot charge.

Do not automate outreach or automatic acceptance in the first release. The
brief calls for careful personal selection and outreach, and the spike supports
keeping that judgment in the loop.

## Artifacts

- `run.mjs`: reproducible provider runner with hard request caps.
- `config.json`: phrases, query patterns, geography, and spend controls.
- `runs/2026-09-26T13-10-10-030Z/normalized-posts.json`: 109 deduplicated
  LinkedIn content results.
- `runs/2026-09-26T13-10-10-030Z/ai-ranked-creators.csv`: provisional ranked
  review list.
- `runs/2026-09-26T13-10-10-030Z/enriched-posts.json`: 30 Bright Data post
  records.
- `runs/2026-09-26T13-10-10-030Z/enriched-profiles.json`: 20 Bright Data person
  profiles.
- `runs/2026-09-26T13-10-10-030Z/creator-review.csv`: enriched profiles ready
  for manual acceptance and scoring.

Run outputs and credentials are intentionally ignored by Git.
