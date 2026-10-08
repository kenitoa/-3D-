import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const BABYLON = require('babylonjs');
const context = vm.createContext({ BABYLON, window: {}, console });
vm.runInContext(fs.readFileSync('src/scene/site-scene.js', 'utf8'), context);

function plan() {
  return {
    boundaries: { campusMapped: { id: 'guide', pointsMeters: [[-120, -80], [120, -80], [120, 100], [-120, 100]], confidence: 'estimated', sourceId: 'guide-source' }, legal: null, planning: null, cadastral: null },
    features: { buildings: [{ id: 'one', legacyKey: 'building-one', geometryType: 'polygon', pointsMeters: [[-20, 20], [40, 20], [40, 40], [-20, 40]], anchorMeters: [10, 30], heightMeters: 10 }], entrances: [{ id: 'entry', geometryType: 'point', pointsMeters: [[10, 18]] }], context: [], paths: [], roads: [] }
  };
}

function fixture(data = plan(), options = {}, size = [1280, 720]) {
  const engine = new BABYLON.NullEngine({ renderWidth: size[0], renderHeight: size[1], textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 });
  const scene = new BABYLON.Scene(engine);
  const site = context.window.CampusSiteScene.create(scene, {}, data, options);
  return { engine, scene, site, dispose() { site.dispose(); scene.dispose(); engine.dispose(); } };
}

test('initial and reset overview show the real campus diagonally while the complete site fits desktop and mobile safe areas', () => {
  vm.runInContext(fs.readFileSync('src/data/site-plan.js', 'utf8'), context);
  const data = context.SitePlanData;
  for (const [size, insets] of [[[1440, 1000], { left: 0, right: 327, top: 112, bottom: 55 }], [[390, 844], { left: 0, right: 0, top: 90, bottom: 220 }]]) {
    const app = fixture(data, { terrain: data.terrain }, size);
    try {
      const camera = app.site.cameraController;
      assert.equal(camera.capture().alpha, 1.15); assert.equal(camera.capture().beta, 0.6);
      camera.setSafeArea(insets);
      function projectedBoundary() {
        app.scene.render(); const viewport = camera.orbit.viewport.toGlobal(...size);
        return data.boundaries.campusMapped.pointsMeters.map((point) => { const [x, z] = app.site.worldPoint(point); return BABYLON.Vector3.Project(new BABYLON.Vector3(x, app.site.terrainHeightAt(x, z), z), BABYLON.Matrix.Identity(), app.scene.getTransformMatrix(), viewport); });
      }
      const current = projectedBoundary();
      for (const pixel of current) {
        assert.ok(pixel.x >= insets.left && pixel.x <= size[0] - insets.right, `boundary x ${pixel.x} outside ${size[0]} safe area`);
        assert.ok(pixel.y >= insets.top && pixel.y <= size[1] - insets.bottom, `boundary y ${pixel.y} outside ${size[1]} safe area`);
      }
      const depth = (points) => Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
      camera.orbit.alpha = Math.PI / 2 + 0.25; camera.fit(); const old = projectedBoundary();
      assert.ok(depth(current) > depth(old) * 2, `diagonal campus depth ${depth(current)} versus horizontal ${depth(old)}`);
      camera.rotate(1); const viewingAlpha = camera.capture().alpha;
      camera.focusBuilding(data.features.buildings[0].id); assert.ok(Math.abs(camera.capture().alpha - viewingAlpha) < 1e-8);
      camera.reset(); assert.equal(camera.capture().alpha, 1.15); assert.equal(camera.capture().beta, 0.6);
      const restored = projectedBoundary(); assert.ok(Math.abs(depth(restored) - depth(current)) < 1e-6);
    } finally { app.dispose(); }
  }
});

