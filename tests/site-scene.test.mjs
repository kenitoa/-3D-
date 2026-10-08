import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BABYLON = require('babylonjs');
const context = vm.createContext({ BABYLON, window: {}, console });
vm.runInContext(fs.readFileSync('src/scene/site-scene.js', 'utf8'), context);
const { create, geometry } = context.window.CampusSiteScene;

function plan() {
  return {
    boundaries: { campusMapped: { id: 'site', geometryType: 'polygon', pointsMeters: [[-120, -60], [140, -60], [140, 90], [-120, 90]], status: 'mapped' }, legal: null },
    features: {
      buildings: [{ id: 'one', legacyKey: 'janggong', geometryType: 'polygon', anchorMeters: [10, 30], pointsMeters: [[-20, 20], [40, 20], [40, 40], [-20, 40]], angleRadians: 0, status: 'mapped' }],
      paths: [{ id: 'short-link', geometryType: 'line', kind: 'steps', pointsMeters: [[55, 35], [55, 37]], tags: { highway: 'steps' }, status: 'mapped' }],
      roads: [], parking: [], sports: [], greenery: [{ id: 'tree', geometryType: 'point', pointsMeters: [[-90, 40]], status: 'mapped' }], water: [], entrances: [], context: []
    }, anchors: [{ id: 'janggong', meters: [10, 30] }]
  };
}

function fixture(extra = {}, size = [1280, 720]) {
  const engine = new BABYLON.NullEngine({ renderWidth: size[0], renderHeight: size[1], textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 });
  const scene = new BABYLON.Scene(engine);
  const site = create(scene, {}, plan(), extra);
  return { engine, scene, site, dispose() { site.dispose(); scene.dispose(); engine.dispose(); } };
}

test('concave campus triangulation covers the polygon without spanning its notch', () => {
  const polygon = [[0, 0], [10, 0], [10, 10], [6, 10], [6, 4], [4, 4], [4, 10], [0, 10]];
  const indices = geometry.triangulate(polygon);
  let area = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const triangle = indices.slice(index, index + 3).map((point) => polygon[point]);
    area += Math.abs(geometry.signedArea(triangle));
    const center = triangle.reduce((sum, point) => [sum[0] + point[0] / 3, sum[1] + point[1] / 3], [0, 0]);
    assert.equal(geometry.contains(center, polygon), true);
  }
  assert.equal(area, 88);
  assert.equal(geometry.contains([5, 8], polygon), false);
  assert.equal(geometry.contains([0, 5], polygon), true);
});

test('surrounding terrain has a real campus hole and cannot interleave triangular patches with its ground', () => {
  const hole = [[0, 0], [10, 0], [10, 10], [6, 10], [6, 4], [4, 4], [4, 10], [0, 10]];
  const exterior = [[-5, -5], [15, -5], [15, 15], [-5, 15]];
  const ring = geometry.polygonWithHole(exterior, hole);
  const indices = geometry.triangulate(ring);
  let area = 0;
  for (let index = 0; index < indices.length; index += 3) {
    const triangle = indices.slice(index, index + 3).map((point) => ring[point]);
    area += Math.abs(geometry.signedArea(triangle));
    const center = triangle.reduce((sum, point) => [sum[0] + point[0] / 3, sum[1] + point[1] / 3], [0, 0]);
    assert.equal(geometry.contains(center, hole), false);
  }
  assert.equal(area, 400 - 88);
  const app = fixture({ createCamera: false });
  try {
    const mesh = app.site.layers.context[0];
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    const indices = mesh.getIndices();
    const boundary = plan().boundaries.campusMapped.pointsMeters.map(app.site.worldPoint);
    for (let index = 0; index < indices.length; index += 3) {
      const center = indices.slice(index, index + 3).reduce((sum, vertex) => [sum[0] + positions[vertex * 3] / 3, sum[1] + positions[vertex * 3 + 2] / 3], [0, 0]);
      assert.equal(geometry.contains(center, boundary), false);
    }
  } finally { app.dispose(); }
});

