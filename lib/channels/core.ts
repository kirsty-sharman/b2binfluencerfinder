export const channelNames = { linkedin: "LinkedIn", newsletter: "Newsletters", blog: "Blogs", youtube: "YouTube", podcast: "Podcasts", x: "X" } as const;
export type Channel = keyof typeof channelNames;
export type EvidenceItem = { url: string; title: string; text: string; publishedAt: string | null; author: string; source: string };
export type ChannelCandidate = {
  channel: Channel; externalId: string; url: string; name: string; description: string;
  audience: number | null; identityUrls: string[]; identityEvidence: string;
  evidence: EvidenceItem[]; limitations: string[];
};
export type ChannelQuery = { channel: Channel; phraseId: string; phrase: string; industry: string; query: string };
export function isChannel(value: string): value is Channel { return value in channelNames; }
export function canonicalUrl(raw: string) {
  const url = new URL(raw);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid public URL");
  url.protocol = "https:"; url.hash = "";
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
  url.hostname = url.hostname.toLowerCase().replace(/^www\./, "").replace(/^twitter\.com$/, "x.com");
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}
export function validPublicUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  try { canonicalUrl(raw); return true; } catch { return false; }
}
const clean = (value: string) => value.replace(/["\r\n]/g, " ").trim();
export function channelQuery(channel: Channel, phrase: string, industry: string, round: number) {
  const terms = `"${clean(phrase)}" "${clean(industry)}"`;
  switch (channel) {
    case "linkedin": return `site:linkedin.com/${round % 2 ? "pulse" : "posts"} ${terms}`;
    case "newsletter": return [`"${clean(industry)}" newsletter`, `site:substack.com "${clean(industry)}"`, `site:beehiiv.com "${clean(industry)}"`][round % 3];
    case "blog": return `"${clean(industry)}" (blog OR articles) (author OR insights) -site:linkedin.com -site:youtube.com -site:x.com`;
    case "youtube": return `"${clean(industry)}" ${clean(phrase)}`;
    case "podcast": return clean(industry);
    case "x": return `"${clean(industry)}" -is:retweet -is:reply lang:en`;
  }
}
// Round-robin across channels AND markets before allocating second searches.
export function planChannels(phrases: {id:string;phrase:string}[], industries: {name:string}[], channels: Channel[], limit: number): ChannelQuery[] {
  if (!phrases.length || !industries.length || !channels.length) return [];
  const result: ChannelQuery[] = []; const seen = new Set<string>();
  for (let round = 0; round < phrases.length * 3 && result.length < limit; round++) {
    for (const industry of industries) for (const channel of channels) {
      const phrase = phrases[round % phrases.length];
      const query = channelQuery(channel, phrase.phrase, industry.name, Math.floor(round / phrases.length));
      const key = `${channel}:${query}`;
      if (result.length < limit && !seen.has(key)) { result.push({channel,phraseId:phrase.id,phrase:phrase.phrase,industry:industry.name,query}); seen.add(key); }
    }
  }
  return result;
}
export function recentEvidence(candidate: ChannelCandidate, now = Date.now()) {
  return [...new Map(candidate.evidence.filter(e => validPublicUrl(e.url)).map(e => [canonicalUrl(e.url), e])).values()].filter(e => {
    const date = Date.parse(e.publishedAt || "");
    return date <= now && date >= now - 180 * 86400000 && e.text.trim().length >= (candidate.channel === "x" ? 100 : 200);
  });
}
export function identityOverlap(a: ChannelCandidate, b: ChannelCandidate) {
  // Explicit author/profile links only. Publication domains and names are not identities.
  const urls = new Set((a.identityUrls || []).filter(validPublicUrl).map(canonicalUrl));
  return Boolean(a.identityEvidence && b.identityEvidence && (b.identityUrls || []).filter(validPublicUrl).some(url => urls.has(canonicalUrl(url))));
}
