import { contentAssessments } from "@/lib/content-curation";
import { activeContentIds } from "@/lib/content-selection";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

type SemanticAnalysis = {
  profile_summary: string;
  detected_role: string;
  detected_company: string;
  industry_assessments: Array<{ industry: string; relevance: "strong" | "supporting" | "weak" | "none"; score: number; evidence_ids: string[]; explanation: string }>;
  topic_expertise: number;
  industry_expertise: number;
  audience_relevance: number;
  asset_fit: number;
  credibility: number;
  suggested_impact: number;
  confidence: "low" | "medium" | "high";
  match_recommendation: "strong" | "maybe" | "weak";
  explanation: string;
  limitations: string[];
  collaboration_angles: string[];
  evidence_assessments: Array<{ evidence_id: string; relevant: boolean; strength: "strong" | "supporting" | "weak" | "irrelevant"; explanation: string }>;
};

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["profile_summary", "detected_role", "detected_company", "industry_assessments", "topic_expertise", "industry_expertise", "audience_relevance", "asset_fit", "credibility", "suggested_impact", "confidence", "match_recommendation", "explanation", "limitations", "collaboration_angles", "evidence_assessments"],
  properties: {
    profile_summary: { type: "string" },
    detected_role: { type: "string" },
    detected_company: { type: "string" },
    industry_assessments: { type: "array", items: { type: "object", additionalProperties: false, required: ["industry", "relevance", "score", "evidence_ids", "explanation"], properties: { industry: { type: "string" }, relevance: { type: "string", enum: ["strong", "supporting", "weak", "none"] }, score: { type: "integer", minimum: 1, maximum: 5 }, evidence_ids: { type: "array", items: { type: "string" } }, explanation: { type: "string" } } } },
    topic_expertise: { type: "integer", minimum: 1, maximum: 5 },
    industry_expertise: { type: "integer", minimum: 1, maximum: 5 },
    audience_relevance: { type: "integer", minimum: 1, maximum: 5 },
    asset_fit: { type: "integer", minimum: 1, maximum: 5 },
    credibility: { type: "integer", minimum: 1, maximum: 5 },
    suggested_impact: { type: "integer", minimum: 1, maximum: 5 },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    match_recommendation: { type: "string", enum: ["strong", "maybe", "weak"] },
    explanation: { type: "string" },
    limitations: { type: "array", items: { type: "string" } },
    collaboration_angles: { type: "array", items: { type: "string" } },
    evidence_assessments: { type: "array", items: { type: "object", additionalProperties: false, required: ["evidence_id", "relevant", "strength", "explanation"], properties: { evidence_id: { type: "string" }, relevant: { type: "boolean" }, strength: { type: "string", enum: ["strong", "supporting", "weak", "irrelevant"] }, explanation: { type: "string" } } } },
  },
} as const;

function extractOutputText(response: Record<string, unknown>) {
  if (typeof response.output_text === "string") return response.output_text;
  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown[] }).content) ? (item as { content: unknown[] }).content : [];
    for (const block of content) if (block && typeof block === "object" && (block as { type?: string }).type === "output_text" && typeof (block as { text?: unknown }).text === "string") return (block as { text: string }).text;
  }
  throw new Error("OpenAI did not return structured output.");
}

function profileContext(raw: unknown) {
  if (!raw || typeof raw !== "object") return {};
  const useful = /headline|position|title|role|company|occupation|experience|about|summary|location|industry/i;
  const entries: Array<[string, string | number | boolean]> = [];
  function walk(value: unknown, path: string, depth: number) {
    if (entries.length >= 50 || depth > 3 || value === null || value === undefined) return;
    if (["string", "number", "boolean"].includes(typeof value)) {
      if (useful.test(path)) entries.push([path, typeof value === "string" ? value.slice(0, 800) : value as number | boolean]);
      return;
    }
    if (Array.isArray(value)) return value.slice(0, 4).forEach((item, index) => walk(item, `${path}[${index}]`, depth + 1));
    if (typeof value === "object") Object.entries(value as Record<string, unknown>).forEach(([key, item]) => walk(item, path ? `${path}.${key}` : key, depth + 1));
  }
  walk(raw, "", 0);
  return Object.fromEntries(entries);
}

async function callOpenAI(input: Record<string, unknown>) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured on the server.");
  const model = process.env.OPENAI_MATCHING_MODEL || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 2200,
      input: [
        { role: "system", content: "You are an evidence auditor for B2B creator partnerships. Use only the supplied profile fields and attributed creator posts. A keyword mention is not proof of expertise. Give strong industry relevance only when the evidence demonstrates practical knowledge, responsibility, repeated informed commentary, or credible first-hand experience in that exact industry. Never let follower count compensate for weak expertise or unnatural asset fit. Do not invent roles, companies, audiences, engagement, or facts. Return empty strings and explicit limitations when data is absent. Collaboration angles must be useful expert reframings of the supplied brand asset, not promotional endorsements or 'buy this brand' posts." },
        { role: "user", content: JSON.stringify(input) },
      ],
      text: { format: { type: "json_schema", name: "creator_asset_evidence_assessment", strict: true, schema } },
    }),
  });
  const body = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(`OpenAI analysis failed (${response.status}): ${JSON.stringify(body).slice(0, 500)}`);
  return { model, responseId: typeof body.id === "string" ? body.id : null, analysis: JSON.parse(extractOutputText(body)) as SemanticAnalysis };
}

