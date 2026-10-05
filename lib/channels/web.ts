import { readPublicDocument } from "@/lib/content-discovery";
import { searchWeb } from "@/lib/providers/dataforseo";
import { canonicalUrl, type ChannelCandidate, type EvidenceItem } from "./core";
export function textContent(raw: string) {
 return raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/\s+/g," ").trim();
}
const field = (xml: string, name: string) => textContent(xml.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`,"i"))?.[1] || "");
export function parseFeed(xml: string, feedUrl: string): EvidenceItem[] {
 return [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].slice(0,10).flatMap(match => {
  const item = match[2];
  const raw = field(item,"link") || item.match(/<link\b[^>]*href=["']([^"']+)/i)?.[1];
  if (!raw) return [];
  try { return [{url:canonicalUrl(new URL(raw,feedUrl).toString()),title:field(item,"title"),text:(field(item,"content:encoded") || field(item,"content") || field(item,"description") || field(item,"summary")).slice(0,12000),publishedAt:field(item,"pubDate") || field(item,"published") || field(item,"updated") || null,author:field(item,"dc:creator") || field(item,"author"),source:feedUrl}]; } catch {return [];}
 });
}
export function articleIdentity(html: string, pageUrl: string) {
 const objects: Record<string,unknown>[] = [];
 function collect(value: unknown) { if (Array.isArray(value)) value.forEach(collect); else if (value && typeof value === "object") {const object = value as Record<string,unknown>; objects.push(object); if(object["@graph"]) collect(object["@graph"]); } }
 for (const script of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {try {collect(JSON.parse(script[1]));} catch {/* malformed metadata */}}
 const article = objects.find(o => /Article|BlogPosting/.test(String(o["@type"])));
 const authorValue = Array.isArray(article?.author) ? article.author[0] : article?.author;
 let author = authorValue && typeof authorValue === "object" ? authorValue as Record<string,unknown> : null;
 if(author?.["@id"] && !author.name)author=objects.find(o=>o["@id"]===author!["@id"])||author;
 if (!author || author["@type"] !== "Person" || typeof author.name !== "string" || typeof author.url !== "string") return null;
 try {
  const url = canonicalUrl(new URL(author.url,pageUrl).toString());
  const title = typeof article?.headline === "string" ? article.headline : field(html,"title");
  return {url,name:author.name,title,publishedAt:typeof article?.datePublished === "string" ? article.datePublished : null};
 } catch {return null;}
}
export async function discoverWeb(channel: "blog"|"newsletter", query: string, maxCandidates: number, evidenceLimit=10) {
 const response = await searchWeb(query,{locationCode:2840,languageCode:"en",depth:10});
 const candidates: ChannelCandidate[] = [];
 const failures: string[] = [];
 for (const result of response.results.slice(0,Math.max(maxCandidates,5))) {
  if(candidates.length >= maxCandidates)break;
  try {
   const html = await readPublicDocument(result.url);
   let identity = articleIdentity(html,result.url);
   const originalIdentity=identity;
   const feedLink = [...html.matchAll(/<link\b[^>]*>/gi)].find(m=>/application\/(rss|atom)\+xml/i.test(m[0]))?.[0].match(/href=["']([^"']+)/i)?.[1];
   const feedUrl = feedLink ? new URL(feedLink,result.url).toString() : new URL(result.url).hostname.endsWith(".substack.com") ? new URL("/feed",result.url).toString() : null;
   const feed = feedUrl ? await readPublicDocument(feedUrl).then(xml=>parseFeed(xml,feedUrl)).catch(()=>[]) : [];
   if(!identity && feed.length) {
    // A publication's feed is an account identity, not proof that every contributor is the same person.
    const publicationTitle=field(html,"title");
    candidates.push({channel,externalId:canonicalUrl(feedUrl!),url:new URL(result.url).origin,name:publicationTitle||result.title,description:result.excerpt,audience:null,identityUrls:[canonicalUrl(feedUrl!)],identityEvidence:`Publication RSS feed linked from ${result.url}; individual ownership not inferred`,evidence:feed.slice(0,evidenceLimit),limitations:["Publication account; named owner not verified. Subscriber count unavailable."]});
    continue;
   }
   if (!identity) {
    // Home/author pages can lead to an attributed article without buying another search.
    const links=[...html.matchAll(/href=["']([^"']+)["']/gi)].flatMap(m=>{try{const u=new URL(m[1],result.url);return u.origin===new URL(result.url).origin && /\/(p|blog|articles?)\//i.test(u.pathname)?[u.toString()]:[];}catch{return [];}});
    for(const url of [...new Set(links)].slice(0,3)) {const body=await readPublicDocument(url).catch(()=>"");const found=articleIdentity(body,url);if(found){identity=found;break;}}
   }
   if(!identity)continue;
   if (channel === "newsletter" && !feedUrl && !/newsletter|substack|beehiiv/i.test(html)) continue;
   let evidence: EvidenceItem[] = [{url:canonicalUrl(result.url),title:identity.title,text:textContent(html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "").slice(0,12000),publishedAt:identity.publishedAt,author:identity.name,source:result.url}];
   if(!originalIdentity)evidence=[];
   if (feedUrl) {
    evidence = [...evidence,...feed.filter(e => e.author.toLowerCase() === identity.name.toLowerCase())];
   }
   // Author-page metadata is checked before accepting sameAs identity links.
   const authorHtml = await readPublicDocument(identity.url).catch(()=>"");
   const identityUrls = [identity.url];
   // Gather additional articles from the same author's public page, checking each byline.
   const related=[...authorHtml.matchAll(/href=["']([^"']+)["']/gi)].flatMap(m=>{try{const u=new URL(m[1],identity!.url);return u.origin===new URL(identity!.url).origin && u.pathname!==new URL(identity!.url).pathname && /\/(p|blog|articles?)\//i.test(u.pathname)?[u.toString()]:[];}catch{return [];}});
   for(const url of [...new Set(related)].slice(0,5)) {
    const body=await readPublicDocument(url).catch(()=>"");const byline=articleIdentity(body,url);
    if(byline?.url===identity.url && byline.name===identity.name)evidence.push({url:canonicalUrl(url),title:byline.title,text:textContent(body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]||body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||"").slice(0,12000),publishedAt:byline.publishedAt,author:byline.name,source:identity.url});
   }
   for (const script of authorHtml.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {const p=JSON.parse(script[1]); if(p["@type"] === "Person" && p.name === identity.name && Array.isArray(p.sameAs)) for(const u of p.sameAs) if(typeof u === "string") identityUrls.push(canonicalUrl(u));} catch {/* Ignore invalid identity claims. */}
   }
   candidates.push({channel,externalId:identity.url,url:identity.url,name:identity.name,description:result.excerpt,audience:null,identityUrls,identityEvidence:`Person byline on ${result.url}`,evidence:evidence.slice(0,evidenceLimit),limitations:["Subscriber/readership count unavailable; only public, attributed content inspected."]});
  } catch {failures.push(result.url);}
 }
 return {candidates,cost:response.cost,requests:1,failures};
}
