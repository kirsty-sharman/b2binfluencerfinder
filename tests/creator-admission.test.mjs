import test from 'node:test';
import assert from 'node:assert/strict';
import { currentQualification, ADMISSION_VERSION } from '../lib/creator-admission.ts';
const passed={version:ADMISSION_VERSION,qualified:true};
test('245 followers cannot qualify even with a passing AI result',()=>{
 assert.equal(currentQualification({channel:'x',audience:245,qualification:passed}),false);
});
test('legacy approval does not bypass current checks',()=>{
 assert.equal(currentQualification({channel:'linkedin',audience:3963,qualification:{version:6,qualified:true}}),false);
});
test('qualified creators with sufficient known audiences remain eligible',()=>{
 for(const channel of ['linkedin','x','youtube']) {
  assert.equal(currentQualification({channel,audience:1000,qualification:passed}),true);
  assert.equal(currentQualification({channel,audience:null,qualification:passed}),false);
 }
 assert.equal(currentQualification({channel:'podcast',audience:null,qualification:passed}),true);
});
