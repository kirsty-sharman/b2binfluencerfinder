# Multi-channel B2B creator discovery: research and implementation plan

Research date: 29 September 2026. This document records the original research and intended scope. The six discovery adapters are now implemented locally and have undergone a small paid live pilot; see [pilot results](multi-channel-pilot-results.md) for verified behavior and remaining limitations. The broader production targets below are not all demonstrated by that small sample.

## Product decision

Keep LinkedIn as one discovery adapter. Add podcasts, newsletters, YouTube, X and independent blogs to one shared creator system. A creator needs a relevant publishing channel, not a LinkedIn profile. A single person may own several channels; a publication can have multiple hosts or authors.

Google is a discovery route across channels, not itself a creator channel. We cannot promise exhaustive coverage of all creators: indexing, private archives, feeds and provider access differ. Report which channels were searched, which failed, and how much evidence was inspected.

## Recommended collection methods

| Channel | Discovery | Evidence collection | Identity to establish |
| --- | --- | --- | --- |
| LinkedIn | Preserve current DataForSEO searches; improve query variants later | Existing Bright Data post/profile adapters | Actual author and LinkedIn profile |
| Newsletters | DataForSEO public Google search: Substack, beehiiv and unrestricted newsletter queries | Public About/archive pages, linked articles, RSS when discoverable | Publication, author/editor and ownership of linked profiles |
| YouTube | Official YouTube Data API topic/video/channel searches; Google as supplemental discovery | Channel metadata, uploads playlist, recent relevant video metadata; public/authorised transcripts where available | Channel ID, presenter/owner, official website links |
| Podcasts | Podcast Index show discovery plus Google episode/show-note searches | Public RSS, recent episode descriptions, host pages and published transcripts | Canonical show/feed and actual host, separately from guests |
| X | Official X post search, author expansion/lookup and user timeline; Google for seed discovery | Original recent posts and substantive threads, profile metadata | Stable account ID, author and linked official sites |
| Blogs | DataForSEO unrestricted web searches for industry expertise | Article text, bylines, author pages, public feeds | Author rather than automatically treating the entire domain as one person |

### Newsletters: the API trap

beehiiv's list-publications endpoint only returns publications associated with the authenticated key. It is not a platform-wide discovery API. Substack documents a publication RSS feed at `/feed`; beehiiv can generate a unique feed URL, so we should discover feeds from public pages rather than guess a universal path. Public archives remain the fallback. Do not depend on an undocumented Substack internal API.

Use both platform-domain queries and general queries: custom-domain publications must not disappear from coverage. Newsletter subscriber counts and open rates are unknown unless reliably published or voluntarily connected by the owner; do not infer them from followers.

