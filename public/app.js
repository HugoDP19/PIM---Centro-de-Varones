// Copia de lectura de la API para representar la tabla y aplicar filtros.
let registros = [];

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
const afectadoInput = document.querySelector('#record-afectado');
const involucradoInput = document.querySelector('#record-involucrado');
const apoderadoAfectadoInput = document.querySelector('#record-apoderado-afectado');
const testigosInput = document.querySelector('#record-testigos');
const testigosBox = document.querySelector('#testigos-confidencial');
const testigosLista = document.querySelector('#testigos-lista');

// Navegación local: conserva los registros y permite volver con el historial.
const tabs = [...document.querySelectorAll('[data-tab]')];
function mostrarPestana(id, enfocar = false) {
  const active = tabs.find((tab) => tab.dataset.tab === id) || tabs[0];
  tabs.forEach((tab) => {
    const selected = tab === active;
    tab.classList.toggle('active', selected);
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.dataset.tab).hidden = !selected;
  });
  if (location.hash !== `#${active.dataset.tab}`) location.hash = active.dataset.tab;
  if (enfocar) active.focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener('click', () => mostrarPestana(tab.dataset.tab));
  tab.addEventListener('keydown', (event) => {
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    mostrarPestana(tabs[next].dataset.tab, true);
  });
});
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-go-tab]');
  if (button) mostrarPestana(button.dataset.goTab, true);
});
window.addEventListener('hashchange', () => mostrarPestana(location.hash.slice(1)));
mostrarPestana(location.hash.slice(1));

const filters = document.querySelector('#record-filters');
for (const [filter, source] of [['estado', 'record-estado'], ['grado', 'record-grado'], ['tipo', 'record-tipoFalta']]) {
  const select = document.querySelector(`#filter-${filter}`);
  [...document.getElementById(source).options].filter((option) => option.value).forEach((option) => {
    select.append(new Option(option.textContent, option.value));
  });
}
filters.addEventListener('submit', (event) => event.preventDefault());
filters.addEventListener('input', renderRecords);
filters.addEventListener('change', renderRecords);
filters.addEventListener('reset', () => {
  filters.querySelectorAll('input, select').forEach((input) => { input.value = ''; });
  renderRecords();
});
function registrosFiltrados() {
  const value = (key) => document.getElementById(`filter-${key}`).value;
  const normalizar = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const query = normalizar(value('text').trim());
  return registros.filter((registro) => {
    const texto = [nombresPorRol(registro, 'Afectado'), nombresPorRol(registro, 'Agresor'), registro.lugarHecho, registro.nombreReportante].join(' ');
    return normalizar(texto).includes(query)
      && (!value('estado') || registro.estadoIncidencia === value('estado'))
      && (!value('grado') || registro.grado === value('grado'))
      && (!value('tipo') || registro.tipoFalta === value('tipo'))
      && (!value('desde') || registro.fechaHecho >= value('desde'))
      && (!value('hasta') || registro.fechaHecho <= value('hasta'));
  });
}

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

async function cambiarEstado(registro, nuevoEstado, select) {
  select.disabled = true;
  try {
    await api(`/api/incidencias/${registro.id}/estado`, 'PATCH', { estadoIncidencia: nuevoEstado });
    await cargarRegistros();
    showStatusMessage(`Estado actualizado a "${nuevoEstado}" (registro ${registro.id}).`);
  } catch (error) {
    select.value = registro.estadoIncidencia;
    mostrarApiError(error);
  } finally {
    select.disabled = false;
  }
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
  select.addEventListener('change', () => cambiarEstado(registro, select.value, select));
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
  const view = document.createElement('button');
  view.type = 'button';
  view.className = 'btn btn-outline-school btn-edit me-2';
  view.textContent = 'Ver';
  view.setAttribute('data-bs-toggle', 'modal');
  view.setAttribute('data-bs-target', '#record-detail');
  view.addEventListener('click', () => mostrarDetalle(registro));
  cell.append(view, button);
  return cell;
}

