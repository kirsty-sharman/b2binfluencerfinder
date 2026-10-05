import { currentQualification } from "@/lib/creator-admission";
import type { Channel } from "@/lib/channels/core";
import { activeContentIds } from "@/lib/content-selection";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type ReviewState = "pending" | "maybe" | "accepted" | "rejected";

export type CreatorResult = {
  firstAvailableAt: string | null;
  channels: Array<{channel:Channel;url:string}>;
  id: string;
  name: string;
  headline: string;
  location: string;
  followers: number | null;
  linkedinUrl: string;
  eligible: boolean;
  rejectionReason: string | null;
  evidenceCount: number;
  industries: string[];
  reviewStatus: ReviewState;
  matches: NonNullable<CreatorResult["bestMatch"]>[];
  bestMatch: null | {
    id: string;
    assetId: string;
    assetTitle: string;
    impact: number;
    status: ReviewState;
    confidence: string;
    explanation: string;
    strongestEvidence: string;
    angle: string;
    analysisStatus: string;
    recommendation: string | null;
  };
};

export type MatchReviewDetail = {
  id: string;
  brandSlug: string;
  creator: {
    id: string;
    name: string;
    headline: string;
    location: string;
    followers: number | null;
    linkedinUrl: string;
    eligible: boolean;
    evidenceCount: number;
  };
  asset: { id: string; title: string; url: string; contentType: string; summary: string; evidenceStrength: string };
  question: string;
  suggestedImpact: number;
  scores: { topic: number; industry: number; audience: number; assetFit: number };
  confidence: string;
  explanation: string;
  limitations: string[];
  angles: string[];
  evidence: Array<{ id: string; title: string; excerpt: string; url: string; industry: string; phrase: string; strength: string; explanation: string }>;
  decision: null | { decision: ReviewState; impactScore: number; selectedAngle: string; notes: string };
  shortlists: Array<{ id: string; name: string; selected: boolean }>;
  nextMatchId: string | null;
  semantic: null | { status: string; model: string | null; recommendation: string | null; credibility: number | null; profileSummary: string; industryAssessments: Array<{ industry: string; relevance: string; score: number; explanation: string }> };
};

function missingTable(error: { code?: string; message?: string } | null) {
  return error?.code === "PGRST205" || error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"));
}

export async function brandBoundary(brandSlug: string) {
  const supabase = await createSupabaseServerClient();
  const { data: brand } = await supabase.from("brands").select("id, workspace_id, slug, name").eq("slug", brandSlug).single();
  return { supabase, brand };
}

