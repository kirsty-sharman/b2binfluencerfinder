import { filtersFor, type RunFilterConfig } from "./filters";
import { canonicalLinkedInUrl } from "@/lib/providers/shared";
import { QUALITY_VERSION } from "./industry-gate";
import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
import { activeContentIds } from "@/lib/content-selection";
import { contentAssessments } from "@/lib/content-curation";
import { canonicalUrl, validPublicUrl, identityOverlap, type ChannelCandidate, type Channel } from "./core";
import { channelAvailability } from "./config";
import { discoverWeb } from "./web";
import { discoverYoutube, discoverPodcasts, discoverX } from "./apis";
import { qualifyCandidate, type Qualification } from "./quality";
type Client=Awaited<ReturnType<typeof createSupabaseServerClient>>;
function check(error:{message:string}|null) {if(error) throw new Error(error.message);}

async function saveCandidate(db:Client, scope:{workspace_id:string;brand_id:string}, runId:string, candidate:ChannelCandidate, quality:Qualification, phrase:string, query:string) {
 const {data:known,error}=await db.from("creator_channels").select("id,creator_id,channel,external_id,url,name,identity_urls,identity_evidence").eq("brand_id",scope.brand_id);
 check(error);
 const exact=known?.find(c=>c.channel===candidate.channel&&c.external_id===candidate.externalId);
 const identities=(known||[]).filter(c=>c.creator_id && identityOverlap(candidate,{...candidate,identityUrls:c.identity_urls,identityEvidence:c.identity_evidence||""}));
 const possibleIds=[...new Set(identities.map(c=>c.creator_id))];
 let creatorId:string|null=exact?.creator_id || (possibleIds.length===1?possibleIds[0]:null);
 if(!creatorId && candidate.channel === "linkedin") {
  const existing = await db.from("creator_profiles").select("id").eq("brand_id",scope.brand_id).eq("linkedin_url",candidate.url).maybeSingle();check(existing.error);creatorId=existing.data?.id||null;
 }
 if(!creatorId && quality.qualified) {
  const saved=await db.from("creator_profiles").upsert({...scope,first_seen_run_id:runId,primary_url:canonicalUrl(candidate.url),primary_channel:candidate.channel,name:candidate.name,headline:candidate.description.slice(0,1000),followers:candidate.audience,profile_type: (["podcast","youtube"].includes(candidate.channel)||candidate.identityEvidence.startsWith("Publication"))?"unknown":"person",eligible:true,raw_data:{channel:candidate.channel,url:candidate.url,limitations:candidate.limitations}}, {onConflict:"brand_id,primary_url",ignoreDuplicates:true}).select("id").maybeSingle();
  check(saved.error); creatorId=saved.data?.id||null;
  if(!creatorId) {const existing=await db.from("creator_profiles").select("id").eq("brand_id",scope.brand_id).eq("primary_url",canonicalUrl(candidate.url)).single();check(existing.error);creatorId=existing.data?.id||null;}
 }
 // Record the channel even when quality is insufficient. It never appears in the review table without a match.
 check((await db.from("creator_channels").upsert({...scope,creator_id:creatorId,channel:candidate.channel,external_id:candidate.externalId,url:candidate.url,name:candidate.name,description:candidate.description,audience:candidate.audience,identity_urls:candidate.identityUrls,identity_evidence:candidate.identityEvidence,evidence:candidate.evidence,limitations:candidate.limitations,qualification:quality,first_seen_run_id:runId,updated_at:new Date().toISOString()},{onConflict:"brand_id,channel,external_id"})).error);
 if(creatorId) {
  const existing=await db.from("creator_profiles").select("first_seen_run_id,raw_data").eq("id",creatorId).single();check(existing.error);
  if(existing.data?.first_seen_run_id===runId)check((await db.from("creator_profiles").update({eligible:quality.qualified,rejection_reason:quality.qualified?null:quality.reason,raw_data:{...existing.data.raw_data,quality_gate:true,quality_qualified:quality.qualified}}).eq("id",creatorId)).error);
 }
 if(!creatorId||!quality.qualified) return false;
 const {data:review,error:reviewError}=await db.from("audit_events").select("changes").eq("brand_id",scope.brand_id).eq("entity_id",creatorId).eq("action","creator.review").order("created_at",{ascending:false}).limit(1).maybeSingle();
 check(reviewError);
 if(review?.changes?.decision==="rejected") return false;
 const uniqueEvidence=[...new Map(candidate.evidence.filter(e=>validPublicUrl(e.url)).map(e=>[canonicalUrl(e.url),{...e,url:canonicalUrl(e.url)}])).values()];
 const content=await db.from("creator_content").upsert(uniqueEvidence.map(e=>({...scope,run_id:runId,creator_id:creatorId,source_url:e.url,channel:candidate.channel,author_url:candidate.url,title:e.title,excerpt:e.text.slice(0,12000),published_at:e.publishedAt&&Number.isFinite(Date.parse(e.publishedAt))?new Date(e.publishedAt).toISOString():null,industry:quality.industries[0]||"",source_phrase:phrase,source_query:query,raw_data:{source:e.source,author:e.author}})),{onConflict:"run_id,source_url"}).select("id,source_url,excerpt");
 check(content.error);
 for(const match of quality.matches) {
  // Recheck active assets to handle a user removing one while a run is in flight.
  if(!(await activeContentIds(db,scope.brand_id)).includes(match.assetId)) continue;
  const saved=await db.from("creator_asset_matches").upsert({...scope,creator_id:creatorId,asset_id:match.assetId,suggested_impact:match.score,topic_expertise:match.score,industry_expertise:match.score,audience_relevance:match.score,asset_fit:match.score,confidence:"medium",explanation:match.reason,limitations:candidate.limitations,collaboration_angles:[match.angle]}, {onConflict:"brand_id,creator_id,asset_id"}).select("id").maybeSingle();
  check(saved.error);
  if(saved.data) check((await db.from("match_evidence").upsert((content.data||[]).filter(e=>match.evidenceUrls.some(url=>canonicalUrl(url)===e.source_url)).map(e=>({...scope,match_id:saved.data!.id,creator_content_id:e.id,excerpt:e.excerpt,strength:"strong",explanation:match.reason})),{onConflict:"match_id,creator_content_id"})).error);
 }
 return true;
}

