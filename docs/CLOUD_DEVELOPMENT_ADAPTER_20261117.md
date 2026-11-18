# Entrada de autodesarrollo cloud acotado

Orden del propietario: continuar trabajando con Codex cerrado; autorización de coste hasta US$5 al mes. Fecha de la solicitud: 17/11/2026, America/Montevideo.

## Alcance y separación de contratos

Se amplía el workflow **existente** `plan-cloud.yml` con una entrada de propuestas de código. No se crean otro workflow, supervisor, cola ni ledger de misiones. GitHub Actions ejecuta el host cuando la aplicación local está cerrada; main y `CODEX_CONTINUATION.json` siguen siendo la fuente del objetivo. El nuevo código no concede permisos al runtime SQL ni modifica sus contratos sintéticos. El antiguo handoff `workflow_run` permanece cerrado para misiones SQL sin adaptador autorizado.

Esto prepara propuestas revisables, no cierre P2 ni activación P3/P4 del motor. No se reutilizan grants locales, ventanas históricas ni excepciones administrativas. No hay auto-merge, despliegue, SQL alojado, envíos, datos de clientas o modificación de credenciales por parte del ejecutor.

## Funcionamiento

1. Solo main, primer intento del run, repositorio público y variable de opt-in `AUTOPILOT_CLOUD_ENABLED=true`. Se consulta de nuevo el estado del workflow, variable y main antes de la inferencia y de cada escritura remota. Deshabilitar el workflow o la variable deniega los siguientes efectos; no revierte un efecto ya admitido.
2. Recupera el objetivo de la orden canónica F0. Si hay una PR abierta del mismo repositorio o ya existe la rama determinista, no gasta en otra generación. Los resultados inciertos exigen reconciliar, nunca force-push o replay automático.
3. El modelo recibe solo datos del repositorio público: objetivo y extractos de los archivos de la misión que estén dentro de la allowlist de código. Los extractos incompletos se identifican; si no permiten reproducir un defecto debe responder blocked. No recibe herramientas, secretos ni comandos para ejecutar.
4. La respuesta es JSON de fragmentos exactos. Solo se aceptan hasta dos reemplazos únicos en archivos de código autorizados y una prueba nueva. No puede modificar tests existentes, workflow, scripts, política, checkpoint, dependencias o su propio host.
5. El host aplica y prueba en una copia desechable. El candidato se monta **en lectura**, con dependencias en lectura, sin red, credenciales, metadatos Git, capabilities o socket Docker. Solo los directorios de compilación y temporales son escribibles. Así una prueba generada no puede alterar package.json para falsificar `npm run verify`.
6. La regresión nueva debe producir un fallo de aserción en la base. La candidata debe superar `npm run verify`. El host revisa de nuevo el contenido exacto antes de publicar exclusivamente esos archivos mediante la API Git de GitHub.
7. Publica una sola PR en borrador con el SHA y enlace al run. No actualiza main ni aprueba revisiones. Si se interrumpe una operación de publicación, conserva la rama/commit existente y se bloquea para reconciliar en lugar de repetirla.

El test generado no es un auditor independiente de semántica; la revisión humana de la PR sigue siendo necesaria. Tampoco se acredita exclusión global de trabajos locales no publicados: se evita compartir checkout y se conserva cualquier PR detectada.

## Coste y reserva

- Modelo fijado: `gpt-5.4-mini-2026-03-17`, Responses API global, tier default, sin herramientas, `store=false`, sin reintentos de inferencia.
- Tarifa comprobada en documentación oficial: US$0,75 por millón de tokens de entrada y US$4,50 por millón de salida.
- Máximo por petición: 20.000 bytes de JSON y 4.000 tokens de salida. Se reserva además un margen de 4.096 tokens de entrada para el formato del proveedor. Estimación superior con esos límites: US$0,036072; reserva conservadora: **US$0,04**.
- Máximo 125 reservas por mes calendario de America/Montevideo: **US$5 para esta entrada**. No controla otros consumidores de la misma clave ni sustituye la facturación del proveedor. Una subida de tarifa exige revisar esta configuración y su reserva antes de seguir certificando el límite.
- La reserva se deriva de los pasos del primer intento guardados por GitHub Actions. Pasos iniciados, fallidos, cancelados o inciertos consumen toda la reserva; pasos omitidos no. El run actual debe aparecer reservado antes de llamar a la API. Metadatos incompletos, paginación excesiva o intento repetido deniegan inferencia.
- No se borra el historial de runs que respalda el presupuesto. La retención debe cubrir el mes vigente; una eliminación administrativa de esos registros invalida la garantía del contador. No se usa un archivo volátil como presupuesto global.
- Conexión, modelo retirado, credenciales, cuotas o presupuesto agotado producen bloqueo explícito. No se cambia de cuenta, modelo o proveedor automáticamente.

El repositorio es público y se usan runners estándar ubuntu-latest. No se contrata infraestructura ni se añaden artefactos de pago: el resultado acotado se guarda en el resumen del run y, si corresponde, en su rama/PR.

## Activación y parada revisables

La candidata no se autoactiva. Antes de habilitarla:

1. Revisar e integrar esta PR tras validate, postgres y prueba Docker del SHA exacto.
2. Comprobar que la clave existente `OPENAI_API_KEY` está configurada en el mecanismo seguro de GitHub, sin leer ni copiar su valor.
3. Autorizar la capacidad de GitHub Actions para crear PR. La configuración observada tenía `can_approve_pull_request_reviews=false`, que también impide la creación de PR con GITHUB_TOKEN. Esta candidata nunca autoaprueba ni fusiona, aunque la opción de plataforma habilite ambas capacidades.
4. Pausar la automatización local `victoriosa-autopilot-6h` mediante la herramienta oficial antes de activar el relevo cloud, conservando ID, prompt y destino. No mantener dos supervisores de desarrollo activos.
5. Fijar `AUTOPILOT_CLOUD_ENABLED=true`, ejecutar manualmente modo development una vez y observar resultado, reserva, pruebas y PR/SHA si hay cambio. El horario de la entrada existente es cada seis horas. No se afirma ejecución futura por configurar el horario.

Parada: variable false y deshabilitar/cancelar el workflow desde GitHub. Las ramas y PR permanecen para revisión; no se eliminan evidencias ni recursos previos. El comando de parada del plugin local no detiene por sí solo un run cloud.

## Verificación

Las pruebas focales cubren saldo antes de inferencia, agotamiento, primer intento, resultado incierto, mes de Montevideo, metadatos incompletos, scope de archivos, sustituciones ambiguas, respuestas incompletas, ausencia de uso, herramientas y presupuesto de tokens. La validación del workflow comprueba Docker real sin secretos y la suite completa en el montaje de lectura. Una prueba local no equivale a una ejecución cloud ni a una publicación real.

Fuentes: [modelo y tarifa](https://developers.openai.com/api/docs/models/gpt-5.4-mini), [salidas estructuradas](https://developers.openai.com/api/docs/guides/structured-outputs), [workflow existente](../.github/workflows/plan-cloud.yml).
