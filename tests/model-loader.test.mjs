import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import { triangleGlb } from './fixtures/self-contained-glb.mjs';

const require = createRequire(import.meta.url);
const B = require('babylonjs');
const compiled = await build({ entryPoints: ['src/scene/model-loader.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { createModelLoader, validateModelManifest, validateSelfContainedGlb, applyModelPlacement, modelsForCampus, browserGlbModel, browserLegacyFactory, chooseModelVariant, configureLocalDecoders } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const manifest = JSON.parse(fs.readFileSync('src/data/model-manifest.json', 'utf8'));

function fixture(registrations = manifest.models) {
  const engine = new B.NullEngine(); const scene = new B.Scene(engine);
  const visible = new Map(); let aligned = 0;
  const site = { alignModel() { aligned += 1; return true; }, setBuildingDetailVisible(id, value) { visible.set(id, value); }, releaseModel() {}, terrainHeightAt() { return 99; } };
  const makeModel = () => { const root = new B.TransformNode('model', scene); const main = B.MeshBuilder.CreateBox('model-main', {}, scene); main.parent = root; return { root, main }; };
  const options = { scene, site, materials: {}, manifest: { ...manifest, models: registrations }, legacyFactory: async () => makeModel, importGlb: async () => makeModel() };
  return { scene, engine, site, visible, options, makeModel, get aligned() { return aligned; }, dispose() { scene.dispose(); engine.dispose(); } };
}

test('manifest has one registration for each original model and rejects unsafe or duplicate providers', () => {
  validateModelManifest(manifest);
  assert.equal(manifest.models.length, 16);
  assert.equal(new Set(manifest.models.map((entry) => entry.source)).size, 16);
  for (const source of ['../model.js', 'https://example.com/model.js', 'src/models/../../outside.js']) assert.throws(() => validateModelManifest({ ...manifest, models: [{ ...manifest.models[0], source }] }));
  assert.throws(() => validateModelManifest({ ...manifest, models: [manifest.models[0], manifest.models[0]] }));
});

test('one failed detail keeps its base and other buildings usable; retry releases partial factory resources', async () => {
  const f = fixture(manifest.models.slice(0, 2)); let fail = true;
  const loader = createModelLoader({ ...f.options, legacyFactory: async (entry) => {
    if (entry.id === 'janggong' && fail) return () => { f.makeModel(); throw new Error('Corrupt detail'); };
    return f.makeModel;
  } });
  try {
    assert.equal(await loader.load('janggong'), null);
    assert.equal(loader.getState('janggong').status, 'error');
    assert.equal(f.visible.get('janggong'), false);
    assert.equal(f.scene.meshes.length, 0);
    assert.ok(await loader.load('pilheon'));
    fail = false;
    assert.ok(await loader.retry('janggong'));
    assert.equal(loader.getState('janggong').attempts, 2);
    assert.equal(loader.getDiagnostics().loaded, 2);
  } finally { loader.dispose(); f.dispose(); }
});

test('cancellation and disposal prevent stale factories attaching to the old campus', async () => {
  const f = fixture(manifest.models.slice(0, 1)); let resolveFactory;
  const loader = createModelLoader({ ...f.options, legacyFactory: () => new Promise((resolve) => { resolveFactory = resolve; }) });
  try {
    const pending = loader.load('janggong');
    loader.dispose(); resolveFactory(f.makeModel);
    assert.equal(await pending, null);
    assert.equal(loader.getState('janggong').status, 'cancelled');
    assert.equal(f.scene.meshes.length, 0);
    assert.equal(loader.getDiagnostics().loaded, 0);
  } finally { f.dispose(); }
});

test('a new manifest registration uses the same loading contract without a building-specific branch', async () => {
  const entry = { id: 'new-building', kind: 'legacy', global: 'NewBuilding', export: 'createModel', source: 'src/models/new-building.js', status: 'estimated' };
  const f = fixture([...manifest.models, entry]); const loader = createModelLoader(f.options);
  try {
    assert.ok(await loader.load(entry.id));
    assert.equal(loader.getDiagnostics().registered, 17);
    assert.equal(loader.getState(entry.id).status, 'ready');
    assert.equal(f.aligned, 1);
  } finally { loader.dispose(); f.dispose(); }
});

test('campus registrations are isolated and an explicit GLB replaces only its registered building', () => {
  const features = manifest.models.map((entry) => ({ id: entry.id, legacyKey: entry.legacyId }));
  assert.equal(modelsForCampus(manifest, 'hanshin-gg', features).length, 16);
  assert.equal(modelsForCampus(manifest, 'another-campus', features).length, 0);
  const replacement = { ...manifest.models[0], id: 'measured-janggong', buildingId: 'janggong', kind: 'glb', source: 'assets/models/janggong.glb' };
  assert.equal(modelsForCampus({ ...manifest, models: [...manifest.models, replacement] }, 'hanshin-gg', features).find((entry) => entry.buildingId === 'janggong'), replacement);
});

test('all sixteen checked-in factories load through their manifest exports with stable state and vertex geometry', async () => {
  const f = fixture(); const context = vm.createContext({ BABYLON: B, window: {}, console });
  const materials = new Proxy({}, { get(_target, key) { return f.scene.getMaterialByName(String(key)) || new B.StandardMaterial(String(key), f.scene); } });
  const loader = createModelLoader({ ...f.options, materials, legacyFactory: async (entry) => {
    vm.runInContext(fs.readFileSync(entry.source, 'utf8'), context);
    return context.window[entry.global][entry.export];
  } });
  try {
    await loader.prefetch();
    assert.equal(loader.getDiagnostics().loaded, 16);
    assert.equal(loader.getDiagnostics().pending, 0);
    for (const entry of manifest.models) {
      assert.equal(loader.getState(entry.id).status, 'ready');
      const model = loader.models.get(entry.id); const main = model.main || model.hall || model.newDorm || model.mediaHall;
      assert.ok(main.getTotalVertices() > 0);
      const vertices = main.getTotalVertices();
      assert.equal(await loader.load(entry.id), model);
      assert.equal(main.getTotalVertices(), vertices);
    }
  } finally { loader.dispose(); f.dispose(); }
});

test('measured GLB placement changes units and axes but does not fit or stretch the asset to an estimated pad', () => {
  const f = fixture();
  try {
    const model = f.makeModel(); const before = Array.from(model.main.getVerticesData(B.VertexBuffer.PositionKind));
    const placement = { units: 'cm', upAxis: 'Z', origin: [100, 0, 200], anchorMeters: [40, 60, 8], yawRadians: 0.3, altitudeDatum: 'local-site-meters', mode: 'measured' };
    applyModelPlacement(B, model.root, placement, () => 99);
    assert.deepEqual(Array.from(model.main.getVerticesData(B.VertexBuffer.PositionKind)), before);
    assert.deepEqual(model.root.scaling.asArray(), [0.001, 0.001, 0.001]);
    model.root.computeWorldMatrix(true);
    const origin = B.Vector3.TransformCoordinates(B.Vector3.FromArray(placement.origin), model.root.getWorldMatrix());
    assert.ok(B.Vector3.Distance(origin, new B.Vector3(4, 0.8, -6)) < 0.000001);
    assert.equal(f.aligned, 0);
    assert.throws(() => applyModelPlacement(B, model.root, { ...placement, altitudeDatum: 'unknown-geoid' }, () => 99));
  } finally { f.dispose(); }
});

test('a measured asset uses the loader state contract without inferred alignment and is released independently', async () => {
  const placement = { units: 'm', upAxis: 'Y', origin: [0, 0, 0], anchorMeters: [0, 0, 0], yawRadians: 0, altitudeDatum: 'terrain-relative', mode: 'measured' };
  const entry = { id: 'new-measured', kind: 'glb', source: 'assets/models/new-measured.glb', status: 'measured', placement };
  const f = fixture([entry]); const loader = createModelLoader(f.options);
  try { const model = await loader.load(entry.id); assert.ok(model); assert.equal(f.aligned, 0); assert.equal(loader.getState(entry.id).status, 'ready'); loader.release(entry.id); assert.equal(model.root.isDisposed(), true); assert.equal(loader.getState(entry.id).status, 'base'); assert.equal(loader.getDiagnostics().loaded, 0); } finally { loader.dispose(); f.dispose(); }
});

function glb(data) {
  const encoded = Buffer.from(JSON.stringify({ asset: { version: '2.0' }, ...data })); const length = Math.ceil(encoded.length / 4) * 4;
  const buffer = new ArrayBuffer(20 + length); const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true); view.setUint32(4, 2, true); view.setUint32(8, buffer.byteLength, true); view.setUint32(12, length, true); view.setUint32(16, 0x4e4f534a, true);
  new Uint8Array(buffer, 20).fill(32); new Uint8Array(buffer, 20, encoded.length).set(encoded); return buffer;
}
test('GLB rejects external buffers, remote images and decoder-dependent payloads before importing', () => {
  validateSelfContainedGlb(glb({ asset: { version: '2.0' }, buffers: [{ byteLength: 0 }] }));
  assert.throws(() => validateSelfContainedGlb(glb({ buffers: [{ uri: 'https://example.com/data.bin' }] })));
  assert.throws(() => validateSelfContainedGlb(glb({ images: [{ uri: '../secret.png' }] })));
  assert.throws(() => validateSelfContainedGlb(glb({ extensionsRequired: ['KHR_draco_mesh_compression'] })));
  assert.throws(() => validateSelfContainedGlb(glb({ extensionsUsed: ['EXT_meshopt_compression'] })));
  assert.throws(() => validateSelfContainedGlb(glb({ images: [{ uri: 123 }] })));
  assert.throws(() => validateSelfContainedGlb(glb({ images: [{ uri: 'data:text/html;base64,AAAA' }] })));
  assert.throws(() => validateSelfContainedGlb(glb({ extensions: { MSFT_audio_emitter: { clips: [{ uri: 'https://example.com/audio.ogg' }] } } })));
  assert.throws(() => validateSelfContainedGlb(glb({ meshes: [{ primitives: [{ extensions: { KHR_draco_mesh_compression: { bufferView: 0 } } }] }] })));
});

test('GLB adapter passes only validated binary bytes to Babylon and releases the loaded container', async (t) => {
  const bytes = triangleGlb(), buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const f = fixture(); const model = f.makeModel(); let released = 0, imported = 0;
  t.mock.method(globalThis, 'fetch', async (url, options) => { assert.equal(url, './assets/models/fixture.glb'); assert.equal(options.credentials, 'same-origin'); return { ok: true, arrayBuffer: async () => buffer }; });
  const entry = { id: 'fixture', kind: 'glb', source: 'assets/models/fixture.glb', status: 'measured', placement: { units: 'm', upAxis: 'Y', origin: [0, 0, 0], anchorMeters: [40, 60, 8], yawRadians: 0, altitudeDatum: 'local-site-meters', mode: 'measured' } };
  const container = { rootNodes: [model.root], meshes: [model.main], addAllToScene() {}, dispose() { released += 1; model.root.dispose(); } };
  const runtime = { ...B, SceneLoader: { IsPluginForExtensionAvailable: () => true, async LoadAssetContainerAsync(root, source, scene, progress, extension) { imported += 1; assert.equal(root, ''); assert.ok(source instanceof Uint8Array); assert.equal(source.buffer, buffer); assert.equal(scene, f.scene); assert.equal(progress, undefined); assert.equal(extension, '.glb'); return container; } } };
  try {
    const result = await browserGlbModel(runtime, f.scene, f.site, entry, { aborted: false });
    assert.equal(imported, 1); assert.deepEqual(result.root.position.asArray(), [4, 0.8, -6]);
    assert.deepEqual(result.root.scaling.asArray(), [0.1, 0.1, 0.1]);
    assert.equal(result.root.metadata.shapePreserved, true); result.dispose(); assert.equal(released, 1); assert.equal(result.root.isDisposed(), true);
  } finally { f.dispose(); }
});

test('GLB completion after cancellation and missing geometry both dispose their container once', async (t) => {
  const bytes = triangleGlb(), buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, arrayBuffer: async () => buffer }));
  const entry = { id: 'fixture', kind: 'glb', source: 'assets/models/fixture.glb', status: 'measured', placement: { units: 'm', upAxis: 'Y', origin: [0, 0, 0], anchorMeters: [0, 0, 0], yawRadians: 0, altitudeDatum: 'terrain-relative', mode: 'measured' } };
  for (const cancel of [true, false]) {
    const f = fixture(), signal = { aborted: false }; let released = 0;
    const container = { rootNodes: [], meshes: [], addAllToScene() {}, dispose() { released += 1; } };
    const runtime = { ...B, SceneLoader: { IsPluginForExtensionAvailable: () => true, async LoadAssetContainerAsync() { signal.aborted = cancel; return container; } } };
    try { await assert.rejects(browserGlbModel(runtime, f.scene, f.site, entry, signal), cancel ? { name: 'AbortError' } : /no visible geometry/); assert.equal(released, 1); assert.equal(f.scene.transformNodes.length, 0); } finally { f.dispose(); }
  }
});

