import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import test from 'node:test';
import { convertIfc, validateIfcRequest } from '../scripts/import-ifc.mjs';
const request = {
  publicAllowlist: [{ globalId: '0AAAAAAAAAAAAAAAAAAAAA', spaceId: 'test-campus:building:public-wall' }],
  sourceOriginMeters: [0, 0, 0], sourceId: 'synthetic-test-fixture', license: 'Project-authored test fixture',
  placement: { units: 'm', upAxis: 'Y', origin: [0, 0, 0], anchorMeters: [0, 0, 0], yawRadians: 0, altitudeDatum: 'local-site-meters', mode: 'inferred' }
};
test('IFC selection is explicit and refuses empty, duplicate or invalid IDs and undeclared origins', () => {
  assert.equal(validateIfcRequest(request), request);
  assert.throws(() => validateIfcRequest({ ...request, publicAllowlist: [] }));
  assert.throws(() => validateIfcRequest({ ...request, publicAllowlist: [...request.publicAllowlist, request.publicAllowlist[0]] }));
  assert.throws(() => validateIfcRequest({ ...request, sourceOriginMeters: null }));
  assert.throws(() => validateIfcRequest({ ...request, license: '' }));
  assert.throws(() => validateIfcRequest({ ...request, placement: { ...request.placement, origin: [1, 0, 0] } }));
});
test('IFC converter reports a missing optional tool without pretending to convert', async () => {
  await assert.rejects(convertIfc({ input: resolve('tests/fixtures/public-selection.ifc'), request, python: '' }), /Configure an absolute/);
});
test('actual raw IFC triangulation publishes only allowed geometry and strips source names and GUIDs', { skip: !process.env.CAMPUS_IFC_PYTHON ? 'Optional pinned IFC production environment is not installed in the Node runtime.' : false }, async (t) => {
  const result = await convertIfc({ input: resolve('tests/fixtures/public-selection.ifc'), request });
  assert.equal(result.report.selectedProducts, 1); assert.equal(result.report.engine, 'IfcOpenShell'); assert.equal(result.report.statistics.triangles, 12); assert.equal(result.report.statistics.vertices, 8);
  assert.deepEqual(result.report.statistics.bounds, { min: [-1, 0, -1.5], max: [1, 4, 1.5] });
  assert.deepEqual(result.report.publicSpaceIds, ['test-campus:building:public-wall']);
  const content = result.glb.toString('utf8');
  for (const value of ['PRIVATE_WALL_NAME', 'PRIVATE_DESCRIPTION', 'PRIVATE_PROFILE_NAME', 'PRIVATE_PROJECT_NAME', 'NONPUBLIC_WALL_NAME', '0AAAAAAAAAAAAAAAAAAAAA', '0CCCCCCCCCCCCCCCCCCCCC']) assert.equal(content.includes(value), false);
  assert.equal(result.privateMapping.products[0].globalId, request.publicAllowlist[0].globalId);
  assert.equal(result.report.placement.mode, 'inferred'); assert.equal(result.report.confirmationUnchanged, true);
  const second = await convertIfc({ input: resolve('tests/fixtures/public-selection.ifc'), request }); assert.deepEqual(result.glb, second.glb);
  const placedRequest = { ...request, sourceOriginMeters: [10, 20, 30], placement: { ...request.placement, anchorMeters: [110, 220, 30] } }, placed = await convertIfc({ input: resolve('tests/fixtures/public-selection.ifc'), request: placedRequest });
  const require = createRequire(import.meta.url), B = require('babylonjs'); require('babylonjs-loaders');
  const compiled = await build({ entryPoints: ['src/scene/model-loader.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
  const { browserGlbModel } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
  const buffer = placed.glb.buffer.slice(placed.glb.byteOffset, placed.glb.byteOffset + placed.glb.byteLength);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, arrayBuffer: async () => buffer }));
  for (const rh of [false, true]) {
    const engine = new B.NullEngine(), scene = new B.Scene(engine); scene.useRightHandedSystem = rh;
    try {
      const model = await browserGlbModel(B, scene, {}, { id: 'public-wall', kind: 'glb', source: 'assets/models/selected-wall.glb', status: 'estimated', placement: placedRequest.placement }, new globalThis.AbortController().signal), bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (const mesh of model.root.getChildMeshes().filter((item) => item.getTotalVertices() > 0)) {
        mesh.computeWorldMatrix(true); const matrix = mesh.getWorldMatrix(), positions = mesh.getVerticesData(B.VertexBuffer.PositionKind), normalData = mesh.getVerticesData(B.VertexBuffer.NormalKind), indices = mesh.getIndices(), normalMatrix = B.Matrix.Transpose(matrix.clone().invert());
        const points = [], normals = [];
        for (let i = 0; i < positions.length; i += 3) { const p = B.Vector3.TransformCoordinates(B.Vector3.FromArray(positions, i), matrix).scale(10), normal = B.Vector3.TransformNormal(B.Vector3.FromArray(normalData, i), normalMatrix).normalize(); points.push(p); normals.push(normal); p.asArray().forEach((value, axis) => { bounds.min[axis] = Math.min(bounds.min[axis], value); bounds.max[axis] = Math.max(bounds.max[axis], value); }); }
        const center = new B.Vector3(100, 2, -200);
        for (let i = 0; i < points.length; i++) assert.ok(B.Vector3.Dot(normals[i], points[i].subtract(center)) > 0, `${rh ? 'RH' : 'LH'} IFC outward normal`);
        for (let i = 0; i < indices.length; i += 3) { const [a,b,c] = Array.from(indices.slice(i,i+3)), cross = B.Vector3.Cross(points[b].subtract(points[a]), points[c].subtract(points[a])), outward = points[a].add(points[b]).add(points[c]).scale(1/3).subtract(center); assert.ok(B.Vector3.Dot(cross, outward) < 0, `${rh ? 'RH' : 'LH'} IFC triangle winding`); }
      }
      const expected = { min: [99, 0, -201.5], max: [101, 4, -198.5] };
      for (const key of ['min','max']) for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(bounds[key][axis] - expected[key][axis]) < 0.00001, `${rh ? 'RH' : 'LH'} IFC ${key}/${axis}`);
      model.dispose();
    } finally { scene.dispose(); engine.dispose(); }
  }
  await assert.rejects(convertIfc({ input: resolve('tests/fixtures/public-selection.ifc'), request: { ...request, publicAllowlist: [{ globalId: '0ZZZZZZZZZZZZZZZZZZZZZ', spaceId: 'test-campus:building:missing' }] } }), /conversion failed/);
});