export async function executeMultiChannelRun(db:Client,brandSlug:string,runId:string) {
 const {getDiscoveryRun,executeDiscoveryRun}=await import("@/lib/discovery");
 const detail=await getDiscoveryRun(brandSlug,runId,db); if(!detail)throw new Error("Unable to load the authorized discovery run.");
 const {data:run,error}=await db.from("discovery_runs").select("workspace_id,brand_id").eq("id",runId).single();check(error);if(!run)return;
 const scope={workspace_id:run.workspace_id,brand_id:run.brand_id};
 const brandRecord=await db.from("brands").select("name").eq("id",scope.brand_id).single();check(brandRecord.error);
 const brandName=brandRecord.data?.name;
 const currentMarkets=await db.from("brand_industries").select("name").eq("brand_id",run.brand_id);check(currentMarkets.error);
 const industries=(currentMarkets.data||[]).map(i=>i.name).filter(name=>detail.industries.includes(name));
 const {data:jobs,error:jobsError}=await db.from("discovery_channel_jobs").select("*").eq("run_id",runId);check(jobsError);
 await db.from("discovery_runs").update({status:"running",error_message:null,started_at:new Date().toISOString()}).eq("id",runId);
 for(const job of jobs||[]) {
  const token=randomUUID();
  const claim=await db.rpc("claim_channel_job",{job:job.id,token});check(claim.error);if(!claim.data)continue;
  const channel=job.channel as Channel;
  const filters=filtersFor(detail.config,channel);
  try {
   const queries=detail.queries.filter(q=>q.approved && q.channel===channel);
   if(!queries.length){check((await db.from("discovery_channel_jobs").update({status:"completed",lease_until:null}).eq("id",job.id).eq("lease_token",token)).error);continue;}
   const availability=channelAvailability().find(c=>c.channel===channel)!;
   if(!availability.ready) throw new Error(`Configure ${availability.requirement}.`);
   if(channel==="linkedin") {
    if(queries.length) {
     await executeDiscoveryRun(db,brandSlug,runId,true);
     const {data:state}=await db.from("discovery_runs").select("status,error_message,profile_count,provider_cost,raw_result_count").eq("id",runId).single();
     if(state?.status==="failed") throw new Error(state.error_message||"LinkedIn failed.");
     const linkedQuality = await qualifyLinkedInRun(db,scope,runId,industries,detail.config);
     check((await db.from("discovery_channel_jobs").update({status:"completed",candidate_count:linkedQuality.candidates,qualified_count:linkedQuality.qualified,provider_cost:state?.provider_cost||0,lease_until:null}).eq("id",job.id).eq("lease_token",token)).error);
     await db.from("discovery_runs").update({status:"running",completed_at:null}).eq("id",runId);
    } else await db.from("discovery_channel_jobs").update({status:"completed",lease_until:null}).eq("id",job.id).eq("lease_token",token);
    continue;
   }
   let candidates=0,qualified=0,requests=0,cost=0;
   const assessments=await contentAssessments(db,scope.brand_id);
   const assetResult=await db.from("content_assets").select("id,title,summary").eq("brand_id",scope.brand_id).in("id",await activeContentIds(db,scope.brand_id));check(assetResult.error);
   const assets=(assetResult.data||[]).map(a=>({...a,summary:a.summary||"",industries:assessments.get(a.id)?.matchedIndustries||[]}));
   const seen=new Set<string>();
   for(const query of queries) {
    if (seen.size >= detail.config.maxProfiles) {
     check((await db.from("discovery_run_queries").update({status:"completed",result_count:0,error_message:"Candidate limit reached; no additional request needed."}).eq("id",query.id)).error);
     continue;
    }
    const key=`channel-search:${runId}:${query.id}`;
    const cached=await db.from("provider_records").select("raw_response").eq("provider",channel).eq("idempotency_key",key).maybeSingle();check(cached.error);
    let result=cached.data?.raw_response as Awaited<ReturnType<typeof discoverYoutube>>|undefined;
    if(!result) {
     await db.from("discovery_run_queries").update({status:"running",error_message:null}).eq("id",query.id);
     const limit=Math.min(detail.config.maxProfiles,10);
     result=channel==="newsletter"||channel==="blog"?await discoverWeb(channel,query.query,limit,filters.evidenceLimit):channel==="youtube"?await discoverYoutube(query.query,limit,filters.evidenceLimit):channel==="podcast"?await discoverPodcasts(query.query,limit,filters.evidenceLimit):await discoverX(query.query,limit,filters.evidenceLimit);
     check((await db.from("provider_records").upsert({...scope,run_id:runId,provider:channel,record_type:"channel_search",idempotency_key:key,status:"completed",raw_response:result,cost:result.cost},{onConflict:"provider,idempotency_key"})).error);
    }
    cost+=result.cost;requests+=result.requests;
    for(const candidate of result.candidates) {
     if(seen.has(candidate.externalId) || seen.size>=detail.config.maxProfiles)continue;
     seen.add(candidate.externalId);candidates++;
     // Cache by evidence AND current assets/industries so changed inputs are reassessed.
     const assessmentKey=`quality:${scope.brand_id}:${createHash("sha256").update(JSON.stringify({version:QUALITY_VERSION,candidate,assets,industries,filters})).digest("hex")}`;
     const previous=await db.from("provider_records").select("raw_response").eq("provider","openai").eq("idempotency_key",assessmentKey).gte("created_at",new Date(Date.now()-24*60*60*1000).toISOString()).maybeSingle();check(previous.error);
     let quality=previous.data?.raw_response as Qualification|undefined;
     if(!quality) {
      quality=await qualifyCandidate(candidate,assets,industries,brandName,filters);
      check((await db.from("provider_records").upsert({...scope,run_id:runId,provider:"openai",record_type:"channel_quality",created_at:new Date().toISOString(),idempotency_key:assessmentKey,status:"completed",raw_response:quality},{onConflict:"provider,idempotency_key"})).error);
     }
     if(await saveCandidate(db,scope,runId,candidate,quality,query.phrase,query.query))qualified++;
    }
    check((await db.from("discovery_run_queries").update({status:"completed",result_count:result.candidates.length,provider_cost:result.cost,error_message:result.failures.length?`${result.failures.length} sources could not be read.`:null}).eq("id",query.id)).error);
    check((await db.from("discovery_channel_jobs").update({candidate_count:candidates,qualified_count:qualified,request_count:requests,provider_cost:cost,lease_until:new Date(Date.now()+30*60000).toISOString()}).eq("id",job.id).eq("lease_token",token)).error);
   }
   check((await db.from("discovery_channel_jobs").update({status:"completed",lease_until:null}).eq("id",job.id).eq("lease_token",token)).error);
  } catch(error) {
   const message=error instanceof Error?error.message:"Channel discovery failed.";
   const paidQueries=await db.from("discovery_run_queries").select("provider_cost").eq("run_id",runId).eq("channel",channel);
   await db.from("discovery_channel_jobs").update({status:"failed",error_message:message,provider_cost:(paidQueries.data||[]).reduce((s,q)=>s+Number(q.provider_cost||0),0),lease_until:null}).eq("id",job.id).eq("lease_token",token);
   await db.from("discovery_run_queries").update({status:"failed",error_message:message}).eq("run_id",runId).eq("channel",channel).eq("status","running");
  }
 }
 const {data:finished}=await db.from("discovery_channel_jobs").select("status,candidate_count,qualified_count,provider_cost").eq("run_id",runId);
 const failed=finished?.filter(j=>j.status==="failed").length||0;
 const running=finished?.some(j=>["running","pending"].includes(j.status));
 await db.from("discovery_runs").update({status:running?"running":failed?"failed":"ready",profile_count:finished?.reduce((s,j)=>s+j.qualified_count,0)||0,raw_result_count:finished?.reduce((s,j)=>s+j.candidate_count,0)||0,provider_cost:finished?.reduce((s,j)=>s+Number(j.provider_cost),0)||0,error_message:failed?`${failed} channel(s) need attention. Successful channels are saved; retry resumes failed work.`:null,completed_at:running?null:new Date().toISOString()}).eq("id",runId);
 for(const path of ["runs",`runs/${runId}`,"creators"])revalidatePath(`/app/brands/${brandSlug}/${path}`);
}

