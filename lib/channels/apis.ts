import { createHash } from "node:crypto";
import { fetchProviderJson } from "@/lib/providers/shared";
import { type ChannelCandidate } from "./core";
import { textContent } from "./web";

type YoutubeItem = { id: string; snippet?: {title?:string;description?:string;channelId?:string;publishedAt?:string;resourceId?:{videoId?:string}}; statistics?:{subscriberCount?:string;hiddenSubscriberCount?:boolean}; contentDetails?:{relatedPlaylists?:{uploads?:string}} };
export async function discoverYoutube(query: string, limit: number, evidenceLimit=10) {
 const key = process.env.YOUTUBE_API_KEY;
 if(!key) throw new Error("YouTube API key is not configured.");
 let requests=0;
 async function get(path:string,params:Record<string,string>) {requests++; return await fetchProviderJson(`https://www.googleapis.com/youtube/v3/${path}?${new URLSearchParams({...params,key:key!})}`, {signal:AbortSignal.timeout(20000)}, "YouTube") as {items?:YoutubeItem[]};}
 const search = await get("search",{part:"snippet",q:query,type:"video",maxResults:String(Math.min(50,limit)),relevanceLanguage:"en"});
 const ids=[...new Set((search.items||[]).map(i=>i.snippet?.channelId).filter((id):id is string=>Boolean(id)))];
 if(!ids.length) return {candidates:[],cost:0,requests,failures:[]};
 const channels=await get("channels",{part:"snippet,contentDetails,statistics",id:ids.join(",")});
 const candidates:ChannelCandidate[]=[]; const failures:string[]=[];
 for(const item of channels.items||[]) {
  try {
   const playlist=item.contentDetails?.relatedPlaylists?.uploads;
   if(!playlist) continue;
   const uploads=await get("playlistItems",{part:"snippet",playlistId:playlist,maxResults:String(evidenceLimit)});
   const url=`https://www.youtube.com/channel/${item.id}`;
   candidates.push({channel:"youtube",externalId:item.id,url,name:item.snippet?.title||"YouTube channel",description:item.snippet?.description||"",audience:item.statistics?.hiddenSubscriberCount || !item.statistics?.subscriberCount ? null : Number(item.statistics.subscriberCount),identityUrls:[url],identityEvidence:"YouTube channel ID owns the uploads playlist",evidence:(uploads.items||[]).filter(v=>v.snippet?.resourceId?.videoId).map(v=>({url:`https://www.youtube.com/watch?v=${v.snippet!.resourceId!.videoId}`,title:v.snippet?.title||"",text:v.snippet?.description||"",publishedAt:v.snippet?.publishedAt||null,author:item.snippet?.title||"",source:url})),limitations:["Assessment uses public video descriptions, not transcripts. Channel ownership does not identify a named individual."]});
  }catch {failures.push(item.id);}
 }
 return {candidates,cost:0,requests,failures};
}
export async function discoverPodcasts(query:string,limit:number,evidenceLimit=10) {
 const key=process.env.PODCAST_INDEX_API_KEY,secret=process.env.PODCAST_INDEX_API_SECRET;
 if(!key||!secret) throw new Error("Podcast Index credentials are not configured.");
 let requests=0;
 async function get(path:string,params:Record<string,string>) {
  requests++; const date=String(Math.floor(Date.now()/1000));
  return await fetchProviderJson(`https://api.podcastindex.org/api/1.0/${path}?${new URLSearchParams(params)}`,{signal:AbortSignal.timeout(20000),headers:{"X-Auth-Key":key!,"X-Auth-Date":date,Authorization:createHash("sha1").update(key!+secret!+date).digest("hex"),"User-Agent":"CreatorEvidence/1.0"}},"Podcast Index") as {feeds?:Array<{id:number;title:string;description:string;url:string;link:string;author:string}>;items?:Array<{title:string;description:string;link:string;datePublished:number}>};
 }
 const result=await get("search/byterm",{q:query,max:String(limit),fulltext:"true"});
 const candidates:ChannelCandidate[]=[];const failures:string[]=[];
 for(const feed of result.feeds||[]) {
  try {
   const episodes=await get("episodes/byfeedid",{id:String(feed.id),max:String(evidenceLimit)});
   candidates.push({channel:"podcast",externalId:String(feed.id),url:feed.link||feed.url,name:feed.title,description:textContent(feed.description),audience:null,identityUrls:[feed.url],identityEvidence:"Podcast Index feed ID; episode ownership belongs to this show, not its guests",evidence:(episodes.items||[]).filter(e=>e.link).map(e=>({url:e.link,title:e.title,text:textContent(e.description),publishedAt:e.datePublished?new Date(e.datePublished*1000).toISOString():null,author:feed.title,source:feed.url})),limitations:["Podcast publication account; host identity not verified. Guests are not treated as owners. Audience/download count unavailable."]});
  }catch {failures.push(String(feed.id));}
 }
 return {candidates,cost:0,requests,failures};
}
export async function discoverX(query:string,limit:number,evidenceLimit=10) {
 if(!process.env.X_BEARER_TOKEN || process.env.X_DISCOVERY_ENABLED!=="true") throw new Error("X access and costs must be validated before enabling discovery.");
 type Tweet={id:string;text:string;author_id:string;created_at?:string};
 type User={id:string;name:string;username:string;description?:string;public_metrics?:{followers_count:number}};
 let requests=0;
 async function get(path:string,params:Record<string,string>) {requests++;return await fetchProviderJson(`https://api.x.com/2/${path}?${new URLSearchParams(params)}`,{signal:AbortSignal.timeout(20000),headers:{Authorization:`Bearer ${process.env.X_BEARER_TOKEN}`}},"X") as {data?:Tweet[];includes?:{users:User[]}};}
 const result=await get("tweets/search/recent",{query,max_results:String(Math.max(10,Math.min(100,limit))),expansions:"author_id","tweet.fields":"created_at,author_id","user.fields":"description,public_metrics"});
 const candidates:ChannelCandidate[]=[]; const failures:string[]=[];
 for(const user of (result.includes?.users||[]).slice(0,limit)) {
  try {
   const timeline=await get(`users/${user.id}/tweets`,{max_results:String(Math.max(5,evidenceLimit)),exclude:"retweets,replies","tweet.fields":"created_at,author_id"});
   const url=`https://x.com/${user.username}`;
   candidates.push({channel:"x",externalId:user.id,url,name:user.name,description:user.description||"",audience:user.public_metrics?.followers_count??null,identityUrls:[url],identityEvidence:"X author ID and own-post timeline",evidence:(timeline.data||[]).filter(t=>t.author_id===user.id).slice(0,evidenceLimit).map(t=>({url:`${url}/status/${t.id}`,title:t.text.slice(0,100),text:t.text,publishedAt:t.created_at||null,author:user.name,source:url})),limitations:["Discovery searches the last seven days. Timeline evidence is bounded to the run’s inspection limit. Costs must be checked in X console."]});
  }catch {failures.push(user.id);}
 }
 return {candidates,cost:0,requests,failures};
}
