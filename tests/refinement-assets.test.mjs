import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { build } from 'esbuild';
import '../src/domain/refinement.js';
import { triangleGlb } from './fixtures/self-contained-glb.mjs';
import { writeTriangleGlb } from '../scripts/glb-writer.mjs';
const R = globalThis.CampusRefinement;
const ab = (buffer) => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

test('meter measurements distinguish horizontal, path, height and area with honest uncertainty', () => {
  const options = { confirmation: 'estimated', accuracyMeters: 1, version: 'v1' };
  assert.deepEqual(R.measureGeometry([[0, 0, 2], [3, 4, 14]], 'planar-distance', options), { value: 5, unit: 'm', approximate: true, uncertainty: 2, version: 'v1', points: 2 });
  assert.equal(R.measureGeometry([[0, 0, 2], [3, 4, 14]], 'path-distance').value, 13);
  assert.equal(R.measureGeometry([[0, 0, 2], [3, 4, 14]], 'height-difference').value, 12);
  const area = R.measureGeometry([[0, 0], [10, 0], [10, 5], [0, 5], [0, 0]], 'area', { confirmation: 'verified', accuracyMeters: 0.1 });
  assert.equal(area.value, 50); assert.equal(area.unit, 'm2'); assert.equal(area.approximate, false); assert.ok(area.uncertainty > 3);
  assert.equal(R.measureGeometry([[0, 0], [3, 4]], 'planar-distance').uncertainty, null);
});
test('measurement rejects crossings, zero area, wrong dimensions and non-finite coordinates', () => {
  for (const points of [[[0, 0], [2, 2], [0, 2], [2, 0], [0, 0]], [[0, 0], [1, 0], [2, 0], [0, 0]], [[0, 0], [1, 1], [2, 1]]]) assert.throws(() => R.measureGeometry(points, 'area'));
  assert.throws(() => R.measureGeometry([[0, 0], [1, 1, 1]], 'path-distance'));
  assert.throws(() => R.measureGeometry([[0, Infinity], [1, 1]], 'planar-distance'));
  assert.throws(() => R.measureGeometry([[0, 0], [1, 1]], 'height-difference'));
  assert.throws(() => R.measureGeometry([[0, 0], [1, 1]], 'planar-distance', { accuracyMeters: -1 }));
});
test('independent registration uses declared units and axes and never promotes the source confirmation', () => {
  const placement = { units: 'cm', upAxis: 'Z', origin: [100, 100, 100], anchorMeters: [10, 20, 30], yawRadians: 0, altitudeDatum: 'local-site-meters', mode: 'inferred' };
  const landmarks = [{ id: 'fit', role: 'control', model: [100, 100, 100], siteMeters: [10, 20, 30] }, ...[[200, 200, 300], [300, 200, 300], [300, 300, 300]].map((model, n) => ({ id: `check${n}`, role: 'holdout', model, siteMeters: [10 + (model[0] - 100) / 100, 20 + (model[1] - 100) / 100, 32] }))];
  const result = R.registrationReport({ placement, landmarks, toleranceMeters: { horizontal: 0.2, vertical: 0.2 } });
  assert.equal(result.passed, true); assert.equal(result.holdoutSummary.count, 3); assert.equal(result.holdoutSummary.horizontalRmsMeters, 0); assert.equal(result.confirmationUnchanged, true);
  landmarks[1].siteMeters[0] += 1;
  assert.equal(R.registrationReport({ placement, landmarks, toleranceMeters: { horizontal: 0.2, vertical: 0.2 } }).passed, false);
  assert.equal(R.registrationReport({ placement, landmarks: landmarks.slice(0, 2), toleranceMeters: { horizontal: 0.2, vertical: 0.2 } }).verification, 'insufficient-holdout');
  assert.throws(() => R.registrationReport({ placement: { ...placement, altitudeDatum: 'terrain-relative' }, landmarks, toleranceMeters: { horizontal: 0.2, vertical: 0.2 } }));
  const duplicates = Array.from({ length: 3 }, (_, index) => ({ id: `same${index}`, role: 'holdout', model: [100, 100, 100], siteMeters: [10, 20, 30] }));
  assert.equal(R.registrationReport({ placement, landmarks: duplicates, toleranceMeters: { horizontal: 0.2, vertical: 0.2 } }).passed, false);
});
test('GLB statistics report indexed triangles and material budgets without parsing remote resources', () => {
  const stats = R.inspectGlb(ab(triangleGlb()));
  assert.equal(stats.triangles, 1); assert.equal(stats.meshes, 1); assert.equal(stats.vertices, 3); assert.equal(stats.decoderRequired, false);
  assert.throws(() => R.inspectGlb(new ArrayBuffer(12)));
  const malicious = Buffer.from(triangleGlb()); malicious.writeUInt32LE(123, 8); assert.throws(() => R.inspectGlb(ab(malicious)));
});
test('reproducible triangle writer preserves finite geometry and excludes raw model names', () => {
  const group = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], color: [1, 0.5, 0, 1], spaceId: 'campus:building:one' };
  const first = writeTriangleGlb([group]), second = writeTriangleGlb([group]); assert.deepEqual(first, second);
  const stats = R.inspectGlb(ab(first)); assert.equal(stats.triangles, 1); assert.deepEqual(stats.bounds, { min: [0, 0, 0], max: [1, 1, 0] });
  assert.throws(() => writeTriangleGlb([{ ...group, indices: [0, 1, 9] }]));
});
test('all sixteen overview assets preserve original triangle counts, stable space IDs and bounds', async () => {
  const manifest = JSON.parse(await readFile('src/data/model-manifest.json', 'utf8')), report = JSON.parse(await readFile('evidence/refinement-asset-audit.json', 'utf8'));
  assert.equal(report.models.length, 16);
  for (const entry of manifest.models) {
    const overview = entry.variants.find((variant) => variant.id === 'overview'), original = report.models.find((model) => model.id === entry.id);
    const bytes = await readFile(overview.source), stats = R.inspectGlb(ab(bytes));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), overview.sha256); assert.equal(bytes.length, overview.bytes);
    assert.equal(stats.triangles, original.statistics.triangles); assert.equal(stats.vertices, original.statistics.vertices); assert.ok(original.overview.maxBoundsErrorMeters < 0.0001);
    assert.ok(stats.meshes < original.statistics.meshes); assert.equal(entry.status, 'estimated'); assert.equal(overview.placement.mode, 'inferred');
  }
});
test('actual Babylon import preserves all sixteen vertices, outward normals and triangle winding in LH and production RH scenes', async (t) => {
  const require = createRequire(import.meta.url), B = require('babylonjs'); require('babylonjs-loaders');
  const manifest = JSON.parse(await readFile('src/data/model-manifest.json', 'utf8')), report = JSON.parse(await readFile('evidence/refinement-asset-audit.json', 'utf8'));
  const compiled = await build({ entryPoints: ['src/scene/model-loader.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
  const { browserGlbModel } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
  const app = await build({ entryPoints: ['src/app.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
  const { createMaterials } = await import(`data:text/javascript;base64,${Buffer.from(app.outputFiles[0].text).toString('base64')}`);
  const context = vm.createContext({ BABYLON: B, window: {}, console });
  for (const path of ['src/data/site-plan.js', 'src/data/campus-data.js', 'src/scene/site-scene.js']) vm.runInContext(await readFile(path, 'utf8'), context);
  t.mock.method(globalThis, 'fetch', async (url) => { const bytes = await readFile(String(url).replace(/^\.\//, '')); return { ok: true, arrayBuffer: async () => ab(bytes) }; });
  const previousB = globalThis.BABYLON; globalThis.BABYLON = B;
  const signature = (values) => values.map((value) => Math.round(value * 100000) / 100000).join(',');
  const triangleKey = (vertices) => [vertices.join('|'), [...vertices.slice(1), vertices[0]].join('|'), [vertices[2], vertices[0], vertices[1]].join('|')].sort()[0];
  const collect = (root) => {
    const vertices = [], triangles = [];
    for (const mesh of root.getChildMeshes().filter((item) => item.getTotalVertices() > 0)) {
      mesh.computeWorldMatrix(true); const matrix = mesh.getWorldMatrix(), normalMatrix = B.Matrix.Transpose(matrix.clone().invert()), positions = mesh.getVerticesData(B.VertexBuffer.PositionKind), normals = mesh.getVerticesData(B.VertexBuffer.NormalKind), indices = mesh.getIndices(), offset = vertices.length;
      for (let index = 0; index < positions.length; index += 3) { const position = B.Vector3.TransformCoordinates(B.Vector3.FromArray(positions, index), matrix).scale(10), normal = B.Vector3.TransformNormal(B.Vector3.FromArray(normals, index), normalMatrix).normalize(); vertices.push({ position, normal, key: `${signature(position.asArray())}/${signature(normal.asArray())}` }); }
      for (let index = 0; index < indices.length; index += 3) triangles.push(Array.from(indices.slice(index, index + 3)).map((vertex) => vertices[offset + vertex]));
    }
    return { vertices, triangles };
  };
  try {
    for (const rh of [false, true]) {
      const engine = new B.NullEngine(), scene = new B.Scene(engine); scene.useRightHandedSystem = rh;
      const materials = createMaterials(scene), site = context.window.CampusSiteScene.create(scene, materials, context.SitePlanData, { terrain: context.window.CampusData.terrain, createCamera: false, batchRepeatedMeshes: false });
      try {
    for (const entry of manifest.models) {
      const overview = entry.variants.find((variant) => variant.id === 'overview'), data = report.models.find((item) => item.id === entry.id);
      vm.runInContext(await readFile(entry.source, 'utf8'), context);
      const original = context.window[entry.global][entry.export](scene, materials); assert.equal(site.alignModel(original, entry.legacyId), true);
      const model = await browserGlbModel(B, scene, site, { ...entry, ...overview, id: entry.id, kind: 'glb' }, new globalThis.AbortController().signal);
      const source = collect(original.root), loaded = collect(model.root), buckets = new Map();
      const bucketKey = (x, y, z) => `${x},${y},${z}`;
      for (const vertex of source.vertices) { const p = vertex.position.asArray().map((value) => Math.floor(value / 0.001)), key = bucketKey(...p); if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(vertex); }
      const match = (vertex) => {
        const p = vertex.position.asArray().map((value) => Math.floor(value / 0.001)); let best = null, residual = Infinity;
        for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) for (const candidate of buckets.get(bucketKey(p[0] + x, p[1] + y, p[2] + z)) || []) { const d = B.Vector3.Distance(vertex.position, candidate.position); if (d < residual && B.Vector3.Distance(vertex.normal, candidate.normal) < 0.00001) { best = candidate; residual = d; } }
        assert.ok(best && residual < 0.0001, `${rh ? 'RH' : 'LH'} ${entry.id} vertex/normal residual ${residual}`); return best;
      };
      assert.equal(loaded.vertices.length, source.vertices.length);
      for (const vertex of loaded.vertices) match(vertex);
      const originalTriangles = new Map(); for (const triangle of source.triangles) { const key = triangleKey(triangle.map((vertex) => vertex.key)); originalTriangles.set(key, (originalTriangles.get(key) || 0) + 1); }
      for (const triangle of loaded.triangles) { const key = triangleKey(triangle.map((vertex) => match(vertex).key)); assert.ok(originalTriangles.get(key) > 0, `${rh ? 'RH' : 'LH'} ${entry.id} changed triangle winding`); originalTriangles.set(key, originalTriangles.get(key) - 1); }
      assert.ok([...originalTriangles.values()].every((count) => count === 0));
      const actual = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const mesh of model.root.getChildMeshes().filter((item) => item.getTotalVertices() > 0)) { mesh.computeWorldMatrix(true); const bounds = mesh.getBoundingInfo().boundingBox; bounds.minimumWorld.asArray().forEach((value, axis) => { actual.min[axis] = Math.min(actual.min[axis], value); }); bounds.maximumWorld.asArray().forEach((value, axis) => { actual.max[axis] = Math.max(actual.max[axis], value); }); }
      const expected = { min: data.statistics.worldBoundsMeters.min.map((value) => value / 10), max: data.statistics.worldBoundsMeters.max.map((value) => value / 10) };
      for (const key of ['min', 'max']) for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(actual[key][axis] - expected[key][axis]) < 0.00001, `${entry.id} ${key}/${axis}: ${actual[key][axis]} != ${expected[key][axis]}`);
      const meshes = model.root.getChildMeshes(); model.dispose(); assert.ok(meshes.every((mesh) => mesh.isDisposed())); site.releaseModel(original); original.root.dispose(false, false);
    }
      } finally { site.dispose(); scene.dispose(); engine.dispose(); }
    }
  } finally { if (previousB === undefined) delete globalThis.BABYLON; else globalThis.BABYLON = previousB; }
});
test('media requires explicit local public rights and a type-matching extension', () => {
  const media = { kind: 'image', path: 'assets/media/building.jpg', sourceId: 'photo-one', license: 'CC-BY-4.0', public: true };
  assert.deepEqual(R.validateMedia(media), media);
  for (const variant of [{ ...media, path: 'https://example.com/photo.jpg' }, { ...media, path: 'assets/media/../photo.jpg' }, { ...media, license: '' }, { ...media, public: false }, { ...media, kind: 'audio' }]) assert.throws(() => R.validateMedia(variant));
});
test('release comparison is ID based, key-order independent and rejects duplicate identities', () => {
  const result = R.compareRelease({ entities: [{ id: 'a', name: 'one' }, { id: 'b', geometry: { x: 1, y: 2 } }, { id: 'gone' }] }, { entities: [{ id: 'a', name: 'new' }, { geometry: { y: 2, x: 1 }, id: 'b' }, { id: 'new' }] });
  assert.deepEqual(result, { added: ['new'], removed: ['gone'], changed: ['a'], unchanged: ['b'] });
  assert.throws(() => R.compareRelease({ entities: [{ id: 'a' }, { id: 'a' }] }, { entities: [] }));
});
test('release bundle requires complete integrity metadata and an explicit approved reviewer', () => {
  const bundle = { schemaVersion: 1, version: 'release-1', catalogVersion: 'catalog-1', modelManifestVersion: 'models-1', coordinateReference: 'local-meters', assets: [{ path: 'assets/models/one.glb', bytes: 100, sha256: 'a'.repeat(64), spaceIds: ['campus:building:one'] }], approval: { status: 'draft', reviewedBy: null, reviewedAt: null } };
  assert.deepEqual(R.validateReleaseBundle(bundle), bundle);
  assert.throws(() => R.validateReleaseBundle({ ...bundle, approval: { status: 'approved' } }));
  assert.throws(() => R.validateReleaseBundle({ ...bundle, assets: [...bundle.assets, bundle.assets[0]] }));
  assert.throws(() => R.validateReleaseBundle({ ...bundle, assets: [{ ...bundle.assets[0], path: '../var/campus.sqlite' }] }));
});