test('campus terrain is opaque, true meter scale, and keeps a two-meter stair link', () => {
  const app = fixture({ createCamera: false });
  try {
    assert.deepEqual(Array.from(app.site.worldPoint([20, 30])), [2, -3]);
    assert.equal(app.site.layers.terrain[0].material.alpha, 1);
    assert.equal(app.site.layers.context[0].material.alpha, 1);
    for (const mesh of [...app.site.layers.terrain, ...app.site.layers.context, ...app.site.layers.boundary, ...app.site.layers.paths]) {
      const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
      assert.ok(normals.length > 0);
      for (let index = 1; index < normals.length; index += 3) assert.ok(normals[index] > 0, `${mesh.name} faces below the terrain`);
    }
    assert.ok(app.site.layers.paths.some((mesh) => mesh.name === 'site-paths-short-link'));
    assert.ok(app.site.layers.paths.some((mesh) => mesh.name.startsWith('site-step-short-link')));
    assert.equal(app.site.getDiagnostics().boundaryAreaMeters2, 39000);
    assert.equal(app.site.getDiagnostics().legalBoundaryAvailable, false);
    assert.ok(app.site.layers.boundary.every((mesh) => mesh.metadata.legalBoundary === false));
  } finally { app.dispose(); }
});

test('all draped boundary and road vertices stay above the terrain after exaggeration', () => {
  const terrain = { xs: [-30, 30], zs: [-30, 30], elevations: [[24, 34], [44, 54]], baseElevationMeters: 14 };
  const app = fixture({ terrain, createCamera: false });
  try {
    const baseline = app.site.terrainHeightAt(-10, 0);
    app.site.setVerticalExaggeration(2);
    assert.equal(app.site.terrainHeightAt(-10, 0), baseline * 2);
    for (const mesh of [...app.site.layers.boundary, ...app.site.layers.paths]) {
      const vertices = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      for (let index = 0; index < vertices.length; index += 3) {
        assert.ok(vertices[index + 1] >= app.site.terrainHeightAt(vertices[index], vertices[index + 2]) - 1e-5);
      }
    }
  } finally { app.dispose(); }
});

test('existing detail meshes align by their compound center and remain stable on repeated alignment', () => {
  const app = fixture({ createCamera: false });
  try {
    const materials = Object.fromEntries(['wall', 'sideWall', 'roof', 'trim', 'glass', 'column', 'stone', 'relief', 'bronze', 'window', 'plaza', 'parking', 'parkingLine'].map((key) => [key, new BABYLON.StandardMaterial(key, app.scene)]));
    vm.runInContext(fs.readFileSync('src/models/janggong.js', 'utf8'), context);
    const model = context.window.JanggongModel.createJanggongModel(app.scene, materials);
    const originalVertexCount = model.main.getTotalVertices();
    assert.equal(app.site.alignModel(model, 'janggong'), true);
    model.main.computeWorldMatrix(true);
    const center = model.root.metadata.alignmentCenter.world;
    assert.ok(Math.abs(center[0] - 1) < 1e-5);
    assert.ok(Math.abs(center[2] + 3) < 1e-5);
    assert.equal(model.main.getTotalVertices(), originalVertexCount);
    const before = model.root.position.asArray();
    const count = app.site.meshes.length;
    app.site.alignModel(model, 'one');
    assert.deepEqual(model.root.position.asArray(), before);
    assert.equal(app.site.meshes.length, count);
    const plaza = app.scene.getMeshByName('janggong-front-plaza');
    assert.equal(plaza.parent, null);
    for (let index = 0, vertices = plaza.getVerticesData(BABYLON.VertexBuffer.PositionKind); index < vertices.length; index += 3) {
      assert.ok(vertices[index + 1] >= app.site.terrainHeightAt(vertices[index], vertices[index + 2]));
    }
  } finally { app.dispose(); }
});

test('top view has a dynamic physical scale, camera snapshots restore, and free camera clears the ground', () => {
  const app = fixture();
  try {
    const controller = app.site.cameraController;
    controller.setView('top');
    assert.equal(controller.orbit._panningMouseButton, 0);
    app.scene.render();
    const before = controller.getScaleBar();
    assert.equal(before.visible, true);
    controller.zoom(1);
    const after = controller.getScaleBar();
    assert.ok(after.metersPerPixel < before.metersPerPixel);
    const saved = controller.capture();
    controller.rotate(1);
    controller.restore(saved);
    assert.equal(controller.capture().alpha, saved.alpha);
    controller.focusBuilding('one');
    const focused = controller.capture();
    controller.fit();
    assert.equal(controller.capture().beta, 0.6);
    controller.restore(focused);
    assert.deepEqual(controller.capture(), focused);
    controller.setView('free');
    controller.free.position.y = -100;
    app.scene.render();
    assert.ok(controller.free.position.y >= app.site.terrainHeightAt(controller.free.position.x, controller.free.position.z) + 0.17);
    assert.equal(controller.getScaleBar().visible, false);
    controller.setView('overview');
    assert.equal(controller.orbit._panningMouseButton, 2);
  } finally { app.dispose(); }
});

