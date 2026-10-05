"use server";
import { ADMISSION_VERSION, currentQualification, rejectionReasons } from "@/lib/creator-admission";
import { activeContentIds } from "@/lib/content-selection";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { brandBoundary, generateMatches } from "@/lib/matching";
import { analyzeBrandMatches } from "@/lib/semantic-matching";

export type ReviewActionState = { error?: string; success?: string };

function boundedScore(value: FormDataEntryValue | null) {
  const score = Number(value);
  return Number.isInteger(score) && score >= 1 && score <= 5 ? score : null;
}

export async function refreshMatchSuggestions(_: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return { error: "Brand not found." };
  const { error: schemaError } = await supabase.from("creator_asset_matches").select("id").eq("brand_id", brand.id).limit(1);
  if (schemaError) return { error: "Run the Slice 4 database migration before generating matches." };
  const count = await generateMatches(supabase, brand);
  revalidatePath("/app", "layout");
  revalidatePath(`/app/brands/${brandSlug}/creators`);
  revalidatePath(`/app/brands/${brandSlug}/creators`);
  return { success: `${count} creator–asset suggestion${count === 1 ? "" : "s"} are ready for review.` };
}

export async function startSemanticAnalysis(_: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return { error: "Brand not found." };
  if (!process.env.OPENAI_API_KEY) return { error: "Add OPENAI_API_KEY to the server environment before analysing matches." };
  const { error: schemaError } = await supabase.from("creator_asset_matches").select("analysis_status").eq("brand_id", brand.id).limit(1);
  if (schemaError) return { error: "Run the semantic-matching database migration before starting AI analysis." };
  await generateMatches(supabase, brand);
  const { data: pending, error } = await supabase.from("creator_asset_matches").select("id").eq("brand_id", brand.id).in("asset_id", await activeContentIds(supabase, brand.id)).in("analysis_status", ["not_started", "failed"]);
  if (error) return { error: error.message };
  if (!pending?.length) return { success: "Every current match already has an evidence analysis." };
  await supabase.from("creator_asset_matches").update({ analysis_status: "queued", analysis_error: null, updated_at: new Date().toISOString() }).eq("brand_id", brand.id).in("id", pending.map((item) => item.id));
  after(() => analyzeBrandMatches(supabase, brand));
  revalidatePath(`/app/brands/${brandSlug}/creators`);
  revalidatePath(`/app/brands/${brandSlug}/creators`);
  return { success: `${pending.length} evidence analysis${pending.length === 1 ? "" : "es"} queued. Refresh shortly to see completed verdicts.` };
}

