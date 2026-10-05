"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listValuesFromForm, targetIndustriesFromForm } from "@/lib/target-industries";
import { B2B_INDUSTRY_TAXONOMY_VERSION } from "@/lib/b2b-industries";

export type CreateBrandState = { error?: string };

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function createBrand(_: CreateBrandState, formData: FormData): Promise<CreateBrandState> {
  if (!isSupabaseConfigured()) {
    return { error: "Connect Supabase to save additional brands. The local preview remains read-only." };
  }

  const name = String(formData.get("name") || "").trim();
  const rootDomain = String(formData.get("rootDomain") || "").trim();
  const summary = String(formData.get("summary") || "").trim();
  const targetSegments = listValuesFromForm(formData, "targetSegments");
  const industryTopics = listValuesFromForm(formData, "industryTopics");
  const { industries, error: industryError } = targetIndustriesFromForm(formData);
  const slug = slugify(name);
  if (!name || !rootDomain || !slug) return { error: "Add a valid brand name and root domain." };
  if (industryError) return { error: industryError };

  let url: URL;
  try {
    url = new URL(rootDomain.startsWith("http") ? rootDomain : `https://${rootDomain}`);
  } catch {
    return { error: "Enter a valid root domain, such as https://example.com." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return { error: "Your session has expired. Sign in again." };

  let { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userData.user.id)
    .limit(1)
    .maybeSingle();

  if (!membership) {
    const { data: workspaceId, error: workspaceError } = await supabase.rpc(
      "create_workspace_with_owner",
      { workspace_name: `${name} workspace` },
    );
    if (workspaceError || !workspaceId) {
      return { error: workspaceError?.message || "Unable to create the workspace." };
    }
    membership = { workspace_id: workspaceId };
  }

  const { data: brand, error } = await supabase
    .from("brands")
    .insert({
      workspace_id: membership.workspace_id,
      name,
      slug,
      root_domain: url.origin,
      summary: summary || null,
      target_segments: targetSegments,
      industry_topics: industryTopics,
    })
    .select("id")
    .single();
  if (error) return { error: error.code === "23505" ? "A brand with this name already exists." : error.code === "PGRST204" ? "Apply the B2B industry taxonomy database migration before creating a brand." : error.message };

  const { error: industriesError } = await supabase.from("brand_industries").insert(
    industries.map((industry) => ({
      workspace_id: membership.workspace_id,
      brand_id: brand.id,
      name: industry.name,
      priority: industry.priority,
      taxonomy_id: industry.taxonomyId,
      taxonomy_version: industry.taxonomyId ? B2B_INDUSTRY_TAXONOMY_VERSION : null,
      is_custom: industry.isCustom,
    })),
  );
  if (industriesError) {
    await supabase.from("brands").delete().eq("id", brand.id);
    return { error: `The brand was not saved because its target industries could not be saved: ${industriesError.message}` };
  }

  revalidatePath("/app", "layout");
  redirect(`/app/brands/${slug}`);
}