test('every mapped boundary point fits both desktop and portrait viewport presets', () => {
  for (const size of [[1440, 900], [390, 844]]) {
    const app = fixture({}, size);
    try {
      for (const view of ['overview', 'top']) {
        app.site.cameraController.setView(view);
        app.site.cameraController.fit();
        app.scene.render();
        const viewport = app.scene.activeCamera.viewport.toGlobal(...size);
        for (const point of plan().boundaries.campusMapped.pointsMeters) {
          const [x, z] = app.site.worldPoint(point);
          const screen = BABYLON.Vector3.Project(new BABYLON.Vector3(x, app.site.terrainHeightAt(x, z), z), BABYLON.Matrix.Identity(), app.scene.getTransformMatrix(), viewport);
          assert.ok(screen.x >= size[0] * 0.05 && screen.x <= size[0] * 0.95, `${view}: x ${screen.x} does not fit ${size[0]}`);
          assert.ok(screen.y >= size[1] * 0.05 && screen.y <= size[1] * 0.95, `${view}: y ${screen.y} does not fit ${size[1]}`);
        }
      }
    } finally { app.dispose(); }
  }
});

test('overhead geography places east on the right, north upward, and the compass follows camera rotation', () => {
  const app = fixture();
  try {
    const camera = app.site.cameraController;
    camera.setView('top');
    app.scene.render();
    const viewport = app.scene.activeCamera.viewport.toGlobal(1280, 720);
    const project = (point) => BABYLON.Vector3.Project(point, BABYLON.Matrix.Identity(), app.scene.getTransformMatrix(), viewport);
    const origin = project(new BABYLON.Vector3(0, 0, 0));
    const east = project(new BABYLON.Vector3(1, 0, 0));
    const north = project(new BABYLON.Vector3(0, 0, -1));
    assert.ok(east.x > origin.x);
    assert.ok(north.y < origin.y);
    assert.ok(Math.abs(camera.getNorthRotation()) < 0.001);
    camera.rotate(1); app.scene.render();
    const rotatedOrigin = project(new BABYLON.Vector3(0, 0, 0));
    const rotatedNorth = project(new BABYLON.Vector3(0, 0, -1));
    const bearing = Math.atan2(rotatedNorth.x - rotatedOrigin.x, rotatedOrigin.y - rotatedNorth.y);
    assert.ok(Math.abs(bearing - camera.getNorthRotation()) < 0.001);
  } finally { app.dispose(); }
});

test('tree and contour controls affect their own layers without hiding the campus surface', () => {
  const app = fixture({ createCamera: false, terrain: { xs: [-30, 30], zs: [-30, 30], elevations: [[14, 54], [14, 54]], baseElevationMeters: 14 } });
  try {
    assert.ok(app.site.layers.trees.length > 0);
    assert.ok(app.site.layers.contours.length > 0);
    app.site.setLayerVisible('trees', false);
    assert.ok(app.site.layers.trees.every((mesh) => !mesh.isEnabled()));
    assert.ok(app.site.layers.terrain.every((mesh) => mesh.isEnabled()));
    app.site.setLayerVisible('contours', true);
    assert.ok(app.site.layers.contours.every((mesh) => mesh.isEnabled()));
  } finally { app.dispose(); }
});

