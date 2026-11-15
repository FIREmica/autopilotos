import test from 'node:test';
import assert from 'node:assert/strict';
import { decidePermanentObjective } from './permanentSupervisor';
const goal = { id: 'permanent-objective', priority: 1, phase: 'F0', enabled: true, missionId: 'synthetic-p0c-cloud-check' };
const observation = { missionId: goal.missionId, state: 'completed' as const, leaseActive: false, checkpointVersion: 5, evidenceVerified: true };
test('verified terminal mission only records checkpoint; no automatic replay', () => {
  assert.deepEqual(decidePermanentObjective([goal],[observation]), {goalId:goal.id,missionId:goal.missionId,action:'checkpoint',reason:'completed_verified'});
});
test('missing evidence must be verified', () => {
  assert.equal(decidePermanentObjective([goal],[{...observation,evidenceVerified:false}])?.action,'verify');
});
test('running lease never causes competing dispatch', () => {
  assert.equal(decidePermanentObjective([goal],[{...observation,state:'running',leaseActive:true}])?.action,'wait');
});
test('failed mission requires review rather than automatic resume', () => {
  assert.equal(decidePermanentObjective([goal],[{...observation,state:'failed'}])?.action,'propose_resume');
});
test('queued mission does not imply permission to execute', () => {
  assert.equal(decidePermanentObjective([goal],[{...observation,state:'queued'}])?.action,'blocked');
});
test('unknown mission is inspected, not admitted', () => {
  assert.equal(decidePermanentObjective([goal],[])?.action,'inspect');
});
test('priority is deterministic, disabled goals ignored', () => {
  const other={...goal,id:'other-goal',priority:0,enabled:false};
  assert.equal(decidePermanentObjective([other,goal],[observation])?.goalId,goal.id);
});
test('duplicate or invalid inputs fail closed', () => {
  assert.throws(()=>decidePermanentObjective([goal,goal],[]),/duplicate/);
  assert.throws(()=>decidePermanentObjective([{...goal,priority:-1}],[]),/invalid/);
  assert.throws(()=>decidePermanentObjective([goal],[observation,observation]),/invalid/);
});
