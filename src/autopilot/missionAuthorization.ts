import { authorizedObjective } from './missionPlanner';
import { missionId, type MissionClaimGuard } from './localMissionStore';
import type { ExecutorAdapter } from './executorAdapter';

/** Host policy data, never a supervisor decision, bearer token or executor payload. */
export interface MissionClaimAuthorization {
  id: string; revision: number; missionId: string; binding: string; phase: 'F0'; executorId: string;
  goalVersion: number; checkpointVersion: number; planVersion: number;
  objective: unknown; expiresAt: number;
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
