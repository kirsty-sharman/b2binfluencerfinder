import { allContent, activeContentIds } from "@/lib/content-selection";
import { contentAssessments, contentFingerprint, type ContentAssessment } from "@/lib/content-curation";
import { contentIndustries } from "@/lib/content-policy";
import { allPhrases } from "@/lib/phrase-suggestions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type PhraseRecord = {
  id: string;
  phrase: string;
  intent: string | null;
  status: "draft" | "approved" | "rejected";
  source: string;
};

export type ContentAssetRecord = {
  id: string;
  url: string;
  title: string;
  contentType: string;
  summary: string | null;
  topics: string[];
  evidenceStrength: "unreviewed" | "weak" | "moderate" | "strong";
  eligible: boolean;
  assessment: ContentAssessment | null;
};

function missingResearchTable(error: { code?: string; message?: string } | null) {
  return error?.code === "PGRST205" || error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"));
}

export async function getPhraseLibrary(brandSlug: string) {
  const supabase = await createSupabaseServerClient();
  const { data: brand } = await supabase.from("brands").select("id, name").eq("slug", brandSlug).single();
  if (!brand) return null;

  const { data, error } = await supabase
    .from("phrases")
    .select("id, phrase, intent, status, source")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: true }).limit(10000);

  if (missingResearchTable(error)) return { brand, phrases: [] as PhraseRecord[], migrationRequired: true };
  if (error) throw new Error(`Unable to load phrases: ${error.message}`);
  return { brand, phrases: data.length >= 1000 ? await allPhrases(supabase, brand.id) : data as PhraseRecord[], migrationRequired: false };
}

export async function getContentAssetLibrary(brandSlug: string, activeOnly = false) {
  const supabase = await createSupabaseServerClient();
  const { data: brand } = await supabase.from("brands").select("id, name").eq("slug", brandSlug).single();
  if (!brand) return null;

  const activePromise = activeContentIds(supabase, brand.id);
  const dataPromise = activeOnly ? activePromise.then(async ids => {
    const { data, error } = await supabase.from("content_assets").select("id,title,url,summary,content_type,topics,evidence_strength,eligible").eq("brand_id", brand.id).in("id", ids);
    if (error) throw new Error(error.message);
    return data || [];
  }) : allContent(supabase, brand.id);
  const [data,active,assessments,industries,total]=await Promise.all([dataPromise,activePromise,contentAssessments(supabase,brand.id),contentIndustries(supabase,brand.id),supabase.from("content_assets").select("id",{count:"exact",head:true}).eq("brand_id",brand.id)]);
  if (total.error) throw new Error(total.error.message);
  return {
    brand,
    total: total.count || 0,
    assets: data.map((asset) => ({
      id: asset.id,
      url: asset.url,
      title: asset.title,
      contentType: asset.content_type,
      summary: asset.summary,
      topics: asset.topics || [],
      evidenceStrength: asset.evidence_strength,
      eligible: active.includes(asset.id),
      assessment: assessments.get(asset.id)?.fingerprint === contentFingerprint(asset.title,asset.summary,industries) ? assessments.get(asset.id) : null,
    })) as ContentAssetRecord[],
    migrationRequired: false,
  };
}
