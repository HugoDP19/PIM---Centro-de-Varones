// Repositorio mock: guarda las incidencias en memoria.
// Luego se reemplazará por uno que use getPool() de src/config/db.js.
const incidencias = [
  { id: 1, fecha: '2026-10-05', grado: '2° Secundaria', tipoFalta: 'Leve', descripcion: 'Incidencia de prueba (dato simulado)', estado: 'Pendiente' },
  { id: 2, fecha: '2026-10-06', grado: '3° Secundaria', tipoFalta: 'Grave', descripcion: 'Incidencia de prueba (dato simulado)', estado: 'En revisión' },
];

async function findAll() {
  return incidencias;
}

async function create({ fecha, grado, tipoFalta, descripcion }) {
  const id = incidencias.reduce((max, i) => Math.max(max, i.id), 0) + 1;
  const nueva = { id, fecha, grado, tipoFalta, descripcion, estado: 'Pendiente' };
  incidencias.push(nueva);
  return nueva;
}

module.exports = { findAll, create };
