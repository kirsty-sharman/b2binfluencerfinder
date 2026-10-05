import test from 'node:test';
import assert from 'node:assert/strict';
import { phraseKey, suggestionId, replenishSuggestions } from '../lib/phrase-suggestions.ts';

test('normalization and stable suggestion IDs prevent duplicate suggestions within a brand', () => {
  assert.equal(phraseKey('  Best Referral Software? '), phraseKey('best referral software'));
  assert.equal(suggestionId('brand1', 'Best referral software?'), suggestionId('brand1', 'best referral software'));
  assert.notEqual(suggestionId('brand1', 'software'), suggestionId('brand2', 'software'));
});

test('accepting a suggestion replenishes to ten and excludes prior decisions', async () => {
  const rows = Array.from({length:10}, (_,i)=>({id:String(i),phrase:`Existing prompt ${i}`,source:'suggested',status:i === 0 ? 'approved' : 'draft'}));
  rows.push({id:'dismissed',phrase:'Dismissed prompt',source:'suggested',status:'rejected'});
  const client = { from(table) {
    const builder = {
      select(){return this;}, eq(){return this;}, order(){return this;}, limit(){return this;}, range(){return this;},
      single(){return Promise.resolve({data:{id:'brand1',workspace_id:'workspace',name:'Brand'}});},
      upsert(values){rows.push(...values); return Promise.resolve({error:null});},
      then(resolve){return Promise.resolve({data:table === 'phrases' ? [...rows] : []}).then(resolve);}
    }; return builder;
  }};
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  let calls = 0;
  globalThis.fetch = async (_url, options) => {
    calls++;
    const request = JSON.parse(options.body);
    const context = JSON.parse(request.input[1].content);
    assert.equal(context.count, 1);
    assert.ok(context.exclude.includes('Dismissed prompt'));
    assert.ok(context.exclude.includes('Existing prompt 0'));
    return new Response(JSON.stringify({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify({suggestions:[{phrase:'A new commercial prompt',intent:'commercial'}]})}]}]}));
  };
  try {
    assert.equal(await replenishSuggestions(client,'brand1'),10);
    assert.equal(rows.filter(row=>row.status === 'draft').length,10);
    assert.equal(await replenishSuggestions(client,'brand1'),10);
    assert.equal(calls,1);
  } finally { globalThis.fetch=originalFetch; if (oldKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY=oldKey; }
});
