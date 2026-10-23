const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { inflateSync } = require('node:zlib');

process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.SEED_PASSWORD = randomBytes(20).toString('hex');
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.NODE_ENV = 'test';
const app = require('../src/app');
let server;
let base;
before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

// Lee los operadores de texto de PDFKit sin agregar un lector PDF al proyecto.
function textoPdf(pdf) {
  const texto = [];
  const contenido = pdf.toString('latin1');
  for (const stream of contenido.matchAll(/stream\n([\s\S]*?)\nendstream/g)) {
    let datos;
    try { datos = inflateSync(Buffer.from(stream[1], 'latin1')).toString('latin1'); }
    catch { continue; } // La imagen JPEG no usa FlateDecode.
    if (!datos.includes('BT')) continue;
    for (const parte of datos.matchAll(/<([a-f\d]+)>/gi)) texto.push(Buffer.from(parte[1], 'hex').toString('latin1'));
  }
  return texto.join('');
}

test('Paso 4: PDF institucional, permisos y confidencialidad', async (t) => {
  const cuentas = {};
  async function pedir(cuenta, ruta, metodo = 'GET', datos) {
    return fetch(base + ruta, {
      method: metodo,
      headers: { Cookie: cuentas[cuenta]?.cookie || '', 'X-SICE-Request': '1', 'Content-Type': 'application/json' },
      ...(datos === undefined ? {} : { body: JSON.stringify(datos) }),
    });
  }
  for (const usuario of ['director', 'coordinador', 'auxiliar', 'docente', 'administrador']) {
    const respuesta = await pedir(null, '/auth/login', 'POST', { usuario, password: process.env.SEED_PASSWORD });
    assert.equal(respuesta.status, 200);
    cuentas[usuario] = { cookie: respuesta.headers.get('set-cookie').split(';')[0], ...await respuesta.json() };
  }
  const secreto = 'Persona Reservada (Prueba)';
  const campos = {
    fechaHecho: '2026-10-16', horaHecho: '10:30', grado: '2° Secundaria', tipoFalta: 'Leve',
    lugarHecho: 'Aula', descripcionHechos: `Declaración de ${secreto}. ` + 'Descripción extensa para comprobar la paginación. '.repeat(300) + 'FIN TEXTO LARGO',
    nombreReportante: 'Reportante de prueba', origenReporte: 'Docente', estadoIncidencia: 'Pendiente',
    apoderadoAfectado: 'Apoderado de prueba', apoderadoInvolucrado: '',
    medida: `Seguimiento con ${secreto}`, observaciones: `Entrevista con ${secreto}`,
    involucrados: [{ rol: 'Afectado', nombre: 'Estudiante de prueba', esConfidencial: false },
      { rol: 'Testigo', nombre: secreto, esConfidencial: true }],
  };
  const creacion = await pedir('docente', '/incidencias', 'POST', campos);
  assert.equal(creacion.status, 201);
  const registro = await creacion.json();
  const otro = await pedir('director', '/incidencias', 'POST', campos);
  assert.equal(otro.status, 201);
  const ajeno = await otro.json();
  const ruta = `/incidencias/${registro.id}/pdf`;

  await t.test('401 sin sesión, 403 Administrador y 404 inexistente o ajeno', async () => {
    for (const [cuenta, url, estado] of [
      [null, ruta, 401], ['administrador', ruta, 403], ['director', '/incidencias/999999/pdf', 404],
      ['director', '/incidencias/no-valido/pdf', 404], ['docente', `/incidencias/${ajeno.id}/pdf`, 404],
    ]) assert.equal((await pedir(cuenta, url)).status, estado);
  });
  await t.test('cuatro roles autorizados; imagen, contenido largo, pies e identidades filtradas', async () => {
    for (const cuenta of ['director', 'coordinador', 'auxiliar', 'docente']) {
      const respuesta = await pedir(cuenta, ruta);
      assert.equal(respuesta.status, 200);
      assert.match(respuesta.headers.get('content-type'), /application\/pdf/);
      assert.match(respuesta.headers.get('content-disposition'), /attachment;.*incidencia-\d+\.pdf/);
      assert.equal(respuesta.headers.get('cache-control'), 'no-store');
      const pdf = Buffer.from(await respuesta.arrayBuffer());
      assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
      assert.match(pdf.toString('latin1'), /%%EOF/);
      assert.match(pdf.toString('latin1'), /\/Subtype \/Image/);
      const paginas = [...pdf.toString('latin1').matchAll(/\/Type \/Page\b/g)].length;
      assert.ok(paginas > 2);
      const texto = textoPdf(pdf);
      for (const dato of ['Centro de Varones', 'Reporte de Incidencia de Convivencia Escolar', 'FIN TEXTO LARGO', 'Historial de cambios', 'Estudiante de prueba', '10:30']) assert.ok(texto.includes(dato), `${dato}: ${texto.slice(0, 800)}`);
      assert.equal((texto.match(/Generado por/g) || []).length, paginas);
      assert.ok(texto.includes(`Generado por ${cuentas[cuenta].nombre} / ${cuentas[cuenta].rol}`));
      assert.ok(texto.includes(`Página ${paginas} de ${paginas}`));
      assert.equal(texto.includes(secreto), ['director', 'coordinador'].includes(cuenta));
      if (cuenta === 'auxiliar' || cuenta === 'docente') assert.ok(texto.includes('Testigo confidencial'));
    }
    const original = (await (await pedir('director', '/incidencias')).json()).find((item) => item.id === registro.id);
    assert.equal(original.involucrados[1].nombre, secreto, 'La descarga no modifica el repositorio');
    assert.equal(original.descripcionHechos, campos.descripcionHechos);
  });
  await t.test('anulación y motivo en historial sin revelar nombres protegidos', async () => {
    assert.equal((await pedir('coordinador', `/incidencias/${registro.id}/anular`, 'PATCH', { motivo: `Duplicado indicado por ${secreto}` })).status, 200);
    for (const cuenta of ['director', 'docente']) {
      const respuesta = await pedir(cuenta, ruta);
      assert.equal(respuesta.status, 200);
      const texto = textoPdf(Buffer.from(await respuesta.arrayBuffer()));
      assert.ok(texto.includes('Anulado'));
      assert.ok(texto.includes('Duplicado indicado por'));
      assert.equal(texto.includes(secreto), cuenta === 'director');
    }
  });
  await t.test('un fallo al generar devuelve JSON 500 sin un PDF incompleto', async (t) => {
    t.mock.method(require('pdfkit').prototype, 'image', () => { throw new Error('Error simulado del escudo'); });
    t.mock.method(console, 'error', () => {});
    const respuesta = await pedir('director', ruta);
    assert.equal(respuesta.status, 500);
    assert.match(respuesta.headers.get('content-type'), /application\/json/);
    assert.deepEqual(await respuesta.json(), { message: 'Error interno del servidor' });
  });
});