test('detail thresholds use a deadband and preserve IDs when registered providers change', () => {
  const entry = { ...manifest.models[0], variants: [{ id: 'overview', source: 'assets/models/overview.glb', minScreenCoverage: 0 }, { id: 'close', source: manifest.models[0].source, minScreenCoverage: 0.1, maxDistanceMeters: 100 }] };
  const sample = { id: entry.id, distanceMeters: 80, screenCoverage: 0.1, visible: true };
  assert.equal(chooseModelVariant(entry, sample, 'overview'), 'overview');
  assert.equal(chooseModelVariant(entry, { ...sample, screenCoverage: 0.12 }, 'overview'), 'close');
  assert.equal(chooseModelVariant(entry, { ...sample, screenCoverage: 0.09 }, 'close'), 'close');
  assert.equal(chooseModelVariant(entry, { ...sample, screenCoverage: 0.08 }, 'close'), 'overview');
  assert.throws(() => chooseModelVariant(entry, { ...sample, distanceMeters: -1 }));
});
test('bounded queue promotes selected requests before background tasks and cancels queued work', async () => {
  const f = fixture(manifest.models.slice(0, 4)), started = [], resolvers = new Map();
  const loader = createModelLoader({ ...f.options, maxConcurrent: 1, legacyFactory(entry) { started.push(entry.id); return new Promise((resolve) => resolvers.set(entry.id, resolve)); } });
  try {
    const first = loader.load('janggong', { priority: 'background' }), background = loader.load('pilheon', { priority: 'background' }), selected = loader.load('manwoo', { priority: 'selected' }), cancelled = loader.load('shalom', { priority: 'visible' });
    assert.deepEqual(started, ['janggong']); assert.equal(loader.getDiagnostics().queued, 3);
    loader.cancel('shalom'); assert.equal(await cancelled, null);
    resolvers.get('janggong')(f.makeModel); await first;
    assert.deepEqual(started, ['janggong', 'manwoo']);
    resolvers.get('manwoo')(f.makeModel); await selected;
    resolvers.get('pilheon')(f.makeModel); await background;
    assert.equal(loader.getDiagnostics().active, 0);
  } finally { loader.dispose(); f.dispose(); }
});
test('resident budgets evict old background detail and retain its base proxy', async () => {
  const f = fixture(manifest.models.slice(0, 3)), loader = createModelLoader({ ...f.options, maxResidentModels: 2 });
  try {
    const old = await loader.load('janggong', { priority: 'background' }); await loader.load('pilheon', { priority: 'visible' }); await loader.load('manwoo', { priority: 'selected' });
    assert.equal(loader.getDiagnostics().loaded, 2); assert.equal(loader.getDiagnostics().evictions, 1); assert.equal(old.root.isDisposed(), true); assert.equal(f.visible.get('janggong'), false); assert.equal(loader.models.has('manwoo'), true);
  } finally { loader.dispose(); f.dispose(); }
});
test('failed variant replacement keeps the previous detail and retry remains independently cancellable', async () => {
  const entry = { ...manifest.models[0], variants: [{ id: 'replacement', source: 'src/models/replacement.js' }] }, f = fixture([entry]);
  const loader = createModelLoader({ ...f.options, legacyFactory: async (selected) => { if (selected.source.includes('replacement')) throw new Error('New detail corrupt'); return f.makeModel; } });
  try {
    const previous = await loader.load(entry.id); assert.equal(await loader.load(entry.id, { variantId: 'replacement' }), null);
    assert.equal(previous.root.isDisposed(), false); assert.equal(loader.models.get(entry.id), previous); assert.equal(f.visible.get(entry.id), true);
    assert.equal(loader.getState(entry.id).variantId, 'default');
  } finally { loader.dispose(); f.dispose(); }
});
test('local decoder registration cannot activate remote paths or a partial KTX2 bundle', () => {
  assert.throws(() => configureLocalDecoders(B, { draco: { javascript: 'https://example.com/decoder.js', wasm: 'vendor/decoders/a.wasm', fallback: 'vendor/decoders/a.js' } }));
  assert.throws(() => configureLocalDecoders(B, { basis: { javascript: 'vendor/decoders/basis.js', wasm: 'vendor/decoders/basis.wasm' } }));
  assert.deepEqual(configureLocalDecoders(B, {}), []);
});
test('GLB size and hash approval failures happen before Babylon imports any geometry', async (t) => {
  const bytes = triangleGlb(), buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), f = fixture(); let imported = 0;
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, arrayBuffer: async () => buffer }));
  const entry = { id: 'integrity', kind: 'glb', source: 'assets/models/fixture.glb', status: 'estimated', bytes: buffer.byteLength + 1, placement: { units: 'm', upAxis: 'Y', origin: [0, 0, 0], anchorMeters: [0, 0, 0], yawRadians: 0, altitudeDatum: 'local-site-meters', mode: 'inferred' } };
  try {
    const runtime = { ...B, SceneLoader: { async LoadAssetContainerAsync() { imported++; }, IsPluginForExtensionAvailable: () => true } };
    await assert.rejects(browserGlbModel(runtime, f.scene, f.site, entry, { aborted: false }), /byte length/);
    await assert.rejects(browserGlbModel(runtime, f.scene, f.site, { ...entry, bytes: buffer.byteLength, sha256: 'a'.repeat(64) }, { aborted: false }), /hash/);
    assert.equal(imported, 0);
  } finally { f.dispose(); }
});
test('legacy factory cache is keyed by the exact release source and never reuses an unrelated global', async () => {
  const previousWindow = globalThis.window, previousDocument = globalThis.document, old = () => 'unrelated', factories = new Map(), calls = [];
  const source = 'src/models/cache-fixture.js', releaseA = `assets/releases/${'a'.repeat(64)}.js`, releaseB = `assets/releases/${'b'.repeat(64)}.js`;
  for (const path of [source, releaseA, releaseB]) factories.set(`./${path}`, () => path);
  globalThis.window = { CacheFixture: { create: old } };
  globalThis.document = { createElement() { return { remove() {} }; }, head: { append(script) { calls.push(script); globalThis.window.CacheFixture = { create: factories.get(script.src) }; script.onload(); } } };
  try {
    const entry = { id: 'cache-fixture', kind: 'legacy', global: 'CacheFixture', export: 'create', source, status: 'estimated' }, signal = { aborted: false, addEventListener() {}, removeEventListener() {} };
    assert.equal((await browserLegacyFactory(entry, signal))(), source);
    assert.equal((await browserLegacyFactory({ ...entry, source: releaseA }, signal))(), releaseA);
    assert.equal((await browserLegacyFactory({ ...entry, source: releaseB }, signal))(), releaseB);
    assert.equal((await browserLegacyFactory({ ...entry, source: releaseA }, signal))(), releaseA);
    assert.equal(calls.length, 3); assert.ok(calls[1].integrity.startsWith('sha256-')); assert.equal(calls[1].crossOrigin, 'anonymous');
  } finally { if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow; if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument; }
});

