import { filtersFor, type ChannelFilters } from "./channels/filters";
import { channelAvailability } from "@/lib/channels/config";
import type { Channel } from "@/lib/channels/core";
import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dataForSeoAdapter } from "@/lib/providers/dataforseo";
import { brightDataAdapter } from "@/lib/providers/brightdata";
import { canonicalLinkedInUrl } from "@/lib/providers/shared";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type RunStatus = "draft" | "queued" | "running" | "ready" | "failed" | "cancelled";
export type DiscoveryRunSummary = {
  id: string;
  name: string;
  status: RunStatus;
  queryCount: number;
  rawResultCount: number;
  uniqueContentCount: number;
  profileCount: number;
  providerCost: number;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};
export type DiscoveryRunDetail = DiscoveryRunSummary & {
  brandSlug: string;
  industries: string[];
  config: { focus?:string; queryPlanning?: {version:number;model:string;explanations:import("./channels/query-planner").QueryExplanation[];assets:{id:string;title:string}[]}; locationCode: number; languageCode: string; searchDepth: number; maxPosts: number; maxProfiles: number; minFollowers: number; maxFollowers: number; channels?: Channel[]; channelFilters?: Partial<Record<Channel,ChannelFilters>>; phraseIds?:string[]; version?: number };
  resumable?: boolean;
  collectedCandidates?: Array<{channel:Channel;name:string;url:string;qualification:{qualified?:boolean;reason?:string};evidence:Array<{url:string;title:string;publishedAt:string|null}>}>;
  channelJobs?: Array<{channel: Channel; status:string; candidate_count:number; qualified_count:number; request_count:number; provider_cost:number; error_message:string|null; lease_until:string|null}>;
  queries: Array<{ channel: Channel; id: string; phrase: string; industry: string; query: string; approved: boolean; status: string; resultCount: number; cost: number; error: string | null }>;
  stages: Array<{ id: string; key: string; label: string; provider: string | null; status: string; itemCount: number; cost: number; requestId: string | null; error: string | null }>;
};

const stageDefinitions = [
  { key: "search", label: "Search LinkedIn evidence", provider: "DataForSEO" },
  { key: "normalize", label: "Normalize and deduplicate content", provider: null },
  { key: "posts", label: "Enrich selected posts", provider: "Bright Data" },
  { key: "authors", label: "Extract individual authors", provider: null },
  { key: "profiles", label: "Enrich person profiles", provider: "Bright Data" },
  { key: "qualify", label: "Apply deterministic eligibility", provider: null },
] as const;

export function providerConfiguration() {
  return { dataForSeo: dataForSeoAdapter.configured, brightData: brightDataAdapter.configured, channels: channelAvailability() };
}

function missingTable(error: { code?: string; message?: string } | null) {
  return error?.code === "PGRST205" || error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"));
}

export async function listDiscoveryRuns(brandSlug: string) {
  const supabase = await createSupabaseServerClient();
  const { data: brand } = await supabase.from("brands").select("id, name").eq("slug", brandSlug).single();
  if (!brand) return null;
  const { data, error } = await supabase.from("discovery_runs").select("id, name, status, query_count, raw_result_count, unique_content_count, profile_count, provider_cost, error_message, created_at, completed_at").eq("brand_id", brand.id).order("created_at", { ascending: false });
  if (missingTable(error)) return { brand, runs: [] as DiscoveryRunSummary[], migrationRequired: true };
  if (error) throw new Error(`Unable to load discovery runs: ${error.message}`);
  return { brand, runs: (data || []).map((run) => ({ id: run.id, name: run.name, status: run.status as RunStatus, queryCount: run.query_count, rawResultCount: run.raw_result_count, uniqueContentCount: run.unique_content_count, profileCount: run.profile_count, providerCost: Number(run.provider_cost || 0), errorMessage: run.error_message, createdAt: run.created_at, completedAt: run.completed_at })), migrationRequired: false };
}

