const bcrypt = require('bcryptjs');
const repository = require('../repositories/usuarios.repository');
const { ROLES } = require('../config/roles');
const { usuarioPublico } = require('../middlewares/auth');

function validar(body, nuevo) {
  if (typeof body.nombre !== 'string' || !body.nombre.trim() || body.nombre.length > 100) return 'Nombre obligatorio (máximo 100 caracteres)';
  if (typeof body.usuario !== 'string' || !/^[a-z0-9._-]{3,40}$/.test(body.usuario)) return 'Usuario inválido: usa de 3 a 40 letras minúsculas, números, punto, guion o guion bajo';
  if (!ROLES.includes(body.rol) || (!nuevo && typeof body.activo !== 'boolean')) return 'Indica un rol válido y activo como booleano al editar';
  if (nuevo || body.password !== undefined) {
    if (typeof body.password !== 'string' || body.password.length < 12 || Buffer.byteLength(body.password) > 72) return 'La contraseña debe tener al menos 12 caracteres y no superar 72 bytes';
  }
  return null;
}
async function list(req, res) { res.json((await repository.listar()).map(usuarioPublico)); }
async function guardar(req, res) {
  const nuevo = req.method === 'POST';
  const id = Number(req.params.id);
  const actual = nuevo ? null : await repository.obtenerPorId(id);
  if (!nuevo && !actual) return res.status(404).json({ message: 'Usuario no encontrado' });
  const body = req.body || {};
  const error = validar(body, nuevo);
  if (error) return res.status(400).json({ message: error });
  const campos = { usuario: body.usuario, nombre: body.nombre.trim(), rol: body.rol, activo: nuevo ? true : body.activo };
  if (body.password !== undefined) campos.passwordHash = await bcrypt.hash(body.password, 12);
  // Revalidar después del hash: otra solicitud pudo cambiar usuarios mientras se calculaba.
  const duplicado = await repository.obtenerPorUsuario(campos.usuario);
  if (duplicado && duplicado.id !== id) return res.status(409).json({ message: 'El usuario ya existe' });
  const retiraAdministrador = actual?.rol === 'Administrador' && actual.activo
    && (!campos.activo || campos.rol !== 'Administrador');
  if (retiraAdministrador) {
    const usuarios = await repository.listar();
    const quedaAdministrador = usuarios.some((usuario) => usuario.id !== id
      && usuario.activo && usuario.rol === 'Administrador');
    if (!quedaAdministrador) {
      return res.status(400).json({ message: 'Debe quedar al menos un Administrador activo' });
    }
  }
  const usuario = nuevo ? await repository.crear(campos) : await repository.actualizar(id, campos);
  if (!usuario) return res.status(409).json({ message: 'El usuario ya existe' });
  res.status(nuevo ? 201 : 200).json(usuarioPublico(usuario));
}
module.exports = { list, guardar };
