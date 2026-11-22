# Supabase Cron → pg_net → Edge: preparación aislada

Fecha: 2026-11-22. Base inicial: main 82b6fb24.
Estado: **CÓDIGO PREPARADO, NO DESPLEGADO NI PROGRAMADO**.

## Propósito
Preparar para una fase posterior el transporte alojado independiente de GitHub Actions.
No crear otro planificador, cola, supervisor ni ejecutor: reutilizar el motor existente.

## Componentes
- `src/autopilot/directorWake.ts`: preflight sin efectos que exige token scoped.
- `src/autopilot/directorWake.test.ts`: negativos y contrato sin ejecución.
- `supabase/functions/autopilot-director-wake/index.ts`: punto de entrada Deno.
- `supabase/staged/autopilot_director_wake_cron_REVIEW_ONLY.sql`: SQL comentado.

## Invariantes
- Sin secreto, token incorrecto, ruta/método errado: denegación.
- Respuesta válida: `executed=false`, `tasksClaimed=0`, `noSend=true`.
- Nunca leer datos personales, enviar mensajes ni reclamar tareas.
- No presentar HTTP 200 como heartbeat durable ni prueba de autonomía.
- No instalar `pg_net`, crear Cron, configurar secreto, desplegar Edge Function
  ni escribir en Supabase alojado sin autorización posterior específica.
- No usar service_role como token de invocación HTTP.
- Revisar PR #272 y P2 antes de implementar claims de director.

## Próximo paso después de revisión
En un entorno aislado, desplegar endpoint preflight, probar 401/503/200
y llamada programada con `pg_net`, sin secretos en logs.
Solo después añadir claim dedicado y acotado para `director`, autorización
por efecto, verificador independiente y recibos de ejecución durables.
Este cambio **no** satisface el criterio de autonomía operativa.

## Referencias
- https://supabase.com/docs/guides/functions/schedule-functions
- https://supabase.com/docs/guides/database/extensions/pg_net
- https://supabase.com/changelog.md


## Revisión aislada adicional · 22/11/2026

La revisión de la PR #273 corrigió el uso de `endsWith` para autorizar
rutas de invocación. Ahora solo se admiten las dos rutas exactas del
endpoint; variantes con prefijos, sufijos, capitalización diferente o
segmentos codificados no autorizan el preflight.

La prueba `src/autopilot/directorWakeEntry.test.ts` importa el punto de
entrada real de Edge con un shim Deno limitado y lo invoca por HTTP
loopback. Resultado: 5/5 pruebas del puente; `npm run verify` final:
619/619 tests, TypeScript, builds de Node/Vercel y smoke de API aprobados.

**Límite de evidencia:** la prueba HTTP se hizo en Node sobre loopback,
no en Supabase Edge ni en Deno real. No se desplegó, no se creó un job
Cron y no existe todavía un ejecutor `director` alojado.
