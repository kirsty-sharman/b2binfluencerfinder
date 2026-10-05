import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readFileSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
const dir=mkdtempSync(join(tmpdir(),'channel-tests-'));
const files=['channels/core','channels/filters','channels/web','channels/apis','channels/quality','channels/industry-gate','providers/dataforseo','providers/shared','content-discovery'];
for(const file of files){const target=join(dir,file+'.mjs');mkdirSync(dirname(target),{recursive:true});let code=ts.transpileModule(readFileSync(new URL('../lib/'+file+'.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;code=code.replace(/from "@\/lib\/([^"\n]+)"/g,(_,p)=>`from "${join(dir,p+'.mjs')}"`).replace(/from "(\.\.?\/[^"\n]+)"/g,(_,p)=>`from "${p}.mjs"`);writeFileSync(target,code);}
process.on('exit',()=>rmSync(dir,{recursive:true,force:true}));
const {parseFeed,articleIdentity}=await import(join(dir,'channels/web.mjs'));
const {validateQualification}=await import(join(dir,'channels/quality.mjs'));
const {discoverYoutube,discoverPodcasts,discoverX}=await import(join(dir,'channels/apis.mjs'));
const response=data=>new Response(JSON.stringify(data),{status:200});
test('RSS and Atom preserve attribution and publication dates',()=>{
 const rss=parseFeed('<rss><channel><item><title>Banking</title><link>https://site.test/p/one</link><dc:creator>Alex</dc:creator><pubDate>2026-09-25</pubDate><content:encoded><![CDATA[<p>Insight</p>]]></content:encoded></item></channel></rss>','https://site.test/feed');
 assert.equal(rss[0].author,'Alex');assert.equal(rss[0].text,'Insight');
 const atom=parseFeed('<feed><entry><title>Bank</title><link href="https://site.test/two"/><published>2026-09-20</published><author><name>Alex</name></author><content>Second</content></entry></feed>','https://site.test/feed');
 assert.equal(atom[0].url,'https://site.test/two');assert.equal(atom[0].author,'Alex');
});
test('company publisher is not mistaken for article author',()=>{
 assert.equal(articleIdentity('<script type="application/ld+json">{"@type":"Article","author":{"@type":"Organization","name":"Bank","url":"https://bank.test"}}</script>','https://bank.test/article'),null);
 const person=articleIdentity('<script type="application/ld+json">{"@type":"BlogPosting","headline":"Banking","author":{"@type":"Person","name":"Alex","url":"/authors/alex"}}</script>','https://bank.test/article');
 assert.equal(person.url,'https://bank.test/authors/alex');
});
test('every channel rejects fabricated evidence and unrelated assets',()=>{
 for(const channel of ['linkedin','newsletter','blog','youtube','podcast','x']) {
 const candidate={channel,identityEvidence:'source',evidence:[1,2,3].map(i=>({url:`https://site.test/${i}`,text:'Expertise '.repeat(50),publishedAt:'2026-09-28'}))};
 const assets=[{id:'a',industries:['Banking']}];
 const match={assetId:'a',score:4,angle:'Explain result',evidenceUrls:['https://site.test/1','https://site.test/2']};
 const result={qualified:true,reason:'Evidence',industries:['Banking'],matches:[match]};
 const now=Date.parse('2026-09-29');
 assert.equal(validateQualification(result,candidate,assets,['Banking'],now).qualified,true,channel);
 assert.equal(validateQualification({...result,matches:[{...match,evidenceUrls:['https://fabricated.test','https://site.test/1']}]},candidate,assets,['Banking'],now).qualified,false);
 assert.equal(validateQualification(result,candidate,[{id:'a',industries:['Travel']}],['Banking'],now).qualified,false);
 }
});
test('YouTube uses channel-owned uploads and preserves unknown subscribers',async t=>{
 process.env.YOUTUBE_API_KEY='fixture';let calls=0;
 t.mock.method(globalThis,'fetch',async url=>{calls++;const p=new URL(url).pathname;
 if(p.endsWith('/search'))return response({items:[{snippet:{channelId:'UC1'}}]});
 if(p.endsWith('/channels'))return response({items:[{id:'UC1',snippet:{title:'Expert'},statistics:{hiddenSubscriberCount:true},contentDetails:{relatedPlaylists:{uploads:'UU1'}}}]});
 return response({items:[{snippet:{title:'Guide',description:'Video evidence',publishedAt:'2026-09-28',resourceId:{videoId:'v1'}}}]});});
 const result=await discoverYoutube('banking',5);assert.equal(calls,3);assert.equal(result.candidates[0].audience,null);assert.ok(result.candidates[0].evidence[0].url.endsWith('v=v1'));
});
test('Podcast Index requests are signed and episode guests are not owner identities',async t=>{
 process.env.PODCAST_INDEX_API_KEY='fixture';process.env.PODCAST_INDEX_API_SECRET='fixture-secret';
 t.mock.method(globalThis,'fetch',async (url,options)=>{assert.match(options.headers.Authorization,/^[a-f0-9]{40}$/);return response(String(url).includes('search/byterm')?{feeds:[{id:1,title:'Bank Show',url:'https://show.test/feed',link:'https://show.test',description:'A podcast',author:'Publisher'}]}:{items:[{title:'Guest Alex',description:'Episode',link:'https://show.test/episode',datePublished:1790553600}]});});
 const result=await discoverPodcasts('banking',2);assert.equal(result.candidates[0].name,'Bank Show');assert.equal(result.candidates[0].evidence[0].author,'Bank Show');assert.equal(result.candidates[0].audience,null);
});
test('X cannot call paid endpoints until explicitly enabled',async t=>{
 process.env.X_BEARER_TOKEN='fixture';process.env.X_DISCOVERY_ENABLED='false';let called=false;t.mock.method(globalThis,'fetch',async()=>{called=true;return response({});});
 await assert.rejects(discoverX('banking',2),/validated/);assert.equal(called,false);
});
test('X attributes timeline evidence by author ID and reports request count',async t=>{
 process.env.X_BEARER_TOKEN='fixture';process.env.X_DISCOVERY_ENABLED='true';
 t.mock.method(globalThis,'fetch',async url=>response(String(url).includes('search/recent')?{includes:{users:[{id:'1',name:'Alex',username:'alex'}]}}:{data:[{id:'t1',author_id:'1',text:'Analysis',created_at:'2026-09-28'},{id:'t2',author_id:'other',text:'Do not attribute'}]}));
 const result=await discoverX('banking',2);assert.equal(result.requests,2);assert.equal(result.candidates[0].evidence.length,1);assert.equal(result.candidates[0].audience,null);
});
test('industry proofs require two real recent sources with exact quotes',async()=>{
 const {verifiedIndustries}=await import(join(dir,'channels/industry-gate.mjs'));
 const {recentEvidence,identityOverlap}=await import(join(dir,'channels/core.mjs'));
 const text='Banking practitioners discuss deposit retention and regulated customer acquisition. '.repeat(4);
 const candidate={channel:'blog',identityUrls:['https://author.test'],identityEvidence:'Byline',evidence:[1,2,3].map(i=>({url:`https://site.test/${i}`,text,publishedAt:'2026-09-28'}))};
 const now=Date.parse('2026-09-29');
 const proof={industry:'Banking',reason:'Sector commentary',quotes:[1,2].map(i=>({url:`https://site.test/${i}`,quote:text}))};
 assert.equal(verifiedIndustries([proof],candidate,['Banking'],now).length,1);
 assert.equal(verifiedIndustries([{...proof,quotes:[proof.quotes[0],proof.quotes[0]]}],candidate,['Banking'],now).length,0);
 assert.equal(verifiedIndustries([{...proof,quotes:proof.quotes.map(q=>({...q,quote:'Fabricated '.repeat(20)}))}],candidate,['Banking'],now).length,0);
 assert.equal(verifiedIndustries([proof],candidate,['Travel'],now).length,0);
 assert.equal(recentEvidence({...candidate,evidence:[...candidate.evidence,{url:null,text,publishedAt:'2026-09-28'}]},now).length,3);
 assert.equal(identityOverlap(candidate,{identityUrls:[null,'broken'],identityEvidence:'Byline'}),false);
});
test('LinkedIn regional hosts and profile capitalization share one identity',async()=>{
 const {canonicalLinkedInUrl}=await import(join(dir,'providers/shared.mjs'));
 assert.equal(canonicalLinkedInUrl('https://fr.linkedin.com/in/Michaelkitces/'),canonicalLinkedInUrl('https://www.linkedin.com/in/michaelkitces'));
});
test('brand-owned channel is excluded before paid quality analysis',async t=>{
 const {qualifyCandidate}=await import(join(dir,'channels/quality.mjs'));
 t.mock.method(globalThis,'fetch',()=>{throw new Error('Must not call a provider');});
 const result=await qualifyCandidate({name:'Referral Factory',evidence:[],channel:'youtube'},[],[],'Referral Factory');
 assert.equal(result.qualified,false);assert.match(result.reason,/own channel/);
});
test('channel settings reject invalid ranges and ignore deselected channel inputs',async()=>{
 const {parseChannelFilters}=await import(join(dir,'channels/filters.mjs'));
 const form=new FormData();form.set('youtube.minAudience','5000');form.set('youtube.maxAudience','100000');form.set('youtube.evidenceLimit','6');form.set('youtube.publishedWithinDays','90');form.set('youtube.includeUnknownAudience','on');
 form.set('linkedin.minAudience','9000');form.set('linkedin.maxAudience','1');
 const result=parseChannelFilters(form,['youtube']);assert.equal(result.linkedin,undefined);assert.equal(result.youtube.minAudience,5000);assert.equal(result.youtube.evidenceLimit,6);assert.equal(result.youtube.includeUnknownAudience,true);
 assert.throws(()=>parseChannelFilters(form,['linkedin']),/maximum audience/);
 form.set('youtube.evidenceLimit','2');assert.throws(()=>parseChannelFilters(form,['youtube']),/whole number/);
});
test('audience ranges, unknown policy and publication windows are enforced independently',async()=>{
 const {applyChannelFilters,defaultFilters,filtersFor}=await import(join(dir,'channels/filters.mjs'));
 const now=Date.parse('2026-09-29');const candidate={channel:'youtube',audience:5000,evidence:[{url:'https://site.test/1',publishedAt:'2026-09-28'},{url:'https://site.test/2',publishedAt:'2026-01-01'},{url:'https://site.test/3',publishedAt:null},{url:'https://site.test/4',publishedAt:'2026-10-01'}]};
 const filters={...defaultFilters('youtube'),minAudience:1000,maxAudience:10000,publishedWithinDays:30};
 assert.equal(applyChannelFilters(candidate,filters,now).candidate.evidence.length,1);
 assert.equal(applyChannelFilters({...candidate,audience:999},filters,now).reason?.includes('outside'),true);
 assert.equal(applyChannelFilters({...candidate,audience:null},filters,now).reason,null);
 assert.match(applyChannelFilters({...candidate,audience:null},{...filters,includeUnknownAudience:false},now).reason,/unavailable/);
 assert.equal(applyChannelFilters({...candidate,channel:'podcast',audience:null},{...filters,includeUnknownAudience:false},now).reason,null);
 assert.equal(filtersFor({minFollowers:2000,maxFollowers:90000},'linkedin').minAudience,2000);
 assert.equal(filtersFor({minFollowers:2000,maxFollowers:90000},'youtube').minAudience,null);
});
test('run audience filtering rejects before AI is called',async t=>{
 const {qualifyCandidate}=await import(join(dir,'channels/quality.mjs'));
 const {defaultFilters}=await import(join(dir,'channels/filters.mjs'));
 t.mock.method(globalThis,'fetch',()=>{throw new Error('AI must not be called');});
 const result=await qualifyCandidate({channel:'youtube',name:'Expert',audience:100,evidence:[]},[],[],'Brand',{...defaultFilters('youtube'),minAudience:1000});
 assert.equal(result.qualified,false);assert.match(result.reason,/outside/);
});
test('YouTube inspection limit is passed to uploads request',async t=>{
 process.env.YOUTUBE_API_KEY='fixture';let count;
 t.mock.method(globalThis,'fetch',async url=>{const u=new URL(url);if(u.pathname.endsWith('/search'))return response({items:[{snippet:{channelId:'UC1'}}]});if(u.pathname.endsWith('/channels'))return response({items:[{id:'UC1',contentDetails:{relatedPlaylists:{uploads:'UU1'}}}]});count=u.searchParams.get('maxResults');return response({items:[]});});
 await discoverYoutube('banking',2,6);assert.equal(count,'6');
});
