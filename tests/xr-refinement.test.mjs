import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const B = require('babylonjs');
const compiled = await build({ entryPoints: ['src/scene/xr-refinement.ts'], bundle: true, write: false, format: 'esm', platform: 'node' });
const { createXrRefinement, fitXrCalibration, validateXrAnchor } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
const clone = (value) => JSON.parse(JSON.stringify(value));
function anchor() {
  return { id: 'test-anchor', campusId: 'campus', entityId: 'building', sourceIds: ['survey'], reviewedAt: '2020-01-01T00:00:00Z', validUntil: '2099-01-01T00:00:00Z', maxHorizontalErrorMeters: 0.1, maxVerticalErrorMeters: 0.1, landmarks: [
    { id: 'c1', role: 'control', siteMeters: [0, 0, 0] }, { id: 'c2', role: 'control', siteMeters: [5, 0, 0] },
    { id: 'h1', role: 'holdout', siteMeters: [0, 5, 0] }, { id: 'h2', role: 'holdout', siteMeters: [5, 5, 0] }, { id: 'h3', role: 'holdout', siteMeters: [2, 2, 1] }
  ] };
}
function transformed(value, yaw = 0.4, translation = [1, 0.5, -2]) {
  const [east, north, up] = value, cosine = Math.cos(yaw), sine = Math.sin(yaw);
  return [cosine * east - sine * north + translation[0], up + translation[1], -sine * east - cosine * north + translation[2]];
}
function captures(data = anchor()) { return data.landmarks.map((item) => ({ id: item.id, xrMeters: transformed(item.siteMeters) })); }
function fixture(preferences = {}) {
  const engine = new B.NullEngine({ renderWidth: 1280, renderHeight: 720, textureSize: 512, deterministicLockstep: false, lockstepMaxSteps: 4 });
  const scene = new B.Scene(engine); scene.useRightHandedSystem = true;
  const root = new B.TransformNode('existing-building', scene); root.metadata = { featureId: 'building', siteLayer: 'buildings' }; root.position.set(3, 1, -2); root.rotation.y = 0.2; root.scaling.set(1.2, 1, 1.3);
  const mesh = B.MeshBuilder.CreateBox('existing-body', {}, scene); mesh.parent = root;
  const camera = new B.ArcRotateCamera('original-camera', 0.2, 0.7, 10, B.Vector3.Zero(), scene); scene.activeCamera = camera;
  const snapshot = { view: 'overview', alpha: 0.2, beta: 0.7, radius: 10, target: [0, 0, 0], freePosition: [0, 0, 0], freeRotation: [0, 0, 0] }; let restored = 0;
  const site = { getDiagnostics() { return { metersPerUnit: 10, verticalExaggeration: 1 }; }, cameraController: { capture() { return clone(snapshot); }, cancelTransition() {}, restore(value) { assert.deepEqual(value, snapshot); restored++; } } };
  const hit = { onHitTestResultObservable: new B.Observable() };
  const featureCalls = [];
  const sessionManager = { worldScalingFactor: 1, defaultHeightCompensation: 1.7, onXRReferenceSpaceChanged: new B.Observable(), onXRFrameObservable: new B.Observable(), onXRSessionEnded: new B.Observable() };
  const xrCamera = { trackingState: B.WebXRTrackingState.TRACKING, onTrackingStateChanged: new B.Observable(), _computeLocalCameraSpeed() { return 99; } };
  let entered = 0, exited = 0, disposedExperience = 0, supported = true;
  const experience = { input: {}, teleportation: {}, baseExperience: { state: B.WebXRState.NOT_IN_XR, sessionManager, camera: xrCamera, featuresManager: { enableFeature(name, version, options) { featureCalls.push({ name, version, options }); return hit; } }, async enterXRAsync() { entered++; experience.baseExperience.state = B.WebXRState.IN_XR; }, async exitXRAsync() { exited++; experience.baseExperience.state = B.WebXRState.NOT_IN_XR; } }, dispose() { disposedExperience++; } };
  let createdOptions = null;
  scene.createDefaultXRExperienceAsync = async (options) => { createdOptions = options; return experience; };
  const runtimeB = { ...B, WebXRSessionManager: { async IsSessionSupportedAsync() { return supported; } } };
  const catalog = { activeCampusId: 'campus', entities: [{ id: 'building', campusId: 'campus', parentId: null, visibility: 'public', sensitive: false }], sources: [{ id: 'survey', visibility: 'public', confidence: 'verified' }] };
  const statuses = [];
  const runtime = createXrRefinement(runtimeB, scene, site, () => ({ catalog, campusId: 'campus', ...preferences }), (status) => statuses.push(status));
  return { engine, scene, root, mesh, runtime, catalog, experience, sessionManager, xrCamera, hit, statuses, featureCalls, site, get createdOptions() { return createdOptions; }, get counts() { return { entered, exited, disposedExperience, restored }; }, setSupported(value) { supported = value; }, async dispose() { runtime.dispose(); await Promise.resolve(); await Promise.resolve(); scene.dispose(); engine.dispose(); } };
}

