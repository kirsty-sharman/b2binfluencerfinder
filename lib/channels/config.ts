import { channelNames, type Channel } from "./core";
export function channelAvailability() {
 const google = Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
 const ai = Boolean(process.env.OPENAI_API_KEY);
 const requirements: Record<Channel, [boolean,string]> = {
  linkedin: [google && Boolean(process.env.BRIGHTDATA_API_TOKEN) && ai, "DataForSEO, Bright Data and OpenAI credentials"],
  newsletter: [google && ai, "DataForSEO and OpenAI credentials"],
  blog: [google && ai, "DataForSEO and OpenAI credentials"],
  youtube: [Boolean(process.env.YOUTUBE_API_KEY) && ai, "YouTube Data API key and OpenAI credentials"],
  podcast: [Boolean(process.env.PODCAST_INDEX_API_KEY && process.env.PODCAST_INDEX_API_SECRET) && ai, "Podcast Index key/secret and OpenAI credentials"],
  x: [Boolean(process.env.X_BEARER_TOKEN && process.env.X_DISCOVERY_ENABLED === "true") && ai, "X bearer token, OpenAI credentials and validated X access/costs (X_DISCOVERY_ENABLED=true)"],
 };
 return (Object.keys(channelNames) as Channel[]).map(channel => ({channel,label:channelNames[channel],ready:requirements[channel][0],requirement:requirements[channel][1]}));
}