export async function listCreatorResults(brandSlug: string) {
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return null;

  const [{ data: creators, error: creatorError }, { data: assets }, { data: matches, error: matchError }, { data: industries }, channelRecords] = await Promise.all([
    supabase.from("creator_profiles").select("*").eq("brand_id", brand.id).order("eligible", { ascending: false }).order("followers", { ascending: false }),
    activeContentIds(supabase, brand.id).then(ids => supabase.from("content_assets").select("id, title").eq("brand_id", brand.id).in("id", ids)),
    supabase.from("creator_asset_matches").select("id, creator_id, asset_id, suggested_impact, confidence, explanation, collaboration_angles, status, created_at").eq("brand_id", brand.id),
    supabase.from("brand_industries").select("name, priority").eq("brand_id", brand.id).order("priority"),
    supabase.from("creator_channels").select("creator_id,channel,url,audience,qualification").eq("brand_id", brand.id),
  ]);
  if (creatorError) throw new Error(`Unable to load creators: ${creatorError.message}`);
  if (missingTable(matchError)) return { brand, creators: [] as CreatorResult[], assets: [], targetIndustries: (industries || []).map((industry) => industry.name), migrationRequired: true, semanticMigrationRequired: true };
  if (matchError) throw new Error(`Unable to load creator matches: ${matchError.message}`);

  const creatorIds = (creators || []).map((creator) => creator.id);
  const matchIds = (matches || []).map((match) => match.id);
  const [{ data: content }, { data: evidence }, { data: decisions }, semanticResult] = await Promise.all([
    creatorIds.length ? supabase.from("creator_content").select("id, creator_id, industry, excerpt, title, rank").in("creator_id", creatorIds) : Promise.resolve({ data: [] }),
    matchIds.length ? supabase.from("match_evidence").select("match_id, creator_content_id, strength").in("match_id", matchIds) : Promise.resolve({ data: [] }),
    matchIds.length ? supabase.from("review_decisions").select("match_id, decision").in("match_id", matchIds) : Promise.resolve({ data: [] }),
    matchIds.length ? supabase.from("creator_asset_matches").select("id, analysis_status, semantic_analysis").in("id", matchIds) : Promise.resolve({ data: [], error: null }),
  ]);
  // Creator decisions are separate, append-only events; asset reviews never change them.
  const creatorReviews: Array<{ entity_id: string | null; changes: { decision?: ReviewState } }> = [];
  for (let offset = 0; ; offset += 1000) {
    const { data: page, error } = await supabase.from("audit_events").select("entity_id, changes").eq("brand_id", brand.id).eq("entity_type", "creator_profile").eq("action", "creator.review").order("created_at", { ascending: false }).order("id").range(offset, offset + 999);
    if (error) throw new Error(`Unable to load creator decisions: ${error.message}`);
    creatorReviews.push(...(page || []));
    if (!page || page.length < 1000) break;
  }
  const statusByCreator = new Map<string, ReviewState>();
  for (const event of creatorReviews) if (event.entity_id && !statusByCreator.has(event.entity_id) && event.changes.decision) statusByCreator.set(event.entity_id, event.changes.decision);
  const assetById = new Map((assets || []).map((asset) => [asset.id, asset]));
  const contentById = new Map((content || []).map((item) => [item.id, item]));
  const decisionByMatch = new Map((decisions || []).map((decision) => [decision.match_id, decision.decision as ReviewState]));
  const semanticByMatch = new Map((semanticResult.data || []).map((item) => [item.id, item]));
  const evidenceByMatch = new Map<string, typeof content>();
  for (const item of evidence || []) {
    const creatorContent = contentById.get(item.creator_content_id);
    if (!creatorContent) continue;
    evidenceByMatch.set(item.match_id, [...(evidenceByMatch.get(item.match_id) || []), creatorContent]);
  }
  const matchesByCreator = new Map<string, typeof matches>();
  for (const match of matches || []) {
    if (!assetById.has(match.asset_id) || (decisionByMatch.get(match.id) || match.status) === "rejected") continue;
    matchesByCreator.set(match.creator_id, [...(matchesByCreator.get(match.creator_id) || []), match]);
  }

  const results: CreatorResult[] = (creators || []).map((creator) => {
    const creatorContent = (content || []).filter((item) => item.creator_id === creator.id);
    const verifiedMatches=(channelRecords.data||[]).filter(c=>c.creator_id===creator.id && currentQualification(c)).flatMap(c=>(c.qualification.matches||[]) as Array<{assetId:string;score:number;reason:string;angle:string}>);
    const creatorMatches = [...(creator.raw_data?.quality_qualified === false ? [] : matchesByCreator.get(creator.id) || [])].filter(m=>!creator.raw_data?.quality_gate || verifiedMatches.some(v=>v.assetId===m.asset_id)).map(m=>{const current=verifiedMatches.find(v=>v.assetId===m.asset_id);return current?{...m,suggested_impact:current.score,explanation:current.reason,collaboration_angles:[current.angle]}:m;}).sort((a, b) => b.suggested_impact - a.suggested_impact);
    const creatorMatchResults = creatorMatches.map((match) => {
      const matchEvidence = evidenceByMatch.get(match.id) || [];
      const strongest = [...matchEvidence].sort((a, b) => (a.rank || 999) - (b.rank || 999))[0];
      return {
        id: match.id,
        assetId: match.asset_id,
        assetTitle: assetById.get(match.asset_id)?.title || "Content asset",
        impact: match.suggested_impact,
        status: decisionByMatch.get(match.id) || match.status as ReviewState,
        confidence: match.confidence,
        explanation: match.explanation,
        strongestEvidence: strongest?.excerpt || strongest?.title || "No attributed excerpt is available.",
        angle: match.collaboration_angles?.[0] || "Add an independent expert perspective to the brand evidence.",
        analysisStatus: semanticByMatch.get(match.id)?.analysis_status || "not_started",
        recommendation: (semanticByMatch.get(match.id)?.semantic_analysis as { match_recommendation?: string } | null)?.match_recommendation || null,
      };
    });
    return {
      firstAvailableAt: creator.first_review_at || creatorMatches.map(m=>m.created_at).filter(Boolean).sort()[0] || null,
      channels: (channelRecords.data || []).filter(c=>c.creator_id === creator.id).map(c=>({channel:c.channel as Channel,url:c.url})).concat(channelRecords.data?.some(c=>c.creator_id===creator.id) ? [] : [{channel:"linkedin" as Channel,url:creator.linkedin_url || ""}]),
      id: creator.id,
      name: creator.name || "Unnamed creator",
      headline: creator.headline || "Professional focus unavailable",
      location: creator.location || "Location unavailable",
      followers: creator.followers,
      linkedinUrl: creator.primary_url || creator.linkedin_url || "",
      eligible: verifiedMatches.length > 0,
      rejectionReason: verifiedMatches.length ? null : "Needs rechecking against current audience and target-market requirements.",
      evidenceCount: creatorContent.length,
      industries: [...new Set(creatorContent.map((item) => item.industry).filter(Boolean))],
      reviewStatus: statusByCreator.get(creator.id) || "pending",
      matches: creatorMatchResults,
      bestMatch: creatorMatchResults[0] || null,
    };
  }).sort((a, b) => (b.bestMatch?.impact || 0) - (a.bestMatch?.impact || 0) || b.evidenceCount - a.evidenceCount || Number(Boolean(b.headline)) - Number(Boolean(a.headline)));

  return { brand, creators: results.filter((creator) => creator.bestMatch !== null), assets: assets || [], targetIndustries: (industries || []).map((industry) => industry.name), migrationRequired: false, semanticMigrationRequired: missingTable(semanticResult.error) || semanticResult.error?.code === "PGRST204" };
}

