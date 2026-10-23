const repository = require('../repositories/incidencias.repository');
const politica = require('../services/incidencias.permisos');
const ESTADOS = ['Pendiente', 'En revisión', 'Atendido'];
const camposTexto = ['fechaHecho', 'horaHecho', 'grado', 'tipoFalta', 'lugarHecho',
  'descripcionHechos', 'nombreReportante', 'origenReporte', 'estadoIncidencia',
  'apoderadoAfectado', 'apoderadoInvolucrado', 'medida', 'observaciones'];

function validarIncidencia(body) {
  for (const campo of ['fechaHecho', 'grado', 'tipoFalta', 'lugarHecho', 'descripcionHechos', 'nombreReportante', 'origenReporte', 'estadoIncidencia']) {
    if (typeof body[campo] !== 'string' || !body[campo].trim()) return `El campo ${campo} es obligatorio`;
  }
  for (const campo of camposTexto) {
    if (body[campo] != null && typeof body[campo] !== 'string') return `El campo ${campo} debe ser texto`;
  }
  const fecha = body.fechaHecho.trim();
  const date = new Date(`${fecha}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== fecha) return 'La fecha no es valida';
  const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' }).format(new Date());
  if (fecha > hoy) return 'La fecha no puede ser futura';
  if (!ESTADOS.includes(body.estadoIncidencia.trim())) return 'Estado invalido: use Pendiente, En revisión o Atendido';
  if (!['Leve', 'Grave'].includes(body.tipoFalta.trim())) return 'Tipo de falta invalido: use Leve o Grave';
  if (!/^[1-6]° Primaria$|^[1-5]° Secundaria$/.test(body.grado.trim())) return 'Nivel y grado invalidos';
  if (!['Aula', 'Patio', 'Pasillo o escalera', 'Servicios higiénicos', 'Ingreso o salida', 'Fuera del colegio', 'Medios virtuales', 'Otro'].includes(body.lugarHecho.trim())) return 'Lugar del hecho invalido';
  if (!['Docente', 'Tutor', 'Auxiliar', 'Directivo', 'Apoderado', 'Otro'].includes(body.origenReporte.trim())) return 'Origen del reporte invalido';
  if (body.horaHecho && !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.horaHecho)) return 'Hora del hecho invalida';
  if (!Array.isArray(body.involucrados) || body.involucrados.some((item) => !item || !['Afectado', 'Agresor', 'Testigo'].includes(item.rol) || typeof item.nombre !== 'string' || !item.nombre.trim() || typeof item.esConfidencial !== 'boolean')) return 'Involucrados invalidos: indique rol, nombre y esConfidencial';
  if (!body.involucrados.some((item) => ['Afectado', 'Agresor'].includes(item.rol))) return 'Ingresa al menos un estudiante (afectado o agresor)';
  if (body.involucrados.some((item) => item.rol === 'Afectado') && !body.apoderadoAfectado?.trim()) return 'El apoderado del afectado es obligatorio';
  for (const [campo, max] of [['nombreReportante', 100], ['apoderadoAfectado', 100], ['apoderadoInvolucrado', 100], ['medida', 120], ['observaciones', 180]]) {
    if ((body[campo] || '').length > max) return `${campo} no puede superar ${max} caracteres`;
  }
  if (body.involucrados.some((item) => item.rol !== 'Testigo' && item.nombre.length > 100)) return 'El nombre del estudiante no puede superar 100 caracteres';
  return null;
}
function extraerCampos(body) {
  const campos = Object.fromEntries(camposTexto.map((campo) => [campo, (body[campo] || '').trim()]));
  campos.involucrados = body.involucrados.map(({ rol, nombre, esConfidencial }) => ({ rol, nombre: nombre.trim(), esConfidencial }));
  return campos;
}
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
