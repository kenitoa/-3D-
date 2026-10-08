import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, cp, copyFile, readdir, rm, symlink, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
import net from 'node:net';
import { assertEntryReady } from '../scripts/server-health.mjs';

const checkout = fileURLToPath(new URL('..', import.meta.url));
const serverScript = join(checkout, 'scripts/serve.mjs');
const buildScript = join(checkout, 'scripts/build.mjs');
const deniedFiles = [
  '.private.json', 'package.json', 'node_modules/private.json',
  'src/domain/developer-notes.js', 'src/data/.private.json',
  'evidence/hanshin-campus-tour.html', 'evidence/hanshin-2026-admissions.pdf', 'evidence/campus-map-page39.png',
  'evidence/unreviewed-guide.html', 'evidence/campus-map-page99.png',
];
const rawNames = ['hanshin-2026-admissions.pdf', 'hanshin-campus-tour.html', 'campus-map-page38.png', 'campus-map-page39.png', 'campus-map-page40.png', 'unreviewed-guide.pdf', 'unreviewed-guide.html', 'campus-map-page99.png'];

async function put(root, name, value) {
  const target = join(root, name);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, value);
}

async function fixture() {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'hanshin-delivery-'));
  const checked = resolve(temporaryRoot);
  if (!checked.startsWith(resolve(tmpdir()) + sep) || !basename(checked).startsWith('hanshin-delivery-')) throw new Error('Invalid isolated test cleanup directory.');
  const root = join(checked, 'checkout');
  await mkdir(root);
  try {
    for (const name of ['index.html', 'admin.html', 'src', 'styles', 'docs', 'server', 'assets', 'manifest.webmanifest', 'service-worker.js']) await cp(join(checkout, name), join(root, name), { recursive: true });
    await mkdir(join(root, 'evidence'));
    for (const name of await readdir(join(checkout, 'evidence'))) {
      if (name.endsWith('.json') || name === 'README.md') await copyFile(join(checkout, 'evidence', name), join(root, 'evidence', name));
    }
    for (const [name, runtime] of [['babylonjs', 'babylon.js'], ['babylonjs-gui', 'babylon.gui.min.js'], ['babylonjs-loaders','babylonjs.loaders.min.js']]) {
      const files = [runtime, 'package.json'];
      const existing = await readdir(join(checkout, 'node_modules', name));
      files.push(existing.includes('license.md') ? 'license.md' : 'LICENSE');
      for (const file of files) {
        const target = join(root, 'node_modules', name, file);
        await mkdir(dirname(target), { recursive: true });
        await copyFile(join(checkout, 'node_modules', name, file), target);
      }
    }
    for (const name of deniedFiles) await put(root, name, name.endsWith('.json') ? JSON.stringify({ private: `private test content: ${name}` }) : `private test content: ${name}`);
    for (const name of rawNames) {
      await put(root, `evidence/${name}`, `private review fixture: ${name}`);
      await put(root, `dist/evidence/${name}`, `stale distribution fixture: ${name}`);
    }
    await put(root, 'dist/src/domain/developer-notes.js', 'stale development fixture');
    await put(root, 'dist/.private.json', 'stale hidden fixture');
    return { root, temporaryRoot: checked };
  } catch (error) {
    await rm(checked, { recursive: true });
    throw error;
  }
}

