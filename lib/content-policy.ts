import { createHash } from "node:crypto";
import type { ContentClient } from "./content-selection";
export const contentFingerprint = (title:string, body:string|null, industries:string[]=[]) => createHash("sha256").update(JSON.stringify(["industry-gate-v1",title,body || "",[...industries].sort()])).digest("hex");
export async function contentIndustries(client:ContentClient, brandId:string):Promise<string[]> {
  const {data,error}=await client.from("brand_industries").select("name").eq("brand_id",brandId).order("priority");
  if(error) throw new Error("Unable to load target industries.");
  return (data || []).map(row=>row.name);
}
export type IndustryFit = {matchedIndustries:string[];industryReason:string;industryEvidence:string};
export function passesIndustryGate(assessment:IndustryFit,industries:string[]) {
  return Boolean(assessment.industryEvidence && assessment.matchedIndustries?.some(name=>industries.includes(name)));
}