test('fixed-scale calibration uses controls only and independently checks three spatial holdouts', () => {
  const data = anchor(); const result = fitXrCalibration(data, captures(data));
  assert.equal(result.passed, true); assert.equal(result.holdoutCount, 3); assert.equal(result.realDeviceVerified, false);
  assert.ok(Math.abs(result.yawRadians - 0.4) < 1e-10);
  result.translationMeters.forEach((value, index) => assert.ok(Math.abs(value - [1, 0.5, -2][index]) < 1e-10));
  const wrongHoldout = captures(data); wrongHoldout.find((item) => item.id === 'h1').xrMeters[0] += 1;
  const failed = fitXrCalibration(data, wrongHoldout); assert.equal(failed.passed, false); assert.ok(Math.abs(failed.yawRadians - 0.4) < 1e-10);
  assert.equal(failed.residuals.find((item) => item.id === 'h1').passed, false);
  const wrongScale = captures(data).map((item) => ({ ...item, xrMeters: item.xrMeters.map((value) => value * 2) })); assert.equal(fitXrCalibration(data, wrongScale).passed, false);
  assert.equal(fitXrCalibration(data, captures(data).slice(0, 2)).passed, false);
});

test('anchor validation rejects expired, duplicate, collinear or unbounded calibration input', () => {
  assert.throws(() => validateXrAnchor({ ...anchor(), validUntil: '2020-01-01T00:00:00Z' }));
  const duplicate = anchor(); duplicate.landmarks[2].siteMeters = duplicate.landmarks[0].siteMeters; assert.throws(() => validateXrAnchor(duplicate));
  const line = anchor(); line.landmarks.filter((item) => item.role === 'holdout').forEach((item, index) => { item.siteMeters = [index + 10, 0, 0]; }); assert.throws(() => validateXrAnchor(line));
  assert.throws(() => validateXrAnchor({ ...anchor(), maxHorizontalErrorMeters: Infinity }));
  const input = captures(); input[1].id = input[0].id; assert.throws(() => fitXrCalibration(anchor(), input));
});

test('AR refuses absent or non-public source bindings before starting any device session', async () => {
  const f = fixture();
  try {
    f.catalog.sources[0].confidence = 'estimated'; await assert.rejects(() => f.runtime.startAR(anchor()));
    assert.equal(f.counts.entered, 0); assert.equal(f.root.isEnabled(), true);
    f.catalog.sources[0].confidence = 'verified'; f.catalog.entities[0].visibility = 'restricted'; await assert.rejects(() => f.runtime.startAR(anchor()));
    assert.equal(f.counts.entered, 0);
  } finally { await f.dispose(); }
});

test('AR requires actual tracked hit captures, hides content before approval and aligns with real meter scaling', async () => {
  const f = fixture();
  try {
    assert.equal(await f.runtime.startAR(anchor()), true); assert.equal(f.root.isEnabled(), false);
    assert.equal(f.createdOptions.ignoreNativeCameraTransformation, true); assert.equal(f.createdOptions.inputOptions.doNotLoadControllerMeshes, true); assert.equal(f.createdOptions.inputOptions.disableOnlineControllerRepository, true);
    assert.equal(f.sessionManager.worldScalingFactor, 0.1); assert.throws(() => f.runtime.capture('c1'));
    for (const sample of captures()) { f.hit.onHitTestResultObservable.notifyObservers([{ position: B.Vector3.FromArray(sample.xrMeters).scale(0.1) }]); f.runtime.capture(sample.id); }
    assert.equal(f.runtime.review().passed, true); assert.equal(f.root.isEnabled(), true); assert.equal(f.root.parent.name, 'verified-ar-alignment');
    f.root.computeWorldMatrix(true); const absolute = f.root.getAbsolutePosition();
    const expected = transformed([30, 20, 10]).map((value) => value / 10); expected.forEach((value, index) => assert.ok(Math.abs(absolute.asArray()[index] - value) < 1e-5));
    const late = B.MeshBuilder.CreateBox('late-loaded-site-model', {}, f.scene); late.metadata = { siteLayer: 'buildings', featureId: 'late' }; late.position.set(1, 0, 0);
    f.sessionManager.onXRFrameObservable.notifyObservers({}); assert.equal(late.parent.name, 'verified-ar-alignment');
    await f.runtime.exit(); assert.equal(f.root.parent, null); assert.deepEqual(f.root.position.asArray(), [3, 1, -2]); assert.deepEqual(f.root.scaling.asArray(), [1.2, 1, 1.3]); assert.equal(f.root.rotation.y, 0.2); assert.equal(late.parent, null); assert.deepEqual(late.position.asArray(), [1, 0, 0]);
    assert.equal(f.runtime.diagnostics().usesGnssForAlignment, false); assert.equal(f.runtime.diagnostics().realDeviceVerified, false);
  } finally { await f.dispose(); }
});

