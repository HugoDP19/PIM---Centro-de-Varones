// Copia de lectura de la API para representar la tabla y aplicar filtros.
let registros = [];
let usuarioActual = null;
let revisionSesion = 0;
let usuarioEditandoId = null;
let usuarioEditandoActivo = true;
let usuariosEnviando = false;
let anulandoId = null;

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
  const disponibles = tabs.filter((tab) => !tab.hidden);
  const active = disponibles.find((tab) => tab.dataset.tab === id) || disponibles[0];
  if (!active) return;
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
tabs.forEach((tab) => {
  tab.addEventListener('click', () => mostrarPestana(tab.dataset.tab));
  tab.addEventListener('keydown', (event) => {
    const disponibles = tabs.filter((item) => !item.hidden);
    const index = disponibles.indexOf(tab);
    let next;
    if (event.key === 'ArrowRight') next = (index + 1) % disponibles.length;
    if (event.key === 'ArrowLeft') next = (index + disponibles.length - 1) % disponibles.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = disponibles.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    mostrarPestana(disponibles[next].dataset.tab, true);
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
document.querySelector('#filter-estado').append(new Option('Anulado', 'Anulado'));
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
    .map((i) => (i.oculto ? 'Testigo confidencial' : i.nombre));
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
  if (!registro.permisos.cambiarEstado) return cell;
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
  cell.append(view);
  if (registro.permisos.descargarPdf) {
    const pdf = document.createElement('button');
    pdf.type = 'button';
    pdf.className = 'btn btn-outline-school btn-edit me-2';
    pdf.textContent = 'Descargar PDF';
    pdf.dataset.downloadPdf = registro.id;
    pdf.addEventListener('click', () => descargarPdf(registro.id, pdf));
    cell.append(pdf);
  }
  if (registro.permisos.editar) cell.append(button);
  if (registro.permisos.anular) {
    const annul = document.createElement('button');
    annul.type = 'button';
    annul.className = 'btn btn-outline-school btn-edit ms-2';
    annul.textContent = 'Anular';
    annul.dataset.bsToggle = 'modal';
    annul.dataset.bsTarget = '#annul-modal';
    annul.addEventListener('click', () => {
      anulandoId = registro.id;
      document.querySelector('#annul-title').textContent = `Anular incidencia ${registro.id}`;
      document.querySelector('#annul-form').reset();
      document.querySelector('#annul-error').classList.add('d-none');
    });
    cell.append(annul);
  }
  return cell;
}

// El detalle usa texto seguro y oculta los testigos confidenciales.
function mostrarDetalle(registro) {
  document.querySelector('#detail-title').textContent = `Detalle de incidencia N.° ${registro.id}`;
  const lista = document.querySelector('#detail-content');
  lista.replaceChildren();
  const items = [
    ['Registrado por', `Usuario ${registro.usuarioRegistroId}`],
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
  if (registro.anulacion) items.push(['Anulación', `${registro.anulacion.motivo} — Usuario ${registro.anulacion.usuarioId}, ${formatDateTime(registro.anulacion.fecha)}`]);
  items.push(['Historial', registro.historial.map((evento) => `${evento.accion}: ${evento.estadoAnterior || '—'} → ${evento.estadoNuevo}; Usuario ${evento.usuarioId}; ${formatDateTime(evento.fecha)}${evento.motivo ? `; ${evento.motivo}` : ''}`).join('\n')]);
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

document.querySelector('#annul-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.target.querySelector('[type="submit"]');
  if (button.disabled || anulandoId === null) return;
  button.disabled = true;
  document.querySelector('#annul-error').classList.add('d-none');
  try {
    await api(`/api/incidencias/${anulandoId}/anular`, 'PATCH', { motivo: document.querySelector('#annul-reason').value.trim() });
    bootstrap.Modal.getInstance(document.querySelector('#annul-modal')).hide();
    await cargarRegistros();
    showStatusMessage('Incidencia anulada. El registro y su historial se conservan.');
  } catch (error) {
    mostrarApiError(error);
    const alert = document.querySelector('#annul-error');
    alert.textContent = error.message;
    alert.classList.remove('d-none');
  }
  finally { button.disabled = false; }
});
