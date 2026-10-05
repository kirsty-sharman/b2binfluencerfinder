import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

export function normalizeContentUrl(raw: string, base?: string) {
  const url = new URL(raw, base);
  url.hash = "";
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

function plain(html: string) {
  return html.replace(/<(script|style|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, code: string) => { const n = code[0].toLowerCase() === "x" ? parseInt(code.slice(1), 16) : Number(code); return n <= 0x10ffff ? String.fromCodePoint(n) : " "; })
    .replace(/&(amp|quot|apos|lt|gt|nbsp);/g, (_, name: string) => ({ amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " })[name] || " ")
    .replace(/\s+/g, " ").trim();
}

export function isContentCandidate(raw: string) {
  const path = new URL(raw).pathname;
  if (/\.(xml|png|jpg|jpeg|svg|webp|pdf|zip)$/i.test(path) || /\/(login|signup|privacy|terms|category|categories|topic|topics|tag|author|page)(\/|$)/i.test(path)) return false;
  if (/\/(learn|blog|resources?|articles?|guides?|case-studies)\/?$/i.test(path)) return false;
  return path !== "/";
}

export function extractContentAsset(html: string, url: string) {
  const title = plain(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const bodyHtml = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] || html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] || "";
  const body = plain(bodyHtml);
  if (!title || body.split(/\s+/).length < 200) return null;
  const labels: Array<[string, RegExp]> = [["Banking", /bank|credit union|neobank/i], ["Financial advisory", /financial|finance|fintech|insurance|wealth/i], ["Professional education", /education|school|college|training|course/i], ["SaaS", /saas|software/i]];
  const topics = labels.filter(([, expression]) => expression.test(`${title} ${body.slice(0, 4000)}`)).map(([label]) => label);
  const contentType = /case.study/i.test(`${title} ${url}`) ? "case-study" : /benchmark|report|research/i.test(title) ? "research" : /guide|how to|strateg/i.test(title) ? "guide" : "article";
  return { url, title, content_type: contentType, summary: body.slice(0, 14000), topics, target_industries: topics, evidence_strength: "unreviewed" as const, eligible: false };
}

function siteReader(rootDomain: string) {
  const root = new URL(rootDomain.startsWith("http") ? rootDomain : `https://${rootDomain}`);
  const domain = root.hostname.replace(/^www\./, "");
  if (isIP(domain) || !domain.includes(".") || domain.endsWith(".local")) throw new Error("Use a public website domain in the brand profile.");
  const allowed = (url: URL) => [domain, `www.${domain}`].includes(url.hostname) && ["https:", "http:"].includes(url.protocol) && !url.port && !url.username && !url.password;
  const validated = new Set<string>();
  async function read(raw: string, redirects = 0): Promise<string> {
    const url = new URL(raw);
    if (!allowed(url) || redirects > 4) throw new Error("URL is outside the brand website.");
    if (!validated.has(url.hostname)) {
      const addresses = await lookup(url.hostname, { all: true });
      if (!addresses.length || addresses.some(({ address }) => /^(127\.|10\.|192\.168\.|169\.254\.|0\.|172\.(1[6-9]|2\d|3[01])\.|::|f[cd]|fe[89ab])/i.test(address))) throw new Error("Website must resolve to a public address.");
      validated.add(url.hostname);
    }
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(12000), headers: { "User-Agent": "CreatorEvidenceBot/1.0" }, cache: "no-store" });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) return read(new URL(response.headers.get("location")!, url).toString(), redirects + 1);
    if (!response.ok) throw new Error(`Website returned HTTP ${response.status}.`);
    const reader = response.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > 3_000_000) throw new Error("Page exceeds scan size limit."); chunks.push(part.value); }
    } finally { await reader.cancel(); }
    return Buffer.concat(chunks).toString("utf8");
  }
  return {root, allowed, read};
}

export async function scanContentUrl(raw: string) {
  const url = normalizeContentUrl(raw.startsWith("http") ? raw : `https://${raw}`);
  const {read} = siteReader(new URL(url).origin);
  const asset = extractContentAsset(await read(url),url);
  if (!asset) throw new Error("This page has too little readable article content. Use a public article, guide, report or case-study URL.");
  return asset;
}

export async function discoverContentAssets(rootDomain: string, existingUrls: string[], limit = Number.POSITIVE_INFINITY) {
  const {root, allowed, read} = siteReader(rootDomain);
  const robots = await read(new URL("/robots.txt", root).toString()).catch(() => "");
  const disallowed: string[] = [];
  let applies = false;
  for (const line of robots.split(/\r?\n/)) {
    const match = line.replace(/#.*/, "").match(/^\s*([\w-]+):\s*(.*)/);
    if (!match) continue;
    if (match[1].toLowerCase() === "user-agent") applies = ["*", "creatorevidencebot"].includes(match[2].trim().toLowerCase());
    if (applies && match[1].toLowerCase() === "disallow" && match[2].trim()) disallowed.push(match[2].trim().split("*")[0]);
  }
  const permitted = (raw: string) => { try { const url = new URL(raw); return allowed(url) && !disallowed.some((path) => url.pathname.startsWith(path)); } catch { return false; } };
  const maps = [...robots.matchAll(/^sitemap:\s*(\S+)/gim)].map((match) => match[1]);
  maps.push(new URL("/sitemap.xml", root).toString());
  const visited = new Set<string>();
  const candidates = new Set<string>();
  let sitemapFailures = 0;
  while (maps.length && visited.size < 1000) {
    const next = maps.shift()!;
    if (visited.has(next) || !permitted(next)) continue;
    visited.add(next);
    try {
      const xml = await read(next);
      const locations = [...xml.matchAll(/<loc\b[^>]*>([\s\S]*?)<\/loc>/gi)].map((m) => plain(m[1]));
      for (const location of locations) {
        if (!permitted(location)) continue;
        if (/<sitemapindex\b/i.test(xml)) maps.push(location);
        else if (isContentCandidate(location)) candidates.add(normalizeContentUrl(location));
      }
    } catch { sitemapFailures++; }
  }
  if (!candidates.size) {
    const html = await read(root.toString());
    for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
      try { const url = normalizeContentUrl(match[1], root.toString()); if (permitted(url) && isContentCandidate(url)) candidates.add(url); } catch { /* Ignore malformed links. */ }
    }
  }
  const existing = new Set(existingUrls.map((url) => normalizeContentUrl(url)));
  const pending = [...candidates].filter((url) => !existing.has(url));
  const assets: NonNullable<ReturnType<typeof extractContentAsset>>[] = [];
  let failed = 0;
  let skipped = 0;
  const selected = pending.slice(0, limit);
  for (let index = 0; index < selected.length; index += 4) {
    await Promise.all(selected.slice(index, index + 4).map(async (url) => {
      try { const asset = extractContentAsset(await read(url), url); if (asset) assets.push(asset); else skipped++; } catch { failed++; }
    }));
  }
  return { assets, discovered: candidates.size, attempted: selected.length, remaining: Math.max(0, pending.length - selected.length), failed, skipped, sitemapFailures, remainingSitemaps: maps.length };
}

/** Uses the same bounded, public-address-only reader as brand scans. */
export async function readPublicDocument(raw: string) {
  const url = new URL(raw);
  const reader = siteReader(url.origin);
  return reader.read(url.toString());
}
