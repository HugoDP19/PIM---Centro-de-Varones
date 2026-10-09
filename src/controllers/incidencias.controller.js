const repository = require('../repositories/incidencias.repository');

// Devuelve un mensaje de error o null si el cuerpo es válido.
function validarIncidencia(body) {
  const { fecha, grado, tipoFalta, descripcion } = body;

  if (typeof fecha !== 'string' || fecha.trim() === '') {
    return 'La fecha es obligatoria';
  }
  const f = fecha.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) {
    return 'La fecha debe tener el formato YYYY-MM-DD';
  }
  const date = new Date(`${f}T00:00:00Z`);
  // Si la fecha no existe (ej. 2026-02-30), JS la corrige y ya no coincide.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== f) {
    return 'La fecha no es válida';
  }
  const hoy = new Date();
  const hoyLocal = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  if (f > hoyLocal) {
    return 'La fecha no puede ser futura';
  }

  if (typeof grado !== 'string' || grado.trim() === '') {
    return 'El grado es obligatorio';
  }
  if (grado.trim().length > 60) {
    return 'El grado no puede superar los 60 caracteres';
  }

  if (typeof tipoFalta !== 'string' || tipoFalta.trim() === '') {
    return 'El tipo de falta es obligatorio';
  }
  if (!['Leve', 'Grave'].includes(tipoFalta.trim())) {
    return "El tipo de falta debe ser 'Leve' o 'Grave'";
  }

  if (typeof descripcion !== 'string' || descripcion.trim() === '') {
    return 'La descripción es obligatoria';
  }
  if (descripcion.trim().length > 180) {
    return 'La descripción no puede superar los 180 caracteres';
  }

  return null;
}

// GET /api/incidencias
async function list(req, res) {
  try {
    const data = await repository.findAll();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

// POST /api/incidencias
async function create(req, res) {
  try {
    const body = req.body || {};
    const error = validarIncidencia(body);
    if (error) {
      return res.status(400).json({ message: error });
    }

    // Solo se toman los campos permitidos; "estado" se ignora.
    const nueva = await repository.create({
      fecha: body.fecha.trim(),
      grado: body.grado.trim(),
      tipoFalta: body.tipoFalta.trim(),
      descripcion: body.descripcion.trim(),
    });
    res.status(201).json(nueva);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
}

module.exports = { list, create };
