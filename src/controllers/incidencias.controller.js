const repository = require('../repositories/incidencias.repository');
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
async function list(req, res) { res.json(await repository.listar()); }
async function create(req, res) {
  const body = req.body || {};
  const error = validarIncidencia(body);
  if (error) return res.status(400).json({ message: error });
  const campos = extraerCampos(body);
  campos.fechaUltimoCambio = new Date().toISOString();
  res.status(201).json(await repository.crear(campos));
}
async function update(req, res) {
  const id = Number(req.params.id);
  const actual = await repository.obtenerPorId(id);
  if (!actual) return res.status(404).json({ message: 'Incidencia no encontrada' });
  const error = validarIncidencia(req.body || {});
  if (error) return res.status(400).json({ message: error });
  const campos = extraerCampos(req.body);
  campos.fechaUltimoCambio = campos.estadoIncidencia !== actual.estadoIncidencia ? new Date().toISOString() : actual.fechaUltimoCambio;
  res.json(await repository.actualizar(id, campos));
}
async function changeStatus(req, res) {
  const id = Number(req.params.id);
  if (!await repository.obtenerPorId(id)) return res.status(404).json({ message: 'Incidencia no encontrada' });
  const body = req.body || {};
  if (Object.keys(body).some((key) => key !== 'estadoIncidencia') || !ESTADOS.includes(body.estadoIncidencia)) return res.status(400).json({ message: 'Envie solo estadoIncidencia: Pendiente, En revisión o Atendido' });
  res.json(await repository.cambiarEstado(id, body.estadoIncidencia, new Date().toISOString()));
}
module.exports = { list, create, update, changeStatus };
