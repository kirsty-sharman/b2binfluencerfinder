import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const config = JSON.parse(await readFile(path.join(root, "provider-spike/config.json"), "utf8"));
const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.replace(/^--/, "").split("=");
  return [key, rest.join("=") || true];
}));
const stage = args.stage || "all";
const runId = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const runDir = args.run ? path.resolve(root, args.run) : path.join(root, "provider-spike/runs", runId);
const targetIndustries = (args.industries
  ? String(args.industries).split(",")
  : config.targetIndustries || [])
  .map((industry) => industry.trim())
  .filter(Boolean);

if (targetIndustries.length === 0) {
  throw new Error("At least one target industry is required. Use --industries=Education or add targetIndustries to config.json.");
}
if (targetIndustries.length > 5) throw new Error("Use no more than five target industries per run.");

const DATAFORSEO_URL = "https://api.dataforseo.com/v3/serp/google/organic/live/regular";
const BRIGHTDATA_TRIGGER_URL = "https://api.brightdata.com/datasets/v3/trigger";
const BRIGHTDATA_BASE_URL = "https://api.brightdata.com/datasets/v3";
const BRIGHTDATA_POSTS_DATASET = "gd_lyy3tktm25m4avu764";
const BRIGHTDATA_PROFILES_DATASET = "gd_l1viktl72bvl7bjuj0";
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function canonicalLinkedInUrl(raw) {
  try {
    const url = new URL(raw);
    url.protocol = "https:";
    url.hostname = "www.linkedin.com";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

function isLinkedInContentUrl(url = "") {
  return /linkedin\.com\/(posts|pulse)\//i.test(url);
}

function profileFromPostUrl(postUrl) {
  try {
    const url = new URL(postUrl);
    if (!url.pathname.startsWith("/posts/")) return null;
    const slug = url.pathname.split("/").filter(Boolean)[1];
    const handle = slug?.split("_activity-")[0]?.split("_")[0];
    if (!handle || handle.length < 2) return null;
    return `https://www.linkedin.com/in/${handle}`;
  } catch {
    return null;
  }
}

function authorProfileUrlsFromPosts(enrichedPosts, searchedPosts = []) {
  const profileUrls = new Set();
  for (const post of Array.isArray(enrichedPosts) ? enrichedPosts : []) {
    const authorUrl = post.use_url || post.user_url || post.author_url || post.profile_url;
    if (typeof authorUrl === "string" && /linkedin\.com\/(in|company)\//i.test(authorUrl)) {
      profileUrls.add(canonicalLinkedInUrl(authorUrl));
    }
  }
  if (profileUrls.size === 0) {
    for (const post of searchedPosts) {
      const inferred = profileFromPostUrl(post.url);
      if (inferred) profileUrls.add(inferred);
    }
  }
  return [...profileUrls];
}

async function fetchJson(url, options, label) {
  const response = await fetch(url, options);
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    const excerpt = text.replace(/\s+/g, " ").trim().slice(0, 500);
    throw new Error(`${label} returned HTTP ${response.status} with a non-JSON response${excerpt ? `: ${excerpt}` : ""}`);
  }
  if (!response.ok) {
    const safeMessage = data?.message || data?.error || data?.status_message || `HTTP ${response.status}`;
    throw new Error(`${label} failed: ${safeMessage}`);
  }
  return data;
}

async function writeJson(name, value) {
  await writeFile(path.join(runDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson(name) {
  return JSON.parse(await readFile(path.join(runDir, name), "utf8"));
}

function csvEscape(value) {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildSearchQueryPlan() {
  const queries = [];
  for (const phrase of config.phrases) {
    for (const industry of targetIndustries) {
      for (const pattern of config.queryPatterns) {
        const baseQuery = pattern.replace("{phrase}", phrase);
        queries.push({ industry, phrase, query: `${baseQuery} "${industry}"` });
      }
    }
  }
  if (config.maxQueries < targetIndustries.length) {
    throw new Error(`maxQueries must be at least ${targetIndustries.length} so every selected industry is searched.`);
  }
  const firstPerIndustry = targetIndustries
    .map((industry) => queries.find((query) => query.industry === industry))
    .filter(Boolean);
  const selectedKeys = new Set(firstPerIndustry.map((query) => `${query.industry}\u0000${query.phrase}\u0000${query.query}`));
  const remaining = queries.filter((query) => !selectedKeys.has(`${query.industry}\u0000${query.phrase}\u0000${query.query}`));
  return [...firstPerIndustry, ...remaining].slice(0, config.maxQueries);
}

async function planStage() {
  const selected = buildSearchQueryPlan();
  await writeJson("query-plan.json", {
    targetIndustries,
    queries: selected,
    queryCountByIndustry: Object.fromEntries(targetIndustries.map((industry) => [
      industry,
      selected.filter((query) => query.industry === industry).length,
    ])),
  });
  console.log(`Query plan complete: ${selected.length} queries across ${targetIndustries.length} target industries`);
}

async function searchStage() {
  const login = required("DATAFORSEO_LOGIN");
  const password = required("DATAFORSEO_PASSWORD");
  const authorization = Buffer.from(`${login}:${password}`).toString("base64");
  const selected = buildSearchQueryPlan();
  const raw = [];
  const normalized = [];

  for (let index = 0; index < selected.length; index += 1) {
    const { industry, phrase, query } = selected[index];
    console.log(`[search ${index + 1}/${selected.length}] ${industry} × ${phrase}`);
    let data;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      data = await fetchJson(DATAFORSEO_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authorization}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify([{
          keyword: query,
          location_code: config.locationCode,
          language_code: config.languageCode,
          depth: config.searchDepth
        }])
      }, "DataForSEO");
      const task = data?.tasks?.[0];
      if (task?.status_code === 20000) break;
      console.warn(`  attempt ${attempt} failed: ${task?.status_message || "unknown task error"}`);
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    raw.push({ industry, phrase, query, data });
    const task = data?.tasks?.[0];
    if (task?.status_code !== 20000) {
      console.warn(`  skipping query after retries`);
      await writeJson("raw-search-results.partial.json", raw);
      continue;
    }
    const items = task?.result?.[0]?.items || [];
    for (const item of items) {
      if (item.type !== "organic" || !isLinkedInContentUrl(item.url)) continue;
      normalized.push({
        industry,
        phrase,
        query,
        rank: item.rank_absolute ?? item.rank_group ?? null,
        title: item.title || "",
        description: item.description || "",
        url: canonicalLinkedInUrl(item.url),
        domain: item.domain || ""
      });
    }
  }

  const unique = [...new Map(normalized.map((item) => [item.url, item])).values()];
  await writeJson("raw-search-results.json", raw);
  await writeJson("normalized-posts.json", unique);
  await writeJson("search-summary.json", {
    targetIndustries,
    queries: selected.length,
    rawLinkedInResults: normalized.length,
    uniquePostUrls: unique.length,
    providerReportedCost: raw.reduce((sum, entry) => sum + Number(entry.data?.cost || entry.data?.tasks?.[0]?.cost || 0), 0)
  });
  console.log(`Search complete: ${unique.length} unique LinkedIn posts`);
}

async function brightDataScrape(datasetId, urls, label) {
  if (urls.length === 0) return [];
  const token = required("BRIGHTDATA_API_TOKEN");
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };
  const trigger = await fetchJson(`${BRIGHTDATA_TRIGGER_URL}?dataset_id=${datasetId}&format=json&include_errors=true`, {
    method: "POST",
    headers,
    body: JSON.stringify(urls.map((url) => ({ url })))
  }, `${label} trigger`);
  const snapshotId = trigger?.snapshot_id;
  if (!snapshotId) throw new Error(`${label} did not return a snapshot ID`);
  console.log(`  Bright Data snapshot: ${snapshotId}`);

  for (let attempt = 1; attempt <= 60; attempt += 1) {
    const progress = await fetchJson(`${BRIGHTDATA_BASE_URL}/progress/${snapshotId}`, {
      headers: { Authorization: `Bearer ${token}` }
    }, `${label} progress`);
    const status = progress?.status;
    if (status === "ready") {
      return fetchJson(`${BRIGHTDATA_BASE_URL}/snapshot/${snapshotId}?format=json`, {
        headers: { Authorization: `Bearer ${token}` }
      }, `${label} snapshot`);
    }
    if (status === "failed") throw new Error(`${label} snapshot failed`);
    if (attempt === 1 || attempt % 6 === 0) console.log(`  Bright Data status: ${status || "pending"}`);
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error(`${label} timed out waiting for snapshot ${snapshotId}`);
}

async function postsStage() {
  const posts = await readJson("normalized-posts.json");
  const requestedLimit = args.limit ? Number(args.limit) : config.maxPostEnrichments;
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) throw new Error("--limit must be a positive integer");
  const selected = posts.slice(0, Math.min(requestedLimit, config.maxPostEnrichments));
  console.log(`Enriching ${selected.length} LinkedIn posts`);
  const enriched = await brightDataScrape(BRIGHTDATA_POSTS_DATASET, selected.map((post) => post.url), "Bright Data post scraper");
  await writeJson("enriched-posts.json", enriched);
  const uniqueProfiles = authorProfileUrlsFromPosts(enriched, selected);
  await writeJson("profile-urls.json", uniqueProfiles);
  console.log(`Post enrichment complete: ${uniqueProfiles.length} candidate profiles`);
}

async function authorsStage() {
  const enriched = await readJson("enriched-posts.json");
  const posts = await readJson("normalized-posts.json");
  const uniqueProfiles = authorProfileUrlsFromPosts(enriched, posts.slice(0, enriched.length));
  await writeJson("profile-urls.json", uniqueProfiles);
  console.log(`Author extraction complete: ${uniqueProfiles.length} candidate profiles`);
}

async function profilesStage() {
  const profileUrls = await readJson("profile-urls.json");
  const requestedLimit = args.limit ? Number(args.limit) : config.maxProfileEnrichments;
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) throw new Error("--limit must be a positive integer");
  const people = profileUrls.filter((url) => /linkedin\.com\/in\//i.test(url)).slice(0, Math.min(requestedLimit, config.maxProfileEnrichments));
  console.log(`Enriching ${people.length} LinkedIn profiles`);
  const profiles = await brightDataScrape(BRIGHTDATA_PROFILES_DATASET, people, "Bright Data profile scraper");
  await writeJson("enriched-profiles.json", profiles);

  const headers = [
    "name", "profile_url", "followers", "headline", "location", "accepted", "relevance_0_3",
    "expertise_0_3", "content_fit_0_2", "data_quality_0_1", "active_0_1", "total_0_10", "notes"
  ];
  const rows = (Array.isArray(profiles) ? profiles : []).map((profile) => {
    const name = profile.name || profile.full_name || "";
    const url = profile.url || profile.linkedin_url || profile.profile_url || "";
    const followers = profile.followers || profile.followers_count || profile.connections || "";
    const headline = profile.position || profile.headline || profile.current_title || "";
    const location = profile.city || profile.location || profile.country_code || "";
    return [name, url, followers, headline, location, "", "", "", "", "", "", "", ""];
  });
  const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
  await writeFile(path.join(runDir, "creator-review.csv"), `${csv}\n`);
  await writeJson("run-summary.json", {
    runDirectory: path.relative(root, runDir),
    profilesRequested: people.length,
    profilesReturned: Array.isArray(profiles) ? profiles.length : 0,
    reviewFile: "creator-review.csv"
  });
  console.log(`Profile enrichment complete: ${rows.length} rows ready for review`);
}

function displayNameFromPost(post) {
  const title = (post.title || "").trim();
  const patterns = [
    /\|\s*([^|]+)$/,
    /^([^|'’]+?)(?:'s|’s)\s+Post/i,
    /^([^:–—-]{2,60})\s+[–—-]/
  ];
  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  try {
    return new URL(post.url).pathname.split("/").filter(Boolean)[1]?.split("_")[0] || title;
  } catch {
    return title;
  }
}

function responseOutputText(response) {
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

async function scoreStage() {
  const posts = await readJson("normalized-posts.json");
  const grouped = new Map();
  for (const post of posts) {
    const profileUrl = profileFromPostUrl(post.url);
    if (!profileUrl) continue;
    if (!grouped.has(profileUrl)) grouped.set(profileUrl, []);
    if (grouped.get(profileUrl).length < 3) grouped.get(profileUrl).push(post);
  }
  const candidates = [...grouped.entries()].slice(0, 20).map(([profileUrl, evidence]) => ({
    profile_url: profileUrl,
    name: displayNameFromPost(evidence[0]),
    evidence: evidence.map((post) => ({
      industry: post.industry,
      phrase: post.phrase,
      title: post.title,
      excerpt: post.description,
      url: post.url
    }))
  }));
  const schema = {
    type: "object",
    properties: {
      creators: {
        type: "array",
        items: {
          type: "object",
          properties: {
            profile_url: { type: "string" },
            name: { type: "string" },
            impact_score: { type: "integer", minimum: 1, maximum: 5 },
            topic_relevance: { type: "integer", minimum: 0, maximum: 2 },
            target_industry_fit: { type: "integer", minimum: 0, maximum: 2 },
            expertise_evidence: { type: "integer", minimum: 0, maximum: 2 },
            natural_content_fit: { type: "integer", minimum: 0, maximum: 1 },
            reason: { type: "string" },
            evidence_url: { type: "string" }
          },
          required: ["profile_url", "name", "impact_score", "topic_relevance", "target_industry_fit", "expertise_evidence", "natural_content_fit", "reason", "evidence_url"],
          additionalProperties: false
        }
      }
    },
    required: ["creators"],
    additionalProperties: false
  };
  const prompt = [
    `Rank public LinkedIn creator candidates for ${config.brand}.`,
    `The selected target industries for this run are: ${targetIndustries.join(", ")}.`,
    "We want genuine subject-matter experts who could naturally discuss or critique a useful brand report, guide, case study, or teardown.",
    "Score only from the supplied indexed post evidence. Do not assume missing follower counts, employment, expertise, or activity.",
    "Prefer individuals over company pages. Reward direct topical and target-industry evidence; penalize generic marketing mentions that do not demonstrate industry fit.",
    "Use this rubric: topic_relevance 0-2 (none, adjacent, direct); target_industry_fit 0-2 (no evidence, adjacent, direct evidence in a selected industry); expertise_evidence 0-2 (none, some insight, strong demonstrated expertise); natural_content_fit 0-1 (could naturally share or critique substantive brand content).",
    "Set impact_score to a holistic 1-5 score. A candidate with target_industry_fit 0 cannot score above 3, even when their generic topic evidence is strong.",
    "Return every candidate exactly once, ordered from strongest to weakest fit.",
    JSON.stringify(candidates)
  ].join("\n\n");
  console.log(`Scoring ${candidates.length} candidates with OpenAI`);
  const response = await fetchJson(OPENAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${required("OPENAI_API_KEY")}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-5-mini",
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "creator_fit_ranking",
          strict: true,
          schema
        }
      }
    })
  }, "OpenAI scoring");
  const outputText = responseOutputText(response);
  if (!outputText) throw new Error("OpenAI scoring returned no output text");
  const ranked = JSON.parse(outputText).creators.map((creator) => ({
    ...creator,
    impact_score: creator.target_industry_fit === 0
      ? Math.min(3, creator.impact_score)
      : creator.impact_score
  })).sort((a, b) => b.impact_score - a.impact_score);
  await writeJson("ai-ranked-creators.json", ranked);
  const headers = ["rank", "name", "profile_url", "impact_score", "topic_relevance", "target_industry_fit", "expertise_evidence", "natural_content_fit", "reason", "evidence_url"];
  const rows = ranked.map((creator, index) => [
    index + 1, creator.name, creator.profile_url, creator.impact_score, creator.topic_relevance,
    creator.target_industry_fit, creator.expertise_evidence, creator.natural_content_fit, creator.reason, creator.evidence_url
  ]);
  await writeFile(path.join(runDir, "ai-ranked-creators.csv"), `${[headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n")}\n`);
  await writeJson("ai-usage.json", response.usage || {});
  console.log(`AI ranking complete: ${ranked.length} candidates`);
}

await mkdir(runDir, { recursive: true });
await writeJson("config-used.json", { ...config, targetIndustries });

if (stage === "plan") await planStage();
if (stage === "search" || stage === "all") await searchStage();
if (stage === "posts" || stage === "all") await postsStage();
if (stage === "authors") await authorsStage();
if (stage === "profiles" || stage === "all") await profilesStage();
if (stage === "score") await scoreStage();

console.log(`Run directory: ${path.relative(root, runDir)}`);
