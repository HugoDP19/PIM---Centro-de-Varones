// Registros temporales en memoria. Más adelante se cargarán desde GET /api/incidencias.
// Nombres alineados al modelo: fechaHecho, horaHecho, lugarHecho, nombreReportante, origenReporte,
// descripcionHechos, estadoIncidencia e involucrados [{ rol, nombre, esConfidencial }].
const registros = [];

const form = document.querySelector('#record-form');
const recordRows = document.querySelector('#record-rows');
const emptyRecords = document.querySelector('#empty-records');
const successAlert = document.querySelector('#success-alert');
const fechaInput = document.querySelector('#record-fecha');
const statusAlert = document.querySelector('#status-alert');
const submitLabel = document.querySelector('#submit-label');
const cancelEditButton = document.querySelector('#cancel-edit');
const ESTADOS = ['Pendiente', 'En revisión', 'Atendido'];

// id del registro que se está editando (null = se está creando uno nuevo).
let editandoId = null;
let siguienteId = 1;
const afectadoInput = document.querySelector('#record-afectado');
const involucradoInput = document.querySelector('#record-involucrado');
const apoderadoAfectadoInput = document.querySelector('#record-apoderado-afectado');
const testigosInput = document.querySelector('#record-testigos');
const testigosBox = document.querySelector('#testigos-confidencial');
const testigosLista = document.querySelector('#testigos-lista');

function getLocalDateValue() {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' })
    .format(new Date(`${value}T12:00:00`));
}

function updateMetrics() {
  const today = getLocalDateValue();
  const hoy = registros.filter((registro) => registro.fechaHecho === today).length;
  const pendientes = registros.filter((registro) => registro.estadoIncidencia === 'Pendiente').length;

  document.querySelector('#today-count').textContent = String(hoy);
  document.querySelector('#pending-count').textContent = String(pendientes);
  document.querySelector('#record-total').textContent = `${registros.length} ${registros.length === 1 ? 'registro' : 'registros'}`;
}

// Crea una celda de texto simple (textContent evita inyectar HTML).
function textCell(text) {
  const cell = document.createElement('td');
  cell.textContent = text;
  return cell;
}

// Crea una celda con una etiqueta de color.
function chipCell(text, className) {
  const cell = document.createElement('td');
  const chip = document.createElement('span');
  chip.className = className;
  chip.textContent = text;
  cell.append(chip);
  return cell;
}

// Muestra "—" cuando un campo opcional está vacío.
const opcional = (valor) => valor || '—';

// Nombres de los involucrados de un rol. Un testigo confidencial nunca muestra su nombre.
function nombresPorRol(registro, rol) {
  const nombres = registro.involucrados
    .filter((i) => i.rol === rol)
    .map((i) => (i.esConfidencial ? 'Testigo confidencial' : i.nombre));
  return nombres.length ? nombres.join(', ') : '—';
}

// Fecha y hora legibles para mostrar el último cambio de estado.
function formatDateTime(value) {
  return new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

// Muestra un mensaje breve de confirmación sobre la tabla.
let statusTimer;
function showStatusMessage(message) {
  statusAlert.textContent = message;
  statusAlert.classList.remove('d-none');
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => statusAlert.classList.add('d-none'), 3500);
}

// TODO: reemplazar por fetch PATCH /api/incidencias/:id con { estadoIncidencia }.
function cambiarEstado(registro, nuevoEstado) {
  registro.estadoIncidencia = nuevoEstado;
  registro.fechaUltimoCambio = new Date().toISOString();
  renderRecords();
  showStatusMessage(`Estado actualizado a "${nuevoEstado}" (registro N.° ${registro.id}).`);
}

// Celda con la etiqueta del estado actual y el selector para cambiarlo.
function statusCell(registro) {
  const cell = chipCell(registro.estadoIncidencia, 'fault-chip status-chip');
  const select = document.createElement('select');
  select.className = 'form-select form-select-sm status-select';
  select.setAttribute('aria-label', `Cambiar estado del registro ${registro.id}`);
  ESTADOS.forEach((estado) => {
    const option = new Option(estado, estado, false, estado === registro.estadoIncidencia);
    select.append(option);
  });
  select.addEventListener('change', () => cambiarEstado(registro, select.value));
  cell.append(document.createElement('br'), select);
  return cell;
}

// Celda con el botón Editar.
function actionsCell(registro) {
  const cell = document.createElement('td');
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn btn-outline-school btn-edit';
  button.innerHTML = '<i class="bi bi-pencil-square me-1" aria-hidden="true"></i>Editar';
  button.addEventListener('click', () => iniciarEdicion(registro));
  cell.append(button);
  return cell;
}