test('checked-in campus evidence renders and all sixteen preserved models accept their official or estimated anchors', () => {
  const engine = new BABYLON.NullEngine({ renderWidth: 1440, renderHeight: 900, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 });
  const scene = new BABYLON.Scene(engine);
  vm.runInContext(fs.readFileSync('src/data/campus-data.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('src/data/site-plan.js', 'utf8'), context);
  const keys = ['janggong', 'pilheon', 'manwoo', 'shalom', 'immanuel', 'gyeongsam', 'songam', 'sotong', 'practice', 'hanul', 'seongbin', 'saerom', 'haeoreum', 'joonha', 'neutbom', 'childcare'];
  const materialCache = new Map();
  const materials = new Proxy({}, { get(_target, key) { if (!materialCache.has(key)) materialCache.set(key, new BABYLON.StandardMaterial(String(key), scene)); return materialCache.get(key); } });
  const site = create(scene, materials, context.SitePlanData, { terrain: context.window.CampusData.terrain });
  try {
    for (const key of keys) {
      vm.runInContext(fs.readFileSync(`src/models/${key}.js`, 'utf8'), context);
      const name = `${key[0].toUpperCase()}${key.slice(1)}`;
      const model = context.window[`${name}Model`][`create${name}Model`](scene, materials);
      assert.equal(site.alignModel(model, key), true, key);
      const source = context.SitePlanData.features.buildings.find((building) => building.id === key);
      const mesh = model.main || model.hall || model.newDorm || model.mediaHall;
      mesh.computeWorldMatrix(true);
      const expected = site.worldPoint(source.anchorMeters);
      const center = model.root.metadata.alignmentCenter.world;
      assert.ok(Math.abs(center[0] - expected[0]) < 1e-4 && Math.abs(center[2] - expected[1]) < 1e-4, key);
      assert.ok(model.root.position.asArray().every(Number.isFinite));
    }
    scene.render();
    assert.deepEqual(Array.from(site.getDiagnostics().errors), []);
    assert.ok(site.featureMarkers.some(({ feature }) => feature.id === 'main-stadium'));
    assert.ok(site.featureMarkers.some(({ feature }) => feature.id.startsWith('parking')));
    assert.ok(site.layers.trees.length > 0);
    assert.equal(site.getDiagnostics().legalBoundaryAvailable, false);
  } finally { site.dispose(); scene.dispose(); engine.dispose(); }
});

test('batching preserves facade geometry and picking while primary meshes, accessory draping and repeated alignment stay intact', () => {
  const terrain = { xs: [-30, 30], zs: [-30, 30], elevations: [[14, 54], [14, 54]], baseElevationMeters: 14 };
  const plain = fixture({ createCamera: false, terrain, batchRepeatedMeshes: false });
  const batched = fixture({ createCamera: false, terrain });
  const createModel = (scene) => {
    const materials = Object.fromEntries(['wall', 'sideWall', 'roof', 'trim', 'glass', 'column', 'stone', 'relief', 'bronze', 'window', 'plaza', 'parking', 'parkingLine'].map((key) => [key, new BABYLON.StandardMaterial(key, scene)]));
    vm.runInContext(fs.readFileSync('src/models/janggong.js', 'utf8'), context);
    return context.window.JanggongModel.createJanggongModel(scene, materials);
  };
  const dimensions = (meshes) => {
    const vertices = [];
    for (const mesh of meshes) {
      mesh.computeWorldMatrix(true);
      const source = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      for (let index = 0; index < source.length; index += 3) vertices.push(BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.FromArray(source, index), mesh.getWorldMatrix()));
    }
    return [Math.min(...vertices.map((point) => point.x)), Math.max(...vertices.map((point) => point.x)), Math.min(...vertices.map((point) => point.y)), Math.max(...vertices.map((point) => point.y)), Math.min(...vertices.map((point) => point.z)), Math.max(...vertices.map((point) => point.z))];
  };
  try {
    const original = createModel(plain.scene);
    const model = createModel(batched.scene);
    original.root.scaling.set(1.3, 1, 0.7); model.root.scaling.set(1.3, 1, 0.7);
    const primaryCount = model.main.getTotalVertices();
    plain.site.alignModel(original, 'janggong'); batched.site.alignModel(model, 'janggong');
    const unmerged = original.root.getChildMeshes().filter((mesh) => /(window|floor-line|trim)/.test(mesh.name));
    const merged = model.root.getChildMeshes().filter((mesh) => mesh.metadata?.kind === 'batched-detail');
    assert.ok(merged.length > 0 && merged.length < unmerged.length);
    const oldBounds = dimensions(unmerged); const newBounds = dimensions(merged);
    oldBounds.forEach((value, index) => assert.ok(Math.abs(value - newBounds[index]) < 1e-4, `${index}: ${value} versus ${newBounds[index]}`));
    assert.equal(model.main.getTotalVertices(), primaryCount);
    assert.equal(merged.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0), unmerged.reduce((sum, mesh) => sum + mesh.getTotalVertices(), 0));
    assert.ok(merged.every((mesh) => mesh.parent === model.root && mesh.isPickable && mesh.metadata.originalMeshCount > 1));
    const window = original.root.getChildMeshes().find((mesh) => mesh.name.startsWith('janggong-window'));
    window.computeWorldMatrix(true);
    const center = window.getBoundingInfo().boundingBox.centerWorld;
    const ray = new BABYLON.Ray(center.add(new BABYLON.Vector3(0, 0, -10)), new BABYLON.Vector3(0, 0, 1), 20);
    assert.ok(batched.scene.pickWithRay(ray, (mesh) => mesh.metadata?.kind === 'batched-detail').hit);
    const before = batched.scene.meshes.length;
    batched.site.alignModel(model, 'janggong'); batched.site.setVerticalExaggeration(2);
    assert.equal(batched.scene.meshes.length, before);
    assert.equal(model.main.getTotalVertices(), primaryCount);
    assert.equal(batched.scene.getMeshByName('janggong-front-plaza').parent, null);
    assert.ok(batched.site.getDiagnostics().batching.removedMeshes > 20);
  } finally { plain.dispose(); batched.dispose(); }
});