// El detalle usa texto seguro y oculta los testigos confidenciales.
function mostrarDetalle(registro) {
  document.querySelector('#detail-title').textContent = `Detalle de incidencia N.° ${registro.id}`;
  const lista = document.querySelector('#detail-content');
  lista.replaceChildren();
  const items = [
    ['Fecha', formatDate(registro.fechaHecho)],
    ['Grado', registro.grado],
    ['Afectado', nombresPorRol(registro, 'Afectado')],
    ['Involucrado', nombresPorRol(registro, 'Agresor')],
    ['Tipo de falta', registro.tipoFalta],
    ['Lugar', registro.lugarHecho],
    ['Reportante', `${registro.nombreReportante} (${registro.origenReporte})`],
    ['Estado', registro.estadoIncidencia],
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
}

function renderRecords() {
  recordRows.replaceChildren();
  const visibles = registrosFiltrados();
  emptyRecords.hidden = visibles.length > 0;
  emptyRecords.textContent = registros.length ? 'No hay registros que coincidan con los filtros.' : 'Aún no hay incidencias registradas.';
  document.querySelector('#record-total').textContent = `${visibles.length} de ${registros.length} registros`;

  visibles.forEach((registro) => {
    const row = document.createElement('tr');
    row.append(
      textCell(String(registros.indexOf(registro) + 1)),
      textCell(formatDate(registro.fechaHecho)),
      chipCell(registro.grado, 'level-chip'),
      textCell(nombresPorRol(registro, 'Afectado')),
      textCell(nombresPorRol(registro, 'Agresor')),
      chipCell(registro.tipoFalta, 'fault-chip'),
      textCell(registro.lugarHecho),
      textCell(`${registro.nombreReportante} (${registro.origenReporte})`),
      statusCell(registro),
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
  mostrarPestana('nuevo-registro');
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  afectadoInput.focus({ preventScroll: true });
}

form.addEventListener('submit', async (event) => {
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

  const submit = document.querySelector('#submit-button');
  if (submit.disabled) return;
  submit.disabled = true;
  cancelEditButton.disabled = true;
  successAlert.classList.add('d-none');
  try {
    const editing = editandoId !== null;
    const registro = await api(editing ? `/api/incidencias/${editandoId}` : '/api/incidencias', editing ? 'PUT' : 'POST', campos);
    salirDeEdicion();
    await cargarRegistros();
    const mensaje = editing ? `Registro ${registro.id} actualizado correctamente.` : 'Incidencia registrada correctamente en el servidor.';
    const message = document.createElement('span');
    message.textContent = mensaje;
    const view = document.createElement('button');
    view.type = 'button';
    view.className = 'btn btn-outline-school ms-sm-3';
    view.dataset.goTab = 'registros';
    view.textContent = 'Ver registros';
    successAlert.replaceChildren(message, view);
    successAlert.classList.remove('d-none');
  } catch (error) {
    mostrarApiError(error);
  } finally {
    submit.disabled = false;
    cancelEditButton.disabled = false;
  }
});

cancelEditButton.addEventListener('click', () => {
  salirDeEdicion();
  mostrarPestana('registros', true);
});
testigosInput.addEventListener('input', renderTestigos);
// Al escribir se limpia el aviso de validación; los campos de estudiantes se revalidan juntos.
form.addEventListener('input', (event) => {
  event.target.setCustomValidity?.('');
  if (form.classList.contains('was-validated')) validarEstudiantes();
});
document.querySelector('#submit-button').parentElement.querySelector('.prototype-note').textContent = 'Los registros se guardan en memoria del servidor; se pierden al reiniciarlo.';
resetFormDefaults();
renderRecords();

// Aviso global visible desde cualquiera de las tres pestañas.
const apiNotice = document.createElement('div');
apiNotice.className = 'alert d-none';
apiNotice.setAttribute('role', 'status');
apiNotice.setAttribute('aria-live', 'polite');
document.querySelector('main').prepend(apiNotice);
function mostrarApiError(error) {
  apiNotice.className = 'alert alert-danger';
  apiNotice.textContent = error.message || 'No se pudo conectar con la API.';
}
async function api(url, method = 'GET', body) {
  apiNotice.className = 'alert alert-info';
  apiNotice.textContent = method === 'GET' ? 'Cargando registros...' : 'Guardando cambios...';
  let response;
  try {
    response = await fetch(url, {
      method,
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('No se pudo conectar con la API. Comprueba la conexion e intenta de nuevo.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.message || `Error de API (${response.status}).`);
  if (method === 'GET' && !Array.isArray(data)) throw new Error('La API devolvio una lista invalida.');
  apiNotice.className = 'alert d-none';
  return data;
}
async function cargarRegistros() {
  const data = await api('/api/incidencias');
  registros = data;
  renderRecords();
}

cargarRegistros().catch(mostrarApiError);