async function analyzeMatch(supabase: SupabaseClient, brand: { id: string; workspace_id: string; slug: string }, matchId: string) {
  const { data: match } = await supabase.from("creator_asset_matches").select("id, creator_id, asset_id, target_question_id, analysis_input_hash").eq("id", matchId).eq("brand_id", brand.id).single();
  if (!match) return false;
  const [{ data: creator }, { data: asset }, { data: question }, { data: industries }, { data: evidence }] = await Promise.all([
    supabase.from("creator_profiles").select("*").eq("id", match.creator_id).single(),
    supabase.from("content_assets").select("id, title, url, content_type, summary, topics, evidence_strength, target_industries").eq("id", match.asset_id).single(),
    match.target_question_id ? supabase.from("target_questions").select("question").eq("id", match.target_question_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("brand_industries").select("name").eq("brand_id", brand.id).order("priority"),
    supabase.from("creator_content").select("*").eq("creator_id", match.creator_id).order("rank", { ascending: true, nullsFirst: false }).limit(8),
  ]);
  if (!creator || !asset) return false;
  const contentAssessment=(await contentAssessments(supabase,brand.id)).get(asset.id);
  const input = {
    task: "Assess this creator's evidence-backed fit for the exact brand asset and target customer question.",
    creator: { name: creator.name, headline: creator.headline, location: creator.location, followers: creator.followers, profile_url: creator.primary_url || creator.linkedin_url, saved_profile_fields: profileContext(creator.raw_data) },
    target_industries: (industries || []).map((item) => item.name),
    brand_asset: {...asset,target_industries:contentAssessment?.matchedIndustries || [],industry_fit_reason:contentAssessment?.industryReason || "",industry_source_evidence:contentAssessment?.industryEvidence || ""},
    target_question: question?.question || "",
    attributed_creator_posts: (evidence || []).map((item) => ({ evidence_id: item.id, title: item.title, excerpt: item.excerpt, url: item.source_url || item.linkedin_url, discovery_industry: item.industry, source_phrase: item.source_phrase, rank: item.rank, published_at: item.published_at })),
  };
  const inputHash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  if (match.analysis_input_hash === inputHash) return false;
  await supabase.from("creator_asset_matches").update({ analysis_status: "running", analysis_error: null, updated_at: new Date().toISOString() }).eq("id", match.id);
  try {
    const result = await callOpenAI(input);
    const analysis = result.analysis;
    await supabase.from("creator_asset_matches").update({
      analysis_status: "completed", analysis_model: result.model, analysis_input_hash: inputHash, semantic_analysis: analysis,
      suggested_impact: analysis.suggested_impact, topic_expertise: analysis.topic_expertise, industry_expertise: analysis.industry_expertise,
      audience_relevance: analysis.audience_relevance, asset_fit: analysis.asset_fit, confidence: analysis.confidence,
      explanation: analysis.explanation, limitations: analysis.limitations, collaboration_angles: analysis.collaboration_angles.slice(0, 3),
      analysis_error: null, analyzed_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }).eq("id", match.id);
    if (!creator.headline && analysis.detected_role) {
      const headline = analysis.detected_company ? `${analysis.detected_role} · ${analysis.detected_company}` : analysis.detected_role;
      await supabase.from("creator_profiles").update({ headline, updated_at: new Date().toISOString() }).eq("id", creator.id).eq("brand_id", brand.id);
    }
    const assessmentById = new Map(analysis.evidence_assessments.map((item) => [item.evidence_id, item]));
    for (const item of evidence || []) {
      const assessment = assessmentById.get(item.id);
      if (!assessment) continue;
      await supabase.from("match_evidence").upsert({ workspace_id: brand.workspace_id, brand_id: brand.id, match_id: match.id, creator_content_id: item.id, excerpt: item.excerpt || item.title, strength: assessment.strength === "strong" ? "strong" : "supporting", explanation: assessment.explanation }, { onConflict: "match_id,creator_content_id" });
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Semantic analysis failed.";
    await supabase.from("creator_asset_matches").update({ analysis_status: "failed", analysis_error: message, updated_at: new Date().toISOString() }).eq("id", match.id);
    return false;
  }
}

export async function analyzeBrandMatches(supabase: SupabaseClient, brand: { id: string; workspace_id: string; slug: string }) {
  const { data: matches } = await supabase.from("creator_asset_matches").select("id").eq("brand_id", brand.id).in("asset_id", await activeContentIds(supabase, brand.id)).neq("status", "rejected").order("created_at");
  const ids = (matches || []).map((match) => match.id);
  let completed = 0;
  for (let index = 0; index < ids.length; index += 3) {
    const results = await Promise.all(ids.slice(index, index + 3).map((id) => analyzeMatch(supabase, brand, id)));
    completed += results.filter(Boolean).length;
  }
  revalidatePath("/app", "layout");
  revalidatePath(`/app/brands/${brand.slug}/creators`);
  revalidatePath(`/app/brands/${brand.slug}/matches/preview`);
  return completed;
}