export async function getDiscoveryRun(brandSlug: string, runId: string, client?: SupabaseClient): Promise<DiscoveryRunDetail | null> {
  const supabase = client || await createSupabaseServerClient();
  const { data: brand } = await supabase.from("brands").select("id, slug").eq("slug", brandSlug).single();
  if (!brand) return null;
  const { data: run } = await supabase.from("discovery_runs").select("id, name, status, selected_industries, config, query_count, raw_result_count, unique_content_count, profile_count, provider_cost, error_message, created_at, updated_at, completed_at").eq("id", runId).eq("brand_id", brand.id).single();
  if (!run) return null;
  const [{ data: queries }, { data: stages }] = await Promise.all([
    supabase.from("discovery_run_queries").select("*").eq("run_id", run.id).order("created_at"),
    supabase.from("discovery_run_stages").select("id, stage_key, label, provider, status, item_count, cost, request_id, error_message").eq("run_id", run.id).order("sequence"),
  ]);
  const config = run.config as DiscoveryRunDetail["config"];
  const jobs = config.version === 2 ? await supabase.from("discovery_channel_jobs").select("*").eq("run_id", run.id) : {data:[]};
  const candidates = config.version === 2 ? await supabase.from("creator_channels").select("channel,name,url,qualification,evidence").eq("brand_id",brand.id).eq("first_seen_run_id",run.id) : {data:[]};
  return {
    collectedCandidates: candidates.data || [],
    id: run.id, name: run.name, status: run.status as RunStatus, brandSlug: brand.slug,
    channelJobs: jobs.data || [],
    resumable: (run.status === "queued" && Date.parse(run.updated_at || run.created_at) < Date.now()-60000) || (run.status === "running" && Boolean(jobs.data?.some(j=>j.status === "running" && j.lease_until && Date.parse(j.lease_until)<Date.now()))),
    industries: ((run.selected_industries || []) as Array<{ name?: string }>).map((item) => item.name || "").filter(Boolean), config,
    queryCount: run.query_count, rawResultCount: run.raw_result_count, uniqueContentCount: run.unique_content_count, profileCount: run.profile_count,
    providerCost: Number(run.provider_cost || 0), errorMessage: run.error_message, createdAt: run.created_at, completedAt: run.completed_at,
    queries: (queries || []).map((query) => ({ channel: query.channel || "linkedin", id: query.id, phrase: query.source_phrase, industry: query.industry, query: query.query, approved: query.approved, status: query.status, resultCount: query.result_count, cost: Number(query.provider_cost || 0), error: query.error_message })),
    stages: (stages || []).map((stage) => ({ id: stage.id, key: stage.stage_key, label: stage.label, provider: stage.provider, status: stage.status, itemCount: stage.item_count, cost: Number(stage.cost || 0), requestId: stage.request_id, error: stage.error_message })),
  };
}

export function buildBalancedQueryPlan(
  phrases: Array<{ id: string; phrase: string }>,
  industries: Array<{ id: string; name: string; priority: number }>,
  maxQueries: number,
) {
  const patterns = ['site:linkedin.com/posts "{phrase}"', 'site:linkedin.com/pulse "{phrase}"'];
  const maxCandidates = industries.length * phrases.length * patterns.length;
  const selected: Array<{ phraseId: string; phrase: string; industry: string; query: string }> = [];
  let round = 0;
  while (selected.length < Math.min(maxQueries, maxCandidates)) {
    const phrase = phrases[round % phrases.length];
    const pattern = patterns[Math.floor(round / phrases.length) % patterns.length];
    for (const industry of industries) {
      if (selected.length >= maxQueries) break;
      selected.push({ phraseId: phrase.id, phrase: phrase.phrase, industry: industry.name, query: `${pattern.replace("{phrase}", phrase.phrase)} "${industry.name}"` });
    }
    round += 1;
  }
  return selected;
}