test('panel changes retain relative zoom and focus while the full mobile campus stays framed', () => {
  vm.runInContext(fs.readFileSync('src/data/site-plan.js', 'utf8'), context);
  const data = context.SitePlanData, app = fixture(data, {terrain:data.terrain}, [390,844]);
  try {
    const camera = app.site.cameraController;
    camera.setSafeArea({left:0,right:0,top:60,bottom:570});
    camera.setSafeArea({left:0,right:0,top:134,bottom:55},{preserveView:true});
    app.scene.render();
    const viewport=camera.orbit.viewport.toGlobal(390,844);
    for(const point of data.boundaries.campusMapped.pointsMeters){const [x,z]=app.site.worldPoint(point),pixel=BABYLON.Vector3.Project(new BABYLON.Vector3(x,app.site.terrainHeightAt(x,z),z),BABYLON.Matrix.Identity(),app.scene.getTransformMatrix(),viewport);assert.ok(pixel.x>=0&&pixel.x<=390);assert.ok(pixel.y>=134&&pixel.y<=789);}
    camera.zoom(1);camera.pan(1,1);const moved=camera.capture();
    camera.setSafeArea({left:0,right:0,top:60,bottom:570},{preserveView:true});
    camera.setSafeArea({left:0,right:0,top:134,bottom:55},{preserveView:true});
    const restored=camera.capture();
    assert.deepEqual(Array.from(restored.target),Array.from(moved.target));assert.equal(restored.alpha,moved.alpha);assert.equal(restored.beta,moved.beta);assert.ok(Math.abs(restored.radius-moved.radius)<1e-8);
  } finally {app.dispose();}
});

test('only supplied boundary geometry is rendered and legend distinguishes all four meanings', () => {
  const missing = fixture();
  try {
    assert.equal(missing.site.getBoundaryLegend().filter((entry) => entry.available).length, 1);
    assert.ok(missing.site.layers.boundary.every((mesh) => mesh.metadata.boundaryType === 'guide' && !mesh.metadata.legalBoundary));
    assert.equal(missing.site.getDiagnostics().boundaryAreaMeaning, 'estimated-guide-area-not-legal-area');
  } finally { missing.dispose(); }
  const data = plan();
  for (const type of ['legal', 'planning', 'cadastral']) data.boundaries[type] = { id: type, pointsMeters: [[-100, -60], [100, -60], [100, 80], [-100, 80]], sourceId: `${type}-source`, confidence: 'official' };
  const present = fixture(data);
  try {
    assert.deepEqual(Array.from(present.site.getBoundaryLegend().map((entry) => entry.pattern)), ['dash', 'solid', 'dash-dot', 'dot']);
    assert.ok(present.site.getBoundaryLegend().every((entry) => entry.available));
    assert.ok(present.site.layers.boundary.filter((mesh) => mesh.metadata.boundaryType === 'legal').every((mesh) => mesh.metadata.legalBoundary));
    assert.equal(present.site.getDiagnostics().legalBoundaryAvailable, true);
    const copy = present.site.getBoundaryLegend(); copy[0].available = false;
    assert.equal(present.site.getBoundaryLegend()[0].available, true);
  } finally { present.dispose(); }
});

test('terrain assessment separates raw height, exaggeration, inferred contact and invalid extent', () => {
  const app = fixture(plan(), { terrain: { xs: [-10, 10], zs: [-10, 10], elevations: [[14, 34], [54, 74]], baseElevationMeters: 14 } });
  try {
    const raw = app.site.getTerrainAssessment(0, 0);
    assert.equal(raw.validTerrainExtent, true); assert.equal(raw.rawElevationMeters, 30); assert.equal(raw.measured, false);
    app.site.setVerticalExaggeration(2);
    const exaggerated = app.site.getTerrainAssessment(0, 0);
    assert.equal(exaggerated.rawElevationMeters, raw.rawElevationMeters);
    assert.equal(exaggerated.displayElevationMeters, raw.displayElevationMeters * 2);
    assert.match(exaggerated.warning, /원자료/);
    const outside = app.site.getTerrainAssessment(300, 0);
    assert.equal(outside.validTerrainExtent, false); assert.equal(outside.rawElevationMeters, null); assert.equal(outside.insideGuideArea, false);
    assert.throws(() => app.site.getTerrainAssessment(NaN, 0));
  } finally { app.dispose(); }
});

