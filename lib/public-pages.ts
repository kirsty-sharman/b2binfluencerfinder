import fs from 'node:fs';
import path from 'node:path';

// Authentication and workspace pages are not public discovery destinations.
const excluded = new Set(['app', 'auth', 'api', 'sign-in', 'sign-up']);
export function discoverPublicPages(root = path.join(process.cwd(), 'app')): string[] {
  const routes = new Set<string>();
  function walk(directory: string, segments: string[]) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    // Add sitemap.exclude alongside a page to exclude that entire subtree.
    if (entries.some(entry => entry.name === 'sitemap.exclude')) return;
    if (entries.some(entry => entry.isFile() && /^page\.(tsx?|jsx?|mdx)$/.test(entry.name))) {
      routes.add(segments.length ? `/${segments.join('/')}` : '/');
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('@') || entry.name.includes('[')) continue;
      if (/^\([^)]*\)$/.test(entry.name)) { walk(path.join(directory,entry.name),segments); continue; }
      if (!segments.length && excluded.has(entry.name)) continue;
      walk(path.join(directory,entry.name), [...segments,entry.name]);
    }
  }
  walk(root,[]);
  return [...routes].sort();
}
