# Revisión de PR246 y evaluación de salida P1

Orden única: `ORD-P1-SUPERVISOR-ADAPTER-20261114`. Revisión del 17/11/2026, America/Montevideo. Este informe registra evidencia; no crea plan, orden o autoridad adicional.

## Estado contrastado

Main `0454ab6ea28a58c7b0d4659bd0ac3d81ba1b56fa`. PR246 abierta/draft, padre revisado `a89b70296937f8f07028da68529ab64011e5d5e9`, sin reviews ni threads humanos al inspeccionar. No autoriza fusionar. El commit que contiene este informe y la ampliación de negativos necesita CI propia, consultable en [PR246/checks](https://github.com/Victoriosas/autopilot/pull/246/checks); no hereda checks del padre.

No se encontró un defecto reproducible en el diff funcional pendiente. La hipótesis sobre separadores de línea fue refutada: el patrón actual, sin flag multiline, rechaza LF/CR/U+2028/U+2029. Se amplían los negativos con esos caracteres, NUL, espacio, slash, Unicode y vacío; se conservan los casos de comillas, delimitadores y longitud81, y el positivo de longitud80. Implementación y SQL permanecen byte-idénticas al padre revisado.

## Diez comprobaciones solicitadas

| Criterio | Evidencia y resultado |
|---|---|
| JSON como dato, transacción correcta | `LocalMissionStore.client`: BEGIN → SET LOCAL con `literal()` que escapa comillas → claim/RPC → COMMIT. El marker no sobrevive a la transacción. Conforme en lectura y SQL aislada. |
| Cuerpos SQL delimitados | El grant completo no está dentro de DO. Los operandos restantes son IDs/binding/versiones validados y objetivo canónico de dominio fijo. No SQL/comandos suministrados por executor. |
| Identidad exacta, máximo80 | Mismo alfabeto ASCII, case-sensitive y límite que `six_agent_checkpoint`; también coincide el administrador de política local. |
| Rechazo antes del claim | `createMissionClaimGuard` arroja `invalid_mission_authorization` antes de construir el cliente para todas las identidades negativas. Sin normalizar silenciosamente la identidad. |
| Sin expansión | No nuevos permisos, roles, fases ni scopes; recuperación sigue limitada a `ready_to_complete`. |
| Preservación244/245 | Sin cambios en API/taskStore/privacidad/migraciones/pruebas de244 ni implementación de revocación/recuperación de245; solo transporte/validación pendientes y evidencia de revisión. |
| Revocación tras callback | Se relee política durable después del callback; trigger SQL comprueba revisión/expiry bajo bloqueo de fila. Caso de true tras revocar y carrera observada en `pg_stat_activity` cubiertos. |
| Ejecutor anterior | El test intenta completar con el token anterior durante la lease vigente del reemplazo: rechazo; sin alterar checkpoint. |
| Recuperación autorizada | Scope explícito, nueva revisión/grant, lease naturalmente vencida, versiones exactas, intento disponible y verificador host distinto. Takeover activo y replay terminal rechazados. |
| Sin repetir efectos | Adapter de reemplazo falla si se invocan observe/execute/planner. La recuperación solo atesta/finaliza; conserva pasos y artefactos, intento2/versión5. |

## Pruebas y alcance de evidencia

Se ejecutaron 45/45 focales y `npm run verify`:575/575, cero fallos/omisiones,14 skills, tipos, builds Node/Vercel y smoke de API. La suite PostgreSQL18 desechable se repite para esta revisión y su resultado se registra en el mismo checkpoint antes de publicar. Cubre aprobación244, grants/tokens obsoletos, revisión/expiry/CAS, checkpoint intacto tras denegación, revocación concurrente, rechazo de evidencia autocertificada, atestación vinculada al contexto y recuperación terminal. El verificador compara resultado y test con un oráculo fuente fuera del worktree del executor.

No se produjo fallo RED: las nuevas entradas ya eran rechazadas por el padre. No se presenta la hipótesis descartada como vulnerabilidad. Los fallos intermitentes históricos conservados en el checkpoint no son fallos nuevos ni se ocultan mediante ampliación de timeouts.

Límite específico: la recuperación terminal protegida usa otro `LocalMissionStore` y nuevas sesiones psql, pero el controlador Node del fixture no se reinicia. La pérdida/reanudación de procesos reales está probada por el camino legacy del demo. Ambas evidencias no son equivalentes: falta una demostración específica de recuperación terminal protegida en otro proceso Node, sin reutilizar objetos/WeakMaps del anterior.

## Veredicto formal

**P1_PARTIAL.** El transporte/identidad de PR246 es técnicamente apto para revisión/autorización de integración; esta revisión técnica no es aprobación humana ni permiso de merge. No puede emitirse `P1_CLOSED_WITH_BOUNDARIES` sobre main mientras246 no esté integrada y verificada. Además, debe precisarse/probarse el reinicio protegido entre procesos señalado arriba antes del veredicto final de cierre.

| Gate del circuito P1 | Estado |
|---|---|
| Supervisor/propuesta sin permiso implícito | PROBADO en dominio sintético local |
| Identidad/objetivo/F0/versiones | PROBADO con controles positivos/negativos |
| Política durable, revisión, vencimiento y revocación | PROBADO en ledger local |
| Exclusión, leases, fencing y escritura obsoleta | PROBADO en SQL desechable |
| Efecto por operación, atestación independiente y no autocertificación | PROBADO en alcance in-process/fijo |
| Recuperación terminal sin repetir pasos | PROBADO con store nuevo; reinicio protegido en proceso Node nuevo NO MEDIDO específicamente |
| Corrección246 en main real y CI final | PENDIENTE de integración autorizada |
| Identidad remota, atomicidad filesystem/SQL, efectos inciertos/cross-host | FUERA de garantía; no se activan |

Un efecto de filesystem ya admitido puede acabar después de revocar; su escritura SQL posterior se rechaza. Credenciales administrativas del host siguen siendo autoridad confiable. No migración alojada, activación de CLI/scheduler, coste externo certificado ni heartbeat ejecutado. `cloud_ledger_adapter_not_configured` permanece intacta. P2 inactiva.

## Continuidad recuperable

Mismo [CODEX_CONTINUATION.json](CODEX_CONTINUATION.json). Primero autorizar/observar la integración246 y verificar su SHA real/CI, sin repetirla si ocurre externamente. Siguiente dependencia técnica: extender el fixture existente con un controlador Node nuevo para la recuperación terminal protegida, leyendo el checkpoint/política del mismo ledger, emitiendo permiso nuevo y reatestando artefactos sin repetir pasos ni aceptar el token antiguo. No reconstruir el runtime ni crear PR/cola/scheduler competidores. Después reevaluar las puertas P1; no iniciar P2 por anticipado.