test('every repeated detail vertex survives compound alignment in all sixteen real models', () => {
  vm.runInContext(fs.readFileSync('src/data/campus-data.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('src/data/site-plan.js', 'utf8'), context);
  const makeScene = (batchRepeatedMeshes) => {
    const engine = new BABYLON.NullEngine({ renderWidth: 1280, renderHeight: 720, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 });
    const scene = new BABYLON.Scene(engine);
    const materialCache = new Map();
    const materials = new Proxy({}, { get(_target, key) { if (!materialCache.has(key)) materialCache.set(key, new BABYLON.StandardMaterial(String(key), scene)); return materialCache.get(key); } });
    const site = create(scene, materials, context.SitePlanData, { terrain: context.window.CampusData.terrain, createCamera: false, batchRepeatedMeshes });
    return { scene, materials, site, dispose() { site.dispose(); scene.dispose(); engine.dispose(); } };
  };
  const original = makeScene(false); const batched = makeScene(true);
  const worldVertices = (mesh) => {
    mesh.computeWorldMatrix(true);
    const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    return Array.from({ length: positions.length / 3 }, (_, index) => BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.FromArray(positions, index * 3), mesh.getWorldMatrix()));
  };
  try {
    let verifiedVertices = 0;
    for (const feature of context.SitePlanData.features.buildings) {
      const key = feature.legacyKey;
      vm.runInContext(fs.readFileSync(`src/models/${key}.js`, 'utf8'), context);
      const name = `${key[0].toUpperCase()}${key.slice(1)}`;
      const factory = context.window[`${name}Model`][`create${name}Model`];
      const first = factory(original.scene, original.materials); const second = factory(batched.scene, batched.materials);
      original.site.alignModel(first, key); batched.site.alignModel(second, key);
      const primary = second.main || second.hall || second.newDorm || second.mediaHall;
      const initial = second.root.metadata.alignmentCenter;
      assert.equal(initial.kind, 'estimated-compound-mass-envelope');
      assert.ok(initial.meshNames.length >= 2, key);
      assert.equal(initial.meshNames.some((meshName) => /window|plaza|parking|yard|walkway/.test(meshName)), false, key);
      if (key === 'seongbin') {
        assert.ok(initial.meshNames.includes('seongbin-old-dormitory-center-building'));
        assert.ok(initial.meshNames.includes('seongbin-old-dormitory-right-building'));
        assert.ok(initial.dimensions[0] > 8);
        assert.ok(second.root.scaling.x < 1.5, `compound x scale ${second.root.scaling.x}`);
      }
      const primaryVertices = primary.getTotalVertices();
      for (const mesh of second.root.getChildMeshes().filter((candidate) => candidate.metadata?.kind === 'batched-detail')) {
        const expected = mesh.metadata.originalMeshNames.flatMap((meshName) => worldVertices(original.scene.getMeshByName(meshName)));
        const actual = worldVertices(mesh);
        assert.equal(actual.length, expected.length, key);
        actual.forEach((point, index) => assert.ok(BABYLON.Vector3.Distance(point, expected[index]) < 0.0001, `${key} ${mesh.name} vertex ${index}: ${point.asArray()} versus ${expected[index].asArray()}`));
        verifiedVertices += actual.length;
      }
      batched.site.alignModel(second, key);
      assert.equal(primary.getTotalVertices(), primaryVertices);
    }
    assert.ok(verifiedVertices > 10000);
  } finally { original.dispose(); batched.dispose(); }
});

test('an estimated envelope fits the entire compound with one scale and preserves original proportions', () => {
  const app = fixture({ createCamera: false });
  try {
    const root = new BABYLON.TransformNode('compound', app.scene);
    const main = BABYLON.MeshBuilder.CreateBox('compound-main-body', { width: 3, height: 2, depth: 2 }, app.scene);
    const wing = BABYLON.MeshBuilder.CreateBox('compound-old-wing', { width: 3, height: 2, depth: 2 }, app.scene);
    main.parent = root; wing.parent = root; main.position.y = 1; wing.position.set(4, 1, 0);
    const count = main.getTotalVertices();
    app.site.alignModel({ root, main }, 'one');
    assert.equal(root.metadata.alignmentCenter.dimensions[0], 7);
    assert.equal(root.scaling.x, root.scaling.z);
    assert.equal(root.scaling.x, root.scaling.y);
    assert.ok(Math.abs(root.scaling.x - 6 / 7) < 0.000001);
    assert.equal(root.metadata.alignmentScale.status, 'estimated');
    assert.equal(root.metadata.alignmentScale.preservesOriginalProportions, true);
    assert.equal(main.getTotalVertices(), count);
    app.site.alignModel({ root, main }, 'one');
    assert.equal(root.scaling.x, root.scaling.z);
  } finally { app.dispose(); }
});

test('duplicated terrain vertices share smooth finite normals before and after elevation emphasis', () => {
  const app = fixture({ createCamera: false, terrain: { xs: [-30, 30], zs: [-30, 30], elevations: [[14, 35], [45, 85]], baseElevationMeters: 14 } });
  try {
    for (const exaggeration of [1, 2]) {
      if (exaggeration !== 1) app.site.setVerticalExaggeration(exaggeration);
      const mesh = app.site.layers.context[0];
      const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind);
      const normals = mesh.getVerticesData(BABYLON.VertexBuffer.NormalKind);
      const seen = new Map();
      let duplicates = 0;
      for (let index = 0; index < positions.length; index += 3) {
        const key = `${positions[index].toFixed(4)},${positions[index + 2].toFixed(4)}`;
        const normal = normals.slice(index, index + 3);
        assert.ok(normal.every(Number.isFinite));
        assert.ok(normal[1] > 0);
        assert.ok(Math.abs(Math.hypot(...normal) - 1) < 1e-5);
        if (seen.has(key)) {
          duplicates += 1;
          seen.get(key).forEach((value, axis) => assert.ok(Math.abs(value - normal[axis]) < 1e-5));
        } else seen.set(key, normal);
      }
      assert.ok(duplicates > 100);
    }
  } finally { app.dispose(); }
});