test('tracking loss hides alignment, clears captures and requires new field calibration', async () => {
  const f = fixture();
  try {
    await f.runtime.startAR(anchor());
    for (const sample of captures()) { f.hit.onHitTestResultObservable.notifyObservers([{ position: B.Vector3.FromArray(sample.xrMeters).scale(0.1) }]); f.runtime.capture(sample.id); }
    f.runtime.review(); assert.equal(f.root.isEnabled(), true);
    f.xrCamera.trackingState = B.WebXRTrackingState.TRACKING_LOST; f.xrCamera.onTrackingStateChanged.notifyObservers(B.WebXRTrackingState.TRACKING_LOST);
    assert.equal(f.root.isEnabled(), false); assert.equal(f.runtime.diagnostics().capturedIds.length, 0); assert.equal(f.runtime.diagnostics().calibrated, false); assert.equal(f.runtime.diagnostics().state, 'tracking-lost');
    assert.throws(() => f.runtime.capture('c1')); assert.throws(() => f.runtime.review());
    f.xrCamera.trackingState = B.WebXRTrackingState.TRACKING;
    assert.equal(f.runtime.review().passed, false); assert.equal(f.root.isEnabled(), false);
    await f.runtime.exit(); assert.equal(f.root.isEnabled(), true);
  } finally { await f.dispose(); }
});

test('VR applies independent movement/rotation preferences without overwriting tracked headset height', async () => {
  const f = fixture({ vrMovement: 'smooth', vrTurn: 'snap', eyeHeightMeters: 1.2 });
  try {
    assert.equal(await f.runtime.startVR(), true);
    assert.equal(f.experience.teleportation.teleportationEnabled, false); assert.equal(f.experience.teleportation.rotationEnabled, true); assert.equal(f.experience.teleportation.rotationAngle, Math.PI / 6);
    assert.equal(f.featureCalls[0].options.movementEnabled, true); assert.equal(f.featureCalls[0].options.rotationEnabled, false);
    f.engine.getDeltaTime = () => 20; assert.equal(f.featureCalls[0].options.movementSpeed, 1); assert.ok(Math.abs(f.xrCamera._computeLocalCameraSpeed() * 10 - 1.4 * 0.02) < 1e-10);
    f.engine.getDeltaTime = () => 40; assert.ok(Math.abs(f.xrCamera._computeLocalCameraSpeed() * 10 - 1.4 * 0.04) < 1e-10);
    assert.equal(f.sessionManager.defaultHeightCompensation, 1.2); assert.equal(Object.prototype.hasOwnProperty.call(f.xrCamera, 'position'), false);
    assert.equal(f.root.parent, null); assert.equal(f.root.isEnabled(), true);
    await f.runtime.exit(); assert.equal(f.counts.restored, 1); assert.equal(f.xrCamera._computeLocalCameraSpeed(), 99);
  } finally { await f.dispose(); }
});

test('unsupported XR and late asynchronous creation preserve the original scene and never enter a disposed session', async () => {
  const unsupported = fixture();
  try { unsupported.setSupported(false); assert.equal(await unsupported.runtime.startVR(), false); assert.equal(unsupported.counts.entered, 0); assert.equal(unsupported.root.isEnabled(), true); } finally { await unsupported.dispose(); }
  const late = fixture();
  try {
    let resolveExperience;
    late.scene.createDefaultXRExperienceAsync = () => new Promise((resolve) => { resolveExperience = resolve; });
    const pending = late.runtime.startVR();
    for (let index = 0; index < 10 && !resolveExperience; index++) await Promise.resolve();
    assert.ok(resolveExperience); late.runtime.dispose(); resolveExperience(late.experience);
    assert.equal(await pending, false); assert.equal(late.counts.entered, 0); assert.equal(late.counts.disposedExperience, 1); assert.equal(late.root.isEnabled(), true);
  } finally { await late.dispose(); }
});