test('estimated grounding reports stay distinct from explicitly placed geometry', () => {
  const app = fixture();
  try {
    const root = new BABYLON.TransformNode('estimated', app.scene);
    const main = BABYLON.MeshBuilder.CreateBox('main-body', { width: 6, depth: 2, height: 1 }, app.scene); main.parent = root; main.position.y = 0.5;
    app.site.alignModel({ root, main }, 'one');
    assert.equal(app.site.getGroundingReport()[0].status, 'estimated-visual-contact');
    assert.ok(app.site.getGroundingReport()[0].adjustmentMeters >= 0);
    assert.equal(main.checkCollisions, true);
    const report = app.site.getGroundingReport(); report[0].status = 'fabricated';
    assert.equal(app.site.getGroundingReport()[0].status, 'estimated-visual-contact');
  } finally { app.dispose(); }
});

test('target framing fits full visible detail bounds inside an explicit panel-safe viewport', () => {
  const app = fixture();
  try {
    const root = new BABYLON.TransformNode('measured-root', app.scene);
    const main = BABYLON.MeshBuilder.CreateBox('measured-body', { width: 9, depth: 7, height: 8 }, app.scene); main.parent = root; root.position.set(1, 4, -3);
    app.site.registerExternalModel({ root, main }, 'one');
    const camera = app.site.cameraController;
    camera.setSafeArea({ left: 30, top: 80, right: 440, bottom: 60 });
    assert.equal(camera.focusBuilding('one'), true); app.scene.render();
    const viewport = camera.orbit.viewport.toGlobal(1280, 720);
    main.computeWorldMatrix(true);
    for (const point of main.getBoundingInfo().boundingBox.vectorsWorld) {
      const screen = BABYLON.Vector3.Project(point, BABYLON.Matrix.Identity(), app.scene.getTransformMatrix(), viewport);
      assert.ok(screen.x > 30 && screen.x < 840, `${screen.x} escaped horizontal safe area`);
      assert.ok(screen.y > 80 && screen.y < 660, `${screen.y} escaped vertical safe area`);
    }
    assert.deepEqual(Array.from(app.site.featureBounds('one').dimensionsMeters), [90, 80, 70]);
    assert.equal(app.site.featureBounds('missing'), null);
    assert.throws(() => camera.setSafeArea({ right: 1200 }));
  } finally { app.dispose(); }
});

test('short transitions can be interrupted by controls and reduced motion applies immediately', () => {
  const app = fixture();
  try {
    const camera = app.site.cameraController; const before = camera.capture();
    assert.throws(() => camera.setSafeArea({ left: NaN }), /80%/);
    camera.setSafeArea({ left: 120, right: 40, top: 30, bottom: 25 });
    camera.focusBuilding('one', { durationMs: 280 });
    const active = camera.capture(); camera.setSafeArea({ left: 120, right: 40, top: 30, bottom: 25 });
    assert.deepEqual(camera.capture(), active); assert.equal(camera.getTransitionState().active, true);
    camera.cancelTransition(); camera.restore(before);
    camera.focusBuilding('one', { durationMs: 280 });
    assert.equal(camera.getTransitionState().active, true);
    assert.deepEqual(Array.from(camera.capture().target), Array.from(before.target));
    app.scene.render(); assert.ok(camera.getTransitionState().elapsedMs > 0);
    camera.rotate(1); assert.equal(camera.getTransitionState().active, false);
    camera.focusBuilding('one', { durationMs: 280, reducedMotion: true });
    assert.equal(camera.getTransitionState().active, false);
    assert.notDeepEqual(Array.from(camera.capture().target), Array.from(before.target));
    camera.focusBuilding('one', { durationMs: 6000 }); assert.equal(camera.getTransitionState().durationMs, 600);
    app.scene.onPointerObservable.notifyObservers({ type: BABYLON.PointerEventTypes.POINTERDOWN });
    assert.equal(camera.getTransitionState().active, false);
  } finally { app.dispose(); }
});