test('detached campus parcels and internal holes render without filling the gap or excluded island', () => {
  const first = { outer: [[-100, -50], [0, -50], [0, 50], [-100, 50]], holes: [[[-80, -10], [-60, -10], [-60, 10], [-80, 10]]] };
  const second = { outer: [[80, -30], [120, -30], [120, 30], [80, 30]], holes: [] };
  const data = { boundaries: { campusMapped: { id: 'detached', pointsMeters: first.outer, polygonsMeters: [first, second] }, legal: null }, features: {} };
  const engine = new BABYLON.NullEngine({ renderWidth: 390, renderHeight: 844, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 });
  const scene = new BABYLON.Scene(engine); const site = create(scene, {}, data);
  try {
    assert.equal(site.getDiagnostics().campusPartCount, 2);
    assert.equal(site.getDiagnostics().boundaryAreaMeters2, 12000);
    const parts = [first, second].map((part) => ({ outer: part.outer.map(site.worldPoint), holes: part.holes.map((ring) => ring.map(site.worldPoint)) }));
    const inside = (point) => parts.some((part) => geometry.contains(point, part.outer) && !part.holes.some((hole) => geometry.contains(point, hole)));
    for (const [layer, expected] of [['terrain', true], ['context', false]]) for (const mesh of site.layers[layer]) {
      const vertices = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind); const indices = mesh.getIndices();
      for (let index = 0; index < indices.length; index += 3) {
        const center = [0, 0];
        for (const vertex of indices.slice(index, index + 3)) { center[0] += vertices[vertex * 3] / 3; center[1] += vertices[vertex * 3 + 2] / 3; }
        assert.equal(inside(center), expected, `${layer}: ${center}`);
      }
    }
    site.cameraController.setView('top'); scene.render();
    for (const point of [...first.outer, ...second.outer]) {
      const [x, z] = site.worldPoint(point); const screen = BABYLON.Vector3.Project(new BABYLON.Vector3(x, 0, z), BABYLON.Matrix.Identity(), scene.getTransformMatrix(), scene.activeCamera.viewport.toGlobal(390, 844));
      assert.ok(screen.x > 10 && screen.x < 380 && screen.y > 10 && screen.y < 834);
    }
  } finally { site.dispose(); scene.dispose(); engine.dispose(); }
});

