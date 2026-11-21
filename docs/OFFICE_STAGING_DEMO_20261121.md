# Oficina de seis roles: demostración sintética local

Carril B de la orden del propietario del21/11/2026: se habilitan incrementos independientes A/B/C/D. P2 original sigue INDETERMINADO y sus cinco archivos/clústeres no se usan ni modifican.

## Reproducir

En Windows con Node24, dependencias del lockfile y PostgreSQL18 instalado en su ruta habitual:

```powershell
node --import tsx scripts/autopilot-office-demo.ts --output output/office-demo/receipt.json
```

`AUTOPILOT_PG_BIN` permite indicar otra carpeta de binarios PostgreSQL. El comando crea un clúster propio temporal, escucha solo127.0.0.1:29552 y lo detiene en finally. Nunca conecta a Supabase, lee secretos, consume inferencia ni envía comunicaciones. No admite URL de base externa. Conserva archivos y recibo para revisión. Resultado siempre **SIMULADO**.

Entrada de staging: `runSixAgentOfficeEntry` valida disparador y autorización host antes de reclamar. Carga la migración canónica20260912033258_autopilot_core_v4.sql (incluidos CHECK de estados y RLS) y la extensión canónica de cola. Usa el adaptador de aplicación `claimPersistedTask` y los procedimientos canónicos `six_agent_claim`, `six_agent_complete`, `six_agent_fail`; no hay segunda cola, ledger ni scheduler. La simulación del transporte HTTP de infraestructura escucha en localhost. La suite ejecuta SQL real y consultas separadas observan su estado/auditoría.

El host aprovisiona tareas sintéticas por la escritura de admisión a `agent_tasks` ya existente, con aprobación explícita `synthetic/no_send`, y auditoría de admisión. Cada ejecución realiza una operación administrativa determinista del rol. No es un agente de IA remoto ni ejecución autónoma productiva. Software solo revisa un alcance; no ejecuta código recibido en payload. Reports agrega métricas de la misma cola. Followup prepara revisión con consentimiento y supervisión, nunca envía.

## Resultado por entrada normal

| Rol | Disparador | Resultado durable | Recuperación |
|---|---|---|---|
| director | enqueue | propuesta de siguiente tarea, completed y auditoría | intento2 tras lease expirada; completado viejo rechazado |
| software | explicit_task | alcance revisado sin ejecutar código, completed | intento2, token viejo rechazado |
| infrastructure | health_check | GET real al servidor HTTP sintético local verificado, completed | intento2, token viejo rechazado |
| consultations | authorized_inbound | NOT_CLAIMED, tarea queued/intento0 | política existente impide claim; no se elimina la guarda |
| followup | authorized_review | revisión opt-in supervisada preparada, completed | intento2, token viejo rechazado |
| reports | scheduled_report | agregado de la misma cola, completed | intento2, token viejo rechazado |

**Bloqueo probado de consultations:** `supabase/staged/six_agent_queue_20261025.sql:24` devuelve sin claim para ese rol. La tarea se crea y se intenta reclamar mediante la entrada normal; el rechazo se conserva en el recibo. Configuración también la clasifica degraded. Esto es una limitación concreta de esa entrada, no ausencia de ensayo ni prueba de que las consultas del sitio fallen. No se habilita el rol ni se debilita la aprobación para obtener verde.

Negativos: autorización host ausente y disparador incorrecto se rechazan antes de claim; caller SQL sin rol autorizado es rechazado; tokens/leases expirados no pueden completar; followup con consentimiento revocado llega a blocked con `consent_and_supervision_required` y cero completados de ese caso. No existe mecanismo de envío en esta entrada sintética.

Recibo de ejecución y auditorías: [office-staging-receipt.json](audits/evidence-20261121/office-staging-receipt.json). Cada rol contiene disparador, autorización, intento, resultado, auditoría, recuperación y métricas. La validación lee las tablas canónicas después de ejecutar, fuera del área escribible de los payloads. No se presenta como observador humano independiente ni certificación completa de un runtime remoto.

## Panel y estado operativo

El panel existente conserva configuración separada de última actividad, último intento/ejecución, último éxito y salud observada. Muestra recibidas, pendientes, completadas con evidencia, bloqueadas, antigüedad, tareas con reintentos y leases activas. Una configuración ready, una tarea reintentada o una lease activa no certifican salud24/7. Cero filas → sin ejecución observada; lectura limitada → parcial; fallos/leases vencidas → requiere atención. Último éxito anterior a24h no se presenta como reciente. Estas son señales de cola, no SLA ni monitor de procesos.

Investigación productiva en lectura, comunicada por el ejecutor principal a03:39Z: las6 tareas infrastructure blocked agotaron3/3 intentos; sus18 eventos de fallo son `site_unavailable`. Las13 queued tienen0 intentos, sin fallos ni claims. Todas son `read_only_public_health`; cero leases activas. Se acredita la causa registrada y presupuesto agotado, no un diagnóstico HTTP/Cloudflare ni salud actual del sitio. No se reintentaron tareas productivas. Evidencia agregada será consolidada por el ejecutor principal con el checkpoint.

Heartbeat existente observado por el ejecutor principal: mismo ID `victoriosa-autopilot-6h`, ACTIVE cada30min. Esta demo no lo modifica, no crea scheduler ni prueba recepción futura. Local y cloud se mantienen separados; continuidad cloud y ejecución productiva de roles permanecen no certificadas.

## Validación y límites

Comando focal: `node --import tsx --test src/autopilot/sixAgentOffice.test.ts`. Prueba guardas de entrada, consentimiento y distinción de estado/configuración. `npm run verify` cubre regresión de aplicación, tipos, builds y API. El recibo integral adicional usa PostgreSQL real y no sustituye la CI del SHA exacto.

Primer ensayo conservado: psql en Windows recibió caracteres CP1252 mediante argv y rechazó UTF8; el clúster propio se detuvo. Corrección: SQL por archivoUTF8 y PGCLIENTENCODING explícito, sin modificar política ni ampliar timeouts. No SQL productivo ni P2 se ejecutó.

Revertir solo este cambio de código/panel/demostración si corresponde; conservar recibos y recursos originales. La prueba demuestra cinco roles completados y el bloqueo explícito de consultations por su entrada persistida. No declara oficina productiva completa, salud continua ni proyecto terminado.

Validación local conservada: primera verify601 pruebas/600PASS/1FAIL, `selfDevelopment.test.ts:212 effect_not_observed` a15s; no afecta archivos del cambio. Caso aislado posterior1/1PASS en20.31s, sin ampliar límites. La causa de la primera espera no se considera demostrada; una repetición completa verifica la candidata estable.

Repetición final `npm run verify`: exit0,601/601PASS,0FAIL/0SKIP,73508ms para pruebas, tipos/builds/API aprobados. Lint posterior al endurecimiento del bootstrap también validado. Las dependencias locales fueron reutilizadas por junction desdeC:/autopilot/node_modules; Vite observado6.4.5, por lo que esta validación no acredita paridad con el lockfile actual. La CI del SHA exacto debe instalar el lockfile canónico.
