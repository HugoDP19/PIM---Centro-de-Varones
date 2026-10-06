# Sistema de Convivencia Escolar - I.E. N° 20874 'Centro de Varones'

Prototipo inicial de la interfaz y API para el proyecto de convivencia escolar de la I.E. N° 20874, Centro de Varones.

## Estado del desarrollo

**Fase:** levantamiento inicial y prototipado base.

El proyecto se desarrollará progresivamente hasta diciembre. El modelo de datos diseñado en erwin está pendiente de revisión y validación por parte del instructor, y todavía no se cuenta con datos reales de estudiantes. Por ello, esta versión mantiene una interfaz de demostración, un endpoint de prueba y el módulo de conexión preparado para la futura base de datos.

El panel permite comprobar el estado del servidor y agregar registros visuales temporales en el navegador. Esos registros no se envían al backend ni se guardan; desaparecen al recargar la página. No se han definido reglas de negocio ni persistencia funcional de entidades. Las decisiones de estructura y comportamiento se incorporarán gradualmente después de las revisiones del modelo.

## Interfaz de demostración

La página principal se sirve desde `public/` e incluye el escudo institucional servido desde `images/images.jpg`, estado del servidor, métricas y un formulario demostrativo conectado únicamente al almacenamiento temporal en memoria del navegador. Los registros son ficticios y no deben usarse con datos personales.

## Requisitos técnicos

- Node.js 18 o superior.
- npm, incluido con Node.js.
- SQL Server solo es necesario para probar la conexión; el servidor y el endpoint básico pueden iniciarse sin una base disponible.

## Ejecución local

Desde la raíz del proyecto, instala dependencias y crea `.env` únicamente si aún no existe:

```powershell
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Completa en `.env` la configuración local de SQL Server si vas a probar esa conexión. No subas ese archivo: `.gitignore` excluye credenciales y conserva `.env.example` como plantilla.

Inicia el servidor en modo desarrollo:

```powershell
npm run dev
```

El servidor escucha en <http://localhost:3000>. Para ejecutarlo sin reinicio automático, usa `npm start`. La interfaz está en <http://localhost:3000> y el endpoint de prueba en <http://localhost:3000/api/health>.

## API actual

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/health` | Comprueba que el servicio responde. |
| `GET` | `/api/health?db=true` | Comprueba el servicio y prueba una consulta básica a SQL Server. |

La conexión se configura mediante variables de entorno y se abre al solicitar la comprobación con `db=true`. No se requiere modificar la conexión para iniciar el servidor.

## Variables de entorno

La plantilla `.env.example` documenta estas variables:

| Variable | Uso |
| --- | --- |
| `PORT` | Puerto HTTP; por defecto `3000`. |
| `DB_SERVER` | Servidor SQL Server. |
| `DB_PORT` | Puerto SQL Server; por defecto `1433`. |
| `DB_NAME` | Nombre de la base de datos. |
| `DB_USER` | Usuario de la base de datos. |
| `DB_PASSWORD` | Contraseña de la base de datos. |
| `DB_ENCRYPT` | Activa el cifrado de la conexión cuando vale `true`. |
| `DB_TRUST_CERT` | Confía en el certificado del servidor cuando vale `true`. |

## Estructura

```text
src/
  app.js                Configuración de Express y middleware
  server.js             Inicio del servidor
  config/db.js          Configuración de conexión SQL Server
  controllers/          Controladores HTTP
  routes/               Rutas de la API
public/
  index.html            Panel web de demostración
  app.js                Interactividad temporal del navegador
images/
  images.jpg            Escudo institucional
```

## Dependencias

Las dependencias directas se declaran en `package.json`. `package-lock.json` registra las versiones exactas resueltas, incluidas las dependencias transitivas, para que las instalaciones sean reproducibles. Ambos archivos deben mantenerse en el repositorio.
