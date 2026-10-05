import { brandBoundary } from "@/lib/matching";

export type OutreachStatus = "not_started" | "researching" | "ready" | "contacted" | "replied" | "negotiating" | "agreed" | "declined" | "paused";

export type OutcomeCandidate = {
  matchId: string;
  creatorId: string;
  creatorName: string;
  creatorHeadline: string;
  creatorUrl: string;
  assetId: string;
  assetTitle: string;
  questionId: string | null;
  question: string;
  selectedAngle: string;
  outreach: null | {
    id: string;
    status: OutreachStatus;
    ownerName: string;
    contactUrl: string;
    lastContactedAt: string;
    nextActionAt: string;
    notes: string;
  };
};

export type PublicationRecord = {
  id: string;
  matchId: string;
  title: string;
  url: string;
  creatorName: string;
  assetTitle: string;
  question: string;
  channel: string;
  format: string;
  publishedAt: string;
  brandLinkStatus: string;
  disclosureStatus: string;
  verificationStatus: string;
  indexStatus: string;
  outcomeNotes: string;
};

export type VisibilityObservation = {
  id: string;
  benchmarkName: string;
  answerEngine: string;
  observedAt: string;
  question: string;
  brandMentioned: boolean;
  brandRecommended: boolean;
  descriptionAccurate: boolean | null;
  creatorEvidenceCited: boolean;
  excerpt: string;
  notes: string;
};

function missingTable(error: { code?: string; message?: string } | null) {
  return error?.code === "PGRST205" || error?.code === "42P01" || Boolean(error?.message?.includes("does not exist"));
}

