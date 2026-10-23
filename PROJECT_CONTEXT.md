# PROJECT_CONTEXT - SICE-Local
Última actualización: 2026-10-23 | Paso 4 completado y verificado

## Resumen
Sistema de convivencia escolar de la I.E. N.° 20874 "Centro de Varones" (San Vicente de Cañete). Registra y da seguimiento a incidencias disciplinarias. Detalle técnico: README.md.

## Stack
Node 18+, Express, dotenv, cors, nodemon, bcryptjs, jsonwebtoken, cookie-parser y pdfkit. Frontend en `public/` con Bootstrap 5 + JS vanilla. mysql2 (pool preparado, sin consultas al iniciar ni persistencia implementada). Arquitectura: routes -> controllers -> repositories; middleware de autenticación y servicios de permisos y PDF.

## Estado actual
- Pasos 1–4 terminados. Login/logout, cinco roles y cuentas semilla; gestión de usuarios exclusiva del Administrador. Pestañas, filtros, métricas y modal conservados.
- Gestión de usuarios revisada: nombres ficticios completos, usuario y rol diferenciados; barra de sesión con nombre y rol; altas siempre activas y activación/desactivación desde la tabla con PUT. Se conserva el estado al editar y la protección del último Administrador activo.
- JWT en cookie httpOnly, sesiones revocables y hashes bcrypt. API aplica la matriz, filtra registros por autor y oculta identidades confidenciales; la edición no borra los testigos protegidos omitidos por el cliente.
- Anulación lógica con motivo, responsable, fecha e historial; las incidencias anuladas no admiten cambios ni reapertura. Autor e historial controlados por el servidor.
- PDF individual desde GET /api/incidencias/:id/pdf y botón en Registros: escudo, contenido registrado, historial/anulación, encabezado, pie con usuario/rol/fecha y paginación. Autorización reutilizada; no se guardan archivos en el servidor.
- Repositorios de incidencias, usuarios y sesiones en memoria; todo se reinicia con el servidor. Sin persistencia SQL.

## Siguiente paso
Paso 5 (integración MySQL): pendiente de autorización expresa. No comenzar automáticamente.

## Plan (marcar al terminar)
- [x] 1. Frontend en pestañas dentro de `index.html`: Inicio, Nuevo registro, Registros (Login y Usuarios llegan en el paso 3). Sin páginas separadas mientras los datos estén en memoria.
- [x] 2. Conectar el frontend con la API (fetch): listar, crear, editar (PUT), cambiar estado (PATCH). El repositorio sigue en memoria.
- [x] 3. Login y roles, cinco usuarios semilla, bcryptjs, JWT httpOnly y cookie-parser; requiereLogin/requiereRol, Usuarios, protección de testigos y anulación con historial.
- [x] 4. PDF por incidencia: `GET /api/incidencias/:id/pdf` con pdfkit, escudo, identificador, pie de generación, paginación y confidencialidad según rol.
- [ ] 5. Conectar MySQL cuando se autorice: script SQL revisado en MySQL Workbench y repositorios con mysql2. No tocar controladores ni rutas.

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
PDF aplica la misma visibilidad que la consulta de incidencias, también para las anuladas; Administrador no tiene acceso.

## Decisiones
- Pestanas en un solo HTML; los datos ahora viven en el servidor y el frontend mantiene una copia de lectura.
- Permisos validados en el backend.
- Priorizar código sencillo, ordenado y explicable para el instituto; evitar complejidad innecesaria sin quitar reglas ni funcionalidad.
- Anular, no eliminar (menores y casos disciplinarios); queda en el historial.
- PDF en el backend para que el servidor filtre por rol.
- MySQL es el motor definitivo; integrar persistencia solo en el Paso 5 autorizado.
- Auxiliar y Docente crean solo en Pendiente; PUT tampoco les permite cambiar estado. Anulado es terminal para todos los roles.
- Motivo obligatorio al anular para ambos supervisores. Historial sin copias de identidades; edición de roles sin permiso conserva en el servidor los testigos confidenciales previos.
- JWT_SECRET obligatorio (mínimo 32 bytes), SEED_PASSWORD obligatorio (12 caracteres–72 bytes) y APP_ORIGIN exacto. Cinco cuentas: director, coordinador, auxiliar, docente, administrador; toman SEED_PASSWORD al reiniciar. Configuración: .env.example y README.
- Sesiones de ocho horas revocables al logout y al modificar cuenta. Cookie SameSite=Strict y Secure en producción; escrituras con X-SICE-Request y validación de Origin. Límite de intentos de login; sin secretos predeterminados.

