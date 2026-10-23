// Login, cierre de sesion y recuperacion de la cookie de autenticacion.
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
