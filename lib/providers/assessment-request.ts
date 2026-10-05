/** Bounded retries for transient AI assessment failures; never include credentials in errors. */
export async function assessmentRequest(url: string, options: RequestInit, label: string): Promise<Response> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    let body: string;
    try {
      response = await fetch(url, { ...options, signal: AbortSignal.timeout(90000) });
      body = await response.text();
    } catch {
      if (attempt === 2) throw new Error(`${label}: connection failed or timed out after 3 attempts. Retry to continue from saved assessments.`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    if ([408, 429, 500, 502, 503, 504].includes(response.status) && attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      continue;
    }
    if (!response.ok) throw new Error(`${label}: HTTP ${response.status}. ${response.status === 429 ? "Check API credits and rate limits." : response.status === 401 ? "Check the configured API key." : "Retry to continue from saved assessments."}`);
    return new Response(body, { status: response.status, headers: response.headers });
  }
  throw new Error(`${label}: retry limit reached.`);
}
