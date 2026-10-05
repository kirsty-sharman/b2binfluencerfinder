import sharp from 'sharp';
import fs from 'node:fs';
const configs=[
['what-is-creator-aeo','Where Creator AEO sits',['AEO|Prompts and citations','CREATOR MARKETING|Audiences and collaborations','DIGITAL PR|Independent coverage'],'CREATOR AEO: USEFUL THIRD-PARTY CONTENT'],
['what-is-influencer-aeo','Relevance comes before reach',['BUYER TOPIC|What people research','BRAND EVIDENCE|Research and case studies','RELEVANT CREATOR|Subject expertise','INDEPENDENT CONTENT|Videos, articles and podcasts'],'THE INFLUENCER AEO MATCH'],
['how-creator-marketing-affects-ai-search-visibility','A mention is only the beginning',['THIN MENTION|Sponsored by Acme|Little context','USEFUL EVIDENCE|Explains the problem|Cites research and adds perspective'],'CONTEXT MAKES THE DIFFERENCE'],
['how-b2b-creators-improve-ai-visibility','The B2B creator evidence loop',['BRAND EXPERTISE|Research and case studies','CREATOR MATCH|Relevant specialist','INDEPENDENT CONTENT|Video, newsletter or article','PUBLIC EVIDENCE|Category and use-case context','DISCOVERY|Buyers and AI search','LEARN|Measure and refine'],'MEASURE OVER TIME, THEN REFINE'],
['role-of-influencers-in-aeo','The influencer AEO role map',['THIRD-PARTY MENTIONS|Outside your own channels','TOPIC ASSOCIATION|A specific category or problem','CITABLE CONTENT|Durable public sources','INDEPENDENT PERSPECTIVE|Expert explanation and context'],'EVIDENCE, NOT CONTROL'],
['creator-aeo-vs-traditional-aeo','Two sides of AEO',['OWNED EVIDENCE|Website and product pages|Research and documentation','THIRD-PARTY EVIDENCE|Creators and newsletters|YouTube and podcasts'],'CLEARER BRAND UNDERSTANDING'],
['creator-aeo-vs-digital-pr','Two routes to third-party evidence',['DIGITAL PR|Journalists and publications|News hooks and earned coverage','SHARED GROUND|Topical relevance and mentions|Independent perspectives','CREATOR AEO|Specialists and practitioners|Content matching and creator channels'],'DIFFERENT ROUTES. SHARED EVIDENCE.'],
['creator-aeo-vs-seo','Owned discovery + independent voices',['SEO / OWNED EVIDENCE|Website and product pages|Research and case studies','CREATOR AEO / EXTERNAL EVIDENCE|Newsletters and YouTube|Podcasts and expert articles'],'BUYERS + AI SEARCH'],
['how-to-build-a-creator-aeo-strategy','The Creator AEO strategy',['CHOOSE THE TOPIC|Focus on a specific problem','MAP BUYER PROMPTS|Understand the questions','AUDIT YOUR EVIDENCE|Find useful research and proof','MATCH CREATORS|Choose relevant expertise','CREATE USEFUL CONTENT|Let independent voices contribute','MEASURE AND LEARN|Track topic visibility over time'],'RELEVANCE FIRST. REACH SECOND.']
];
const colors=['#dce9f8','#f7ded4','#e5e1fa','#d7efed','#f8edc9','#f4dce9','#e3ead8','#dce9f1','#f5e5d3'];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
function text(x,y,s,size=24){return `<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="#20392c">${esc(s)}</text>`;}
function wrap(s,max){let rows=[''];for(const w of s.split(' ')){if((rows.at(-1)+' '+w).length>max)rows.push(w);else rows[rows.length-1]+=(rows.at(-1)?' ':'')+w;}return rows;}
for(let i=0;i<configs.length;i++){
 const [slug,title,items,footer]=configs[i],p=JSON.parse(fs.readFileSync(`content/blog/${slug}.json`));
 for(const kind of ['hero','diagram']){
  const h=kind==='hero'?630:800;const cols=items.length===2?2:items.length===4?2:3;const rows=Math.ceil(items.length/cols);const w=1080/cols-18;const start=kind==='hero'?175:195;const ch=rows>1?145:230;
  let body=text(50,80,title,40)+text(50,125,kind==='hero'?'CREATOR AEO · A PRACTICAL GUIDE':'HOW THE PIECES FIT TOGETHER',18);
  items.forEach((item,j)=>{let x=50+(j%cols)*(w+24),y=start+Math.floor(j/cols)*(ch+20);body+=`<rect x="${x}" y="${y}" width="${w}" height="${ch}" rx="18" fill="#fff"/>`;let yy=y+35;item.split('|').forEach((line,k)=>{for(const t of wrap(line,Math.floor((w-40)/(k?11:12)))){body+=text(x+20,yy,t,k?21:22);yy+=29;}});});
  body+=text(50,h-95,footer,23)+text(50,h-57,'Illustrative model. Creator coverage does not guarantee AI inclusion.',20)+text(50,h-24,'B2B INFLUENCER FINDER',14);
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${h}"><rect width="1200" height="${h}" fill="${colors[i]}"/>${body}</svg>`)).webp({quality:90}).toFile(`public/blog/${p[kind]}`);
 }
}
