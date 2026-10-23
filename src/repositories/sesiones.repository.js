const sesiones = new Map();
function crear(id, usuarioId, expira) { sesiones.set(id, { usuarioId, expira }); }
function obtener(id) {
  const sesion = sesiones.get(id);
  if (sesion && sesion.expira > Date.now()) return sesion;
  sesiones.delete(id);
  return null;
}
function eliminar(id) { sesiones.delete(id); }
const limpieza = setInterval(() => {
  for (const id of sesiones.keys()) obtener(id);
}, 60_000);
limpieza.unref();
module.exports = { crear, obtener, eliminar };
