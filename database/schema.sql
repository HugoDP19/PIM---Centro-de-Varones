-- SICE-Local: MySQL 8.0.16+ y MySQL Workbench. No ejecutado en un servidor.
-- Seleccionar un esquema vacío en Workbench antes de ejecutar este archivo.
-- Se conservan 15 tablas; los repositorios de la aplicación siguen en memoria.
-- UTC para fechas administrativas; calendario local para hechos y vigencias [inicio, fin).
-- Node.js generará codigo_incidencia antes de insertar; por ejemplo SICE- + UUID.
-- Sin triggers ni borrado en cascada. Reglas del backend: VALIDACIONES.md.
SET NAMES utf8mb4;

CREATE TABLE ROL (
    id_rol INT NOT NULL AUTO_INCREMENT,
    nombre_rol VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255) NULL,
    CONSTRAINT CK_ROL_nombre CHECK (nombre_rol IN
        ('Director', 'Coordinador de Tutoría', 'Auxiliar', 'Docente', 'Administrador')),
    CONSTRAINT PK_ROL PRIMARY KEY (id_rol),
    CONSTRAINT UQ_ROL_nombre UNIQUE (nombre_rol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
-- Únicos datos iniciales: catálogo de los cinco roles, sin personas ni documentos.
INSERT ROL (nombre_rol) VALUES ('Director'), ('Coordinador de Tutoría'),
    ('Auxiliar'), ('Docente'), ('Administrador');

CREATE TABLE USUARIO (
    id_usuario INT NOT NULL AUTO_INCREMENT,
    id_rol INT NOT NULL,
    tipo_documento VARCHAR(10) COLLATE utf8mb4_0900_as_cs NOT NULL,
    numero_documento VARCHAR(20) COLLATE utf8mb4_0900_as_ci NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    username VARCHAR(40) COLLATE utf8mb4_0900_as_cs NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    correo VARCHAR(254) NULL,
    telefono VARCHAR(20) NULL,
    activo BOOLEAN NOT NULL DEFAULT 1,
    version INT NOT NULL DEFAULT 1,
    CONSTRAINT UQ_USUARIO_documento UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT CK_USUARIO_documento CHECK (
        (tipo_documento = 'DNI' AND CHAR_LENGTH(numero_documento) = 8
            AND NOT REGEXP_LIKE(numero_documento, '[^0-9]', 'c'))
        OR (tipo_documento IN ('CE', 'Pasaporte') AND CHAR_LENGTH(numero_documento) BETWEEN 1 AND 20
            AND NOT REGEXP_LIKE(numero_documento, '[^0-9A-Za-z]', 'c'))),
    CONSTRAINT CK_USUARIO_documento_espacios CHECK (
        OCTET_LENGTH(numero_documento) = OCTET_LENGTH(TRIM(numero_documento))),
    CONSTRAINT FK_USUARIO_ROL FOREIGN KEY (id_rol) REFERENCES ROL (id_rol),
    CONSTRAINT UQ_USUARIO_username UNIQUE (username),
    CONSTRAINT CK_USUARIO_username CHECK (CHAR_LENGTH(username) BETWEEN 3 AND 40
        AND NOT REGEXP_LIKE(username, '[^a-z0-9._-]', 'c')
        AND OCTET_LENGTH(username) = OCTET_LENGTH(TRIM(username))),
    CONSTRAINT CK_USUARIO_nombre CHECK (CHAR_LENGTH(TRIM(nombre_completo)) > 0),
    CONSTRAINT CK_USUARIO_hash CHECK (CHAR_LENGTH(password_hash) >= 60),
    CONSTRAINT CK_USUARIO_version CHECK (version >= 1),
    CONSTRAINT PK_USUARIO PRIMARY KEY (id_usuario),
    CONSTRAINT CK_USUARIO_activo_boolean CHECK (activo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE APODERADO (
    id_apoderado INT NOT NULL AUTO_INCREMENT,
    tipo_documento VARCHAR(10) COLLATE utf8mb4_0900_as_cs NOT NULL,
    numero_documento VARCHAR(20) COLLATE utf8mb4_0900_as_ci NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NULL,
    correo VARCHAR(254) NULL,
    direccion VARCHAR(200) NULL,
    activo BOOLEAN NOT NULL DEFAULT 1,
    CONSTRAINT UQ_APODERADO_documento UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT CK_APODERADO_documento CHECK (
        (tipo_documento = 'DNI' AND CHAR_LENGTH(numero_documento) = 8
            AND NOT REGEXP_LIKE(numero_documento, '[^0-9]', 'c'))
        OR (tipo_documento IN ('CE', 'Pasaporte') AND CHAR_LENGTH(numero_documento) BETWEEN 1 AND 20
            AND NOT REGEXP_LIKE(numero_documento, '[^0-9A-Za-z]', 'c'))),
    CONSTRAINT CK_APODERADO_documento_espacios CHECK (
        OCTET_LENGTH(numero_documento) = OCTET_LENGTH(TRIM(numero_documento))),
    CONSTRAINT CK_APODERADO_nombre CHECK (CHAR_LENGTH(TRIM(nombre_completo)) > 0),
    CONSTRAINT PK_APODERADO PRIMARY KEY (id_apoderado),
    CONSTRAINT CK_APODERADO_activo_boolean CHECK (activo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE ESTUDIANTE (
    id_estudiante INT NOT NULL AUTO_INCREMENT,
    tipo_documento VARCHAR(10) COLLATE utf8mb4_0900_as_cs NOT NULL,
    numero_documento VARCHAR(20) COLLATE utf8mb4_0900_as_ci NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    direccion VARCHAR(200) NULL,
    activo BOOLEAN NOT NULL DEFAULT 1,
    CONSTRAINT UQ_ESTUDIANTE_documento UNIQUE (tipo_documento, numero_documento),
    CONSTRAINT CK_ESTUDIANTE_documento CHECK (
        (tipo_documento = 'DNI' AND CHAR_LENGTH(numero_documento) = 8
            AND NOT REGEXP_LIKE(numero_documento, '[^0-9]', 'c'))
        OR (tipo_documento IN ('CE', 'Pasaporte') AND CHAR_LENGTH(numero_documento) BETWEEN 1 AND 20
            AND NOT REGEXP_LIKE(numero_documento, '[^0-9A-Za-z]', 'c'))),
    CONSTRAINT CK_ESTUDIANTE_documento_espacios CHECK (
        OCTET_LENGTH(numero_documento) = OCTET_LENGTH(TRIM(numero_documento))),
    CONSTRAINT CK_ESTUDIANTE_nombre CHECK (CHAR_LENGTH(TRIM(nombre_completo)) > 0),
    CONSTRAINT PK_ESTUDIANTE PRIMARY KEY (id_estudiante),
    CONSTRAINT CK_ESTUDIANTE_activo_boolean CHECK (activo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE AULA (
    id_aula INT NOT NULL AUTO_INCREMENT,
    nivel VARCHAR(20) NOT NULL,
    grado TINYINT NOT NULL,
    seccion VARCHAR(5) NOT NULL,
    turno VARCHAR(10) NOT NULL,
    anio_academico SMALLINT NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT 1,
    CONSTRAINT CK_AULA_nivel_grado CHECK (
        (nivel = 'Primaria' AND grado BETWEEN 1 AND 6)
        OR (nivel = 'Secundaria' AND grado BETWEEN 1 AND 5)),
    CONSTRAINT CK_AULA_seccion CHECK (CHAR_LENGTH(TRIM(seccion)) > 0),
    CONSTRAINT CK_AULA_turno CHECK (turno IN ('Mañana', 'Tarde')),
    CONSTRAINT CK_AULA_anio CHECK (anio_academico BETWEEN 1900 AND 9998),
    CONSTRAINT UQ_AULA_periodo UNIQUE (anio_academico, nivel, grado, seccion, turno),
    CONSTRAINT UQ_AULA_id_anio UNIQUE (id_aula, anio_academico),
    CONSTRAINT PK_AULA PRIMARY KEY (id_aula),
    CONSTRAINT CK_AULA_activo_boolean CHECK (activo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- Matrícula anual única: no se guarda un id_aula actual redundante.
CREATE TABLE MATRICULA (
    id_matricula INT NOT NULL AUTO_INCREMENT,
    id_estudiante INT NOT NULL,
    id_apoderado_principal INT NOT NULL,
    anio_academico SMALLINT NOT NULL,
    parentesco VARCHAR(50) NOT NULL,
    fecha_matricula DATE NOT NULL,
    situacion_matricula VARCHAR(30) NOT NULL DEFAULT 'Definitiva',
    CONSTRAINT FK_MATRICULA_ESTUDIANTE FOREIGN KEY (id_estudiante) REFERENCES ESTUDIANTE (id_estudiante),
    CONSTRAINT FK_MATRICULA_APODERADO FOREIGN KEY (id_apoderado_principal) REFERENCES APODERADO (id_apoderado),
    CONSTRAINT CK_MATRICULA_anio CHECK (anio_academico BETWEEN 1900 AND 9998),
    CONSTRAINT CK_MATRICULA_parentesco CHECK (CHAR_LENGTH(TRIM(parentesco)) > 0),
    CONSTRAINT CK_MATRICULA_situacion CHECK (CHAR_LENGTH(TRIM(situacion_matricula)) > 0),
    CONSTRAINT UQ_MATRICULA_estudiante_anio UNIQUE (id_estudiante, anio_academico),
    CONSTRAINT UQ_MATRICULA_id_anio UNIQUE (id_matricula, anio_academico),
    CONSTRAINT PK_MATRICULA PRIMARY KEY (id_matricula)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- El año compartido por las FK impide mezclar matrículas y aulas de distintos años.
CREATE TABLE HISTORIAL_AULA (
    id_historial_aula INT NOT NULL AUTO_INCREMENT,
    id_matricula INT NOT NULL,
    id_aula INT NOT NULL,
    anio_academico SMALLINT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NULL,
    periodo_abierto TINYINT GENERATED ALWAYS AS
        (CASE WHEN fecha_fin IS NULL THEN 1 ELSE NULL END) STORED,
    CONSTRAINT UQ_HA_abierto UNIQUE (id_matricula, periodo_abierto),
    CONSTRAINT FK_HA_MATRICULA FOREIGN KEY (id_matricula, anio_academico)
        REFERENCES MATRICULA (id_matricula, anio_academico),
    CONSTRAINT FK_HA_AULA FOREIGN KEY (id_aula, anio_academico)
        REFERENCES AULA (id_aula, anio_academico),
    CONSTRAINT CK_HA_anio CHECK (anio_academico BETWEEN 1900 AND 9998),
    CONSTRAINT CK_HA_periodo CHECK (
        fecha_inicio >= MAKEDATE(anio_academico, 1)
        AND fecha_inicio < MAKEDATE(anio_academico+1, 1)
        AND (fecha_fin IS NULL OR (fecha_fin > fecha_inicio
            AND fecha_fin <= MAKEDATE(anio_academico+1, 1)))),
    CONSTRAINT UQ_HA_inicio UNIQUE (id_matricula, fecha_inicio),
    CONSTRAINT PK_HISTORIAL_AULA PRIMARY KEY (id_historial_aula)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE ASIGNACION_AULA (
    id_asignacion INT NOT NULL AUTO_INCREMENT,
    id_aula INT NOT NULL,
    id_usuario INT NOT NULL,
    anio_academico SMALLINT NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NULL,
    CONSTRAINT FK_ASIGNACION_AULA FOREIGN KEY (id_aula, anio_academico)
        REFERENCES AULA (id_aula, anio_academico),
    CONSTRAINT FK_ASIGNACION_USUARIO FOREIGN KEY (id_usuario) REFERENCES USUARIO (id_usuario),
    CONSTRAINT CK_ASIGNACION_tipo CHECK (tipo IN ('Tutor', 'Auxiliar')),
    CONSTRAINT CK_ASIGNACION_anio CHECK (anio_academico BETWEEN 1900 AND 9998),
    CONSTRAINT CK_ASIGNACION_periodo CHECK (
        fecha_inicio >= MAKEDATE(anio_academico, 1)
        AND fecha_inicio < MAKEDATE(anio_academico+1, 1)
        AND (fecha_fin IS NULL OR (fecha_fin > fecha_inicio
            AND fecha_fin <= MAKEDATE(anio_academico+1, 1)))),
    CONSTRAINT UQ_ASIGNACION_inicio UNIQUE (id_usuario, id_aula, tipo, fecha_inicio),
    CONSTRAINT PK_ASIGNACION_AULA PRIMARY KEY (id_asignacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- Catálogo configurable del sistema; no constituye una clasificación oficial del Minedu.
CREATE TABLE TIPO_INCIDENCIA (
    id_tipo INT NOT NULL AUTO_INCREMENT,
    gravedad VARCHAR(20) NOT NULL,
    denominacion VARCHAR(100) NOT NULL,
    descripcion VARCHAR(1000) NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT 1,
    CONSTRAINT CK_TIPO_gravedad CHECK (gravedad IN ('Leve', 'Grave', 'Muy Grave')),
    CONSTRAINT CK_TIPO_textos CHECK (CHAR_LENGTH(TRIM(denominacion)) > 0 AND CHAR_LENGTH(TRIM(descripcion)) > 0),
    CONSTRAINT PK_TIPO_INCIDENCIA PRIMARY KEY (id_tipo),
    CONSTRAINT UQ_TIPO_denominacion UNIQUE (denominacion),
    CONSTRAINT CK_TIPO_INCIDENCIA_activo_boolean CHECK (activo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE INCIDENCIA (
    id_incidencia INT NOT NULL AUTO_INCREMENT,
    codigo_incidencia VARCHAR(50) NOT NULL,
    id_tipo INT NOT NULL,
    id_usuario_registro INT NOT NULL,
    id_usuario_modificacion INT NOT NULL,
    origen_reporte VARCHAR(50) NOT NULL,
    nombre_reportante VARCHAR(150) NOT NULL,
    tipo_persona_reportante VARCHAR(30) NOT NULL,
    fecha_hecho DATE NOT NULL,
    hora_hecho TIME NULL,
    lugar_hecho VARCHAR(100) NOT NULL,
    descripcion_hechos LONGTEXT NOT NULL,
    observaciones LONGTEXT NULL,
    estado_incidencia VARCHAR(30) NOT NULL DEFAULT 'Pendiente',
    fecha_registro DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    fecha_ultima_modificacion DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    id_usuario_anulacion INT NULL,
    fecha_anulacion DATETIME(3) NULL,
    motivo_anulacion VARCHAR(500) NULL,
    CONSTRAINT UQ_INCIDENCIA_codigo UNIQUE (codigo_incidencia),
    CONSTRAINT FK_INCIDENCIA_TIPO FOREIGN KEY (id_tipo) REFERENCES TIPO_INCIDENCIA (id_tipo),
    CONSTRAINT FK_INCIDENCIA_REGISTRO FOREIGN KEY (id_usuario_registro) REFERENCES USUARIO (id_usuario),
    CONSTRAINT FK_INCIDENCIA_MODIFICACION FOREIGN KEY (id_usuario_modificacion) REFERENCES USUARIO (id_usuario),
    CONSTRAINT FK_INCIDENCIA_ANULACION FOREIGN KEY (id_usuario_anulacion) REFERENCES USUARIO (id_usuario),
    CONSTRAINT CK_INCIDENCIA_estado CHECK (estado_incidencia IN ('Pendiente', 'En revisión', 'Atendido', 'Anulado')),
    CONSTRAINT CK_INCIDENCIA_origen CHECK (origen_reporte IN
        ('Docente', 'Tutor', 'Auxiliar', 'Directivo', 'Apoderado', 'Otro')),
    CONSTRAINT CK_INCIDENCIA_reportante CHECK (tipo_persona_reportante IN
        ('Estudiante', 'Docente', 'Padre de Familia', 'Personal', 'Otro')),
    CONSTRAINT CK_INCIDENCIA_textos CHECK (CHAR_LENGTH(TRIM(nombre_reportante)) > 0
        AND CHAR_LENGTH(TRIM(lugar_hecho)) > 0 AND CHAR_LENGTH(TRIM(descripcion_hechos)) > 0),
    CONSTRAINT CK_INCIDENCIA_fechas CHECK (fecha_ultima_modificacion >= fecha_registro),
    CONSTRAINT CK_INCIDENCIA_anulacion CHECK (
        (estado_incidencia = 'Anulado' AND id_usuario_anulacion IS NOT NULL
            AND fecha_anulacion IS NOT NULL AND motivo_anulacion IS NOT NULL
            AND CHAR_LENGTH(TRIM(motivo_anulacion)) > 0 AND fecha_anulacion >= fecha_registro)
        OR (estado_incidencia <> 'Anulado' AND id_usuario_anulacion IS NULL
            AND fecha_anulacion IS NULL AND motivo_anulacion IS NULL)),
    CONSTRAINT PK_INCIDENCIA PRIMARY KEY (id_incidencia),
    CONSTRAINT CK_INCIDENCIA_codigo CHECK (CHAR_LENGTH(TRIM(codigo_incidencia)) > 0),
    CONSTRAINT CK_INCIDENCIA_hora CHECK (hora_hecho IS NULL OR hora_hecho BETWEEN '00:00:00' AND '23:59:59')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- No se repite id_estudiante: se obtiene por MATRICULA.
CREATE TABLE INVOLUCRADO_INCIDENCIA (
    id_involucrado INT NOT NULL AUTO_INCREMENT,
    id_incidencia INT NOT NULL,
    id_matricula INT NULL,
    rol_involucrado VARCHAR(30) NOT NULL,
    tipo_persona VARCHAR(30) NOT NULL,
    nombre_persona VARCHAR(150) NULL,
    descargo LONGTEXT NULL,
    es_confidencial BOOLEAN NOT NULL DEFAULT 0,
    activo BOOLEAN NOT NULL DEFAULT 1,
    CONSTRAINT FK_INV_INCIDENCIA FOREIGN KEY (id_incidencia) REFERENCES INCIDENCIA (id_incidencia),
    CONSTRAINT FK_INV_MATRICULA FOREIGN KEY (id_matricula) REFERENCES MATRICULA (id_matricula),
    CONSTRAINT CK_INV_rol CHECK (rol_involucrado IN ('Agresor', 'Afectado', 'Testigo')),
    CONSTRAINT CK_INV_persona CHECK (
        (tipo_persona = 'Estudiante' AND id_matricula IS NOT NULL AND nombre_persona IS NULL)
        OR (tipo_persona IN ('Docente', 'Padre de Familia', 'Personal', 'Otro')
            AND id_matricula IS NULL AND nombre_persona IS NOT NULL AND CHAR_LENGTH(TRIM(nombre_persona)) > 0)),
    CONSTRAINT CK_INV_estudiante CHECK (rol_involucrado = 'Testigo' OR tipo_persona = 'Estudiante'),
    CONSTRAINT CK_INV_confidencial CHECK (es_confidencial = 0 OR rol_involucrado = 'Testigo'),
    CONSTRAINT PK_INVOLUCRADO_INCIDENCIA PRIMARY KEY (id_involucrado),
    CONSTRAINT CK_INVOLUCRADO_INCIDENCIA_es_confidencial_boolean CHECK (es_confidencial IN (0, 1)),
    CONSTRAINT CK_INVOLUCRADO_INCIDENCIA_activo_boolean CHECK (activo IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
CREATE UNIQUE INDEX UX_INV_estudiante_rol ON INVOLUCRADO_INCIDENCIA (id_incidencia, id_matricula, rol_involucrado)
;

CREATE TABLE HISTORIAL_INCIDENCIA (
    id_historial BIGINT NOT NULL AUTO_INCREMENT,
    id_incidencia INT NOT NULL,
    id_usuario INT NOT NULL,
    accion VARCHAR(30) NOT NULL,
    estado_anterior VARCHAR(30) NULL,
    estado_nuevo VARCHAR(30) NOT NULL,
    fecha_cambio DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    motivo VARCHAR(500) NULL,
    CONSTRAINT FK_HI_INCIDENCIA FOREIGN KEY (id_incidencia) REFERENCES INCIDENCIA (id_incidencia),
    CONSTRAINT FK_HI_USUARIO FOREIGN KEY (id_usuario) REFERENCES USUARIO (id_usuario),
    CONSTRAINT CK_HI_estados CHECK (
        (estado_anterior IS NULL OR estado_anterior IN ('Pendiente', 'En revisión', 'Atendido', 'Anulado'))
        AND estado_nuevo IN ('Pendiente', 'En revisión', 'Atendido', 'Anulado')),
    CONSTRAINT CK_HI_accion CHECK (
        (accion = 'Registro' AND estado_anterior IS NULL AND estado_nuevo <> 'Anulado')
        OR (accion = 'Edición' AND estado_anterior IS NOT NULL AND estado_anterior = estado_nuevo AND estado_nuevo <> 'Anulado')
        OR (accion = 'Cambio de estado' AND estado_anterior IS NOT NULL AND estado_anterior <> estado_nuevo
            AND estado_anterior <> 'Anulado' AND estado_nuevo <> 'Anulado')
        OR (accion = 'Anulación' AND estado_anterior IS NOT NULL AND estado_anterior <> 'Anulado'
            AND estado_nuevo = 'Anulado' AND motivo IS NOT NULL AND CHAR_LENGTH(TRIM(motivo)) > 0)),
    CONSTRAINT PK_HISTORIAL_INCIDENCIA PRIMARY KEY (id_historial)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE MEDIDA_DISCIPLINARIA (
    id_medida INT NOT NULL AUTO_INCREMENT,
    id_involucrado INT NOT NULL,
    id_usuario_responsable INT NOT NULL,
    id_usuario_modificacion INT NOT NULL,
    tipo_accion VARCHAR(100) NOT NULL,
    descripcion LONGTEXT NOT NULL,
    fecha_aplicacion DATE NOT NULL,
    fecha_citacion DATETIME(3) NULL,
    plazo_dias INT NOT NULL DEFAULT 0,
    estado_cumplimiento VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    observaciones LONGTEXT NULL,
    fecha_creacion DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    fecha_modificacion DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    CONSTRAINT FK_MEDIDA_INV FOREIGN KEY (id_involucrado) REFERENCES INVOLUCRADO_INCIDENCIA (id_involucrado),
    CONSTRAINT FK_MEDIDA_RESPONSABLE FOREIGN KEY (id_usuario_responsable) REFERENCES USUARIO (id_usuario),
    CONSTRAINT FK_MEDIDA_MODIFICACION FOREIGN KEY (id_usuario_modificacion) REFERENCES USUARIO (id_usuario),
    CONSTRAINT CK_MEDIDA_plazo CHECK (plazo_dias >= 0),
    CONSTRAINT CK_MEDIDA_estado CHECK (estado_cumplimiento IN ('Pendiente', 'En curso', 'Cumplida', 'Cancelada')),
    CONSTRAINT CK_MEDIDA_textos CHECK (CHAR_LENGTH(TRIM(tipo_accion)) > 0 AND CHAR_LENGTH(TRIM(descripcion)) > 0),
    CONSTRAINT CK_MEDIDA_fechas CHECK (fecha_modificacion >= fecha_creacion),
    CONSTRAINT PK_MEDIDA_DISCIPLINARIA PRIMARY KEY (id_medida)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- Varias atenciones por medida, con el representante que acudió en cada ocasión.
-- Nombre y parentesco son instantáneas deliberadas, no sustituyen el catálogo APODERADO.
-- NULL id_apoderado admite representante distinto del principal, sin inventar documentos.
CREATE TABLE ATENCION_MEDIDA (
    id_atencion INT NOT NULL AUTO_INCREMENT,
    id_medida INT NOT NULL,
    id_usuario_atencion INT NOT NULL,
    id_apoderado INT NULL,
    fecha_atencion DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    representante_nombre VARCHAR(150) NOT NULL,
    representante_parentesco VARCHAR(50) NOT NULL,
    acuerdos LONGTEXT NOT NULL,
    observaciones LONGTEXT NULL,
    CONSTRAINT FK_ATENCION_MEDIDA FOREIGN KEY (id_medida) REFERENCES MEDIDA_DISCIPLINARIA (id_medida),
    CONSTRAINT FK_ATENCION_USUARIO FOREIGN KEY (id_usuario_atencion) REFERENCES USUARIO (id_usuario),
    CONSTRAINT FK_ATENCION_APODERADO FOREIGN KEY (id_apoderado) REFERENCES APODERADO (id_apoderado),
    CONSTRAINT CK_ATENCION_textos CHECK (CHAR_LENGTH(TRIM(representante_nombre)) > 0
        AND CHAR_LENGTH(TRIM(representante_parentesco)) > 0 AND CHAR_LENGTH(TRIM(acuerdos)) > 0),
    CONSTRAINT PK_ATENCION_MEDIDA PRIMARY KEY (id_atencion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- Node.js debe guardar aquí cada versión de la medida, en la misma transacción.
CREATE TABLE HISTORIAL_MEDIDA (
    id_historial_medida BIGINT NOT NULL AUTO_INCREMENT,
    id_medida INT NOT NULL,
    id_usuario_cambio INT NOT NULL,
    accion VARCHAR(20) NOT NULL,
    fecha_cambio DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
    id_usuario_responsable INT NOT NULL,
    tipo_accion VARCHAR(100) NOT NULL,
    descripcion LONGTEXT NOT NULL,
    fecha_aplicacion DATE NOT NULL,
    fecha_citacion DATETIME(3) NULL,
    plazo_dias INT NOT NULL,
    estado_cumplimiento VARCHAR(20) NOT NULL,
    observaciones LONGTEXT NULL,
    CONSTRAINT FK_HM_MEDIDA FOREIGN KEY (id_medida) REFERENCES MEDIDA_DISCIPLINARIA (id_medida),
    CONSTRAINT FK_HM_USUARIO FOREIGN KEY (id_usuario_cambio) REFERENCES USUARIO (id_usuario),
    CONSTRAINT FK_HM_RESPONSABLE FOREIGN KEY (id_usuario_responsable) REFERENCES USUARIO (id_usuario),
    CONSTRAINT CK_HM_accion CHECK (accion IN ('Registro', 'Edición')),
    CONSTRAINT CK_HM_estado CHECK (estado_cumplimiento IN ('Pendiente', 'En curso', 'Cumplida', 'Cancelada')),
    CONSTRAINT CK_HM_plazo CHECK (plazo_dias >= 0),
    CONSTRAINT PK_HISTORIAL_MEDIDA PRIMARY KEY (id_historial_medida)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
