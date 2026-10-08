import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtemp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join, dirname, sep, basename } from 'node:path';
import { build } from 'esbuild';
import { triangleGlb } from './fixtures/self-contained-glb.mjs';

// Compile the current server directly, so tests exercise source changes without
// depending on a concurrent browser build or its generated server artifact.
const compiled = await build({ entryPoints: ['server/platform.ts'], bundle: true, write: false, format: 'esm', platform: 'node', target: 'node22' });
const { createPlatform, loadDomain } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const root = resolve('.'), { domain, baseline } = loadDomain(root);
const copy = (value) => JSON.parse(JSON.stringify(value));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fixtureTime = '2026-10-07T08:00:00Z';

function changeGlb(bytes, change) {
  const document = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  change(document);
  const json = Buffer.from(JSON.stringify(document)), jsonLength = Math.ceil(json.length / 4) * 4;
  const remainder = bytes.subarray(20 + bytes.readUInt32LE(12));
  const output = Buffer.alloc(20 + jsonLength + remainder.length);
  bytes.subarray(0, 20).copy(output); output.writeUInt32LE(output.length, 8); output.writeUInt32LE(jsonLength, 12);
  output.fill(32, 20, 20 + jsonLength); json.copy(output, 20); remainder.copy(output, 20 + jsonLength);
  return output;
}

