import type {MetadataRoute} from 'next';
import {BLOG_ORIGIN} from '@/lib/blog';
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:'*',allow:'/',disallow:['/app/','/auth/']},sitemap:`${BLOG_ORIGIN}/sitemap.xml`};}
