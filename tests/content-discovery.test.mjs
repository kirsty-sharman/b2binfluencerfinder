import test from 'node:test';
import assert from 'node:assert/strict';
import { extractContentAsset, normalizeContentUrl, isContentCandidate } from '../lib/content-discovery.ts';

test('tracking URLs and trailing slashes normalize to the same stored asset', () => {
  assert.equal(normalizeContentUrl('https://example.com/learn/finance/?utm_source=mail#rewards'), normalizeContentUrl('https://example.com/learn/finance'));
});

test('discovery includes help guides and non-blog sitemap pages, while excluding indexes and files', () => {
  for (const path of ['/learn', '/learn/topic/tracking-and-attribution', '/learn/articles', '/learn/categories', '/blog/author/alex', '/learn/chart.png']) assert.equal(isContentCandidate(`https://example.com${path}`), false, path);
  for (const path of ['/learn/credit-union-referrals', '/blog/finance', '/customer-case-study', '/help/how-to', '/industries/banking']) assert.equal(isContentCandidate(`https://example.com${path}`), true, path);
});

test('extracts article evidence without navigation or scripts, leaving strength unreviewed', () => {
  const body = 'Credit union members can refer customers and earn rewards. '.repeat(30);
  const asset = extractContentAsset(`<h1>Banking &amp; referrals</h1><nav>Navigation contamination</nav><article>${body}<script>Hidden contamination</script></article>`, 'https://example.com/learn/banking');
  assert.ok(asset);
  assert.equal(asset.title, 'Banking & referrals');
  assert.ok(asset.topics.includes('Banking'));
  assert.doesNotMatch(asset.summary, /contamination/);
  assert.equal(asset.evidence_strength, 'unreviewed');
  assert.equal(asset.eligible, false, 'Scanned pages must not automatically become active');
});

test('does not import a title-only page or count site chrome as article content', () => {
  assert.equal(extractContentAsset(`<h1>Not found</h1><nav>${'menu '.repeat(300)}</nav><main>Empty</main>`, 'https://example.com/learn/missing'), null);
});
