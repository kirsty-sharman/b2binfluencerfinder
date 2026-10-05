import type { ContentAssetRecord } from "./research";
export function contentStatus(asset: ContentAssetRecord) {
  if (asset.eligible) return "active";
  const audit = asset.assessment;
  if (!audit || audit.industryReviewVersion !== 2) return "review";
  return audit.industryVerified && audit.matchedIndustries?.length && audit.ready && audit.score >= 70 ? "ready" : "excluded";
}
export function contentLibraryPage(assets: ContentAssetRecord[], query: string, filter: string, page: number) {
  const counts = { active: 0, ready: 0, review: 0, excluded: 0 };
  assets.forEach(asset => counts[contentStatus(asset)]++);
  const matching = assets.filter(asset => (filter === "all" || contentStatus(asset) === filter) && `${asset.title} ${asset.topics.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())).sort((a,b)=>(b.assessment?.score ?? -1)-(a.assessment?.score ?? -1) || a.id.localeCompare(b.id));
  const pages = Math.max(1, Math.ceil(matching.length / 10));
  const current = Math.min(pages, Math.max(1, Math.floor(page) || 1));
  return { assets: matching.slice((current-1)*10,current*10), count: matching.length, counts, pages, current };
}
