import { activeContentIds } from "@/lib/content-selection";
import type { BrandOverviewData } from "@/lib/brand-types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type BrandSummary = {
  id: string;
  slug: string;
  name: string;
  counts: { phrases: number; assets: number; runs: number; creators: number; matches: number; shortlists: number; outreach: number; publications: number; visibility: number };
};
export type BrandProfileData = {
  id: string;
  slug: string;
  name: string;
  rootDomain: string;
  summary: string;
  targetSegments: string[];
  industryTopics: string[];
  targetQuestions: string[];
  targetIndustries: Array<{
    id: string;
    name: string;
    priority: number;
    taxonomyId: string | null;
    isCustom: boolean;
  }>;
};

export async function listBrands(): Promise<BrandSummary[]> {
  if (!isSupabaseConfigured()) {
    return [];
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id, slug, name")
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Unable to load brands: ${error.message}`);
  return Promise.all(data.map(async (brand) => {
    const activeIds = await activeContentIds(supabase, brand.id);
    const [{ count: phrases }, { count: assets }, { count: runs }, { count: creators }, { count: matches }, { count: shortlists }, outreachResult, publicationResult, visibilityResult] = await Promise.all([
      supabase.from("phrases").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).eq("status", "approved"),
      supabase.from("content_assets").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).in("id", activeIds),
      supabase.from("discovery_runs").select("id", { count: "exact", head: true }).eq("brand_id", brand.id),
      supabase.from("creator_profiles").select("id, creator_asset_matches!inner(id, content_assets!inner(id))", { count: "exact", head: true }).eq("brand_id", brand.id).eq("eligible", true).neq("creator_asset_matches.status", "rejected").in("creator_asset_matches.asset_id", activeIds),
      supabase.from("creator_asset_matches").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).eq("status", "pending"),
      supabase.from("shortlist_members").select("id", { count: "exact", head: true }).eq("brand_id", brand.id),
      supabase.from("outreach_records").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).not("status", "in", "(declined,paused)"),
      supabase.from("publications").select("id", { count: "exact", head: true }).eq("brand_id", brand.id),
      supabase.from("visibility_observations").select("id", { count: "exact", head: true }).eq("brand_id", brand.id),
    ]);
    return {
      ...brand,
      counts: { phrases: phrases || 0, assets: assets || 0, runs: runs || 0, creators: creators || 0, matches: matches || 0, shortlists: shortlists || 0, outreach: outreachResult.error ? 0 : outreachResult.count || 0, publications: publicationResult.error ? 0 : publicationResult.count || 0, visibility: visibilityResult.error ? 0 : visibilityResult.count || 0 },
    };
  }));
}

export async function getBrandOverview(slug: string): Promise<BrandOverviewData | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  const { data: brand, error } = await supabase
    .from("brands")
    .select("id, slug, name, summary")
    .eq("slug", slug)
    .single();

  if (error || !brand) return null;

  const { data: industries, error: industriesError } = await supabase
    .from("brand_industries")
    .select("id, name, priority")
    .eq("brand_id", brand.id)
    .order("priority", { ascending: true });
  if (industriesError) throw new Error(`Unable to load target industries: ${industriesError.message}`);

  const activeIds = await activeContentIds(supabase, brand.id);
  const [phrasesResult, assetsResult, questionsResult, priorityAssetsResult, creatorsResult, latestRunResult, shortlistResult, matchResult] = await Promise.all([
    supabase.from("phrases").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).eq("status", "approved"),
    supabase.from("content_assets").select("id", { count: "exact", head: true }).eq("brand_id", brand.id).in("id", activeIds),
    supabase.from("target_questions").select("question").eq("brand_id", brand.id).eq("active", true).order("created_at", { ascending: true }).limit(1),
    supabase.from("content_assets").select("id, title, content_type, target_industries").eq("brand_id", brand.id).in("id", activeIds).order("updated_at", { ascending: false }).limit(3),
    supabase.from("creator_profiles").select("id, creator_asset_matches!inner(id, content_assets!inner(id))", { count: "exact", head: true }).eq("brand_id", brand.id).eq("eligible", true).neq("creator_asset_matches.status", "rejected").in("creator_asset_matches.asset_id", activeIds),
    supabase.from("discovery_runs").select("id, name, completed_at, provider_cost, query_count, unique_content_count, profile_count, status").eq("brand_id", brand.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("shortlist_members").select("id", { count: "exact", head: true }).eq("brand_id", brand.id),
    supabase.from("creator_asset_matches").select("asset_id").eq("brand_id", brand.id).neq("status", "rejected"),
  ]);
  const approvedPhrases = phrasesResult.count || 0;
  const eligibleAssets = assetsResult.count || 0;
  const reviewReadyCreators = creatorsResult.count || 0;
  const latestRun = latestRunResult.error || !latestRunResult.data ? null : {
    id: latestRunResult.data.id,
    name: latestRunResult.data.name,
    completedAt: latestRunResult.data.completed_at || "",
    cost: `$${Number(latestRunResult.data.provider_cost || 0).toFixed(4)}`,
    queries: latestRunResult.data.query_count,
    posts: latestRunResult.data.unique_content_count,
    profiles: latestRunResult.data.profile_count,
    awaitingReview: latestRunResult.data.status === "ready" ? reviewReadyCreators : 0,
    status: latestRunResult.data.status,
  };
  const activeMatchCounts = new Map<string, number>();
  if (!matchResult.error) for (const match of matchResult.data || []) activeMatchCounts.set(match.asset_id, (activeMatchCounts.get(match.asset_id) || 0) + 1);
  const priorityAssets = priorityAssetsResult.error ? [] : (priorityAssetsResult.data || []).map((asset) => ({
    id: asset.id,
    title: asset.title,
    type: asset.content_type,
    industry: asset.target_industries?.[0] || "All selected industries",
    matches: activeMatchCounts.get(asset.id) || 0,
  }));

  return {
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    summary: brand.summary || "No brand summary configured yet.",
    metrics: [
      { label: "Questions to track", value: String(approvedPhrases), note: approvedPhrases ? "Saved for AI visibility checks" : "Optional AI visibility questions" },
      { label: "Eligible content assets", value: String(eligibleAssets), note: eligibleAssets ? "Available for creator matching" : "No eligible assets yet" },
      { label: "Review-ready creators", value: String(reviewReadyCreators), note: reviewReadyCreators ? "Passed deterministic eligibility" : "No eligible creators yet" },
      { label: "Shortlisted experts", value: String(shortlistResult.count || 0), note: shortlistResult.count ? "Ready for manual outreach" : "No shortlist decisions yet" },
    ],
    latestRun,
    priorityAssets,
    industries: industries.map((industry) => industry.name),
    trustedSubjects: brand.summary || "Not configured yet.",
    targetQuestion: questionsResult.data?.[0]?.question || "No target question configured yet.",
  };
}

export async function getBrandProfile(slug: string): Promise<BrandProfileData | null> {
  if (!isSupabaseConfigured()) {
    return null;
  }

  const supabase = await createSupabaseServerClient();
  let { data: brand, error } = await supabase
    .from("brands")
    .select("id, slug, name, root_domain, summary, target_segments, industry_topics")
    .eq("slug", slug)
    .single();
  if (error?.code === "PGRST204" || error?.message.includes("target_segments")) {
    const fallback = await supabase
      .from("brands")
      .select("id, slug, name, root_domain, summary")
      .eq("slug", slug)
      .single();
    brand = fallback.data ? { ...fallback.data, target_segments: [], industry_topics: [] } : null;
    error = fallback.error;
  }
  if (error || !brand) return null;

  let { data: targetIndustries, error: industriesError } = await supabase
    .from("brand_industries")
    .select("id, name, priority, taxonomy_id, is_custom")
    .eq("brand_id", brand.id)
    .order("priority", { ascending: true });
  if (industriesError?.code === "PGRST204" || industriesError?.message.includes("taxonomy_id")) {
    const fallback = await supabase
      .from("brand_industries")
      .select("id, name, priority")
      .eq("brand_id", brand.id)
      .order("priority", { ascending: true });
    targetIndustries = (fallback.data || []).map((industry) => ({ ...industry, taxonomy_id: null, is_custom: true }));
    industriesError = fallback.error;
  }
  if (industriesError) throw new Error(`Unable to load target industries: ${industriesError.message}`);

  const { data: questions, error: questionsError } = await supabase
    .from("target_questions")
    .select("question")
    .eq("brand_id", brand.id)
    .eq("active", true)
    .order("created_at", { ascending: true });
  if (questionsError) throw new Error(`Unable to load target questions: ${questionsError.message}`);

  return {
    id: brand.id,
    slug: brand.slug,
    name: brand.name,
    rootDomain: brand.root_domain,
    summary: brand.summary || "",
    targetSegments: brand.target_segments || [],
    industryTopics: brand.industry_topics || [],
    targetQuestions: (questions || []).map((question) => question.question),
    targetIndustries: (targetIndustries || []).map((industry) => ({
      id: industry.id,
      name: industry.name,
      priority: industry.priority,
      taxonomyId: industry.taxonomy_id,
      isCustom: industry.is_custom,
    })),
  };
}
