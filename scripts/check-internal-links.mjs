// Run against a running development or production server: npm run check:links -- http://localhost:3000
import fs from 'node:fs';
import assert from 'node:assert/strict';
const origin = process.argv[2] || 'http://localhost:3000';
const posts = fs.readdirSync('content/blog').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(`content/blog/${f}`,'utf8'))).filter(p=>p.status==='published');
const slugs = new Set(posts.map(p=>p.slug));
for (const post of posts) {
  for (const slug of post.relatedArticles || []) assert(slugs.has(slug) && slug !== post.slug, `Invalid related article in ${post.slug}: ${slug}`);
  assert(posts.some(p=>p.slug!==post.slug && p.relatedArticles?.includes(post.slug)), `No editorial inbound link to ${post.slug}`);
}
const sitemap = await fetch(`${origin}/sitemap.xml`).then(r=>r.text());
const routes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>new URL(m[1]).pathname);
assert(routes.length >= posts.length + 4, 'Sitemap is missing public pages');
assert.equal(new Set(routes).size, routes.length, 'Sitemap contains duplicate URLs');
const expectedBlogRoutes = new Set(posts.map(post => `/blog/${post.slug}`));
for (const route of expectedBlogRoutes) assert(routes.includes(route), `Published article missing from sitemap: ${route}`);
for (const route of routes.filter(route => route.startsWith('/blog/'))) {
  assert(expectedBlogRoutes.has(route), `Sitemap contains an unpublished or removed article: ${route}`);
}
const pages = new Map();
for (const route of routes) {
 const response = await fetch(new URL(route,origin));
 assert(response.ok, `${route}: HTTP ${response.status}`);
 pages.set(route, await response.text());
}
const failures = [], edges = new Map(), checked = new Set();
for (const [route,html] of pages) {
 const targets=[];
 for (const match of html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/g)) {
  const url = new URL(match[1].replaceAll('&amp;','&'),new URL(route,origin));
  if (![new URL(origin).origin,'https://b2binfluencerfinder.com'].includes(url.origin)) continue;
  targets.push(url.pathname);
  if (url.hash && pages.has(url.pathname)) {
   const id = decodeURIComponent(url.hash.slice(1));
   if (!pages.get(url.pathname).includes(`id="${id}"`)) failures.push(`${route} → ${url.pathname}${url.hash}: missing anchor`);
  }
  if (!pages.has(url.pathname) && !checked.has(url.pathname)) {
   checked.add(url.pathname);
   const response = await fetch(new URL(url.pathname,origin));
   if (!response.ok) failures.push(`${route} → ${url.pathname}: HTTP ${response.status}`);
  }
 }
 edges.set(route,targets);
}
const reached=new Set(['/']), queue=['/'];
while(queue.length) for(const target of edges.get(queue.shift()) || []) if(pages.has(target) && !reached.has(target)){reached.add(target);queue.push(target);}
for(const route of routes) if(!reached.has(route)) failures.push(`Unreachable from homepage: ${route}`);
assert.equal(failures.length,0,failures.join('\n'));
console.log(`Checked ${pages.size} public pages, ${posts.length} articles and ${checked.size} additional destinations. No broken internal links, missing anchors or orphan pages. Every article has an editorial inbound link.`);
