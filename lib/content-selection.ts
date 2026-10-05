import { cache } from "react";
import { createHash } from "node:crypto";
import type { createSupabaseServerClient } from "@/lib/supabase/server";
export type ContentClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
export type Selection = { ids: string[]; excluded: string[]; revision: number };
export const CONTENT_LIMIT = 20;
export const EMPTY_ID = "00000000-0000-0000-0000-000000000000";
function selectionId(brandId: string, revision: number) {
  const h = createHash("sha256").update(`content-selection:${brandId}:${revision}`).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-a${h.slice(17,20)}-${h.slice(20,32)}`;
}
// Immutable selection snapshots are authoritative. A deterministic id per revision
// allows exactly one successor, preventing concurrent changes from overfilling the cap.
export async function getContentSelection(client: ContentClient, brandId: string): Promise<Selection> {
  const {data,error} = await client.from("audit_events").select("changes").eq("brand_id",brandId).eq("action","content.selection").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if (error) throw new Error(`Unable to load active content: ${error.message}`);
  return data ? data.changes as Selection : {ids:[],excluded:[],revision:0};
}
export function changeSelection(current: Selection, id: string, add: boolean): Selection {
  const ids = current.ids.filter(value => value !== id);
  if (add) ids.push(id);
  if (ids.length > CONTENT_LIMIT) throw new Error("You have 20 active assets. Remove one before adding another.");
  return {ids, excluded:add ? current.excluded.filter(value=>value!==id) : [...new Set([...current.excluded,id])],revision:current.revision+1};
}
export async function saveContentSelection(client: ContentClient, brand: {id:string;workspace_id:string}, current: Selection, next: Selection) {
  const ids = [...new Set(next.ids)];
  if (ids.length > CONTENT_LIMIT) throw new Error("Only 20 active assets are allowed.");
  if (ids.length) {
    const {data,error} = await client.from("content_assets").select("id").eq("brand_id",brand.id).in("id",ids);
    if (error || data?.length !== ids.length) throw new Error("Some selected assets no longer belong to this brand. Refresh and retry.");
  }
  const changes = {...next,ids,revision:current.revision+1};
  const latest=await getContentSelection(client,brand.id);
  if(latest.revision!==current.revision) throw new Error("Content selection changed in another session. Refresh and retry.");
  const {error}=await client.from("audit_events").insert({id:selectionId(brand.id,changes.revision),workspace_id:brand.workspace_id,brand_id:brand.id,entity_type:"content_selection",entity_id:brand.id,action:"content.selection",changes});
  if(error) throw new Error(`Unable to save content selection: ${error.code === "23505" ? "Another session changed this selection. Refresh and retry." : error.message}`);
  // Matching readers use the authoritative ids, even if a projection update is delayed.
  await client.from("content_assets").update({eligible:false}).eq("brand_id",brand.id);
  if (ids.length) await client.from("content_assets").update({eligible:true}).eq("brand_id",brand.id).in("id",ids);
}
export const activeContentIds = cache(async function activeContentIds(client: ContentClient, brandId: string) {
  const {ids} = await getContentSelection(client,brandId);
  const {qualifiedContentIds}=await import("./content-curation");
  const qualified=await qualifiedContentIds(client,brandId,ids);
  const active=ids.filter(id=>qualified.includes(id));
  return active.length ? active : [EMPTY_ID];
});
export async function allContent(client: ContentClient, brandId: string) {
  const rows: Array<{id:string;title:string;url:string;summary:string|null;content_type:string;topics:string[];evidence_strength:string;eligible:boolean}> = [];
  for (let offset=0;;offset+=1000) {
    const {data,error} = await client.from("content_assets").select("id,title,url,summary,content_type,topics,evidence_strength,eligible").eq("brand_id",brandId).order("id").range(offset,offset+999);
    if (error) throw new Error(error.message);
    rows.push(...(data || []));
    if (!data || data.length<1000) return rows;
  }
}
