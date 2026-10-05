import test from 'node:test';
import assert from 'node:assert/strict';
import {changeSelection,saveContentSelection,getContentSelection} from '../lib/content-selection.ts';

test('active selection cannot grow beyond 20, including repeated requests',()=>{
  const current={ids:Array.from({length:20},(_,i)=>String(i)),excluded:[],revision:1};
  assert.throws(()=>changeSelection(current,'extra',true),/Remove one/);
  assert.equal(changeSelection(current,'0',true).ids.length,20);
  const removed=changeSelection(current,'0',false);
  assert.equal(removed.ids.length,19);
  assert.ok(removed.excluded.includes('0'));
  assert.equal(changeSelection(removed,'extra',true).ids.length,20);
  assert.deepEqual(changeSelection(removed,'0',true).excluded,[]);
});

test('immutable selection snapshots reject stale writes rather than overfilling or losing user changes',async()=>{
  let saved={ids:['a'],excluded:[],revision:1};
  const client={from(table){let payload;const filters={};return {
    select(){return this;},order(){return this;},limit(){return this;},insert(value){payload=value;return this;},eq(key,value){filters[key]=value;return this;},in(){return this;},maybeSingle(){return this;},update(value){payload=value;return this;},
    then(resolve){
      if(table==='content_assets') return Promise.resolve({data:[{id:'a'},{id:'b'}],error:null}).then(resolve);
      if(!payload) return Promise.resolve({data:{changes:saved},error:null}).then(resolve);
      saved=payload.changes;return Promise.resolve({data:[{id:'record'}],error:null}).then(resolve);
    }
  };}};
  const old=await getContentSelection(client,'brand');
  await saveContentSelection(client,{id:'brand',workspace_id:'workspace'},old,{ids:['a','b'],excluded:[],revision:2});
  await assert.rejects(saveContentSelection(client,{id:'brand',workspace_id:'workspace'},old,{ids:['a','b'],excluded:[],revision:2}),/another session/);
  assert.equal(saved.revision,2);
});
