# Continuidad P0C hosted ledger - 12/11/2026
Codex principal; F0/N2 soporte F1-F4. Worktree hosted-ledger-20261112,
rama codex/hosted-ledger-20261112 desde main a63ed47 (P0B/PR231), contrastado por conector.
Runbook: docs/HOSTED_LEDGER_P0C_20261112.md; orden: docs/CODEX_CONTINUATION.json.
Preparado: postgres solo db.juyowvmtluxfetgkckjd.supabase.co:5432; proyecto existente prohibido.
Bootstrap staged transaccional desde SQL existente, public vacio, auth preservado,
RLS y ACL restringidos. PLAN Cloud reutilizado: hosted-status/resume manuales, main,
SHA revisado y environment protegido; secrets solo en paso runtime. Automatico blocked.
PROBADO local: verify 515/515, tipos/skills/builds/API; TLS P0B+P0C 1/1 sin omitir,
69s, recuperacion intento2, fencing, postgres sin superuser, auth/ACL/negativos.
HTML/assets, secrets, YAML, diffcheck; runner sin configuracion bloqueado.
Cluster temporal detenido/eliminado. Revision interna local aprobada; humana pendiente.
No SQL alojado, secrets configurados, dispatch, admision remota, merge, app deploy,
produccion, envios, servicio pago ni scheduler nuevo. Git deployments rama bloqueados.
PR232 publicada por conector; worktree alineado por fetch OpenSSL, sin force push.
CI inicial: validate PASS; postgres timeout P0B. Fixture JIT off/5s; CI final pendiente.
Revisar CI por SHA y seguridad/migracion antes de
habilitar credenciales o ejecutar runbook. Artefactos entre hosts aun efimeros.

## 2026-11-14 · P0C cloud: credenciales listas, transporte operativo bloqueado

Orden expresa del propietario, PR232 existente desde e1712f4/main a63ed47; sin duplicar PR. Proyecto aislado juyowvmtluxfetgkckjd ACTIVE_HEALTHY; cuatro tablas RLS, doce funciones, cero grants API/membresias/misiones. Principal intacto. Directo solo AAAA; Windows sin ruta ::/0, timeout antes de autenticacion. Session Pooler oficial IPv4 probado con TLS1.3/verify-full y CA del dashboard.

EJECUTADO: rotacion SCRAM del rol dedicado y carga del mismo valor a P0C_LEDGER_RUNNER_PASSWORD mediante transferencia OpenPGP cifrada y stdin; P0C_LEDGER_CA_CERT configurado. Autenticacion/rol/base/marcador/binding verificados por psql; cinco ACL negativas reales denegadas. Environment solo main, revisor obligatorio y prevent_self_review; bypass preexistente no usado. No se recuperaron valores de GitHub Secrets.

BLOQUEO REAL: pg_stat_ssl.ssl=false en backend del pooler. Guarda SQL devuelve unauthorized_cloud_session; no se relaja ni se activa transporte. Candidato explicito supabase-session pinnea host/puerto/login del proyecto, preserva identidad SQL, binding y TLS; directo sigue predeterminado. Variables de transporte/SHA ausentes. Sin dispatch, admision, merge, deploy, produccion, envios, gastos ni scheduler.

PROBADO: verify exit0 516/516 sin omisiones, tipos/skills/builds/API. Fixture TLS 1/1 sin omitir, 72s: recuperacion/fencing, ACL/auth y routing pooler, rechazo de backend sin TLS. CI del nuevo SHA se registra en PR. Reporte: docs/HOSTED_LEDGER_CLOUD_20261114.md. Siguiente: ruta IPv6 directa o TLS upstream demostrado; revision PR/CI, autorizacion de una admision sintetica (hoy cero), luego main/SHA/aprobacion del environment para status/resume. Recuperacion alojada NO ejecutada.


Autorizacion expresa posterior del propietario (14/11/2026): admitir una unica mision synthetic-p0c-cloud-check sin envios/produccion, solo despues de resolver TLS y revisar codigo. Permiso concedido; admision aun NO ejecutada. CI de 9af06c3: validate/postgres aprobados; checks del commit documental final en PR.


## 2026-11-14 · P0C TLS resuelto y mision alojada completada

Orden expresa solucionalo. La documentacion oficial de SSL Enforcement confirma ambos tramos del pooler; la conclusion previa era incorrecta. Opcion activada unicamente en juyowvmtluxfetgkckjd, reinicio breve, sin produccion. CloudMissionStore real con verify-full y CA conserva guardas y confirma backend_tls=true, rol/binding correctos. Cinco negativos ACL nuevamente denegados. Rotacion cifrada coordinada y secret actualizado sin exponer valor. Mision autorizada synthetic-p0c-cloud-check admitida administrativamente y ejecutada por CLI desde PC contra ledger alojado: completed/intento1/checkpoint5/error null. No es aun ejecucion originada en GitHub. Reporte docs/HOSTED_LEDGER_TLS_RESOLVED_20261114.md. Siguiente: CI final y revision, integrar PR232 sin deploy, configurar SHA/modo y dispatch terminal de la misma ID; respetar revision humana del environment sin bypass.


## 2026-11-14 · P0C configuracion cloud completada y verificada

PR232 integrada en main0337d47, CI validate/postgres/CodeQL aprobada. GitHub Actions hosted-status run43657434746 SUCCESS: mismo binding y state completed. Propietario autorizo expresamente aprobacion administrativa excepcional solo de ese run porque unica cuenta era iniciadora/revisora y prevent_self_review=true. Se audito la excepcion puntual; politicas permanentes intactas y sin permiso para repetir bypass. Mision mantiene intento1/checkpoint5/audit7/updated_at identico; sin nuevos efectos. Ambos secrets y modo supabase-session configurados. Claves privadas temporales eliminadas. Sin produccion, envios, pagos, scheduler ni ejecucion continua. Evidencia docs/HOSTED_LEDGER_TLS_RESOLVED_20261114.md. Configuracion solicitada COMPLETADA; futuros runs requieren revision propia. El cierre documental no autoriza otro dispatch.
