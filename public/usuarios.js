// Formulario y tabla de usuarios; acceso exclusivo del Administrador.
function resetUserForm() {
  usuarioEditandoId = null;
  usuarioEditandoActivo = true;
  document.querySelector('#user-form').reset();
  document.querySelector('#user-password').required = true;
  document.querySelector('#user-heading').textContent = 'Nuevo usuario';
  document.querySelector('#user-password-label').textContent = 'Contraseña inicial';
  document.querySelector('#user-password-help').textContent = 'Mínimo 12 caracteres y máximo 72 bytes.';
  document.querySelector('#user-form-note').textContent = 'Las nuevas cuentas se crean activas. Puedes cambiar su estado desde la tabla.';
  document.querySelector('#user-cancel').hidden = true;
}
function bloquearUsuarios(enviando) {
  usuariosEnviando = enviando;
  document.querySelectorAll('#user-form button, #user-rows button').forEach((button) => {
    button.disabled = enviando || button.dataset.ultimoAdmin === 'true';
  });
}
function sesionTrasCambioUsuario(usuario) {
  if (usuario.id !== usuarioActual?.id) return false;
  cerrarVista();
  apiNotice.className = 'alert alert-info';
  apiNotice.textContent = 'Cuenta actualizada. Inicia sesión nuevamente.';
  return true;
}
async function cargarUsuarios() {
  const revision = revisionSesion;
  const usuarios = await api('/api/usuarios');
  if (revision !== revisionSesion || usuarioActual?.rol !== 'Administrador') return;
  const rows = document.querySelector('#user-rows');
  rows.replaceChildren();
  const activos = usuarios.filter((usuario) => usuario.activo).length;
  const administradores = usuarios.filter((usuario) => usuario.activo && usuario.rol === 'Administrador').length;
  document.querySelector('#user-total').textContent = `${usuarios.length} usuarios · ${activos} activos`;
  usuarios.forEach((usuario) => {
    const row = document.createElement('tr');
    const action = document.createElement('td');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn-outline-school btn-edit';
    button.textContent = 'Editar';
    button.addEventListener('click', () => {
      if (usuariosEnviando) return;
      resetUserForm();
      usuarioEditandoId = usuario.id;
      for (const campo of ['nombre', 'usuario', 'rol']) document.querySelector('#user-form').elements[campo].value = usuario[campo];
      usuarioEditandoActivo = usuario.activo;
      document.querySelector('#user-password').required = false;
      document.querySelector('#user-heading').textContent = `Editar usuario ${usuario.id}`;
      document.querySelector('#user-password-label').textContent = 'Nueva contraseña (opcional)';
      document.querySelector('#user-password-help').textContent = 'Déjala vacía para conservar la contraseña actual.';
      document.querySelector('#user-form-note').textContent = 'El estado de la cuenta se cambia desde la tabla.';
      document.querySelector('#user-cancel').hidden = false;
      document.querySelector('#user-name').focus();
    });
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'btn btn-outline-school btn-edit';
    toggle.textContent = usuario.activo ? 'Desactivar' : 'Activar';
    toggle.setAttribute('aria-label', `${toggle.textContent} a ${usuario.nombre}`);
    toggle.dataset.ultimoAdmin = String(usuario.activo && usuario.rol === 'Administrador' && administradores === 1);
    toggle.disabled = usuariosEnviando || toggle.dataset.ultimoAdmin === 'true';
    if (toggle.dataset.ultimoAdmin === 'true') toggle.title = 'Debe quedar al menos un Administrador activo';
    toggle.addEventListener('click', async () => {
      if (usuariosEnviando) return;
      bloquearUsuarios(true);
      try {
        const campos = { nombre: usuario.nombre, usuario: usuario.usuario, rol: usuario.rol, activo: !usuario.activo };
        const actualizado = await api(`/api/usuarios/${usuario.id}`, 'PUT', campos);
        if (sesionTrasCambioUsuario(actualizado)) return;
        if (usuarioEditandoId === actualizado.id) usuarioEditandoActivo = actualizado.activo;
        await cargarUsuarios();
      } catch (error) { mostrarApiError(error); }
      finally { bloquearUsuarios(false); }
    });
    const actions = document.createElement('div');
    actions.className = 'd-flex flex-wrap gap-2';
    actions.append(button, toggle);
    action.append(actions);
    row.append(textCell(usuario.nombre), textCell(usuario.usuario), chipCell(usuario.rol, 'level-chip'), chipCell(usuario.activo ? 'Activo' : 'Inactivo', usuario.activo ? 'health-badge online' : 'health-badge offline'), action);
    rows.append(row);
  });
}
document.querySelector('#user-cancel').addEventListener('click', resetUserForm);
document.querySelector('#user-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (usuariosEnviando) return;
  bloquearUsuarios(true);
  try {
    const campos = Object.fromEntries(new FormData(event.target));
    if (usuarioEditandoId !== null) campos.activo = usuarioEditandoActivo;
    if (!campos.password && usuarioEditandoId !== null) delete campos.password;
    const usuario = await api(usuarioEditandoId === null ? '/api/usuarios' : `/api/usuarios/${usuarioEditandoId}`, usuarioEditandoId === null ? 'POST' : 'PUT', campos);
    resetUserForm();
    if (!sesionTrasCambioUsuario(usuario)) await cargarUsuarios();
  } catch (error) { mostrarApiError(error); }
  finally { bloquearUsuarios(false); }
});