async function run(script, cwd, args = [], env = {}) {
  const child = spawn(process.execPath, [script, ...args], { cwd, env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = ''; let stderr = '';
  child.stdout.on('data', (value) => { stdout += value; });
  child.stderr.on('data', (value) => { stderr += value; });
  const timer = setTimeout(() => child.kill(), 20000);
  try {
    const [code, signal] = await once(child, 'exit');
    return { code, signal, stdout, stderr };
  } finally { clearTimeout(timer); if (child.exitCode === null && child.signalCode === null) child.kill(); }
}

async function freePort() {
  const reservation = net.createServer();
  await new Promise((accept, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', accept); });
  const port = reservation.address().port;
  await new Promise((accept) => reservation.close(accept));
  return port;
}

function request(port, path, method = 'GET') {
  return new Promise((accept, reject) => {
    const outgoing = http.request({ hostname: '127.0.0.1', port, path, method, agent: false }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.once('error', reject);
      response.once('end', () => accept({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    outgoing.setTimeout(5000, () => outgoing.destroy(new Error('HTTP test request timed out.')));
    outgoing.once('error', reject);
    outgoing.end();
  });
}

async function startServer(root, dist = false) {
  const port = await freePort();
  const child = spawn(process.execPath, [serverScript, ...(dist ? ['--dist'] : [])], { cwd: root, env: { ...process.env, PORT: String(port) }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', (value) => { output += value; });
  child.stderr.on('data', (value) => { output += value; });
  const exited = once(child, 'exit');
  const close = async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill();
    await exited;
  };
  try {
    await new Promise((accept, reject) => {
      const timer = setTimeout(() => reject(new Error(`Server did not become ready: ${output}`)), 8000);
      const ready = () => { if (output.includes(`http://127.0.0.1:${port}/`)) { clearTimeout(timer); accept(); } };
      child.stdout.on('data', ready);
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', () => { clearTimeout(timer); reject(new Error(`Server exited before readiness: ${output}`)); });
    });
    assert.equal((await request(port, '/')).status, 200);
    return { port, close, child };
  } catch (error) { await close(); throw error; }
}

async function allFiles(root, directory = '') {
  const names = [];
  for (const entry of await readdir(join(root, directory), { withFileTypes: true })) {
    const name = join(directory, entry.name);
    if (entry.isDirectory()) names.push(...await allFiles(root, name));
    else names.push(name.replaceAll('\\', '/'));
  }
  return names;
}

describe('actual static build and HTTP delivery', () => {
  let isolated; let development; let production;
  before(async () => {
    isolated = await fixture();
    const result = await run(buildScript, isolated.root);
    assert.equal(result.code, 0, result.stderr);
    development = await startServer(isolated.root);
    production = await startServer(isolated.root, true);
  });
  after(async () => {
    await Promise.all([development?.close(), production?.close()]);
    if (isolated) await rm(isolated.temporaryRoot, { recursive: true });
  });

  test('GET serves the real entry point and every referenced runtime asset in development and dist', async () => {
    const html = await readFile(join(isolated.root, 'index.html'));
    const assets = [...html.toString().matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(\.\/[^"?#]+)"/g)].map((match) => match[1].slice(1));
    const manifest=JSON.parse(await readFile(join(isolated.root,'src/data/model-manifest.json'),'utf8'));
    assert.equal(manifest.models.length,16);
    assert.equal(new Set(manifest.models.map((model)=>model.id)).size,16);
    assets.push('/src/data/model-manifest.json',...manifest.models.map((model)=>'/'+model.source));
    assert.ok(assets.length > 25);
    for (const server of [development, production]) {
      const entry = await request(server.port, '/');
      assert.deepEqual(entry.body, html);
      assert.match(entry.headers['content-type'], /^text\/html/);
      assert.equal(entry.headers['x-content-type-options'], 'nosniff');
      assert.match(entry.headers['content-security-policy'], /frame-ancestors 'self'/);
      const admin=await request(server.port,'/admin.html');
      assert.equal(admin.status,200);
      assert.match(admin.headers['content-security-policy'],/frame-ancestors 'none'/);
      for (const path of assets) {
        const response = await request(server.port, `${path}?cache-test=1`);
        assert.equal(response.status, 200, path);
        assert.ok(response.body.length > 0, path);
        assert.equal(Number(response.headers['content-length']), response.body.length, path);
        assert.match(response.headers['content-type'], path.endsWith('.css') ? /^text\/css/ : path.endsWith('.json') ? /^application\/json/ : path.endsWith('.webmanifest') ? /^application\/manifest\+json/ : /^text\/javascript/, path);
        assert.deepEqual(response.body, await readFile(join(isolated.root, server === production ? 'dist' : '', path.slice(1))), path);
      }
    }
  });

  test('HEAD retains GET metadata without sending a response body', async () => {
    for (const server of [development, production]) {
      for (const path of ['/index.html', '/vendor/babylon.js', '/src/data/site-plan.js']) {
        const get = await request(server.port, path);
        const head = await request(server.port, path, 'HEAD');
        assert.equal(head.status, 200);
        assert.equal(head.body.length, 0);
        assert.equal(head.headers['content-length'], get.headers['content-length']);
        assert.equal(head.headers['content-type'], get.headers['content-type']);
      }
    }
  });

  test('malformed URI returns 400 and the same process continues to serve requests', async () => {
    for (const server of [development, production]) {
      assert.equal((await request(server.port, '/%E0%A4%A')).status, 400);
      assert.equal((await request(server.port, '/%')).status, 400);
      assert.equal((await request(server.port, '/')).status, 200);
    }
  });

  test('hidden files, dependencies, private source files and raw review assets cannot be fetched', async () => {
    for (const server of [development, production]) {
      for (const path of deniedFiles) {
        const response = await request(server.port, `/${path}`);
        assert.equal(response.status, 404, path);
        assert.ok(!response.body.toString().includes('private test content'), path);
      }
    }
  });

  test('encoded traversal, Windows separators and null bytes do not reach files', async () => {
    const paths = ['/src/../package.json', '/src/%2e%2e/package.json', '/%2e%2e%2fpackage.json', '/src/%2e%2e%5cpackage.json', '/src%5c..%5cpackage.json', '/node_modules%2fprivate.json', '/src/data/site-plan.js%00.json', '/.private.json'];
    for (const server of [development, production]) for (const path of paths) assert.equal((await request(server.port, path)).status, 404, path);
  });

  test('POST returns 405 with the supported methods and no source bytes', async () => {
    for (const server of [development, production]) {
      const response = await request(server.port, '/index.html', 'POST');
      assert.equal(response.status, 405);
      assert.equal(response.headers.allow, 'GET, HEAD');
      assert.equal(response.body.length, 0);
      assert.equal((await request(server.port, '/')).status, 200);
    }
  });

  test('browser launch health gate accepts the real page and rejects successful non-entry assets', async () => {
    for (const server of [development, production]) {
      const url = `http://127.0.0.1:${server.port}`;
      await assertEntryReady(`${url}/`);
      await assert.rejects(assertEntryReady(`${url}/src/data/site-plan.js`), /local entry page is not ready/);
      await assert.rejects(assertEntryReady(`${url}/not-a-page`), /local entry page is not ready/);
    }
  });

  test('build omits private source and all raw PDF, HTML and map page PNG, including stale copies', async () => {
    const files = await allFiles(join(isolated.root, 'dist'));
    assert.ok(files.includes('src/data/site-plan.js'));
    assert.ok(files.includes('evidence/official-campus-markers.json'));
    assert.ok(files.includes('vendor/NOTICE.txt'));
    assert.ok(files.includes('admin.html'));
    assert.ok(files.includes('service-worker.js'));
    assert.deepEqual(files.filter((name) => name.endsWith('.pdf') || name.endsWith('.html') && !['index.html','admin.html'].includes(name) || /campus-map-page\d+\.png$/.test(name) || name.includes('developer-notes') || name.includes('.private')), []);
    const rebuilt = await run(buildScript, isolated.root);
    assert.equal(rebuilt.code, 0, rebuilt.stderr);
    assert.deepEqual(await allFiles(join(isolated.root, 'dist')), files, 'a repeated build retains the same reviewed file set');
  });

  test('runtime paths redirected by a directory junction cannot escape the server root', async () => {
    const directory = join(isolated.root, 'src/data');
    const original = `${directory}-original`;
    const outside = join(isolated.temporaryRoot, 'outside-data');
    await put(outside, 'site-plan.js', 'outside private data');
    await rename(directory, original);
    try {
      await symlink(outside, directory, process.platform === 'win32' ? 'junction' : 'dir');
      const response = await request(development.port, '/src/data/site-plan.js');
      assert.equal(response.status, 404);
      assert.ok(!response.body.toString().includes('outside private data'));
    } finally {
      await rm(directory, { force: true });
      await rename(original, directory);
    }
  });

  test('a linked dist root is rejected without deleting the target contents', async () => {
    const directory = join(isolated.root, 'dist');
    const original = `${directory}-original`;
    const outside = join(isolated.temporaryRoot, 'outside-dist');
    await put(outside, 'protected.json', 'keep the target file');
    await rename(directory, original);
    try {
      await symlink(outside, directory, process.platform === 'win32' ? 'junction' : 'dir');
      const result = await run(buildScript, isolated.root);
      assert.equal(result.code, 1);
      assert.match(result.stderr, /generated distribution cannot be a directory link/);
      assert.equal(await readFile(join(outside, 'protected.json'), 'utf8'), 'keep the target file');
    } finally {
      await rm(directory, { force: true });
      await rename(original, directory);
    }
  });
});

test('invalid PORT values fail before the server becomes available', async () => {
  for (const value of ['not-a-number', '1023', '65536', '8765.5', '0']) {
    const result = await run(serverScript, checkout, [], { PORT: value });
    assert.equal(result.code, 1, value);
    assert.match(result.stderr, /PORT must be an integer between 1024 and 65535/);
    assert.equal(result.stdout, '', value);
  }
});
