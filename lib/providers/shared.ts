export function canonicalLinkedInUrl(raw: string) {
  try {
    const url = new URL(raw);
    url.protocol = "https:";
    url.hostname = "www.linkedin.com";
    if (/^\/in\//i.test(url.pathname)) url.pathname = url.pathname.toLowerCase();
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

export function isLinkedInContentUrl(url = "") {
  return /linkedin\.com\/(posts|pulse)\//i.test(url);
}

export async function fetchProviderJson(url: string, options: RequestInit, label: string) {
  let response: Response;
  try { response = await fetch(url, { ...options, signal:options.signal || AbortSignal.timeout(60000), cache: "no-store" }); }
  catch { throw new Error(`${label}: network request failed or timed out. Retry resumes saved checkpoints.`); }
  const text = await response.text();
  let data: unknown;
  try { data = text ? JSON.parse(text) : null; }
  catch { throw new Error(`${label} returned HTTP ${response.status} with an unreadable response.`); }
  if (!response.ok) {
    const details = data as { message?: string; error?: string; status_message?: string } | null;
    throw new Error(`${label} failed: ${details?.message || details?.error || details?.status_message || `HTTP ${response.status}`}`);
  }
  return data;
}
