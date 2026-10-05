import sharp from 'sharp';
import fs from 'node:fs';
const configs=[
['do-third-party-mentions-help-ai-visibility','Who else talks about your brand?',['SPECIALIST ARTICLE|Independent explanation','CREATOR VIDEO|Expert perspective','NEWSLETTER|Relevant audience','COMMUNITY|Real discussion'], 'What makes a mention useful?', ['SOURCE RELEVANCE|A credible voice in your field','TOPIC FIT|The right conversation','BRAND CONTEXT|Explain what the company does','PUBLIC ACCESS|Available to discover','USEFUL CONTENT|Evidence worth referencing']],
['creator-content-that-can-appear-in-ai-search','Creator content AI can encounter',['VIDEO|YouTube and transcripts','ARTICLES|Blogs and LinkedIn','NEWSLETTERS|Public web editions','PODCASTS|Episodes and show notes'],'What makes content discoverable?',['PUBLIC ACCESS|Can readers open it?','EXTRACTABLE CONTEXT|Can the ideas be understood?','TOPIC DEPTH|Does it answer a real question?','DURABILITY|Will it remain available?']],
['does-linkedin-content-influence-ai','LinkedIn is part of the source layer',['CREATOR EXPERTISE|Original article or post','BRAND CONTEXT|Category and useful evidence','AI SEARCH|A possible source'],'The LinkedIn citation playbook',['ORIGINAL EXPERTISE|Teach from experience','TOPIC DEPTH|Explain the useful details','CREDIBLE AUTHOR|Consistent relevant work','RELEVANCE|Value beyond viral reach']],
['does-youtube-help-ai-visibility','YouTube as third-party evidence',['CREATOR VIDEO|A specialist explains','PUBLIC CONTEXT|Title and transcript','DISCOVERY|Buyers and AI search'],'The YouTube evidence loop',['BRAND EVIDENCE|Research and case studies','RELEVANT CREATOR|Already covers the topic','USEFUL VIDEO|Tutorial or analysis','PUBLIC CONTEXT|Description and transcript','DISCOVERY|Buyers and AI search']],
['do-podcasts-help-ai-visibility','A conversation can become evidence',['EXPERT CONVERSATION|Host and guest insights','PUBLIC TRANSCRIPT|Context beyond the audio','DISCOVERY|An accessible episode page'],'The podcast evidence loop',['BRAND EXPERTISE|Evidence worth discussing','RELEVANT PODCAST|The right topic and audience','CONVERSATION|Interview or analysis','PUBLIC TEXT|Show notes and transcript','DISCOVERY|Buyers and AI search']],
['do-substack-articles-help-ai-visibility','From newsletter to public evidence',['BRAND EVIDENCE|Data or customer results','CREATOR ARTICLE|Independent perspective','PUBLIC WEB|A lasting source'],'What makes a newsletter useful?',['PUBLIC|Accessible on the web','RELEVANT|A creator who covers the topic','SPECIFIC|Clear brand and topic context','USEFUL|Data and real expertise','DURABLE|Available after the send']],
['do-brand-mentions-without-backlinks-help-ai-search','A link is useful. Context is too.',['BRAND MENTION|What the company does','MENTION + LINK|Context and a next step'],'What an unlinked mention communicates',['TOPIC|Where the brand belongs','CATEGORY|What the company does','USE CASE|Who or what it helps','EVIDENCE|Why the source mentions it']],
['backlinks-vs-brand-mentions-ai-search','Two signals. Different jobs.',['BACKLINK|Discovery and referral traffic','BRAND MENTION|Category and topic context'],'Backlinks and mentions do different jobs',['BACKLINKS|A clickable path|Referral traffic|Traditional search role','BRAND MENTIONS|Independent description|Brand-topic association|Can exist without a link']],
['sponsored-creator-content-ai-visibility','Sponsor the work. Not the opinion.',['BRAND EVIDENCE|Something worth discussing','PAID PARTNERSHIP|Clear sponsorship disclosure','USEFUL CONTENT|Independent expert analysis'],'When sponsored content is useful',['SUBJECT RELEVANCE|A real buyer question','CREATOR RELEVANCE|The right expertise','BRAND CONTEXT|A specific contribution','PUBLIC ACCESS|Discoverable content','EDITORIAL VALUE|More than scripted praise']],
['creator-links-vs-brand-mentions','Links navigate. Context explains.',['WEBSITE LINK|A useful next step','BRAND MENTION|Meaning and topic context','BOTH|Relevant third-party evidence'],'What should you ask creators for?',['LINK|Useful destination|Referral traffic','MENTION|Brand and category|Evidence and perspective','BOTH|A natural link|Substantive context']]
];
const colors=['#dce9f8','#f7ded4','#e5e1fa','#d7efed','#f8edc9','#f4dce9','#e3ead8','#dce9f1','#f5e5d3','#e9def4'];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const text=(x,y,s,size=24)=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="#20392c">${esc(s)}</text>`;
function wrap(s,max){const rows=[''];for(const w of s.split(' ')){if((rows.at(-1)+' '+w).length>max)rows.push(w);else rows[rows.length-1]+=(rows.at(-1)?' ':'')+w;}return rows;}
for(const [i,config] of configs.entries()) {
 const [slug,heroTitle,heroItems,diagramTitle,diagramItems]=config;
 const p=JSON.parse(fs.readFileSync(`content/blog/${slug}.json`));
 for(const kind of ['hero','diagram']) {
  const h=kind==='hero'?630:800,title=kind==='hero'?heroTitle:diagramTitle,items=kind==='hero'?heroItems:diagramItems;
  const cols=items.length===2?2:items.length===4?2:3,w=1080/cols-18,rows=Math.ceil(items.length/cols),ch=rows>1?145:235,start=180;
  let body=text(50,76,title,38)+text(50,120,kind==='hero'?'THIRD-PARTY EVIDENCE · A PRACTICAL GUIDE':'RELEVANCE + CONTEXT + PUBLIC ACCESS',18);
  items.forEach((item,j)=>{const x=50+j%cols*(w+24),y=start+Math.floor(j/cols)*(ch+20);body+=`<rect x="${x}" y="${y}" width="${w}" height="${ch}" rx="18" fill="white"/>`;let yy=y+34;for(const [k,line] of item.split('|').entries())for(const row of wrap(line,Math.floor((w-40)/12))){body+=text(x+20,yy,row,k?21:22);yy+=29;}});
  body+=text(50,h-65,'Illustrative model. AI inclusion is not guaranteed.',20)+text(50,h-28,'B2B INFLUENCER FINDER',14);
  await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${h}"><rect width="1200" height="${h}" fill="${colors[i]}"/>${body}</svg>`)).webp({quality:90}).toFile(`public/blog/${p[kind]}`);
 }
}
