/** Accept a domain or an HTTP(S) URL and store a canonical absolute URL. */
export function normalizeWaitlistWebsite(value: string): string | null {
  const input = value.trim();
  if (!input || input.length > 2048 || /\s|\\/.test(input)) return null;
  // Only HTTP(S) schemes are supported; never reinterpret other schemes as hosts.
  if (/^[a-z][a-z\d+.-]*:/i.test(input) && !/^https?:\/\//i.test(input)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
    const labels = url.hostname.split('.');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      labels.length < 2 || labels.some(label => !/^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label)) ||
      /^\d+$/.test(labels.at(-1)!) || url.href.length > 2048) return null;
    return url.href;
  } catch {
    return null;
  }
}
