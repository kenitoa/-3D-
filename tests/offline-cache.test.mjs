import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';

const { Response, Request } = globalThis;
const code = readFileSync(new URL('../service-worker.js', import.meta.url), 'utf8');
const scope = 'https://campus.example.test/app/';
const pointer = new URL('__offline_current__', scope).href;
const prefix = 'hanshin-public-v1-';
const controlName = 'hanshin-offline-control-v1';
const copy = (value) => JSON.parse(JSON.stringify(value));
const bytes = (value) => Buffer.byteLength(value);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const keyOf = (value) => typeof value === 'string' ? value : value.url || value.href || String(value);

function asset(path, body, detail = false) { return { path, sha256: digest(body), bytes: bytes(body), detail }; }
function manifest(version = 'a'.repeat(20), bodies = new Map([['index.html', '<canvas id="renderCanvas"></canvas>'], ['src/models/janggong.js', 'window.JanggongModel = {};']])) { return { schemaVersion: 1, version, assets: [...bodies].map(([path, body]) => asset(path, body, path.startsWith('src/models/'))) }; }

function worker() {
  const listeners = new Map(); const stores = new Map(); const log = []; const responses = new Map(); const failures = new Set();
  let selectedManifest = manifest(); let offline = false; let putHook = null;
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map()); const store = stores.get(name);
      return { async match(key) { const found = store.get(keyOf(key)); return found ? found.clone() : undefined; }, async put(key, response) { if (putHook) await putHook(name, keyOf(key), response); log.push({ action: 'put', name, key: keyOf(key) }); store.set(keyOf(key), response.clone()); } };
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { log.push({ action: 'delete', name }); if (failures.has(name)) throw new Error('Cache deletion failed'); return stores.delete(name); },
  };
  async function fetch(input, options) {
    const url = keyOf(input); log.push({ action: 'fetch', url, options });
    if (offline) throw new Error('Offline network');
    if (url === new URL('offline-manifest.json', scope).href) return Response.json(selectedManifest);
    const body = responses.get(url); if (typeof body === 'function') return body();
    return body instanceof Response ? body.clone() : typeof body === 'string' ? new Response(body) : new Response('Not found', { status: 404 });
  }
  const self = { registration: { scope }, clients: { claim: async () => {} }, skipWaiting: async () => {}, addEventListener(type, handler) { listeners.set(type, handler); } };
  vm.runInContext(code, vm.createContext({ self, caches, fetch, crypto: webcrypto, URL, Response, Error }), { filename: 'service-worker.js' });
  async function message(action, options) {
    const tasks = []; let reply;
    listeners.get('message')({ data: { action, options }, ports: [{ postMessage(value) { reply = copy(value); } }], waitUntil(task) { tasks.push(task); } });
    await Promise.all(tasks); return reply;
  }
  async function request(path, method = 'GET') { let response; listeners.get('fetch')({ request: new Request(new URL(path, scope), { method }), respondWith(value) { response = value; } }); return response ? await response : undefined; }
  async function saved() { const response = stores.get(controlName)?.get(pointer); return response ? response.clone().json() : null; }
  function publish(next, bodies) { selectedManifest = copy(next); for (const [path, body] of bodies) responses.set(new URL(path, scope).href, body); }
  return { message, request, saved, publish, stores, log, failures, responses, setOffline(value) { offline = value; }, onPut(hook) { putHook = hook; } };
}

test('offline download verifies every SHA and commits the pointer only after all public assets are staged', async () => {
  const app = worker(); const bodies = new Map([['index.html', 'version one page'], ['src/models/janggong.js', 'version one detail']]); const next = manifest('a'.repeat(20), bodies);
  app.publish(next, bodies);
  app.onPut(async (name) => { if (name !== controlName) assert.equal(await app.saved(), null, 'uncommitted assets cannot become active early'); });
  const result = await app.message('DOWNLOAD'); assert.equal(result.saved, true); assert.equal(result.version, next.version); assert.equal(result.bytes, [...bodies.values()].reduce((total, body) => total + bytes(body), 0));
  const saved = await app.saved(); assert.ok(saved.cacheName.startsWith(prefix)); assert.equal(app.stores.get(saved.cacheName).size, 2);
  const operations = app.log.filter((entry) => entry.action === 'put'); assert.equal(operations.at(-1).key, pointer);
  assert.ok(app.log.filter((entry) => entry.action === 'fetch').every((entry) => entry.options.credentials === 'omit' && entry.options.cache === 'no-store'));
  app.setOffline(true); assert.equal(await (await app.request('index.html')).text(), bodies.get('index.html'));
});

