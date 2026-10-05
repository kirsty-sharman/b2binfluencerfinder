"use server";

import { parseChannelFilters } from "@/lib/channels/filters";
import { channelAvailability } from "@/lib/channels/config";
import { isChannel } from "@/lib/channels/core";
import { executeMultiChannelRun, reassessRunCandidates } from "@/lib/channels/runner";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { executeDiscoveryRun, stageDefinitions } from "@/lib/discovery";

import { generateQueryPlan } from "@/lib/channels/query-planner";

export type DiscoveryActionState = { error?: string; success?: string };

function boundedInteger(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  if(value===null||value==="")return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
}

export async function createDiscoveryRun(_: DiscoveryActionState, formData: FormData): Promise<DiscoveryActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const maxQueries = boundedInteger(formData.get("maxQueries"), 20, 1, 25);
  const maxProfiles = boundedInteger(formData.get("maxProfiles"), 30, 1, 100);
  if (!brandSlug) return { error: "Brand not found." };
  const channels = [...new Set(formData.getAll("channel").map(String).filter(isChannel))];
  if (!channels.length) return {error:"Select at least one discovery channel."};
  let channelFilters;
  try { channelFilters=parseChannelFilters(formData,channels); } catch(error){return {error:error instanceof Error?error.message:"Check the channel settings."};}
  const maxPosts=channelFilters.linkedin?.evidenceLimit??60;
  const minFollowers=channelFilters.linkedin?.minAudience??0;
  const maxFollowers=channelFilters.linkedin?.maxAudience??1000000000;

  const supabase = await createSupabaseServerClient();
  const { data: brand } = await supabase.from("brands").select("id, workspace_id, name, root_domain, summary, target_segments, industry_topics").eq("slug", brandSlug).single();
  if (!brand) return { error: "Brand not found." };
  const {data:allIndustries}=await supabase.from("brand_industries").select("id,name,priority,taxonomy_id").eq("brand_id",brand.id).order("priority");
  const selectedIndustries=formData.getAll("industry").map(String);
  const industries=(allIndustries||[]).filter(i=>selectedIndustries.includes(i.name));
  const focus=String(formData.get("focus")||"").trim().slice(0,500);
  const phrases=[{id:"",phrase:focus || "Discover relevant industry experts using the brand and active content"}];
  if (!industries.length) return {error:"Select at least one target industry."};
  if (maxQueries < channels.length) return {error:"Allow at least one query per selected channel."};
  const unavailable = channelAvailability().filter(c => channels.includes(c.channel) && !c.ready);
  if (unavailable.length) return {error: unavailable.map(c => `${c.label}: ${c.requirement}`).join(". ")};
  const schema = await supabase.from("discovery_channel_jobs").select("id").limit(1);
  const multi = !schema.error;
  if (!multi) return {error:"Apply database migration 202609290009_multi_channel_discovery.sql to enable multi-channel runs."};
  const {data:assets,error:assetError}=await supabase.from("content_assets").select("id,title,topics,summary").eq("brand_id",brand.id).eq("eligible",true).limit(20);
  if(!assets?.length && !assetError)return {error:"Select at least one active content asset before planning discovery."};
  if(assetError)return {error:"Unable to load active content for query planning."};
  const {data:allowance,error:allowanceError}=await supabase.rpc("reserve_brand_search",{target_brand:brand.id});
  if(allowanceError)return {error:"Apply the search allowance migration before starting a new search."};
  if(allowance)return {error:String(allowance)};
  let generated;
  try { generated=await generateQueryPlan({brand,phrases,industries,channels,limit:maxQueries,assets:assets||[]}); }
  catch(error){return {error:error instanceof Error?error.message:"Unable to generate an AI query plan."};}
  const {plan}=generated;
  if (!plan.length) return { error: "No query candidates could be generated." };

  const createdAt = new Date();
  const { data: run, error } = await supabase.from("discovery_runs").insert({
    workspace_id: brand.workspace_id,
    brand_id: brand.id,
    name: `${brand.name} discovery · ${createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
    status: "draft",
    selected_industries: industries.map((industry) => ({ id: industry.id, name: industry.name, priority: industry.priority, taxonomyId: industry.taxonomy_id })),
    config: { queryPlanning: {version:1,model:generated.model,usage:generated.usage,explanations:generated.explanations,assets:(assets||[]).map(a=>({id:a.id,title:a.title}))}, version: multi ? 2 : 1, channels, channelFilters, focus, phraseIds:[], locationCode: 2840, languageCode: "en", searchDepth: 50, maxPosts, maxProfiles, minFollowers, maxFollowers },
    query_count: plan.length,
  }).select("id").single();
  if (error || !run) return { error: error?.message || "Unable to create the discovery run." };

  const { error: queryError } = await supabase.from("discovery_run_queries").insert(plan.map((query) => ({
    workspace_id: brand.workspace_id, brand_id: brand.id, run_id: run.id, phrase_id: query.phraseId || null,
    ...(multi ? {channel:query.channel} : {}), source_phrase: query.phrase, industry: query.industry, query: query.query, approved: true,
  })));
  if (queryError) return { error: queryError.message };
  if (multi) {
    const jobs = await supabase.from("discovery_channel_jobs").insert(channels.map(channel=>({workspace_id:brand.workspace_id,brand_id:brand.id,run_id:run.id,channel})));
    if(jobs.error) return {error:jobs.error.message};
  }
  const stageResult = channels.includes("linkedin") ? await supabase.from("discovery_run_stages").insert(stageDefinitions.map((stage, index) => ({
    workspace_id: brand.workspace_id, brand_id: brand.id, run_id: run.id, stage_key: stage.key,
    sequence: index + 1, label: stage.label, provider: stage.provider,
  }))) : {error:null};
  if (stageResult.error) return { error: stageResult.error.message };
  revalidatePath(`/app/brands/${brandSlug}/runs`);
  redirect(`/app/brands/${brandSlug}/runs/${run.id}`);
}

export async function startDiscoveryRun(_: DiscoveryActionState, formData: FormData): Promise<DiscoveryActionState> {
  const brandSlug = String(formData.get("brandSlug") || "");
  const runId = String(formData.get("runId") || "");
  const approvedIds = formData.getAll("approvedQueryId").map(String);
  if (!runId || !brandSlug) return { error: "Run not found." };
  if (!approvedIds.length) return { error: "Approve at least one query before starting." };

  const supabase = await createSupabaseServerClient();
  const { data: brand } = await supabase.from("brands").select("id").eq("slug", brandSlug).single();
  if (!brand) return { error: "Brand not found." };
  const { data: run } = await supabase.from("discovery_runs").select("id, status, config, updated_at").eq("id", runId).eq("brand_id", brand.id).single();
  if (!run) return {error:"Run not found."};
  const jobs = run.config?.version === 2 ? await supabase.from("discovery_channel_jobs").select("status,lease_until").eq("run_id",runId) : {data:[]};
  const resumable = (run.status === "queued" && Date.parse(run.updated_at)<Date.now()-60000) || (run.status === "running" && jobs.data?.some(j=>j.status==="running" && Date.parse(j.lease_until||"")<Date.now()));
  if (!["draft","failed"].includes(run.status) && !resumable) return {error:"This run is already active or complete."};
  const unavailable = channelAvailability().filter(c=>(run.config?.channels || ["linkedin"]).includes(c.channel) && !c.ready);
  if(unavailable.length)return {error:unavailable.map(c=>`${c.label}: ${c.requirement}`).join(". ")};
  const claim = await supabase.from("discovery_runs").update({status:"queued",error_message:null,updated_at:new Date().toISOString()}).eq("id",runId).eq("status",run.status).select("id");
  if(claim.error)return {error:claim.error.message};
  if(!claim.data?.length)return {error:"Another request has already started this run."};
  await supabase.from("discovery_run_queries").update({ approved: false }).eq("run_id", runId);
  const { error } = await supabase.from("discovery_run_queries").update({ approved: true }).eq("run_id", runId).in("id", approvedIds);
  if (error) return { error: error.message };
  await supabase.from("discovery_runs").update({ status: "queued", error_message: null, updated_at: new Date().toISOString() }).eq("id", runId);
  await supabase.from("discovery_run_stages").update({ status: "pending", error_message: null }).eq("run_id", runId).in("status", ["failed", "running"]);
  after(async () => {
    try { await (run.config?.version === 2 ? executeMultiChannelRun(supabase, brandSlug, runId) : executeDiscoveryRun(supabase, brandSlug, runId)); }
    catch (error) { await supabase.from("discovery_runs").update({status:"failed",error_message:error instanceof Error ? error.message : "Discovery interrupted."}).eq("id",runId); }
  });
  revalidatePath(`/app/brands/${brandSlug}/runs/${runId}`);
  return { success: "Run queued. This page will update as each stage completes." };
}

export async function retryDiscoveryRun(_: DiscoveryActionState, formData: FormData): Promise<DiscoveryActionState> {
  return startDiscoveryRun(_, formData);
}

export async function recheckDiscoveryQuality(_:DiscoveryActionState,form:FormData):Promise<DiscoveryActionState>{
 const brandSlug=String(form.get("brandSlug")||""),runId=String(form.get("runId")||"");
 const db=await createSupabaseServerClient();
 try {await reassessRunCandidates(db,brandSlug,runId);return {success:"Quality rechecked using saved evidence. No searches were repeated."};}
 catch(error){return {error:error instanceof Error?error.message:"Quality recheck failed."};}
}
