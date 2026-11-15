# Plan maestro lineal de Victoriosas Autopilot

Referencia: 14/11/2026, America/Montevideo. Este es el plan técnico canónico para nuevas órdenes. La visión, las fases de producto F0–F8 y sus autorizaciones siguen en [PROJECT_DIRECTION.md](PROJECT_DIRECTION.md). Los P0–P6 de este plan son etapas técnicas de una sola cadena; no autorizan saltar F1→F2→F3→F4 ni abrir un programa paralelo.

**Única fase técnica activa: P0.** Estado operativo recuperable: [CODEX_CONTINUATION.json](CODEX_CONTINUATION.json). Prompt de entrada: [CODEX_LINEAR_CONTINUATION_PROMPT.md](CODEX_LINEAR_CONTINUATION_PROMPT.md). Evidencia de base: [auditoría del 14/11](audits/AUTOPILOT_FORENSIC_AUDIT_20261114.md) y [manifiesto](audits/AUTOPILOT_RESOURCE_MANIFEST_20261114.json). Las fases posteriores están definidas, no activadas.

## Autoridad y avance

Propietario fija políticas y permisos; Victoria valida hechos profesionales; Autopilot propone y coordina dentro de ellos; Codex ejecuta; el verificador comprueba; SQL ledger conserva claims/efectos y el JSON conserva una orden técnica. No crear otra cola, ledger, scheduler, supervisor equivalente o infraestructura para eludir un bloqueo.

Solo avanzar una fase mediante evidencia de sus criterios y actualización revisada del mismo JSON. Un checkbox, una definición de agente, CI verde o una misión sintética no son cierre operativo. Diferenciar por subsistema DEFINIDO / IMPLEMENTADO / PROBADO / FUSIONADO / DESPLEGADO / EJECUTADO / BLOQUEADO. Conservar SHA, entorno, fecha, alcance y límites de cada prueba.

Una eliminación opcional no bloquea el producto por sí misma: puede cerrarse como CONSERVAR con razón, propietario y recuperación. Una duplicación con riesgo de escritura o autorización sí bloquea hasta resolverla. No forzar una reducción de carpetas ni usar un plan nuevo como prueba de progreso.

## P0 · Reconciliación y limpieza — ACTIVA

**Objetivo verificable:** una base de verdad trazable, recursos preservados, una fuente de estado y cero escritores conflictivos en el ámbito del siguiente cambio.

**Dependencias:** acceso de lectura GitHub/PC/cloud; inventario fechado; autorizaciones específicas separadas para borrar o modificar servicios. La auditoría no concede ninguna.

**Reutilizar:** AGENTS, PROJECT_DIRECTION, CODEX_CONTINUATION.json, auditoría/manifiesto, CI/main `a4ca9dd31afa6f576d0bd5e52bc83ffb72e9272c`, PR existentes y backups existentes sin asumir restaurabilidad.

**Evidencia nueva ya obtenida:** las 24 fuentes locales de `cloud-ledger-adapter-20261112` y `autonomy-continuity-20261112` se compararon: ocho idénticas a main tras normalizar CRLF, trece idénticas a versiones anteriores de main y tres con una línea final vacía adicional. Ninguna exige reintegrar código. [Reconciliación](audits/evidence-20261114/local-cloud-reconciliation.json); conservar ambos árboles sin reset/clean.

**Orden local ya ejecutada:** `alignment-audit-20261105` y `diseno` tienen procedencia/custodia de proyecto identificada, búsqueda de consumidores y preservación cifrada con recuperación en memoria de745/405 archivos verificada por un proceso nuevo. Historias Git completas cifradas y validación strict dry-run; ningún original modificado. Ignorados, autoría humana y recuperación offsite no certificados: ambos CONSERVAR, sin propuesta de eliminación. [Veredicto P0](audits/P0_RECONCILIATION_REVIEW_20261114.md).

**Gates actuales de revisión:** validar y revisar la minimización de inventarios, aceptar explícitamente el límite de metadatos ya publicados en commits históricos y decidir sobre la [alineación preparada del heartbeat](P0_HEARTBEAT_ALIGNMENT_PREPARATION_20261114.md), cuyo contrato ya se integró en main por una fusión externa de #235. La automatización no se modificó. Durante la orden se observaron cierres externos de las17 PR inicialmente abiertas, incluida #234: heads conservados localmente y en un pack cifrado,16 ramas remotas aún presentes; la rama Dependabot no aparece. **Decisión explícita del propietario ya registrada:** registrar los cierres y conservar las ramas/heads disponibles; no reabrir PR ni recrear la rama remota ausente por esta decisión. No repetir las reconciliaciones anteriores si los hashes siguen intactos ni abrir un segundo supervisor.

