-- SICE-Local: diseño físico para SQL Server 2016 SP1 o superior, esquema dbo.
-- NO ejecutado ni conectado a una instancia. No es una migración de datos existentes.
-- Requiere una base vacía seleccionada por el operador; no contiene CREATE DATABASE ni DROP.
-- 15 tablas: las 12 originales + HISTORIAL_AULA + ATENCION_MEDIDA + HISTORIAL_MEDIDA.
-- Las dos últimas conservan múltiples atenciones y versiones de medidas sin sobrescribirlas.
-- Fechas administrativas: DATETIME2(3) en UTC. Fechas del hecho y vigencias: calendario local.
-- Intervalos: [fecha_inicio, fecha_fin), fin exclusivo; NULL significa hasta acabar el año.
-- anio_academico se propaga solo para FK compuestas que impiden referencias entre años.
-- Las FK no eliminan en cascada. No se incluyen documentos, usuarios ni contraseñas ficticias.
-- El backend futuro debe:
-- * autenticar, comprobar activo/version, roles y último Administrador;
-- * insertar cabecera + estudiantes + medidas en una transacción y exigir al menos
--   un Afectado o Agresor. SQL Server no tiene restricciones diferidas entre tablas;
-- * establecer id_usuario_modificacion y fecha_ultima_modificacion desde el servidor;
-- * filtrar testigos confidenciales y participantes de otras aulas ANTES de serializar;
-- * para Auxiliar, consultar asignaciones vigentes HOY y aulas del hecho por HISTORIAL_AULA,
--   permitiendo todo el historial del mismo año, no solo hechos dentro de su vigencia;
-- * no devolver narraciones/acuerdos que revelen personas fuera de su ámbito autorizado;
-- * conservar revocación de sesiones en un almacén servidor (no se persisten JWT aquí).
-- Fuentes de sintaxis: https://learn.microsoft.com/sql/t-sql/statements/create-table-transact-sql
-- https://learn.microsoft.com/sql/relational-databases/triggers/create-dml-triggers-to-handle-multiple-rows-of-data

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET ARITHABORT ON;
SET NUMERIC_ROUNDABORT OFF;
GO

CREATE TABLE dbo.ROL (
    id_rol INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ROL PRIMARY KEY,
    nombre_rol NVARCHAR(50) NOT NULL CONSTRAINT UQ_ROL_nombre UNIQUE,
    descripcion NVARCHAR(255) NULL,
    CONSTRAINT CK_ROL_nombre CHECK (nombre_rol IN
        (N'Director', N'Coordinador de Tutoría', N'Auxiliar', N'Docente', N'Administrador'))
);
GO
-- Únicos datos iniciales: catálogo de los cinco roles, sin personas ni documentos.
INSERT dbo.ROL (nombre_rol) VALUES (N'Director'), (N'Coordinador de Tutoría'),
    (N'Auxiliar'), (N'Docente'), (N'Administrador');
GO

