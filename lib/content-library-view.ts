import type { ContentAssetRecord } from "./research";
export function contentStatus(asset: ContentAssetRecord) {
  if (asset.eligible) return "active";
  const audit = asset.assessment;
  if (!audit) return "review";
  // Older off-target assessments are deliberately retained by the scanner.
  if (!audit.matchedIndustries?.length) return "excluded";
  if (audit.industryReviewVersion !== 2) return "review";
  return audit.industryVerified && audit.matchedIndustries?.length && audit.ready && audit.score >= 70 ? "ready" : "excluded";
}
export type LibraryOptions = { type?: string; industry?: string; source?: string; minScore?: string; sort?: string };
function sourceOf(asset: ContentAssetRecord) { try { return new URL(asset.url).hostname; } catch { return ""; } }
export function contentLibraryPage(assets: ContentAssetRecord[], query: string, filter: string, page: number, options: LibraryOptions = {}) {
  const counts = { active: 0, ready: 0, review: 0, excluded: 0 };
  assets.forEach(asset => counts[contentStatus(asset)]++);
  const unique = (values: string[]) => [...new Set(values.filter(Boolean))].sort();
  const facets = { types: unique(assets.map(a=>a.contentType)), industries: unique(assets.flatMap(a=>a.assessment?.matchedIndustries || [])), sources: unique(assets.map(sourceOf)) };
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matching = assets.filter(asset => {
    const text = `${asset.title} ${asset.url} ${asset.topics.join(" ")} ${(asset.assessment?.matchedIndustries || []).join(" ")}`.toLowerCase();
    return (filter === "all" || contentStatus(asset) === filter) && terms.every(term=>text.includes(term))
      && (!options.type || asset.contentType===options.type)
      && (!options.industry || asset.assessment?.matchedIndustries?.includes(options.industry))
      && (!options.source || sourceOf(asset)===options.source)
      && (!options.minScore || (Boolean(asset.assessment?.matchedIndustries?.length) && (asset.assessment?.score ?? -1)>=Number(options.minScore)));
  }).sort((a,b)=>{
    if(options.sort==='title') return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
    if(options.sort==='title-desc') return b.title.localeCompare(a.title) || a.id.localeCompare(b.id);
    const score=(asset:ContentAssetRecord)=>asset.assessment?.matchedIndustries?.length ? asset.assessment.score : -1;
    return score(b)-score(a) || a.id.localeCompare(b.id);
  });
  const pages = Math.max(1, Math.ceil(matching.length / 10));
  const current = Math.min(pages, Math.max(1, Math.floor(page) || 1));
  return { assets: matching.slice((current-1)*10,current*10), count: matching.length, counts, facets, pages, current };
}
