import test from 'node:test';
import assert from 'node:assert/strict';
import { montevideoMonthStart, reservationRecorded, assertCloudRunMonth, reserveCloudEvaluation, advanceCloudEvaluation, requireLiveCloudOptIn } from './cloud-development.mjs';
import { CLOUD_DEVELOPMENT as C } from '../src/autopilot/cloudDevelopment.ts';
test('monthly allowance uses the owner timezone rather than resetting three hours early',()=>{
  assert.equal(montevideoMonthStart(new Date('2026-12-01T02:59:59Z')),'2026-11-01T03:00:00.000Z');
  assert.equal(montevideoMonthStart(new Date('2026-12-01T03:00:00Z')),'2026-12-01T03:00:00.000Z');
  assert.throws(()=>assertCloudRunMonth('2026-12-01T02:59:59Z',new Date('2026-12-01T03:00:00Z')),/month_expired/);
  assert.doesNotThrow(()=>assertCloudRunMonth('2026-12-01T03:00:00Z',new Date('2026-12-02T03:00:00Z')));
});
test('live owner opt-in is reread and revocation between prepare and publish denies the next effect',async()=>{
  let enabled=true,reads=0,effects=0;
  const api=async route=>{
    assert.equal(route,'contents/docs/CODEX_CONTINUATION.json?ref=main');reads++;
    return {encoding:'base64',content:Buffer.from(JSON.stringify({cloud_development_request:{enabled,owner_monthly_budget_usd:5}})).toString('base64')};
  };
  await requireLiveCloudOptIn(api); // prepare admission
  enabled=false;
  await assert.rejects(async()=>{await requireLiveCloudOptIn(api);effects++;},/revoked/);
  assert.equal(reads,2);assert.equal(effects,0);
  await assert.rejects(()=>requireLiveCloudOptIn(async()=>null),/unavailable/);
  await assert.rejects(()=>requireLiveCloudOptIn(async()=>({encoding:'base64',content:'broken'})),/unavailable/);
});
test('unchanged evaluations cannot reserve twice and publication cannot replace another writer',async()=>{
  const base='a'.repeat(40),next='b'.repeat(40),branch='codex/cloud-'+'c'.repeat(20);
  let head=null;const operations=[];
  const api=async(route,method='GET',body)=>{
    operations.push({route,method,body});
    if(method==='POST'){
      if(head!==null)throw Error('already_exists');head=body.sha;
      return {ref:body.ref,object:{sha:head}};
    }
    if(method==='GET')return {object:{sha:head}};
    assert.equal(method,'PATCH');assert.equal(body.force,false);head=body.sha;
  };
  await reserveCloudEvaluation(base,branch,api);
  await assert.rejects(()=>reserveCloudEvaluation(base,branch,api),/already_exists/);
  assert.equal(head,base); // blocked/no_change leaves the same durable receipt.
  head='d'.repeat(40);
  await assert.rejects(()=>advanceCloudEvaluation(base,branch,next,api,async()=>{}),/branch_changed/);
  assert.equal(operations.filter(o=>o.method==='PATCH').length,0);
  head=base;await advanceCloudEvaluation(base,branch,next,api,async()=>{});assert.equal(head,next);
  head=base;const before=operations.filter(o=>o.method==='PATCH').length;
  await assert.rejects(()=>advanceCloudEvaluation(base,branch,next,api,async()=>{throw Error('revoked_during_branch_read');}),/revoked/);
  assert.equal(operations.filter(o=>o.method==='PATCH').length,before);
});
test('failed/cancelled/uncertain first attempts consume their reservation, skipped steps do not',()=>{
  const jobs=step=>({total_count:1,jobs:[{steps:[{name:C.reservationStep,...step}]}]});
  for(const step of [{status:'in_progress',conclusion:null},{status:'completed',conclusion:'success'},
    {status:'completed',conclusion:'failure'},{status:'completed',conclusion:'cancelled'}])assert.equal(reservationRecorded(jobs(step)),true);
  assert.equal(reservationRecorded(jobs({status:'completed',conclusion:'skipped'})),false);
  assert.equal(reservationRecorded(jobs({status:'queued',conclusion:null})),false);
  assert.throws(()=>reservationRecorded({total_count:101,jobs:[]}),/unverified/);
  assert.throws(()=>reservationRecorded(null),/unverified/);
  assert.throws(()=>reservationRecorded({total_count:1,jobs:[{}]}),/unverified/);
});