// Celda con un resumen desplegable (<details>, sin librerías) para los datos menos importantes.
function detailCell(registro) {
  const cell = document.createElement('td');
  const box = document.createElement('details');
  box.className = 'detail-box';
  const summary = document.createElement('summary');
  summary.textContent = 'Ver detalle';
  const lista = document.createElement('dl');

  const items = [
    ['Descripción', registro.descripcionHechos],
    ['Hora del hecho', opcional(registro.horaHecho)],
    ['Apoderado del afectado', opcional(registro.apoderadoAfectado)],
    ['Apoderado del involucrado', opcional(registro.apoderadoInvolucrado)],
    ['Testigos', nombresPorRol(registro, 'Testigo')],
    ['Medida disciplinaria', opcional(registro.medida)],
    ['Observaciones', opcional(registro.observaciones)],
    ['Último cambio de estado', registro.fechaUltimoCambio ? formatDateTime(registro.fechaUltimoCambio) : '—'],
  ];
  items.forEach(([titulo, valor]) => {
    const dt = document.createElement('dt');
    dt.textContent = titulo;
    const dd = document.createElement('dd');
    dd.textContent = valor;
    lista.append(dt, dd);
  });

  box.append(summary, lista);
  cell.append(box);
  return cell;
}

function renderRecords() {
  recordRows.replaceChildren();
  emptyRecords.hidden = registros.length > 0;

  registros.forEach((registro, index) => {
    const row = document.createElement('tr');
    row.append(
      textCell(String(index + 1)),
      textCell(formatDate(registro.fechaHecho)),
      chipCell(registro.grado, 'level-chip'),
      textCell(nombresPorRol(registro, 'Afectado')),
      textCell(nombresPorRol(registro, 'Agresor')),
      chipCell(registro.tipoFalta, 'fault-chip'),
      textCell(registro.lugarHecho),
      textCell(`${registro.nombreReportante} (${registro.origenReporte})`),
      statusCell(registro),
      detailCell(registro),
      actionsCell(registro),
    );
    recordRows.append(row);
  });

  updateMetrics();
}

// Separa los testigos por coma, sin vacíos ni repetidos.
function leerNombresTestigos() {
  const nombres = testigosInput.value.split(',').map((n) => n.trim()).filter(Boolean);
  return [...new Set(nombres)];
}

// Marcas de confidencialidad por nombre; se conservan mientras el usuario sigue escribiendo.
const confidenciales = new Set();

// Muestra un checkbox "Confidencial" por testigo; si no hay testigos, el bloque se oculta.
function renderTestigos() {
  const nombres = leerNombresTestigos();
  testigosBox.classList.toggle('d-none', nombres.length === 0);
  testigosLista.replaceChildren();

  nombres.forEach((nombre, index) => {
    const id = `testigo-confidencial-${index}`;
    const item = document.createElement('div');
    item.className = 'form-check';

    const check = document.createElement('input');
    check.className = 'form-check-input';
    check.type = 'checkbox';
    check.id = id;
    check.checked = confidenciales.has(nombre);
    check.addEventListener('change', () => {
      if (check.checked) confidenciales.add(nombre);
      else confidenciales.delete(nombre);
    });

    const label = document.createElement('label');
    label.className = 'form-check-label';
    label.htmlFor = id;
    label.textContent = `${nombre} - Confidencial`;

    item.append(check, label);
    testigosLista.append(item);
  });
}

// Regla: al menos un estudiante (afectado o involucrado); si hay afectado, se pide su apoderado.
function validarEstudiantes() {
  const sinEstudiantes = !afectadoInput.value.trim() && !involucradoInput.value.trim();
  const mensaje = sinEstudiantes ? 'Ingresa al menos un estudiante' : '';
  afectadoInput.setCustomValidity(mensaje);
  involucradoInput.setCustomValidity(mensaje);

  const faltaApoderado = afectadoInput.value.trim() && !apoderadoAfectadoInput.value.trim();
  apoderadoAfectadoInput.setCustomValidity(faltaApoderado ? 'Campo obligatorio' : '');
}

// Prepara el formulario: fecha de hoy como valor y como máximo permitido.
function resetFormDefaults() {
  fechaInput.max = getLocalDateValue();
  fechaInput.value = getLocalDateValue();
  confidenciales.clear();
  renderTestigos();
}

// Vuelve al modo "crear": limpia el formulario y restaura los textos de los botones.
function salirDeEdicion() {
  editandoId = null;
  form.reset();
  form.classList.remove('was-validated');
  resetFormDefaults();
  submitLabel.textContent = 'Registrar incidencia';
  cancelEditButton.classList.add('d-none');
}