export async function listMatchQueue(brandSlug: string) {
  const result = await listCreatorResults(brandSlug);
  if (!result) return null;
  return { ...result, creators: result.creators.filter((creator) => creator.bestMatch) };
}

export async function getMatchReview(brandSlug: string, matchId: string): Promise<MatchReviewDetail | null> {
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return null;
  const { data: match, error } = await supabase.from("creator_asset_matches").select("id, creator_id, asset_id, target_question_id, suggested_impact, topic_expertise, industry_expertise, audience_relevance, asset_fit, confidence, explanation, limitations, collaboration_angles, status").eq("id", matchId).eq("brand_id", brand.id).single();
  if (error || !match) return null;
  const [{ data: creator }, { data: asset }, { data: question }, { data: evidenceRows }, { data: decision }, { data: shortlists }, { data: memberships }, { data: queue }, semanticResult] = await Promise.all([
    supabase.from("creator_profiles").select("*").eq("id", match.creator_id).single(),
    supabase.from("content_assets").select("id, title, url, content_type, summary, evidence_strength").eq("id", match.asset_id).single(),
    match.target_question_id ? supabase.from("target_questions").select("question").eq("id", match.target_question_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("match_evidence").select("id, creator_content_id, strength, explanation").eq("match_id", match.id),
    supabase.from("review_decisions").select("decision, impact_score, selected_angle, notes").eq("match_id", match.id).maybeSingle(),
    supabase.from("shortlists").select("id, name").eq("brand_id", brand.id).order("created_at"),
    supabase.from("shortlist_members").select("shortlist_id").eq("match_id", match.id),
    supabase.from("creator_asset_matches").select("id, status").eq("brand_id", brand.id).order("created_at"),
    supabase.from("creator_asset_matches").select("id, analysis_status, analysis_model, semantic_analysis").eq("id", match.id).maybeSingle(),
  ]);
  if (!creator || !asset) return null;
  const contentIds = (evidenceRows || []).map((item) => item.creator_content_id);
  const { data: content } = contentIds.length
    ? await supabase.from("creator_content").select("*").in("id", contentIds)
    : { data: [] };
  const evidenceMeta = new Map((evidenceRows || []).map((item) => [item.creator_content_id, item]));
  const queueRows = queue || [];
  const currentIndex = queueRows.findIndex((item) => item.id === match.id);
  const remaining = [...queueRows.slice(currentIndex + 1), ...queueRows.slice(0, currentIndex)];
  const nextMatchId = remaining.find((item) => item.id !== match.id && item.status === "pending")?.id || remaining.find((item) => item.id !== match.id)?.id || null;
  const selectedShortlists = new Set((memberships || []).map((item) => item.shortlist_id));
  const semanticPayload = semanticResult.data?.semantic_analysis as { match_recommendation?: string; credibility?: number; profile_summary?: string; industry_assessments?: Array<{ industry: string; relevance: string; score: number; explanation: string }> } | null;
  return {
    id: match.id,
    brandSlug,
    creator: { id: creator.id, name: creator.name || "Unnamed creator", headline: creator.headline || "Professional focus unavailable", location: creator.location || "Location unavailable", followers: creator.followers, linkedinUrl: creator.primary_url || creator.linkedin_url || "", eligible: creator.eligible, evidenceCount: (content || []).length },
    asset: { id: asset.id, title: asset.title, url: asset.url, contentType: asset.content_type, summary: asset.summary || "No summary has been added.", evidenceStrength: asset.evidence_strength },
    question: question?.question || "No active target question was linked when this suggestion was generated.",
    suggestedImpact: match.suggested_impact,
    scores: { topic: match.topic_expertise, industry: match.industry_expertise, audience: match.audience_relevance, assetFit: match.asset_fit },
    confidence: match.confidence,
    explanation: match.explanation,
    limitations: match.limitations || [],
    angles: match.collaboration_angles || [],
    evidence: (content || []).map((item) => ({ id: item.id, title: item.title || "Published content", excerpt: item.excerpt || "No excerpt available.", url: item.source_url || item.linkedin_url, industry: item.industry, phrase: item.source_phrase, strength: evidenceMeta.get(item.id)?.strength || "supporting", explanation: evidenceMeta.get(item.id)?.explanation || "Collected during the discovery run." })),
    decision: decision ? { decision: decision.decision as ReviewState, impactScore: decision.impact_score, selectedAngle: decision.selected_angle || "", notes: decision.notes || "" } : null,
    shortlists: (shortlists || []).map((shortlist) => ({ ...shortlist, selected: selectedShortlists.has(shortlist.id) })),
    nextMatchId,
    semantic: semanticResult.data ? { status: semanticResult.data.analysis_status, model: semanticResult.data.analysis_model, recommendation: semanticPayload?.match_recommendation || null, credibility: semanticPayload?.credibility || null, profileSummary: semanticPayload?.profile_summary || "", industryAssessments: semanticPayload?.industry_assessments || [] } : null,
  };
}

export async function listShortlists(brandSlug: string) {
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return null;
  const { data: shortlists, error } = await supabase.from("shortlists").select("id, name, description, created_at").eq("brand_id", brand.id).order("created_at");
  if (missingTable(error)) return { brand, shortlists: [], migrationRequired: true };
  if (error) throw new Error(`Unable to load shortlists: ${error.message}`);
  const ids = (shortlists || []).map((item) => item.id);
  const { data: members } = ids.length ? await supabase.from("shortlist_members").select("id, shortlist_id, match_id, creator_id, created_at").in("shortlist_id", ids) : { data: [] };
  const creatorIds = [...new Set((members || []).map((item) => item.creator_id))];
  const matchIds = [...new Set((members || []).map((item) => item.match_id))];
  const [{ data: creators }, { data: matches }] = await Promise.all([
    creatorIds.length ? supabase.from("creator_profiles").select("*").in("id", creatorIds) : Promise.resolve({ data: [] }),
    matchIds.length ? supabase.from("creator_asset_matches").select("id, asset_id, suggested_impact").in("id", matchIds) : Promise.resolve({ data: [] }),
  ]);
  const assetIds = [...new Set((matches || []).map((item) => item.asset_id))];
  const { data: assets } = assetIds.length ? await supabase.from("content_assets").select("id, title").in("id", assetIds) : { data: [] };
  const creatorById = new Map((creators || []).map((item) => [item.id, item]));
  const matchById = new Map((matches || []).map((item) => [item.id, item]));
  const assetById = new Map((assets || []).map((item) => [item.id, item]));
  return {
    brand,
    migrationRequired: false,
    shortlists: (shortlists || []).map((shortlist) => ({
      ...shortlist,
      members: (members || []).filter((member) => member.shortlist_id === shortlist.id).map((member) => {
        const creator = creatorById.get(member.creator_id);
        const match = matchById.get(member.match_id);
        return { id: member.id, matchId: member.match_id, name: creator?.name || "Unnamed creator", headline: creator?.headline || "Professional focus unavailable", followers: creator?.followers ?? null, linkedinUrl: creator?.primary_url || creator?.linkedin_url || "", assetTitle: match ? assetById.get(match.asset_id)?.title || "Content asset" : "Content asset", impact: match?.suggested_impact || 0 };
      }),
    })),
  };
}

function scoresForEvidence(evidenceCount: number, industryCount: number) {
  const topic = evidenceCount >= 4 ? 4 : evidenceCount >= 1 ? 3 : 2;
  const industry = industryCount >= 2 ? 4 : industryCount === 1 ? 3 : 2;
  const assetFit = evidenceCount >= 2 ? 4 : evidenceCount === 1 ? 3 : 2;
  const audience = 3;
  return { topic, industry, audience, assetFit, impact: Math.max(1, Math.min(5, Math.round((topic * 2 + industry * 2 + assetFit * 2 + audience) / 7))) };
}

export async function generateMatches(supabase: SupabaseClient, brand: { id: string; workspace_id: string }) {
  const [{ data: creators }, { data: assets }, { data: question }] = await Promise.all([
    supabase.from("creator_profiles").select("*").eq("brand_id", brand.id).eq("eligible", true),
    supabase.from("content_assets").select("id, title, summary").eq("brand_id", brand.id).in("id", await activeContentIds(supabase, brand.id)),
    supabase.from("target_questions").select("id, question").eq("brand_id", brand.id).eq("active", true).order("created_at").limit(1).maybeSingle(),
  ]);
  let created = 0;
  for (const creator of creators || []) {
    if (creator.raw_data?.quality_gate || (creator.primary_channel && creator.primary_channel !== "linkedin")) continue;
    const { data: content } = await supabase.from("creator_content").select("id, industry, source_phrase, excerpt, title, rank").eq("creator_id", creator.id).order("rank", { ascending: true, nullsFirst: false });
    const industries = [...new Set((content || []).map((item) => item.industry))];
    const scores = scoresForEvidence(content?.length || 0, industries.length);
    for (const asset of assets || []) {
      const angles = [
        `Add an expert perspective to “${asset.title}” using a practical lesson from ${industries[0] || "their field"}.`,
        `Reframe one finding from “${asset.title}” for ${industries.join(" and ") || "their professional audience"}, with an original example.`,
        `Turn the strongest evidence in “${asset.title}” into a short practitioner checklist that links to the source.`,
      ];
      const { data: match, error } = await supabase.from("creator_asset_matches").upsert({
        workspace_id: brand.workspace_id, brand_id: brand.id, creator_id: creator.id, asset_id: asset.id, target_question_id: question?.id || null,
        suggested_impact: scores.impact, topic_expertise: scores.topic, industry_expertise: scores.industry, audience_relevance: scores.audience, asset_fit: scores.assetFit,
        confidence: (content?.length || 0) >= 3 ? "high" : (content?.length || 0) >= 1 ? "medium" : "low",
        explanation: `${creator.name || "This creator"} has ${content?.length || 0} attributed publishing evidence item(s) across ${industries.join(", ") || "the selected markets"}. The recommendation prioritises demonstrated expertise and a natural fit with the source asset; follower count does not raise the expertise score.`,
        limitations: (content?.length || 0) ? [] : ["No directly attributed creator post is available yet."], collaboration_angles: angles, updated_at: new Date().toISOString(),
      }, { onConflict: "brand_id,creator_id,asset_id" }).select("id").single();
      if (error || !match) continue;
      created += 1;
      const evidence = (content || []).slice(0, 3).map((item) => ({ workspace_id: brand.workspace_id, brand_id: brand.id, match_id: match.id, creator_content_id: item.id, excerpt: item.excerpt || item.title, strength: item.rank && item.rank <= 5 ? "strong" : "supporting", explanation: `Collected for “${item.source_phrase}” in the ${item.industry} target market.` }));
      if (evidence.length) await supabase.from("match_evidence").upsert(evidence, { onConflict: "match_id,creator_content_id" });
    }
  }
  return created;
}
