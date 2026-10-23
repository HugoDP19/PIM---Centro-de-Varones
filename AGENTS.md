
# Instrucciones para Codex

## Contexto del proyecto
- README.md contiene la descripción y arquitectura general.
- PROJECT_CONTEXT.md contiene el progreso y decisiones recientes.
- Usa estos archivos como fuentes de contexto.

## Lectura inteligente
1. Al comenzar una sesión nueva, revisa AGENTS.md.
2. Consulta README.md y PROJECT_CONTEXT.md cuando necesites conocer el estado del proyecto.
3. No vuelvas a leer archivos que ya conoces si no han cambiado y el contexto sigue disponible.
4. Lee solamente los archivos relacionados con la tarea.
5. Usa búsquedas específicas antes de abrir archivos grandes.

## Ahorro de tokens
- Evita explicaciones extensas.
- No muestres archivos completos salvo que lo solicite.
- No analices todo el repositorio por cada petición.
- No repitas información que ya está en el contexto.
- Evita ejecutar comandos innecesarios.
- Haz cambios mínimos y precisos.
- Prefiere código sencillo y explicable para un proyecto de instituto; evita complejidad innecesaria.
- Prefiere respuestas cortas con un resumen de los cambios.

## Desarrollo
- Respeta la arquitectura existente.
- MySQL 8.0.16+ es el motor del proyecto; no conectes ni migres datos sin autorización.
- Simplifica sin quitar funcionalidades, validaciones, permisos ni seguridad.
- Reutiliza funciones y componentes.
- No instales dependencias sin necesidad.
- No modifiques archivos ajenos a la tarea.
- Antes de implementar cambios grandes, presenta un plan breve.
- Ejecuta únicamente las pruebas relevantes.

## Memoria del proyecto
Actualiza PROJECT_CONTEXT.md cuando haya:
- Funcionalidades terminadas.
- Decisiones técnicas importantes.
- Errores pendientes.
- Cambios importantes en la arquitectura.

Mantén ese archivo corto y actualizado.

## README.md
Actualízalo cuando cambien:
- La instalación.
- La estructura principal.
- Las tecnologías.
- Los comandos de ejecución.

No lo modifiques por cambios pequeños.
- Redacción técnica y directa, sin emojis; documenta solo funcionalidades implementadas.

## Git y avance
- Crea commits descriptivos al terminar cambios verificados; no hagas push sin autorización.
- No avances al siguiente paso del plan sin autorización.

## Respuestas
Al terminar, indica brevemente:
- Qué cambiaste.
- Qué archivos modificaste.
- Si hubo errores o pruebas pendientes.
