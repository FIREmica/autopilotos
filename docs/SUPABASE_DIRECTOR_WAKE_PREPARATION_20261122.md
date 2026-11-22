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