test('visibility admits a stable selected-first working set and cancels details that leave the viewport', async () => {
  const registrations = manifest.models.slice(0, 3).map((entry) => ({ ...entry, variants: undefined })), f = fixture(registrations), started = [];
  const loader = createModelLoader({ ...f.options, maxResidentModels: 2, legacyFactory: async (entry) => { started.push(entry.id); return f.makeModel; } });
  try {
    const samples = registrations.map((entry, index) => ({ id: entry.id, visible: true, selected: index === 2, screenCoverage: 0.3 - index * 0.1, distanceMeters: 20 + index }));
    await loader.updateVisibility(samples); await loader.updateVisibility(samples);
    assert.deepEqual(new Set(started), new Set(['janggong', 'manwoo'])); assert.equal(started.length, 2);
    assert.equal(loader.getDiagnostics().loaded, 2); assert.equal(loader.getDiagnostics().evictions, 0);
    await loader.updateVisibility(samples.map((sample) => ({ ...sample, visible: false, selected: false })));
    assert.equal(loader.getDiagnostics().loaded, 0); assert.equal(f.visible.get('janggong'), false);
  } finally { loader.dispose(); f.dispose(); }
  const pendingFixture = fixture(registrations.slice(0, 1)); let resolveFactory;
  const pendingLoader = createModelLoader({ ...pendingFixture.options, legacyFactory: () => new Promise((resolve) => { resolveFactory = resolve; }) });
  try {
    const loading = pendingLoader.updateVisibility([{ id: 'janggong', visible: true, screenCoverage: 0.2, distanceMeters: 20 }]);
    await pendingLoader.updateVisibility([{ id: 'janggong', visible: false, screenCoverage: 0, distanceMeters: 20 }]);
    resolveFactory(pendingFixture.makeModel); await loading;
    assert.equal(pendingLoader.models.size, 0); assert.equal(pendingFixture.scene.meshes.length, 0);
  } finally { pendingLoader.dispose(); pendingFixture.dispose(); }
});

