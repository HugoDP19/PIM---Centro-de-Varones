# PROJECT_CONTEXT - SICE-Local
Última actualización: 2026-10-17 | Paso en curso: 3

## Resumen
Sistema de convivencia escolar de la I.E. N.° 20874 "Centro de Varones" (San Vicente de Cañete). Registra y da seguimiento a incidencias disciplinarias. Detalle técnico: README.md.

## Stack
Node 18+, Express, dotenv, cors, nodemon. Frontend en `public/` con Bootstrap 5 + JS vanilla. mssql (conector listo en `src/config/db.js`, sin usar aún). Arquitectura: routes -> controllers -> repositories.

## Estado actual
- Pasos 1 y 2 terminados: pestanas, filtros y modal conservados. Frontend usa GET/POST/PUT/PATCH; registros es solo una copia para representar y filtrar datos de la API.
- API acepta los campos del formulario y valida entradas; genera id y fechaUltimoCambio. Repositorio en memoria con listar, obtenerPorId, crear, actualizar y cambiarEstado; se vacia al reiniciar el servidor.
- Avisos de carga/error y bloqueo del guardado durante el envio. Sin login, roles, PDF ni anulacion.
- API devuelve testigos confidenciales; modal los oculta visualmente. Proteccion real y fuga de iniciarEdicion pendientes del Paso 3.

## Siguiente paso
Paso 3: login y roles en backend, permisos y confidencialidad de testigos.

## Plan (marcar al terminar)
- [x] 1. Frontend en pestañas dentro de `index.html`: Inicio, Nuevo registro, Registros (Login y Usuarios llegan en el paso 3). Sin páginas separadas mientras los datos estén en memoria.
- [x] 2. Conectar el frontend con la API (fetch): listar, crear, editar (PUT), cambiar estado (PATCH). El repositorio sigue en memoria.
- [ ] 3. Login y roles en el backend: usuarios semilla en memoria (uno por rol), bcryptjs, jsonwebtoken en cookie httpOnly (cookie-parser), middlewares `requiereLogin` y `requiereRol(...)`. Vista de login, barra con nombre/rol/"Cerrar sesión", vista Usuarios (solo Administrador) y "Anular" en vez de eliminar.
- [ ] 4. PDF por incidencia: `GET /api/incidencias/:id/pdf` con pdfkit (escudo de `images/`, código del caso, pie "Generado por X, fecha y hora"), respetando el rol.
- [ ] 5. Conectar SQL Server cuando el modelo esté cerrado: script SQL desde ERwin y repositorios con mssql. No tocar controladores ni rutas.

## Roles y permisos
Roles: Director, Coordinador de Tutoría, Auxiliar, Docente, Administrador.
| Acción | Director | Coord. Tutoría | Auxiliar | Docente | Administrador |
|---|---|---|---|---|---|
| Registrar | Sí | Sí | Sí | Sí | No |
| Ver registros | Todos | Todos | Sus aulas | Solo los suyos | No |
| Editar | Todos | Todos | Los suyos, si Pendiente | Los suyos, si Pendiente | No |
| Cambiar estado | Sí | Sí | No | No | No |
| Anular | Sí | Sí, con motivo | No | No | No |
| Descargar PDF | Todos | Todos | Los que ve | Los que ve | No |
| Ver testigos confidenciales | Sí | Sí | No | No | No |
| Gestionar usuarios | No | No | No | No | Sí |
Notas: en la fase en memoria "Sus aulas" = todos (depende de ASIGNACION_AULA). Eliminar = anular con motivo; nunca borrar. Estados: Pendiente, En revisión, Atendido (+ Anulado).

## Decisiones
- Pestanas en un solo HTML; los datos ahora viven en el servidor y el frontend mantiene una copia de lectura.
- Permisos validados en el backend.
- Anular, no eliminar (menores y casos disciplinarios); queda en el historial.
- PDF en el backend para que el servidor filtre por rol.
- SQL Server al final, con el modelo ya cerrado.

## Modelo de datos (cambios acordados; verificar si ya están en ERwin)
Tablas: ROL, USUARIO, ASIGNACION_AULA (nueva), AULA, MATRICULA, ESTUDIANTE, APODERADO, TIPO_INCIDENCIA, INCIDENCIA, INVOLUCRADO_INCIDENCIA, MEDIDA_DISCIPLINARIA, HISTORIAL_INCIDENCIA (nueva).
Cambios: id_tipo pasa a INCIDENCIA; INVOLUCRADO.id_estudiante opcional + tipo_persona + nombre_persona (testigos que no son alumnos); MEDIDA.id_usuario_tutor -> id_usuario_responsable; DNI único en ESTUDIANTE, APODERADO y USUARIO; anio_academico en MATRICULA.

## Mapa de archivos
- `public/index.html`: interfaz (métricas, formulario `#record-form`, tabla `#record-rows`).
- `public/app.js`: lógica del cliente (validación, render, edición, fetch y copia de lectura `registros`).
- `public/estilo.css`: estilos (variables --school-red, etc.).
- `src/app.js` (Express y middlewares) y `src/server.js` (arranque).
- `src/config/db.js`: conector mssql.
- `src/routes/*.js`, `src/controllers/*.js`, `src/repositories/incidencias.repository.js` (datos en memoria).
- `images/`: escudo (`images/images.jpg`).
Por tarea: UI -> `public/*`; API -> routes + controllers + repositories de incidencias; login -> archivos nuevos siguiendo el mismo patrón (auth y usuarios) más un middleware; PDF -> controlador de incidencias + servicio nuevo.

## Problemas conocidos
- Confidencialidad solo visual: `iniciarEdicion` (`public/app.js`) vuelve a escribir los nombres de testigos confidenciales en el formulario. Se resuelve en el paso 3: solo Director y Coordinador pueden verlos o editarlos, y el backend no los envía a otros roles.

## Bitácora (últimas 10)
- 2026-10-17: contexto inicial creado (AGENTS.md + PROJECT_CONTEXT.md).
- 2026-10-17: Paso 1 terminado; navegación, filtros y modal sin cambiar objetos ni backend. Contexto inicial recuperado del bloque B adjunto.
- 2026-10-17: Paso 2 terminado; API completa y frontend conectado. curl: CRUD sin borrado, estados, 400/404 y campos verificados; node --check correcto. Prueba visual en navegador pendiente.
