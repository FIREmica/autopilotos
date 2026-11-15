import { authorizedObjective } from './missionPlanner';
import { missionId, type MissionClaimGuard } from './localMissionStore';
import type { ExecutorAdapter, ExecutorContext, MissionCompletionAttestation, MissionEffectRequest, MissionLedger } from './executorAdapter';

/** Host policy data, never a supervisor decision, bearer token or executor payload. */
export interface MissionClaimAuthorization {
  id: string; revision: number; missionId: string; binding: string; phase: 'F0'; executorId: string;
  goalVersion: number; checkpointVersion: number; planVersion: number;
  objective: unknown; expiresAt: number;
}

export interface MissionEffectDecision {
  allowed: boolean;
  revision: number;
  operationId: string;
  permissions: readonly string[];
}

/** A distinct host-owned verifier; it receives persisted context, never executor output. */
export interface MissionCompletionVerifier {
  verifierId: string;
  verify(context: Readonly<ExecutorContext>): Promise<boolean>;
}

export interface MissionEffectGuard {
  readonly verifierId: string;
  beforeEffect(executor: ExecutorAdapter, context: ExecutorContext, effect: MissionEffectRequest): Promise<readonly string[]>;
  attestCompletion(context: ExecutorContext): Promise<MissionCompletionAttestation>;
  consumeAttestation(context: ExecutorContext, attestation: MissionCompletionAttestation): void;
}

/**
 * The verifier belongs to the trusted host and must consult its current policy.
 * The executor receives neither it nor SQL credentials. Identity is host-selected
 * object identity, not cryptographic authentication of a remote worker.
 * Deliberately authorizes ONE fresh synthetic claim, not resume or completion.
 */
export function createMissionClaimGuard(
  input: MissionClaimAuthorization,
  executor: ExecutorAdapter,
  verify: (grant: Readonly<MissionClaimAuthorization>) => Promise<boolean>,
): MissionClaimGuard {
  const grant=structuredClone(input);
  if (!grant || !/^[a-z][a-z0-9-]{2,79}$/.test(grant.id) || !Number.isSafeInteger(grant.revision) || grant.revision<1
    || !/^[a-f0-9]{64}$/.test(grant.binding) || grant.phase!=='F0'
    || typeof grant.executorId!=='string' || !grant.executorId || grant.executorId!==executor?.executorId
    || grant.goalVersion!==1 || grant.checkpointVersion!==0 || grant.planVersion!==0
    || !Number.isSafeInteger(grant.expiresAt) || grant.expiresAt<=Date.now() || grant.expiresAt>Date.now()+60000
    || typeof verify!=='function') throw Error('invalid_mission_authorization');
  missionId(grant.missionId); authorizedObjective(grant.objective);
  const live=async()=>{
    let accepted=false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (Date.now()>=grant.expiresAt) throw Error('expired');
      accepted=await Promise.race([verify(structuredClone(grant)),new Promise<boolean>(resolve=>{
        timer=setTimeout(()=>resolve(false),Math.max(1,grant.expiresAt-Date.now()));
      })])===true;
    } catch { /* sanitize host errors */ }
    finally { clearTimeout(timer); }
    if (!accepted || Date.now()>=grant.expiresAt || executor.executorId!==grant.executorId)
      throw Error('mission_authorization_denied');
  };
  let consumed=false;
  return {
    expected:structuredClone(grant),
    async authorizeExecutor(candidate) {
      if(candidate!==executor || candidate.executorId!==grant.executorId) throw Error('mission_executor_mismatch');
      await live();
    },
    async beforeClaim(agentId) {
      if(agentId!=='software') throw Error('mission_agent_mismatch');
      if(consumed) throw Error('mission_authorization_consumed');
      // Consume before awaiting: concurrent calls and ambiguous SQL outcomes may not replay.
      consumed=true;
      await live();
    },
  };
}

/**
 * Extends the same one-mission host grant. The policy callback is consulted for
 * every executor/write effect; an independent verifier is required for completion.
 * This is intentionally an in-process guard, not a remote identity or atomic
 * policy-revocation guarantee. The SQL ledger still fences writes and leases.
 */
