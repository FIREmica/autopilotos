import test from 'node:test';
import assert from 'node:assert/strict';
import { createMissionClaimGuard } from './missionAuthorization';
import { PersistentMissionOrchestrator } from './missionRuntime';
import type { ExecutorAdapter, MissionLedger } from './executorAdapter';

const objective = { version: 1, kind: 'synthetic.ensure_verified_artifact', expected: 'canonical_synthetic_result',
  restrictions: ['local_synthetic_only','no_network','no_send'], resources: ['synthetic_worktree','result_artifact','verification_fixture'],
  acceptance: ['artifact_matches','synthetic_test_passed'], limits: {maxReplans:1,maxSteps:8} };
const grant = () => ({ id:'synthetic-grant', revision:1, missionId:'synthetic-authorized', binding:'a'.repeat(64),
  phase:'F0' as const, executorId:'synthetic-executor', goalVersion:1, checkpointVersion:0, planVersion:0,
  objective, expiresAt:Date.now()+30000 });
const executor: ExecutorAdapter = {executorId:'synthetic-executor', execute:async()=>{throw Error('unused');}};

test('independent host authorization is required before claim; a supervisor proposal is insufficient', async () => {
  for (const verdict of [false, 'true', null, undefined]) {
    const guard = createMissionClaimGuard(grant(), executor, async () => verdict as boolean);
    await assert.rejects(guard.beforeClaim('software'), /mission_authorization_denied/);
  }
});

test('authorization is immutable, expires, and is single use even when claim outcome is uncertain', async () => {
  const input=grant(); let seen=0;
  const guard=createMissionClaimGuard(input,executor,async checked=>{seen++;assert.equal(checked.revision,1);return true;});
  input.revision=2; input.objective={...objective,limits:{maxReplans:0,maxSteps:1}};
  await guard.authorizeExecutor(executor);
  await guard.beforeClaim('software');
  assert.equal(guard.expected.goalVersion,1);
  assert.deepEqual(guard.expected.objective,objective);
  await assert.rejects(guard.beforeClaim('software'),/mission_authorization_consumed/);
  assert.equal(seen,2);
  assert.throws(()=>createMissionClaimGuard({...grant(),expiresAt:Date.now()-1},executor,async()=>true),/invalid_mission_authorization/);
});

test('identity means the host-selected executor instance, not a copied executorId', async () => {
  const guard=createMissionClaimGuard(grant(),executor,async()=>true);
  await assert.rejects(guard.authorizeExecutor({...executor}),/mission_executor_mismatch/);
  await assert.rejects(guard.beforeClaim('marketing' as never),/mission_agent_mismatch/);
});

test('the current policy revision is rechecked at claim after initial approval',async()=>{
  let currentRevision=1;
  const guard=createMissionClaimGuard(grant(),executor,async checked=>checked.revision===currentRevision);
  await guard.authorizeExecutor(executor);
  currentRevision=2;
  await assert.rejects(guard.beforeClaim('software'),/mission_authorization_denied/);
});

test('revocation or expiration during independent verification denies claim', async () => {
  const expired=createMissionClaimGuard({...grant(),expiresAt:Date.now()+100},executor,async()=>{
    await new Promise(resolve=>setTimeout(resolve,150));return true;
  });
  await assert.rejects(expired.beforeClaim('software'),/mission_authorization_denied/);
  const revoked=createMissionClaimGuard(grant(),executor,async()=>{throw Error('private host detail');});
  await assert.rejects(revoked.beforeClaim('software'),/^Error: mission_authorization_denied$/);
});

test('runtime checks ledger authorization before claiming or invoking an executor', async () => {
  let claims=0;
  const ledger = { authorizeExecutor:async()=>{throw Error('mission_authorization_denied');},
    claimMission:async()=>{claims++;return null;} } as unknown as MissionLedger;
  await assert.rejects(new PersistentMissionOrchestrator(ledger).runMission(executor,'software'),/mission_authorization_denied/);
  assert.equal(claims,0);
});