export async function getOutcomeWorkspace(brandSlug: string) {
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return null;

  const schemaProbe = await supabase.from("outreach_records").select("id").eq("brand_id", brand.id).limit(1);
  if (missingTable(schemaProbe.error)) {
    return { brand, candidates: [] as OutcomeCandidate[], publications: [] as PublicationRecord[], observations: [] as VisibilityObservation[], questions: [] as Array<{ id: string; question: string }>, migrationRequired: true };
  }
  if (schemaProbe.error) throw new Error(`Unable to load outcomes: ${schemaProbe.error.message}`);

  const [{ data: accepted }, { data: shortlistMembers }, { data: outreach }, { data: publications, error: publicationError }, { data: benchmarks }, { data: observations }, { data: questions }] = await Promise.all([
    supabase.from("review_decisions").select("match_id, selected_angle").eq("brand_id", brand.id).eq("decision", "accepted"),
    supabase.from("shortlist_members").select("match_id").eq("brand_id", brand.id),
    supabase.from("outreach_records").select("id, match_id, status, owner_name, contact_url, last_contacted_at, next_action_at, notes").eq("brand_id", brand.id),
    supabase.from("publications").select("id, match_id, title, url, creator_id, asset_id, target_question_id, channel, format, published_at, brand_link_status, disclosure_status, verification_status, index_status, outcome_notes").eq("brand_id", brand.id).order("published_at", { ascending: false }),
    supabase.from("visibility_benchmarks").select("id, name, answer_engine, observed_at").eq("brand_id", brand.id).order("observed_at", { ascending: false }),
    supabase.from("visibility_observations").select("id, benchmark_id, question_text, brand_mentioned, brand_recommended, description_accurate, creator_evidence_cited, response_excerpt, notes").eq("brand_id", brand.id).order("created_at", { ascending: false }),
    supabase.from("target_questions").select("id, question").eq("brand_id", brand.id).eq("active", true).order("created_at"),
  ]);
  if (publicationError && !missingTable(publicationError)) throw new Error(`Unable to load publications: ${publicationError.message}`);

  const approvedMatchIds = [...new Set([...(accepted || []).map((item) => item.match_id), ...(shortlistMembers || []).map((item) => item.match_id)])];
  const { data: matches } = approvedMatchIds.length
    ? await supabase.from("creator_asset_matches").select("id, creator_id, asset_id, target_question_id").eq("brand_id", brand.id).in("id", approvedMatchIds)
    : { data: [] };
  const creatorIds = [...new Set([...(matches || []).map((item) => item.creator_id), ...(publications || []).map((item) => item.creator_id)])];
  const assetIds = [...new Set([...(matches || []).map((item) => item.asset_id), ...(publications || []).map((item) => item.asset_id)])];
  const questionIds = [...new Set([...(matches || []).map((item) => item.target_question_id), ...(publications || []).map((item) => item.target_question_id)].filter(Boolean))] as string[];
  const [{ data: creators }, { data: assets }, { data: relatedQuestions }] = await Promise.all([
    creatorIds.length ? supabase.from("creator_profiles").select("*").in("id", creatorIds) : Promise.resolve({ data: [] }),
    assetIds.length ? supabase.from("content_assets").select("id, title").in("id", assetIds) : Promise.resolve({ data: [] }),
    questionIds.length ? supabase.from("target_questions").select("id, question").in("id", questionIds) : Promise.resolve({ data: [] }),
  ]);
  const creatorById = new Map((creators || []).map((item) => [item.id, item]));
  const assetById = new Map((assets || []).map((item) => [item.id, item]));
  const questionById = new Map([...(questions || []), ...(relatedQuestions || [])].map((item) => [item.id, item.question]));
  const outreachByMatch = new Map((outreach || []).map((item) => [item.match_id, item]));
  const decisionByMatch = new Map((accepted || []).map((item) => [item.match_id, item]));
  const matchById = new Map((matches || []).map((item) => [item.id, item]));
  const benchmarkById = new Map((benchmarks || []).map((item) => [item.id, item]));

  const candidates: OutcomeCandidate[] = (matches || []).map((match) => {
    const creator = creatorById.get(match.creator_id);
    const record = outreachByMatch.get(match.id);
    return {
      matchId: match.id,
      creatorId: match.creator_id,
      creatorName: creator?.name || "Unnamed creator",
      creatorHeadline: creator?.headline || "Professional focus unavailable",
      creatorUrl: creator?.primary_url || creator?.linkedin_url || "",
      assetId: match.asset_id,
      assetTitle: assetById.get(match.asset_id)?.title || "Content asset",
      questionId: match.target_question_id,
      question: match.target_question_id ? questionById.get(match.target_question_id) || "Target question" : "No target question attached",
      selectedAngle: decisionByMatch.get(match.id)?.selected_angle || "",
      outreach: record ? {
        id: record.id, status: record.status as OutreachStatus, ownerName: record.owner_name || "", contactUrl: record.contact_url || "",
        lastContactedAt: record.last_contacted_at || "", nextActionAt: record.next_action_at || "", notes: record.notes || "",
      } : null,
    };
  }).sort((a, b) => a.creatorName.localeCompare(b.creatorName));

  const publicationRecords: PublicationRecord[] = (publications || []).map((publication) => {
    const match = matchById.get(publication.match_id);
    return {
      id: publication.id, matchId: publication.match_id, title: publication.title, url: publication.url,
      creatorName: creatorById.get(publication.creator_id)?.name || "Creator", assetTitle: assetById.get(publication.asset_id)?.title || "Content asset",
      question: publication.target_question_id ? questionById.get(publication.target_question_id) || "Target question" : (match?.target_question_id ? questionById.get(match.target_question_id) || "Target question" : "—"),
      channel: publication.channel, format: publication.format || "", publishedAt: publication.published_at,
      brandLinkStatus: publication.brand_link_status, disclosureStatus: publication.disclosure_status,
      verificationStatus: publication.verification_status, indexStatus: publication.index_status, outcomeNotes: publication.outcome_notes || "",
    };
  });

  const visibility: VisibilityObservation[] = (observations || []).map((observation) => {
    const benchmark = benchmarkById.get(observation.benchmark_id);
    return {
      id: observation.id, benchmarkName: benchmark?.name || "Visibility check", answerEngine: benchmark?.answer_engine || "other",
      observedAt: benchmark?.observed_at || "", question: observation.question_text,
      brandMentioned: observation.brand_mentioned, brandRecommended: observation.brand_recommended,
      descriptionAccurate: observation.description_accurate, creatorEvidenceCited: observation.creator_evidence_cited,
      excerpt: observation.response_excerpt || "", notes: observation.notes || "",
    };
  });

  return { brand, candidates, publications: publicationRecords, observations: visibility, questions: questions || [], migrationRequired: false };
}
