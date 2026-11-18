import test from 'node:test';
import assert from 'node:assert/strict';
import { montevideoMonthStart, reservationRecorded, assertCloudRunMonth } from './cloud-development.mjs';
import { CLOUD_DEVELOPMENT as C } from '../src/autopilot/cloudDevelopment.ts';
test('monthly allowance uses the owner timezone rather than resetting three hours early',()=>{
  assert.equal(montevideoMonthStart(new Date('2026-12-01T02:59:59Z')),'2026-11-01T03:00:00.000Z');
  assert.equal(montevideoMonthStart(new Date('2026-12-01T03:00:00Z')),'2026-12-01T03:00:00.000Z');
  assert.throws(()=>assertCloudRunMonth('2026-12-01T02:59:59Z',new Date('2026-12-01T03:00:00Z')),/month_expired/);
  assert.doesNotThrow(()=>assertCloudRunMonth('2026-12-01T03:00:00Z',new Date('2026-12-02T03:00:00Z')));
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
