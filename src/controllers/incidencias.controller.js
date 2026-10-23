const repository = require('../repositories/incidencias.repository');
const politica = require('../services/incidencias.permisos');
const { ESTADOS, validarIncidencia, extraerCampos } = require('../validators/incidencias');

async function list(req, res) {
  const registros = await repository.listar();
  res.json(registros.filter((registro) => politica.puedeVer(req.usuario, registro)).map((registro) => politica.presentar(req.usuario, registro)));
}
async function obtenerVisible(req, res) {
  const id = Number(req.params.id);
  const registro = Number.isSafeInteger(id) && id > 0 ? await repository.obtenerPorId(id) : null;
  if (!registro || !politica.puedeVer(req.usuario, registro)) {
    res.status(404).json({ message: 'Incidencia no encontrada' });
    return null;
  }
  return registro;
}
function evento(req, accion, anterior, nuevo, motivo) {
  return { accion, usuarioId: req.usuario.id, fecha: new Date().toISOString(), estadoAnterior: anterior, estadoNuevo: nuevo, ...(motivo ? { motivo } : {}) };
}
async function create(req, res) {
  const body = req.body || {};
  const error = validarIncidencia(body);
  if (error) return res.status(400).json({ message: error });
  const campos = extraerCampos(body);
  if (!politica.supervisor(req.usuario) && campos.estadoIncidencia !== 'Pendiente') return res.status(403).json({ message: 'Solo puedes registrar incidencias pendientes' });
  campos.usuarioRegistroId = req.usuario.id;
  campos.fechaUltimoCambio = new Date().toISOString();
  campos.historial = [evento(req, 'Registro', null, campos.estadoIncidencia)];
  res.status(201).json(politica.presentar(req.usuario, await repository.crear(campos)));
}
async function update(req, res) {
  const actual = await obtenerVisible(req, res);
  if (!actual) return;
  if (actual.estadoIncidencia === 'Anulado') return res.status(409).json({ message: 'Una incidencia anulada no puede modificarse' });
  if (!politica.permisos(req.usuario, actual).editar) return res.status(403).json({ message: 'No puedes editar esta incidencia' });
  const error = validarIncidencia(req.body || {});
  if (error) return res.status(400).json({ message: error });
  const campos = extraerCampos(req.body);
  if (!politica.supervisor(req.usuario)) {
    if (campos.estadoIncidencia !== actual.estadoIncidencia) return res.status(403).json({ message: 'No puedes cambiar el estado' });
    // Las identidades protegidas nunca se toman del cliente ni se eliminan por omisión.
    const protegidos = actual.involucrados.filter((persona) => persona.rol === 'Testigo' && persona.esConfidencial);
    campos.involucrados.push(...protegidos.map((persona) => ({ ...persona })));
  }
  campos.fechaUltimoCambio = campos.estadoIncidencia !== actual.estadoIncidencia ? new Date().toISOString() : actual.fechaUltimoCambio;
  campos.historial = [...actual.historial, evento(req, 'Edición', actual.estadoIncidencia, campos.estadoIncidencia)];
  res.json(politica.presentar(req.usuario, await repository.actualizar(actual.id, campos)));
}
async function changeStatus(req, res) {
  const actual = await obtenerVisible(req, res);
  if (!actual) return;
  if (actual.estadoIncidencia === 'Anulado') return res.status(409).json({ message: 'Una incidencia anulada no puede modificarse' });
  const body = req.body || {};
  if (Object.keys(body).some((key) => key !== 'estadoIncidencia') || !ESTADOS.includes(body.estadoIncidencia)) return res.status(400).json({ message: 'Envie solo estadoIncidencia: Pendiente, En revisión o Atendido' });
  const historial = [...actual.historial, evento(req, 'Cambio de estado', actual.estadoIncidencia, body.estadoIncidencia)];
  res.json(politica.presentar(req.usuario, await repository.cambiarEstado(actual.id, body.estadoIncidencia, new Date().toISOString(), historial)));
}
async function annul(req, res) {
  const actual = await obtenerVisible(req, res);
  if (!actual) return;
  if (actual.estadoIncidencia === 'Anulado') return res.status(409).json({ message: 'La incidencia ya está anulada' });
  const motivo = req.body?.motivo;
  if (typeof motivo !== 'string' || !motivo.trim() || motivo.length > 500) return res.status(400).json({ message: 'Indica un motivo de anulación (máximo 500 caracteres)' });
  const fecha = new Date().toISOString();
  const campos = {
    estadoIncidencia: 'Anulado', fechaUltimoCambio: fecha,
    anulacion: { motivo: motivo.trim(), usuarioId: req.usuario.id, fecha },
    historial: [...actual.historial, evento(req, 'Anulación', actual.estadoIncidencia, 'Anulado', motivo.trim())],
  };
  res.json(politica.presentar(req.usuario, await repository.actualizar(actual.id, campos)));
}
module.exports = { list, create, update, changeStatus, annul };
