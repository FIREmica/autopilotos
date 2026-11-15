# P0D: Supervisor de objetivo permanente - candidato

Diagrama: objetivo permanente -> supervisor -> ejecutores -> verificador + checkpoint -> repetir.

El nuevo `permanentSupervisor.ts` decide la siguiente accion a partir de observaciones verificadas. Es una capa pura sin permisos de escritura ni ejecucion. Ordena prioridades habilitadas y produce decisiones `inspect`, `wait`, `verify`, `checkpoint`, `propose_resume` o `blocked`. Una propuesta de reanudacion no es una autorizacion. La cola, ledger, leases, fencing y ejecutores existentes conservan su autoridad.

Ocho pruebas unitarias comprueban terminal idempotente, evidencia ausente, lease activo, fallo, cola no autorizada, observacion desconocida, prioridades y entradas invalidas.

No se han creado schedulers, misiones, secretos, servicios ni envios. P0D no acredita todavia recuperacion interhost ni ejecucion autonoma desatendida; la proxima etapa requiere un adaptador de observacion y verificacion con contratos de seguridad, pruebas entre ejecutores y una revision antes de habilitar dispatch.
