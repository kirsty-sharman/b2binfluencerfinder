import fs from 'node:fs';
import path from 'node:path';
export const BLOG_ORIGIN = 'https://b2binfluencerfinder.com';
export type BlogBlock = {type:'p'|'h2'|'quote'|'li';text:string;sources?:{label:string;url:string}[]};
export type BlogPost = {slug:string;title:string;metaTitle?:string;description:string;ogTitle:string;ogDescription:string;category:string;status:'draft'|'published';author:string;publishedAt:string|null;updatedAt:string;hero:string;heroAlt:string;diagram:string;diagramWidth?:number;diagramHeight?:number;relatedArticles?:string[];diagramAlt:string;diagramAfter:string;blocks:BlogBlock[]};
export const showDrafts = process.env.NODE_ENV === 'development' || process.env.BLOG_PREVIEW === 'true';
export function getAllPosts():BlogPost[] {
 return fs.readdirSync(path.join(process.cwd(),'content/blog')).filter(f=>f.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(path.join(process.cwd(),'content/blog',f),'utf8')) as BlogPost).sort((a,b)=>(b.publishedAt||b.updatedAt).localeCompare(a.publishedAt||a.updatedAt)||a.slug.localeCompare(b.slug));
}
export function getPosts(){return getAllPosts().filter(p=>p.status==='published'||showDrafts);}
export function readingMinutes(p:BlogPost){return Math.max(1,Math.ceil(p.blocks.map(b=>b.text).join(' ').split(/\s+/).length/220));}
export function headingId(text:string){return text.toLowerCase().replace(/[^a-z0-9\s-]/g,'').trim().replace(/\s+/g,'-');}
export function postUrl(p:BlogPost){return `${BLOG_ORIGIN}/blog/${p.slug}`;}
export function articleSchema(p:BlogPost){return {'@context':'https://schema.org','@type':'BlogPosting',headline:p.title,description:p.description,author:{'@type':p.author==='B2B Influencer Finder'?'Organization':'Person',name:p.author},publisher:{'@type':'Organization',name:'B2B Influencer Finder',url:BLOG_ORIGIN},dateModified:p.updatedAt,...(p.publishedAt?{datePublished:p.publishedAt}:{}),mainEntityOfPage:postUrl(p),url:postUrl(p),image:[p.hero,p.diagram].map(f=>`${BLOG_ORIGIN}/blog/${f}`)};}
