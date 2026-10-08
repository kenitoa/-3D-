import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const B = require('babylonjs');
const compiled = await build({ entryPoints: ['src/scene/refinement-runtime.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { createRefinementRuntime, measureOutlineGeometry } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const context = vm.createContext({ BABYLON: B, window: {}, console });
for (const file of ['src/data/campus-data.js', 'src/data/site-plan.js', 'src/domain/campus-platform.js', 'src/domain/refinement.js', 'src/scene/site-scene.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), context);
globalThis.CampusRefinement = context.window.CampusRefinement;
globalThis.CampusPlatform = context.window.CampusPlatform;
const baseline = context.window.CampusPlatform.createCatalog(context.SitePlanData, context.window.CampusData);
const clone = (value) => JSON.parse(JSON.stringify(value));

function fixture() {
  const engine = new B.NullEngine({ renderWidth: 1280, renderHeight: 720, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 });
  const scene = new B.Scene(engine); scene.useRightHandedSystem = true;
  const light = new B.HemisphericLight('existing-light', new B.Vector3(0, 1, 0), scene); light.intensity = 0.5;
  const catalog = clone(baseline);
  const site = { getDiagnostics() { return { metersPerUnit: 10, verticalExaggeration: 1 }; }, terrainHeightAt() { return 0; } };
  const runtime = createRefinementRuntime(B, scene, site, () => catalog);
  return { engine, scene, light, catalog, site, runtime, dispose() { runtime.dispose(); scene.dispose(); engine.dispose(); } };
}
function verifiedFloor(f, label, up) {
  const building = f.catalog.entities.find((entity) => entity.kind === 'building');
  const source = f.catalog.sources.find((item) => item.visibility === 'public');
  const existing = f.catalog.entities.find((entity) => entity.kind === 'floor' && entity.owningBuildingId === building.id);
  const floor = clone(existing);
  floor.id = `${building.id}:review-floor-${label}`; floor.position = { east: building.position.east, north: building.position.north, up }; floor.floorLabel = label;
  for (const key of ['location', 'height']) { floor.claims[key].confidence = 'verified'; floor.claims[key].sourceIds = [source.id]; floor.claims[key].dates.reviewedAt = '2020-01-01T00:00:00Z'; }
  f.catalog.entities.push(floor); return floor;
}
function floorMeshes(f) {
  const floor1 = verifiedFloor(f, '1F', 0), floor2 = verifiedFloor(f, '2F', 3);
  const building = f.catalog.entities.find((entity) => entity.id === floor1.owningBuildingId);
  const other = f.catalog.entities.find((entity) => entity.kind === 'building' && entity.id !== building.id);
  const material = new B.StandardMaterial('shared-original', f.scene); material.diffuseColor = B.Color3.FromHexString('#d8d1c2'); material.freeze();
  const one = B.MeshBuilder.CreateBox('floor-one', {}, f.scene); one.material = material; one.position.y = 0.05; one.metadata = { entityId: floor1.id, floorId: floor1.id };
  const two = B.MeshBuilder.CreateBox('floor-two', {}, f.scene); two.material = material; two.position.y = 0.35; two.metadata = { gltf: { extras: { entityId: floor2.id, floorId: floor2.id } } };
  const shell = B.MeshBuilder.CreateBox('building-shell', {}, f.scene); shell.material = material; shell.metadata = { entityId: building.id };
  const neighbor = B.MeshBuilder.CreateBox('neighbor-building', {}, f.scene); neighbor.material = material; neighbor.metadata = { entityId: other.id };
  return { floor1, floor2, one, two, shell, neighbor, material };
}

test('outline measurement aggregates every component and hole while preserving closed rings in its 3D overlay', () => {
  const f = fixture();
  try {
    const exterior = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], hole = [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]];
    const second = [[20, 0], [25, 0], [25, 5], [20, 5], [20, 0]];
    const base = { coordinateSystem: 'local-meters', unit: 'm', originId: f.catalog.activeCampusId, confidence: 'estimated', sourceIds: [f.catalog.sources[0].id] };
    const polygon = { ...base, type: 'Polygon', coordinates: [exterior, hole] };
    const result = measureOutlineGeometry(polygon, globalThis.CampusRefinement.measureGeometry, f.catalog.contentVersion);
    assert.equal(result.value, 96); assert.equal(result.holeCount, 1); assert.equal(result.polygonCount, 1); assert.equal(result.uncertainty, null);
    const multi = { ...base, type: 'MultiPolygon', coordinates: [[exterior, hole], [second]] };
    const all = f.runtime.setOutlineMeasurement(multi); assert.equal(all.value, 121); assert.equal(all.polygonCount, 2); assert.equal(all.holeCount, 1); assert.equal(all.displayedPointCount, 15);
    assert.deepEqual(all.worldRings.map((ring) => [ring.polygonIndex, ring.role]), [[0, 'outer'], [0, 'hole'], [1, 'outer']]);
    assert.deepEqual(all.worldRings[2].points[0], [2, 0.1, -0]);
    const overlays = f.scene.meshes.filter((mesh) => mesh.metadata?.refinementOverlay === 'measurement'); assert.equal(overlays.length, 2);
    assert.ok(overlays.every((mesh) => mesh.isPickable === false)); assert.deepEqual(overlays.map((mesh) => mesh.metadata.ringRole), ['outer', 'hole']);
    all.worldRings[0].points[0][0] = 900; assert.equal(f.runtime.getDiagnostics().measurement.worldRings[0].points[0][0], 0);
    assert.throws(() => f.runtime.setOutlineMeasurement({ ...polygon, coordinates: [exterior, hole.map(([east, north]) => [east + 30, north])] }));
    assert.throws(() => f.runtime.setOutlineMeasurement({ ...polygon, coordinateSystem: 'WGS84', unit: 'degree' }));
    assert.equal(f.runtime.getDiagnostics().measurement.value, 121);
    f.runtime.clearMeasurement(); assert.equal(f.runtime.getDiagnostics().overlayMeshCount, 0);
  } finally { f.dispose(); }
});

test('lighting modes are reversible presentation presets without changing model materials or claiming solar analysis', () => {
  const f = fixture();
  try {
    const color = f.scene.clearColor.asArray(), intensity = f.light.intensity;
    assert.equal(f.runtime.setLighting('evening').realSolarAnalysis, false); assert.notEqual(f.light.intensity, intensity);
    assert.equal(f.runtime.setLighting('observe').simulated, true);
    f.runtime.setLighting('guide'); assert.equal(f.light.intensity, intensity); assert.deepEqual(f.scene.clearColor.asArray(), color);
    assert.throws(() => f.runtime.setLighting('actual-solar'));
    f.runtime.setLighting('evening'); f.runtime.dispose(); assert.equal(f.light.intensity, intensity);
    assert.throws(() => f.runtime.setLighting('guide'));
  } finally { f.dispose(); }
});

test('themes use bounded non-pickable point markers with no invented construction footprint or private descendant', () => {
  const f = fixture();
  try {
    const building = f.catalog.entities.find((entity) => entity.kind === 'building');
    const privateBuilding = clone(building); privateBuilding.id = 'private-building'; privateBuilding.visibility = 'restricted'; f.catalog.entities.push(privateBuilding);
    const child = clone(building); child.id = 'private-child'; child.parentId = privateBuilding.id; f.catalog.entities.push(child);
    const confidence = f.runtime.setTheme('source-confidence');
    assert.ok(confidence.items.length > 0); assert.ok(confidence.items.every((item) => item.scope === 'point-only'));
    assert.ok(confidence.items.every((item) => !['private-building', 'private-child'].includes(item.entityId)));
    assert.ok(f.scene.meshes.every((mesh) => !mesh.isPickable && mesh.metadata.representsActualArea === false));
    confidence.items[0].pointMeters[0] = 99999;
    assert.notEqual(f.runtime.getDiagnostics().theme.items[0].pointMeters[0], 99999);
    const count = f.scene.meshes.length;
    for (let index = 0; index < 10; index++) f.runtime.setTheme('source-confidence');
    assert.equal(f.scene.meshes.length, count);
    f.runtime.setTheme('default'); assert.equal(f.scene.meshes.length, 0);
  } finally { f.dispose(); }
});

test('operation themes show expiration and unverified empty states instead of implying normal operation', () => {
  const f = fixture();
  try {
    const building = f.catalog.entities.find((entity) => entity.kind === 'building'); const source = f.catalog.sources.find((item) => item.visibility === 'public');
    f.catalog.operations.push({ id: 'closure', entityId: building.id, state: 'closed', label: '검수된 출입 제한', sourceIds: [source.id], visibility: 'public', verification: 'verified', observedAt: '2020-01-01T00:00:00Z', validFrom: '2020-01-01T00:00:00Z', validUntil: '2020-02-01T00:00:00Z' });
    const active = f.runtime.setTheme('operations', '2020-01-15T00:00:00Z'); assert.equal(active.items[0].pattern, 'cross');
    const expired = f.runtime.setTheme('operations', '2020-03-01T00:00:00Z'); assert.match(expired.items[0].label, /유효기간/); assert.equal(expired.items[0].pattern, 'dot');
    assert.equal(f.runtime.setTheme('access', '2020-03-01T00:00:00Z').items.length, 0);
    assert.throws(() => f.runtime.setTheme('operations', 'not-a-date'));
  } finally { f.dispose(); }
});

test('registered construction events produce only sourced point annotations and preserve expiry', () => {
  const f = fixture();
  try {
    const building = f.catalog.entities.find((entity) => entity.kind === 'building'); const source = f.catalog.sources.find((item) => item.visibility === 'public');
    f.catalog.events.push({ id: 'construction', title: '확인된 공사 기록', entityId: building.id, sourceIds: [source.id], visibility: 'public', validFrom: '2020-01-01T00:00:00Z', validUntil: '2020-02-01T00:00:00Z', status: 'current', description: '실제 영역 도형 미확보' });
    const report = f.runtime.setTheme('construction', '2020-03-01T00:00:00Z'); assert.equal(report.items.length, 1); assert.match(report.items[0].label, /기간 만료/); assert.equal(report.items[0].scope, 'point-only');
    assert.ok(f.scene.meshes.every((mesh) => mesh.metadata.representsActualArea === false));
  } finally { f.dispose(); }
});

test('floor cut requires reviewed public heights and semantic geometry; a concept interior remains unavailable', () => {
  const f = fixture();
  try {
    const concept = f.catalog.entities.find((entity) => entity.kind === 'floor');
    assert.equal(f.runtime.setFloorView(concept.id, 'cut').applied, false);
    const reviewed = verifiedFloor(f, '1F', 0);
    assert.equal(f.runtime.setFloorView(reviewed.id, 'cut').applied, false);
  } finally { f.dispose(); }
});

test('cut uses individual material clones and restores shared frozen materials without affecting another building', () => {
  const f = fixture();
  try {
    const m = floorMeshes(f); const vertices = Array.from(m.one.getVerticesData(B.VertexBuffer.PositionKind)); const originalClip = m.material.clipPlane; const originalSceneClip = f.scene.clipPlane;
    assert.equal(f.runtime.setFloorView(m.floor2.id, 'cut').applied, true);
    assert.notEqual(m.one.material, m.material); assert.notEqual(m.two.material, m.material); assert.equal(m.neighbor.material, m.material);
    assert.equal(m.material.clipPlane, originalClip); assert.equal(m.material.isFrozen, true); assert.equal(f.scene.clipPlane, originalSceneClip);
    assert.equal(m.one.material.clipPlane.d, -0.3);
    for (let index = 0; index < 8; index++) f.runtime.setFloorView(m.floor2.id, 'cut');
    assert.equal(f.runtime.getDiagnostics().clonedMaterialCount, 3);
    f.runtime.setFloorView('', 'exterior'); assert.equal(m.one.material, m.material); assert.equal(m.two.material, m.material);
    assert.equal(f.runtime.getDiagnostics().clonedMaterialCount, 0); assert.equal(f.scene.materials.length, 1);
    assert.deepEqual(Array.from(m.one.getVerticesData(B.VertexBuffer.PositionKind)), vertices);
  } finally { f.dispose(); }
});

test('isolation and separated floors act on mapped public meshes and restore their original transforms', () => {
  const f = fixture();
  try {
    const m = floorMeshes(f); const original = m.two.position.asArray();
    assert.equal(f.runtime.setFloorView(m.floor1.id, 'isolate').applied, true);
    assert.equal(m.one.isVisible, true); assert.equal(m.two.isVisible, false); assert.equal(m.shell.isVisible, false); assert.equal(m.neighbor.isVisible, true);
    assert.equal(f.runtime.setFloorView(m.floor2.id, 'explode').applied, true); assert.ok(m.two.position.y > original[1]);
    f.runtime.setFloorView('', 'exterior'); assert.deepEqual(m.two.position.asArray(), original); assert.equal(m.two.isVisible, true); assert.equal(m.shell.isVisible, true);
    const privateMesh = B.MeshBuilder.CreateBox('private-semantic', {}, f.scene); privateMesh.material = m.material; privateMesh.metadata = { entityId: 'unknown-private-space', floorId: m.floor1.id };
    f.runtime.setFloorView(m.floor2.id, 'cut'); assert.equal(privateMesh.material, m.material);
  } finally { f.dispose(); }
});

test('meter measurements keep entered geometry and uncertainty separate from the displayed scene', () => {
  const f = fixture();
  try {
    const distance = f.runtime.setMeasurement('planar-distance', [[0, 0], [3, 4]]);
    assert.equal(distance.value, 5); assert.equal(distance.approximate, true); assert.equal(distance.uncertainty, null);
    assert.deepEqual(distance.worldPoints[1], [0.3, 0.1, -0.4]);
    const height = f.runtime.setMeasurement('height-difference', [[0, 0, 10], [0, 0, 13]]); assert.equal(height.value, 3); assert.equal(height.worldPoints[0][1], 1);
    assert.equal(f.scene.meshes.length, 2); assert.ok(f.scene.meshes.every((mesh) => !mesh.isPickable && !mesh.metadata.measured));
    assert.throws(() => f.runtime.setMeasurement('height-difference', [[0, 0], [0, 0]]));
    for (let index = 0; index < 12; index++) f.runtime.setMeasurement('planar-distance', [[0, 0], [3, 4]]);
    assert.equal(f.scene.meshes.length, 2); f.runtime.clearMeasurement(); assert.equal(f.scene.meshes.length, 0);
  } finally { f.dispose(); }
});