CREATE TABLE dbo.USUARIO (
    id_usuario INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_USUARIO PRIMARY KEY,
    id_rol INT NOT NULL,
    tipo_documento NVARCHAR(10) COLLATE Latin1_General_100_BIN2 NOT NULL,
    numero_documento NVARCHAR(20) COLLATE Latin1_General_100_CI_AS NOT NULL,
    CONSTRAINT UQ_USUARIO_documento UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT CK_USUARIO_documento CHECK (
        (tipo_documento = N'DNI' AND LEN(numero_documento) = 8
            AND numero_documento COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^0-9]%')
        OR (tipo_documento IN (N'CE', N'Pasaporte') AND LEN(numero_documento) BETWEEN 1 AND 20
            AND numero_documento COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^0-9A-Za-z]%')),
    CONSTRAINT CK_USUARIO_documento_espacios CHECK (
        DATALENGTH(numero_documento) = DATALENGTH(LTRIM(RTRIM(numero_documento)))),
    nombre_completo NVARCHAR(100) NOT NULL,
    username NVARCHAR(40) COLLATE Latin1_General_100_BIN2 NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    correo NVARCHAR(254) NULL,
    telefono NVARCHAR(20) NULL,
    activo BIT NOT NULL CONSTRAINT DF_USUARIO_activo DEFAULT (1),
    version INT NOT NULL CONSTRAINT DF_USUARIO_version DEFAULT (1),
    CONSTRAINT FK_USUARIO_ROL FOREIGN KEY (id_rol) REFERENCES dbo.ROL (id_rol),
    CONSTRAINT UQ_USUARIO_username UNIQUE (username),
    CONSTRAINT CK_USUARIO_username CHECK (LEN(username) BETWEEN 3 AND 40
        AND username NOT LIKE N'%[^a-z0-9._-]%'
        AND DATALENGTH(username) = DATALENGTH(LTRIM(RTRIM(username)))),
    CONSTRAINT CK_USUARIO_nombre CHECK (LEN(LTRIM(RTRIM(nombre_completo))) > 0),
    CONSTRAINT CK_USUARIO_hash CHECK (LEN(password_hash) >= 60),
    CONSTRAINT CK_USUARIO_version CHECK (version >= 1)
);
CREATE INDEX IX_USUARIO_rol_activo ON dbo.USUARIO (id_rol, activo);
GO

CREATE TABLE dbo.APODERADO (
    id_apoderado INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_APODERADO PRIMARY KEY,
    tipo_documento NVARCHAR(10) COLLATE Latin1_General_100_BIN2 NOT NULL,
    numero_documento NVARCHAR(20) COLLATE Latin1_General_100_CI_AS NOT NULL,
    CONSTRAINT UQ_APODERADO_documento UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT CK_APODERADO_documento CHECK (
        (tipo_documento = N'DNI' AND LEN(numero_documento) = 8
            AND numero_documento COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^0-9]%')
        OR (tipo_documento IN (N'CE', N'Pasaporte') AND LEN(numero_documento) BETWEEN 1 AND 20
            AND numero_documento COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^0-9A-Za-z]%')),
    CONSTRAINT CK_APODERADO_documento_espacios CHECK (
        DATALENGTH(numero_documento) = DATALENGTH(LTRIM(RTRIM(numero_documento)))),
    nombre_completo NVARCHAR(100) NOT NULL,
    telefono NVARCHAR(20) NULL,
    correo NVARCHAR(254) NULL,
    direccion NVARCHAR(200) NULL,
    activo BIT NOT NULL CONSTRAINT DF_APODERADO_activo DEFAULT (1),
    CONSTRAINT CK_APODERADO_nombre CHECK (LEN(LTRIM(RTRIM(nombre_completo))) > 0)
);
GO

CREATE TABLE dbo.ESTUDIANTE (
    id_estudiante INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ESTUDIANTE PRIMARY KEY,
    tipo_documento NVARCHAR(10) COLLATE Latin1_General_100_BIN2 NOT NULL,
    numero_documento NVARCHAR(20) COLLATE Latin1_General_100_CI_AS NOT NULL,
    CONSTRAINT UQ_ESTUDIANTE_documento UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT CK_ESTUDIANTE_documento CHECK (
        (tipo_documento = N'DNI' AND LEN(numero_documento) = 8
            AND numero_documento COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^0-9]%')
        OR (tipo_documento IN (N'CE', N'Pasaporte') AND LEN(numero_documento) BETWEEN 1 AND 20
            AND numero_documento COLLATE Latin1_General_100_BIN2 NOT LIKE N'%[^0-9A-Za-z]%')),
    CONSTRAINT CK_ESTUDIANTE_documento_espacios CHECK (
        DATALENGTH(numero_documento) = DATALENGTH(LTRIM(RTRIM(numero_documento)))),
    nombre_completo NVARCHAR(100) NOT NULL,
    direccion NVARCHAR(200) NULL,
    activo BIT NOT NULL CONSTRAINT DF_ESTUDIANTE_activo DEFAULT (1),
    CONSTRAINT CK_ESTUDIANTE_nombre CHECK (LEN(LTRIM(RTRIM(nombre_completo))) > 0)
);
GO

CREATE TABLE dbo.AULA (
    id_aula INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_AULA PRIMARY KEY,
    nivel NVARCHAR(20) NOT NULL,
    grado TINYINT NOT NULL,
    seccion NVARCHAR(5) NOT NULL,
    turno NVARCHAR(10) NOT NULL,
    anio_academico SMALLINT NOT NULL,
    activo BIT NOT NULL CONSTRAINT DF_AULA_activo DEFAULT (1),
    CONSTRAINT CK_AULA_nivel_grado CHECK (
        (nivel = N'Primaria' AND grado BETWEEN 1 AND 6)
        OR (nivel = N'Secundaria' AND grado BETWEEN 1 AND 5)),
    CONSTRAINT CK_AULA_seccion CHECK (LEN(LTRIM(RTRIM(seccion))) > 0),
    CONSTRAINT CK_AULA_turno CHECK (turno IN (N'Mañana', N'Tarde')),
    CONSTRAINT CK_AULA_anio CHECK (anio_academico BETWEEN 1900 AND 9998),
    CONSTRAINT UQ_AULA_periodo UNIQUE (anio_academico, nivel, grado, seccion, turno),
    CONSTRAINT UQ_AULA_id_anio UNIQUE (id_aula, anio_academico)
);
GO

-- Matrícula anual única: no se guarda un id_aula actual redundante.
CREATE TABLE dbo.MATRICULA (
    id_matricula INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MATRICULA PRIMARY KEY,
    id_estudiante INT NOT NULL,
    id_apoderado_principal INT NOT NULL,
    anio_academico SMALLINT NOT NULL,
    parentesco NVARCHAR(50) NOT NULL,
    fecha_matricula DATE NOT NULL,
    situacion_matricula NVARCHAR(30) NOT NULL CONSTRAINT DF_MATRICULA_situacion DEFAULT (N'Definitiva'),
    CONSTRAINT FK_MATRICULA_ESTUDIANTE FOREIGN KEY (id_estudiante) REFERENCES dbo.ESTUDIANTE (id_estudiante),
    CONSTRAINT FK_MATRICULA_APODERADO FOREIGN KEY (id_apoderado_principal) REFERENCES dbo.APODERADO (id_apoderado),
    CONSTRAINT CK_MATRICULA_anio CHECK (anio_academico BETWEEN 1900 AND 9998),
    CONSTRAINT CK_MATRICULA_parentesco CHECK (LEN(LTRIM(RTRIM(parentesco))) > 0),
    CONSTRAINT CK_MATRICULA_situacion CHECK (LEN(LTRIM(RTRIM(situacion_matricula))) > 0),
    CONSTRAINT UQ_MATRICULA_estudiante_anio UNIQUE (id_estudiante, anio_academico),
    CONSTRAINT UQ_MATRICULA_id_anio UNIQUE (id_matricula, anio_academico)
);
CREATE INDEX IX_MATRICULA_apoderado ON dbo.MATRICULA (id_apoderado_principal);
GO

-- Tabla adicional 13. El año garantiza igualdad entre matrícula y aula mediante FK.
CREATE TABLE dbo.HISTORIAL_AULA (
    id_historial_aula INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HISTORIAL_AULA PRIMARY KEY,
    id_matricula INT NOT NULL,
    id_aula INT NOT NULL,
    anio_academico SMALLINT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NULL,
    CONSTRAINT FK_HA_MATRICULA FOREIGN KEY (id_matricula, anio_academico)
        REFERENCES dbo.MATRICULA (id_matricula, anio_academico),
    CONSTRAINT FK_HA_AULA FOREIGN KEY (id_aula, anio_academico)
        REFERENCES dbo.AULA (id_aula, anio_academico),
    CONSTRAINT CK_HA_anio CHECK (anio_academico BETWEEN 1900 AND 9998),
    CONSTRAINT CK_HA_periodo CHECK (
        fecha_inicio >= DATEFROMPARTS(anio_academico,1,1)
        AND fecha_inicio < DATEFROMPARTS(anio_academico+1,1,1)
        AND (fecha_fin IS NULL OR (fecha_fin > fecha_inicio
            AND fecha_fin <= DATEFROMPARTS(anio_academico+1,1,1)))),
    CONSTRAINT UQ_HA_inicio UNIQUE (id_matricula, fecha_inicio)
);
CREATE UNIQUE INDEX UX_HA_abierto ON dbo.HISTORIAL_AULA (id_matricula) WHERE fecha_fin IS NULL;
CREATE INDEX IX_HA_aula ON dbo.HISTORIAL_AULA (id_aula, fecha_inicio, fecha_fin) INCLUDE (id_matricula);
GO

CREATE TABLE dbo.ASIGNACION_AULA (
    id_asignacion INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ASIGNACION_AULA PRIMARY KEY,
    id_aula INT NOT NULL,
    id_usuario INT NOT NULL,
    anio_academico SMALLINT NOT NULL,
    tipo NVARCHAR(20) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NULL,
    CONSTRAINT FK_ASIGNACION_AULA FOREIGN KEY (id_aula, anio_academico)
        REFERENCES dbo.AULA (id_aula, anio_academico),
    CONSTRAINT FK_ASIGNACION_USUARIO FOREIGN KEY (id_usuario) REFERENCES dbo.USUARIO (id_usuario),
    CONSTRAINT CK_ASIGNACION_tipo CHECK (tipo IN (N'Tutor', N'Auxiliar')),
    CONSTRAINT CK_ASIGNACION_anio CHECK (anio_academico BETWEEN 1900 AND 9998),
    CONSTRAINT CK_ASIGNACION_periodo CHECK (
        fecha_inicio >= DATEFROMPARTS(anio_academico,1,1)
        AND fecha_inicio < DATEFROMPARTS(anio_academico+1,1,1)
        AND (fecha_fin IS NULL OR (fecha_fin > fecha_inicio
            AND fecha_fin <= DATEFROMPARTS(anio_academico+1,1,1)))),
    CONSTRAINT UQ_ASIGNACION_inicio UNIQUE (id_usuario, id_aula, tipo, fecha_inicio)
);
CREATE INDEX IX_ASIGNACION_vigencia ON dbo.ASIGNACION_AULA (id_usuario, tipo, fecha_inicio, fecha_fin)
    INCLUDE (id_aula, anio_academico);
CREATE INDEX IX_ASIGNACION_aula ON dbo.ASIGNACION_AULA (id_aula, anio_academico);
GO

-- Catálogo configurable del sistema; no constituye una clasificación oficial del Minedu.
CREATE TABLE dbo.TIPO_INCIDENCIA (
    id_tipo INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TIPO_INCIDENCIA PRIMARY KEY,
    gravedad NVARCHAR(20) NOT NULL,
    denominacion NVARCHAR(100) NOT NULL CONSTRAINT UQ_TIPO_denominacion UNIQUE,
    descripcion NVARCHAR(1000) NOT NULL,
    activo BIT NOT NULL CONSTRAINT DF_TIPO_activo DEFAULT (1),
    CONSTRAINT CK_TIPO_gravedad CHECK (gravedad IN (N'Leve', N'Grave', N'Muy Grave')),
    CONSTRAINT CK_TIPO_textos CHECK (LEN(LTRIM(RTRIM(denominacion))) > 0 AND LEN(LTRIM(RTRIM(descripcion))) > 0)
);
GO

CREATE TABLE dbo.INCIDENCIA (
    id_incidencia INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_INCIDENCIA PRIMARY KEY,
    codigo_incidencia AS (N'SICE-' + CONVERT(NVARCHAR(20), id_incidencia)) PERSISTED,
    id_tipo INT NOT NULL,
    id_usuario_registro INT NOT NULL,
    id_usuario_modificacion INT NOT NULL,
    origen_reporte NVARCHAR(50) NOT NULL,
    nombre_reportante NVARCHAR(150) NOT NULL,
    tipo_persona_reportante NVARCHAR(30) NOT NULL,
    fecha_hecho DATE NOT NULL,
    hora_hecho TIME(0) NULL,
    lugar_hecho NVARCHAR(100) NOT NULL,
    descripcion_hechos NVARCHAR(MAX) NOT NULL,
    observaciones NVARCHAR(MAX) NULL,
    estado_incidencia NVARCHAR(30) NOT NULL CONSTRAINT DF_INCIDENCIA_estado DEFAULT (N'Pendiente'),
    fecha_registro DATETIME2(3) NOT NULL CONSTRAINT DF_INCIDENCIA_registro DEFAULT (SYSUTCDATETIME()),
    fecha_ultima_modificacion DATETIME2(3) NOT NULL CONSTRAINT DF_INCIDENCIA_modificacion DEFAULT (SYSUTCDATETIME()),
    id_usuario_anulacion INT NULL,
    fecha_anulacion DATETIME2(3) NULL,
    motivo_anulacion NVARCHAR(500) NULL,
    CONSTRAINT UQ_INCIDENCIA_codigo UNIQUE (codigo_incidencia),
    CONSTRAINT FK_INCIDENCIA_TIPO FOREIGN KEY (id_tipo) REFERENCES dbo.TIPO_INCIDENCIA (id_tipo),
    CONSTRAINT FK_INCIDENCIA_REGISTRO FOREIGN KEY (id_usuario_registro) REFERENCES dbo.USUARIO (id_usuario),
    CONSTRAINT FK_INCIDENCIA_MODIFICACION FOREIGN KEY (id_usuario_modificacion) REFERENCES dbo.USUARIO (id_usuario),
    CONSTRAINT FK_INCIDENCIA_ANULACION FOREIGN KEY (id_usuario_anulacion) REFERENCES dbo.USUARIO (id_usuario),
    CONSTRAINT CK_INCIDENCIA_estado CHECK (estado_incidencia IN (N'Pendiente', N'En revisión', N'Atendido', N'Anulado')),
    CONSTRAINT CK_INCIDENCIA_origen CHECK (origen_reporte IN
        (N'Docente', N'Tutor', N'Auxiliar', N'Directivo', N'Apoderado', N'Otro')),
    CONSTRAINT CK_INCIDENCIA_reportante CHECK (tipo_persona_reportante IN
        (N'Estudiante', N'Docente', N'Padre de Familia', N'Personal', N'Otro')),
    CONSTRAINT CK_INCIDENCIA_textos CHECK (LEN(LTRIM(RTRIM(nombre_reportante))) > 0
        AND LEN(LTRIM(RTRIM(lugar_hecho))) > 0 AND LEN(LTRIM(RTRIM(descripcion_hechos))) > 0),
    CONSTRAINT CK_INCIDENCIA_fechas CHECK (fecha_ultima_modificacion >= fecha_registro),
    CONSTRAINT CK_INCIDENCIA_anulacion CHECK (
        (estado_incidencia = N'Anulado' AND id_usuario_anulacion IS NOT NULL
            AND fecha_anulacion IS NOT NULL AND motivo_anulacion IS NOT NULL
            AND LEN(LTRIM(RTRIM(motivo_anulacion))) > 0 AND fecha_anulacion >= fecha_registro)
        OR (estado_incidencia <> N'Anulado' AND id_usuario_anulacion IS NULL
            AND fecha_anulacion IS NULL AND motivo_anulacion IS NULL))
);
CREATE INDEX IX_INCIDENCIA_autor_fecha ON dbo.INCIDENCIA (id_usuario_registro, fecha_hecho);
CREATE INDEX IX_INCIDENCIA_estado_fecha ON dbo.INCIDENCIA (estado_incidencia, fecha_hecho);
CREATE INDEX IX_INCIDENCIA_tipo ON dbo.INCIDENCIA (id_tipo);
CREATE INDEX IX_INCIDENCIA_modificador ON dbo.INCIDENCIA (id_usuario_modificacion);
CREATE INDEX IX_INCIDENCIA_anulador ON dbo.INCIDENCIA (id_usuario_anulacion) WHERE id_usuario_anulacion IS NOT NULL;
GO

-- No se repite id_estudiante: se obtiene por MATRICULA.
CREATE TABLE dbo.INVOLUCRADO_INCIDENCIA (
    id_involucrado INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_INVOLUCRADO_INCIDENCIA PRIMARY KEY,
    id_incidencia INT NOT NULL,
    id_matricula INT NULL,
    rol_involucrado NVARCHAR(30) NOT NULL,
    tipo_persona NVARCHAR(30) NOT NULL,
    nombre_persona NVARCHAR(150) NULL,
    descargo NVARCHAR(MAX) NULL,
    es_confidencial BIT NOT NULL CONSTRAINT DF_INV_confidencial DEFAULT (0),
    activo BIT NOT NULL CONSTRAINT DF_INV_activo DEFAULT (1),
    CONSTRAINT FK_INV_INCIDENCIA FOREIGN KEY (id_incidencia) REFERENCES dbo.INCIDENCIA (id_incidencia),
    CONSTRAINT FK_INV_MATRICULA FOREIGN KEY (id_matricula) REFERENCES dbo.MATRICULA (id_matricula),
    CONSTRAINT CK_INV_rol CHECK (rol_involucrado IN (N'Agresor', N'Afectado', N'Testigo')),
    CONSTRAINT CK_INV_persona CHECK (
        (tipo_persona = N'Estudiante' AND id_matricula IS NOT NULL AND nombre_persona IS NULL)
        OR (tipo_persona IN (N'Docente', N'Padre de Familia', N'Personal', N'Otro')
            AND id_matricula IS NULL AND nombre_persona IS NOT NULL AND LEN(LTRIM(RTRIM(nombre_persona))) > 0)),
    CONSTRAINT CK_INV_estudiante CHECK (rol_involucrado = N'Testigo' OR tipo_persona = N'Estudiante'),
    CONSTRAINT CK_INV_confidencial CHECK (es_confidencial = 0 OR rol_involucrado = N'Testigo')
);
CREATE UNIQUE INDEX UX_INV_estudiante_rol ON dbo.INVOLUCRADO_INCIDENCIA (id_incidencia, id_matricula, rol_involucrado)
    WHERE id_matricula IS NOT NULL;
CREATE INDEX IX_INV_matricula ON dbo.INVOLUCRADO_INCIDENCIA (id_matricula, id_incidencia);
GO

CREATE TABLE dbo.HISTORIAL_INCIDENCIA (
    id_historial BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HISTORIAL_INCIDENCIA PRIMARY KEY,
    id_incidencia INT NOT NULL,
    id_usuario INT NOT NULL,
    accion NVARCHAR(30) NOT NULL,
    estado_anterior NVARCHAR(30) NULL,
    estado_nuevo NVARCHAR(30) NOT NULL,
    fecha_cambio DATETIME2(3) NOT NULL CONSTRAINT DF_HI_fecha DEFAULT (SYSUTCDATETIME()),
    motivo NVARCHAR(500) NULL,
    CONSTRAINT FK_HI_INCIDENCIA FOREIGN KEY (id_incidencia) REFERENCES dbo.INCIDENCIA (id_incidencia),
    CONSTRAINT FK_HI_USUARIO FOREIGN KEY (id_usuario) REFERENCES dbo.USUARIO (id_usuario),
    CONSTRAINT CK_HI_estados CHECK (
        (estado_anterior IS NULL OR estado_anterior IN (N'Pendiente', N'En revisión', N'Atendido', N'Anulado'))
        AND estado_nuevo IN (N'Pendiente', N'En revisión', N'Atendido', N'Anulado')),
    CONSTRAINT CK_HI_accion CHECK (
        (accion = N'Registro' AND estado_anterior IS NULL AND estado_nuevo <> N'Anulado')
        OR (accion = N'Edición' AND estado_anterior IS NOT NULL AND estado_anterior = estado_nuevo AND estado_nuevo <> N'Anulado')
        OR (accion = N'Cambio de estado' AND estado_anterior IS NOT NULL AND estado_anterior <> estado_nuevo
            AND estado_anterior <> N'Anulado' AND estado_nuevo <> N'Anulado')
        OR (accion = N'Anulación' AND estado_anterior IS NOT NULL AND estado_anterior <> N'Anulado'
            AND estado_nuevo = N'Anulado' AND motivo IS NOT NULL AND LEN(LTRIM(RTRIM(motivo))) > 0))
);
CREATE INDEX IX_HI_incidencia_fecha ON dbo.HISTORIAL_INCIDENCIA (id_incidencia, fecha_cambio, id_historial);
CREATE INDEX IX_HI_usuario ON dbo.HISTORIAL_INCIDENCIA (id_usuario);
GO

CREATE TABLE dbo.MEDIDA_DISCIPLINARIA (
    id_medida INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MEDIDA_DISCIPLINARIA PRIMARY KEY,
    id_involucrado INT NOT NULL,
    id_usuario_responsable INT NOT NULL,
    id_usuario_modificacion INT NOT NULL,
    tipo_accion NVARCHAR(100) NOT NULL,
    descripcion NVARCHAR(MAX) NOT NULL,
    fecha_aplicacion DATE NOT NULL,
    fecha_citacion DATETIME2(3) NULL,
    plazo_dias INT NOT NULL CONSTRAINT DF_MEDIDA_plazo DEFAULT (0),
    estado_cumplimiento NVARCHAR(20) NOT NULL CONSTRAINT DF_MEDIDA_estado DEFAULT (N'Pendiente'),
    observaciones NVARCHAR(MAX) NULL,
    fecha_creacion DATETIME2(3) NOT NULL CONSTRAINT DF_MEDIDA_creacion DEFAULT (SYSUTCDATETIME()),
    fecha_modificacion DATETIME2(3) NOT NULL CONSTRAINT DF_MEDIDA_modificacion DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_MEDIDA_INV FOREIGN KEY (id_involucrado) REFERENCES dbo.INVOLUCRADO_INCIDENCIA (id_involucrado),
    CONSTRAINT FK_MEDIDA_RESPONSABLE FOREIGN KEY (id_usuario_responsable) REFERENCES dbo.USUARIO (id_usuario),
    CONSTRAINT FK_MEDIDA_MODIFICACION FOREIGN KEY (id_usuario_modificacion) REFERENCES dbo.USUARIO (id_usuario),
    CONSTRAINT CK_MEDIDA_plazo CHECK (plazo_dias >= 0),
    CONSTRAINT CK_MEDIDA_estado CHECK (estado_cumplimiento IN (N'Pendiente', N'En curso', N'Cumplida', N'Cancelada')),
    CONSTRAINT CK_MEDIDA_textos CHECK (LEN(LTRIM(RTRIM(tipo_accion))) > 0 AND LEN(LTRIM(RTRIM(descripcion))) > 0),
    CONSTRAINT CK_MEDIDA_fechas CHECK (fecha_modificacion >= fecha_creacion)
);
CREATE INDEX IX_MEDIDA_involucrado ON dbo.MEDIDA_DISCIPLINARIA (id_involucrado);
CREATE INDEX IX_MEDIDA_responsable ON dbo.MEDIDA_DISCIPLINARIA (id_usuario_responsable);
CREATE INDEX IX_MEDIDA_modificador ON dbo.MEDIDA_DISCIPLINARIA (id_usuario_modificacion);
GO

-- Tabla adicional 14: varias atenciones/citaciones por medida y representantes históricos.
-- Nombre y parentesco son instantáneas deliberadas, no sustituyen el catálogo APODERADO.
-- NULL id_apoderado admite representante distinto del principal, sin inventar documentos.
CREATE TABLE dbo.ATENCION_MEDIDA (
    id_atencion INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ATENCION_MEDIDA PRIMARY KEY,
    id_medida INT NOT NULL,
    id_usuario_atencion INT NOT NULL,
    id_apoderado INT NULL,
    fecha_atencion DATETIME2(3) NOT NULL CONSTRAINT DF_ATENCION_fecha DEFAULT (SYSUTCDATETIME()),
    representante_nombre NVARCHAR(150) NOT NULL,
    representante_parentesco NVARCHAR(50) NOT NULL,
    acuerdos NVARCHAR(MAX) NOT NULL,
    observaciones NVARCHAR(MAX) NULL,
    CONSTRAINT FK_ATENCION_MEDIDA FOREIGN KEY (id_medida) REFERENCES dbo.MEDIDA_DISCIPLINARIA (id_medida),
    CONSTRAINT FK_ATENCION_USUARIO FOREIGN KEY (id_usuario_atencion) REFERENCES dbo.USUARIO (id_usuario),
    CONSTRAINT FK_ATENCION_APODERADO FOREIGN KEY (id_apoderado) REFERENCES dbo.APODERADO (id_apoderado),
    CONSTRAINT CK_ATENCION_textos CHECK (LEN(LTRIM(RTRIM(representante_nombre))) > 0
        AND LEN(LTRIM(RTRIM(representante_parentesco))) > 0 AND LEN(LTRIM(RTRIM(acuerdos))) > 0)
);
CREATE INDEX IX_ATENCION_medida_fecha ON dbo.ATENCION_MEDIDA (id_medida, fecha_atencion);
CREATE INDEX IX_ATENCION_usuario ON dbo.ATENCION_MEDIDA (id_usuario_atencion);
CREATE INDEX IX_ATENCION_apoderado ON dbo.ATENCION_MEDIDA (id_apoderado) WHERE id_apoderado IS NOT NULL;
GO

-- Tabla adicional 15: versiones de medidas; evita que una edición pierda acuerdos/plazos previos.
CREATE TABLE dbo.HISTORIAL_MEDIDA (
    id_historial_medida BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HISTORIAL_MEDIDA PRIMARY KEY,
    id_medida INT NOT NULL,
    id_usuario_cambio INT NOT NULL,
    accion NVARCHAR(20) NOT NULL,
    fecha_cambio DATETIME2(3) NOT NULL CONSTRAINT DF_HM_fecha DEFAULT (SYSUTCDATETIME()),
    id_usuario_responsable INT NOT NULL,
    tipo_accion NVARCHAR(100) NOT NULL,
    descripcion NVARCHAR(MAX) NOT NULL,
    fecha_aplicacion DATE NOT NULL,
    fecha_citacion DATETIME2(3) NULL,
    plazo_dias INT NOT NULL,
    estado_cumplimiento NVARCHAR(20) NOT NULL,
    observaciones NVARCHAR(MAX) NULL,
    CONSTRAINT FK_HM_MEDIDA FOREIGN KEY (id_medida) REFERENCES dbo.MEDIDA_DISCIPLINARIA (id_medida),
    CONSTRAINT FK_HM_USUARIO FOREIGN KEY (id_usuario_cambio) REFERENCES dbo.USUARIO (id_usuario),
    CONSTRAINT FK_HM_RESPONSABLE FOREIGN KEY (id_usuario_responsable) REFERENCES dbo.USUARIO (id_usuario),
    CONSTRAINT CK_HM_accion CHECK (accion IN (N'Registro', N'Edición')),
    CONSTRAINT CK_HM_estado CHECK (estado_cumplimiento IN (N'Pendiente', N'En curso', N'Cumplida', N'Cancelada')),
    CONSTRAINT CK_HM_plazo CHECK (plazo_dias >= 0)
);
CREATE INDEX IX_HM_medida_fecha ON dbo.HISTORIAL_MEDIDA (id_medida, fecha_cambio, id_historial_medida);
CREATE INDEX IX_HM_usuario ON dbo.HISTORIAL_MEDIDA (id_usuario_cambio);
CREATE INDEX IX_HM_responsable ON dbo.HISTORIAL_MEDIDA (id_usuario_responsable);
GO

-- Triggers set-based: cubren INSERT/UPDATE de múltiples filas.
-- UPDLOCK + HOLDLOCK protegen los rangos consultados contra solapamientos concurrentes.
-- Ante interbloqueo SQL Server revierte una transacción; el backend deberá reintentarla.

CREATE TRIGGER dbo.TR_USUARIO_control ON dbo.USUARIO AFTER UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id_usuario = d.id_usuario WHERE i.id_usuario IS NULL)
        THROW 51001, N'No se eliminan usuarios; desactive la cuenta.', 1;
    IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.id_usuario = i.id_usuario WHERE i.version <> d.version + 1)
        THROW 51002, N'Cada modificación debe incrementar version en uno.', 1;
    IF EXISTS (SELECT 1 FROM deleted d JOIN dbo.ROL r ON r.id_rol = d.id_rol
        WHERE r.nombre_rol = N'Administrador' AND d.activo = 1)
       AND NOT EXISTS (SELECT 1 FROM dbo.USUARIO u WITH (UPDLOCK, HOLDLOCK)
        JOIN dbo.ROL r ON r.id_rol = u.id_rol WHERE r.nombre_rol = N'Administrador' AND u.activo = 1)
        THROW 51003, N'Debe quedar al menos un Administrador activo.', 1;