## Modelo físico para MySQL Workbench (no ejecutado)
- `database/schema.sql`: MySQL 8.0.16+, 15 tablas, 15 PK y 24 FK; InnoDB y utf8mb4. CHECK efectivos desde 8.0.16. Sin triggers, conexión ni migración; aplicación en memoria.
- Documento obligatorio en USUARIO/ESTUDIANTE/APODERADO: DNI de 8 dígitos, CE o Pasaporte alfanumérico hasta 20; unicidad por tipo/número en cada entidad. Nombres completos Unicode; sin documentos ficticios. Terceros externos por nombre/tipo sin documento obligatorio.
- Una MATRICULA por estudiante/año y apoderado principal anual. Sin aula fija en matrícula ni incidencia: INVOLUCRADO referencia matrícula; estudiante se obtiene de ella y aula de HISTORIAL_AULA a la fecha del hecho. No se duplica id_estudiante en involucrados.
- Vigencias locales [inicio, fin), con fin exclusivo; NULL cubre el resto del año. FK compuestas garantizan igualdad de años. Al integrar SQL, Node.js deberá impedir solapamientos y cambios de aulas históricas mediante transacciones serializadas; ya no hay triggers que lo hagan.
- ASIGNACION_AULA incluye usuario, tipo, año y vigencia. Regla futura: Auxiliar ve el historial del año de sus aulas actualmente asignadas, protegiendo participantes de otras aulas y narraciones sensibles en el backend. Esto NO está integrado aún; hoy Auxiliar ve todas.
- Medidas individuales múltiples por involucrado. ATENCION_MEDIDA conserva atenciones con nombre/parentesco del representante como instantánea y FK opcional a APODERADO. Node.js deberá insertar cada versión en HISTORIAL_MEDIDA junto con el cambio de medida; no es automático en SQL.
- Catálogo TIPO_INCIDENCIA configurable con Leve/Grave/Muy Grave (clasificación propia, no oficial). El código actual sigue admitiendo solo Leve/Grave: adaptar catálogo y selección en integración futura.
- Incidencias con código único VARCHAR(50) que deberá generar Node.js antes de insertar (SICE- + UUID), cuatro estados, hora opcional, observaciones, autor y fechas. CHECK exige los datos de anulación; bloqueo de posteriores cambios, autor inmutable, última modificación y eventos de historial quedan a cargo de Node.js. Historial inicial permite estado anterior NULL.
- VARCHAR/LONGTEXT utf8mb4, DATE/TIME y DATETIME(3) UTC. BOOLEAN con CHECK 0/1. UNIQUE de involucrado admite varios testigos externos NULL; periodo_abierto calculado + UNIQUE limita un aula abierta por matrícula. No hay filtros de índices ni columnas calculadas desde AUTO_INCREMENT.
- Pendiente revisión del instructor y ejecución real en MySQL/Workbench. Gramática revisada con analizador externo temporal y estructura con pruebas Node.js; no se probó un servidor MySQL. Las reglas futuras de transacciones siguen en database/VALIDACIONES.md.


