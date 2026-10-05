'use client';
import {useState} from 'react';
import Link from 'next/link';
import Image from 'next/image';
export type BlogSummary={slug:string;title:string;description:string;category:string;hero:string;heroAlt:string;minutes:number};
export function BlogIndex({posts}:{posts:BlogSummary[]}) {
 const [query,setQuery]=useState('');
 const [visibleCount,setVisibleCount]=useState(20);
 const matching=posts.filter(p=>`${p.title} ${p.description} ${p.category}`.toLowerCase().includes(query.toLowerCase()));
 const visible=matching.slice(0,visibleCount);
 const remaining=Math.max(0,matching.length-visible.length);
 return <section aria-label="All articles" className="blog-library"><div className="blog-library-heading"><h2>Explore the library</h2><label>Search resources<input type="search" placeholder="Try AI visibility or ChatGPT" value={query} onChange={e=>{setQuery(e.target.value);setVisibleCount(20);}}/></label></div><p className="blog-count" role="status">Showing {visible.length} of {matching.length} {matching.length===1?'article':'articles'}</p><div className="blog-grid" id="blog-articles">{visible.map(p=><article className="blog-card" key={p.slug}><Link href={`/blog/${p.slug}`}><Image src={`/blog/${p.hero}`} width={1200} height={630} alt={p.heroAlt} sizes="(max-width:700px) 100vw, 50vw"/><div className="blog-card-copy"><span className="blog-kicker">{p.category} · {p.minutes} min read</span><h3>{p.title}</h3><p>{p.description}</p><span className="blog-read">Read the guide ↗</span></div></Link></article>)}</div>{remaining>0?<div className="blog-load-more"><button type="button" aria-controls="blog-articles" onClick={()=>setVisibleCount(count=>count+20)}>Load more articles <span aria-hidden="true">↓</span></button><p>{remaining} more {remaining===1?'article':'articles'} to explore · Showing the next {Math.min(20,remaining)}</p></div>:null}{!matching.length?<p>No articles match your search. Try a different topic.</p>:null}</section>;
}