**Retiradas futuras, fuera de esta orden:** mantener como CONSERVAR los recursos de propietario/consumidor incierto. Antes de una eliminación expresamente autorizada, clasificar también ignorados y verificar una recuperación acorde al fallo que se pretende tolerar; la prueba DPAPI en esta máquina no certifica recuperación ante pérdida de perfil/equipo. No borrar exportaciones sin Git, refs, caches compartidas o worktrees por falta de uso observado.

**Pruebas obligatorias:** status y SHA por checkout; diff de trabajo indexado/no indexado y hashes selectivos sin secretos; comparación funcional y de patches, no solo ascendencia; relectura independiente del JSON y resolución de sus referencias; enlaces/JSON/diffcheck/secret scan para esta consolidación. Si hay cambio de aplicación posterior, verify y validate/postgres del SHA exacto. No repetir pruebas del código intacto sin motivo.

**Riesgos:** escritores sin cwd conocido; estados cambiantes; backups con secretos; ramas squash sin ascendencia; borrar fixtures/evidencia exclusiva; confundir repo marketplace con autopilot.

**Aceptación:** recursos conocidos conservados/clasificados y desconocidos explícitamente retenidos; tareas activas y límites registrados; propuesta agrupada de eliminación recuperable, o decisión de conservar; ningún ámbito compartido modificado; una sola orden en JSON; esta PR documental revisada con CI exacta; siguiente cambio asignado al componente existente.

**Rollback:** revertir solo esta propuesta documental por PR; conservar árbol ajeno, refs y bases cloud. No limpiar metadatos prunable por iniciativa propia.

**Evidencia de cierre:** informe de consolidación actualizado, SHA/PR/CI exactos y decisión trazable sobre los cambios exclusivos. Actualmente PREPARADO, no cerrado: consumidores/recuperación de recursos locales aún incompletos.

## P1 · Consolidación del núcleo Autopilot — DEFINIDA

**Objetivo:** una decisión del supervisor se traduce en una observación y propuesta coherentes con el runtime y el ledger existentes, sin otorgar permisos implícitos.

**Dependencias:** P0 cerrada; revisión de #234 y main actual. No fusionar #234 solo por tener ocho pruebas verdes.

**Reutilizar:** permanentSupervisor de #234; missionRuntime, executorAdapter, missionPlanner, sixAgentPersistence, LocalMissionStore y CloudMissionStore. Retener DevelopmentLedger únicamente para su laboratorio acotado.

**Cambios mínimos:** validar entradas externas al supervisor en runtime; mapear estados de tarea/checkpoint/lease explícitamente; ligar observación a ID, binding, versión, fase y evidencia verificable. Resolver la observación de state inesperado y running sin lease sin crear otro reconciliador. Mantener propuesta de resume separada de permiso de ejecutar. Describir el adaptador de observación antes de habilitar cualquier efecto.

**Pruebas:** entradas desconocidas/booleanos falsificados, estado blocked/retry_wait/ready_to_complete, lease activa/expirada, versión antigua, prioridades y fase no autorizada, misión terminal, evidencia ausente; casos de componente y SQL aislado. Ningún estado desconocido puede producir dispatch. Verify y CI por SHA.

**Riesgos:** divergencia entre vocabularios de estados; aprobación autodeclarada; starvation por prioridad; doble claim; ampliar el objetivo sintético a comandos arbitrarios.

**Aceptación:** componente único montado en el ámbito revisado, contrato negativo completo, claim SQL sigue siendo autoridad y no hay segundo scheduler/ledger. IMPLEMENTADO y PROBADO no equivalen a activación remota.

**Rollback:** revertir adaptador/PR; dejar observación sin efectos y cola conservada.

**Cierre:** diff/revisión/CI y evidencia del mismo contrato en supervisor→runtime→ledger, sin efectos externos no autorizados.

## P2 · Recuperación y verificación independiente — DEFINIDA

**Objetivo:** interrupción y reanudación conservan checkpoint, rechazan escritor obsoleto y no repiten efectos aceptados.

**Dependencias:** P1 y exclusión del ámbito; almacenamiento del efecto definido, presupuesto y cancelación. No inferir recuperación Windows de pruebas Linux.

**Reutilizar:** tests mission-runner/operator/planner/cloud-ledger en `tests/`, fixtures TLS, managedProcesses, fencing SQL, VerificationEngine/oráculos externos, cadena ORD-204G #213→#220→#222/#223 solo tras reconciliar sus conflictos.

