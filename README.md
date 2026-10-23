# SICE-Local — I.E.P. N.° 20874 «Centro de Varones»

Sistema de registro y seguimiento de incidencias de convivencia escolar. Usa Node.js, Express y una interfaz HTML con Bootstrap 5 y JavaScript. Los registros, usuarios, sesiones e historiales viven en memoria del servidor y se pierden al reiniciarlo. SQL Server y la generación de PDF todavía no están implementados.

## Ejecución local

Requiere Node.js 18 o superior y npm. Las pruebas de navegador requieren Node.js 22 o superior y Chrome o Edge instalado.

1. Ejecuta `npm install`.
2. Copia `.env.example` a `.env` si aún no existe. Si ya existe, agrega las variables nuevas sin reemplazar tu configuración.
3. Define `JWT_SECRET` con un valor aleatorio de al menos 32 bytes y `SEED_PASSWORD` con al menos 12 caracteres y un máximo de 72 bytes. No se incluyen credenciales predeterminadas.
4. Ajusta `APP_ORIGIN` al origen exacto desde el que abrirás la aplicación (por defecto `http://localhost:3000`) y `PORT` al puerto correspondiente.
5. Ejecuta `npm start` o `npm run dev` para usar nodemon.

Genera el secreto en una terminal privada y guárdalo en `.env`:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

`.env` no se versiona. `NODE_ENV=production` exige `APP_ORIGIN` con HTTPS y activa la cookie `Secure`. Las variables `DB_*` se conservan para el conector y la comprobación opcional de salud; la aplicación no necesita SQL Server.

## Acceso y permisos

En cada inicio se crean cinco cuentas ficticias, con nombre completo, nombre de usuario y rol diferenciados. Todas toman inicialmente la contraseña de `SEED_PASSWORD`.

| Nombre completo ficticio | Usuario | Rol |
| --- | --- | --- |
| Ricardo Salazar Mendoza | `director` | Director |
| Patricia Huamán Torres | `coordinador` | Coordinador de Tutoría |
| Jorge Quispe Ramos | `auxiliar` | Auxiliar |
| Lucía Vargas Flores | `docente` | Docente |
| Andrés Rojas Medina | `administrador` | Administrador |

La barra de sesión muestra el nombre completo y el rol. El Administrador crea cuentas con nombre completo, nombre de usuario, rol y contraseña inicial; quedan activas automáticamente. Puede editar esos datos y activar o desactivar cuentas desde la tabla, sin eliminar usuarios ni sus incidencias. No se permite desactivar ni cambiar de rol al último Administrador activo. Los cambios de cuenta invalidan sus sesiones; estas modificaciones también se pierden al reiniciar.

| Operación | Director / Coordinador de Tutoría | Auxiliar | Docente | Administrador |
| --- | --- | --- | --- | --- |
| Registrar | Sí | Solo Pendiente | Solo Pendiente | No |
| Ver incidencias | Todas | Todas provisionalmente | Solo las propias | No |
| Editar | Cualquier incidencia no anulada | Propias y Pendiente | Propias y Pendiente | No |
| Cambiar estado y anular | Sí | No | No | No |
| Ver testigos confidenciales | Sí | No | No | No |
| Gestionar usuarios | No | No | No | Sí |

La restricción por aulas del Auxiliar queda pendiente de ASIGNACION_AULA; durante esta fase ve todas. El autor lo asigna el servidor. Los permisos se comprueban en el backend, incluso al llamar directamente a la API.

Los roles sin permiso reciben los testigos protegidos sin el campo `nombre`. Al editar, el formulario omite esas entradas y el servidor conserva las identidades originales. Los supervisores pueden ver y editar esos nombres. El historial registra acciones, estados, usuario responsable y fecha; no guarda copias de identidades.

La anulación requiere un motivo de hasta 500 caracteres tanto para Director como para Coordinador. Conserva el registro, responsable, fecha e historial. Una incidencia anulada no admite edición, cambios de estado ni una segunda anulación; no existe eliminación física ni reapertura.

## Interfaz

El login precede a las pestañas Inicio, Nuevo registro y Registros. El Administrador accede únicamente a Usuarios. Se conserva la navegación por hash y teclado, las métricas, los filtros de texto, estado, grado, tipo y fechas, y el detalle en modal. Las métricas se calculan sobre las incidencias que puede ver la cuenta actual. Las acciones disponibles dependen del permiso devuelto por el servidor.

## API

| Método | Ruta | Función |
| --- | --- | --- |
| GET | `/api/health` | Estado del servidor; `?db=true` comprueba opcionalmente el conector SQL Server |
| POST | `/api/auth/login` | Recibe `{usuario, password}` e inicia sesión |
| GET | `/api/auth/me` | Datos públicos de la cuenta autenticada |
| POST | `/api/auth/logout` | Revoca la sesión y elimina su cookie |
| GET | `/api/usuarios` | Lista usuarios; solo Administrador |
| POST | `/api/usuarios` | Crea usuario; solo Administrador |
| PUT | `/api/usuarios/:id` | Edita usuario; solo Administrador |
| GET | `/api/incidencias` | Lista las incidencias autorizadas |
| POST | `/api/incidencias` | Registra una incidencia |
| PUT | `/api/incidencias/:id` | Edita los campos del formulario |
| PATCH | `/api/incidencias/:id/estado` | Recibe solo `{estadoIncidencia}` |
| PATCH | `/api/incidencias/:id/anular` | Recibe `{motivo}` y conserva el historial |

