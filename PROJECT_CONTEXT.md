# PROJECT_CONTEXT - SICE-Local
Última actualización: 2026-10-23 | Paso 3 completado y verificado

## Resumen
Sistema de convivencia escolar de la I.E. N.° 20874 "Centro de Varones" (San Vicente de Cañete). Registra y da seguimiento a incidencias disciplinarias. Detalle técnico: README.md.

## Stack
Node 18+, Express, dotenv, cors, nodemon, bcryptjs, jsonwebtoken y cookie-parser. Frontend en `public/` con Bootstrap 5 + JS vanilla. mssql (conector listo, sin persistencia SQL). Arquitectura: routes -> controllers -> repositories; middleware de autenticación y servicio de permisos por incidencia.

## Estado actual
- Pasos 1–3 terminados. Login/logout, cinco roles y cuentas semilla; gestión de usuarios exclusiva del Administrador. Pestañas, filtros, métricas y modal conservados.
- Gestión de usuarios revisada: nombres ficticios completos, usuario y rol diferenciados; barra de sesión con nombre y rol; altas siempre activas y activación/desactivación desde la tabla con PUT. Se conserva el estado al editar y la protección del último Administrador activo.
- JWT en cookie httpOnly, sesiones revocables y hashes bcrypt. API aplica la matriz, filtra registros por autor y oculta identidades confidenciales; la edición no borra los testigos protegidos omitidos por el cliente.
- Anulación lógica con motivo, responsable, fecha e historial; las incidencias anuladas no admiten cambios ni reapertura. Autor e historial controlados por el servidor.
- Repositorios de incidencias, usuarios y sesiones en memoria; todo se reinicia con el servidor. Sin PDF ni persistencia SQL.

## Siguiente paso
Paso 4 (PDF): pendiente de autorización expresa. No comenzar automáticamente.

## Plan (marcar al terminar)
- [x] 1. Frontend en pestañas dentro de `index.html`: Inicio, Nuevo registro, Registros (Login y Usuarios llegan en el paso 3). Sin páginas separadas mientras los datos estén en memoria.
- [x] 2. Conectar el frontend con la API (fetch): listar, crear, editar (PUT), cambiar estado (PATCH). El repositorio sigue en memoria.
- [x] 3. Login y roles, cinco usuarios semilla, bcryptjs, JWT httpOnly y cookie-parser; requiereLogin/requiereRol, Usuarios, protección de testigos y anulación con historial.
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
PDF en la matriz es un permiso planificado: todavía no existe endpoint ni botón de descarga.

## Decisiones
- Pestanas en un solo HTML; los datos ahora viven en el servidor y el frontend mantiene una copia de lectura.
- Permisos validados en el backend.
- Anular, no eliminar (menores y casos disciplinarios); queda en el historial.
- PDF en el backend para que el servidor filtre por rol.
- SQL Server al final, con el modelo ya cerrado.
- Auxiliar y Docente crean solo en Pendiente; PUT tampoco les permite cambiar estado. Anulado es terminal para todos los roles.
- Motivo obligatorio al anular para ambos supervisores. Historial sin copias de identidades; edición de roles sin permiso conserva en el servidor los testigos confidenciales previos.
- JWT_SECRET obligatorio (mínimo 32 bytes), SEED_PASSWORD obligatorio (12 caracteres–72 bytes) y APP_ORIGIN exacto. Cinco cuentas: director, coordinador, auxiliar, docente, administrador; toman SEED_PASSWORD al reiniciar. Configuración: .env.example y README.
- Sesiones de ocho horas revocables al logout y al modificar cuenta. Cookie SameSite=Strict y Secure en producción; escrituras con X-SICE-Request y validación de Origin. Límite de intentos de login; sin secretos predeterminados.

