import type { SearchAdapter, SearchResponse } from "@/lib/providers/types";
import { canonicalLinkedInUrl, fetchProviderJson, isLinkedInContentUrl } from "@/lib/providers/shared";

type DataForSeoResponse = {
  cost?: number;
  tasks?: Array<{
    id?: string;
    status_code?: number;
    status_message?: string;
    cost?: number;
    result?: Array<{ items?: Array<{ type?: string; rank_absolute?: number; rank_group?: number; title?: string; description?: string; url?: string; domain?: string }> }>;
  }>;
};

export async function searchWeb(query: string, options: {locationCode: number; languageCode: string; depth: number}): Promise<SearchResponse> {
    const login = process.env.DATAFORSEO_LOGIN;
    const password = process.env.DATAFORSEO_PASSWORD;
    if (!login || !password) throw new Error("DataForSEO credentials are not configured on the server.");
    let raw: DataForSeoResponse | null = null;
    let task: NonNullable<DataForSeoResponse["tasks"]>[number] | undefined;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      raw = await fetchProviderJson("https://api.dataforseo.com/v3/serp/google/organic/live/regular", {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${login}:${password}`).toString("base64")}`, "Content-Type": "application/json" },
        body: JSON.stringify([{ keyword: query, location_code: options.locationCode, language_code: options.languageCode, depth: options.depth }]),
      }, "DataForSEO") as DataForSeoResponse;
      task = raw.tasks?.[0];
      if (task?.status_code === 20000) break;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
    if (!raw || task?.status_code !== 20000) throw new Error(`DataForSEO task failed after three attempts: ${task?.status_message || "unknown task error"}`);
    const results = (task.result?.[0]?.items || [])
      .filter((item) => item.type === "organic" && item.url)
      .map((item) => ({ rank: item.rank_absolute ?? item.rank_group ?? null, title: item.title || "", excerpt: item.description || "", url: item.url!, domain: item.domain || "" }));
    return { results, cost: Number(raw.cost || task.cost || 0), externalId: task.id || null, raw };
}

export const dataForSeoAdapter: SearchAdapter = {
 configured: Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD),
 async searchLinkedIn(query, options) {
  const response = await searchWeb(query, options);
  return {...response, results: response.results.filter(item => isLinkedInContentUrl(item.url)).map(item => ({...item, url: canonicalLinkedInUrl(item.url)}))};
 }
};
