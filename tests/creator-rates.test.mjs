import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateCreatorRate, rateChannels } from '../lib/creator-rates.ts';
test('configured benchmarks through 25k for every channel', () => {
  for (const channel of ['linkedin', 'x', 'newsletter']) {
    assert.deepEqual([1000,5000,10000,25000].map(n => estimateCreatorRate(channel,n)), [300,600,900,1800]);
  }
  assert.deepEqual([1000,5000,10000,25000].map(n => estimateCreatorRate('youtube',n)), [500,1000,1500,3000]);
});
test('interpolation across both segments', () => {
  assert.equal(estimateCreatorRate('linkedin',3000),450);
  assert.equal(estimateCreatorRate('youtube',3000),750);
  assert.equal(estimateCreatorRate('youtube',7500),1250);
});
test('unsupported audience sizes never receive invented rates', () => {
  for (const n of [0,-1,999,25001,NaN,Infinity,1000.5]) assert.equal(estimateCreatorRate('x',n),null);
});
test('newsletter and YouTube use subscribers', () => {
  assert.equal(rateChannels.newsletter.audience,'subscribers');
  assert.equal(rateChannels.youtube.audience,'subscribers');
});

test('total offers increase and cost per thousand decreases across the full range', () => {
  for (const channel of Object.keys(rateChannels)) {
    let previous = estimateCreatorRate(channel,1000);
    for (let audience=1001; audience<=25000; audience++) {
      const current=estimateCreatorRate(channel,audience);
      assert.ok(current >= previous);
      assert.ok(current/audience < previous/(audience-1));
      previous=current;
    }
  }
});