END;
GO

CREATE TRIGGER dbo.TR_HISTORIAL_AULA_integridad ON dbo.HISTORIAL_AULA AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id_historial_aula = d.id_historial_aula
        WHERE i.id_historial_aula IS NULL)
        THROW 51004, N'No se elimina el historial de aulas.', 1;
    IF EXISTS (
        SELECT 1 FROM dbo.HISTORIAL_AULA a WITH (UPDLOCK, HOLDLOCK)
        JOIN dbo.HISTORIAL_AULA b WITH (UPDLOCK, HOLDLOCK) ON b.id_matricula = a.id_matricula
            AND a.id_historial_aula < b.id_historial_aula
        WHERE a.id_matricula IN (SELECT id_matricula FROM inserted)
          AND a.fecha_inicio < ISNULL(b.fecha_fin, DATEFROMPARTS(b.anio_academico+1,1,1))
          AND b.fecha_inicio < ISNULL(a.fecha_fin, DATEFROMPARTS(a.anio_academico+1,1,1)))
        THROW 51005, N'Los periodos de aula de una matrícula no pueden superponerse.', 1;
    -- Un traslado puede cerrar un intervalo, pero no cambiar el aula de hechos existentes.
    IF EXISTS (
        SELECT 1 FROM deleted d
        JOIN dbo.INVOLUCRADO_INCIDENCIA v WITH (UPDLOCK, HOLDLOCK) ON v.id_matricula = d.id_matricula
        JOIN dbo.INCIDENCIA c ON c.id_incidencia = v.id_incidencia
        WHERE c.fecha_hecho >= d.fecha_inicio AND (d.fecha_fin IS NULL OR c.fecha_hecho < d.fecha_fin)
          AND NOT EXISTS (SELECT 1 FROM inserted i WHERE i.id_historial_aula = d.id_historial_aula
            AND i.id_matricula = d.id_matricula AND i.id_aula = d.id_aula
            AND c.fecha_hecho >= i.fecha_inicio AND (i.fecha_fin IS NULL OR c.fecha_hecho < i.fecha_fin)))
        THROW 51006, N'El cambio alteraría el aula histórica de una incidencia.', 1;
