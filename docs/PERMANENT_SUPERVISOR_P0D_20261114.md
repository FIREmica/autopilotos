# P0D: Supervisor de objetivo permanente - candidato

Diagrama: objetivo permanente -> supervisor -> ejecutores -> verificador + checkpoint -> repetir.

El nuevo `permanentSupervisor.ts` decide la siguiente accion a partir de observaciones verificadas. Es una capa pura sin permisos de escritura ni ejecucion. Ordena prioridades habilitadas y produce decisiones `inspect`, `wait`, `verify`, `checkpoint`, `propose_resume` o `blocked`. Una propuesta de reanudacion no es una autorizacion. La cola, ledger, leases, fencing y ejecutores existentes conservan su autoridad.

Las ocho pruebas unitarias originales de P0D comprueban terminal idempotente, evidencia ausente, lease activo, fallo, cola no autorizada, observacion desconocida, prioridades y entradas invalidas. La suite del candidato P1 añade pruebas del adaptador y regresiones de las fronteras de entrada; el resultado actual se registra en la continuidad.

No se han creado schedulers, misiones, secretos, servicios ni envios. P0D no acredita todavia recuperacion interhost ni ejecucion autonoma desatendida; la proxima etapa requiere un adaptador de observacion y verificacion con contratos de seguridad, pruebas entre ejecutores y una revision antes de habilitar dispatch.

## P1 status adapter candidate (14/11/2026 UY)

Reuses PR234 code and tests. The new decidePermanentObjectiveForLocalStore reads at most one status through the existing LocalMissionStore.status() method and checks the expected host binding. It rejects unexpected state/queue combinations, nonboolean lease fields, invalid versions, wrong mission IDs and inconsistent checkpoint states. A completed row is sent to independent verification, not attested by status itself. A failed/retry row cannot trigger dispatch or resume. This is not an active scheduler, SQL authorization or cross-host recovery proof. It has no IO other than one read through the supplied store and does not write claims/checkpoints.

The adapter requires an explicit authorized product phase F0-F8 and refuses a goal in a different phase before reading status. Only an independently authorized caller can provide this context; phase strings are not themselves credentials.

## Corrección de revisión · 15/11/2026

`SupervisorGoal.enabled` exige un booleano primitivo antes de seleccionar objetivo. Una cadena como `"false"`, números, null, undefined, arrays, objetos o Boolean encapsulado se rechazan; `false` real deshabilita el objetivo sin leer el store. Solo `true` real permite continuar la decisión existente. No cambia permisos de claim, resume ni dispatch.

Las dos regresiones nuevas fallaron antes de la corrección y pasan después. La función pura y la frontera host-bound se prueban por separado, incluyendo cero lecturas para flags inválidos/deshabilitados. Esto corrige la entrada, no completa la integración operativa: supervisor→PersistentMissionOrchestrator→ledger/claim SQL y verificación independiente siguen pendientes de P1 en la misma secuencia.
