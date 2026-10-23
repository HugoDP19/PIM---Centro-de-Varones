const { SUPERVISORES } = require('../config/roles');
function supervisor(usuario) { return SUPERVISORES.includes(usuario.rol); }
function puedeVer(usuario, registro) {
  if (usuario.rol === 'Administrador') return false;
  // Sin ASIGNACION_AULA todavía: Auxiliar ve todas las aulas en esta fase.
  return usuario.rol !== 'Docente' || registro.usuarioRegistroId === usuario.id;
}
function permisos(usuario, registro) {
  const disponible = registro.estadoIncidencia !== 'Anulado';
  return {
    editar: disponible && (supervisor(usuario) || (registro.usuarioRegistroId === usuario.id && registro.estadoIncidencia === 'Pendiente')),
    cambiarEstado: disponible && supervisor(usuario),
    anular: disponible && supervisor(usuario),
    verConfidenciales: supervisor(usuario),
  };
}
function presentar(usuario, registro) {
  const autorizaciones = permisos(usuario, registro);
  return {
    ...registro,
    involucrados: registro.involucrados.map((persona) => (
      persona.rol === 'Testigo' && persona.esConfidencial && !autorizaciones.verConfidenciales
        ? { rol: 'Testigo', esConfidencial: true, oculto: true }
        : { ...persona }
    )),
    permisos: autorizaciones,
  };
}
module.exports = { supervisor, puedeVer, permisos, presentar };
