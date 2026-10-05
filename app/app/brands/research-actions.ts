"use server";

import { replenishSuggestions } from "@/lib/phrase-suggestions";
import { allContent, getContentSelection, saveContentSelection, changeSelection } from "@/lib/content-selection";
import { assessContent, chooseContent, qualifiedContentIds } from "@/lib/content-curation";
import { scanContentUrl, discoverContentAssets } from "@/lib/content-discovery";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ResearchActionState = { error?: string; success?: string };

async function brandBoundary(brandSlug: string) {
  const supabase = await createSupabaseServerClient();
  const { data: brand, error } = await supabase
    .from("brands")
    .select("id, workspace_id, root_domain")
    .eq("slug", brandSlug)
    .single();
  return { supabase, brand, error };
}

export async function addPhrase(_: ResearchActionState, formData: FormData): Promise<ResearchActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const phrase = String(formData.get("phrase") || "").trim();
  const intent = String(formData.get("intent") || "").trim();
  if (!phrase) return { error: "Enter a phrase." };

  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return { error: "Brand not found." };
  const { error } = await supabase.from("phrases").insert({
    workspace_id: brand.workspace_id,
    brand_id: brand.id,
    phrase,
    intent: intent || null,
    status: "draft",
    source: "manual",
  });
  if (error) return { error: error.code === "23505" ? "That phrase already exists." : error.message };
  revalidatePath("/app", "layout");
  revalidatePath(`/app/brands/${brandSlug}/phrases`);
  revalidatePath(`/app/brands/${brandSlug}/visibility`, "layout");
  return { success: "Phrase added as a draft." };
}

export async function updatePhraseStatus(formData: FormData) {
  const brandSlug = String(formData.get("brandSlug") || "");
  const phraseId = String(formData.get("phraseId") || "");
  const status = String(formData.get("status") || "");
  if (!phraseId || !["draft", "approved", "rejected"].includes(status)) return;
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return;
  await supabase.from("phrases").update({ status, updated_at: new Date().toISOString() }).eq("id", phraseId).eq("brand_id", brand.id);
  revalidatePath("/app", "layout");
  revalidatePath(`/app/brands/${brandSlug}`);
  revalidatePath(`/app/brands/${brandSlug}/phrases`);
  revalidatePath(`/app/brands/${brandSlug}/visibility`, "layout");
}

export async function addContentAsset(_: ResearchActionState, formData: FormData): Promise<ResearchActionState> {
  const {supabase,brand}=await brandBoundary(String(formData.get("brandSlug") || ""));
  if(!brand) return {error:"Brand not found."};
  try {
    const asset=await scanContentUrl(String(formData.get("url") || ""));
    const {data:existing,error:lookupError}=await supabase.from("content_assets").select("id").eq("brand_id",brand.id).eq("url",asset.url).maybeSingle();
    if(lookupError) throw new Error("Unable to check the content library.");
    let id=existing?.id;
    if(existing) {
      const {error}=await supabase.from("content_assets").update({title:asset.title,summary:asset.summary,topics:asset.topics,content_type:asset.content_type,target_industries:asset.target_industries,updated_at:new Date().toISOString()}).eq("id",existing.id).eq("brand_id",brand.id);
      if(error) throw new Error("Unable to refresh the scanned URL.");
    } else {
      const {data,error}=await supabase.from("content_assets").insert({...asset,workspace_id:brand.workspace_id,brand_id:brand.id}).select("id").single();
      if(error) throw new Error("Unable to save scanned URL. It may have been added in another session; retry.");
      id=data.id;
    }
    if(id) await assessContent(supabase,brand,[id]);
    return {success:"URL scanned and assessed. Find it in Browse library and choose Add to active assets."};
  } catch(error) {return {error:error instanceof Error ? error.message : "URL scan failed."};}
  finally {revalidatePath("/app","layout");}
}

export async function updateContentAsset(_: ResearchActionState, formData: FormData): Promise<ResearchActionState> {
  const {supabase,brand}=await brandBoundary(String(formData.get("brandSlug") || ""));
  if(!brand) return {error:"Brand not found."};
  try {
    const current=await getContentSelection(supabase,brand.id);
    const add=formData.get("eligible")==="true";
    const assetId=String(formData.get("assetId") || "");
    const qualified=await qualifiedContentIds(supabase,brand.id,[...current.ids,assetId]);
    if(add && !qualified.includes(assetId)) throw new Error("This page must pass both target-industry fit and creator-quality checks before it can be activated. Reselect with AI to reassess after profile changes.");
    const next=changeSelection({...current,ids:current.ids.filter(id=>qualified.includes(id))},assetId,add);
    await saveContentSelection(supabase,brand,current,next);
    return {success:add ? "Added to active assets. Available for creator matching." : "Removed from active assets. The page stays in your library."};
  } catch(error) {return {error:error instanceof Error ? error.message : "Unable to change selection."};}
  finally {revalidatePath("/app","layout");}
}

