const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.SEED_PASSWORD = randomBytes(20).toString('hex');
process.env.APP_ORIGIN = 'http://localhost:3000';
process.env.NODE_ENV = 'test';
const app = require('../src/app');
const usersRepository = require('../src/repositories/usuarios.repository');
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
function cliente() {
  return {
    cookie: '',
    async request(path, method = 'GET', body, status = 200, extraHeaders = {}) {
      const response = await fetch(base + path, {
        method,
        headers: { Cookie: this.cookie, 'X-SICE-Request': '1', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extraHeaders },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const setCookie = response.headers.get('set-cookie');
      if (setCookie) this.cookie = setCookie.split(';')[0];
      const data = await response.json().catch(() => null);
      assert.equal(response.status, status, `${method} ${path}: ${data?.message || 'respuesta inesperada'}`);
      return { data, response };
    },
    async login(usuario, password = process.env.SEED_PASSWORD) {
      return this.request('/auth/login', 'POST', { usuario, password });
    },
  };
}
function campos(extra = {}) {
  return {
    fechaHecho: '2026-10-16', horaHecho: '10:30', grado: '2° Secundaria', tipoFalta: 'Leve',
    lugarHecho: 'Aula', descripcionHechos: 'Prueba de permisos', nombreReportante: 'Reportante',
    origenReporte: 'Docente', estadoIncidencia: 'Pendiente', apoderadoAfectado: 'Apoderado',
    apoderadoInvolucrado: '', medida: '', observaciones: '',
    involucrados: [{ rol: 'Afectado', nombre: 'Alumno', esConfidencial: false }, { rol: 'Testigo', nombre: 'Identidad protegida', esConfidencial: true }],
    ...extra,
  };
}
const cuerpoEdicion = (registro, extra = {}) => {
  const body = campos();
  for (const key of Object.keys(body)) body[key] = registro[key];
  body.involucrados = registro.involucrados.filter((persona) => !persona.oculto);
  return { ...body, ...extra };
};

test('Paso 3: autenticación, matriz de cinco roles, confidencialidad y anulación', async (t) => {
  const cuentas = {};
  const registros = {};
  const invitado = cliente();
  await t.test('rutas protegidas, credenciales, CSRF y cookies', async () => {
    await invitado.request('/incidencias', 'GET', undefined, 401);
    await invitado.request('/usuarios', 'GET', undefined, 401);
    await invitado.request('/auth/login', 'POST', { usuario: 'docente', password: 'incorrecta' }, 401);
    await invitado.request('/auth/login', 'POST', {}, 403, { 'X-SICE-Request': '' });
    await invitado.request('/auth/login', 'POST', {}, 403, { Origin: 'https://otro.example' });
    for (const nombre of ['director', 'coordinador', 'auxiliar', 'docente', 'administrador']) {
      const client = cliente();
      const { data, response } = await client.login(nombre);
      cuentas[nombre] = client;
      assert.ok(!('passwordHash' in data));
      assert.ok(!('version' in data));
      const cookie = response.headers.get('set-cookie');
      assert.ok(cookie.includes('HttpOnly') && cookie.includes('SameSite=Strict') && cookie.includes('Path=/api'));
      assert.equal(response.headers.get('cache-control'), 'no-store');
      assert.equal((await client.request('/auth/me')).data.usuario, nombre);
    }
    const alterado = cliente();
    alterado.cookie = `${cuentas.docente.cookie}x`;
    await alterado.request('/auth/me', 'GET', undefined, 401);
    for (const token of [
      jwt.sign({ sub: '4', version: 1 }, process.env.JWT_SECRET, { expiresIn: -1, issuer: 'sice-local', audience: 'sice-web' }),
      jwt.sign({ sub: '4', version: 1 }, process.env.JWT_SECRET, { issuer: 'otro', audience: 'sice-web' }),
      jwt.sign({ sub: '4', version: 1 }, process.env.JWT_SECRET, { algorithm: 'HS384', issuer: 'sice-local', audience: 'sice-web' }),
    ]) {
      alterado.cookie = `sice_session=${token}`;
      await alterado.request('/auth/me', 'GET', undefined, 401);
    }
  });
  await t.test('los cuatro operadores registran; el servidor controla autor e historial', async () => {
    for (const nombre of ['director', 'coordinador', 'auxiliar', 'docente']) {
      const { data } = await cuentas[nombre].request('/incidencias', 'POST', campos({ usuarioRegistroId: 999, id: 999, historial: ['falso'], anulacion: {} }), 201);
      registros[nombre] = data;
      assert.equal(data.usuarioRegistroId, (await cuentas[nombre].request('/auth/me')).data.id);
      assert.notEqual(data.id, 999);
      assert.equal(data.historial[0].accion, 'Registro');
      assert.equal(data.anulacion, undefined);
      const visible = ['director', 'coordinador'].includes(nombre);
      assert.equal(JSON.stringify(data).includes('Identidad protegida'), visible);
    }
    await cuentas.administrador.request('/incidencias', 'POST', campos(), 403);
    await cuentas.administrador.request('/incidencias', 'GET', undefined, 403);
    await cuentas.docente.request('/incidencias', 'POST', campos({ estadoIncidencia: 'Atendido' }), 403);
    for (const cambios of [{ fechaHecho: '2099-01-01' }, { involucrados: [] }, { apoderadoAfectado: '' }, { estadoIncidencia: 'Anulado' }]) {
      await cuentas.director.request('/incidencias', 'POST', campos(cambios), 400);
    }
  });
  await t.test('visibilidad según rol y edición de incidencias concretas', async () => {
    for (const nombre of ['director', 'coordinador', 'auxiliar', 'docente']) {
      const { data } = await cuentas[nombre].request('/incidencias');
      assert.equal(data.length, nombre === 'docente' ? 1 : 4);
      assert.equal(JSON.stringify(data).includes('Identidad protegida'), ['director', 'coordinador'].includes(nombre));
      const propio = registros[nombre];
      const actualizado = (await cuentas[nombre].request(`/incidencias/${propio.id}`, 'PUT', cuerpoEdicion(propio, { observaciones: 'Editado' }))).data;
      assert.equal(actualizado.observaciones, 'Editado');
    }
    await cuentas.auxiliar.request(`/incidencias/${registros.director.id}`, 'PUT', campos(), 403);
    await cuentas.docente.request(`/incidencias/${registros.director.id}`, 'PUT', campos(), 404);
    await cuentas.administrador.request(`/incidencias/${registros.director.id}`, 'PUT', campos(), 403);
    for (const nombre of ['director', 'coordinador']) {
      await cuentas[nombre].request(`/incidencias/${registros.auxiliar.id}`, 'PUT', campos());
    }
    await cuentas.director.request('/incidencias/99999', 'PUT', campos(), 404);
  });
  await t.test('la edición de un Docente no revela ni elimina testigos protegidos', async () => {
    const path = `/incidencias/${registros.docente.id}`;
    await cuentas.docente.request(path, 'PUT', cuerpoEdicion(registros.docente, { usuarioRegistroId: 1, historial: [] }));
    const almacenado = (await cuentas.director.request('/incidencias')).data.find((item) => item.id === registros.docente.id);
    assert.equal(almacenado.usuarioRegistroId, registros.docente.usuarioRegistroId);
    assert.ok(almacenado.historial.length >= 3);
    assert.equal(almacenado.involucrados.filter((item) => item.esConfidencial).length, 1);
    assert.equal(almacenado.involucrados.find((item) => item.esConfidencial).nombre, 'Identidad protegida');
    const respuesta = (await cuentas.docente.request(path, 'PUT', cuerpoEdicion(registros.docente))).data;
    assert.ok(!JSON.stringify(respuesta).includes('Identidad protegida'));
    await cuentas.docente.request(path, 'PUT', { ...cuerpoEdicion(respuesta), involucrados: respuesta.involucrados }, 400);
    await cuentas.docente.request(path, 'PUT', cuerpoEdicion(respuesta, { estadoIncidencia: 'Atendido' }), 403);
  });
  await t.test('solo supervisores cambian estados; Pendiente condiciona edición del autor', async () => {
    const path = `/incidencias/${registros.docente.id}`;
    for (const nombre of ['auxiliar', 'docente', 'administrador']) {
      await cuentas[nombre].request(path + '/estado', 'PATCH', { estadoIncidencia: 'Atendido' }, 403);
    }
    await cuentas.director.request(path + '/estado', 'PATCH', { estadoIncidencia: 'Anulado' }, 400);
    await cuentas.director.request(path + '/estado', 'PATCH', { estadoIncidencia: 'Atendido', id: 9 }, 400);
    await cuentas.coordinador.request(path + '/estado', 'PATCH', { estadoIncidencia: 'En revisión' });
    await cuentas.docente.request(path, 'PUT', campos({ estadoIncidencia: 'En revisión' }), 403);
    await cuentas.director.request(path + '/estado', 'PATCH', { estadoIncidencia: 'Atendido' });
    await cuentas.director.request(`/incidencias/${registros.auxiliar.id}/estado`, 'PATCH', { estadoIncidencia: 'Atendido' });
    await cuentas.auxiliar.request(`/incidencias/${registros.auxiliar.id}`, 'PUT', campos(), 403);
    await cuentas.director.request('/incidencias/99999/estado', 'PATCH', { estadoIncidencia: 'Atendido' }, 404);
  });
  await t.test('anulación con motivo, responsable e historial; sin eliminación ni reapertura', async () => {
    const path = `/incidencias/${registros.docente.id}`;
    for (const nombre of ['auxiliar', 'docente', 'administrador']) await cuentas[nombre].request(path + '/anular', 'PATCH', { motivo: 'Motivo' }, 403);
    await cuentas.coordinador.request(path + '/anular', 'PATCH', { motivo: '   ' }, 400);
    const { data } = await cuentas.coordinador.request(path + '/anular', 'PATCH', { motivo: 'Duplicado', usuarioId: 999, fecha: 'falsa' });
    assert.equal(data.estadoIncidencia, 'Anulado');
    assert.equal(data.anulacion.usuarioId, 2);
    assert.equal(data.historial.at(-1).motivo, 'Duplicado');
    assert.ok(data.anulacion.fecha !== 'falsa');
    assert.ok((await cuentas.docente.request('/incidencias')).data.some((item) => item.id === data.id && item.estadoIncidencia === 'Anulado'));
    await cuentas.director.request(path, 'PUT', campos(), 409);
    await cuentas.director.request(path + '/estado', 'PATCH', { estadoIncidencia: 'Pendiente' }, 409);
    await cuentas.director.request(path + '/anular', 'PATCH', { motivo: 'Otra' }, 409);
    await cuentas.director.request(`/incidencias/${registros.director.id}/anular`, 'PATCH', { motivo: 'Prueba Director' });
    await cuentas.director.request('/incidencias/99999/anular', 'PATCH', { motivo: 'Prueba' }, 404);
  });
  await t.test('gestión exclusiva del Administrador, hashes y revocación por cambios', async () => {
    for (const nombre of ['director', 'coordinador', 'auxiliar', 'docente']) {
      await cuentas[nombre].request('/usuarios', 'GET', undefined, 403);
      await cuentas[nombre].request('/usuarios', 'POST', {}, 403);
      await cuentas[nombre].request('/usuarios/4', 'PUT', {}, 403);
    }
    const admin = cuentas.administrador;
    const lista = (await admin.request('/usuarios')).data;
    assert.equal(lista.length, 5);
    assert.ok(!JSON.stringify(lista).includes('password'));
    const nuevo = { nombre: 'Docente adicional', usuario: 'docente.prueba', rol: 'Docente', activo: true, password: process.env.SEED_PASSWORD };
    const { data } = await admin.request('/usuarios', 'POST', nuevo, 201);
    await admin.request('/usuarios', 'POST', nuevo, 409);
    await admin.request('/usuarios', 'POST', { ...nuevo, usuario: 'otra.cuenta', password: 'corta' }, 400);
    const almacenado = await usersRepository.obtenerPorId(data.id);
    assert.ok(almacenado.passwordHash.startsWith('$2'));
    assert.ok(almacenado.passwordHash !== process.env.SEED_PASSWORD);
    const prueba = cliente();
    await prueba.login(nuevo.usuario);
    await admin.request(`/usuarios/${data.id}`, 'PUT', { ...nuevo, activo: false });
    await prueba.request('/auth/me', 'GET', undefined, 401);
    await prueba.request('/auth/login', 'POST', { usuario: nuevo.usuario, password: process.env.SEED_PASSWORD }, 401);
    await admin.request(`/usuarios/${data.id}`, 'PUT', nuevo);
    await prueba.login(nuevo.usuario);
    await admin.request(`/usuarios/${data.id}`, 'PUT', { ...nuevo, rol: 'Auxiliar' });
    await prueba.request('/auth/me', 'GET', undefined, 401);
    await prueba.login(nuevo.usuario);
    const nuevaPassword = randomBytes(20).toString('hex');
    await admin.request(`/usuarios/${data.id}`, 'PUT', { ...nuevo, rol: 'Auxiliar', password: nuevaPassword });
    await prueba.request('/auth/me', 'GET', undefined, 401);
    await prueba.request('/auth/login', 'POST', { usuario: nuevo.usuario, password: process.env.SEED_PASSWORD }, 401);
    await prueba.login(nuevo.usuario, nuevaPassword);
    await prueba.request('/incidencias', 'POST', campos(), 403, { 'X-SICE-Request': '' });
    await prueba.request('/incidencias', 'POST', campos(), 403, { Origin: 'https://otro.example' });
    await admin.request('/usuarios/9999', 'PUT', nuevo, 404);
    const actual = lista.find((usuario) => usuario.rol === 'Administrador');
    await admin.request(`/usuarios/${actual.id}`, 'PUT', { ...actual, activo: false }, 400);
    await admin.request(`/usuarios/${actual.id}`, 'PUT', { ...actual, rol: 'Docente' }, 400);
  });
  await t.test('logout revoca incluso una copia anterior de la cookie', async () => {
    const client = cliente();
    await client.login('director');
    const anterior = client.cookie;
    await client.request('/auth/logout', 'POST', undefined, 204);
    client.cookie = anterior;
    await client.request('/auth/me', 'GET', undefined, 401);
  });
  await t.test('límite de intentos y JSON mal formado', async () => {
    const response = await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-SICE-Request': '1' }, body: '{' });
    assert.equal(response.status, 400);
    for (let i = 0; i < 10; i++) await invitado.request('/auth/login', 'POST', { usuario: 'no-existe', password: 'incorrecta' }, 401);
    await invitado.request('/auth/login', 'POST', { usuario: 'no-existe', password: 'incorrecta' }, 429);
  });
});