**Cambios mínimos:** seleccionar un efecto sintético reproducible y matar el proceso en cada frontera crítica; reconciliar artefacto existente y respuesta incierta antes de repetir. Acotar la integración Windows al mismo runtime, no convertir gestores de ventanas o viki en otro director.

**Pruebas:** antes/después de claim, efecto aplicado sin checkpoint, checkpoint sin cierre, lease expirada, token viejo, reinicio del host, deadline, descendientes, cancelación y resultados falsificados; oráculo fuera del área escribible del executor. Regresión SQL real desechable, verify y CI.

**Riesgos:** exactly-once supuesto por contar ejecuciones, pérdida de artefacto efímero, confundir atomicidad SQL con atomicidad de filesystem, repetir acción de resultado desconocido.

**Aceptación:** recuperación observable sin duplicar efecto; token antiguo denegado; fallo de verificación bloquea cierre; evidencia ajena al candidato y presupuestos respetados. Windows y cloud se acreditan separadamente.

**Rollback:** detener solo procesos propios identificados; mantener ledger/checkpoint/evidencias, no readmitir misión terminal ni resetear intentos.

**Cierre:** IDs/run/SHA, cronología de interrupción y hashes del efecto antes/después, negativos y limitaciones.

## P3 · Continuidad cloud — DEFINIDA

**Objetivo:** la misma cadena puede reanudarse en hosts cloud con estado y efectos recuperables bajo controles vigentes.

**Dependencias:** P2; autorización específica para una prueba remota concreta, revisión del SHA/environment y coste total. El permiso excepcional de 43657434746 caducó con ese run.

**Reutilizar:** PLAN Cloud existente, CloudMissionStore y ledger aislado `juyowvmtluxfetgkckjd`; no tocar principal `jfjzpwlrhzqbcrvqxhzf`. P0C ya resolvió transporte y hosted-status; no repetir bootstrap/rotación/admisión.

**Cambios mínimos:** resolver persistencia/recuperación del efecto entre runners con recursos existentes y un contrato explícito. Mantener handoff automático cerrado hasta demostrarlo. Actualizar el diagnóstico fijo `cloud_ledger_adapter_not_configured` en una propuesta revisada cuando corresponda, sin desactivar el bloqueo para pintar CI verde. Separar diagnóstico de activación.

**Pruebas:** dos hosts reales autorizados con interrupción y mismo binding, efectos disponibles y reconciliados, identidad/CA/verify-full/backendTLS, runner mínimo, sin membresías ni admisión, fencing/checkpoint y terminal sin nuevas escrituras. Ambiente protegido y SHA revisado exacto. Si no hay permiso, preparar ensayo y registrar BLOQUEADO; no despachar.

**Riesgos:** modelo/API no gratuitos, artefactos efímeros, secret en código de PR, workflow_run privilegiado, bypass humano reutilizado, principal confundido con ledger.

**Aceptación:** ejecución originada y recuperada entre hosts demostrada; métricas/run/errores y mecanismo de activación documentados; no basta hosted-status ni un workflow configurado. Continuidad desatendida necesita autorización propia y evidencia de runtime; no prometer24/7.

**Rollback:** retirar autorización de dispatch/SHA bajo permiso; parar trabajo propio, preservar ledger, no rebajar TLS/RLS ni borrar datos.

**Cierre:** run IDs, SHA, controles, coste observado y recuperación del efecto. Estado actual: transporte PROBADO históricamente; continuidad de efectos NO COMPROBADA.

## P4 · Autodesarrollo mediante Codex — DEFINIDA

**Objetivo:** Autopilot deriva una tarea acotada, Codex prepara diff aislado y un verificador independiente decide aceptación.

**Dependencias:** P3; contrato de ejecutor Codex autenticado/autorizado y coste/cuota comprobados; política de archivos/comandos y parada.

**Reutilizar:** ExecutorAdapter, developmentAccess, managedProcesses, readinessDevelopment, selfDevelopment, CLI/skill coordinadora y flujo PR existente. Los laboratorios actuales no son integración Codex general.

**Cambios mínimos:** añadir capacidad al adaptador existente con ruta de trabajo, permiso, objetivo, presupuesto, timeout y salida estructurada fijados por host; candidato sin acceso a secretos, autorización ni oráculo. Una PR por misión, reanudación por ID y diff existente. No arrancar OpenCode como director ni duplicar plataforma.

**Pruebas:** tarea sintética/real reversible revisada; diff fuera de allowlist rechazado; dependencia o test falsificado; cuota/deadline; pérdida de proceso; PR ya creada; resultado incierto; ausencia de permiso; regresiones de app/SQL según alcance y CI exacta. No ejecución de scripts arbitrarios de una rama con secretos.