export async function curateContentAssets(_: ResearchActionState, formData: FormData): Promise<ResearchActionState> {
  const {supabase,brand}=await brandBoundary(String(formData.get("brandSlug") || ""));
  if(!brand) return {error:"Brand not found."};
  try {
    const current=await getContentSelection(supabase,brand.id);
    const assessments=await assessContent(supabase,brand);
    const ids=await chooseContent(assessments,current.excluded);
    await saveContentSelection(supabase,brand,current,{...current,ids});
    return {success:`AI selected ${ids.length} creator-ready assets. Only these assets enter matching. Removed pages stay excluded from AI selection.`};
  } catch(error) {return {error:error instanceof Error ? error.message : "AI curation failed."};}
  finally {revalidatePath("/app","layout");}
}

export async function scanContentAssets(_: ResearchActionState, formData: FormData): Promise<ResearchActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return { error: "Brand not found." };
  const existing = await allContent(supabase,brand.id);
  let scanSummary="";
  try {
    const result = await discoverContentAssets(brand.root_domain, (existing || []).map((asset) => asset.url));
    let added = 0;
    if (result.assets.length) {
      const { data, error } = await supabase.from("content_assets").upsert(result.assets.map((asset) => ({ ...asset, workspace_id: brand.workspace_id, brand_id: brand.id })), { onConflict: "brand_id,url", ignoreDuplicates: true }).select("id");
      if (error) return { error: `Scan finished but assets could not be saved: ${error.message}` };
      added = data?.length || 0;
    }
    scanSummary=`Added ${added} pages. Checked ${result.attempted} new pages from ${result.discovered} sitemap candidates. ${result.failed} fetch failures; ${result.skipped} pages without enough readable content; ${result.sitemapFailures} unreadable sitemaps.`;
    await assessContent(supabase,brand);
    revalidatePath("/app", "layout");
    return { success: `Added ${added} pages to your library. Found ${result.discovered} candidate pages; checked ${result.attempted} new pages. ${result.remaining ? `${result.remaining} more candidates remain—scan again to import the next batch. ` : ""}${result.failed ? `${result.failed} pages could not be fetched; retry the scan. ` : ""}${result.skipped ? `${result.skipped} pages lacked enough readable article content. ` : ""}${result.remainingSitemaps ? `${result.remainingSitemaps} sitemaps remain beyond this scan’s safety limit. ` : ""}${result.sitemapFailures ? `${result.sitemapFailures} sitemaps could not be read. ` : ""}Browse the ranked library and select which pages to activate. Your active selection is unchanged.` };
  } catch (error) { return { error: `${scanSummary} ${error instanceof Error ? error.message : "Website scan failed. Please retry."} Saved pages and completed assessments are retained; use Reselect with AI to resume assessment.`.trim() }; }
  finally { revalidatePath("/app", "layout"); }
}

export async function suggestPhrases(_: ResearchActionState, formData: FormData): Promise<ResearchActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return { error: "Brand not found." };
  try {
    await replenishSuggestions(supabase, brand.id);
    return { success: "10 suggestions ready to review." };
  } catch (error) { return { error: error instanceof Error ? error.message : "Unable to generate suggestions." }; }
  finally { revalidatePath("/app", "layout"); }
}

export async function reviewPhraseSuggestion(_: ResearchActionState, formData: FormData): Promise<ResearchActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return { error: "Brand not found." };
  const status = String(formData.get("status") || "");
  if (!["approved", "rejected"].includes(status)) return { error: "Choose Accept or Dismiss." };
  const {data, error} = await supabase.from("phrases").update({status,updated_at:new Date().toISOString()}).eq("id",String(formData.get("phraseId") || "")).eq("brand_id",brand.id).eq("source","suggested").eq("status","draft").select("id");
  if (error || !data?.length) return {error:"Suggestion could not be saved. Refresh and try again."};
  try {
    await replenishSuggestions(supabase,brand.id);
    return {success:status === "approved" ? "Added to your master list. A new suggestion is ready." : "Suggestion dismissed and replaced."};
  } catch (error) { return {error:`Your decision was saved, but replenishment failed. ${error instanceof Error ? error.message : "Please retry."}`}; }
  finally { revalidatePath("/app","layout"); }
}
