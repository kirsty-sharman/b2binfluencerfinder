import { channelNames, type Channel, type ChannelCandidate } from "./core";

export type ChannelFilters = { minAudience: number | null; maxAudience: number | null; includeUnknownAudience: boolean; evidenceLimit: number; publishedWithinDays: number };
export type RunFilterConfig = { channelFilters?: Partial<Record<Channel, ChannelFilters>>; minFollowers?: number; maxFollowers?: number; maxPosts?: number };
export const audienceChannels: Channel[] = ["linkedin", "youtube", "x"];
export const evidenceLabels: Record<Channel,string> = {linkedin:"Posts to collect in total",youtube:"Videos to inspect per channel",x:"Posts to inspect per profile",podcast:"Episodes to inspect per show",newsletter:"Issues to inspect per publication",blog:"Articles to inspect per author"};
export function defaultFilters(channel:Channel):ChannelFilters {
 return {minAudience:audienceChannels.includes(channel)?1000:null,maxAudience:channel==="linkedin"?100000:null,includeUnknownAudience:!audienceChannels.includes(channel),evidenceLimit:channel==="linkedin"?60:10,publishedWithinDays:180};
}
export function filtersFor(config:RunFilterConfig,channel:Channel):ChannelFilters {
 if(config.channelFilters?.[channel])return config.channelFilters[channel]!;
 const defaults=defaultFilters(channel);
 return channel==="linkedin"?{...defaults,minAudience:config.minFollowers??1000,maxAudience:config.maxFollowers??100000,evidenceLimit:config.maxPosts??60}:defaults;
}
export function parseChannelFilters(form:FormData,channels:Channel[]) {
 const result:Partial<Record<Channel,ChannelFilters>>={};
 for(const channel of channels){
  const prefix=`${channel}.`;const defaults=defaultFilters(channel);
  const number=(key:string,fallback:number|null,min:number,max:number):number|null=>{
   const raw=form.get(prefix+key);if(raw===null)return fallback;if(raw==="" && fallback===null)return null;
   const n=Number(raw);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${channelNames[channel]}: enter a whole number from ${min} to ${max} for ${key}.`);return n;
  };
  const hasAudience=audienceChannels.includes(channel);
  const minAudience=hasAudience?number("minAudience",null,0,1000000000):null;
  const maxAudience=hasAudience?number("maxAudience",null,0,1000000000):null;
  if(minAudience!==null&&maxAudience!==null&&minAudience>maxAudience)throw new Error(`${channelNames[channel]}: maximum audience must be at least the minimum.`);
  const publishedWithinDays=number("publishedWithinDays",180,1,180)!;
  result[channel]={minAudience,maxAudience,includeUnknownAudience:!hasAudience||form.get(prefix+"includeUnknownAudience")==="on",evidenceLimit:number("evidenceLimit",defaults.evidenceLimit,channel==="linkedin"?1:3,channel==="linkedin"?200:10)!,publishedWithinDays};
 }
 return result;
}
// Applied before AI, to both fresh discovery and saved-evidence reassessment.
export function applyChannelFilters(candidate:ChannelCandidate,filters:ChannelFilters,now=Date.now()) {
 let reason:string|null=null;
 if(audienceChannels.includes(candidate.channel)) {
  if(candidate.audience===null||!Number.isFinite(candidate.audience)) {if(!filters.includeUnknownAudience)reason="Audience size is unavailable and this run excludes unknown audience sizes.";}
  else if((filters.minAudience!==null&&candidate.audience<filters.minAudience)||(filters.maxAudience!==null&&candidate.audience>filters.maxAudience))reason="Audience size is outside this channel’s selected range.";
 }
 const evidence=candidate.evidence.filter(e=>{const date=Date.parse(e.publishedAt||"");return date<=now&&date>=now-filters.publishedWithinDays*86400000;}).sort((a,b)=>Date.parse(b.publishedAt!)-Date.parse(a.publishedAt!)).slice(0,candidate.channel==="linkedin"?30:filters.evidenceLimit);
 if(!reason&&!evidence.length)reason=`No dated content found within the last ${filters.publishedWithinDays} days.`;
 return {candidate:{...candidate,evidence},reason};
}