**Riesgos:** prompt injection desde issue/documento; tests autocertificados; fuga de credenciales; coste no medido; dos escritores; merge o deploy implícito.

**Aceptación:** una tarea del mismo plan produce propuesta verificable con permisos mínimos, revisión y checkpoint recuperables; cero cambios ajenos y sin merge/envíos/deploy por autonomía genérica.

**Rollback:** cancelar ejecutor y conservar diff/PR en borrador; revertir solo la integración revisada, no el trabajo ajeno.

**Cierre:** objetivo, diff, IDs, resultado del verificador, pruebas, presupuesto/coste observado, PR y siguiente misión de la misma fase.

## P5 · Integración de capacidades Victoriosas — DEFINIDA

**Objetivo:** reutilizar el circuito visita→consentimiento→expediente→conocimiento→borrador→Guardián→revisión humana→respuesta auditada, según puertas F1–F4.

**Dependencias:** P4 y puertas del producto revalidadas. Hoy hay17 fichas vigentes con aprobación registrada, pero no evaluación semántica nueva ni tarifa aprobada. No deducir F3/F4 autónomas de esos metadatos.

**Reutilizar:** consultationRouter/Request/Supabase, outboxes, knowledge/versiones, groundedComposer/Guardian, materialStore y bandeja. Reconciliar #229 sobre #225–#227, no duplicar material ni autorizaciones. Resend existente y WhatsApp solo por canales/permisos vigentes.

**Cambios mínimos:** resolver el primer recorrido incompleto de F1, después F2, F3 y F4, usando la misma cadena de misión; integrar UI material si sigue siendo necesaria; alinear migraciones staged con historia alojada únicamente bajo autorización específica.

**Pruebas:** móvil/escritorio, auth401/403/503, origen/abuso/consentimiento/retención, RLS, idempotencia/replay, fuente vigente, Guárdian negativo, no_send y aprobación ligada al caso; 40 casos congelados+6 negativos para certificación de modelo; canario real y recepción humana solo con permiso concreto. No modificar corpus para aprobar.

**Riesgos:** PII a proveedor, diagnósticos/precios/agenda inventados, consentimiento confundido, aprobación de otro caso, doble envío, aceptación proveedor confundida con recepción.

**Aceptación:** evidencia end-to-end autorizada del circuito y puertas profesionales cumplidas, entrega/recepción diferenciadas y fallo seguro. Niveles N0–N4 conservan su aprobación; ecommerce y campañas no se reactivan.

**Rollback:** apagar únicamente la capacidad revisada según autorización, preservar expediente/outbox/auditoría y revisar entregas inciertas antes de reintentar.

**Cierre:** evidencia saneada por caso, SHA de app/DB/entorno, consentimiento/aprobación y límites de canal, sin datos personales en Git.

## P6 · Validación integral y preparación operativa — DEFINIDA

**Objetivo:** operación observable, recuperable y autorizada que cumpla las puertas de producto aplicables y reduzca carga humana de forma comprobable.

**Dependencias:** P5; política de operación, responsables, costes/límites, alertas, rollback y aprobación de publicación concreta. F6–F8 no se activan por este plan.

**Reutilizar:** CI, monitores existentes, ledger, métricas saneadas, checkpoints, bandeja y runbooks. No crear monitor o cadencia equivalente.

**Cambios mínimos:** cerrar huecos medidos de observabilidad, acceso y recuperación; definir responsables para incidentes y cancelación; preparar release revisable sin deploy manual ni auto-merge.

**Pruebas:** verify+SQL+seguridad por SHA, navegador y acceso real por entorno, recuperación/cancelación y no duplicación, coste/retención, escenarios adversos y recorrido humano controlado. Confirmar Vercel/main por SHA por separado. Smoke público no sustituye E2E ni disponibilidad universal.

**Riesgos:** declarar éxito por documentación/CI, monitor sin runtime, alertas sin consumidor, permisos excesivos, costes de infraestructura omitidos.

**Aceptación:** criterios de producto cumplidos y firmados cuando corresponda; runs y fallos observables; continuidad e incidentes ensayados; destinatario humano confirmado; límites y coste total conocidos. Despliegue solo específicamente autorizado.

**Rollback:** desactivar la capacidad nueva con ruta revisada, conservar datos y evidencias; nunca desproteger, resetear ledger ni perder historial.

**Cierre:** acta operativa con versiones, permisos, responsables, pruebas, riesgos residuales, coste y decisión humana. Solo entonces evaluar el siguiente objetivo dentro de PROJECT_DIRECTION.