async function setStage(supabase: SupabaseClient, runId: string, key: string, status: string, values: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  await supabase.from("discovery_run_stages").update({ status, updated_at: now, ...(status === "running" ? { started_at: now, error_message: null } : {}), ...(["completed", "failed", "skipped"].includes(status) ? { completed_at: now } : {}), ...values }).eq("run_id", runId).eq("stage_key", key);
}

function authorUrl(record: Record<string, unknown>) {
  for (const key of ["use_url", "user_url", "author_url", "profile_url", "author_profile_url"]) {
    const value = record[key];
    if (typeof value === "string" && /linkedin\.com\/(in|company)\//i.test(value)) return canonicalLinkedInUrl(value);
  }
  return null;
}

function profileValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (record[key] !== undefined && record[key] !== null) return record[key];
  return null;
}

function profileText(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const direct = record[key];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
  }
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  let found = "";
  function walk(value: unknown, depth: number) {
    if (found || depth > 3 || value === null || value === undefined) return;
    if (Array.isArray(value)) return value.slice(0, 4).forEach((item) => walk(item, depth + 1));
    if (typeof value !== "object") return;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (wanted.has(key.toLowerCase()) && typeof item === "string" && item.trim()) { found = item.trim(); return; }
    }
    for (const item of Object.values(value as Record<string, unknown>)) walk(item, depth + 1);
  }
  for (const container of [record.current_company, record.current_position, record.experience, record.experiences]) walk(container, 0);
  return found || null;
}

function batchIdempotencyKey(prefix: string, runId: string, values: string[]) {
  const digest = createHash("sha256").update(values.join("\n")).digest("hex");
  return `${prefix}:${runId}:${digest}`;
}

function countByIndustry<T extends { industry: string }>(items: T[]) {
  return Object.fromEntries([...new Set(items.map((item) => item.industry))].map((industry) => [industry, items.filter((item) => item.industry === industry).length]));
}

/**
 * Round-robin selection prevents an early, high-volume industry from consuming
 * the entire paid enrichment allowance. Empty buckets surrender their places
 * to industries that still have results, so this balances coverage without
 * forcing weak or nonexistent candidates into the run.
 */
export function selectBalancedByIndustry<T extends { industry: string }>(
  items: T[],
  industries: string[],
  limit: number,
  identity: (item: T) => string,
) {
  const orderedIndustries = [...industries, ...items.map((item) => item.industry).filter((industry) => !industries.includes(industry))];
  const buckets = new Map(orderedIndustries.map((industry) => [industry, items.filter((item) => item.industry === industry)]));
  const selected: T[] = [];
  const seen = new Set<string>();
  let madeProgress = true;
  while (selected.length < limit && madeProgress) {
    madeProgress = false;
    for (const industry of orderedIndustries) {
      const bucket = buckets.get(industry) || [];
      while (bucket.length) {
        const candidate = bucket.shift()!;
        const key = identity(candidate);
        if (seen.has(key)) continue;
        seen.add(key);
        selected.push(candidate);
        madeProgress = true;
        break;
      }
      if (selected.length >= limit) break;
    }
  }
  return selected;
}

