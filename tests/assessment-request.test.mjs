import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessmentRequest } from '../lib/providers/assessment-request.ts';
test('retries network failures with a fresh signal and preserves response', async () => {
 const original=global.fetch; let calls=0; const signals=[];
 global.fetch=async (_,opts)=>{signals.push(opts.signal);if(++calls===1)throw new TypeError('fetch failed');return new Response('{"status":"completed"}');};
 try {const response=await assessmentRequest('https://example.test',{},'Assessment');assert.equal((await response.json()).status,'completed');assert.equal(calls,2);assert.notEqual(signals[0],signals[1]);}finally{global.fetch=original;}
});
test('authentication failures do not retry or reveal provider body', async()=>{
 const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return new Response('private information',{status:401});};
 try{await assert.rejects(assessmentRequest('https://example.test',{},'Assessment'),/Assessment: HTTP 401/);assert.equal(calls,1);}finally{global.fetch=original;}
});