async function fixture({ oldDatabase = false } = {}) {
  const temporary = await mkdtemp(join(tmpdir(), 'hanshin-bundle-'));
  const safeCleanup = () => {
    if (!resolve(temporary).startsWith(resolve(tmpdir()) + sep) || !basename(temporary).startsWith('hanshin-bundle-')) throw new Error('Unsafe fixture cleanup directory.');
  };
  safeCleanup();
  const assetRoot = join(temporary, 'public-assets'), databasePath = join(temporary, 'private.sqlite');
  const manifest = JSON.parse(await readFile(join(root, 'src/data/model-manifest.json'), 'utf8'));
  // Real legacy source files are copied into an isolated asset directory. The
  // optional overview variants are unrelated to the publication assertions.
  manifest.models = manifest.models.map((entry) => { const model = { ...entry }; delete model.variants; return model; });
  const fixtureBaseline = { ...copy(baseline), assetManifest: copy(manifest) };
  async function asset(path, bytes) { const target = join(assetRoot, path); await mkdir(dirname(target), { recursive: true }); await writeFile(target, bytes); }
  for (const model of manifest.models) await asset(model.source, await readFile(join(root, model.source)));
  await asset('src/data/model-manifest.json', JSON.stringify(manifest));
  await asset('assets/media/manifest.json', JSON.stringify({ schemaVersion: 1, records: [] }));
  const index = Buffer.from('<!doctype html><title>Public release fixture</title>');
  await asset('index.html', index);
  await asset('offline-manifest.json', JSON.stringify({ schemaVersion: 1, assets: [{ path: 'index.html', bytes: index.length, sha256: sha(index), detail: false }] }));
  let oldRelease = null;
  if (oldDatabase) {
    const db = new DatabaseSync(databasePath);
    db.exec('CREATE TABLE migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)');
    for (const [index, file] of ['0001-platform.sql', '0002-provider-runs.sql'].entries()) {
      db.exec(await readFile(join(root, 'server/migrations', file), 'utf8')); db.prepare('INSERT INTO migrations VALUES(?,?)').run(index + 1, fixtureTime);
    }
    oldRelease = randomUUID();
    db.prepare('INSERT INTO releases(id,catalog,summary,created_at) VALUES(?,?,?,?)').run(oldRelease, JSON.stringify(fixtureBaseline), 'Existing schema 2 release', fixtureTime);
    db.prepare('INSERT INTO settings VALUES(?,?)').run('currentRelease', oldRelease); db.prepare('INSERT INTO settings VALUES(?,?)').run('revision', '7');
    db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?,?)').run('existing-user', 'existing-account', 'old-password-hash-preserved', 'editor', '["hanshin-gg"]', 1, fixtureTime);
    db.prepare('INSERT INTO reports VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run('existing-report', 'hanshin-gg:building:janggong', 'location', 'PRIVATE_LEGACY_REPORT', 'received', null, null, 'old-idempotency', 'old-request-hash', '', fixtureTime, fixtureTime);
    db.prepare('INSERT INTO provider_runs VALUES(?,?,?,?,?,?)').run('existing-provider', 'failed', fixtureTime, null, null, 'OLD_PROVIDER_FAILURE');
    db.close();
  }
  let platform;
  const server = http.createServer((request, response) => platform.handle(request, response));
  await new Promise((accept, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', accept); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  platform = createPlatform({ root, assetRoot, databasePath, origins: [origin], domain, baseline: fixtureBaseline, now: () => new Date(fixtureTime), log() {} });
  for (const role of ['admin', 'editor', 'reviewer']) platform.repository.createUser(role, `bundle-password-${role}`, role, role === 'admin' ? [] : ['hanshin-gg']);
  async function request(path, method = 'GET', body, session) {
    const response = await fetch(origin + path, { method, headers: { Origin: origin, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(session ? { Cookie: session.cookie, 'X-CSRF-Token': session.csrf } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const bytes = Buffer.from(await response.arrayBuffer()); let json = null;
    if (response.headers.get('content-type')?.includes('application/json')) json = JSON.parse(bytes.toString());
    return { status: response.status, headers: response.headers, bytes, json };
  }
  async function login(role) { const result = await request('/api/v1/session', 'POST', { username: role, password: `bundle-password-${role}` }); assert.equal(result.status, 200); return { cookie: result.headers.get('set-cookie').split(';')[0], csrf: result.json.data.csrfToken }; }
  async function approve(catalog, revision, editor, reviewer) {
    let result = await request('/api/v1/admin/drafts', 'POST', { catalog, summary: 'Reviewed asset bundle fixture', expectedRevision: revision }, editor);
    assert.equal(result.status, 201, JSON.stringify(result.json)); let draft = result.json.data;
    result = await request(`/api/v1/admin/drafts/${draft.id}`, 'PATCH', { action: 'submit', expectedRevision: draft.revision }, editor); assert.equal(result.status, 200); draft = result.json.data;
    result = await request(`/api/v1/admin/drafts/${draft.id}`, 'PATCH', { action: 'approve', expectedRevision: draft.revision }, reviewer); assert.equal(result.status, 200); return result.json.data;
  }
  function catalogFor(bytes, suffix) {
    const catalog = copy(baseline); catalog.contentVersion += `-${suffix}`; catalog.datasetVersion = catalog.contentVersion;
    const model = { ...manifest.models[0], kind: 'glb', source: 'assets/models/reviewed.glb', bytes: bytes.length, sha256: sha(bytes), placement: { units: 'm', upAxis: 'Y', origin: [0, 0, 0], anchorMeters: [0, 0, 0], yawRadians: 0, altitudeDatum: 'fixture-local-datum', mode: 'inferred' } };
    delete model.global; delete model.export;
    catalog.assetManifest = { ...copy(manifest), version: `${manifest.version}-${suffix}`, models: [model, ...copy(manifest.models.slice(1))] };
    return catalog;
  }
  return { assetRoot, databasePath, manifest, oldRelease, platform, request, login, asset, approve, catalogFor, async close() { server.closeAllConnections(); await new Promise((accept) => server.close(accept)); platform.close(); safeCleanup(); await rm(temporary, { recursive: true }); } };
}

test('public baseline backfill seals all 16 real model bytes and publishes only linked immutable assets', async () => {
  const f = await fixture();
  try {
    const catalog = await f.request('/api/v1/catalog'); assert.equal(catalog.status, 200);
    const releaseId = catalog.json.meta.releaseId, result = await f.request(`/api/v1/bundle?release=${releaseId}`); assert.equal(result.status, 200);
    const bundle = result.json.data; assert.equal(bundle.manifest.models.length, 16); assert.equal(bundle.assetsVersion, bundle.manifest.version);
    assert.equal(bundle.catalogHash, sha(JSON.stringify(bundle.catalog))); assert.equal(catalog.json.data.assetsVersion, bundle.assetsVersion);
    for (const model of bundle.manifest.models) {
      const snapshot = bundle.assets.find((entry) => entry.path === model.source); assert.ok(snapshot); assert.equal(model.sha256, snapshot.sha256);
      const file = await f.request('/' + model.source); assert.equal(file.status, 200); assert.equal(sha(file.bytes), model.sha256); assert.equal(file.bytes.length, model.bytes);
      assert.match(file.headers.get('cache-control'), /immutable/); assert.equal(file.headers.get('x-content-type-options'), 'nosniff');
    }
    const first = bundle.manifest.models[0], sealed = await f.request('/' + first.source);
    await f.asset(f.manifest.models[0].source, 'Mutable source changes after backfill');
    assert.deepEqual((await f.request('/' + first.source)).bytes, sealed.bytes);
    assert.equal((await f.request(`/assets/releases/${'0'.repeat(64)}.glb`)).status, 404);
    assert.ok(!JSON.stringify(bundle).includes('PRIVATE_LEGACY_REPORT'));
  } finally { await f.close(); }
});

test('approved GLB releases bind hash, source privacy and catalog together; history and restore retain old bytes', async () => {
  const f = await fixture();
  try {
    const editor = await f.login('editor'), reviewer = await f.login('reviewer'), admin = await f.login('admin');
    await f.request('/api/v1/catalog');
    const firstBytes = triangleGlb(), first = f.catalogFor(firstBytes, 'first');
    const hidden = first.entities.find((item) => item.kind === 'external-facility'); hidden.visibility = 'restricted'; hidden.name = 'PRIVATE_ENTITY_MARKER';
    first.sources.push({ ...copy(first.sources[0]), id: 'private-fixture-source', visibility: 'restricted', title: 'PRIVATE_SOURCE_MARKER' });
    const privateModelSource=first.assetManifest.models[1].source;
    first.assetManifest.models[1].provenance = { sourceId: 'private-fixture-source', license: 'PRIVATE_SOURCE_MARKER', generated: false, note: 'PRIVATE_SOURCE_MARKER' };
    const mediaBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
    await f.asset('assets/media/reviewed.png', mediaBytes);
    await f.asset('assets/media/manifest.json', JSON.stringify({ schemaVersion: 1, records: [{ path: 'assets/media/reviewed.png', kind: 'image', public: true, sourceId: first.sources.find((source) => source.visibility === 'public').id, entityId: first.entities.find((entity) => entity.kind === 'building').id, license: 'Fixture reuse permission' }] }));
    await f.asset('assets/models/reviewed.glb', firstBytes);
    let draft = await f.approve(first, 1, editor, reviewer);
    const publish1 = await f.request('/api/v1/admin/releases', 'POST', { draftId: draft.id, expectedRevision: 1 }, reviewer); assert.equal(publish1.status, 201, JSON.stringify(publish1.json));
    const id1 = publish1.json.data.id, oldBundle = (await f.request(`/api/v1/bundle?release=${id1}`)).json.data;
    assert.ok(!JSON.stringify(oldBundle).includes('PRIVATE_ENTITY_MARKER')); assert.ok(!JSON.stringify(oldBundle).includes('PRIVATE_SOURCE_MARKER'));
    assert.ok(oldBundle.assets.every(asset=>asset.originalPath!==privateModelSource));
    assert.equal(oldBundle.catalogHash, sha(JSON.stringify(oldBundle.catalog))); assert.equal(oldBundle.manifest.models[0].sha256, sha(firstBytes));
    assert.equal(oldBundle.mediaRecords.length, 1); assert.match(oldBundle.mediaRecords[0].path, /^assets\/releases\/[a-f0-9]{64}\.png$/); assert.deepEqual((await f.request('/' + oldBundle.mediaRecords[0].path)).bytes, mediaBytes);
    const firstPath = oldBundle.manifest.models[0].source; assert.deepEqual((await f.request('/' + firstPath)).bytes, firstBytes);
    const secondBytes = changeGlb(firstBytes, (document) => { document.nodes[0].name = 'Second approved geometry revision'; });
    const second = f.catalogFor(secondBytes, 'second'); await f.asset('assets/models/reviewed.glb', secondBytes);
    draft = await f.approve(second, 2, editor, reviewer);
    const publish2 = await f.request('/api/v1/admin/releases', 'POST', { draftId: draft.id, expectedRevision: 2 }, reviewer); assert.equal(publish2.status, 201);
    const current = await f.request('/api/v1/catalog'), newBundle = (await f.request('/api/v1/bundle')).json.data;
    assert.equal(current.json.meta.releaseId, publish2.json.data.id); assert.notEqual(newBundle.manifest.models[0].source, firstPath);
    assert.deepEqual((await f.request('/' + firstPath)).bytes, firstBytes); assert.deepEqual((await f.request(`/api/v1/bundle?release=${id1}`)).json.data, oldBundle);
    const restore = await f.request(`/api/v1/admin/releases/${id1}/restore`, 'POST', { expectedRevision: 3 }, admin); assert.equal(restore.status, 200);
    const restored = await f.request('/api/v1/catalog'); assert.equal(restored.json.meta.releaseId, id1); assert.equal(restored.json.data.contentVersion, first.contentVersion);
    assert.deepEqual(restored.json.data.assetManifest, oldBundle.manifest); assert.deepEqual((await f.request('/api/v1/bundle')).json.data, oldBundle);
    assert.deepEqual((await f.request('/' + newBundle.manifest.models[0].source)).bytes, secondBytes);
  } finally { await f.close(); }
});

test('invalid asset integrity and private GLB semantics fail before publication changes the release or stores bytes', async () => {
  const f = await fixture();
  try {
    const editor = await f.login('editor'), reviewer = await f.login('reviewer'); const original = (await f.request('/api/v1/catalog')).json;
    const db = f.platform.repository.db, count = (table) => Number(db.prepare(`SELECT count(*) AS total FROM ${table}`).get().total);
    const initial = ['releases', 'release_bundles', 'public_asset_blobs', 'release_asset_links'].map(count);
    const invalidCases = [
      { name: 'hash-mismatch', bytes: triangleGlb(), manifest(model) { model.sha256 = '1'.repeat(64); } },
      { name: 'remote-source', bytes: triangleGlb(), draftRejected: true, manifest(model) { model.source = 'https://private.invalid/campus.glb'; } },
      { name: 'private-node', bytes: changeGlb(triangleGlb(), (document) => { document.nodes[0].extras = { visibility: 'restricted', sensitive: true }; }) },
      { name: 'unknown-floor', bytes: changeGlb(triangleGlb(), (document) => { document.nodes[0].extras = { floorId: 'private-unregistered-floor' }; }) },
      { name: 'private-mesh-extras', bytes: changeGlb(triangleGlb(), (document) => { document.meshes[0].extras = { visibility: 'restricted', note: 'PRIVATE_MESH_MARKER' }; }) },
      { name: 'private-media-source', bytes: triangleGlb(), media: true }
    ];
    for (const invalid of invalidCases) {
      const catalog = f.catalogFor(invalid.bytes, invalid.name); invalid.manifest?.(catalog.assetManifest.models[0]); await f.asset('assets/models/reviewed.glb', invalid.bytes);
      await f.asset('assets/media/manifest.json', JSON.stringify({ schemaVersion: 1, records: [] }));
      if (invalid.media) {
        catalog.sources.push({ ...copy(catalog.sources[0]), id: 'private-media-source', visibility: 'restricted', title: 'PRIVATE_MEDIA_SOURCE' });
        await f.asset('assets/media/reviewed.png', Buffer.from('Private media must never be copied'));
        await f.asset('assets/media/manifest.json', JSON.stringify({ schemaVersion: 1, records: [{ path: 'assets/media/reviewed.png', kind: 'image', public: true, sourceId: 'private-media-source', entityId: catalog.entities.find((entity) => entity.kind === 'building').id, license: 'Fixture reuse permission' }] }));
      }
      const draft = invalid.draftRejected ? null : await f.approve(catalog, 1, editor, reviewer);
      const failed = draft ? await f.request('/api/v1/admin/releases', 'POST', { draftId: draft.id, expectedRevision: 1 }, reviewer) : await f.request('/api/v1/admin/drafts', 'POST', { catalog, summary: 'Invalid remote source', expectedRevision: 1 }, editor);
      assert.ok(failed.status >= 400 && failed.status < 500, `${invalid.name}: ${failed.status} ${JSON.stringify(failed.json)}`);
      assert.deepEqual(['releases', 'release_bundles', 'public_asset_blobs', 'release_asset_links'].map(count), initial);
      assert.equal(f.platform.repository.revision(), 1); if (draft) assert.equal(db.prepare('SELECT status FROM drafts WHERE id=?').get(draft.id).status, 'approved');
      assert.equal((await f.request('/api/v1/catalog')).json.meta.releaseId, original.meta.releaseId);
    }
  } finally { await f.close(); }
});

test('schema 3 adds immutable bundle storage and lazily backfills old releases without resetting private schema 2 data', async () => {
  const f = await fixture({ oldDatabase: true });
  try {
    const db = f.platform.repository.db;
    assert.deepEqual(db.prepare('SELECT version FROM migrations ORDER BY version').all().map((row) => row.version), [1, 2, 3]);
    assert.equal(f.platform.repository.revision(), 7); assert.equal(db.prepare('SELECT password_hash FROM users WHERE id=?').get('existing-user').password_hash, 'old-password-hash-preserved');
    assert.equal(db.prepare('SELECT description FROM reports WHERE id=?').get('existing-report').description, 'PRIVATE_LEGACY_REPORT');
    assert.equal(db.prepare('SELECT error_code FROM provider_runs WHERE provider_id=?').get('existing-provider').error_code, 'OLD_PROVIDER_FAILURE');
    assert.equal(db.prepare('SELECT count(*) AS total FROM release_bundles').get().total, 0);
    const result = await f.request(`/api/v1/bundle?release=${f.oldRelease}`); assert.equal(result.status, 200, JSON.stringify(result.json));
    assert.equal(result.json.data.releaseId, f.oldRelease); assert.equal(result.json.data.manifest.models.length, 16); assert.ok(!JSON.stringify(result.json).includes('PRIVATE_LEGACY_REPORT'));
    assert.equal(db.prepare('SELECT count(*) AS total FROM release_bundles').get().total, 1); assert.equal(f.platform.repository.revision(), 7);
    assert.equal((await f.request('/api/v1/catalog')).json.meta.releaseId, f.oldRelease);
  } finally { await f.close(); }
});
