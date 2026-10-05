import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalUrl, planChannels, identityOverlap, recentEvidence} from '../lib/channels/core.ts';

test('query budget covers every channel before repeating an industry',()=>{
 const channels=['linkedin','newsletter','blog','youtube','podcast','x'];
 const plan=planChannels([{id:'p',phrase:'referrals'}],[{name:'Banking'},{name:'Education'}],channels,12);
 assert.equal(plan.length,12);
 for(const channel of channels)assert.equal(plan.filter(p=>p.channel===channel).length,2);
 assert.ok(plan.find(p=>p.channel==='newsletter').query.includes('newsletter'));
 assert.ok(plan.find(p=>p.channel==='x').query.includes('-is:retweet'));
 assert.deepEqual(planChannels([],[],channels,10),[]);
});
test('identity linking requires published profile URLs, not matching names',()=>{
 const a={name:'Alex',identityEvidence:'byline',identityUrls:['https://www.linkedin.com/in/alex/?utm_source=blog']};
 assert.equal(identityOverlap(a,{name:'Alex',identityEvidence:'byline',identityUrls:['https://example.com/other-alex']}),false);
 assert.equal(identityOverlap(a,{name:'Alexander',identityEvidence:'Person sameAs',identityUrls:['https://linkedin.com/in/alex']}),true);
 assert.equal(identityOverlap(a,{identityEvidence:'',identityUrls:a.identityUrls}),false);
});
test('URL normalization preserves content identity and rejects active URLs',()=>{
 assert.equal(canonicalUrl('https://www.youtube.com/watch?v=abc&utm_source=x'),'https://youtube.com/watch?v=abc');
 assert.notEqual(canonicalUrl('https://youtube.com/watch?v=abc'),canonicalUrl('https://youtube.com/watch?v=def'));
 assert.throws(()=>canonicalUrl('javascript:alert(1)'));
 assert.throws(()=>canonicalUrl('https://secret@example.com'));
});
test('common evidence gate rejects stale, undated, duplicate and empty items',()=>{
 const now=Date.parse('2026-09-29');
 const row={url:'https://example.com/a',text:'Substantive content '.repeat(30),publishedAt:'2026-09-28'};
 const candidate={channel:'blog',evidence:[row,{...row,url:row.url+'?utm_source=x'},{...row,url:'https://example.com/old',publishedAt:'2020-01-01'},{...row,url:'https://example.com/undated',publishedAt:null},{...row,url:'https://example.com/empty',text:''},{...row,url:'https://example.com/future',publishedAt:'2027-01-01'}]};
 assert.equal(recentEvidence(candidate,now).length,1);
});