POST de usuarios recibe `nombre` (nombre completo), `usuario`, `rol` y `password`; el servidor asigna siempre `activo: true`. PUT recibe `nombre`, `usuario`, `rol` y `activo` (booleano); `password` es opcional al editar. La tabla utiliza PUT para activar o desactivar y el formulario conserva el estado existente al editar. Los nombres de usuario son únicos, con 3–40 caracteres: minúsculas, números, punto, guion y guion bajo. Las contraseñas se almacenan como hashes bcrypt; nunca se devuelven hashes ni JWT en el JSON.

POST/PUT de incidencias reciben `fechaHecho`, `horaHecho`, `grado`, `tipoFalta`, `lugarHecho`, `descripcionHechos`, `nombreReportante`, `origenReporte`, `estadoIncidencia`, `involucrados [{rol, nombre, esConfidencial}]`, `apoderadoAfectado`, `apoderadoInvolucrado`, `medida` y `observaciones`. El servidor controla `id`, `usuarioRegistroId`, `fechaUltimoCambio`, `historial` y `anulacion`. Los campos protegidos del GET marcados con `oculto` no deben reenviarse al editar.

Los estados modificables son Pendiente, En revisión y Atendido. Anulado se asigna exclusivamente desde el endpoint de anulación. Se validan obligatorios, fechas reales no futuras, al menos un Afectado o Agresor y apoderado del afectado. Respuestas: 201 al crear, 204 al cerrar sesión, 400 por datos inválidos, 401 sin sesión válida, 403 sin permiso, 404 para un registro inexistente o no visible, 409 por usuario duplicado o incidencia anulada y 429 por exceso de intentos de login.

## Seguridad de sesión

JWT HS256 con emisor, audiencia y vencimiento de ocho horas en cookie `httpOnly`, `SameSite=Strict` y `Secure` en producción. Las sesiones se registran en memoria para revocarlas al cerrar sesión; los cambios de cuenta invalidan los JWT previos. La API devuelve `Cache-Control: no-store`.

Todas las escrituras, incluido login/logout, requieren `X-SICE-Request: 1`; si existe `Origin`, debe coincidir con `APP_ORIGIN`. Los cuerpos se envían como JSON. La política CORS admite únicamente ese origen y se utiliza el mismo origen para frontend y API. El login limita a diez intentos por IP en quince minutos. No se configura confianza en proxies externos; debe revisarse antes de desplegar detrás de un proxy.

## Estructura y pruebas

`database/schema.sql` contiene el diseño físico simplificado para revisión en ERwin: 15 tablas (las 12 originales más HISTORIAL_AULA, ATENCION_MEDIDA e HISTORIAL_MEDIDA), claves y restricciones. Conserva dos índices UNIQUE filtrados para integridad; no incluye triggers ni índices adicionales de rendimiento. Las validaciones de negocio, la auditoría y la protección de históricos deberán aplicarse en Node.js mediante transacciones, según [database/VALIDACIONES.md](database/VALIDACIONES.md). Esa integración todavía no existe: actualmente los repositorios siguen en memoria.

El SQL se verificó estáticamente con Microsoft ScriptDom, sin conectarse ni ejecutar sentencias. Mantiene las columnas y restricciones de sus 15 tablas; pasó de 593 a 356 líneas al separar las reglas del backend. La validación en el motor y en ERwin queda pendiente; no es una migración ni forma parte del arranque. Incluye Muy Grave y permisos multiaula como requisitos futuros, todavía no implementados en la interfaz/API.

`public/` contiene la interfaz. `src/routes/` define endpoints, `src/controllers/` valida y coordina operaciones, `src/middlewares/auth.js` autentica y restringe roles, `src/services/incidencias.permisos.js` aplica permisos por registro y filtra testigos, y `src/repositories/` mantiene los datos en memoria. `src/config/db.js` conserva el conector mssql para la integración posterior. Dependencias añadidas para autenticación: bcryptjs, jsonwebtoken y cookie-parser.

- `npm test`: pruebas HTTP de los cinco roles, autenticación, usuarios, permisos por registro, confidencialidad y anulación. Usa secretos efímeros y datos de prueba; no lee `.env`.
- `npm run test:ui`: prueba con Chrome/Edge sin ventana visible, en perfil temporal y servidor aislado. Verifica login/logout, los cinco roles, registro, edición protegida, filtros, vista móvil, anulación y usuarios. Puede indicarse otra instalación mediante `CHROME_PATH`; requiere Node.js 22 o superior.

Para verificar manualmente: inicia sesión con cada cuenta y compara las acciones con la tabla de permisos; registra y edita un caso con testigo confidencial; anúlalo como supervisor y comprueba el motivo, responsable e historial. Reiniciar el servidor borra los datos y restablece las cinco cuentas semilla.