END;
GO

CREATE TRIGGER dbo.TR_ASIGNACION_periodos ON dbo.ASIGNACION_AULA AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id_asignacion = d.id_asignacion WHERE i.id_asignacion IS NULL)
        THROW 51007, N'Conserve las asignaciones y cierre su vigencia.', 1;
    IF EXISTS (
        SELECT 1 FROM dbo.ASIGNACION_AULA a WITH (UPDLOCK, HOLDLOCK)
        JOIN dbo.ASIGNACION_AULA b WITH (UPDLOCK, HOLDLOCK) ON b.id_usuario = a.id_usuario
            AND b.id_aula = a.id_aula AND b.tipo = a.tipo AND a.id_asignacion < b.id_asignacion
        JOIN inserted i ON i.id_usuario = a.id_usuario AND i.id_aula = a.id_aula AND i.tipo = a.tipo
        WHERE a.fecha_inicio < ISNULL(b.fecha_fin, DATEFROMPARTS(b.anio_academico+1,1,1))
          AND b.fecha_inicio < ISNULL(a.fecha_fin, DATEFROMPARTS(a.anio_academico+1,1,1)))
        THROW 51008, N'No se permiten asignaciones duplicadas con vigencias superpuestas.', 1;
    -- La elegibilidad del rol se comprueba al asignar en el backend; una asignación
    -- histórica se conserva aunque el usuario cambie de rol posteriormente.
