/** One-command local staging proof. No hosted connection, credentials, messages or P2 resources. */
import assert from 'node:assert/strict';
import {execFile,spawn,spawnSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {promisify} from 'node:util';
import {chmod,mkdtemp,mkdir,readFile,rm,stat,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import type {SupabaseClient} from '@supabase/supabase-js';
import {AGENT_IDS} from '../src/autopilot/sixAgentControlPlane';
import {claimPersistedTask,completePersistedTask} from '../src/autopilot/sixAgentPersistence';
import {OFFICE_TRIGGERS,runSixAgentOfficeEntry,summarizeOfficeStatus,type OfficeHost,type OfficeStatusRecord} from '../src/autopilot/sixAgentOffice';
const exec=promisify(execFile);
const root=fileURLToPath(new URL('../',import.meta.url));
const bin=process.env.AUTOPILOT_PG_BIN||(process.platform==='win32'?'C:/Program Files/PostgreSQL/18/bin':'/usr/lib/postgresql/16/bin');
const pg=(name:string)=>path.join(bin,name+(process.platform==='win32'?'.exe':''));
const lab=await mkdtemp(path.join(tmpdir(),'victoriosas-office-staging-'));
const port=29552,database='autopilot_office_lab',data=path.join(lab,'data');
const passwordFile=path.join(lab,'initdb-password'),passFile=path.join(lab,'client.pgpass');
const childEnv=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','HOME','LANG'].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]));
const clientEnv={...childEnv,PGPASSFILE:passFile};
const arg=process.argv.indexOf('--output');const output=arg<0?path.join(lab,'receipt.json'):path.resolve(process.argv[arg+1]??'');
const quote=(value:string)=>"'"+value.replaceAll("'","''")+"'";
const secureWorkspace=async()=>{
 if(process.platform==='win32'){
  const {stdout:identity}=await exec('whoami.exe',['/user','/fo','csv','/nh'],{windowsHide:true,timeout:10000,env:childEnv});
  const sid=identity.match(/S-1-5-(?:\d+-)+\d+/)?.[0];assert.ok(sid,'current Windows SID is required to protect the temporary staging directory');
  await exec('icacls.exe',[lab,'/inheritance:r','/grant:r',`*${sid}:(OI)(CI)F`],{windowsHide:true,timeout:10000,env:childEnv});
  const {stdout:acl}=await exec('icacls.exe',[lab],{windowsHide:true,timeout:10000,env:childEnv});
  const entries=acl.split(/\r?\n/).filter(line=>/:\([A-Z]/i.test(line));
  assert.equal(entries.length,1,'temporary staging directory must have one explicit principal');
  assert.match(entries[0],/\(OI\)\(CI\)\(F\)/i,'temporary staging directory must be private to the invoking user');
 }else{
  await chmod(lab,0o700);
  assert.equal((await stat(lab)).mode&0o777,0o700,'temporary staging directory must be owner-only');
 }
};
const control=async(operation:'start'|'stop')=>new Promise<void>((resolve,reject)=>{
 const args=operation==='start'?['-D',data,'-o',`-p ${port} -h 127.0.0.1`,'-l',path.join(lab,'postgres.log'),'start','-w']:['-D',data,'-m','fast','stop','-w'];
 const child=spawn(pg('pg_ctl'),args,{windowsHide:true,stdio:'ignore',env:childEnv});
 const timeout=setTimeout(()=>reject(Error('owned_cluster_control_timeout')),15000);
 child.on('error',error=>{clearTimeout(timeout);reject(error);});
 child.on('exit',code=>{clearTimeout(timeout);code===0?resolve():reject(Error('owned_cluster_control_failed'));});
});
let queryNumber=0;
const sql=async(query:string)=>{
 const queryFile=path.join(lab,`query-${++queryNumber}.sql`);
 await writeFile(queryFile,query,'utf8');
 const r=await exec(pg('psql'),['-X','-w','-h','127.0.0.1','-p',String(port),'-U','postgres','-d',database,'-A','-t','-q','-v','ON_ERROR_STOP=1','-f',queryFile],{windowsHide:true,timeout:10000,maxBuffer:1_000_000,env:{...clientEnv,PGCLIENTENCODING:'UTF8'}});
 return r.stdout.trim();
};
// Transport only: the application adapter and canonical stored procedures remain the entry.
const client={rpc:async(name:string,args:Record<string,unknown>)=>{
 try {
  let query:string;
  if(name==='six_agent_claim')query=`select coalesce(json_agg(t),'[]'::json) from public.six_agent_claim(${quote(String(args.p_agent))},${Number(args.p_lease_seconds)}) t`;
  else if(name==='six_agent_complete')query=`select public.six_agent_complete(${quote(String(args.p_task_id))},${quote(String(args.p_token))}::uuid,${quote(String(args.p_evidence))})`;
  else if(name==='six_agent_fail')query=`select public.six_agent_fail(${quote(String(args.p_task_id))},${quote(String(args.p_token))}::uuid,${quote(String(args.p_reason))})`;
  else throw Error('unsupported_rpc');
  const raw=await sql("set request.jwt.claim.role='service_role'; "+query);
  return {data:name==='six_agent_claim'?JSON.parse(raw):raw==='t',error:null};
 }catch{return {data:null,error:{message:'local_rpc_failed'}};}
}} as unknown as SupabaseClient;
let started=false;
const server=createServer((_req,res)=>{res.writeHead(200,{'content-type':'application/json'});res.end('{"synthetic":true,"ok":true}');});
try {
 await secureWorkspace();
 const password=randomBytes(32).toString('hex');
 await writeFile(passwordFile,`${password}\n`,{mode:0o600,flag:'wx'});
 await writeFile(passFile,`127.0.0.1:${port}:*:postgres:${password}\n`,{mode:0o600,flag:'wx'});
 await exec(pg('initdb'),['-D',data,'-U','postgres','--auth=scram-sha-256','--pwfile',passwordFile,'--no-locale','-E','UTF8'],{windowsHide:true,timeout:30000,env:childEnv});
 await rm(passwordFile);
 await assert.rejects(()=>readFile(passwordFile),{code:'ENOENT'},'initdb bootstrap credential must be removed before cluster startup');
 await control('start');started=true;
 const probeArgs=['-X','-w','-h','127.0.0.1','-p',String(port),'-U','postgres','-d','postgres','-qAt','-c','select 1'];
 let missingCredentialRejected=false,wrongCredentialRejected=false;
 for(const probe of [path.join(lab,'missing.pgpass'),path.join(lab,'wrong.pgpass')]){
  if(probe.endsWith('wrong.pgpass'))await writeFile(probe,`127.0.0.1:${port}:*:postgres:${randomBytes(32).toString('hex')}\n`,{mode:0o600,flag:'wx'});
  const denied=spawnSync(pg('psql'),probeArgs,{windowsHide:true,timeout:10000,encoding:'utf8',env:{...childEnv,PGPASSFILE:probe}});
  assert.ifError(denied.error);assert.notEqual(denied.status,0,'PostgreSQL must reject absent and incorrect credentials');
  assert.match(denied.stderr,/no password supplied|password authentication failed/i);
  if(probe.endsWith('wrong.pgpass'))wrongCredentialRejected=true;else missingCredentialRejected=true;
  if(probe.endsWith('wrong.pgpass'))await rm(probe,{force:true});
 }
 await exec(pg('createdb'),['-h','127.0.0.1','-p',String(port),'-U','postgres',database],{windowsHide:true,timeout:10000,env:clientEnv});
 assert.equal(await sql("select bool_and(error is null) and bool_and(auth_method='scram-sha-256') from pg_hba_file_rules"),'t','all valid host authentication rules must require SCRAM');
 if(process.platform!=='win32')assert.equal((await stat(passFile)).mode&0o777,0o600,'client credential file must be owner-only');
 await sql("create schema auth; create function auth.role() returns text language sql stable as 'select current_setting(''request.jwt.claim.role'',true)'; create role service_role; create role authenticated; create role anon;");
 await sql(await readFile(path.join(root,'supabase/migrations/20260912033258_autopilot_core_v4.sql'),'utf8'));
 await sql(await readFile(path.join(root,'supabase/staged/six_agent_queue_20261025.sql'),'utf8'));
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
 const addr=server.address();assert.ok(addr&&typeof addr==='object');
 const host:OfficeHost={mode:'local_synthetic_staging',authorize:async(agent,trigger)=>trigger===OFFICE_TRIGGERS[agent],
  publicHealth:async()=>{const r=await fetch(`http://127.0.0.1:${addr.port}/health`);return {ok:r.ok&&(await r.json()).synthetic===true};},
  metrics:async()=>JSON.parse(await sql("select json_build_object('received',count(*),'completed',count(*) filter(where status='completed'),'blocked',count(*) filter(where status='blocked')) from public.agent_tasks"))};
 const denied=await sql("select count(*) from public.six_agent_claim('director',60)").then(()=>false,()=>true);
 assert.equal(denied,true,'unauthorized database caller must be denied');
 const runs=[];
 for(const agent of AGENT_IDS){
  const id=`synthetic-office-${agent}`;
  const input={synthetic:true,no_send:true,action:`synthetic_office_${agent}`,changeKind:'read_only_review',consent:true,supervisionApproved:true,message:'Información general sintética'};
  await sql(`insert into public.agent_tasks(id,goal,actor,action,status,agent_id,input) values(${quote(id)},'Synthetic office demonstration','synthetic-staging-host',${quote(input.action)},'queued',${quote(agent)},${quote(JSON.stringify(input))}::jsonb); insert into public.agent_audit_events(task_id,event_type,details) values(${quote(id)},'synthetic_authorized_admission','{"synthetic":true,"no_send":true,"host_approved":true}');`);
  await assert.rejects(runSixAgentOfficeEntry(client,agent,OFFICE_TRIGGERS[agent],{...host,authorize:async()=>false}),/not_authorized/);
  if(agent!=='consultations'){
   const abandoned=await claimPersistedTask(client,agent);assert.equal(abandoned?.task_id,id);
   // Fault injection only in this owned disposable DB: an expired lease, not a production retry.
   await sql(`update public.agent_tasks set lease_until=clock_timestamp()-interval '1 second' where id=${quote(id)}`);
   await assert.rejects(completePersistedTask(client,abandoned!,'SIMULADO:expired_executor'),/completion_rejected/);
  }
  const run=await runSixAgentOfficeEntry(client,agent,OFFICE_TRIGGERS[agent],host);
  assert.equal(run.state,agent==='consultations'?'not_claimed':'completed');
  if(agent==='consultations')assert.equal('reason' in run&&run.reason,'consultations_policy_paused');
  const durable=JSON.parse(await sql(`select json_build_object('attempt',attempt_count,'status',status,'evidence',completed_evidence,'audit',(select json_agg(json_build_object('event',event_type,'at',created_at) order by id) from public.agent_audit_events where task_id=t.id)) from public.agent_tasks t where id=${quote(id)}`));
  assert.equal(durable.attempt,agent==='consultations'?0:2);
  if(agent!=='consultations')assert.equal(durable.audit.filter((e:{event:string})=>e.event==='six_agent_complete').length,1);
  runs.push({agent,trigger:OFFICE_TRIGGERS[agent],authorization:'host_approved_synthetic_no_send',run,durable,
   recovery:agent==='consultations'?'not_claimed_policy_pause':'expired_lease_new_attempt_stale_completion_denied'});
 }
 const revoked='synthetic-followup-revoked';
 await sql(`insert into public.agent_tasks(id,goal,actor,action,status,agent_id,max_attempts,input) values('${revoked}','revoked consent negative','synthetic-staging-host','synthetic_office_followup','queued','followup',1,'{"synthetic":true,"no_send":true,"action":"synthetic_office_followup","consent":false,"supervisionApproved":true}');`);
 const negative=await runSixAgentOfficeEntry(client,'followup',OFFICE_TRIGGERS.followup,host);assert.equal(negative.state,'blocked');
 const rows:OfficeStatusRecord[]=JSON.parse(await sql('select json_agg(t) from (select agent_id,status,attempt_count,created_at,updated_at,lease_until,completed_evidence from public.agent_tasks) t'));
 const receipt={mode:'SIMULADO',environment:'owned_local_postgresql_staging',observedAt:new Date().toISOString(),
  authentication:{method:'scram-sha-256',missingCredentialRejected,wrongCredentialRejected,bootstrapPasswordFileRemoved:true,temporaryDirectoryPrivate:true},
  entry:'runSixAgentOfficeEntry -> claimPersistedTask -> six_agent_claim -> six_agent_complete/six_agent_fail',
  runs,negative,unauthorizedCallerDenied:denied,panels:summarizeOfficeStatus(rows,new Date()),
  limitation:'consultations entry exercised and correctly not claimed: canonical SQL policy pause remains intact; no hosted role execution or continuous health certified',
  policySource:'supabase/staged/six_agent_queue_20261025.sql:26',clusterStopped:false};
 await control('stop');started=false;receipt.clusterStopped=true;
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify({mode:receipt.mode,receipt:output,roles:runs.map(r=>({agent:r.agent,state:r.run.state,attempt:r.durable.attempt})),clusterStopped:true}));
}finally{
 server.close();
 try{if(started)await control('stop');}finally{await Promise.all([passwordFile,passFile,path.join(lab,'wrong.pgpass')].map(file=>rm(file,{force:true})));}
}
