const jwt = require('jsonwebtoken');
const config = require('../config/auth');
const usuarios = require('../repositories/usuarios.repository');
const sesiones = require('../repositories/sesiones.repository');

async function requiereLogin(req, res, next) {
  let payload;
  try {
    payload = jwt.verify(req.cookies[config.cookieName], config.secret, {
      algorithms: ['HS256'], issuer: config.issuer, audience: config.audience,
    });
  } catch {
    return res.status(401).json({ message: 'Inicia sesión para continuar' });
  }
  const usuario = await usuarios.obtenerPorId(Number(payload.sub));
  const sesion = sesiones.obtener(payload.jti);
  if (!usuario?.activo || usuario.version !== payload.version || sesion?.usuarioId !== usuario.id) {
    return res.status(401).json({ message: 'La sesión ha caducado. Inicia sesión nuevamente' });
  }
  req.usuario = usuario;
  req.sesionId = payload.jti;
  next();
}
function requiereRol(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) return res.status(403).json({ message: 'No tienes permiso para esta operación' });
    next();
  };
}
// El encabezado obliga al navegador a efectuar preflight. Nunca se permite otro origen.
function protegerEscritura(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-SICE-Request') !== '1' || (req.get('Origin') && req.get('Origin') !== config.origin)) {
    return res.status(403).json({ message: 'Solicitud de origen no permitido' });
  }
  if (req.headers['content-length'] !== '0' && req.body !== undefined && !req.is('application/json')) {
    return res.status(415).json({ message: 'Usa Content-Type: application/json' });
  }
  next();
}
function usuarioPublico({ id, usuario, nombre, rol, activo }) { return { id, usuario, nombre, rol, activo }; }
module.exports = { requiereLogin, requiereRol, protegerEscritura, usuarioPublico };
