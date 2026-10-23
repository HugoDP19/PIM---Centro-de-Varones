// Almacenamiento en memoria; reemplazable por un repositorio SQL Server.
const incidencias = [];
let siguienteId = 1;
async function listar() { return incidencias; }
async function obtenerPorId(id) { return incidencias.find((item) => item.id === id); }
async function crear(campos) {
  const registro = { ...campos, id: siguienteId++ };
  incidencias.unshift(registro);
  return registro;
}
async function actualizar(id, campos) {
  const registro = await obtenerPorId(id);
  if (!registro) return null;
  Object.assign(registro, campos);
  return registro;
}
async function cambiarEstado(id, estadoIncidencia, fechaUltimoCambio) {
  return actualizar(id, { estadoIncidencia, fechaUltimoCambio });
}
module.exports = { listar, obtenerPorId, crear, actualizar, cambiarEstado };
