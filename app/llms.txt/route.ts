import { BLOG_ORIGIN, getAllPosts } from '@/lib/blog';
import { discoverPublicPages } from '@/lib/public-pages';

// Generated during every build, alongside the sitemap and blog pages.
export const dynamic = 'force-static';
const titles: Record<string,string> = {'/':'B2B Influencer Finder','/blog':'Blog and resources','/contact':'Contact us','/rate-estimator':'B2B influencer rate estimator'};
const clean = (value: string) => value.replace(/[\r\n\[\]]/g,' ').trim();
export function GET() {
  const pages = discoverPublicPages().map(route => {
    const title = titles[route] || route.split('/').filter(Boolean).join(' / ').replaceAll('-',' ');
    return `- [${clean(title)}](${BLOG_ORIGIN}${route === '/' ? '' : route})`;
  });
  const posts = getAllPosts().filter(post => post.status === 'published').map(post =>
    `- [${clean(post.title)}](${BLOG_ORIGIN}/blog/${post.slug}): ${clean(post.description)}`);
  return new Response([
    '# B2B Influencer Finder',
    '',
    '> B2B creator discovery and content matching for brands, with an optional managed outreach service.',
    '',
    'Finder helps brands identify relevant creators and connect them with useful brand content. Managed adds human help with outreach and bookings. Creator fees are separate. Creator coverage does not guarantee inclusion in AI answers.',
    '', '## Public pages', '', ...pages,
    '', '## Articles', '', ...posts,
    '', '## Sitemap', '', `- [XML sitemap](${BLOG_ORIGIN}/sitemap.xml)`, '',
  ].join('\n'), { headers: { 'Content-Type':'text/plain; charset=utf-8' } });
}
