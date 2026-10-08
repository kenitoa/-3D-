import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { transform } from 'esbuild';

const require = createRequire(import.meta.url);
const BABYLON = require('babylonjs');
const materialSource = await transform(await readFile('src/app.ts', 'utf8'), { loader: 'ts', format: 'cjs', target: 'es2020' });

function fixture() {
  const context = vm.createContext({ BABYLON, window: {}, console, module: { exports: {} } });
  for (const path of ['src/data/campus-data.js', 'src/data/interior-data.js', 'src/domain/site-geometry.js', 'src/data/site-plan.js', 'src/scene/site-scene.js']) vm.runInContext(readFileSync(path, 'utf8'), context, { filename: path });
  vm.runInContext(materialSource.code, context);
  const engine = new BABYLON.NullEngine({ renderWidth: 1440, renderHeight: 1000, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 });
  const scene = new BABYLON.Scene(engine);
  const materials = context.module.exports.createMaterials(scene);
  scene.useRightHandedSystem = true;
  const site = context.window.CampusSiteScene.create(scene, materials, context.SitePlanData, { terrain: context.window.CampusData.terrain });
  return { context, engine, scene, materials, site, dispose() { site.dispose(); scene.dispose(); engine.dispose(); } };
}

test('real source dataset keeps every existing exterior and interior paired with an in-bound geographic anchor', async () => {
  const app = fixture();
  try {
    const plan = app.context.SitePlanData;
    assert.equal(plan.features.buildings.length, 16);
    for (const feature of plan.features.buildings) {
      const key = feature.legacyKey;
      const moduleName = `${key[0].toUpperCase()}${key.slice(1)}Model`;
      vm.runInContext(await readFile(`src/models/${key}.js`, 'utf8'), app.context);
      const factory = app.context.window[moduleName][`create${key[0].toUpperCase()}${key.slice(1)}Model`];
      const model = factory(app.scene, app.materials);
      const primary = model.main || model.hall || model.newDorm || model.mediaHall;
      const count = primary.getTotalVertices();
      assert.ok(count > 0, `${key}: original detailed geometry is present`);
      assert.equal(app.site.alignModel(model, key, { fitFootprint: true }), true);
      model.root.computeWorldMatrix(true);
      const alignment = model.root.metadata.alignmentCenter;
      assert.equal(alignment.kind, 'estimated-compound-mass-envelope');
      assert.ok(alignment.meshNames.length > 0, `${key}: actual architectural mass defines the compound`);
      const center = BABYLON.Vector3.TransformCoordinates(BABYLON.Vector3.FromArray(alignment.local), model.root.getWorldMatrix());
      const anchor = feature.anchorMeters;
      assert.ok(Math.abs(center.x - anchor[0] / 10) < 0.0001, `${key}: east position`);
      assert.ok(Math.abs(center.z + anchor[1] / 10) < 0.0001, `${key}: north position`);
      const actualMass = model.root.getChildMeshes().filter((mesh) => alignment.meshNames.includes(mesh.name));
      assert.equal(actualMass.length, alignment.meshNames.length, `${key}: architectural meshes remain present`);
      const inverseYaw = BABYLON.Matrix.RotationY(-model.root.rotation.y);
      const massPoints = actualMass.flatMap((mesh) => {
        mesh.computeWorldMatrix(true);
        return mesh.getBoundingInfo().boundingBox.vectorsWorld.map((point) => BABYLON.Vector3.TransformNormal(point.subtract(center), inverseYaw));
      });
      const targetPoints = feature.pointsMeters.map(([east, north]) => BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(east / 10 - center.x, 0, -north / 10 - center.z), inverseYaw));
      for (const axis of ['x', 'z']) {
        const actualSpan = Math.max(...massPoints.map((point) => point[axis])) - Math.min(...massPoints.map((point) => point[axis]));
        const targetSpan = Math.max(...targetPoints.map((point) => point[axis])) - Math.min(...targetPoints.map((point) => point[axis]));
        assert.ok(actualSpan <= targetSpan + 0.001, `${key}: full compound ${axis} extent fits the inferred outline`);
      }
      if (key === 'seongbin') {
        for (const wing of ['seongbin-new-dormitory-left-building', 'seongbin-old-dormitory-center-building', 'seongbin-old-dormitory-right-building']) assert.ok(alignment.meshNames.includes(wing), `${wing}: compound fit includes all three dormitories`);
      }
      assert.equal(primary.getTotalVertices(), count, `${key}: original exterior details retained`);
      assert.equal(app.context.SiteGeometry.pointInPolygon(anchor, plan.boundaries.campusMapped.pointsMeters), true, `${key}: display boundary includes the target`);
      const interior = app.context.window.CampusData[`${key}Interior`];
      assert.ok(interior && interior.zones.length && interior.rooms.length, `${key}: legacy interior remains available`);
      assert.equal(model.root.metadata.heightStatus, 'estimated', `${key}: legacy height not misrepresented as measured`);
    }
    app.scene.render();
    app.site.setVerticalExaggeration(2);
    app.scene.render();
    assert.equal(app.site.getDiagnostics().errors.length, 0);
    assert.equal(app.site.getDiagnostics().legalBoundaryAvailable, false);
  } finally { app.dispose(); }
});

test('official coordinates remain distinguishable from inferred outlines and unverified legal area', () => {
  const app = fixture();
  try {
    const plan = app.context.SitePlanData;
    assert.equal(plan.metadata.legalBoundaryVerified, false);
    assert.equal(plan.boundaries.campusMapped.confidence, 'estimated');
    assert.notEqual(Math.round(app.site.getDiagnostics().boundaryAreaMeters2), 190636);
    assert.ok(plan.sources.every((source) => source.id && source.scope));
    assert.equal(plan.features.buildings.filter((feature) => feature.anchor.sourceId === 'hanshin-official-tour').length, 15);
    for (const feature of Object.values(plan.features).flat()) {
      assert.ok(feature.sourceId, `${feature.id}: source required`);
      assert.ok(feature.confidence, `${feature.id}: confirmation level required`);
      assert.ok(feature.pointsMeters.every((point) => point.length === 2 && point.every(Number.isFinite)));
    }
  } finally { app.dispose(); }
});

test('production entry point loads local pinned dependencies and all referenced browser assets exist', async () => {
  const html = await readFile('index.html', 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(scripts.length > 10);
  assert.equal(scripts.filter((path) => path.startsWith('./src/models/')).length, 0, 'model details load from the single manifest');
  const manifest=JSON.parse(await readFile('src/data/model-manifest.json','utf8'));
  assert.equal(manifest.models.length,16);
  assert.equal(new Set(manifest.models.map((entry)=>entry.id)).size,16);
  for(const entry of manifest.models)assert.ok((await readFile(entry.source)).length>0,entry.source);
  assert.ok(scripts.every((path) => path.startsWith('./')));
  for (const path of scripts) assert.ok((await readFile(path)).length > 0, path);
  assert.ok(scripts.indexOf('./src/data/site-plan.js') < scripts.indexOf('./src/scene/site-scene.js'));
  assert.equal(scripts.at(-1), './src/app.js');
  assert.equal((await readdir('src/models')).filter((file) => file.endsWith('.ts')).length, 16);
});