export async function executeDiscoveryRun(supabase: SupabaseClient, brandSlug: string, runId: string, linkedinOnly = false) {
  const detail = await getDiscoveryRun(brandSlug, runId, supabase);
  if (!detail) return;
  const { data: runRow } = await supabase.from("discovery_runs").select("workspace_id, brand_id").eq("id", runId).single();
  if (!runRow) return;
  const now = new Date().toISOString();
  await supabase.from("discovery_runs").update({ status: "running", started_at: now, error_message: null, updated_at: now }).eq("id", runId);
  try {
    const approved = detail.queries.filter((query) => query.approved && (!linkedinOnly || query.channel === "linkedin"));
    if (!approved.length) throw new Error("Approve at least one query before starting the run.");
    if (!dataForSeoAdapter.configured || !brightDataAdapter.configured) throw new Error("Provider credentials are not configured on the server.");

    await setStage(supabase, runId, "search", "running");
    const allResults: Array<{ queryId: string; industry: string; phrase: string; query: string; result: { rank: number | null; title: string; excerpt: string; url: string; domain: string } }> = [];
    const failedQueries: Array<{ id: string; query: string; error: string }> = [];
    let searchCost = 0;
    for (const [queryIndex, query] of approved.entries()) {
      try {
        const key = `search:${runId}:${query.id}`;
        const { data: existing } = await supabase.from("provider_records").select("raw_response, cost, external_id, status").eq("provider", "dataforseo").eq("idempotency_key", key).maybeSingle();
        let response;
        if (existing?.status === "completed" && existing.raw_response) {
          response = existing.raw_response as { results: typeof allResults[number]["result"][]; cost: number; externalId: string | null; providerRaw?: unknown };
        } else {
          await supabase.from("discovery_run_queries").update({ status: "running", error_message: null }).eq("id", query.id);
          const result = await dataForSeoAdapter.searchLinkedIn(query.query, { locationCode: detail.config.locationCode, languageCode: detail.config.languageCode, depth: detail.config.searchDepth });
          response = { results: result.results, cost: result.cost, externalId: result.externalId, providerRaw: result.raw };
          await supabase.from("provider_records").upsert({ workspace_id: runRow.workspace_id, brand_id: runRow.brand_id, run_id: runId, provider: "dataforseo", record_type: "search", idempotency_key: key, external_id: result.externalId, status: "completed", request_payload: { query: query.query }, raw_response: response, cost: result.cost, updated_at: new Date().toISOString() }, { onConflict: "provider,idempotency_key" });
        }
        searchCost += Number(response.cost || 0);
        response.results.forEach((result) => allResults.push({ queryId: query.id, industry: query.industry, phrase: query.phrase, query: query.query, result }));
        await supabase.from("discovery_run_queries").update({ status: "completed", result_count: response.results.length, provider_cost: response.cost, updated_at: new Date().toISOString() }).eq("id", query.id);
        await setStage(supabase, runId, "search", "running", { item_count: allResults.length, cost: searchCost, diagnostics: { completedQueries: queryIndex + 1, approvedQueries: approved.length } });
        await supabase.from("discovery_runs").update({ raw_result_count: allResults.length, provider_cost: searchCost, updated_at: new Date().toISOString() }).eq("id", runId);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Search query failed.";
        await supabase.from("discovery_run_queries").update({ status: "failed", error_message: message, updated_at: new Date().toISOString() }).eq("id", query.id);
        failedQueries.push({ id: query.id, query: query.query, error: message });
      }
    }
    if (!allResults.length && failedQueries.length === approved.length) throw new Error("Every approved LinkedIn search query failed.");
    await setStage(supabase, runId, "search", "completed", { item_count: allResults.length, cost: searchCost, diagnostics: { approvedQueries: approved.length, failedQueries } });
    await supabase.from("discovery_runs").update({ raw_result_count: allResults.length, provider_cost: searchCost, updated_at: new Date().toISOString() }).eq("id", runId);

    await setStage(supabase, runId, "normalize", "running");
    const unique = [...new Map(allResults.map((item) => [item.result.url, item])).values()];
    if (unique.length) await supabase.from("creator_content").upsert(unique.map((item) => ({ workspace_id: runRow.workspace_id, brand_id: runRow.brand_id, run_id: runId, linkedin_url: item.result.url, title: item.result.title, excerpt: item.result.excerpt, industry: item.industry, source_phrase: item.phrase, source_query: item.query, rank: item.result.rank, raw_data: item.result })), { onConflict: "run_id,linkedin_url" });
    await setStage(supabase, runId, "normalize", "completed", { item_count: unique.length, diagnostics: { duplicatesRemoved: allResults.length - unique.length } });
    await supabase.from("discovery_runs").update({ unique_content_count: unique.length, updated_at: new Date().toISOString() }).eq("id", runId);

    await setStage(supabase, runId, "posts", "running");
    const { data: previouslyEnrichedPosts } = await supabase
      .from("creator_content")
      .select("linkedin_url")
      .eq("brand_id", runRow.brand_id)
      .neq("run_id", runId)
      .not("author_url", "is", null)
      .limit(10000);
    const enrichedPostUrls = new Set((previouslyEnrichedPosts || []).map((item) => canonicalLinkedInUrl(item.linkedin_url || "")));
    const rankedResults = [...allResults].sort((a, b) => {
      const aSeen = enrichedPostUrls.has(canonicalLinkedInUrl(a.result.url)) ? 1 : 0;
      const bSeen = enrichedPostUrls.has(canonicalLinkedInUrl(b.result.url)) ? 1 : 0;
      return aSeen - bSeen || (a.result.rank || 999) - (b.result.rank || 999);
    });
    const selectedPosts = selectBalancedByIndustry(rankedResults, detail.industries, detail.config.maxPosts, (item) => item.result.url);
    if (selectedPosts.length) await supabase.from("creator_content").upsert(selectedPosts.map((item) => ({ workspace_id: runRow.workspace_id, brand_id: runRow.brand_id, run_id: runId, linkedin_url: item.result.url, title: item.result.title, excerpt: item.result.excerpt, industry: item.industry, source_phrase: item.phrase, source_query: item.query, rank: item.result.rank, raw_data: item.result })), { onConflict: "run_id,linkedin_url" });
    const postKey = batchIdempotencyKey("posts", runId, selectedPosts.map((item) => item.result.url));
    const { data: existingPosts } = await supabase.from("provider_records").select("raw_response, external_id, status").eq("provider", "brightdata").eq("idempotency_key", postKey).maybeSingle();
    let postSnapshot: { snapshotId: string; records: Record<string, unknown>[] };
    if (existingPosts?.status === "completed" && existingPosts.raw_response) postSnapshot = existingPosts.raw_response as typeof postSnapshot;
    else {
      postSnapshot = await brightDataAdapter.enrichPosts(selectedPosts.map((item) => item.result.url), {snapshotId:existingPosts?.external_id || undefined,onTriggered:async(snapshotId)=>{const saved=await supabase.from("provider_records").upsert({workspace_id:runRow.workspace_id,brand_id:runRow.brand_id,run_id:runId,provider:"brightdata",record_type:"post_snapshot",idempotency_key:postKey,external_id:snapshotId,status:"running",request_payload:{urls:selectedPosts.map(item=>item.result.url)}},{onConflict:"provider,idempotency_key"});if(saved.error)throw new Error(saved.error.message);}});
      await supabase.from("provider_records").upsert({ workspace_id: runRow.workspace_id, brand_id: runRow.brand_id, run_id: runId, provider: "brightdata", record_type: "post_snapshot", idempotency_key: postKey, external_id: postSnapshot.snapshotId, status: "completed", request_payload: { urls: selectedPosts.map((item) => item.result.url) }, raw_response: postSnapshot, updated_at: new Date().toISOString() }, { onConflict: "provider,idempotency_key" });
    }
    const unseenPostCount = selectedPosts.filter((item) => !enrichedPostUrls.has(canonicalLinkedInUrl(item.result.url))).length;
    await setStage(supabase, runId, "posts", "completed", { item_count: postSnapshot.records.length, request_id: postSnapshot.snapshotId, diagnostics: { selectedByIndustry: countByIndustry(selectedPosts), availableByIndustry: countByIndustry(allResults), unseenPostsSelected: unseenPostCount, previouslyEnrichedFallbacks: selectedPosts.length - unseenPostCount } });

    await setStage(supabase, runId, "authors", "running");
    const postIndustryByUrl = new Map(selectedPosts.map((item) => [canonicalLinkedInUrl(item.result.url), item.industry]));
    const authorCandidates = postSnapshot.records.map((record) => {
      const input = record.input as {url?:string} | undefined;
      const sourceUrl = input?.url || profileValue(record, ["url", "post_url", "linkedin_url"]);
      const url = authorUrl(record);
      const industry = typeof sourceUrl === "string" ? postIndustryByUrl.get(canonicalLinkedInUrl(sourceUrl)) : undefined;
      return url && industry ? { url, industry } : null;
    }).filter((item): item is { url: string; industry: string } => Boolean(item));
    const uniqueAuthors = new Set(authorCandidates.map((item) => item.url));
    const individualCandidates = authorCandidates.filter((item) => /linkedin\.com\/in\//i.test(item.url));
    const { data: storedCreators } = await supabase.from("creator_profiles").select("id, linkedin_url").eq("brand_id", runRow.brand_id).limit(10000);
    const storedCreatorByUrl = new Map((storedCreators || []).map((item) => [canonicalLinkedInUrl(item.linkedin_url || ""), item.id]));
    const unseenAuthors = individualCandidates.filter((item) => !storedCreatorByUrl.has(canonicalLinkedInUrl(item.url)));
    const selectedAuthors = selectBalancedByIndustry(unseenAuthors, detail.industries, detail.config.maxProfiles, (item) => item.url);
    const people = selectedAuthors.map((item) => item.url);
    const companies = [...uniqueAuthors].filter((url) => /linkedin\.com\/company\//i.test(url)).length;
    for (const record of postSnapshot.records) {
      const input = record.input as {url?:string} | undefined;
      const sourceUrl = input?.url || profileValue(record, ["url", "post_url", "linkedin_url"]);
      const author = authorUrl(record);
      if (typeof sourceUrl === "string" && author) {
        const canonicalAuthor = canonicalLinkedInUrl(author);
        await supabase.from("creator_content").update({ author_url: canonicalAuthor, creator_id: storedCreatorByUrl.get(canonicalAuthor) || null, raw_data: record }).eq("run_id", runId).eq("linkedin_url", canonicalLinkedInUrl(sourceUrl));
      }
    }
    await setStage(supabase, runId, "authors", "completed", { item_count: people.length, diagnostics: { companyPagesExcluded: companies, knownProfilesReused: individualCandidates.length - unseenAuthors.length, unseenProfilesAvailable: unseenAuthors.length, selectedByIndustry: countByIndustry(selectedAuthors) } });

    await setStage(supabase, runId, "profiles", "running");
    const profileKey = batchIdempotencyKey("profiles", runId, people);
    const { data: existingProfiles } = await supabase.from("provider_records").select("raw_response, external_id, status").eq("provider", "brightdata").eq("idempotency_key", profileKey).maybeSingle();
    let profileSnapshot: { snapshotId: string; records: Record<string, unknown>[] };
    if (existingProfiles?.status === "completed" && existingProfiles.raw_response) profileSnapshot = existingProfiles.raw_response as typeof profileSnapshot;
    else {
      profileSnapshot = await brightDataAdapter.enrichProfiles(people, {snapshotId:existingProfiles?.external_id || undefined,onTriggered:async(snapshotId)=>{const saved=await supabase.from("provider_records").upsert({workspace_id:runRow.workspace_id,brand_id:runRow.brand_id,run_id:runId,provider:"brightdata",record_type:"profile_snapshot",idempotency_key:profileKey,external_id:snapshotId,status:"running",request_payload:{urls:people}},{onConflict:"provider,idempotency_key"});if(saved.error)throw new Error(saved.error.message);}});
      await supabase.from("provider_records").upsert({ workspace_id: runRow.workspace_id, brand_id: runRow.brand_id, run_id: runId, provider: "brightdata", record_type: "profile_snapshot", idempotency_key: profileKey, external_id: profileSnapshot.snapshotId, status: "completed", request_payload: { urls: people }, raw_response: profileSnapshot, updated_at: new Date().toISOString() }, { onConflict: "provider,idempotency_key" });
    }
    await setStage(supabase, runId, "profiles", "completed", { item_count: profileSnapshot.records.length, request_id: profileSnapshot.snapshotId });

    await setStage(supabase, runId, "qualify", "running");
    let eligibleCount = 0;
    let storedCount = 0;
    for (const profile of profileSnapshot.records) {
      const urlValue = profileValue(profile, ["url", "linkedin_url", "profile_url"]);
      if (typeof urlValue !== "string") continue;
      const url = canonicalLinkedInUrl(urlValue);
      const followerRaw = profileValue(profile, ["followers", "followers_count", "connections"]);
      const followers = followerRaw !== null && Number.isFinite(Number(followerRaw)) ? Number(followerRaw) : null;
      const audienceFilter=filtersFor(detail.config,"linkedin");
      const eligible = followers===null ? audienceFilter.includeUnknownAudience : (audienceFilter.minAudience===null||followers>=audienceFilter.minAudience)&&(audienceFilter.maxAudience===null||followers<=audienceFilter.maxAudience);
      if (eligible) eligibleCount += 1;
      const payload = { workspace_id: runRow.workspace_id, brand_id: runRow.brand_id, first_seen_run_id: runId, linkedin_url: url, name: profileText(profile, ["name", "full_name"]), headline: profileText(profile, ["position", "headline", "current_title", "job_title", "role", "occupation"]), location: profileText(profile, ["location", "city", "country", "country_code"]), followers, profile_type: "person", eligible, rejection_reason: eligible ? null : followers === null ? "Follower count unavailable" : `Outside ${detail.config.minFollowers.toLocaleString()}–${detail.config.maxFollowers.toLocaleString()} follower range`, raw_data: profile, updated_at: new Date().toISOString() };
      const insertResult = await supabase.from("creator_profiles").insert(payload).select("id").single();
      let saved = insertResult.data;
      if (!saved && insertResult.error?.code === "23505") {
        const existing = await supabase.from("creator_profiles").select("id").eq("brand_id", runRow.brand_id).eq("linkedin_url", url).maybeSingle();
        saved = existing.data;
      }
      if (saved) storedCount += 1;
      if (saved) await supabase.from("creator_content").update({ creator_id: saved.id }).eq("run_id", runId).eq("author_url", url);
    }
    await setStage(supabase, runId, "qualify", "completed", { item_count: eligibleCount, diagnostics: { profilesReturned: profileSnapshot.records.length, newProfilesStored: storedCount, followerRange: [detail.config.minFollowers, detail.config.maxFollowers] } });
    const completedAt = new Date().toISOString();
    await supabase.from("discovery_runs").update({ status: linkedinOnly ? "running" : "ready", profile_count: storedCount, completed_at: completedAt, provider_cost: searchCost, updated_at: completedAt }).eq("id", runId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Discovery failed unexpectedly.";
    const { data: activeStage } = await supabase.from("discovery_run_stages").select("stage_key").eq("run_id", runId).eq("status", "running").maybeSingle();
    if (activeStage) await setStage(supabase, runId, activeStage.stage_key, "failed", { error_message: message });
    if (linkedinOnly) throw new Error(message);
    await supabase.from("discovery_runs").update({ status: "failed", error_message: message, updated_at: new Date().toISOString() }).eq("id", runId);
  } finally {
    revalidatePath(`/app/brands/${brandSlug}`);
    revalidatePath(`/app/brands/${brandSlug}/runs`);
    revalidatePath(`/app/brands/${brandSlug}/runs/${runId}`);
    revalidatePath(`/app/brands/${brandSlug}/creators`);
  }
}

export { stageDefinitions };