export async function saveMatchDecision(_: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const matchId = String(formData.get("matchId") || "");
  const decision = String(formData.get("decision") || "");
  const impactScore = boundedScore(formData.get("impactScore"));
  const selectedAngle = String(formData.get("selectedAngle") || "").trim();
  const notes = String(formData.get("notes") || "").trim().slice(0, 4000);
  const shortlistIds = formData.getAll("shortlistId").map(String).filter(Boolean);
  const reviewNext = String(formData.get("reviewNext") || "false") === "true";
  const nextMatchId = String(formData.get("nextMatchId") || "");
  if (!brandSlug || !matchId) return { error: "Match not found." };
  if (!impactScore) return { error: "Choose a final impact score from 1 to 5." };
  if (!["accepted", "maybe", "rejected"].includes(decision)) return { error: "Choose Accept, Maybe, or Reject." };

  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return { error: "Brand not found." };
  const { data: user } = await supabase.auth.getUser();
  const { data: match } = await supabase.from("creator_asset_matches").select("id, creator_id, collaboration_angles").eq("id", matchId).eq("brand_id", brand.id).single();
  if (!match) return { error: "Match not found in this brand." };
  if (selectedAngle && !(match.collaboration_angles || []).includes(selectedAngle)) return { error: "Choose one of the saved collaboration angles." };

  const now = new Date().toISOString();
  const { error } = await supabase.from("review_decisions").upsert({
    workspace_id: brand.workspace_id, brand_id: brand.id, match_id: match.id, reviewer_id: user.user?.id || null,
    decision, impact_score: impactScore, selected_angle: selectedAngle || null, notes: notes || null, updated_at: now,
  }, { onConflict: "match_id" });
  if (error) return { error: error.message };
  await supabase.from("creator_asset_matches").update({ status: decision, updated_at: now }).eq("id", match.id).eq("brand_id", brand.id);

  const { data: allowedShortlists } = shortlistIds.length
    ? await supabase.from("shortlists").select("id").eq("brand_id", brand.id).in("id", shortlistIds)
    : { data: [] };
  const allowedIds = (allowedShortlists || []).map((item) => item.id);
  await supabase.from("shortlist_members").delete().eq("match_id", match.id);
  if (decision !== "rejected" && allowedIds.length) {
    await supabase.from("shortlist_members").insert(allowedIds.map((shortlistId) => ({ workspace_id: brand.workspace_id, brand_id: brand.id, shortlist_id: shortlistId, match_id: match.id, creator_id: match.creator_id })));
  }
  await supabase.from("audit_events").insert({ workspace_id: brand.workspace_id, brand_id: brand.id, actor_id: user.user?.id || null, entity_type: "creator_asset_match", entity_id: match.id, action: `review.${decision}`, changes: { impactScore, selectedAngle: selectedAngle || null, notes: notes || null, shortlists: allowedIds } });

  revalidatePath("/app", "layout");
  revalidatePath(`/app/brands/${brandSlug}`);
  revalidatePath(`/app/brands/${brandSlug}/creators`);
  revalidatePath(`/app/brands/${brandSlug}/creators`);
  revalidatePath(`/app/brands/${brandSlug}/creators/matches/${match.id}`);
  revalidatePath(`/app/brands/${brandSlug}/shortlists`);
  if (reviewNext && nextMatchId) redirect(`/app/brands/${brandSlug}/creators/matches/${nextMatchId}`);
  return { success: "Review saved." };
}

export async function createShortlist(_: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const name = String(formData.get("name") || "").trim().slice(0, 100);
  const description = String(formData.get("description") || "").trim().slice(0, 500);
  if (!name) return { error: "Name the shortlist." };
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return { error: "Brand not found." };
  const { error } = await supabase.from("shortlists").insert({ workspace_id: brand.workspace_id, brand_id: brand.id, name, description: description || null });
  if (error) return { error: error.code === "23505" ? "A shortlist with that name already exists." : error.message };
  revalidatePath("/app", "layout");
  revalidatePath(`/app/brands/${brandSlug}/shortlists`);
  return { success: "Shortlist created." };
}

export async function addReviewedToShortlist(_: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const shortlistId = String(formData.get("shortlistId") || "");
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand || !shortlistId) return { error: "Choose a shortlist." };
  const { data: shortlist } = await supabase.from("shortlists").select("id").eq("id", shortlistId).eq("brand_id", brand.id).single();
  if (!shortlist) return { error: "Shortlist not found." };
  const { data: decisions } = await supabase.from("review_decisions").select("match_id").eq("brand_id", brand.id).eq("decision", "accepted");
  const matchIds = (decisions || []).map((item) => item.match_id);
  if (!matchIds.length) return { error: "Accept at least one creator before using the bulk shortlist action." };
  const { data: matches } = await supabase.from("creator_asset_matches").select("id, creator_id").eq("brand_id", brand.id).in("id", matchIds);
  const { error } = await supabase.from("shortlist_members").upsert((matches || []).map((match) => ({ workspace_id: brand.workspace_id, brand_id: brand.id, shortlist_id: shortlist.id, match_id: match.id, creator_id: match.creator_id })), { onConflict: "shortlist_id,match_id" });
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  revalidatePath(`/app/brands/${brandSlug}/shortlists`);
  return { success: `${matches?.length || 0} accepted creator${matches?.length === 1 ? "" : "s"} added.` };
}

