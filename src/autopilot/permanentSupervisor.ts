/**
 * Permanent-objective supervisor: deterministic, read-only decision layer.
 * The existing mission ledger remains the sole authority for claims and effects.
 * No scheduling, network calls, dispatch or implicit authorization.
 */
export type SupervisorGoal = Readonly<{
  id: string;
  priority: number;
  phase: string;
  enabled: boolean;
  missionId: string;
}>;
export type SupervisorObservation = Readonly<{
  missionId: string;
  state: 'unknown' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  leaseActive: boolean;
  checkpointVersion: number;
  evidenceVerified: boolean;
}>;
export type SupervisorDecision = Readonly<{
  goalId: string;
  missionId: string;
  action: 'inspect' | 'wait' | 'verify' | 'checkpoint' | 'propose_resume' | 'blocked';
  reason: string;
}>;

const validId = (id: string) => /^[a-z][a-z0-9-]{2,79}$/.test(id);
export function decidePermanentObjective(
  goals: readonly SupervisorGoal[],
  observations: readonly SupervisorObservation[],
): SupervisorDecision | null {
  if (goals.length > 100 || observations.length > 100) throw Error('supervisor_budget_exceeded');
  const seen = new Set<string>();
  for (const goal of goals) {
    if (!validId(goal.id) || !validId(goal.missionId) || !Number.isSafeInteger(goal.priority) || goal.priority < 0 || goal.priority > 1000 || !goal.phase)
      throw Error('invalid_supervisor_goal');
    if (seen.has(goal.id)) throw Error('duplicate_supervisor_goal');
    seen.add(goal.id);
  }
  const missions = new Map<string, SupervisorObservation>();
  for (const observation of observations) {
    if (!validId(observation.missionId) || missions.has(observation.missionId) || !Number.isSafeInteger(observation.checkpointVersion) || observation.checkpointVersion < 0)
      throw Error('invalid_supervisor_observation');
    missions.set(observation.missionId, observation);
  }
  const goal = [...goals].filter(g => g.enabled).sort((a,b) => a.priority-b.priority || a.id.localeCompare(b.id))[0];
  if (!goal) return null;
  const obs = missions.get(goal.missionId);
  const decision = (action: SupervisorDecision['action'], reason: string): SupervisorDecision =>
    ({ goalId: goal.id, missionId: goal.missionId, action, reason });
  if (!obs || obs.state === 'unknown') return decision('inspect', 'mission_state_unverified');
  if (obs.state === 'completed') return obs.evidenceVerified ? decision('checkpoint', 'completed_verified') : decision('verify', 'completion_evidence_missing');
  if (obs.state === 'running') return decision('wait', obs.leaseActive ? 'active_owner' : 'running_state_requires_reconciliation');
  if (obs.state === 'queued') return decision('blocked', 'admission_does_not_authorize_dispatch');
  if (obs.state === 'cancelled') return decision('blocked', 'cancelled_requires_new_authorization');
  return obs.leaseActive ? decision('wait', 'lease_still_active') : decision('propose_resume', 'failed_unleased_requires_review');
}