export function createMissionEffectGuard(
  input: MissionClaimAuthorization,
  executor: ExecutorAdapter,
  authorize: (grant: Readonly<MissionClaimAuthorization>, context: Readonly<ExecutorContext>, effect: Readonly<MissionEffectRequest>) => Promise<MissionEffectDecision>,
  verifier: MissionCompletionVerifier,
): MissionEffectGuard {
  // Reuse the claim validator so this exported guard cannot be constructed with
  // a malformed, expired, overlong, or out-of-scope grant.
  const grant=createMissionClaimGuard(input,executor,async()=>true).expected;
  if (typeof authorize!=='function' || !verifier || typeof verifier.verifierId!=='string'
    || !/^[a-z][a-z0-9-]{2,79}$/.test(verifier.verifierId) || verifier.verifierId===grant.executorId
    || typeof verifier.verify!=='function') throw Error('invalid_mission_effect_authorization');
  const usedOperations=new Set<string>();
  const attestations=new WeakMap<object,{missionId:string;executorId:string;checkpointVersion:number;goalVersion:number;planVersion:number;objective:string;revision:number;consumed:boolean}>();
  const deny=()=>Error('mission_effect_authorization_denied');
  const scoped=(candidate:ExecutorAdapter,context:ExecutorContext,effect:MissionEffectRequest): boolean => {
    if (candidate!==executor || candidate.executorId!==grant.executorId || context.executorId!==grant.executorId
      || context.mission.missionId!==grant.missionId || context.mission.goalVersion!==grant.goalVersion
      || !Number.isSafeInteger(context.checkpointVersion) || context.checkpointVersion<grant.checkpointVersion
      || !Number.isSafeInteger(context.mission.planVersion) || context.mission.planVersion<grant.planVersion
      || JSON.stringify(authorizedObjective(context.mission.objective))!==JSON.stringify(authorizedObjective(grant.objective))
      || !effect || !['execute_step','write_checkpoint','save_plan','block','fail','attest_completion','complete_write'].includes(effect.kind)
      || typeof effect.operationId!=='string' || effect.operationId.length>200
      || !/^[a-zA-Z0-9._:-]{3,200}$/.test(effect.operationId)
      || (effect.kind==='execute_step' && (typeof effect.stepId!=='string' || !context.mission.plan.some(step=>step.id===effect.stepId)))) return false;
    return true;
  };
  const beforeEffect=async(candidate:ExecutorAdapter,context:ExecutorContext,effect:MissionEffectRequest):Promise<readonly string[]>=>{
    let inScope=false;
    try { inScope=scoped(candidate,context,effect); } catch { /* malformed context is denied */ }
    if (!inScope || Date.now()>=grant.expiresAt || usedOperations.has(effect.operationId)) throw deny();
    // Consume before awaiting so uncertain decisions/effects cannot replay.
    usedOperations.add(effect.operationId);
    let timer:ReturnType<typeof setTimeout>|undefined;
    let decision:MissionEffectDecision|undefined;
    try {
      decision=await Promise.race([authorize(structuredClone(grant),structuredClone(context),structuredClone(effect)),new Promise<undefined>(resolve=>{
        timer=setTimeout(()=>resolve(undefined),Math.max(1,grant.expiresAt-Date.now()));
      })]);
    } catch { /* sanitize host details */ }
    finally { clearTimeout(timer); }
    if (!decision || decision.allowed!==true || decision.revision!==grant.revision
      || decision.operationId!==effect.operationId || Date.now()>=grant.expiresAt
      || executor.executorId!==grant.executorId || !Array.isArray(decision.permissions)
      || decision.permissions.some(permission=>permission!=='synthetic_worktree')
      || (effect.kind==='execute_step' && (decision.permissions.length!==1
        || !authorizedObjective(context.mission.objective).resources.includes('synthetic_worktree')
        || !authorizedObjective(context.mission.objective).restrictions.includes('local_synthetic_only')
        || !authorizedObjective(context.mission.objective).restrictions.includes('no_network')
        || !authorizedObjective(context.mission.objective).restrictions.includes('no_send')))
      || (effect.kind!=='execute_step' && decision.permissions.length!==0)) throw deny();
    return [...decision.permissions];
  };
  return {
    verifierId:verifier.verifierId,
    beforeEffect,
    async attestCompletion(context) {
      let valid=false;
      try {
        const planIds=context.mission.plan.map(step=>step.id);
        const completed=context.checkpoint.completed_steps;
        const resultIds=context.checkpoint.results.map(result=>result.step_id);
        valid=context.mission.missionId===grant.missionId && context.executorId===grant.executorId
          && context.mission.goalVersion===grant.goalVersion && context.checkpointVersion>=grant.checkpointVersion
          && JSON.stringify(authorizedObjective(context.mission.objective))===JSON.stringify(authorizedObjective(grant.objective))
          && context.checkpoint.mission_state==='ready_to_complete' && context.checkpoint.current_step_id==null
          && context.checkpoint.pending_steps.length===0 && planIds.length>0
          && completed.length===planIds.length && new Set(completed).size===completed.length
          && planIds.every(id=>completed.includes(id)) && resultIds.length===completed.length
          && new Set(resultIds).size===resultIds.length && completed.every(id=>resultIds.includes(id))
          && context.checkpoint.results.every(result=>result.status==='passed')
          && context.checkpoint.test_evidence.length>=completed.length;
      } catch { /* malformed persisted context is denied */ }
      if (!valid) throw Error('mission_completion_unverified');
      let accepted=false;
      let timer:ReturnType<typeof setTimeout>|undefined;
      try {
        if (Date.now()>=grant.expiresAt) throw Error('expired');
        accepted=await Promise.race([verifier.verify(structuredClone(context)),new Promise<boolean>(resolve=>{
          timer=setTimeout(()=>resolve(false),Math.max(1,grant.expiresAt-Date.now()));
        })])===true;
      } catch { /* sanitize verifier details */ }
      finally { clearTimeout(timer); }
      if (!accepted || Date.now()>=grant.expiresAt) throw Error('mission_completion_unverified');
      const token=Object.freeze({});
      attestations.set(token,{missionId:context.mission.missionId,executorId:context.executorId,
        checkpointVersion:context.checkpointVersion,goalVersion:context.mission.goalVersion,planVersion:context.mission.planVersion,
        objective:JSON.stringify(authorizedObjective(context.mission.objective)),revision:grant.revision,consumed:false});
      return token;
    },
    consumeAttestation(context,token) {
      const value=attestations.get(token as object);
      if (!value || value.consumed || value.missionId!==context.mission.missionId
        || value.executorId!==context.executorId || value.checkpointVersion!==context.checkpointVersion
        || value.goalVersion!==context.mission.goalVersion || value.planVersion!==context.mission.planVersion
        || value.objective!==JSON.stringify(authorizedObjective(context.mission.objective))
        || value.revision!==grant.revision) throw Error('mission_completion_attestation_required');
      // Consume before SQL to prevent replay after an ambiguous completion result.
      value.consumed=true;
    },
  };
}

