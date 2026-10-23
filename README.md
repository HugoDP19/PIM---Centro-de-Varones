# Sistema de Convivencia Escolar - I.E.P. N.° 20874 'Centro de Varones'

Este proyecto es un sistema integral para la gestión y seguimiento de la convivencia escolar en la Institución Educativa Pública N.° 20874 'Centro de Varones', ubicada en San Vicente de Cañete. El sistema permite registrar, monitorear y gestionar incidencias disciplinarias de manera digital.

---

## 🚀 Estado Actual del Proyecto

El proyecto se encuentra en una fase de **prototipado funcional avanzado**. Se ha implementado tanto la estructura del backend (API REST) como una interfaz de usuario interactiva (Frontend).

> **Nota técnica:** Actualmente, el sistema utiliza almacenamiento en memoria (tanto en el frontend como en el backend) para facilitar las pruebas de interfaz y flujo de datos sin depender de una base de datos activa, aunque ya cuenta con el módulo de conexión para SQL Server preparado.

---

## ✨ Características Principales

### 🖥️ Frontend (Interfaz de Usuario)
- **Panel de Control (Dashboard):** Indicadores rápidos que muestran el total de casos registrados hoy y los casos pendientes de atención.
- **Formulario de Registro Completo:** Permite capturar información detallada:
    - Datos del hecho (fecha, hora, lugar, descripción).
    - Nivel y grado (Primaria/Secundaria).
    - Tipo de falta (Leve/Grave).
    - Involucrados (Estudiante afectado, estudiante agresor, apoderados, testigos).
    - Persona que reporta y origen del reporte.
    - Estado de la incidencia y medidas disciplinarias.
- **Validación en Tiempo Real:** Asegura que los datos obligatorios estén presentes y que las fechas sean coherentes.
- **Gestión de Testigos:** Opción para marcar testigos como "Confidenciales", protegiendo su identidad en el sistema.
- **Tabla de Registros Recientes:** Visualización dinámica de las incidencias con capacidad de ver detalles expandibles y cambiar el estado directamente desde la tabla.
- **Edición de Registros:** Permite retomar un registro existente para actualizar su información.

### ⚙️ Backend (API REST)
- **Arquitectura Modular:** Dividido en Rutas, Controladores y Repositorios para una mejor mantenibilidad.
- **Seguridad y CORS:** Configurado para permitir peticiones desde diferentes orígenes.
- **Gestión de Entorno:** Uso de variables de entorno para configuración flexible.
- **Endpoints Implementados:**
    - `Health Check`: Para verificar el estado del servidor y la conexión a la base de datos.
    - `Incidencias`: Endpoints para listar y crear incidencias.

---

## 🛠️ Cómo Funciona (Detalle Técnico)

### Arquitectura del Sistema
El sistema sigue un flujo de datos estándar:
1. El **Usuario** interactúa con el formulario en el navegador (`public/index.html`).
2. El script **Frontend** (`public/app.js`) valida los datos y los envía (o simula el envío) a la API.
3. El **Servidor Express** (`src/app.js`) recibe la petición y la deriva al controlador correspondiente.
4. El **Controlador** (`src/controllers/`) procesa la lógica de negocio y llama al repositorio.
5. El **Repositorio** (`src/repositories/`) maneja el acceso a los datos (actualmente en memoria, preparado para SQL Server).

### Estructura de Archivos (Con Comentarios)
```text
/
├── public/                 # Archivos estáticos del Frontend
│   ├── index.html          # Interfaz principal (Bootstrap 5)
│   ├── estilo.css          # Estilos personalizados y variables de diseño
│   └── app.js              # Lógica del cliente (Validación, Renderizado, Mock API)
├── src/                    # Código fuente del Backend (Node.js)
│   ├── app.js              # Configuración principal de Express y Middlewares
│   ├── server.js           # Punto de entrada (levanta el servidor)
│   ├── config/             # Configuraciones globales
│   │   └── db.js           # Conector para SQL Server (mssql)
│   ├── controllers/        # Lógica de respuesta a peticiones HTTP
│   │   ├── health.controller.js
│   │   └── incidencias.controller.js
│   ├── repositories/       # Abstracción del acceso a datos (Patrón Repository)
│   │   └── incidencias.repository.js
│   └── routes/             # Definición de rutas y endpoints
│       ├── index.js        # Enrutador principal
│       ├── health.routes.js
│       └── incidencias.routes.js
├── images/                 # Recursos gráficos (Escudo institucional)
├── .env.example            # Plantilla de variables de configuración
└── package.json            # Dependencias y scripts del proyecto
```

---

## 📡 API Endpoints

| Método | Ruta | Descripción | Comentario |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Estado del servidor | Verifica que la API esté activa. |
| `GET` | `/api/health?db=true` | Prueba de DB | Intenta una consulta a SQL Server. |
| `GET` | `/api/incidencias` | Listar incidencias | Retorna la lista de casos registrados. |
| `POST` | `/api/incidencias` | Crear incidencia | Devuelve 201; el servidor genera id y fechaUltimoCambio. |
| `PUT` | `/api/incidencias/:id` | Editar incidencia | Reemplaza los campos del formulario; actualiza fechaUltimoCambio si cambia el estado. |
| `PATCH` | `/api/incidencias/:id/estado` | Cambiar estado | Acepta solo estadoIncidencia y actualiza fechaUltimoCambio. |

POST y PUT reciben: fechaHecho, horaHecho, grado, tipoFalta, lugarHecho, descripcionHechos, nombreReportante, origenReporte, estadoIncidencia, involucrados [{rol, nombre, esConfidencial}], apoderadoAfectado, apoderadoInvolucrado, medida y observaciones. GET devuelve estos campos con id y fechaUltimoCambio (controlados por el servidor). Datos en memoria del servidor: se pierden al reiniciarlo.
Errores: 400 con {message} para datos invalidos; 404 para un id inexistente en PUT/PATCH. Estados admitidos: Pendiente, En revisión y Atendido.

---

## 🚀 Ejecución y Desarrollo

### Requisitos
- **Node.js 18+**
- **npm** (gestor de paquetes)

### Instalación
1. Clonar o descargar el proyecto.
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Configurar entorno:
   ```bash
   cp .env.example .env
   ```

### Comandos
- `npm run dev`: Inicia el servidor con **Nodemon** (reinicio automático al detectar cambios). Ideal para desarrollo.
- `npm start`: Inicia el servidor de forma estándar.

---

## 📝 Notas de Implementación
- **Bootstrap 5:** Se utiliza para un diseño responsivo y moderno sin escribir CSS complejo desde cero.
- **Interacción:** El sistema utiliza eventos de JavaScript para actualizar el DOM sin recargar la página (SPA-like behavior).
- **Escalabilidad:** La separación en controladores y repositorios permitirá cambiar el almacenamiento de "Memoria" a "SQL Server" modificando solo la capa de repositorio.
