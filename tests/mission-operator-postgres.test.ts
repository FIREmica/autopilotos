import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, lstat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { LocalMissionStore, type LocalMissionStatus } from '../src/autopilot/localMissionStore';
import { ManagedProcesses } from '../src/autopilot/managedProcesses';
import { PersistentMissionOrchestrator } from '../src/autopilot/missionRuntime';
import type { LocalMissionConfig } from '../src/autopilot/localMissionConfig';
import { DeterministicSyntheticPlanner } from '../src/autopilot/missionPlanner';
import { SyntheticMissionExecutor, SYNTHETIC_CONTENTS, SYNTHETIC_TEST_SOURCE } from '../src/autopilot/syntheticMissionExecutor';
const database=process.env.OPERATOR_TEST_DATABASE_URL;
const exec=promisify(execFile);
test('standalone operator CLI proves admission execution supervision cancellation and persistent relaunch',
  {skip:!database,timeout:180000},async()=>{
    const url=new URL(database!);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/victoriosa_mission_operator_lab');assert.equal(url.search,'');
    const root=await mkdtemp(path.join(tmpdir(),'autopilot-operator-cli-'));const repo=path.join(root,'seed');const worktrees=path.join(root,'worktrees');
    await mkdir(repo);await mkdir(worktrees);
    const git=(args:string[])=>exec('git',['-c','core.hooksPath=/dev/null',...args],{cwd:repo,windowsHide:true,timeout:10000});
    await git(['init']);await git(['config','user.name','Synthetic Autopilot']);await git(['config','user.email','synthetic@example.invalid']);
    await writeFile(path.join(repo,'synthetic-seed.txt'),'Autopilot disposable synthetic repository v1\n');await git(['add','synthetic-seed.txt']);
    await git(['-c','commit.gpgsign=false','commit','-m','synthetic seed']);
    const config=path.join(root,'host.json');const output=path.join(root,'evidence.json');
    await writeFile(config,JSON.stringify({version:1,mode:'local_synthetic_lab',database:{host:'127.0.0.1',port:Number(url.port||5432),name:'victoriosa_mission_operator_lab',user:decodeURIComponent(url.username)},
      resources:{repository:repo,worktreeRoot:worktrees,baseSha:(await git(['rev-parse','HEAD'])).stdout.trim()},permissions:{admit:true,execute:true,cancel:true},
      leaseSeconds:10,deadlineMs:8000,queryTimeoutMs:3000}));
    const env={...process.env,PGPASSWORD:decodeURIComponent(url.password),NODE_TEST_CONTEXT:undefined};
    const runSql=(query:string)=>new Promise<string>((resolve,reject)=>{
      const child=execFile(process.env.PSQL_PATH||'psql',['-h','127.0.0.1','-p',url.port||'5432','-U',decodeURIComponent(url.username),'-d','victoriosa_mission_operator_lab','-w','-X','-qAt','-v','ON_ERROR_STOP=1'],
        {env,windowsHide:true,timeout:10000},(error,out)=>error?reject(Error('synthetic_setup_failed')):resolve(out.trim()));child.stdin!.end(query);
    });
    await runSql('create schema private_sentinel;create table private_sentinel.synthetic_guard(id integer);');
    await assert.rejects(exec(process.execPath,['--import','tsx',fileURLToPath(new URL('../scripts/autopilot-mission.ts',import.meta.url)),'init','--config',config],{env,windowsHide:true,timeout:20000}),
      'initialization must reject existing non-public data');
    assert.equal(await runSql("select coalesce(to_regclass('public.autopilot_local_lab')::text,'absent');"),'absent');
    await runSql('drop table private_sentinel.synthetic_guard;drop schema private_sentinel;');
    await exec(process.execPath,['--import','tsx',fileURLToPath(new URL('../scripts/autopilot-mission.ts',import.meta.url)),'init','--config',config],{env,windowsHide:true,timeout:20000});
    // Additive migration tested in a disposable PostgreSQL database only.
    // No hosted SQL writes or production data involved.
    const approvalMigration=await readFile(fileURLToPath(new URL('../supabase/migrations/20261117000001_agent_task_durable_approval.sql',import.meta.url)),'utf8');
    await runSql(approvalMigration);
    const approvalId='task_1700000000000_approvalfixture';
    await runSql(`insert into public.agent_tasks(id,goal,actor,action,status,input,policy_context)
      values ('${approvalId}','synthetic approval','codex','deploy_production','awaiting_approval','{}',
        '{"risk":"high"}'::jsonb);`);
    const expectedAt=await runSql(`select updated_at from public.agent_tasks where id='${approvalId}';`);
    const approveSql=`select public.approve_agent_task_if_current('${approvalId}',
      '${expectedAt}'::timestamptz,'codex','deploy_production','{"risk":"high"}'::jsonb);`;
    const approvals=await Promise.all([runSql(approveSql),runSql(approveSql)]);
    assert.deepEqual(approvals.sort(),['f','t'],'only one durable approval per row');
    assert.equal(await runSql(`select count(*) from public.agent_audit_events where task_id='${approvalId}' and event_type='TASK_APPROVED';`),'1');
    assert.equal(await runSql(`select status from public.agent_tasks where id='${approvalId}';`),'queued');
    assert.equal(await runSql(approveSql),'f','stale approval cannot replay');
    const legacyId='task_1700000000000_legacyfixture';
    await runSql(`insert into public.agent_tasks(id,goal,actor,action,status,input)
      values ('${legacyId}','legacy approval','codex','deploy_production','awaiting_approval','{}');`);
    const legacyTime=await runSql(`select updated_at from public.agent_tasks where id='${legacyId}';`);
    assert.equal(await runSql(`select public.approve_agent_task_if_current('${legacyId}',
      '${legacyTime}'::timestamptz,'codex','deploy_production','{"risk":"high"}'::jsonb);`),'f',
      'pre-migration records without policy snapshot remain unapproved');
    const result=await exec(process.execPath,['--import','tsx',fileURLToPath(new URL('../scripts/demo-local-missions.ts',import.meta.url)),config,output],
      {env,windowsHide:true,timeout:140000,maxBuffer:65536});
    const evidence=JSON.parse(await readFile(output,'utf8'));assert.equal(evidence.cases.length,6);assert.equal(evidence.unattendedStart,false);
    assert.equal(evidence.cases[1].effectsReconciled,true);assert.equal(evidence.cases[3].childTerminated,true);assert.equal(evidence.cases[4].childTerminated,true);
    // The supervisor observes the same host-bound SQL ledger as the operator.
    // Inspection never claims, updates the checkpoint, changes attempts or emits messages.
    const normalMissionId: string = evidence.cases[0].mission.id;
    assert.match(normalMissionId,/^synthetic-cli-normal-[a-z0-9-]+$/);
    const snapshot=async()=>runSql(`select json_build_object('status',t.status,
      'attempts',t.attempt_count,'version',t.mission_checkpoint_version,
      'audit',(select count(*) from public.agent_audit_events a where a.task_id=t.id)
      ) from public.agent_tasks t where t.id='${normalMissionId}'`);
    const beforeSupervisor=await snapshot();
    const observed=await exec(process.execPath,
      ['--import','tsx',fileURLToPath(new URL('../scripts/autopilot-mission.ts',import.meta.url)),
        'supervise','--config',config,'--id',normalMissionId],
      {env,windowsHide:true,timeout:20000});
    const event=JSON.parse(observed.stdout.trim());
    assert.deepEqual(event,{event:'supervisor_decision',readOnly:true,scope:'F0_local_synthetic',
      decision:{goalId:'permanent-objective',missionId:normalMissionId,action:'verify',
        reason:'completion_evidence_missing'}});
    assert.equal(await snapshot(),beforeSupervisor,'supervisor inspection must not mutate SQL ledger');
    // Same local SQL ledger; authorization comes from a separate host callback.
    const hostConfig=JSON.parse(await readFile(config,'utf8')) as LocalMissionConfig;
    const managed=new ManagedProcesses(); const savedPassword=process.env.PGPASSWORD;
    process.env.PGPASSWORD=decodeURIComponent(url.password);
    try {
      const store=new LocalMissionStore(hostConfig,managed);
      const objective={version:1,kind:'synthetic.ensure_verified_artifact',expected:'canonical_synthetic_result',
        restrictions:['local_synthetic_only','no_network','no_send'],resources:['synthetic_worktree','result_artifact','verification_fixture'],
        acceptance:['artifact_matches','synthetic_test_passed'],limits:{maxReplans:1,maxSteps:8}};
      const executor={executorId:'synthetic-authorization-test',execute:async()=>{throw Error('must_not_execute');}};
      const authorize=async(id:string,verify=async()=>true)=>PersistentMissionOrchestrator.authorizedPermanentMissionClaim(store,{
        id:'synthetic-grant',revision:1,missionId:id,binding:store.binding,phase:'F0',executorId:executor.executorId,
        goalVersion:1,checkpointVersion:0,planVersion:0,objective,expiresAt:Date.now()+30000,
      },randomUUID(),executor,verify);
      const untouched=(s:LocalMissionStatus)=>({state:s.state,attempts:s.attempts,version:s.checkpointVersion,audit:s.audit});
      const denied='synthetic-auth-denied'; await store.admit({id:denied,objective});
      const baseline=untouched(await store.status(denied));
      await assert.rejects(authorize(denied,async()=>false),/mission_authorization_denied/);
      assert.deepEqual(untouched(await store.status(denied)),baseline);
      for (const [suffix,change] of [
        ['goal',"input=jsonb_set(input,'{objective,limits,maxSteps}','7')"],
        ['version','mission_checkpoint_version=mission_checkpoint_version+1'],
        ['mission',"mission_id='synthetic-foreign-mission'"],
        ['goal-version',"input=jsonb_set(input,'{goal_version}','2')"],
        ['cancel',"status='blocked',mission_checkpoint=jsonb_set(mission_checkpoint,'{mission_state}','\"cancelled\"')"],
      ]) {
        const id=`synthetic-auth-${suffix}`;await store.admit({id,objective});
        const ledger=await authorize(id);
        await runSql(`update public.agent_tasks set ${change} where id='${id}'`);
        const before=untouched(await store.status(id));
        await assert.rejects(ledger.claimMission('software'),/claim_failed/);
        assert.deepEqual(untouched(await store.status(id)),before,'stale authorization must not mutate ledger');
      }
      const id='synthetic-auth-race';await store.admit({id,objective});
      const ledgers=await Promise.all([authorize(id),authorize(id)]);
      const claims=await Promise.allSettled(ledgers.map(ledger=>ledger.claimMission('software')));
      assert.equal(claims.filter(r=>r.status==='fulfilled' && r.value!==null).length,1);
      for (const claim of claims) if(claim.status==='fulfilled' && claim.value) assert.deepEqual(claim.value.permissions,[]);
      for (const ledger of ledgers) {
        assert.equal('saveCheckpoint' in ledger,false);
        assert.equal('completeMission' in ledger,false);
      }
      const state=await store.status(id);assert.equal(state.attempts,1);
      assert.equal(state.audit.filter((e:unknown)=>(e as {event:string}).event==='mission_authorized_claim').length,1);
      for(const ledger of ledgers) await assert.rejects(ledger.claimMission('software'),/claim_failed/);
      assert.equal((await store.status(id)).attempts,1);

      // Exercise the actual guarded factory, planner, executor and SQL ledger,
      // rather than a legacy ledger whose context already has execution permission.
      const effectStore=new LocalMissionStore({...hostConfig,leaseSeconds:60,deadlineMs:45000},managed);
      for (const scenario of ['verified','denied','unobserved']) {
        const denyCheckpoint=scenario==='denied',denyObservation=scenario==='unobserved';
        const missionId=`synthetic-effect-${scenario}`;
        await effectStore.admit({id:missionId,objective});
        const effectExecutor=new SyntheticMissionExecutor(`local:${randomUUID()}`,repo,worktrees,hostConfig.resources.baseSha,managed);
        let verifications=0;
        const effectLedger=await PersistentMissionOrchestrator.authorizedPermanentMissionRuntime(effectStore,{
          id:`${missionId}-grant`,revision:1,missionId,binding:effectStore.binding,phase:'F0',executorId:effectExecutor.executorId,
          goalVersion:1,checkpointVersion:0,planVersion:0,objective,expiresAt:Date.now()+60000,
        },randomUUID(),effectExecutor,async()=>true,async(g,_context,effect)=>({
          allowed:!(denyCheckpoint && effect.kind==='write_checkpoint') && !(denyObservation && effect.kind==='observe_state'),revision:g.revision,operationId:effect.operationId,
          permissions:['observe_state','execute_step'].includes(effect.kind)?['synthetic_worktree']:[],
        }),{verifierId:'independent-fixture-verifier',verify:async context=>{
          verifications++;
          const directory=path.join(worktrees,missionId,'.autopilot-synthetic');
          // Oracle contents are source-owned and outside the candidate worktree.
          return context.checkpoint.mission_state==='ready_to_complete'
            && await readFile(path.join(directory,'result.txt'),'utf8')===SYNTHETIC_CONTENTS
            && await readFile(path.join(directory,'result.test.cjs'),'utf8')===SYNTHETIC_TEST_SOURCE;
        }});
        const run=new PersistentMissionOrchestrator(effectLedger,45000,new DeterministicSyntheticPlanner()).runMission(effectExecutor,'software');
        if(denyCheckpoint || denyObservation) await assert.rejects(run,/mission_effect_authorization_denied/); else await run;
        const result=await effectStore.status(missionId);
        assert.equal(result.attempts,1);
        assert.equal(result.state,denyObservation?'queued':denyCheckpoint?'in_progress':'completed');
        assert.equal(verifications,denyCheckpoint || denyObservation?0:1);
        // One plan + three step checkpoints + the existing SQL completion increment.
        assert.equal(result.checkpointVersion,denyObservation?0:denyCheckpoint?1:5);
        assert.deepEqual(result.checkpoint.completed_steps,denyCheckpoint || denyObservation?[]:['prepare-v1','modify-v1','verify-v1']);
        if(denyObservation) await assert.rejects(lstat(path.join(worktrees,missionId)),{code:'ENOENT'});
        if(scenario==='verified') assert.match(await runSql(`select completed_evidence from public.agent_tasks where id='${missionId}'`),/^independent:independent-fixture-verifier:/);
      }
    } finally {
      if(savedPassword===undefined) delete process.env.PGPASSWORD; else process.env.PGPASSWORD=savedPassword;
      await managed.close();
    }
    console.log(result.stdout.trim());
  });