END;
GO

CREATE TRIGGER dbo.TR_INCIDENCIA_control ON dbo.INCIDENCIA AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id_incidencia = d.id_incidencia WHERE i.id_incidencia IS NULL)
        THROW 51009, N'Las incidencias se anulan; no se eliminan.', 1;
    IF EXISTS (SELECT 1 FROM deleted WHERE estado_incidencia = N'Anulado')
        THROW 51010, N'Una incidencia anulada es inmutable.', 1;
    IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.id_incidencia = i.id_incidencia
        WHERE i.id_usuario_registro <> d.id_usuario_registro OR i.fecha_registro <> d.fecha_registro)
        THROW 51011, N'El autor y la fecha de registro son inmutables.', 1;
    IF EXISTS (SELECT 1 FROM inserted i LEFT JOIN deleted d ON d.id_incidencia = i.id_incidencia
        WHERE d.id_incidencia IS NULL AND (i.estado_incidencia = N'Anulado' OR i.id_usuario_modificacion <> i.id_usuario_registro))
        THROW 51012, N'El registro inicial no puede estar anulado y debe identificar al autor.', 1;
    IF EXISTS (SELECT 1 FROM inserted WHERE fecha_hecho >
        CONVERT(DATE, SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'SA Pacific Standard Time'))
        THROW 51013, N'La fecha del hecho no puede ser futura.', 1;
    IF EXISTS (SELECT 1 FROM inserted i WHERE i.estado_incidencia = N'Anulado'
        AND i.id_usuario_anulacion <> i.id_usuario_modificacion)
        THROW 51014, N'La anulación debe identificar al usuario que la efectúa.', 1;
    IF EXISTS (
        SELECT 1 FROM inserted i JOIN dbo.INVOLUCRADO_INCIDENCIA v ON v.id_incidencia = i.id_incidencia
        WHERE v.id_matricula IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM dbo.HISTORIAL_AULA h WITH (UPDLOCK, HOLDLOCK) WHERE h.id_matricula = v.id_matricula
              AND i.fecha_hecho >= h.fecha_inicio AND (h.fecha_fin IS NULL OR i.fecha_hecho < h.fecha_fin)
              AND YEAR(i.fecha_hecho) = h.anio_academico))
        THROW 51015, N'La fecha debe tener un aula válida para cada matrícula involucrada.', 1;
    INSERT dbo.HISTORIAL_INCIDENCIA (id_incidencia, id_usuario, accion, estado_anterior, estado_nuevo, motivo)
    SELECT i.id_incidencia, i.id_usuario_modificacion,
        CASE WHEN d.id_incidencia IS NULL THEN N'Registro'
             WHEN i.estado_incidencia = N'Anulado' THEN N'Anulación'
             WHEN i.estado_incidencia <> d.estado_incidencia THEN N'Cambio de estado' ELSE N'Edición' END,
        d.estado_incidencia, i.estado_incidencia, i.motivo_anulacion
    FROM inserted i LEFT JOIN deleted d ON d.id_incidencia = i.id_incidencia;