test('visibility does not retry a corrupt detail every frame and explicit retry loads its failed variant', async () => {
  const entry = { ...manifest.models[0], variants: [{ id: 'replacement', source: 'src/models/replacement.js', minScreenCoverage: 0 }] }, f = fixture([entry]); let attempts = 0, fail = true;
  const loader = createModelLoader({ ...f.options, legacyFactory: async () => { attempts++; if (fail) throw new Error('Corrupt approved detail'); return f.makeModel; } });
  try {
    const samples = [{ id: entry.id, visible: true, screenCoverage: 0.2, distanceMeters: 20 }];
    await loader.updateVisibility(samples); await loader.updateVisibility(samples); await loader.updateVisibility(samples);
    assert.equal(attempts, 1); assert.equal(loader.getState(entry.id).status, 'error');
    fail = false; assert.ok(await loader.retry(entry.id)); assert.equal(attempts, 2); assert.equal(loader.getState(entry.id).variantId, 'replacement');
  } finally { loader.dispose(); f.dispose(); }
});

test('release cancels a waiting replacement intent before the previous importer settles', async () => {
  const entry = { ...manifest.models[0], variants: [{ id: 'replacement', source: 'src/models/replacement.js' }] }, f = fixture([entry]); let resolveFactory, replacementLoads = 0;
  const loader = createModelLoader({ ...f.options, legacyFactory: (selected) => { if (selected.source.includes('replacement')) { replacementLoads++; return Promise.resolve(f.makeModel); } return new Promise((resolve) => { resolveFactory = resolve; }); } });
  try {
    const old = loader.load(entry.id), replacement = loader.load(entry.id, { variantId: 'replacement' });
    loader.release(entry.id); resolveFactory(f.makeModel);
    assert.equal(await old, null); assert.equal(await replacement, null); assert.equal(replacementLoads, 0); assert.equal(loader.models.size, 0);
  } finally { loader.dispose(); f.dispose(); }
});

