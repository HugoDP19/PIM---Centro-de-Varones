# Reglas del modelo y del backend

`schema.sql` es un diseño pendiente de integrar. No se ejecutó SQL ni se modificó Node.js. La aplicación actual sigue usando memoria. Quitar los triggers no elimina las reglas: su aplicación en SQL dependerá del backend cuando se implemente el Paso 5. Ejecutar escrituras directamente contra las tablas podría incumplirlas.

## Qué conserva SQL Server

- Las 15 tablas, sus columnas, 15 claves primarias y 24 claves foráneas, sin eliminaciones en cascada.
- Campos obligatorios, documentos válidos y únicos, nombres de usuario únicos, estados permitidos y coherencia entre estado Anulado y sus datos de anulación.
- Una matrícula por estudiante/año; igualdad de años entre matrícula, aula e historial mediante claves compuestas.
- Fechas de vigencia dentro del año y fin posterior al inicio. Los intervalos son [inicio, fin): un traslado puede terminar y comenzar el mismo día sin superponerse.
- Coherencia entre tipo de persona, matrícula, rol y confidencialidad del involucrado; datos del historial compatibles con su acción.
- Dos índices UNIQUE filtrados indispensables: un solo periodo de aula sin fecha de fin por matrícula y un solo involucrado por incidencia/matrícula/rol. El filtro permite varios testigos externos sin matrícula.
- Código único calculado como `SICE-` más el identificador de la incidencia. Se mantienen las opciones SET necesarias para este código y los índices filtrados.

Se retiraron los 22 índices de rendimiento explícitos; SQL Server conserva los índices asociados a PK/UNIQUE y los dos UNIQUE filtrados. Se decidirán índices adicionales cuando haya consultas y datos reales; las FK siguen vigentes aunque no tengan un índice propio.

## Qué debe validar Node.js al integrar SQL

| Operación | Regla que debe mantenerse |
| --- | --- |
| Modificar usuarios | Comprobar el rol Administrador y conservar al menos uno activo. Incrementar `version` en cada edición, revocar sesiones anteriores, guardar hashes bcrypt y nunca eliminar físicamente cuentas. La versión representa un número de cambios, no el tipo SQL `rowversion`. |
| Registrar una incidencia | Validar fecha no futura en el calendario de Lima y al menos un Afectado o Agresor. Asignar autor, fechas y usuario modificador desde la sesión; no aceptar esos valores del cliente ni crear incidencias anuladas. |
| Editar o anular | Aplicar permisos por autor, estado y rol. Autor y fecha de creación no cambian. Anular exige motivo, responsable y fecha; después se bloquean edición, reapertura y cambios en involucrados, medidas y atenciones. No borrar físicamente la incidencia. |
| Auditar incidencias | Guardar un evento en HISTORIAL_INCIDENCIA por creación, edición, cambio de estado o anulación, con actor y fecha del servidor. Actualizar la última modificación, incluyendo ediciones sin cambio de estado. No modificar ni borrar eventos anteriores. |
| Cambiar de aula | Impedir solapamientos en HISTORIAL_AULA: dos intervalos se superponen si cada inicio es anterior al fin del otro. Para un fin NULL, usar el inicio del siguiente año como límite. Cerrar el intervalo anterior y abrir el nuevo conservando la misma matrícula. |
| Asociar un estudiante | Exigir que su matrícula tenga un periodo de aula que incluya la fecha del hecho y pertenezca al mismo año. Revalidar esta condición cuando se corrija la fecha de una incidencia. |
| Conservar aulas históricas | No cambiar estudiante/año de una matrícula ni incidencia/matrícula de un involucrado existente. No eliminar periodos ni alterar el aula que corresponda a hechos ya registrados. Mantener nivel, grado, sección, turno y año de aulas utilizadas; desactivar registros en lugar de borrar el pasado. |
| Asignar aulas | Comprobar que el usuario esté autorizado para el tipo Tutor/Auxiliar. Evitar vigencias superpuestas para el mismo usuario/aula/tipo y conservar las asignaciones anteriores al cerrar su vigencia. |
| Consultar como Auxiliar | Buscar aulas asignadas actualmente y permitir su historial del mismo año académico. Determinar el aula de cada participante en la fecha del hecho; una incidencia puede tener varias aulas. Ocultar participantes, narraciones y acuerdos ajenos al ámbito autorizado. Esta restricción todavía no está implementada en la aplicación. |
| Proteger testigos | Solo Director y Coordinador pueden recibir identidades confidenciales. Conservar en el servidor las identidades omitidas por un editor sin permiso. Revisar también medidas, atenciones, acuerdos y cualquier respuesta que pudiera revelar esos nombres. No guardar JWT ni permisos calculados en estas tablas. |
| Gestionar medidas | Mantener medidas individuales por involucrado y no reasignar una medida a otra persona. Registrar cada versión en HISTORIAL_MEDIDA, con actor y fecha; conservar la creación original y actualizar la modificación. Cancelar en lugar de borrar, respetando incidencias anuladas. |
| Registrar atenciones | Guardar cada atención por separado con nombre y parentesco del representante en ese momento, acuerdos y FK opcional a APODERADO. No sobrescribir ni eliminar atenciones previas; una rectificación se registra como otra atención. |

## Transacciones y concurrencia

No basta con comprobar una condición y guardar después. La comprobación y la escritura deben formar una sola transacción, con rollback si falla cualquier paso:

- Incidencia, involucrados y evento de historial se guardan juntos. Medida y versión histórica también.
- Antes de cambiar una incidencia, sus involucrados, medidas o atenciones, bloquear su cabecera y comprobar el estado dentro de esa misma transacción. La anulación debe usar el mismo bloqueo para impedir cambios concurrentes en sus datos asociados.
- Para traslados, asignaciones y comprobaciones de aulas históricas, usar aislamiento SERIALIZABLE y bloquear los registros/rangos que se consultan hasta terminar. Así dos solicitudes simultáneas no pueden aprobar periodos incompatibles. Las operaciones sobre involucrados y fechas deben usar la misma coordinación.
- La protección del último Administrador también requiere comprobar y modificar dentro de una transacción serializada. Si hay un interbloqueo, reintentar la operación completa de forma limitada, nunca solo una escritura.
- Las fechas administrativas se guardan en UTC; fecha del hecho y vigencias representan días locales. El backend debe calcularlas con esa distinción.

Estas reglas deben verificarse con pruebas de integración, incluidas solicitudes concurrentes, antes de sustituir los repositorios en memoria. La cuenta SQL de la aplicación debe tener permisos mínimos y no permitir manipulación externa de historiales. No se incluyen usuarios SQL ni GRANT en este diseño.