END;
GO

CREATE TRIGGER dbo.TR_INV_integridad ON dbo.INVOLUCRADO_INCIDENCIA AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id_involucrado = d.id_involucrado WHERE i.id_involucrado IS NULL)
        THROW 51016, N'Conserve el involucrado y desactívelo cuando corresponda.', 1;
    IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.id_involucrado = i.id_involucrado
        WHERE i.id_incidencia <> d.id_incidencia
           OR ISNULL(i.id_matricula,0) <> ISNULL(d.id_matricula,0))
        THROW 51017, N'No se cambia la incidencia ni la matrícula de un involucrado existente.', 1;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.INCIDENCIA c ON c.id_incidencia = i.id_incidencia
        WHERE c.estado_incidencia = N'Anulado')
        THROW 51018, N'No se modifican involucrados de incidencias anuladas.', 1;
    IF EXISTS (
        SELECT 1 FROM inserted i JOIN dbo.INCIDENCIA c ON c.id_incidencia = i.id_incidencia
        WHERE i.id_matricula IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM dbo.HISTORIAL_AULA h WITH (UPDLOCK, HOLDLOCK)
            WHERE h.id_matricula = i.id_matricula AND c.fecha_hecho >= h.fecha_inicio
                AND (h.fecha_fin IS NULL OR c.fecha_hecho < h.fecha_fin)
                AND YEAR(c.fecha_hecho) = h.anio_academico))
        THROW 51019, N'La matrícula debe tener aula vigente en la fecha del hecho.', 1;
