# P2 · Espera cancelable del claim de recuperación

Fecha: 17/11/2026, America/Montevideo. Misma orden
`ORD-P2-RECOVERY-VERIFICATION-20261117`, producto F0 y P2 parcial.

## Contrato y titularidad

Base remota verificada: `d9a07f93ccca3e4be01c428874c8111a2e62edfe`,
con PR #250 fusionada. Su head `b97e27e150a1a3eb6c8c37e139143019b09e7fc2`
tiene validate/postgres/CodeQL aprobados; el workflow principal de main también
terminó success. PLAN Cloud conserva failure y no se modifica.

Un solo escritor de esta candidata, rama `codex/p2-claim-cancellation-bound-20261117`.
Superficie: `missionRuntime.ts`, una nueva regresión unitaria y esta evidencia/
checkpoint. Se observaron cambios ajenos en las pruebas nativas de cancelación
del worktree existente: se conservaron sin editar, ejecutar ni incorporar.
Esta corrección pertenece al mismo frente P2 y no reemplaza esa prueba nativa.

Problema reproducible: `runMission` esperaba directamente `claimMission`.
El claim protegido puede esperar al oráculo independiente después de SQL;
una señal abortada o el deadline del runtime no liberaban esa espera.

Aceptación: el runtime rechaza con la razón original al cancelar, o con
`TimeoutError` al vencer su plazo, aunque el claim siga pendiente. Si después
llega un contexto, no ejecuta, guarda checkpoint, falla ni completa la misión.
Mantener guardas de SQL, permisos, leases y presupuestos existentes.

Permisos: desarrollo local sintético, publicación de rama/PR y CI.
Sin proveedor nuevo ni gasto externo contratado; Codex consume cuota del host,
sin medidor de coste por misión disponible. Se conserva el deadline existente;
solo las regresiones usan 20 ms y un watchdog de 1 s.
Rollback: revertir únicamente el cambio y su regresión. Detener escrituras si
cambia la titularidad/base o aparece un resultado incierto no conciliable.

## Cambio y evidencia

Se reutiliza `bounded` para esperar `claimMission`, igual que otros callbacks
del runtime. La comprobación posterior de señal permanece.

RED: las dos regresiones fallaron porque el runtime seguía esperando después
de la cancelación y del deadline. GREEN: 43/43 pruebas focales de runtime,
autorización y nuevo archivo. La verificación completa se registra en el
checkpoint de esta candidata y en la PR por su SHA exacto.

Las regresiones liberan el claim en `finally` y comprueban que su contexto
tardío no provoque efectos. Son pruebas de componente con ledger simulado;
no prueban cancelación de SQL, descendientes ni recuperación entre procesos.

## Límites y siguiente caso

Cancelar la espera no revierte un claim aceptado, no detiene por sí solo el
oráculo subyacente ni modifica política durable, attempts o lease. Cualquier
resultado SQL incierto se concilia con el ledger; no se repite automáticamente.

La revisión auxiliar en lectura detectó otro caso pendiente: cancelar durante
la segunda autorización dentro de `createAuthorizedMissionLedger.completeMission`
puede permitir que el wrapper invoque el write base después del aborto.
Reproducción con runtime/wrapper reales y ledger simulado, sin SQL:
`abort_during_ledger_policy → BASE_COMPLETION_WRITE_AFTER_ABORT_true → RUNTIME_RESOLVED`.
Envolver la espera exterior no impediría esa escritura interna. La siguiente
corrección debe propagar la señal hasta la frontera de escritura y comprobarla
después de la autorización, con regresión RED/GREEN; conservar la distinción
entre cancelar antes de admitir SQL y una escritura ya admitida.

No se declara cierre P2, cancelación integral, parada del oráculo, atomicidad
filesystem/SQL, despliegue, SQL alojado, envíos, Windows/cross-host ni operación
permanente. Automatización existente consultada mediante herramienta oficial
solo en modo view; no se alteró ni duplicó.
