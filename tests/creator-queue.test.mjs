import test from 'node:test';
import assert from 'node:assert/strict';
import { isNewCreator, NEW_CREATOR_WINDOW_MS } from '../lib/creator-queue.ts';
test('new badge expires exactly 72 hours after first availability',()=>{
 const first='2026-09-30T10:00:00Z', start=Date.parse(first);
 assert.equal(isNewCreator(first,start),true);
 assert.equal(isNewCreator(first,start+NEW_CREATOR_WINDOW_MS-1),true);
 assert.equal(isNewCreator(first,start+NEW_CREATOR_WINDOW_MS),false);
});
test('missing, invalid and future dates do not show a new badge',()=>{
 const now=Date.parse('2026-09-30T10:00:00Z');
 for(const date of [null,'invalid','2026-10-01T00:00:00Z']) assert.equal(isNewCreator(date,now),false);
});