/** Wrap the existing ledger without introducing a second queue or storage authority. */
export function createAuthorizedMissionLedger(
  base: MissionLedger, executor: ExecutorAdapter, grant: MissionClaimAuthorization,
  guard: MissionEffectGuard, verifierId: string,
): MissionLedger {
  const scopedGrant=createMissionClaimGuard(grant,executor,async()=>true).expected;
  if (verifierId!==guard.verifierId) throw Error('mission_completion_verifier_mismatch');
  const authorize=(context:ExecutorContext,kind:MissionEffectRequest['kind'],operationId:string,stepId?:string)=>
    guard.beforeEffect(executor,context,{kind,operationId,...(stepId?{stepId}:{})});
  return {
    authorizeExecutor:candidate=>{
      if(candidate!==executor) throw Error('mission_executor_mismatch');
      return Promise.resolve();
    },
    authorizeEffect:(candidate,context,effect)=>guard.beforeEffect(candidate,context,effect),
    attestCompletion:async(candidate,context)=>{
      if(candidate!==executor) throw Error('mission_executor_mismatch');
      await authorize(context,'attest_completion',`ledger:attest:${scopedGrant.id}:${context.mission.missionId}:${context.checkpointVersion}`);
      return guard.attestCompletion(context);
    },
    claimMission:agent=>base.claimMission(agent),
    saveCheckpoint:async(context,operationId,checkpoint)=>{
      await authorize(context,'write_checkpoint',`ledger:${operationId}`);
      return base.saveCheckpoint(context,operationId,checkpoint);
    },
    savePlan:async(context,proposal,plannerId)=>{
      await authorize(context,'save_plan',`ledger:plan:${scopedGrant.id}:${context.mission.missionId}:${proposal.version}`);
      if(!base.savePlan) throw Error('planning_ledger_required');
      return base.savePlan(context,proposal,plannerId);
    },
    blockMission:async(context,reason)=>{
      await authorize(context,'block',`ledger:block:${scopedGrant.id}:${context.mission.missionId}:${context.checkpointVersion}:${reason}`);
      if(!base.blockMission) throw Error('planning_ledger_required');
      return base.blockMission(context,reason);
    },
    failMission:async(context,reason)=>{
      await authorize(context,'fail',`ledger:fail:${scopedGrant.id}:${context.mission.missionId}:${context.checkpointVersion}:${reason}`);
      return base.failMission(context,reason);
    },
    completeMission:async(context,_evidence,attestation)=>{
      if(!attestation) throw Error('mission_completion_attestation_required');
      guard.consumeAttestation(context,attestation);
      await authorize(context,'complete_write',`ledger:complete:${scopedGrant.id}:${context.mission.missionId}:${context.checkpointVersion}`);
      return base.completeMission(context,
        `independent:${verifierId}:${scopedGrant.id}:${scopedGrant.revision}:${context.checkpointVersion}`);
    },
  };
}