test('a failed attachment callback removes its disposed model and restores the base', async () => {
  const f = fixture(manifest.models.slice(0, 1)), loader = createModelLoader({ ...f.options, onLoaded() { throw new Error('Attachment failed'); } });
  try {
    assert.equal(await loader.load('janggong'), null); assert.equal(loader.models.size, 0); assert.equal(loader.getDiagnostics().residentBytes, 0);
    assert.equal(f.visible.get('janggong'), false); assert.equal(f.scene.meshes.length, 0); assert.equal(loader.getState('janggong').status, 'error');
  } finally { loader.dispose(); f.dispose(); }
});

test('distant visible details return to their proxy until selected or large enough to inspect', async () => {
  const f = fixture([{ ...manifest.models[0], variants: undefined }]), loader = createModelLoader(f.options);
  try {
    const sample = { id: 'janggong', visible: true, distanceMeters: 5000, screenCoverage: 0.001 };
    await loader.updateVisibility([sample]); assert.equal(loader.models.size, 0);
    await loader.updateVisibility([{ ...sample, selected: true }]); const selected = loader.models.get('janggong'); assert.ok(selected);
    await loader.updateVisibility([sample]); assert.equal(loader.models.size, 0); assert.equal(selected.root.isDisposed(), true); assert.equal(f.visible.get('janggong'), false);
    await loader.updateVisibility([{ ...sample, screenCoverage: 0.01 }]); assert.equal(loader.models.size, 1);
  } finally { loader.dispose(); f.dispose(); }
});
