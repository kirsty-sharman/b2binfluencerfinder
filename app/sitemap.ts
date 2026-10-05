import type { MetadataRoute } from 'next';
import { BLOG_ORIGIN, getAllPosts } from '@/lib/blog';
import { discoverPublicPages } from '@/lib/public-pages';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...discoverPublicPages().map(route => ({ url: `${BLOG_ORIGIN}${route === '/' ? '' : route}` })),
    ...getAllPosts().filter(post => post.status === 'published').map(post => ({
      url: `${BLOG_ORIGIN}/blog/${post.slug}`, lastModified: post.updatedAt,
    })),
  ];
}