async function qualifyLinkedInRun(db:Client,scope:{workspace_id:string;brand_id:string},runId:string,industries:string[],config:RunFilterConfig) {
 const filters=filtersFor(config,"linkedin");
 const brandRecord=await db.from("brands").select("name").eq("id",scope.brand_id).single();check(brandRecord.error);
 const brandName=brandRecord.data?.name;
 const content=await db.from("creator_content").select("*").eq("run_id",runId).eq("channel","linkedin");check(content.error);
 const profiles=await db.from("creator_profiles").select("id,linkedin_url").eq("brand_id",scope.brand_id).not("linkedin_url","is",null);check(profiles.error);
 const byUrl=new Map((profiles.data||[]).map(p=>[canonicalLinkedInUrl(p.linkedin_url),p.id]));
 for(const item of content.data||[]) {
  const id=item.creator_id || (item.author_url?byUrl.get(canonicalLinkedInUrl(item.author_url)):null);
  if(id && !item.creator_id){check((await db.from("creator_content").update({creator_id:id}).eq("id",item.id).eq("brand_id",scope.brand_id)).error);item.creator_id=id;}
 }
 const ids=[...new Set((content.data||[]).map(e=>e.creator_id).filter(Boolean))];
 if(!ids.length)return {candidates:0,qualified:0};
 const creators=await db.from("creator_profiles").select("*").in("id",ids).eq("brand_id",scope.brand_id);check(creators.error);
 const assessments=await contentAssessments(db,scope.brand_id);
 const assetResult=await db.from("content_assets").select("id,title,summary").eq("brand_id",scope.brand_id).in("id",await activeContentIds(db,scope.brand_id));check(assetResult.error);
 const assets=(assetResult.data||[]).map(a=>({...a,summary:a.summary||"",industries:assessments.get(a.id)?.matchedIndustries||[]}));
 let qualified=0;
 for(const creator of creators.data||[]) {
  const rows=await db.from("creator_content").select("*").eq("creator_id",creator.id).eq("brand_id",scope.brand_id).eq("channel","linkedin").order("created_at",{ascending:false}).limit(30);check(rows.error);
  const candidate:ChannelCandidate={channel:"linkedin",externalId:creator.linkedin_url,url:creator.linkedin_url,name:creator.name||"LinkedIn creator",description:creator.headline||"",audience:creator.followers,identityUrls:[creator.linkedin_url],identityEvidence:"Bright Data post author linked to individual LinkedIn profile",limitations:[],evidence:(rows.data||[]).map(e=>({url:e.source_url||e.linkedin_url,title:e.title||"",text:String(e.raw_data?.post_text||e.raw_data?.text||e.raw_data?.content||e.excerpt||""),publishedAt:e.published_at||e.raw_data?.date_posted||e.raw_data?.published_at||null,author:creator.name||"",source:e.source_url||e.linkedin_url}))};
  const key=`linkedin-quality:${scope.brand_id}:${createHash("sha256").update(JSON.stringify({version:QUALITY_VERSION,candidate,assets,industries,filters})).digest("hex")}`;
  const previous=await db.from("provider_records").select("raw_response").eq("provider","openai").eq("idempotency_key",key).gte("created_at",new Date(Date.now()-24*60*60*1000).toISOString()).maybeSingle();check(previous.error);
  const quality:Qualification=previous.data?.raw_response||await qualifyCandidate(candidate,assets,industries,brandName,filters);
  if(!previous.data)check((await db.from("provider_records").upsert({...scope,run_id:runId,provider:"openai",record_type:"channel_quality",created_at:new Date().toISOString(),idempotency_key:key,status:"completed",raw_response:quality},{onConflict:"provider,idempotency_key"})).error);
  if(await saveCandidate(db,scope,runId,candidate,quality,"LinkedIn discovery","Attributed LinkedIn publishing"))qualified++;
  // New records obey the common gate. Historical decisions remain untouched.
  if(creator.first_seen_run_id===runId)check((await db.from("creator_profiles").update({eligible:quality.qualified,rejection_reason:quality.qualified?null:quality.reason,raw_data:{...creator.raw_data,quality_gate:true,quality_qualified:quality.qualified}}).eq("id",creator.id)).error);
 }
 return {candidates:ids.length,qualified};
}

