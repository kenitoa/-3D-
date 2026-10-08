/* global window, document */
import { test, expect } from '@playwright/test';
import { build } from 'esbuild';
import { triangleGlb } from '../fixtures/self-contained-glb.mjs';

const bridge = await build({ entryPoints: ['src/scene/model-loader.ts'], bundle: true, write: false, format: 'iife', globalName: 'CampusModelRegression', target: 'es2020' });
test.use({ serviceWorkers: 'block' });

test('actual Babylon imports validated self-contained GLB bytes under the current self-only connection policy', async ({ page }) => {
  const errors = [], requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', (request) => requests.push(request.url()));
  await page.route('**/assets/models/loader-fixture.glb', (route) => route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: triangleGlb() }));
  await page.route('**/src/models/janggong.js?glb-regression', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: bridge.outputFiles[0].text }));
  const response = await page.goto('/');
  expect(response.headers()['content-security-policy']).toMatch(/connect-src 'self';/);
  await page.waitForFunction(() => { const diagnostics = window.CampusApp?.diagnostics().modelLoader; return window.CampusApp?.ready && diagnostics?.loaded >= 1 && diagnostics.pending === 0 && diagnostics.active === 0; });
  // A same-origin test-only bridge exposes the production adapter without adding a public runtime API.
  await page.addScriptTag({ url: '/src/models/janggong.js?glb-regression' });
  const result = await page.evaluate(async () => {
    const B = window.BABYLON, app = window.CampusApp, adapter = window.CampusModelRegression;
    const before = { meshes: app.scene.meshes.length, nodes: app.scene.transformNodes.length };
    const violations = [];
    const policyViolation = (event) => violations.push(event.violatedDirective);
    document.addEventListener('securitypolicyviolation', policyViolation);
    const entry = { id: 'loader-fixture', kind: 'glb', source: 'assets/models/loader-fixture.glb', status: 'measured', placement: { units: 'm', upAxis: 'Y', origin: [5, 0, 5], anchorMeters: [40, 60, 8], yawRadians: 0.3, altitudeDatum: 'local-site-meters', mode: 'measured' } };
    adapter.validateModelManifest({ schemaVersion: 1, version: 'regression-only', models: [entry] });
    let model;
    try {
      model = await adapter.browserGlbModel(B, app.scene, app.site, entry, new window.AbortController().signal);
      model.root.computeWorldMatrix(true);
      const anchor = B.Vector3.TransformCoordinates(B.Vector3.FromArray(entry.placement.origin), model.root.getWorldMatrix()).asArray();
      const output = { vertices: model.main.getTotalVertices(), positions: Array.from(model.main.getVerticesData(B.VertexBuffer.PositionKind)), scaling: model.root.scaling.asArray(), anchor, preserved: model.root.metadata.shapePreserved, placementStatus: model.root.metadata.placementStatus, violations };
      model.dispose(); model = null;
      return { ...output, meshDelta: app.scene.meshes.length - before.meshes, nodeDelta: app.scene.transformNodes.length - before.nodes };
    } finally { model?.dispose(); document.removeEventListener('securitypolicyviolation', policyViolation); }
  });
  expect(result.vertices).toBe(3);
  expect(result.positions).toEqual([0, 0, 0, 20, 0, 0, 0, 0, 10]);
  expect(result.scaling).toEqual([0.1, 0.1, 0.1]);
  [4, 0.8, -6].forEach((value, index) => expect(result.anchor[index]).toBeCloseTo(value, 5));
  expect(result.preserved).toBe(true); expect(result.placementStatus).toBe('measured');
  expect(result.meshDelta).toBe(0); expect(result.nodeDelta).toBe(0);
  expect(result.violations).toEqual([]); expect(errors).toEqual([]);
  expect(requests.filter((url) => new URL(url).pathname === '/assets/models/loader-fixture.glb')).toHaveLength(1);
  expect(requests.filter((url) => url.startsWith('blob:') || new URL(url).origin !== 'http://127.0.0.1:8767')).toEqual([]);
});
