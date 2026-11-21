import type { SupabaseClient } from '@supabase/supabase-js';
import { AGENT_IDS, SIX_AGENTS, consultationDecision, type AgentId } from './sixAgentControlPlane';
import { claimPersistedTask, completePersistedTask, failPersistedTask } from './sixAgentPersistence';

/** An opt-in staging entry over the existing queue. It cannot send or run code. */
export const OFFICE_TRIGGERS:Record<AgentId,string>={director:'enqueue',software:'explicit_task',
 infrastructure:'health_check',consultations:'authorized_inbound',followup:'authorized_review',reports:'scheduled_report'};
export interface OfficeHost {
 mode:'local_synthetic_staging';
 authorize:(agent:AgentId,trigger:string)=>Promise<boolean>;
 publicHealth:()=>Promise<{ok:boolean}>;
 metrics:()=>Promise<{received:number;completed:number;blocked:number}>;
}
export async function runSixAgentOfficeEntry(client:SupabaseClient,agent:AgentId,trigger:string,host:OfficeHost){
 if(host.mode!=='local_synthetic_staging'||!AGENT_IDS.includes(agent)||trigger!==OFFICE_TRIGGERS[agent]
  ||!await host.authorize(agent,trigger))throw Error('office_entry_not_authorized');
 const task=await claimPersistedTask(client,agent);
 if(!task)return {agent,trigger,state:'not_claimed' as const,
  reason:agent==='consultations'?'consultations_policy_paused':'no_claimable_task'};
 const input=task.task_payload;
 try {
  if(input.synthetic!==true||input.no_send!==true||input.action!==`synthetic_office_${agent}`)throw Error('synthetic_scope_required');
  let result:string;
  switch(agent){
   case 'director':result='read_only_next_task_proposal';break;
   case 'software':
    if(input.changeKind!=='read_only_review')throw Error('software_execution_not_authorized');
    result='change_scope_reviewed_no_code_execution';break;
   case 'infrastructure':
    if(!(await host.publicHealth()).ok)throw Error('synthetic_health_unavailable');
    result='synthetic_public_health_verified';break;
   case 'consultations': {
    const decision=consultationDecision(String(input.message??''),input.consent===true,false);
    result=`draft_only_${decision.reason}`;break;
   }
   case 'followup':
    if(input.consent!==true||input.supervisionApproved!==true)throw Error('consent_and_supervision_required');
    result='opt_in_review_prepared_no_send';break;
   case 'reports': {
    const metrics=await host.metrics();
    if(Object.values(metrics).some(n=>!Number.isSafeInteger(n)||n<0))throw Error('invalid_metrics');
    result=`aggregate_report_${metrics.received}_${metrics.completed}_${metrics.blocked}`;break;
   }
  }
  const evidence=`SIMULADO:${agent}:${result}`;
  await completePersistedTask(client,task,evidence);
  return {agent,trigger,state:'completed' as const,taskId:task.task_id,evidence};
 }catch(error){
  const reason=error instanceof Error&&/^[a-z_]{3,63}$/.test(error.message)?error.message:'office_execution_failed';
  await failPersistedTask(client,task,reason);
  return {agent,trigger,state:'blocked' as const,taskId:task.task_id,reason};
 }
}

export interface OfficeStatusRecord {
 agent_id:string;status:string;attempt_count:number;created_at?:string;updated_at:string;
 lease_until:string|null;completed_evidence:string|null;
}
/** Queue observation only; readiness and activity never become a health assertion. */
export function summarizeOfficeStatus(records:readonly OfficeStatusRecord[],now:Date,partial=false){
 return SIX_AGENTS.map(a=>{
  const tasks=records.filter(t=>t.agent_id===a.id).sort((x,y)=>Date.parse(y.updated_at)-Date.parse(x.updated_at));
  const completed=tasks.filter(t=>t.status==='completed'&&Boolean(t.completed_evidence));
  const open=tasks.filter(t=>['queued','failed','blocked','running'].includes(t.status));
  const oldest=open.map(t=>Date.parse(t.created_at??t.updated_at)).filter(Number.isFinite).sort((x,y)=>x-y)[0];
  const active=tasks.filter(t=>t.status==='running'&&t.lease_until&&Date.parse(t.lease_until)>+now).length;
  const expired=tasks.some(t=>t.status==='running'&&(!t.lease_until||Date.parse(t.lease_until)<=+now));
  const blocked=tasks.filter(t=>t.status==='blocked').length;
  const lastSuccess=completed[0]?.updated_at??null;
  const observedHealth=partial?'partial':!tasks.length?'unobserved':blocked||expired?'attention_required':active?'lease_active':
   lastSuccess&&+now-Date.parse(lastSuccess)<=86_400_000?'recent_success':'stale_or_waiting';
  return {id:a.id,configuredState:a.state,trigger:a.trigger,lastActivity:tasks[0]?.updated_at??null,
   lastExecution:tasks.find(t=>t.attempt_count>0)?{status:tasks.find(t=>t.attempt_count>0)!.status,at:tasks.find(t=>t.attempt_count>0)!.updated_at}:null,lastSuccess,
   observedHealth,received:tasks.length,pending:tasks.filter(t=>['queued','failed'].includes(t.status)).length,
   running:tasks.filter(t=>t.status==='running').length,completed:completed.length,blocked,
   oldestOpenAgeSeconds:oldest===undefined?null:Math.max(0,Math.floor((+now-oldest)/1000)),
   retriedTasks:tasks.filter(t=>t.attempt_count>1).length,activeLeases:active};
 });
}
