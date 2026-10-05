import type { ContentAssessment } from "./content-curation";
export function rankContent(assessments:ContentAssessment[],excluded:string[]=[]) {
  return assessments.filter(a=>a.industryReviewVersion===2 && a.industryVerified && a.matchedIndustries?.length && a.industryEvidence && a.ready && a.score>=70 && !excluded.includes(a.id)).sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id));
}
export function sourcePassages(body:string) {
  const words=body.split(/\s+/);
  const passages=[];
  for(let i=0;i<words.length;i+=80) passages.push({id:`p${passages.length}`,text:words.slice(i,i+80).join(" ")});
  return passages;
}
