import test from 'node:test';
import assert from 'node:assert/strict';
import { contentLibraryPage } from '../lib/content-library-view.ts';
const assets = Array.from({length:27},(_,i)=>({id:String(i).padStart(2,'0'),title:`Page ${i}`,topics:[i%2 ? 'banking':'education'],eligible:i<3,assessment:null}));
test('library pages preserve all records without overlap',()=>{
 const pages=[1,2,3].map(page=>contentLibraryPage(assets,'','all',page));
 assert.deepEqual(pages.map(p=>p.assets.length),[10,10,7]);
 assert.equal(new Set(pages.flatMap(p=>p.assets.map(a=>a.id))).size,27);
 assert.equal(pages[0].counts.active,3);
});
test('filters apply before pagination and out-of-range pages clamp',()=>{
 const result=contentLibraryPage(assets,'BANKING','review',99);
 assert.equal(result.count,12);
 assert.equal(result.current,2);
 assert.equal(result.assets.length,2);
 assert.equal(contentLibraryPage(assets,'missing','all',2).current,1);
});

test('combined facets search verified industries and sort before pagination',()=>{
 const rows=[
  {id:'a',title:'Zebra',url:'https://help.example.com/a',topics:[],contentType:'guide',eligible:false,assessment:{industryReviewVersion:2,industryVerified:true,matchedIndustries:['Banking'],ready:true,score:90}},
  {id:'b',title:'Alpha',url:'https://help.example.com/b',topics:[],contentType:'guide',eligible:false,assessment:{industryReviewVersion:2,industryVerified:true,matchedIndustries:['Banking'],ready:true,score:80}},
  {id:'c',title:'Other',url:'https://example.com/c',topics:[],contentType:'article',eligible:false,assessment:null},
 ];
 const result=contentLibraryPage(rows,'banking','ready',1,{type:'guide',industry:'Banking',source:'help.example.com',minScore:'80',sort:'title'});
 assert.deepEqual(result.assets.map(a=>a.id),['b','a']);
 assert.equal(contentLibraryPage(rows,'','all',1,{minScore:'90'}).count,1);
 assert.deepEqual(result.facets.sources,['example.com','help.example.com']);
 assert.equal(contentLibraryPage(rows,'missing','all',1,{type:'guide'}).count,0);
});

test('retained off-target assessments are excluded, not waiting for assessment',()=>{
 const old={...assets[4],assessment:{matchedIndustries:[],score:0,ready:false}};
 assert.equal(contentLibraryPage([old],'','excluded',1).count,1);
 assert.equal(contentLibraryPage([old],'','review',1).count,0);
});