// Carga un registro en el formulario para editarlo.
// TODO: al conectar el backend, el guardado hará PUT /api/incidencias/:id.
function iniciarEdicion(registro) {
  form.reset();
  form.classList.remove('was-validated');
  successAlert.classList.add('d-none');
  editandoId = registro.id;

  const valores = {
    fechaHecho: registro.fechaHecho,
    horaHecho: registro.horaHecho,
    grado: registro.grado,
    tipoFalta: registro.tipoFalta,
    lugarHecho: registro.lugarHecho,
    descripcionHechos: registro.descripcionHechos,
    estudianteAfectado: registro.involucrados.find((i) => i.rol === 'Afectado')?.nombre,
    estudianteInvolucrado: registro.involucrados.find((i) => i.rol === 'Agresor')?.nombre,
    apoderadoAfectado: registro.apoderadoAfectado,
    apoderadoInvolucrado: registro.apoderadoInvolucrado,
    nombreReportante: registro.nombreReportante,
    origenReporte: registro.origenReporte,
    estadoIncidencia: registro.estadoIncidencia,
    medida: registro.medida,
    observaciones: registro.observaciones,
  };
  Object.entries(valores).forEach(([campo, valor]) => {
    form.elements[campo].value = valor ?? '';
  });

  // Testigos: se vuelven a escribir y se restauran sus marcas de confidencialidad.
  const testigos = registro.involucrados.filter((i) => i.rol === 'Testigo');
  testigosInput.value = testigos.map((t) => t.nombre).join(', ');
  confidenciales.clear();
  testigos.filter((t) => t.esConfidencial).forEach((t) => confidenciales.add(t.nombre));
  renderTestigos();

  submitLabel.textContent = 'Actualizar registro';
  cancelEditButton.classList.remove('d-none');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  afectadoInput.focus({ preventScroll: true });
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  form.classList.add('was-validated');

  // Un campo obligatorio con solo espacios no cuenta como lleno.
  form.querySelectorAll('input[type="text"][required], textarea[required]').forEach((campo) => {
    campo.setCustomValidity(campo.value.trim() ? '' : 'Campo obligatorio');
  });
  validarEstudiantes();

  if (!form.checkValidity()) {
    successAlert.classList.add('d-none');
    form.querySelector(':invalid')?.focus();
    return;
  }

  const data = new FormData(form);
  const texto = (campo) => String(data.get(campo) ?? '').trim();

  // Lista única de involucrados con su rol; los testigos llevan su marca de confidencialidad.
  const involucrados = [];
  if (texto('estudianteAfectado')) {
    involucrados.push({ rol: 'Afectado', nombre: texto('estudianteAfectado'), esConfidencial: false });
  }
  if (texto('estudianteInvolucrado')) {
    involucrados.push({ rol: 'Agresor', nombre: texto('estudianteInvolucrado'), esConfidencial: false });
  }
  leerNombresTestigos().forEach((nombre) => {
    involucrados.push({ rol: 'Testigo', nombre, esConfidencial: confidenciales.has(nombre) });
  });

  const campos = {
    fechaHecho: texto('fechaHecho'),
    horaHecho: texto('horaHecho'),
    lugarHecho: texto('lugarHecho'),
    nombreReportante: texto('nombreReportante'),
    origenReporte: texto('origenReporte'),
    descripcionHechos: texto('descripcionHechos'),
    estadoIncidencia: texto('estadoIncidencia'),
    involucrados,
    // Campos de apoyo del formulario; su ubicación final depende del modelo SQL.
    grado: texto('grado'),
    tipoFalta: texto('tipoFalta'),
    apoderadoAfectado: texto('apoderadoAfectado'),
    apoderadoInvolucrado: texto('apoderadoInvolucrado'),
    medida: texto('medida'),
    observaciones: texto('observaciones'),
  };

  let mensaje;
  if (editandoId === null) {
    // TODO: reemplazar por fetch POST /api/incidencias cuando el backend acepte los campos nuevos.
    registros.unshift({ id: siguienteId++, ...campos, fechaUltimoCambio: new Date().toISOString() });
    mensaje = 'Incidencia registrada correctamente en esta sesión del navegador.';
  } else {
    const registro = registros.find((r) => r.id === editandoId);
    const cambioEstado = registro.estadoIncidencia !== campos.estadoIncidencia;
    Object.assign(registro, campos);
    if (cambioEstado) registro.fechaUltimoCambio = new Date().toISOString();
    mensaje = `Registro N.° ${registro.id} actualizado correctamente.`;
  }

  renderRecords();
  salirDeEdicion();
  successAlert.textContent = mensaje;
  successAlert.classList.remove('d-none');
});

cancelEditButton.addEventListener('click', salirDeEdicion);
testigosInput.addEventListener('input', renderTestigos);
// Al escribir se limpia el aviso de validación; los campos de estudiantes se revalidan juntos.
form.addEventListener('input', (event) => {
  event.target.setCustomValidity?.('');
  if (form.classList.contains('was-validated')) validarEstudiantes();
});
resetFormDefaults();
renderRecords();