export async function saveCreatorDecision(_: ReviewActionState, formData: FormData): Promise<ReviewActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const creatorId = String(formData.get("creatorId") || "");
  const decision = String(formData.get("decision") || "");
  const reason = String(formData.get("reason") || "");
  if (decision === "rejected" && !rejectionReasons.some(value=>value===reason)) return {error:"Choose why this creator is unsuitable."};
  if (!["pending", "accepted", "maybe", "rejected"].includes(decision)) return { error: "Choose a valid creator decision." };
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return { error: "Brand not found." };
  const { data: creator } = await supabase.from("creator_profiles").select("id,raw_data").eq("brand_id", brand.id).eq("id", creatorId).single();
  if (!creator) return { error: "Creator not found in this brand." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to review creators." };
  if (decision === "accepted") {
    let eligibleAssetIds = await activeContentIds(supabase, brand.id);
    {
      const channels = await supabase.from("creator_channels").select("channel,audience,qualification").eq("brand_id",brand.id).eq("creator_id",creator.id);
      if(channels.error) return {error:"Unable to verify current content matches."};
      const verifiedIds=(channels.data||[]).filter(c=>currentQualification(c)).flatMap(c=>(c.qualification.matches||[]).map((m:{assetId:string})=>m.assetId));
      eligibleAssetIds=eligibleAssetIds.filter(id=>verifiedIds.includes(id));
      if(!eligibleAssetIds.length || creator.raw_data?.quality_qualified===false)return {error:"This creator needs a current qualified content match before being shortlisted."};
    }
    const { data: matches, error: matchError } = await supabase.from("creator_asset_matches").select("id, content_assets!inner(id)").eq("brand_id", brand.id).eq("creator_id", creator.id).neq("status", "rejected").in("asset_id", eligibleAssetIds).order("suggested_impact", { ascending: false }).order("id").limit(1);
    if (matchError || !matches?.length) return { error: "This creator needs an eligible content match before being shortlisted." };
    const { error: listError } = await supabase.from("shortlists").upsert({ workspace_id: brand.workspace_id, brand_id: brand.id, name: "Accepted creators", description: "Creators you approved, ready for outreach." }, { onConflict: "brand_id,name", ignoreDuplicates: true });
    if (listError) return { error: listError.message };
    const { data: shortlist } = await supabase.from("shortlists").select("id").eq("brand_id", brand.id).eq("name", "Accepted creators").single();
    if (!shortlist) return { error: "Could not open the accepted creators shortlist." };
    const { data: existing } = await supabase.from("shortlist_members").select("id").eq("shortlist_id", shortlist.id).eq("creator_id", creator.id).limit(1);
    if (!existing?.length) {
      const { error } = await supabase.from("shortlist_members").upsert({workspace_id: brand.workspace_id, brand_id: brand.id, shortlist_id: shortlist.id, creator_id: creator.id, match_id: matches[0].id}, {onConflict:"shortlist_id,match_id",ignoreDuplicates:true});
      if (error) return { error: error.message };
    }
  } else {
    const { data: shortlist } = await supabase.from("shortlists").select("id").eq("brand_id",brand.id).eq("name","Accepted creators").maybeSingle();
    if (shortlist) {
      const { error } = await supabase.from("shortlist_members").delete().eq("shortlist_id",shortlist.id).eq("creator_id",creator.id).eq("brand_id",brand.id);
      if (error) return { error: error.message };
    }
  }
  const feedbackContext = await supabase.from("creator_channels").select("channel,audience,qualification").eq("brand_id",brand.id).eq("creator_id",creator.id);
  if (feedbackContext.error) return {error:"Unable to save the assessment context. Please retry."};
  const { error } = await supabase.from("audit_events").insert({ workspace_id: brand.workspace_id, brand_id: brand.id, actor_id: user.id, entity_type: "creator_profile", entity_id: creator.id, action: "creator.review", changes: { decision, reason: decision === "rejected" ? reason : null, qualificationVersion: ADMISSION_VERSION, assessments: feedbackContext.data, profileSnapshot: {qualityGate:creator.raw_data?.quality_gate,qualified:creator.raw_data?.quality_qualified} } });
  if (error) return { error: error.message };
  revalidatePath("/app", "layout");
  return { success: decision === "accepted" ? "Added to Accepted creators. Ready for outreach." : "Creator decision saved." };
}
