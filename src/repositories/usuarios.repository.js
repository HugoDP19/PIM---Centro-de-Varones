const bcrypt = require('bcryptjs');
const { ROLES } = require('../config/roles');
const { seedPassword } = require('../config/auth');
const cuentas = ['director', 'coordinador', 'auxiliar', 'docente', 'administrador'];
const nombres = ['Ricardo Salazar Mendoza', 'Patricia Huamán Torres', 'Jorge Quispe Ramos', 'Lucía Vargas Flores', 'Hugo Vargas'];
const usuarios = ROLES.map((rol, index) => ({
  id: index + 1, usuario: cuentas[index], nombre: nombres[index], rol, activo: true,
  passwordHash: bcrypt.hashSync(seedPassword, 12), version: 1,
}));
let siguienteId = usuarios.length + 1;
async function listar() { return usuarios; }
async function obtenerPorId(id) { return usuarios.find((usuario) => usuario.id === id); }
async function obtenerPorUsuario(nombre) { return usuarios.find((usuario) => usuario.usuario === nombre); }
async function crear(campos) {
  if (usuarios.some((usuario) => usuario.usuario === campos.usuario)) return null;
  const usuario = { ...campos, id: siguienteId++, version: 1 };
  usuarios.push(usuario);
  return usuario;
}
async function actualizar(id, campos) {
  const usuario = usuarios.find((item) => item.id === id);
  if (!usuario) return null;
  if (usuarios.some((item) => item.id !== id && item.usuario === campos.usuario)) return null;
  Object.assign(usuario, campos, { version: usuario.version + 1 });
  return usuario;
}
module.exports = { listar, obtenerPorId, obtenerPorUsuario, crear, actualizar };