test('base buildings are pickable, explicit details preserve shape and all visibility modes respect layer and lifecycle filters', () => {
  const app = fixture({ createCamera: false, terrain: { xs: [-30, 30], zs: [-30, 30], elevations: [[14, 35], [45, 85]], baseElevationMeters: 14 } });
  try {
    const proxy = app.site.getBuildingProxy('one'); assert.ok(proxy); assert.equal(proxy.main.isPickable, true);
    const root = new BABYLON.TransformNode('explicit-root', app.scene);
    const main = BABYLON.MeshBuilder.CreateBox('measured-body', { width: 1, height: 3, depth: 2 }, app.scene); main.parent = root;
    root.position.set(1, 2, -3); root.metadata = { anchorWorld: [1, 2, -3] };
    const original = Array.from(main.getVerticesData(BABYLON.VertexBuffer.PositionKind));
    const model = { root, main }; app.site.registerExternalModel(model, 'one');
    assert.equal(proxy.root.isEnabled(), false); assert.equal(root.isEnabled(), true);
    app.site.setBuildingDetailVisible('one', false); assert.equal(proxy.root.isEnabled(), true); assert.equal(root.isEnabled(), false);
    app.site.setLayerVisible('buildings', false); app.site.setBuildingDetailVisible('one', true); assert.equal(proxy.root.isEnabled(), false); assert.equal(root.isEnabled(), false);
    app.site.setLayerVisible('buildings', true); assert.equal(root.isEnabled(), true); assert.equal(proxy.root.isEnabled(), false);
    app.site.setFeatureVisible('one', false); app.site.setBuildingDetailVisible('one', false); assert.equal(proxy.root.isEnabled(), false); assert.equal(root.isEnabled(), false);
    app.site.setFeatureVisible('one', true); assert.equal(proxy.root.isEnabled(), true);
    app.site.setVerticalExaggeration(2); assert.equal(root.position.y, 4); assert.deepEqual(Array.from(main.getVerticesData(BABYLON.VertexBuffer.PositionKind)), original);
    const positions = proxy.main.getVerticesData(BABYLON.VertexBuffer.PositionKind);
    for (let i = 0; i < positions.length; i += 3) assert.ok(Math.abs(positions[i + 1] - app.site.terrainHeightAt(positions[i], positions[i + 2]) - (i / 3 % 2 ? 0.65 : 0.03)) < 0.00001);
    app.site.releaseModel(model); root.dispose(); assert.equal(proxy.root.isEnabled(), true);
    app.site.setVerticalExaggeration(1.5);
    assert.equal(app.site.getDiagnostics().errors.length, 0);
  } finally { app.dispose(); }
});