## Mapa de archivos
- `database/schema.sql`: diseño físico propuesto; no ejecutar automáticamente ni confundir con Paso 5 implementado.
- `database/Modelo C. Varones.mwb`: modelo Workbench verificado con 15 tablas y 15 figuras en EER Diagram1; conserva además un diagrama vacío. Sustituye al archivo vacío schema.sql.mwb.
- `database/VALIDACIONES.md`: reglas retiradas de triggers y validaciones futuras de Node.js, con transacciones, concurrencia y confidencialidad; no están integradas en SQL todavía.
- `public/index.html`: interfaz (métricas, formulario `#record-form`, tabla `#record-rows`).
- `public/app.js`: estado, pestañas, filtros, tabla y detalle. `formulario.js`: testigos, validación y guardado. `usuarios.js`: cuentas. `api.js`: fetch/avisos y login/logout, cargado al final para recuperar sesión con toda la pantalla preparada. Cuatro scripts defer en ese orden, sin framework.
- `public/estilo.css`: estilos (variables --school-red, etc.).
- `src/app.js` (Express y middlewares) y `src/server.js` (arranque).
- `src/config/db.js`: pool mysql2 diferido; importar o arrancar no conecta. Health con ?db=true solo a solicitud explícita.
- `src/validators/incidencias.js`: reglas de entrada compartidas por crear y editar.
- `src/config/auth.js`, `roles.js`: configuración de sesión y roles; `src/middlewares/auth.js`: login requerido, roles y protección de escrituras.
- `src/routes/auth.routes.js`, `usuarios.routes.js` y sus controladores; `src/repositories/usuarios.repository.js`, `sesiones.repository.js`: cuentas y sesiones en memoria.
- `src/services/incidencias.permisos.js`: permisos por registro y presentación sin identidades protegidas. Para PDF sustituye también menciones textuales exactas de nombres confidenciales sin modificar el original; no interpreta alusiones indirectas, que deben evitarse en narraciones de acceso general.
- `src/services/incidencias.pdf.js`: generación PDF en memoria sobre datos ya autorizados, sin lógica de permisos duplicada.
- `test/paso3.test.js` y `test/pdf.test.js`: pruebas HTTP; `test/browser.cjs`: prueba opcional con Chrome/Edge instalado, sin dependencias nuevas de pruebas.
- `src/routes/*.js`, `src/controllers/*.js`, `src/repositories/incidencias.repository.js` (datos en memoria).
- `images/`: escudo (`images/images.jpg`).
Por tarea: UI -> `public/*`; API -> routes + controllers + repositories de incidencias; login -> archivos nuevos siguiendo el mismo patrón (auth y usuarios) más un middleware; PDF -> controlador de incidencias + servicio nuevo.

## Verificación y limitaciones
- npm test: 20 pruebas correctas de permisos de cinco roles, autenticación, usuarios, incidencias e historial; PDF largo, pies, escudo, nombres protegidos, 401/403/404 y fallo 500; arranque real de Node, health/mysql2 simulado y estructura SQL. Sin consultas a una base real.
- npm run test:ui: Chrome real, cinco roles, login/logout, registro, edición protegida, filtros, móvil, anulación, usuarios, descarga PDF y aviso ante fallo de red. PDF de cinco páginas renderizado y revisado visualmente (encabezado, escudo, pie y texto). node --check y git diff --check correctos.
- Fuga de iniciarEdicion corregida. Limitaciones previstas: Auxiliar ve todas las aulas; datos y cuentas se restablecen al reiniciar. No usar con datos reales mientras falten persistencia y condiciones de despliegue revisadas.
- Para ejecución local hay que agregar JWT_SECRET y SEED_PASSWORD privados en .env y ajustar APP_ORIGIN. No se modificó ni versionó .env. Proxy/TLS y asignación de aulas requieren configuración posterior.

## Bitácora (últimas 10)
- 2026-10-23: Paso 4 verificado: PDFKit, endpoint protegido y botón de descarga; confidencialidad, paginación y errores probados por HTTP y Chrome. Sin cambios al esquema ni conexión MySQL; Paso 5 pendiente.
- 2026-10-17: pasos 1 y 2 terminados: pestañas, filtros y frontend conectado a API en memoria.
- 2026-10-23: Paso 3 y mejora de usuarios verificados por HTTP y Chrome; autenticación, cinco roles, confidencialidad y anulación.
- 2026-10-23: diseño de 15 tablas y reglas del backend documentados, sin ejecutar ni integrar base de datos.
- 2026-10-23: motor definitivo MySQL, dependencia anterior sustituida por mysql2; SQL convertido para Workbench. Frontend separado por responsabilidad y validaciones de incidencias aclaradas. Pruebas aisladas, sin avanzar pasos 4/5 ni push.
- 2026-10-23: sesión y HTTP unificados en public/api.js (114 líneas); retirada carpeta models vacía. Se mantienen las demás separaciones y database/pruebas intactos; 15 pruebas y Chrome correctos, sin referencias rotas ni avance de pasos 4/5.
