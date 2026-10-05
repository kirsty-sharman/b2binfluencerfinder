"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listValuesFromForm, targetIndustriesFromForm } from "@/lib/target-industries";
import { B2B_INDUSTRY_TAXONOMY_VERSION } from "@/lib/b2b-industries";

export type BrandProfileState = { error?: string; success?: string };

export async function updateBrandProfile(
  _: BrandProfileState,
  formData: FormData,
): Promise<BrandProfileState> {
  const brandId = String(formData.get("brandId") || "");
  const brandSlug = String(formData.get("brandSlug") || "");
  const summary = String(formData.get("summary") || "").trim();
  const targetSegments = listValuesFromForm(formData, "targetSegments");
  const industryTopics = listValuesFromForm(formData, "industryTopics");
  const { industries, error: industryError } = targetIndustriesFromForm(formData);

  if (!brandId || !brandSlug) return { error: "The brand could not be identified." };
  if (industryError) return { error: industryError };

  const supabase = await createSupabaseServerClient();
  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id, workspace_id")
    .eq("id", brandId)
    .single();

  if (brandError || !brand) return { error: "You do not have access to update this brand." };

  const { error: updateError } = await supabase
    .from("brands")
    .update({ summary: summary || null, target_segments: targetSegments, industry_topics: industryTopics, updated_at: new Date().toISOString() })
    .eq("id", brand.id);
  if (updateError) return { error: updateError.code === "PGRST204" ? "Apply the B2B industry taxonomy database migration before saving this profile." : updateError.message };

  const { error: deleteError } = await supabase
    .from("brand_industries")
    .delete()
    .eq("brand_id", brand.id);
  if (deleteError) return { error: deleteError.message };

  const { error: insertError } = await supabase.from("brand_industries").insert(
    industries.map((industry) => ({
      workspace_id: brand.workspace_id,
      brand_id: brand.id,
      name: industry.name,
      priority: industry.priority,
      taxonomy_id: industry.taxonomyId,
      taxonomy_version: industry.taxonomyId ? B2B_INDUSTRY_TAXONOMY_VERSION : null,
      is_custom: industry.isCustom,
    })),
  );
  if (insertError) return { error: insertError.message };

  revalidatePath("/app", "layout");
  revalidatePath(`/app/brands/${brandSlug}`);
  revalidatePath(`/app/brands/${brandSlug}/profile`);
  return { success: "Brand intelligence saved. Discovery will use these industries, topics, segments, and brand expertise." };
}
