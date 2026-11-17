/**
 * Disposable P1 OS-process boundary proof. Not a CLI, worker or scheduler.
 * Each invocation creates fresh Node objects, host policy and SQL sessions.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { LocalMissionStore } from '../../src/autopilot/localMissionStore';
import { ManagedProcesses } from '../../src/autopilot/managedProcesses';
import { PersistentMissionOrchestrator } from '../../src/autopilot/missionRuntime';
import { DeterministicSyntheticPlanner } from '../../src/autopilot/missionPlanner';
import { SyntheticMissionExecutor, SYNTHETIC_CONTENTS, SYNTHETIC_TEST_SOURCE } from '../../src/autopilot/syntheticMissionExecutor';
import type { LocalMissionConfig } from '../../src/autopilot/localMissionConfig';
import type { MissionClaimAuthorization } from '../../src/autopilot/missionAuthorization';

const [mode,configFile,id]=process.argv.slice(2);
if(!['prepare','probe-active','recover','recover-tampered'].includes(mode)
  ||!/^synthetic-protected-node-[a-z0-9-]{1,30}$/.test(id??'')
  ||!configFile)throw Error('invalid_fixture_invocation');
const config=JSON.parse(await readFile(configFile,'utf8')) as LocalMissionConfig;
assert.equal(config.database.host,'127.0.0.1');
assert.equal(config.database.name,'victoriosa_mission_operator_lab');
const processes=new ManagedProcesses();
const store=new LocalMissionStore({...config,leaseSeconds:10,deadlineMs:8000},processes);
const objective={version:1,kind:'synthetic.ensure_verified_artifact',expected:'canonical_synthetic_result',
  restrictions:['local_synthetic_only','no_network','no_send'],
  resources:['synthetic_worktree','result_artifact','verification_fixture'],
  acceptance:['artifact_matches','synthetic_test_passed'],limits:{maxReplans:1,maxSteps:8}};
const artifactFolder=path.join(config.resources.worktreeRoot,id,'.autopilot-synthetic');
const oracle=async()=>{
  for(const [name,contents] of [['result.txt',SYNTHETIC_CONTENTS],['result.test.cjs',SYNTHETIC_TEST_SOURCE]] as const){
    const artifact=path.join(artifactFolder,name);
    const stat=await lstat(artifact);
    if(!stat.isFile()||stat.isSymbolicLink()||await readFile(artifact,'utf8')!==contents)return false;
  }
  return true;
};
const report=(result:Record<string,unknown>)=>process.stdout.write(JSON.stringify({mode,pid:process.pid,id,...result})+'\n');
const rawSql=(query:string)=>new Promise<string>((resolve,reject)=>{
  const d=config.database;
  const child=execFile(process.env.PSQL_PATH||'psql',['-h',d.host,'-p',String(d.port),'-U',d.user,'-d',d.name,
    '-w','-X','-qAt','-v','ON_ERROR_STOP=1'],{windowsHide:true,timeout:10000},
    (error,out)=>error?reject(Error('fixture_sql_failed')):resolve(out.trim()));
  child.stdin!.end(query);
});
const readyGrant=(executorId:string):MissionClaimAuthorization=>({
  id:id+'-recovery',revision:3,missionId:id,binding:store.binding,phase:'F0',executorId,
  goalVersion:1,checkpointVersion:4,planVersion:1,objective,recovery:'ready_to_complete',
  expiresAt:Date.now()+60000,
});
try {
  if(mode==='prepare'){
    assert.equal(await store.admit({id,objective}),'queued');
    const executor=new SyntheticMissionExecutor('local:'+randomUUID(),config.resources.repository,
      config.resources.worktreeRoot,config.resources.baseSha,processes);
    const grant:MissionClaimAuthorization={id:id+'-initial',revision:1,missionId:id,binding:store.binding,
      phase:'F0',executorId:executor.executorId,goalVersion:1,checkpointVersion:0,planVersion:0,
      objective,expiresAt:Date.now()+60000};
    assert.equal(await store.authorizeMission(grant,0),true);
    let verified=0;
    const ledger=await PersistentMissionOrchestrator.authorizedPermanentMissionRuntime(
      store,grant,randomUUID(),executor,async()=>true,
      async(g,_c,e)=>{
        if(e.kind==='complete_write') assert.equal(await store.revokeAuthorization(id,1),true);
        return {allowed:true,revision:g.revision,operationId:e.operationId,
          permissions:['observe_state','execute_step'].includes(e.kind)?['synthetic_worktree']:[]};
      },{verifierId:'independent-original-verifier',verify:async ctx=>{
        verified++;
        return ctx.checkpoint.mission_state==='ready_to_complete'&&await oracle();
      }});
    await assert.rejects(new PersistentMissionOrchestrator(ledger,45000,new DeterministicSyntheticPlanner())
      .runMission(executor,'software'),/mission_effect_authorization_denied/);
    const state=await store.status(id);
    assert.equal(verified,1);
    assert.equal(await oracle(),true);
    assert.equal(state.state,'ready_to_complete');
    assert.equal(state.checkpointVersion,4);
    assert.equal(state.attempts,1);
    assert.equal(state.leaseActive,true);
    assert.equal(state.authorization?.active,false);
    assert.equal(state.authorization?.revision,2);
    report({state:state.state,version:state.checkpointVersion,attempts:state.attempts});
  } else if(mode==='probe-active'){
    const before=await store.status(id);
    assert.equal(before.state,'ready_to_complete');
    assert.equal(before.leaseActive,true);
    await assert.rejects(store.authorizeMission(readyGrant('local:'+randomUUID()),2));
    const after=await store.status(id);
    assert.deepEqual(after.checkpoint,before.checkpoint);
    assert.equal(after.attempts,before.attempts);
    assert.equal(after.authorization?.revision,2);
    report({rejectedActiveLease:true,checkpointUnchanged:true});
  } else {
    const before=await store.status(id);
    assert.equal(before.leaseActive,false);
    assert.equal(before.state,'ready_to_complete');
    assert.equal(before.authorization?.revision,2);
    const executor={executorId:'local:'+randomUUID(),
      observe:async()=>{throw Error('recovery_must_not_observe');},
      execute:async()=>{throw Error('recovery_must_not_execute');}};
    const fresh=readyGrant(executor.executorId);
    await assert.rejects(store.assertAuthorization({...fresh,revision:2}),/durable_policy_denied/);
    assert.equal(await store.authorizeMission(fresh,2),true);
    for(const invalid of [
      {...fresh,binding:'a'.repeat(64)},
      {...fresh,checkpointVersion:3},
      {...fresh,goalVersion:2},
      {...fresh,executorId:'invalid executor'},
      {...fresh,objective:{...objective,expected:'tampered'}},
    ]){
      await assert.rejects(PersistentMissionOrchestrator.authorizedPermanentMissionRuntime(
        store,invalid,randomUUID(),executor,async()=>true,
        async(g,_c,e)=>({allowed:true,revision:g.revision,operationId:e.operationId,permissions:[]}),
        {verifierId:'independent-recovery-verifier',verify:oracle}));
    }
    const token=await rawSql("select execution_token from public.agent_tasks where id='"+id+"';");
    assert.match(token,/^[0-9a-f-]{36}$/);
    let oracleCalls=0;
    const verifier={verifierId:'independent-recovery-verifier',
      verify:async context=>{
        oracleCalls++;
        assert.equal(context.checkpointVersion,4);
        // The replaced controller's fenced token cannot finish.
        assert.equal(await rawSql("set request.jwt.claim.role='service_role'; select public.six_agent_complete('"
          +id+"','"+token+"'::uuid,'stale');"),'f');
        return await oracle();
      }};
    const ledger=await PersistentMissionOrchestrator.authorizedPermanentMissionRuntime(
      store,fresh,randomUUID(),executor,async()=>true,
      async(g,_c,e)=>({allowed:true,revision:g.revision,operationId:e.operationId,permissions:[]}),verifier);
    const oldCheckpoint=before.checkpoint;
    const run=new PersistentMissionOrchestrator(ledger,45000,{
      plannerId:'recovery-never-plan',propose:async()=>{throw Error('recovery_must_not_replan');}
    }).runMission(executor,'software');
    if(mode==='recover-tampered'){
      await assert.rejects(run,/mission_completion_unverified/);
      const state=await store.status(id);
      assert.equal(oracleCalls,1);
      assert.notEqual(state.state,'completed');
      assert.equal(state.checkpointVersion,4);
      assert.deepEqual(state.checkpoint,oldCheckpoint);
      report({state:state.state,attempts:state.attempts,tamperedRejected:true});
    } else {
      await run;
      const state=await store.status(id);
      assert.equal(oracleCalls,1);
      assert.equal(state.state,'completed');
      assert.equal(state.attempts,2);
      assert.equal(state.checkpointVersion,5);
      assert.deepEqual(state.checkpoint.completed_steps,oldCheckpoint.completed_steps);
      assert.deepEqual(state.checkpoint.artifacts,oldCheckpoint.artifacts);
      assert.deepEqual(state.checkpoint.results,oldCheckpoint.results);
      assert.deepEqual(state.checkpoint.test_evidence,oldCheckpoint.test_evidence);
      await assert.rejects(PersistentMissionOrchestrator.authorizedPermanentMissionRuntime(
        store,fresh,randomUUID(),executor,async()=>true,
        async(g,_c,e)=>({allowed:true,revision:g.revision,operationId:e.operationId,permissions:[]}),
        verifier),/mission_recovery_not_authorized/);
      report({state:state.state,attempts:state.attempts,version:state.checkpointVersion,verified:oracleCalls});
    }
  }
}finally{await processes.close();}
