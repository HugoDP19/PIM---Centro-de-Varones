// Reglas de entrada del formulario, compartidas por crear y editar.
const ESTADOS = ['Pendiente', 'En revisión', 'Atendido'];
const camposTexto = ['fechaHecho', 'horaHecho', 'grado', 'tipoFalta', 'lugarHecho',
  'descripcionHechos', 'nombreReportante', 'origenReporte', 'estadoIncidencia',
  'apoderadoAfectado', 'apoderadoInvolucrado', 'medida', 'observaciones'];
const obligatorios = ['fechaHecho', 'grado', 'tipoFalta', 'lugarHecho',
  'descripcionHechos', 'nombreReportante', 'origenReporte', 'estadoIncidencia'];
const lugares = ['Aula', 'Patio', 'Pasillo o escalera', 'Servicios higiénicos',
  'Ingreso o salida', 'Fuera del colegio', 'Medios virtuales', 'Otro'];
const origenes = ['Docente', 'Tutor', 'Auxiliar', 'Directivo', 'Apoderado', 'Otro'];

function involucradoValido(persona) {
  if (!persona || !['Afectado', 'Agresor', 'Testigo'].includes(persona.rol)) return false;
  if (typeof persona.nombre !== 'string' || !persona.nombre.trim()) return false;
  return typeof persona.esConfidencial === 'boolean';
}

function validarIncidencia(body) {
  for (const campo of obligatorios) {
    if (typeof body[campo] !== 'string' || !body[campo].trim()) return `El campo ${campo} es obligatorio`;
  }
  for (const campo of camposTexto) {
    if (body[campo] != null && typeof body[campo] !== 'string') return `El campo ${campo} debe ser texto`;
  }
  const fecha = body.fechaHecho.trim();
  const date = new Date(`${fecha}T00:00:00Z`);
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === fecha;
  if (!fechaValida) return 'La fecha no es valida';
  const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Lima' }).format(new Date());
  if (fecha > hoy) return 'La fecha no puede ser futura';
  if (!ESTADOS.includes(body.estadoIncidencia.trim())) return 'Estado invalido: use Pendiente, En revisión o Atendido';
  if (!['Leve', 'Grave'].includes(body.tipoFalta.trim())) return 'Tipo de falta invalido: use Leve o Grave';
  if (!/^[1-6]° Primaria$|^[1-5]° Secundaria$/.test(body.grado.trim())) return 'Nivel y grado invalidos';
  if (!lugares.includes(body.lugarHecho.trim())) return 'Lugar del hecho invalido';
  if (!origenes.includes(body.origenReporte.trim())) return 'Origen del reporte invalido';
  if (body.horaHecho && !/^([01]\d|2[0-3]):[0-5]\d$/.test(body.horaHecho)) return 'Hora del hecho invalida';
  if (!Array.isArray(body.involucrados) || !body.involucrados.every(involucradoValido)) {
    return 'Involucrados invalidos: indique rol, nombre y esConfidencial';
  }
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

module.exports = { ESTADOS, validarIncidencia, extraerCampos };
