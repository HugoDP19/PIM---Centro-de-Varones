const records = [];

const form = document.querySelector('#record-form');
const recordRows = document.querySelector('#record-rows');
const emptyRecords = document.querySelector('#empty-records');
const successAlert = document.querySelector('#success-alert');
const healthBadge = document.querySelector('#health-badge');
const checkHealthButton = document.querySelector('#check-health');

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
  const todayRecords = records.filter((record) => record.date === today).length;
  const pendingRecords = records.filter((record) => record.status === 'Pendiente').length;

  document.querySelector('#today-count').textContent = String(todayRecords);
  document.querySelector('#pending-count').textContent = String(pendingRecords);
  document.querySelector('#record-total').textContent = `${records.length} ${records.length === 1 ? 'registro' : 'registros'} de demostración`;
}

function renderRecords() {
  recordRows.replaceChildren();
  emptyRecords.hidden = records.length > 0;

  records.forEach((record, index) => {
    const row = document.createElement('tr');
    const numberCell = document.createElement('td');
    numberCell.textContent = String(index + 1);
    row.append(numberCell);

    const dateCell = document.createElement('td');
    dateCell.textContent = formatDate(record.date);
    row.append(dateCell);

    const gradeCell = document.createElement('td');
    const gradeChip = document.createElement('span');
    gradeChip.className = 'level-chip';
    gradeChip.textContent = record.grade;
    gradeCell.append(gradeChip);
    row.append(gradeCell);

    const typeCell = document.createElement('td');
    const typeChip = document.createElement('span');
    typeChip.className = 'fault-chip';
    typeChip.textContent = record.type;
    typeCell.append(typeChip);
    row.append(typeCell);

    const descriptionCell = document.createElement('td');
    descriptionCell.textContent = record.description;
    row.append(descriptionCell);

    const statusCell = document.createElement('td');
    const statusChip = document.createElement('span');
    statusChip.className = 'fault-chip status-chip';
    statusChip.textContent = record.status;
    statusCell.append(statusChip);
    row.append(statusCell);

    recordRows.append(row);
  });

  updateMetrics();
}

async function checkServerHealth() {
  const serverMetric = document.querySelector('#server-metric');
  const lastCheck = document.querySelector('#last-check');
  const originalButton = checkHealthButton.innerHTML;

  checkHealthButton.disabled = true;
  checkHealthButton.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Comprobando';
  healthBadge.className = 'health-badge checking';
  healthBadge.textContent = 'Comprobando conexión...';

  try {
    const response = await fetch('/api/health', { cache: 'no-store' });
    if (!response.ok) throw new Error('El endpoint respondió con error.');

    const health = await response.json();
    if (health.status !== 'ok') throw new Error('El servicio reportó un estado no disponible.');

    healthBadge.className = 'health-badge online';
    healthBadge.textContent = 'Servidor conectado';
    serverMetric.textContent = 'En línea';
  } catch {
    healthBadge.className = 'health-badge offline';
    healthBadge.textContent = 'Sin conexión';
    serverMetric.textContent = 'Desconectado';
  } finally {
    lastCheck.textContent = `Última verificación: ${new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`;
    checkHealthButton.disabled = false;
    checkHealthButton.innerHTML = originalButton;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  form.classList.add('was-validated');

  if (!form.checkValidity()) {
    successAlert.classList.add('d-none');
    form.querySelector(':invalid')?.focus();
    return;
  }

  const formData = new FormData(form);
  records.unshift({
    date: String(formData.get('date')),
    grade: String(formData.get('grade')).trim(),
    type: String(formData.get('type')),
    description: String(formData.get('description')).trim(),
    status: 'Pendiente',
  });

  renderRecords();
  form.reset();
  form.classList.remove('was-validated');
  document.querySelector('#record-date').value = getLocalDateValue();
  successAlert.textContent = 'Registro temporal agregado correctamente. Los datos solo viven en esta sesión del navegador.';
  successAlert.classList.remove('d-none');
});

checkHealthButton.addEventListener('click', checkServerHealth);
document.querySelector('#record-date').value = getLocalDateValue();
updateMetrics();
checkServerHealth();