test('SHA, length and middle-download failures remove staging and retain the complete old revision', async () => {
  for (const failure of ['sha', 'length', 'network', 'redirect']) {
    const app = worker(); const oldBodies = new Map([['index.html', 'old complete page'], ['src/models/janggong.js', 'old complete detail']]); app.publish(manifest('a'.repeat(20), oldBodies), oldBodies); await app.message('DOWNLOAD'); const old = await app.saved();
    const bodies = new Map([['index.html', 'new page'], ['src/models/janggong.js', 'new detail']]); const next = manifest('b'.repeat(20), bodies);
    if (failure === 'sha') next.assets[1].sha256 = '0'.repeat(64); if (failure === 'length') next.assets[1].bytes++;
    app.publish(next, bodies);
    if (failure === 'network') app.responses.set(new URL('src/models/janggong.js', scope).href, () => { throw new Error('Download failed midway'); });
    if (failure === 'redirect') app.responses.set(new URL('src/models/janggong.js', scope).href, () => { const response = new Response('new detail'); Object.defineProperty(response, 'redirected', { value: true }); return response; });
    const result = await app.message('DOWNLOAD'); assert.ok(result.error, failure); assert.deepEqual(await app.saved(), old, failure); assert.deepEqual([...app.stores.keys()].filter((name) => name.startsWith(prefix)), [old.cacheName]);
    app.setOffline(true); assert.equal(await (await app.request('index.html')).text(), oldBodies.get('index.html'));
  }
});

test('commit failure removes the incomplete cache without deleting the still-current old revision', async () => {
  const app = worker(); const oldBodies = new Map([['index.html', 'old page']]); app.publish(manifest('a'.repeat(20), oldBodies), oldBodies); await app.message('DOWNLOAD'); const old = await app.saved();
  const nextBodies = new Map([['index.html', 'new page']]); app.publish(manifest('b'.repeat(20), nextBodies), nextBodies); app.onPut(async (name) => { if (name === controlName) throw new Error('Atomic pointer write failed'); });
  assert.ok((await app.message('DOWNLOAD')).error); assert.deepEqual(await app.saved(), old); assert.equal(app.stores.has(old.cacheName), true); assert.equal([...app.stores.keys()].filter((name) => name.startsWith(prefix)).length, 1);
});

test('post-commit old-cache cleanup failure preserves the new complete revision and reports pending cleanup', async () => {
  const app = worker(); const oldBodies = new Map([['index.html', 'old page']]); app.publish(manifest('a'.repeat(20), oldBodies), oldBodies); await app.message('DOWNLOAD'); const old = await app.saved(); app.failures.add(old.cacheName);
  const newBodies = new Map([['index.html', 'new complete page']]); app.publish(manifest('b'.repeat(20), newBodies), newBodies); const result = await app.message('DOWNLOAD'); const saved = await app.saved();
  assert.equal(result.saved, true); assert.equal(result.version, 'b'.repeat(20)); assert.equal(result.cleanupPending, 1); assert.match(result.warning, /정리/); assert.equal(saved.version, result.version); assert.notEqual(saved.cacheName, old.cacheName); assert.ok(app.stores.has(saved.cacheName));
  app.setOffline(true); assert.equal(await (await app.request('index.html')).text(), 'new complete page');
  app.failures.clear(); app.setOffline(false); const finalBodies = new Map([['index.html', 'third complete page']]); app.publish(manifest('c'.repeat(20), finalBodies), finalBodies); assert.equal((await app.message('DOWNLOAD')).saved, true); assert.equal(app.stores.has(old.cacheName), false); assert.equal(app.stores.has(saved.cacheName), false);
});

test('API, administration, non-GET methods and external origins never enter the offline fetch path', async () => {
  const app = worker(); const bodies = new Map([['index.html', 'public page']]); app.publish(manifest('a'.repeat(20), bodies), bodies); await app.message('DOWNLOAD'); app.setOffline(true);
  for (const path of ['api/v1/catalog', 'api/v1/admin/status', 'admin.html', 'src/ui/admin.js', 'offline-manifest.json', 'service-worker.js', '../index.html', 'https://other.example.test/app/index.html']) assert.equal(await app.request(path), undefined, path);
  assert.equal(await app.request('index.html', 'POST'), undefined);
  assert.ok([...app.stores.values()].every((store) => [...store.keys()].every((url) => !url.includes('/api/') && !url.includes('admin'))));
});

test('concurrent download requests share one staged revision while clear waits and readers keep the old pointer', { timeout: 3000 }, async () => {
  const app = worker(); const oldBodies = new Map([['index.html', 'old committed page']]); app.publish(manifest('a'.repeat(20), oldBodies), oldBodies); await app.message('DOWNLOAD'); const old = await app.saved();
  const bodies = new Map([['index.html', 'new committed page'], ['src/models/janggong.js', 'new detail']]); app.publish(manifest('b'.repeat(20), bodies), bodies);
  let entered; let release; const reached = new Promise((resolve) => { entered = resolve; }); const blocked = new Promise((resolve) => { release = resolve; });
  app.responses.set(new URL('src/models/janggong.js', scope).href, () => { entered(); return blocked; });
  const first = app.message('DOWNLOAD'); await reached; const second = app.message('DOWNLOAD');
  assert.deepEqual(await app.saved(), old); assert.equal(await (await app.request('index.html')).text(), 'old committed page'); assert.ok((await app.message('CLEAR')).error);
  release(new Response('new detail')); const results = await Promise.all([first, second]); assert.deepEqual(results[0], results[1]); assert.equal(results[0].version, 'b'.repeat(20));
  assert.equal(app.log.filter((entry) => entry.action === 'fetch' && entry.url.endsWith('/offline-manifest.json')).length, 2, 'one old download and one shared new download');
});

