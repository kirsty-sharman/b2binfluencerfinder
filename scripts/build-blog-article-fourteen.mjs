import sharp from 'sharp';
const text=(x,y,s,size=24)=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="#20392c">${s.replaceAll('&','&amp;')}</text>`;
const card=(x,y,w,lines)=>`<rect x="${x}" y="${y}" width="${w}" height="210" rx="20" fill="white"/>`+lines.map((s,i)=>text(x+24,y+44+i*38,s,i===0?25:22)).join('');
const wrap=(body,h)=>`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="${h}"><rect width="1200" height="${h}" fill="#e0eee8"/>${body}${text(50,h-60,'Relevant evidence can help discovery. AI inclusion is not guaranteed.',22)}${text(50,h-25,'B2B INFLUENCER FINDER',15)}</svg>`;
let hero=text(50,80,'More context. More independent voices.',42)+text(50,130,'INFLUENCER MARKETING + CHATGPT VISIBILITY',20);
hero+=card(50,220,350,['BRAND EXPERTISE','Research and case studies','Useful data and insights'])+card(425,220,350,['CREATOR CONTENT','YouTube and LinkedIn','Newsletters and podcasts'])+card(800,220,350,['DISCOVERY','Buyers and search','AI answers']);
await sharp(Buffer.from(wrap(hero,630))).webp({quality:90}).toFile('public/blog/influencer-marketing-chatgpt-visibility.webp');
let diagram=text(50,90,'A mention vs useful third-party evidence',40)+card(50,210,535,['THIN MENTION','“Sponsored by Acme”','A name with little context'])+card(615,210,535,['RICH EVIDENCE','Explains a category problem','Cites relevant brand research','Adds an independent perspective'])+text(50,530,'More mentions are not automatically better evidence.',30)+text(50,580,'Context + relevance make the difference.',28);
await sharp(Buffer.from(wrap(diagram,800))).webp({quality:90}).toFile('public/blog/influencer-mention-vs-third-party-evidence.webp');
