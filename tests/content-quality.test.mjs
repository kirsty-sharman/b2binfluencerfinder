import test from 'node:test';
import assert from 'node:assert/strict';
import {rankContent,sourcePassages} from '../lib/content-quality.ts';

test('AI evidence points to original source text, not a generated quotation',()=>{
  const body=Array.from({length:200},(_,i)=>`word${i}`).join(' ');
  const passages=sourcePassages(body);
  assert.equal(passages.length,3);
  assert.equal(passages[1].id,'p1');
  assert.ok(body.includes(passages[1].text));
  assert.equal(passages.map(p=>p.text).join(' '),body);
  assert.equal(passages.find(p=>p.id==='invented'),undefined);
});

test('AI selection excludes weak, unsupported and manually removed material',()=>{
  const rows=[{id:'case',score:95,ready:true},{id:'generic',score:40,ready:true},{id:'unsupported',score:98,ready:false},{id:'removed',score:99,ready:true},{id:'industry',score:80,ready:true}].map(a=>({...a,industryVerified:true,industryReviewVersion:2,matchedIndustries:['Banking'],industryEvidence:'bank case study'}));
  rows.push({id:'unverified',score:99,ready:true,matchedIndustries:['Banking'],industryEvidence:'claimed banking evidence'});
  rows.push({id:'travel',score:99,ready:true,matchedIndustries:[],industryEvidence:''});
  assert.deepEqual(rankContent(rows,['removed']).map(a=>a.id),['case','industry']);
});

test('industry profile changes invalidate earlier assessments', async()=>{
  const {contentFingerprint,passesIndustryGate}=await import('../lib/content-policy.ts');
  assert.notEqual(contentFingerprint('Case','body',['Travel']),contentFingerprint('Case','body',['Banking']));
  assert.equal(contentFingerprint('Case','body',['Banking','Education']),contentFingerprint('Case','body',['Education','Banking']));
  assert.equal(passesIndustryGate({matchedIndustries:['Travel'],industryEvidence:'travel'},['Banking']),false);
  assert.equal(passesIndustryGate({matchedIndustries:['Banking'],industryEvidence:''},['Banking']),false);
  assert.equal(passesIndustryGate({matchedIndustries:['Banking'],industryEvidence:'bank case study'},['Banking']),true);
});
