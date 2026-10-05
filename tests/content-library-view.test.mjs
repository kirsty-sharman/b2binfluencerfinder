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
