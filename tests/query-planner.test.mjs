import test from 'node:test';
import assert from 'node:assert/strict';
import {querySlots,renderDiscoveryQuery,validateQueryPlan} from '../lib/channels/query-planner.ts';
const context={brand:{name:'Test'},phrases:[{id:'p',phrase:'referral marketing'}],industries:[{name:'Banking'},{name:'Professional education'}],channels:['linkedin','podcast','x'],limit:6,assets:[{id:'a',title:'Student referrals',topics:[],summary:null}]};
test('coverage allocates each channel to each industry before repeating',()=>{assert.equal(new Set(querySlots(context).map(s=>s.channel+s.industry)).size,6)});
test('podcasts and X retain generated topic instead of only taxonomy',()=>{assert.equal(renderDiscoveryQuery('podcast','student enrolment growth',0),'student enrolment growth');assert.match(renderDiscoveryQuery('x','bank customer acquisition',0),/^bank customer acquisition -is:retweet/)});
test('AI cannot inject search operators',()=>{assert.equal(renderDiscoveryQuery('youtube','"edtech" OR site:example.com',0),'edtech OR site example com')});
const rows=()=>querySlots(context).map(s=>({slot:s.slot,terms:`sector topic ${s.slot}`,intent:'Find sector experts',reason:'Industry topic',assetId:null}));
test('reject unknown asset references and incomplete or duplicate slot plans',()=>{
 const q=rows();q[0].assetId='invented';assert.throws(()=>validateQueryPlan({queries:q},context),/unknown content/);
 assert.throws(()=>validateQueryPlan({queries:rows().slice(1)},context),/incomplete/);
 const duplicate=rows();duplicate[1].slot=0;assert.throws(()=>validateQueryPlan({queries:duplicate},context),/assignments/);
});
test('reject duplicate searches per channel',()=>{const q=rows();q[3].terms=q[0].terms; q[0].terms='same topic';q[3].terms='same topic';const c={...context,channels:['podcast'],limit:6};assert.throws(()=>validateQueryPlan({queries:q},c),/duplicate searches/)});
test('valid plan preserves context and explanation',()=>{const result=validateQueryPlan({queries:rows()},context);assert.equal(result.plan.length,6);assert.equal(result.plan[0].industry,'Banking');assert.equal(result.explanations[0].intent,'Find sector experts')});
