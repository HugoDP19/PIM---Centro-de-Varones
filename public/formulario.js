// Testigos, validaciones y guardado del formulario de incidencias.
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
  form.elements.estadoIncidencia.disabled = !esSupervisor();
  document.querySelector('#protected-witness-note')?.remove();
}

// Carga un registro en el formulario para editarlo.
function iniciarEdicion(registro) {
  if (!registro.permisos.editar || document.querySelector('#submit-button').disabled) return;
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
  const testigos = registro.involucrados.filter((i) => i.rol === 'Testigo' && !i.oculto);
  testigosInput.value = testigos.map((t) => t.nombre).join(', ');
  confidenciales.clear();
  testigos.filter((t) => t.esConfidencial).forEach((t) => confidenciales.add(t.nombre));
  renderTestigos();
  document.querySelector('#protected-witness-note')?.remove();
  if (registro.involucrados.some((i) => i.oculto)) {
    const note = document.createElement('p');
    note.id = 'protected-witness-note';
    note.className = 'prototype-note mt-2';
    note.textContent = 'Testigos confidenciales protegidos: se conservarán sin cambios al guardar.';
    testigosInput.after(note);
  }

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
    estadoIncidencia: form.elements.estadoIncidencia.value,
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