## Modelo de datos (cambios acordados; verificar si ya están en ERwin)
Tablas: ROL, USUARIO, ASIGNACION_AULA (nueva), AULA, MATRICULA, ESTUDIANTE, APODERADO, TIPO_INCIDENCIA, INCIDENCIA, INVOLUCRADO_INCIDENCIA, MEDIDA_DISCIPLINARIA, HISTORIAL_INCIDENCIA (nueva).
Cambios: id_tipo pasa a INCIDENCIA; INVOLUCRADO.id_estudiante opcional + tipo_persona + nombre_persona (testigos que no son alumnos); MEDIDA.id_usuario_tutor -> id_usuario_responsable; DNI único en ESTUDIANTE, APODERADO y USUARIO; anio_academico en MATRICULA.

## Mapa de archivos
- `public/index.html`: interfaz (métricas, formulario `#record-form`, tabla `#record-rows`).
- `public/app.js`: lógica del cliente (validación, render, edición, fetch y copia de lectura `registros`).
- `public/estilo.css`: estilos (variables --school-red, etc.).
- `src/app.js` (Express y middlewares) y `src/server.js` (arranque).
- `src/config/db.js`: conector mssql.
- `src/config/auth.js`, `roles.js`: configuración de sesión y roles; `src/middlewares/auth.js`: login requerido, roles y protección de escrituras.
- `src/routes/auth.routes.js`, `usuarios.routes.js` y sus controladores; `src/repositories/usuarios.repository.js`, `sesiones.repository.js`: cuentas y sesiones en memoria.
- `src/services/incidencias.permisos.js`: permisos por registro y presentación sin identidades protegidas.
- `test/paso3.test.js`: pruebas HTTP; `test/browser.cjs`: prueba opcional con Chrome/Edge instalado, sin dependencias nuevas de pruebas.
- `src/routes/*.js`, `src/controllers/*.js`, `src/repositories/incidencias.repository.js` (datos en memoria).
- `images/`: escudo (`images/images.jpg`).
Por tarea: UI -> `public/*`; API -> routes + controllers + repositories de incidencias; login -> archivos nuevos siguiendo el mismo patrón (auth y usuarios) más un middleware; PDF -> controlador de incidencias + servicio nuevo.

## Verificación y limitaciones
- npm test: 10 pruebas correctas, incluidas matriz de cinco roles, 400/401/403/404/409/429, autor controlado, confidencialidad, historial, revocación de sesiones y contraseñas.
- npm run test:ui: Chrome real, cinco roles, login/logout, registro, edición protegida, filtros, móvil, anulación y usuarios. node --check y git diff --check correctos.
- Fuga de iniciarEdicion corregida. Limitaciones previstas: Auxiliar ve todas las aulas; datos y cuentas se restablecen al reiniciar. No usar con datos reales mientras falten persistencia y condiciones de despliegue revisadas.
- Para ejecución local hay que agregar JWT_SECRET y SEED_PASSWORD privados en .env y ajustar APP_ORIGIN. No se modificó ni versionó .env. Proxy/TLS y asignación de aulas requieren configuración posterior.

## Bitácora (últimas 10)
- 2026-10-17: contexto inicial creado (AGENTS.md + PROJECT_CONTEXT.md).
- 2026-10-17: Paso 1 terminado; navegación, filtros y modal sin cambiar objetos ni backend. Contexto inicial recuperado del bloque B adjunto.
- 2026-10-17: Paso 2 terminado; API completa y frontend conectado. curl: CRUD sin borrado, estados, 400/404 y campos verificados; node --check correcto. Prueba visual en navegador pendiente.
- 2026-10-23: Paso 3 implementado y verificado por HTTP y navegador; README sin emojis, configuración y pruebas documentadas. Commits locales; sin push ni avance al Paso 4.
- 2026-10-23: Gestión de usuarios mejorada; pruebas HTTP y Chrome correctas para cinco roles, alta activa, cambio de estado y conservación de incidencias al reactivar. Sin cambios de arquitectura ni avance al Paso 4.
