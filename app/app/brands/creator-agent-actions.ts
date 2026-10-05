"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { brandBoundary, generateMatches, listCreatorResults } from "@/lib/matching";
import { executeMultiChannelRun } from "@/lib/channels/runner";
import { stageDefinitions } from "@/lib/discovery";

export async function refillCreatorQueue(brandSlug: string): Promise<{ message: string; running?: boolean }> {
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return { message: "Brand not found." };
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) return { message: "Sign in to use creator refills." };
  const list = await listCreatorResults(brandSlug);
  const waiting = list?.creators.filter(c => c.eligible && c.reviewStatus === "pending").length ?? 0;
  const { data: active } = await supabase.from("discovery_runs").select("id").eq("brand_id", brand.id).in("status", ["queued","running"]).limit(1);
  if (active?.length) return { message: "Searching for more creators in the background.", running: true };
  if (waiting >= 10) return { message: `${waiting} creators ready to review. Saved matches are used first.` };
  if (list?.creators.some(c => !c.eligible && c.reviewStatus === "pending")) return {message:"Saved candidates need a quality recheck. Automatic searches are paused until they are reviewed."};
  // Matching stored evidence is deterministic: no provider search or AI call.
  await generateMatches(supabase, brand);
  const refreshed = await listCreatorResults(brandSlug);
  if ((refreshed?.creators.filter(c => c.eligible && c.reviewStatus === "pending").length ?? 0) >= 10) {
    revalidatePath(`/app/brands/${brandSlug}/creators`);
    return { message: "More matches are ready from your saved creators." };
  }
  const { data: previous } = await supabase.from("discovery_runs").select("*").eq("brand_id",brand.id).order("created_at",{ascending:false}).limit(1);
  const template = previous?.[0];
  if (!template || template.status !== "ready" || template.config?.version !== 2)
    return { message: "Complete a search in Search runs to set up automatic refills." };
  if (template.config?.automaticRefill) {
    const oldIds: string[] = template.config.existingCreatorIds || [];
    const newlyReady = refreshed?.creators.filter(c => c.eligible && !oldIds.includes(c.id)).length ?? 0;
    if (!newlyReady) return { message: "Refills paused: the last search found no new qualified matches. Adjust your search in Search runs." };
  }
  const { data: queries, error: queryError } = await supabase.from("discovery_run_queries").select("*").eq("run_id",template.id).eq("approved",true).order("id").limit(25);
  if (queryError || !queries?.length) return { message: "Review your search settings before starting a refill." };
  const { data: reason, error: reserveError } = await supabase.rpc("reserve_brand_search",{target_brand:brand.id});
  if (reserveError) return { message: "Automatic refills need the search allowance database update." };
  if (reason) return { message: String(reason) };
  let runId: string | undefined;
  try {
    // Spread a bounded refill across the previously approved channels.
    const selected = [];
    const remaining = [...queries];
    while (selected.length < 6 && remaining.length) {
      const used = new Set<string>();
      for (let i=0; i<remaining.length && selected.length<6;) {
        if (used.has(remaining[i].channel)) { i++; continue; }
        used.add(remaining[i].channel);
        selected.push(remaining.splice(i,1)[0]);
      }
    }
    const channels = [...new Set(selected.map(q => q.channel))];
    const channelFilters = Object.fromEntries(channels.map(channel => [channel,{...template.config.channelFilters?.[channel], evidenceLimit: Math.min(template.config.channelFilters?.[channel]?.evidenceLimit ?? 10,10)}]));
    const config = {...template.config, channels, channelFilters, maxProfiles:5, maxPosts:10, searchDepth:10, automaticRefill:true, existingCreatorIds:refreshed?.creators.map(c=>c.id)||[]};
    const scope = {workspace_id:brand.workspace_id,brand_id:brand.id};
    const { data: run, error } = await supabase.from("discovery_runs").insert({...scope,name:`${brand.name} · Creator refill`,status:"queued",selected_industries:template.selected_industries,config,query_count:selected.length}).select("id").single();
    if (error || !run) throw new Error("Could not create refill");
    runId = run.id;
    const inserted = await supabase.from("discovery_run_queries").insert(selected.map(q=>({...scope,run_id:run.id,channel:q.channel,source_phrase:q.source_phrase,industry:q.industry,query:q.query,approved:true})));
    if (inserted.error) throw inserted.error;
    const jobs = await supabase.from("discovery_channel_jobs").insert(channels.map(channel=>({...scope,run_id:run.id,channel})));
    if (jobs.error) throw jobs.error;
    if (channels.includes("linkedin")) {
      const stages = await supabase.from("discovery_run_stages").insert(stageDefinitions.map((stage,index)=>({...scope,run_id:run.id,stage_key:stage.key,sequence:index+1,label:stage.label,provider:stage.provider})));
      if (stages.error) throw stages.error;
    }
    after(async()=>{
      try { await executeMultiChannelRun(supabase,brandSlug,run.id); await generateMatches(supabase,brand); }
      catch { await supabase.from("discovery_runs").update({status:"failed",error_message:"Refill interrupted. Review it in Search runs."}).eq("id",run.id); }
      revalidatePath(`/app/brands/${brandSlug}/creators`);
    });
    return { message:"Searching for more creators in the background.",running:true };
  } catch {
    if (runId) await supabase.from("discovery_runs").update({status:"failed",error_message:"Refill setup failed. Review Search runs."}).eq("id",runId);
    return { message:"Refill could not start. Your saved creators are still available." };
  }
}

// Poll only run status; never regenerate matches or launch work from a timer.
export async function checkCreatorSearchStatus(brandSlug: string) {
  const { supabase, brand } = await brandBoundary(brandSlug);
  if (!brand) return { message: "Brand not found.", running: false };
  const { data, error } = await supabase.from("discovery_runs").select("id").eq("brand_id", brand.id).in("status", ["queued", "running"]).limit(1);
  if (error) throw new Error("Unable to check search status.");
  return { running: Boolean(data?.length), message: data?.length ? "Searching for more creators in the background." : "Search finished. Your saved creators are up to date." };
}