Sources: [beehiiv publications API](https://developers.beehiiv.com/api-reference/publications/index), [Substack RSS](https://support.substack.com/hc/en-us/articles/360038239391-Is-there-an-RSS-feed-for-my-publication), [beehiiv RSS](https://www.beehiiv.com/support/article/9363537272215).

### YouTube: official metadata first

The official API supports video and channel search. Resolve promising videos to their channel, inspect recent uploads, and collect available subscriber/video statistics. Subscriber figures can be rounded or hidden. Separate long-form, Shorts and live content when describing publishing capability; avoid one viral video determining rank.

The official caption-download endpoint requires permission to edit the video. Do not promise transcripts for arbitrary channels through that endpoint. Missing transcripts should reduce evidence confidence, not trigger invented summaries. Describe title/description evidence honestly and route insufficient evidence to an internal research queue.

Current Google documentation lists a default 100 search calls per day and 10,000 daily units for other endpoints. Confirm the actual project quota before the pilot; cache discovery and use uploads playlists for subsequent channel inspection. Do not embed historical quota assumptions in the code.

Sources: [search](https://developers.google.com/youtube/v3/docs/search/list), [quota overview](https://developers.google.com/youtube/v3/getting-started), [channel metadata](https://developers.google.com/youtube/v3/docs/channels), [caption download](https://developers.google.com/youtube/v3/docs/captions/download).

### Podcasts: discover shows, prove the host

Podcast Index documents show search and episode retrieval by feed ID/URL. Search sector terms to find shows, then examine relevant episodes from their feeds. Google complements show-level retrieval by finding indexed episode pages. Podcast Index metadata search should not be described as full audio/transcript search. Its core index is advertised as free; authentication and service limits still apply.

A guest discussing banking once is not necessarily the owner of a banking podcast. Store host, co-host, guest and publisher relationships separately. Treat a video edition on YouTube as another channel of the same show where ownership is verified. RSS does not establish downloads or audience demographics; keep those unknown without a reliable source.

Listen Notes is a possible later search upgrade. Its current Pro pricing starts at $200 when used, with 5,000 requests included, but Free/Pro prohibit most server-side caching/storage. Our persistent evidence library therefore needs an appropriate Enterprise/data agreement or a different provider; do not build around unrestricted retention of Pro responses.

Sources: [Podcast Index API specification](https://podcastindex-org.github.io/docs-api/pi_api.json), [Podcast Index core-index statement](https://podcastindex.org/apps?appTypes=app&elements=Chapters%2CValue), [Listen Notes pricing and storage conditions](https://www.listennotes.com/api/pricing/).

### X: approved access and bounded search

X documents recent search for the last seven days and full-archive search for pay-per-use/Enterprise access. Use topic synonyms and original-post filters, then inspect identified accounts over a longer period using available timeline/archive access. A seven-day window alone misses slower-publishing specialists.

Use stable user IDs, original-post evidence, dates and available public metrics. Google's indexed profiles/posts can supply seeds, but should not be presented as complete X coverage. Confirm account access, storage/refresh requirements and endpoint charges in the developer console before committing to a production budget. Exact current unit pricing was not established in this research. Bright Data can remain an alternative-provider evaluation, not an assumed extension of our existing LinkedIn dataset entitlement.

Source: [X search documentation](https://docs.x.com/x-api/posts/search/introduction).

### Shared web search

Reuse the existing DataForSEO integration, generalising its LinkedIn-only URL filtering into channel-specific result handling. It already provides Google organic results. Search snippets are candidate-discovery signals; fetch the original article/profile before treating a claim as evidence.

Source: [DataForSEO Google organic search](https://docs.dataforseo.com/v3/serp/google/organic/live/advanced/).

## Query design

Separate customer visibility prompts from creator-discovery queries. Build a discovery brief from saved target industries, relevant buyer roles and problems, language/geography, and the active content assets.

Use three query families: industry/role expertise; relevant editorial topics; and specific asset angles. Do not require every candidate to mention our brand or the exact phrase “referral marketing.” A banking growth specialist can qualify through related expertise, provided the final asset match is evidenced.

Illustrative queries, not tested recall guarantees:

- Newsletter: `banking growth newsletter`, `site:substack.com credit union acquisition`, `site:beehiiv.com wealth management`.
- Podcast: `credit union growth podcast`, `financial advisor client acquisition podcast`, `vocational training enrolment podcast`.
- YouTube: native searches for `bank customer acquisition` and `financial advisor referrals`, plus channel discovery.
- X: `(banking OR "credit unions") (growth OR acquisition) -is:retweet lang:en`.
- Blog: `financial advisor client acquisition author`, `professional training enrolment strategy blog`.

Search industries individually and allocate a minimum query allowance per requested channel. Never let LinkedIn or a high-volume industry exhaust the whole run. Expand successful query families only within the budget; log actual executed queries and skipped sources.

## A quality gate shared by every channel

Proposed initial policy, to calibrate in a pilot:

1. Verify a real person or editorial team controls/contributes to the channel. Do not merge identities by name alone.
2. Verify sustained original publishing. Inspect up to 10 recent items; normally require at least three substantive items and recent activity within 180 days. Allow slower publishing cadence to be reviewed explicitly.
3. Find direct evidence of relevance to at least one saved target industry. Distinguish content aimed at professional buyers from consumer content about the same topic. Do not invent measured audience demographics.
4. Require at least two useful source items supporting the proposed expertise/angle, with evidence quality and confidence recorded. A bio alone is insufficient.
5. Match against the active asset set, never the full collected brand library. Require a natural, evidence-backed angle and a suitable publishing format. No unconditional creator-by-every-asset Cartesian pairing.
6. Put only creators with a passing asset/channel match into the main Creators table. Keep incomplete candidates internally with clear exclusion or retry reasons.

Audience size is a separate reach signal. Do not apply the LinkedIn 1,000-follower threshold to every channel; unknown newsletter/podcast audience figures are not zero. Use native metrics without summing followers across channels into a fictional unique audience. Preserve creator-level acceptance, shortlist and brand-specific rejection decisions across rediscovery; provide a restore control for exclusions.

## Data and application changes

Introduce additive tables and migrate existing rows without losing IDs, decisions, evidence or shortlists:

- `creator_channels`: platform, stable external ID, canonical URL, display name, publication/feed ID, timestamps, channel status and native metrics with provenance.
- `creator_channel_roles`: creator-to-channel relationships (owner, host, author, editor, guest), source proof and confidence. Supports shared publications and editorial teams.
- Generalise `creator_content` to channel/content IDs, canonical URL, content type, author attribution, publication date, excerpt and evidence level. Keep existing LinkedIn columns during migration.
- Per-channel run jobs: adapter/version, query, cursor/checkpoint, request cost, retry state, results and exclusion counts. Durable background execution must survive browser closure and request timeout.
- Creator–asset recommendations include the recommended channel and format, matched industry, supporting evidence IDs, score, confidence and assessment versions.
- Provider-specific refresh/retention rules; avoid assuming every provider allows indefinite raw-response storage.

Auto-merge channels only using strong ownership proof (official cross-links, verified author pages or owner connection). Queue ambiguous identities for review. Podcast show names, people and publishers must remain distinct entities.

The user experience remains one Creators table: channel badges, verified publishing activity, industry fit, strongest evidence, best matched asset and one Accept & shortlist action. View matches includes the recommended channel/format. Runs show the coverage and failure state of each selected channel; zero results and “source unavailable” are different outcomes.

## Delivery sequence

1. **Foundation:** channel/identity schema, additive LinkedIn migration, adapter interface, durable jobs, budget accounting, common quality gate and persistent creator exclusions. Regression-test the existing LinkedIn flow.
2. **Web and newsletters:** generalise DataForSEO results, add public article/author/archives and RSS processing, detect custom-domain publications. This also supplies podcast and X seeds.
3. **YouTube and podcasts:** add official YouTube and Podcast Index adapters; prove video-to-channel and episode-to-host attribution; retain source-specific missing-data labels.
4. **X:** validate approved API access and endpoint economics, then implement post discovery, account enrichment and bounded ongoing coverage. Treat limited access as an explicit limitation, not completed coverage.
5. **Unified evaluation and rollout:** calibrate relevance and match gates, merge cross-channel identities, ship channel filters and coverage diagnostics. Keep adapters individually switchable so one source failure does not stop the run.

All six channels are in the planned product scope. This sequence is an implementation order, not a claim that newsletters or X can be dropped.

## Pilot and acceptance criteria

Propose a bounded pilot covering finance and education: up to 15 candidates per channel (90 channel candidates before deduplication), up to 10 public recent items per candidate, with per-provider request and monetary ceilings set before execution. Existing credentials can support web/LinkedIn evaluation; YouTube project credentials, Podcast Index credentials and approved X access are additional setup work. No newsletter account key is required for the public-web approach.

Compare both industries per channel. Measure: retrieved candidates, fetch success, correctly identified authors/hosts, publishing activity, industry relevance, usable evidence, valid asset matches, duplicates, and cost per review-ready creator. Do not measure success by raw profile count.

Proposed release targets: every surfaced match has cited source evidence and an active asset; no automatic identity merge based solely on name; at least 80% of a manually reviewed surfaced sample has genuine industry/asset fit; all requested channels have an honest coverage status; retrying creates no duplicate creators or shortlists; hidden audience metrics never become invented numbers. These are targets, not demonstrated results.

Tests should cover a podcast guest mistaken for a host; a creator with both YouTube and newsletter accounts; a custom-domain newsletter; missing transcripts and audience metrics; stale/deleted source content; one provider failing; a rejected creator rediscovered on another channel; profile target changes; and the existing 20-asset maximum.

Budget formula: search requests + selected channel/profile enrichments + permitted content retrieval + AI evidence assessment + optional transcript access. Record actual cost per accepted-quality candidate in the pilot before choosing subscriptions or projecting production spend.
