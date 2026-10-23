// Prueba opcional en un Chrome/Edge instalado; no descarga navegadores ni librerías.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { spawn } = require('node:child_process');
const { mkdtemp, readFile } = require('node:fs/promises');
const { existsSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
process.env.JWT_SECRET = randomBytes(48).toString('hex');
process.env.SEED_PASSWORD = randomBytes(20).toString('hex');
process.env.NODE_ENV = 'test';
let browser;
let server;
let socket;
async function main() {
  const executable = process.env.CHROME_PATH || [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(existsSync);
  if (!executable) throw new Error('Indica CHROME_PATH con la ruta de Chrome o Edge instalado');
  // APP_ORIGIN se configura antes de importar la app.
  const net = require('node:net');
  const portProbe = net.createServer().listen(0, '127.0.0.1');
  await once(portProbe, 'listening');
  const port = portProbe.address().port;
  await new Promise((resolve) => portProbe.close(resolve));
  process.env.APP_ORIGIN = `http://127.0.0.1:${port}`;
  server = require('../src/app').listen(port, '127.0.0.1');
  await once(server, 'listening');
  const profile = await mkdtemp(path.join(tmpdir(), 'sice-browser-'));
  browser = spawn(executable, ['--headless=new', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let debugPort;
  for (let i = 0; i < 100; i++) {
    try { debugPort = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; }
    catch { await pause(100); }
  }
  if (!debugPort) throw new Error('El navegador no inició el puerto de depuración');
  const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  socket = new WebSocket(targets.find((target) => target.type === 'page').webSocketDebuggerUrl);
  await once(socket, 'open');
  let sequence = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
  });
  async function send(method, params = {}) {
    const id = ++sequence;
    const response = new Promise((resolve) => pending.set(id, resolve));
    socket.send(JSON.stringify({ id, method, params }));
    const result = await response;
    if (result.error) throw new Error(result.error.message);
    return result.result;
  }
  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }
  async function waitFor(expression) {
    for (let i = 0; i < 100; i++) {
      if (await evaluate(expression)) return;
      await pause(100);
    }
    throw new Error(`No se cumplió: ${expression}`);
  }
  const click = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const submit = (selector) => evaluate(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);
  async function login(nombre) {
    await evaluate(`document.querySelector('#login-user').value = ${JSON.stringify(nombre)}; document.querySelector('#login-password').value = ${JSON.stringify(process.env.SEED_PASSWORD)}`);
    await submit('#login-form');
    await waitFor(`usuarioActual?.usuario === ${JSON.stringify(nombre)} && apiNotice.classList.contains('d-none')`);
    assert.ok(await evaluate(`document.querySelector('#session-name').textContent === usuarioActual.nombre && usuarioActual.nombre !== usuarioActual.rol && document.querySelector('#session-role').textContent === usuarioActual.rol`));
  }
  async function logout() {
    await click('#logout-button');
    await waitFor(`usuarioActual === null && !document.querySelector('#login-view').hidden`);
    assert.equal(await evaluate(`document.querySelector('#detail-content').textContent`), '');
    assert.equal(await evaluate(`document.querySelector('#record-testigos').value`), '');
  }
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: process.env.APP_ORIGIN });
  await waitFor(`typeof bootstrap !== 'undefined' && typeof api === 'function' && !document.querySelector('#app-shell').hidden === false`);
  await login('docente');
  assert.equal(await evaluate(`document.querySelector('#tab-usuarios').hidden`), true);
  assert.equal(await evaluate(`document.querySelector('#record-estado').disabled`), true);
  await click('#tab-nuevo-registro');
  await evaluate(`Object.entries({ grado: '2° Secundaria', tipoFalta: 'Leve', lugarHecho: 'Aula', descripcionHechos: 'Prueba navegador', estudianteAfectado: 'Alumno UI', apoderadoAfectado: 'Apoderado UI', nombreReportante: 'Docente UI', origenReporte: 'Docente' }).forEach(([key, value]) => { form.elements[key].value = value; }); testigosInput.value = 'Testigo UI protegido'; testigosInput.dispatchEvent(new Event('input', { bubbles: true })); document.querySelector('#testigo-confidencial-0').click()`);
  await submit('#record-form');
  await waitFor(`registros.length === 1 && !successAlert.classList.contains('d-none')`);
  assert.equal(await evaluate(`JSON.stringify(registros).includes('Testigo UI protegido')`), false);
  await click('#success-alert [data-go-tab]');
  assert.equal(await evaluate('location.hash'), '#registros');
  await click('#record-rows [data-bs-target="#record-detail"]');
  await waitFor(`document.querySelector('#record-detail').classList.contains('show')`);
  assert.ok((await evaluate(`document.querySelector('#detail-content').textContent`)).includes('Testigo confidencial'));
  await evaluate(`bootstrap.Modal.getInstance(document.querySelector('#record-detail')).hide()`);
  await pause(350);
  await click('#record-rows button:not([data-bs-target])');
  assert.equal(await evaluate(`testigosInput.value`), '');
  assert.ok(await evaluate(`!!document.querySelector('#protected-witness-note')`));
  await evaluate(`form.elements.observaciones.value = 'Edición sin fuga'`);
  await submit('#record-form');
  await waitFor(`registros[0]?.observaciones === 'Edición sin fuga' && !document.querySelector('#submit-button').disabled`);
  await click('#tab-registros');
  await evaluate(`document.querySelector('#filter-text').value = 'sin coincidencias'; document.querySelector('#filter-text').dispatchEvent(new Event('input', { bubbles: true }))`);
  assert.equal(await evaluate(`document.querySelector('#record-total').textContent`), '0 de 1 registros');
  await click('#record-filters [type="reset"]');
  assert.equal(await evaluate(`document.querySelector('#record-total').textContent`), '1 de 1 registros');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= window.innerWidth`));
  await logout();
  for (const nombre of ['auxiliar', 'coordinador', 'director']) {
    await login(nombre);
    assert.equal(await evaluate('registros.length'), 1);
    assert.equal(await evaluate(`JSON.stringify(registros).includes('Testigo UI protegido')`), nombre !== 'auxiliar');
    await logout();
  }
  await login('coordinador');
  await click('#tab-registros');
  await click('#record-rows [data-bs-target="#annul-modal"]');
  await waitFor(`document.querySelector('#annul-modal').classList.contains('show')`);
  await evaluate(`document.querySelector('#annul-reason').value = 'Duplicado de prueba UI'`);
  await submit('#annul-form');
  await waitFor(`registros[0]?.estadoIncidencia === 'Anulado'`);
  assert.equal(await evaluate(`document.querySelectorAll('#record-rows button').length`), 1);
  await logout();
  await login('administrador');
  assert.equal(await evaluate('location.hash'), '#usuarios');
  assert.equal(await evaluate(`document.querySelector('#tab-registros').hidden`), true);
  assert.equal(await evaluate(`document.querySelectorAll('#user-rows tr').length`), 5);
  assert.equal(await evaluate(`document.querySelector('#user-active') === null`), true);
  assert.equal(await evaluate(`document.querySelector('#user-password').required`), true);
  assert.ok(await evaluate(`[...document.querySelectorAll('#user-rows tr')].find(row => row.textContent.includes('administrador')).querySelector('[data-ultimo-admin]').disabled`));
  await evaluate(`Object.entries({ nombre: 'Prueba de usuario UI', usuario: 'usuario.ui', rol: 'Auxiliar', password: ${JSON.stringify(process.env.SEED_PASSWORD)} }).forEach(([key, value]) => { document.querySelector('#user-form').elements[key].value = value; })`);
  await submit('#user-form');
  await waitFor(`document.querySelectorAll('#user-rows tr').length === 6`);
  await click('#user-rows tr:last-child button[data-ultimo-admin]');
  await waitFor(`document.querySelector('#user-rows tr:last-child').textContent.includes('Inactivo')`);
  await click('#user-rows tr:last-child button:not([data-ultimo-admin])');
  await evaluate(`document.querySelector('#user-name').value = 'Carlos Mendoza Paredes'`);
  await submit('#user-form');
  await waitFor(`document.querySelector('#user-rows tr:last-child').textContent.includes('Carlos Mendoza Paredes') && !usuariosEnviando`);
  assert.ok(await evaluate(`document.querySelector('#user-rows tr:last-child').textContent.includes('Inactivo')`));
  await click('#user-rows tr:last-child button[data-ultimo-admin]');
  await waitFor(`!document.querySelector('#user-rows tr:last-child').textContent.includes('Inactivo') && !usuariosEnviando`);
  await evaluate(`document.querySelector('#tab-usuarios').focus(); document.querySelector('#tab-usuarios').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))`);
  assert.equal(await evaluate(`document.activeElement.id`), 'tab-usuarios');
  await logout();
  assert.equal(errors.length, 0, 'No debe haber excepciones JavaScript en el navegador');
  console.log('OK: navegador real, cinco roles, login/logout, registro, edición confidencial, filtros, móvil, anulación y usuarios.');
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(async () => {
  socket?.close();
  if (browser) browser.kill();
  if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
});