export async function reassessRunCandidates(db:Client,brandSlug:string,runId:string) {
 const brand=await db.from("brands").select("id,workspace_id,name").eq("slug",brandSlug).single();check(brand.error);if(!brand.data)throw new Error("Brand not found.");
 const scope={workspace_id:brand.data.workspace_id,brand_id:brand.data.id};
 const run=await db.from("discovery_runs").select("config,selected_industries").eq("id",runId).eq("brand_id",scope.brand_id).single();check(run.error);
 const rows=await db.from("creator_channels").select("*").eq("brand_id",scope.brand_id).eq("first_seen_run_id",runId);check(rows.error);
 const markets=await db.from("brand_industries").select("name").eq("brand_id",scope.brand_id);check(markets.error);
 const industries=(markets.data||[]).map(i=>i.name).filter(name=>(run.data?.selected_industries||[]).some((i:{name:string})=>i.name===name));
 const assets=await db.from("content_assets").select("id,title,summary").eq("brand_id",scope.brand_id).in("id",await activeContentIds(db,scope.brand_id));check(assets.error);
 const assessments=await contentAssessments(db,scope.brand_id);
 const linked=await qualifyLinkedInRun(db,scope,runId,industries,run.data?.config||{});
 check((await db.from("discovery_channel_jobs").update({candidate_count:linked.candidates}).eq("run_id",runId).eq("brand_id",scope.brand_id).eq("channel","linkedin")).error);
 const counts:Record<string,number>={linkedin:linked.qualified};
 for(const row of (rows.data||[]).filter(r=>r.channel!=="linkedin")) {
  const candidate:ChannelCandidate={channel:row.channel,externalId:row.external_id,url:row.url,name:row.name,description:row.description||"",audience:row.audience,identityUrls:row.identity_urls,identityEvidence:row.identity_evidence||"",evidence:row.evidence,limitations:row.limitations};
  const quality=await qualifyCandidate(candidate,(assets.data||[]).map(a=>({...a,summary:a.summary||"",industries:assessments.get(a.id)?.matchedIndustries||[]})),industries,brand.data.name,filtersFor(run.data?.config||{},row.channel));
  counts[row.channel]??=0;
  if(await saveCandidate(db,scope,runId,candidate,quality,"Quality recheck","Saved source evidence"))counts[row.channel]++;
 }
 for(const [channel,count] of Object.entries(counts))check((await db.from("discovery_channel_jobs").update({qualified_count:count}).eq("run_id",runId).eq("brand_id",scope.brand_id).eq("channel",channel)).error);
 const jobs=await db.from("discovery_channel_jobs").select("qualified_count").eq("run_id",runId).eq("brand_id",scope.brand_id);
 check((await db.from("discovery_runs").update({profile_count:(jobs.data||[]).reduce((sum,j)=>sum+j.qualified_count,0)}).eq("id",runId).eq("brand_id",scope.brand_id)).error);
 revalidatePath("/app","layout");
}
