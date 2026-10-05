"use server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildBrandDraft, type BrandDraft } from "@/lib/brand-prefill";

export async function prefillBrand(domain: string): Promise<{ draft?: BrandDraft; error?: string }> {
  const client = await createSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return { error: "Please sign in before scanning a website." };
  if (typeof domain !== "string" || !domain.trim() || domain.length > 500) return { error: "Enter your public website first." };
  try { return { draft: await buildBrandDraft(domain.trim()) }; }
  catch (error) { return { error: error instanceof Error ? error.message : "Website scan failed. Please try again." }; }
}
