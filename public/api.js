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
