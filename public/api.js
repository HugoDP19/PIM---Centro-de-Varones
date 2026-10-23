// Peticiones HTTP y avisos compartidos de la pantalla.
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
  const revision = revisionSesion;
  apiNotice.className = 'alert alert-info';
  if (url === '/api/auth/login') apiNotice.textContent = 'Iniciando sesión...';
  else if (url === '/api/auth/logout') apiNotice.textContent = 'Cerrando sesión...';
  else apiNotice.textContent = method === 'GET' ? 'Cargando datos...' : 'Guardando cambios...';
  const headers = {};
  if (method !== 'GET') headers['X-SICE-Request'] = '1';
  if (body) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('No se pudo conectar con la API. Comprueba la conexion e intenta de nuevo.');
  }
  const data = await response.json().catch(() => null);
  if (revision !== revisionSesion) throw new Error('La sesión cambió. Vuelve a intentar la operación.');
  if (!response.ok) {
    if (response.status === 401 && url !== '/api/auth/login') cerrarVista();
    const error = new Error(data?.message || `Error de API (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  if (method === 'GET' && ['/api/incidencias', '/api/usuarios'].includes(url) && !Array.isArray(data)) throw new Error('La API devolvió una lista inválida.');
  apiNotice.className = 'alert d-none';
  return data;
}
async function cargarRegistros() {
  const revision = revisionSesion;
  const data = await api('/api/incidencias');
  if (revision !== revisionSesion || !usuarioActual) return;
  registros = data;
  renderRecords();
}

async function descargarPdf(id, boton) {
  boton.disabled = true;
  const revision = revisionSesion;
  apiNotice.className = 'alert alert-info';
  apiNotice.textContent = 'Preparando PDF...';
  try {
    const respuesta = await fetch(`/api/incidencias/${id}/pdf`, { credentials: 'same-origin' });
    if (revision !== revisionSesion) return;
    if (!respuesta.ok) {
      if (respuesta.status === 401) cerrarVista();
      const error = await respuesta.json().catch(() => null);
      throw new Error(error?.message || 'No se pudo descargar el PDF.');
    }
    if (!respuesta.headers.get('Content-Type')?.includes('application/pdf')) throw new Error('El servidor no devolvió un PDF válido.');
    const archivo = await respuesta.blob();
    if (revision !== revisionSesion) return;
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = `incidencia-${id}.pdf`;
    document.body.append(enlace);
    enlace.click();
    enlace.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    apiNotice.className = 'alert d-none';
  } catch {
    mostrarApiError(new Error('No se pudo descargar el PDF. Comprueba tu sesión y vuelve a intentarlo.'));
  } finally {
    boton.disabled = false;
  }
}

// Inicio, recuperación y cierre de la sesión.
function esSupervisor() {
  return ['Director', 'Coordinador de Tutoría'].includes(usuarioActual?.rol);
}
function cerrarVista() {
  revisionSesion++;
  usuarioActual = null;
  registros = [];
  anulandoId = null;
  salirDeEdicion();
  resetUserForm();
  renderRecords();
  document.querySelector('#user-rows').replaceChildren();
  document.querySelector('#detail-content').replaceChildren();
  document.querySelector('#session-name').textContent = '';
  document.querySelector('#session-role').textContent = '';
  document.querySelector('#user-total').textContent = '';
  document.querySelector('#annul-form').reset();
  document.querySelector('#login-form').reset();
  successAlert.classList.add('d-none');
  statusAlert.classList.add('d-none');
  document.querySelectorAll('.modal').forEach((modal) => bootstrap.Modal.getInstance(modal)?.hide());
  document.querySelector('#app-shell').hidden = true;
  document.querySelector('#login-view').hidden = false;
  document.querySelector('#login-user').focus();
}
async function abrirSesion(usuario) {
  revisionSesion++;
  usuarioActual = usuario;
  const admin = usuario.rol === 'Administrador';
  tabs.forEach((tab) => { tab.hidden = admin ? tab.dataset.tab !== 'usuarios' : tab.dataset.tab === 'usuarios'; });
  document.querySelector('#session-name').textContent = usuario.nombre;
  document.querySelector('#session-role').textContent = usuario.rol;
  document.querySelector('#login-view').hidden = true;
  document.querySelector('#app-shell').hidden = false;
  form.elements.estadoIncidencia.disabled = !esSupervisor();
  mostrarPestana(location.hash.slice(1));
  if (admin) await cargarUsuarios();
  else await cargarRegistros();
}
document.querySelector('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = event.target.querySelector('button');
  if (button.disabled) return;
  button.disabled = true;
  try {
    const usuario = await api('/api/auth/login', 'POST', { usuario: document.querySelector('#login-user').value, password: document.querySelector('#login-password').value });
    event.target.reset();
    await abrirSesion(usuario);
  } catch (error) { mostrarApiError(error); }
  finally { button.disabled = false; }
});
document.querySelector('#logout-button').addEventListener('click', async (event) => {
  event.target.disabled = true;
  try { await api('/api/auth/logout', 'POST'); cerrarVista(); }
  catch (error) { mostrarApiError(error); }
  finally { event.target.disabled = false; }
});
// Recuperar la sesión sin exponer el JWT a JavaScript.
api('/api/auth/me').then(abrirSesion).catch((error) => {
  if (error.status === 401) apiNotice.className = 'alert d-none';
  else mostrarApiError(error);
}).finally(() => { document.querySelector('#login-form button').disabled = false; });
