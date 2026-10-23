# SICE-Local — I.E.P. N.° 20874 «Centro de Varones»

Sistema de registro y seguimiento de incidencias de convivencia escolar. Usa Node.js, Express y una interfaz HTML con Bootstrap 5 y JavaScript. Los registros, usuarios, sesiones e historiales viven en memoria del servidor y se pierden al reiniciarlo. MySQL es el motor elegido para la persistencia futura; la conexión de los repositorios y la generación de PDF todavía no están implementadas.

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

`.env` no se versiona. `NODE_ENV=production` exige `APP_ORIGIN` con HTTPS y activa la cookie `Secure`. El servidor y los repositorios en memoria no necesitan una base de datos disponible. La configuración MySQL queda preparada para después: `DB_HOST`, `DB_PORT` (3306), `DB_NAME`, `DB_USER` y `DB_PASSWORD`; usa una cuenta propia con permisos mínimos. No cambies JWT_SECRET ni SEED_PASSWORD para adaptar el motor. `.env` no se modificó: revisa sus opciones de base de datos cuando se autorice la integración.

## Acceso y permisos

En cada inicio se crean cinco cuentas ficticias, con nombre completo, nombre de usuario y rol diferenciados. Todas toman inicialmente la contraseña de `SEED_PASSWORD`.

| Usuario | Rol |
| --- | --- |
| `director` | Director |
| `coordinador` | Coordinador de Tutoría |
| `auxiliar` | Auxiliar |
| `docente` | Docente |
| `administrador` | Administrador |

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
| GET | `/api/health` | Estado del servidor; `?db=true` comprueba MySQL solo si se solicita expresamente; no necesario para usar la aplicación |
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

`database/schema.sql` prepara 15 tablas para MySQL 8.0.16+ y MySQL Workbench, todas con InnoDB y utf8mb4. Se necesita 8.0.16 o posterior porque versiones anteriores no aplican los CHECK. Conserva 15 PK, 24 FK y la unicidad necesaria para documentos, matrículas e involucrados. No incluye triggers ni crea una base de datos automáticamente.

Las validaciones de negocio, auditoría y protección de históricos deberán aplicarse en Node.js mediante transacciones, según [database/VALIDACIONES.md](database/VALIDACIONES.md). El código único de incidencia deberá generarse en el servidor antes del INSERT. El periodo abierto de un aula se controla mediante una columna calculada y UNIQUE; los testigos externos aprovechan que MySQL admite varios NULL en UNIQUE.

Cuando se autorice la integración, crea un esquema vacío en MySQL Workbench, selecciónalo y abre schema.sql para revisarlo antes de ejecutarlo. Actualmente no se ejecutó en MySQL: solo se analizó su gramática y estructura. Tampoco es una migración de datos ni forma parte del arranque. Muy Grave y permisos multiaula siguen pendientes de integrar en interfaz/API.

El frontend carga scripts sencillos con defer, en el orden declarado en index.html: app.js (estado, navegación, tabla y modales), formulario.js (validación, testigos y guardado), api.js (HTTP y avisos), usuarios.js (gestión de cuentas) y sesion.js (login/logout e inicio). Comparten el estado de la misma pantalla; no hay framework ni compilación.

El backend conserva rutas, controladores y repositorios pequeños. `src/validators/incidencias.js` agrupa las reglas de entrada, `src/middlewares/auth.js` comprueba sesión y roles, y `src/services/incidencias.permisos.js` aplica permisos y confidencialidad por registro. `src/config/db.js` prepara un pool mysql2 reutilizable; ni importar el módulo ni iniciar el servidor abre conexiones. Solo una consulta explícita como /api/health?db=true intentaría conectar.

- `npm test`: pruebas HTTP de los cinco roles, autenticación, usuarios, permisos, confidencialidad y anulación, más verificaciones estáticas del esquema. Comprueba el arranque y simula el conector de salud sin conectarse a MySQL. Usa secretos efímeros y datos de prueba; no lee `.env`.
- `npm run test:ui`: prueba con Chrome/Edge sin ventana visible, en perfil temporal y servidor aislado. Verifica login/logout, los cinco roles, registro, edición protegida, filtros, vista móvil, anulación y usuarios. Puede indicarse otra instalación mediante `CHROME_PATH`; requiere Node.js 22 o superior.

Para verificar manualmente: inicia sesión con cada cuenta y compara las acciones con la tabla de permisos; registra y edita un caso con testigo confidencial; anúlalo como supervisor y comprueba el motivo, responsable e historial. Reiniciar el servidor borra los datos y restablece las cinco cuentas semilla.
