"use server";

import { revalidatePath } from "next/cache";
import { brandBoundary } from "@/lib/matching";

export type OutcomeActionState = { error?: string; success?: string };

function optionalDate(value: FormDataEntryValue | null) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function validUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function audit(supabase: Awaited<ReturnType<typeof brandBoundary>>["supabase"], brand: { id: string; workspace_id: string }, entityType: string, entityId: string, action: string, changes: Record<string, unknown>) {
  const { data: user } = await supabase.auth.getUser();
  await supabase.from("audit_events").insert({ workspace_id: brand.workspace_id, brand_id: brand.id, actor_id: user.user?.id || null, entity_type: entityType, entity_id: entityId, action, changes });
}

export async function saveOutreachRecord(_: OutcomeActionState, formData: FormData): Promise<OutcomeActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const matchId = String(formData.get("matchId") || "");
  const status = String(formData.get("status") || "not_started");
  const ownerName = String(formData.get("ownerName") || "").trim().slice(0, 120);
  const contactUrl = String(formData.get("contactUrl") || "").trim().slice(0, 1000);
  const notes = String(formData.get("notes") || "").trim().slice(0, 4000);
  const allowed = ["not_started", "researching", "ready", "contacted", "replied", "negotiating", "agreed", "declined", "paused"];
  if (!allowed.includes(status)) return { error: "Choose a valid outreach status." };
  if (contactUrl && !validUrl(contactUrl)) return { error: "Contact link must be a full http or https URL." };

  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return { error: "Brand not found." };
  const { data: match } = await supabase.from("creator_asset_matches").select("id, creator_id").eq("id", matchId).eq("brand_id", brand.id).single();
  if (!match) return { error: "Approved creator match not found." };
  const { data: user } = await supabase.auth.getUser();
  const payload = {
    workspace_id: brand.workspace_id, brand_id: brand.id, match_id: match.id, creator_id: match.creator_id,
    owner_id: user.user?.id || null, owner_name: ownerName || null, status, contact_url: contactUrl || null,
    last_contacted_at: optionalDate(formData.get("lastContactedAt")), next_action_at: optionalDate(formData.get("nextActionAt")),
    notes: notes || null, updated_at: new Date().toISOString(),
  };
  const { data: record, error } = await supabase.from("outreach_records").upsert(payload, { onConflict: "match_id" }).select("id").single();
  if (error || !record) return { error: error?.message || "Unable to save outreach." };
  await audit(supabase, brand, "outreach_record", record.id, "outreach.updated", { status, ownerName, nextActionAt: payload.next_action_at });
  revalidatePath("/app", "layout");
  revalidatePath(`/app/brands/${brandSlug}/outreach`);
  return { success: "Manual outreach status saved." };
}

export async function addPublication(_: OutcomeActionState, formData: FormData): Promise<OutcomeActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const matchId = String(formData.get("matchId") || "");
  const title = String(formData.get("title") || "").trim().slice(0, 240);
  const url = String(formData.get("url") || "").trim().slice(0, 1500);
  const channel = String(formData.get("channel") || "linkedin");
  const publishedAt = String(formData.get("publishedAt") || "");
  if (!matchId || !title || !publishedAt) return { error: "Choose a creator match, add a title, and add the publication date." };
  if (!validUrl(url)) return { error: "Publication link must be a full http or https URL." };

  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return { error: "Brand not found." };
  const { data: match } = await supabase.from("creator_asset_matches").select("id, creator_id, asset_id, target_question_id").eq("id", matchId).eq("brand_id", brand.id).single();
  if (!match) return { error: "Approved creator match not found." };
  const { data: outreach } = await supabase.from("outreach_records").select("id").eq("match_id", match.id).maybeSingle();
  const payload = {
    workspace_id: brand.workspace_id, brand_id: brand.id, outreach_id: outreach?.id || null, match_id: match.id,
    creator_id: match.creator_id, asset_id: match.asset_id, target_question_id: match.target_question_id,
    title, url, channel, format: String(formData.get("format") || "").trim().slice(0, 100) || null, published_at: publishedAt,
    brand_link_status: String(formData.get("brandLinkStatus") || "unknown"), disclosure_status: String(formData.get("disclosureStatus") || "unknown"),
    verification_status: String(formData.get("verificationStatus") || "unverified"), index_status: String(formData.get("indexStatus") || "not_checked"),
    verified_at: String(formData.get("verificationStatus")) === "live" ? new Date().toISOString() : null,
    outcome_notes: String(formData.get("outcomeNotes") || "").trim().slice(0, 4000) || null,
  };
  const { data: publication, error } = await supabase.from("publications").insert(payload).select("id").single();
  if (error || !publication) return { error: error?.code === "23505" ? "That publication link is already tracked." : error?.message || "Unable to save publication." };
  await audit(supabase, brand, "publication", publication.id, "publication.created", { url, channel, matchId });
  revalidatePath("/app", "layout");
  revalidatePath(`/app/brands/${brandSlug}/publications`);
  revalidatePath(`/app/brands/${brandSlug}/visibility`);
  return { success: "Published evidence recorded." };
}

export async function addVisibilityObservation(_: OutcomeActionState, formData: FormData): Promise<OutcomeActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const answerEngine = String(formData.get("answerEngine") || "chatgpt");
  const targetQuestionId = String(formData.get("targetQuestionId") || "") || null;
  const questionText = String(formData.get("questionText") || "").trim().slice(0, 1000);
  const name = String(formData.get("name") || "").trim().slice(0, 160) || "Manual visibility check";
  if (!questionText) return { error: "Add the exact question you tested." };
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return { error: "Brand not found." };
  const { data: benchmark, error: benchmarkError } = await supabase.from("visibility_benchmarks").insert({
    workspace_id: brand.workspace_id, brand_id: brand.id, name, answer_engine: answerEngine,
    observed_at: optionalDate(formData.get("observedAt")) || new Date().toISOString(), notes: String(formData.get("benchmarkNotes") || "").trim().slice(0, 2000) || null,
  }).select("id").single();
  if (benchmarkError || !benchmark) return { error: benchmarkError?.message || "Unable to create visibility check." };
  const splitValues = (value: FormDataEntryValue | null) => String(value || "").split(/[\n,]/).map((item) => item.trim()).filter(Boolean).slice(0, 20);
  const payload = {
    workspace_id: brand.workspace_id, brand_id: brand.id, benchmark_id: benchmark.id, target_question_id: targetQuestionId,
    question_text: questionText, brand_mentioned: formData.get("brandMentioned") === "on", brand_recommended: formData.get("brandRecommended") === "on",
    description_accurate: formData.get("descriptionAccurate") === "on" ? true : null,
    creator_evidence_cited: formData.get("creatorEvidenceCited") === "on", response_excerpt: String(formData.get("responseExcerpt") || "").trim().slice(0, 5000) || null,
    cited_urls: splitValues(formData.get("citedUrls")), competitors: splitValues(formData.get("competitors")),
    notes: String(formData.get("notes") || "").trim().slice(0, 3000) || null,
  };
  const { data: observation, error } = await supabase.from("visibility_observations").insert(payload).select("id").single();
  if (error || !observation) return { error: error?.message || "Unable to save observation." };
  await audit(supabase, brand, "visibility_observation", observation.id, "visibility.observed", { answerEngine, questionText, brandMentioned: payload.brand_mentioned, brandRecommended: payload.brand_recommended });
  revalidatePath("/app", "layout");
  revalidatePath(`/app/brands/${brandSlug}/visibility`);
  return { success: "Directional visibility observation saved." };
}