END;
GO

CREATE TRIGGER dbo.TR_MEDIDA_control ON dbo.MEDIDA_DISCIPLINARIA AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id_medida = d.id_medida WHERE i.id_medida IS NULL)
        THROW 51020, N'Conserve la medida; utilice el estado Cancelada.', 1;
    IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.id_medida = i.id_medida
        WHERE i.id_involucrado <> d.id_involucrado OR i.fecha_creacion <> d.fecha_creacion)
        THROW 51021, N'No se cambia el involucrado ni la fecha de creación de una medida.', 1;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.INVOLUCRADO_INCIDENCIA v ON v.id_involucrado = i.id_involucrado
        JOIN dbo.INCIDENCIA c ON c.id_incidencia = v.id_incidencia WHERE c.estado_incidencia = N'Anulado')
        THROW 51022, N'No se modifican medidas de incidencias anuladas.', 1;
    INSERT dbo.HISTORIAL_MEDIDA (id_medida, id_usuario_cambio, accion, id_usuario_responsable,
        tipo_accion, descripcion, fecha_aplicacion, fecha_citacion, plazo_dias, estado_cumplimiento, observaciones)
    SELECT i.id_medida, i.id_usuario_modificacion,
        CASE WHEN d.id_medida IS NULL THEN N'Registro' ELSE N'Edición' END, i.id_usuario_responsable,
        i.tipo_accion, i.descripcion, i.fecha_aplicacion, i.fecha_citacion, i.plazo_dias, i.estado_cumplimiento, i.observaciones
    FROM inserted i LEFT JOIN deleted d ON d.id_medida = i.id_medida;