test('imported building and facility parts keep their separate rings and courtyard holes', () => {
  const parts = [{ outer: [[-80, -30], [-20, -30], [-20, 30], [-80, 30]], holes: [[[-60, -10], [-40, -10], [-40, 10], [-60, 10]]] }, { outer: [[40, -20], [70, -20], [70, 20], [40, 20]], holes: [] }];
  const data = plan(); data.features.buildings = [{ id: 'imported', geometryType: 'polygon', pointsMeters: parts[0].outer, polygonsMeters: parts }]; data.features.sports = [{ id: 'court', geometryType: 'polygon', pointsMeters: parts[0].outer, polygonsMeters: parts }];
  const engine = new BABYLON.NullEngine(); const scene = new BABYLON.Scene(engine); const site = create(scene, {}, data, { createCamera: false });
  try {
    const world = parts.map((part) => ({ outer: part.outer.map(site.worldPoint), holes: part.holes.map((ring) => ring.map(site.worldPoint)) }));
    const inside = (point) => world.some((part) => geometry.contains(point, part.outer) && !part.holes.some((ring) => geometry.contains(point, ring)));
    const surfaces = [...site.layers.sports, ...site.layers.buildings.filter((mesh) => /footprint|roof/.test(mesh.name))];
    assert.equal(surfaces.length, 6);
    for (const mesh of surfaces) {
      const vertices = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind); const indices = mesh.getIndices();
      for (let i = 0; i < indices.length; i += 3) { const point = [0, 0]; for (const index of indices.slice(i, i + 3)) { point[0] += vertices[index * 3] / 3; point[1] += vertices[index * 3 + 2] / 3; } assert.equal(inside(point), true, mesh.name); }
    }
    assert.ok(site.getBuildingProxy('imported'));
  } finally { site.dispose(); scene.dispose(); engine.dispose(); }
});

test('a campus component inside another component courtyard remains distinct from outside context', () => {
  const first = { outer: [[-100, -100], [100, -100], [100, 100], [-100, 100]], holes: [[[-60, -60], [60, -60], [60, 60], [-60, 60]]] };
  const island = { outer: [[-20, -20], [20, -20], [20, 20], [-20, 20]], holes: [] };
  const engine = new BABYLON.NullEngine(); const scene = new BABYLON.Scene(engine);
  const site = create(scene, {}, { boundaries: { campusMapped: { pointsMeters: first.outer, polygonsMeters: [first, island] } }, features: {} }, { createCamera: false });
  try {
    const firstWorld = first.outer.map(site.worldPoint), hole = first.holes[0].map(site.worldPoint), islandWorld = island.outer.map(site.worldPoint);
    const inside = (point) => geometry.contains(point, firstWorld) && !geometry.contains(point, hole) || geometry.contains(point, islandWorld);
    for (const [layer, expected] of [['context', false], ['terrain', true]]) for (const mesh of site.layers[layer]) { const positions = mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind), indices = mesh.getIndices(); for (let i = 0; i < indices.length; i += 3) { const center = [0, 0]; indices.slice(i, i + 3).forEach((index) => { center[0] += positions[index * 3] / 3; center[1] += positions[index * 3 + 2] / 3; }); assert.equal(inside(center), expected); } }
    assert.equal(site.getDiagnostics().boundaryAreaMeters2, 27200);
  } finally { site.dispose(); scene.dispose(); engine.dispose(); }
});

test('temporary user position uses metre accuracy, does not move the camera, follows terrain and is removed outside or on disposal', () => {
  const app = fixture({ terrain: { xs: [-30, 30], zs: [-30, 30], elevations: [[14, 35], [45, 85]], baseElevationMeters: 14 } });
  try {
    const camera = app.site.cameraController.capture();
    assert.equal(app.site.showUserLocation(10, 30, 15), true);
    const marker = app.scene.getMeshByName('temporary-user-location'), circle = app.scene.getMeshByName('temporary-user-location-accuracy');
    assert.ok(marker && circle); assert.equal(marker.isPickable, false); assert.equal(circle.isPickable, false);
    assert.ok(Math.abs(circle.getBoundingInfo().boundingBox.maximum.x - 2.5) < 0.0001);
    assert.deepEqual(app.site.cameraController.capture(), camera);
    app.site.setVerticalExaggeration(2);
    assert.ok(Math.abs(marker.position.y - app.site.terrainHeightAt(1, -3) - 0.22) < 0.00001);
    assert.equal(app.site.showUserLocation(20000, 30000, 100), false);
    assert.equal(marker.isDisposed(), true); assert.equal(circle.isDisposed(), true);
    assert.equal(app.scene.getMeshByName('temporary-user-location'), null);
    assert.throws(() => app.site.showUserLocation(Number.NaN, 0, 1));
    app.site.showUserLocation(10, 30, 15); app.site.clearUserLocation(); assert.equal(app.scene.getMeshByName('temporary-user-location'), null);
  } finally { app.dispose(); }
});
