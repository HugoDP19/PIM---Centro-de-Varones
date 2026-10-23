const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const config = require('../config/auth');
const usuarios = require('../repositories/usuarios.repository');
const sesiones = require('../repositories/sesiones.repository');
const { usuarioPublico } = require('../middlewares/auth');
const intentos = new Map();
const ventana = 15 * 60_000;
const limpieza = setInterval(() => {
  for (const [ip, intento] of intentos) if (intento.hasta <= Date.now()) intentos.delete(ip);
}, 60_000);
limpieza.unref();
const hashFalso = bcrypt.hashSync('comparacion-de-acceso-invalido', 12);

async function login(req, res) {
  const ip = req.ip;
  let intento = intentos.get(ip);
  if (!intento || intento.hasta <= Date.now()) {
    intento = { cantidad: 0, hasta: Date.now() + ventana };
    intentos.set(ip, intento);
  }
  if (intento.cantidad >= 10) return res.status(429).json({ message: 'Demasiados intentos. Reintenta en 15 minutos' });
  intento.cantidad++;
  const { usuario, password } = req.body || {};
  if (typeof usuario !== 'string' || typeof password !== 'string' || Buffer.byteLength(password) > 72) {
    return res.status(400).json({ message: 'Indica usuario y contraseña válidos' });
  }
  const cuenta = await usuarios.obtenerPorUsuario(usuario.trim().toLowerCase());
  const version = cuenta?.version;
  const coincide = await bcrypt.compare(password, cuenta?.passwordHash || hashFalso);
  if (!coincide || !cuenta?.activo || cuenta.version !== version) return res.status(401).json({ message: 'Usuario o contraseña incorrectos' });
  intentos.delete(ip);
  const jti = randomUUID();
  const token = jwt.sign({ version: cuenta.version }, config.secret, {
    algorithm: 'HS256', subject: String(cuenta.id), jwtid: jti,
    issuer: config.issuer, audience: config.audience, expiresIn: config.ttl,
  });
  sesiones.crear(jti, cuenta.id, Date.now() + config.ttl * 1000);
  res.cookie(config.cookieName, token, { ...config.cookieOptions, maxAge: config.ttl * 1000 });
  res.json(usuarioPublico(cuenta));
}
function me(req, res) { res.json(usuarioPublico(req.usuario)); }
function logout(req, res) {
  sesiones.eliminar(req.sesionId);
  res.clearCookie(config.cookieName, config.cookieOptions);
  res.status(204).end();
}
module.exports = { login, me, logout };
