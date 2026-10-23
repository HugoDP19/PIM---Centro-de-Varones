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
    descargarPdf: puedeVer(usuario, registro),
    editar: disponible && (supervisor(usuario) || (registro.usuarioRegistroId === usuario.id && registro.estadoIncidencia === 'Pendiente')),
    cambiarEstado: disponible && supervisor(usuario),
    anular: disponible && supervisor(usuario),
    verConfidenciales: supervisor(usuario),
  };
}
function presentar(usuario, registro, paraPdf = false) {
  const autorizaciones = permisos(usuario, registro);
  const vista = {
    ...registro,
    involucrados: registro.involucrados.map((persona) => (
      persona.rol === 'Testigo' && persona.esConfidencial && !autorizaciones.verConfidenciales
        ? { rol: 'Testigo', esConfidencial: true, oculto: true }
        : { ...persona }
    )),
    permisos: autorizaciones,
  };
  if (paraPdf && !autorizaciones.verConfidenciales) ocultarReferencias(vista, registro);
  return vista;
}
// No trasladar a PDF referencias textuales exactas a una identidad protegida.
function ocultarReferencias(vista, original) {
  const nombres = original.involucrados
    .filter((persona) => persona.rol === 'Testigo' && persona.esConfidencial)
    .map((persona) => persona.nombre).filter(Boolean);
  function ocultar(texto) {
    if (!texto) return texto;
    for (const nombre of nombres) {
      const literal = nombre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      texto = texto.replace(new RegExp(literal, 'gi'), 'Testigo confidencial');
    }
    return texto;
  }
  for (const campo of ['descripcionHechos', 'medida', 'observaciones', 'nombreReportante',
    'apoderadoAfectado', 'apoderadoInvolucrado', 'lugarHecho']) vista[campo] = ocultar(vista[campo]);
  vista.involucrados = vista.involucrados.map((persona) => ({ ...persona, nombre: ocultar(persona.nombre) }));
  vista.historial = (vista.historial || []).map((evento) => ({ ...evento, motivo: ocultar(evento.motivo) }));
  if (vista.anulacion) vista.anulacion = { ...vista.anulacion, motivo: ocultar(vista.anulacion.motivo) };
}
module.exports = { supervisor, puedeVer, permisos, presentar };
