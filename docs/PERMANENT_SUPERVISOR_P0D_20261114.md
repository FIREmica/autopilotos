# P0D: Supervisor de objetivo permanente - candidato

Diagrama: objetivo permanente -> supervisor -> ejecutores -> verificador + checkpoint -> repetir.

El nuevo `permanentSupervisor.ts` decide la siguiente accion a partir de observaciones verificadas. Es una capa pura sin permisos de escritura ni ejecucion. Ordena prioridades habilitadas y produce decisiones `inspect`, `wait`, `verify`, `checkpoint`, `propose_resume` o `blocked`. Una propuesta de reanudacion no es una autorizacion. La cola, ledger, leases, fencing y ejecutores existentes conservan su autoridad.

Ocho pruebas unitarias comprueban terminal idempotente, evidencia ausente, lease activo, fallo, cola no autorizada, observacion desconocida, prioridades y entradas invalidas.

No se han creado schedulers, misiones, secretos, servicios ni envios. P0D no acredita todavia recuperacion interhost ni ejecucion autonoma desatendida; la proxima etapa requiere un adaptador de observacion y verificacion con contratos de seguridad, pruebas entre ejecutores y una revision antes de habilitar dispatch.

## P1 status adapter candidate (14/11/2026 UY)

Reuses PR234 code and tests. The new decidePermanentObjectiveForLocalStore reads at most one status through the existing LocalMissionStore.status() method and checks the expected host binding. It rejects unexpected state/queue combinations, nonboolean lease fields, invalid versions, wrong mission IDs and inconsistent checkpoint states. A completed row is sent to independent verification, not attested by status itself. A failed/retry row cannot trigger dispatch or resume. This is not an active scheduler, SQL authorization or cross-host recovery proof. It has no IO other than one read through the supplied store and does not write claims/checkpoints.

The adapter requires an explicit authorized product phase F0-F8 and refuses a goal in a different phase before reading status. Only an independently authorized caller can provide this context; phase strings are not themselves credentials.