test('unsafe manifests are rejected before any asset is cached', async () => {
  for (const path of ['admin.html', 'api/v1/catalog', 'src/ui/admin.js', '../index.html', 'src/.private.js', 'https://outside.example.test/image.svg']) {
    const app = worker(); const bodies = new Map([[path, 'private or unsafe response']]); app.publish(manifest('a'.repeat(20), bodies), bodies);
    assert.ok((await app.message('DOWNLOAD')).error, path); assert.equal(await app.saved(), null); assert.equal([...app.stores.keys()].filter((name) => name.startsWith(prefix)).length, 0);
  }
});

test('omitting model detail retains an explicit missing-detail 503 while the base still works offline', async () => {
  const app = worker(); const bodies = new Map([['index.html', 'base-only campus page'], ['src/models/janggong.js', 'large detail']]); app.publish(manifest('a'.repeat(20), bodies), bodies);
  const result = await app.message('DOWNLOAD', { details: false }); assert.equal(result.details, false); const saved = await app.saved(); assert.equal(app.stores.get(saved.cacheName).size, 1);
  assert.equal(app.log.filter((entry) => entry.action === 'fetch' && entry.url.endsWith('/src/models/janggong.js')).length, 0);
  app.setOffline(true); const missing = await app.request('src/models/janggong.js'); assert.equal(missing.status, 503); assert.match(await missing.text(), /저장되지 않았습니다/); assert.equal(await (await app.request('')).text(), 'base-only campus page');
});

test('clear removes only this application caches and returns an unsaved state', async () => {
  const app = worker(); const bodies = new Map([['index.html', 'public page']]); app.publish(manifest('a'.repeat(20), bodies), bodies); await app.message('DOWNLOAD'); app.stores.set('unrelated-app-cache', new Map());
  assert.equal((await app.message('STATUS')).saved, true); assert.equal((await app.message('CLEAR')).saved, false); assert.ok(app.stores.has('unrelated-app-cache')); assert.equal([...app.stores.keys()].filter((name) => name.startsWith(prefix)).length, 0);
});

test('offline adapter displays cleanup warnings after the caller status label and cancels stale warnings after clear', async () => {
  const dom = new JSDOM('<div id="campusPlatform"><p data-output="offline"></p></div>', { url: scope, runScripts: 'outside-only' });
  try {
    const { window } = dom; const target = window.document.querySelector('[data-output=offline]'); let value = { supported: true, saved: true, version: 'a'.repeat(20), bytes: 100, cleanupPending: 1, warning: '이전 자료 정리 실패: 완료판은 유지됩니다.' }; let registered = 0;
    class Channel {
      constructor() { this.port1 = { onmessage: null, close() {} }; this.port2 = { postMessage: (data) => { Promise.resolve().then(() => this.port1.onmessage?.({ data })); }, close() {} }; }
    }
    const active = { scriptURL: new URL('service-worker.js', scope).href, postMessage(message, ports) { ports[0].postMessage(message.action === 'DOWNLOAD' ? value : { supported: true, saved: false, version: null, bytes: 0 }); } };
    const registration = { active }; const serviceWorker = { ready: Promise.resolve(registration), controller: active, async getRegistration() { return registration; }, async register() { registered++; return registration; } };
    Object.defineProperty(window.navigator, 'serviceWorker', { value: serviceWorker }); Object.defineProperty(window, 'isSecureContext', { value: true }); Object.defineProperty(window, 'MessageChannel', { value: Channel });
    window.eval(readFileSync(new URL('../src/ui/offline-controls.js', import.meta.url), 'utf8'));
    await window.CampusOffline.download(); target.textContent = '저장 자료 완료'; await new Promise((resolve) => window.setTimeout(resolve, 0)); assert.match(target.textContent, /정리 실패/);
    value = { ...value, warning: undefined }; await window.CampusOffline.download(); target.textContent = '새 판 저장'; await window.CampusOffline.clear(); target.textContent = '저장된 오프라인 자료가 없습니다.'; await new Promise((resolve) => window.setTimeout(resolve, 0)); assert.equal(target.textContent, '저장된 오프라인 자료가 없습니다.');
    Object.defineProperty(window.navigator, 'onLine', { value: false }); const registeredBefore = registered;
    await window.CampusOffline.initialize(); assert.equal(registered, registeredBefore, 'an already installed worker is reused offline without a network registration');
  } finally { dom.window.close(); }
});