test('observation uses meter units, active collision and restores its starting view without a route claim', () => {
  const app = fixture();
  try {
    const camera = app.site.cameraController; camera.focusBuilding('one'); const before = camera.capture();
    camera.setView('free'); const info = camera.getObservationInfo();
    assert.equal(info.eyeHeightMeters, 1.7); assert.equal(info.movementSpeedMetersPerSecond, 1.4); assert.equal(info.movementIsVerifiedRoute, false);
    const initialEye = camera.free.position.y; camera.setObservationSettings({ eyeHeightMeters: 1.2 });
    assert.equal(camera.getObservationInfo().eyeHeightMeters, 1.2); assert.ok(Math.abs(camera.free.position.y - initialEye + 0.05) < 1e-8); assert.ok(Math.abs(camera.free.ellipsoid.y - 0.06) < 1e-8);
    assert.throws(() => camera.setObservationSettings({ eyeHeightMeters: NaN }));
    assert.equal(app.scene.collisionsEnabled, true); assert.equal(camera.free.checkCollisions, true);
    camera.free.position.set(-4, 0.17, -3);
    camera.free._collideWithWorld(new BABYLON.Vector3(10, 0, 0));
    assert.ok(camera.free.position.x < -1.9, `camera crossed wall: ${camera.free.position.x}`);
    assert.equal(camera.returnFromObservation(), true);
    assert.deepEqual(JSON.parse(JSON.stringify(camera.capture())), JSON.parse(JSON.stringify(before)));
    assert.throws(() => camera.restore({ ...before, target: [NaN, 0, 0] }));
  } finally { app.dispose(); }
});

test('projection reports a real occluder instead of making a hidden target label appear in front', () => {
  const app = fixture();
  try {
    const camera = app.site.cameraController; camera.focusBuilding('one'); app.scene.render();
    const target = app.site.projectFeature('one', { occlusion: false });
    const position = BABYLON.Vector3.FromArray(target.worldPoint); const midpoint = BABYLON.Vector3.Lerp(camera.orbit.globalPosition, position, 0.5);
    const wall = BABYLON.MeshBuilder.CreateBox('other-building', { width: 2, height: 2, depth: 2 }, app.scene);
    wall.position.copyFrom(midpoint); wall.metadata = { siteLayer: 'buildings', featureId: 'other' }; wall.computeWorldMatrix(true);
    const hidden = app.site.projectFeature('one');
    assert.equal(hidden.occluded, true); assert.equal(hidden.visible, false); assert.equal(hidden.occludingFeatureId, 'other');
    wall.setEnabled(false); assert.equal(app.site.projectFeature('one').occluded, false);
  } finally { app.dispose(); }
});

test('interaction overlays distinguish roles and preserve material, core layers and filtered selection', () => {
  const app = fixture();
  try {
    const main = app.site.getBuildingProxy('one').main; const material = main.material;
    app.site.setInteractionState({ hovered: 'entry', selected: 'building-one', searchIds: ['one', 'one', 'missing'], routeIds: ['entry'] });
    const overlays = app.scene.meshes.filter((mesh) => mesh.metadata?.interactionRole);
    assert.equal(overlays.length, 4);
    assert.ok(overlays.every((mesh) => !mesh.isPickable && mesh.metadata.isRouteGeometry === false && mesh.metadata.visualPriority === 'essential'));
    assert.equal(new Set(overlays.map((mesh) => mesh.metadata.pattern)).size, 4);
    assert.equal(main.material, material);
    assert.ok(app.site.layers.boundary.every((mesh) => mesh.isEnabled()));
    app.site.setFeatureVisible('one', false);
    assert.equal(app.scene.meshes.some((mesh) => mesh.metadata?.interactionRole && mesh.metadata.featureId === 'one'), false);
    const state = app.site.getInteractionState(); state.searchIds.length = 0;
    assert.equal(app.site.getInteractionState().searchIds.length, 1);
    app.site.setInteractionState({}); assert.equal(app.site.getDiagnostics().interactionCount, 0);
  } finally { app.dispose(); }
});