END;
GO

CREATE TRIGGER dbo.TR_ATENCION_control ON dbo.ATENCION_MEDIDA AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted)
        THROW 51023, N'Las atenciones son históricas; registre otra atención para rectificar.', 1;
    IF EXISTS (SELECT 1 FROM inserted i JOIN dbo.MEDIDA_DISCIPLINARIA m ON m.id_medida = i.id_medida
        JOIN dbo.INVOLUCRADO_INCIDENCIA v ON v.id_involucrado = m.id_involucrado
        JOIN dbo.INCIDENCIA c ON c.id_incidencia = v.id_incidencia WHERE c.estado_incidencia = N'Anulado')
        THROW 51024, N'No se agregan atenciones a incidencias anuladas.', 1;
END;
GO

CREATE TRIGGER dbo.TR_HI_inmutable ON dbo.HISTORIAL_INCIDENCIA AFTER UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted)
        THROW 51025, N'El historial de incidencias no se edita ni se elimina.', 1;
END;
GO
CREATE TRIGGER dbo.TR_HM_inmutable ON dbo.HISTORIAL_MEDIDA AFTER UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted)
        THROW 51026, N'El historial de medidas no se edita ni se elimina.', 1;
END;
GO

-- Cierre de diseño:
-- 1. Un traslado cierra el intervalo anterior y abre el nuevo dentro de una transacción.
-- 2. No se altera la matrícula/estudiante/año de casos históricos: véase el trigger siguiente.
-- 3. Se conservan identidades reales; oculto/permisos son proyecciones del backend, no columnas.
-- 4. Los permisos multiaula y Muy Grave son requisitos futuros, NO funciones ya integradas.
-- 5. No se incluyen cuentas de aplicación SQL ni GRANT: definir mínimos privilegios al desplegar.
CREATE TRIGGER dbo.TR_MATRICULA_historia ON dbo.MATRICULA AFTER UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1 FROM deleted d LEFT JOIN inserted i ON i.id_matricula = d.id_matricula WHERE i.id_matricula IS NULL)
        THROW 51027, N'No se eliminan matrículas históricas.', 1;
    IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.id_matricula = i.id_matricula
        WHERE i.id_estudiante <> d.id_estudiante OR i.anio_academico <> d.anio_academico)
        THROW 51028, N'La identidad y el año de una matrícula son inmutables.', 1;
END;
GO

-- La definición de un aula ya utilizada tampoco se renombra retroactivamente.
CREATE TRIGGER dbo.TR_AULA_historia ON dbo.AULA AFTER UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1 FROM inserted i JOIN deleted d ON d.id_aula = i.id_aula
        WHERE (i.nivel <> d.nivel OR i.grado <> d.grado OR i.seccion <> d.seccion
            OR i.turno <> d.turno OR i.anio_academico <> d.anio_academico)
          AND (EXISTS (SELECT 1 FROM dbo.HISTORIAL_AULA h WHERE h.id_aula = d.id_aula)
            OR EXISTS (SELECT 1 FROM dbo.ASIGNACION_AULA a WHERE a.id_aula = d.id_aula)))
        THROW 51029, N'Conserve la definición de las aulas con historial o asignaciones.', 1;
END;
GO
