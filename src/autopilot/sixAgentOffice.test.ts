import test from 'node:test';
import assert from 'node:assert/strict';
import type {SupabaseClient} from '@supabase/supabase-js';
import {runSixAgentOfficeEntry,OFFICE_TRIGGERS,summarizeOfficeStatus,type OfficeHost} from './sixAgentOffice';
const host:OfficeHost={mode:'local_synthetic_staging',authorize:async()=>true,publicHealth:async()=>({ok:true}),metrics:async()=>({received:1,completed:0,blocked:0})};
test('entry rejects wrong trigger and missing host authorization before any claim',async()=>{
 const client={rpc:async()=>{throw Error('must_not_claim');}} as unknown as SupabaseClient;
 await assert.rejects(runSixAgentOfficeEntry(client,'director','wrong',host),/not_authorized/);
 await assert.rejects(runSixAgentOfficeEntry(client,'director',OFFICE_TRIGGERS.director,{...host,authorize:async()=>false}),/not_authorized/);
});
test('revoked followup consent cannot produce completed evidence',async()=>{
 const calls:string[]=[];const client={rpc:async(name:string)=>{calls.push(name);return {data:name==='six_agent_claim'?
 [{task_id:'synthetic-office-followup',claim_token:'opaque',task_payload:{synthetic:true,no_send:true,action:'synthetic_office_followup',consent:false,supervisionApproved:true}}]:true,error:null};}} as unknown as SupabaseClient;
 const result=await runSixAgentOfficeEntry(client,'followup',OFFICE_TRIGGERS.followup,host);
 assert.equal(result.state,'blocked');assert.deepEqual(calls,['six_agent_claim','six_agent_fail']);
});
test('status separates configured readiness, stale activity, active lease and unknown records',()=>{
 const now=new Date('2026-11-21T00:00:00Z');
 const rows=[{agent_id:'director',status:'completed',attempt_count:1,updated_at:'2026-11-01T00:00:00Z',lease_until:null,completed_evidence:'proof'},
 {agent_id:'software',status:'running',attempt_count:2,updated_at:now.toISOString(),lease_until:'2026-11-20T23:00:00Z',completed_evidence:null}];
 const status=summarizeOfficeStatus(rows,now);
 assert.equal(status[0].configuredState,'ready');assert.equal(status[0].observedHealth,'stale_or_waiting');
 assert.equal(status[1].observedHealth,'attention_required');assert.equal(status[1].retriedTasks,1);
 assert.equal(status[2].observedHealth,'unobserved');
 assert.ok(summarizeOfficeStatus(rows,now,true).every(a=>a.observedHealth==='partial'));
});
