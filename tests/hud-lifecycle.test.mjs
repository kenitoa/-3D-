import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';

const source = fs.readFileSync('src/ui/hud.js', 'utf8');
const interior = { id: 'sample-interior', title: '공개 내부 개념도', floor: '1F 2F', zones: [{ id: 'lobby-1f', label: '1층 로비', kind: 'lobby', x: 10, y: 10, w: 20, h: 20 }, { id: 'lecture-2f', label: '2층 강의', kind: 'lecture', x: 20, y: 20, w: 30, h: 30 }], rooms: [] };

test('repeated campus HUD replacement releases document handlers, restores focus and preserves preexisting inert state', () => {
  const dom = new JSDOM('<!doctype html><body><button id="launch">내부 보기</button><aside id="prior"></aside><canvas id="renderCanvas" tabindex="0"></canvas><section id="buildingDetail" hidden></section></body>', { runScripts: 'outside-only' });
  const { window } = dom; window.eval(source);
  const document = window.document, panel = document.getElementById('buildingDetail'), launch = document.getElementById('launch');
  const handlers = new Set(), add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document);
  document.addEventListener = (type, handler, options) => { if (type === 'keydown') handlers.add(handler); return add(type, handler, options); };
  document.removeEventListener = (type, handler, options) => { if (type === 'keydown') handlers.delete(handler); return remove(type, handler, options); };
  document.getElementById('prior').inert = true;
  let restored = 0, opened = 0;
  for (let i = 0; i < 3; i += 1) {
    const hud = window.CampusHud.createTextInteriorController();
    hud.setLifecycle({ capture: () => ({ radius: 42 }), restore: (state) => { assert.equal(state.radius, 42); restored += 1; }, onOpen: () => { opened += 1; } });
    hud.registerInterior(null, interior, null, 'sample');
    assert.equal(handlers.size, 1);
    launch.focus(); assert.equal(hud.openInterior('sample'), true); assert.equal(panel.hidden, false); assert.equal(launch.inert, true);
    const secondFloor = [...panel.querySelectorAll('.floor-tab')].find((tab) => tab.dataset.floorTarget === '2F'); secondFloor.click(); assert.equal(panel.querySelector('.floor-tab.is-active').dataset.floorTarget, '2F');
    if (i === 1) document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    hud.dispose(); hud.dispose();
    assert.equal(handlers.size, 0); assert.equal(panel.hidden, true); assert.equal(launch.inert, false); assert.equal(document.getElementById('prior').inert, true); assert.equal(document.activeElement, launch); assert.equal(hud.openInterior('sample'), false);
  }
  assert.equal(restored, 3); assert.equal(opened, 3); dom.window.close();
});

test('WebGL-independent location adapter is ephemeral and repeated campus boot removes obsolete HUD handlers', async () => {
  const compiled = await build({ entryPoints: ['src/bootstrap.ts'], bundle: true, write: false, format: 'iife', platform: 'browser' });
  const dom = new JSDOM('<!doctype html><body><canvas id="renderCanvas" tabindex="0"></canvas><section id="buildingDetail" hidden></section></body>', { url: 'https://campus.invalid/', runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom; const document = window.document;
  const handlers = new Set(), add = document.addEventListener.bind(document), remove = document.removeEventListener.bind(document);
  document.addEventListener = (type, handler, options) => { if (type === 'keydown') handlers.add(handler); return add(type, handler, options); };
  document.removeEventListener = (type, handler, options) => { if (type === 'keydown') handlers.delete(handler); return remove(type, handler, options); };
  window.console.error = () => {}; window.console.info = () => {};
  window.BABYLON = { Engine: { IsSupported: false } };
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  let onAction, catalog;
  window.CampusSiteControls = { initialize(options) { onAction = options.onAction; return { update() {}, selectBuilding() {}, setStatus() {}, announce() {}, destroy() {} }; } };
  window.CampusPlatformControls = { initialize(options) { catalog = options.catalog; return { update() {}, destroy() {} }; } };
  for (const path of ['src/data/campus-data.js', 'src/data/interior-data.js', 'src/domain/site-geometry.js', 'src/domain/campus-platform.js', 'src/data/site-plan.js', 'src/ui/hud.js']) window.eval(fs.readFileSync(path, 'utf8'));
  window.eval(compiled.outputFiles[0].text);
  try {
    assert.equal(window.CampusApp.ready, false); assert.equal(handlers.size, 1);
    const origin = catalog.campuses[0].origin;
    onAction('location', { latitude: origin.lat, longitude: origin.lon, accuracy: 12, timestamp: Date.now() });
    const snapshot = window.CampusApp.getLocationSnapshot();
    assert.equal(snapshot.inside, true); assert.equal(snapshot.east, 0); assert.equal(snapshot.north, 0); assert.equal(snapshot.accuracyMeters, 12);
    assert.equal(JSON.stringify(window.CampusApp.getState()).includes('accuracyMeters'), false);
    assert.equal(window.localStorage.getItem('hanshin-campus-view-v1').includes('accuracyMeters'), false);
    assert.equal(window.location.href.includes('latitude'), false); assert.equal(window.CampusApp.getState().camera, null);
    const nearby = { lat: origin.lat + 0.0002, lon: origin.lon + 0.0003 };
    onAction('location', { latitude: nearby.lat, longitude: nearby.lon, accuracy: 12, timestamp: Date.now() });
    const projected = window.SiteGeometry.projectWgs84(nearby, origin), nearbySnapshot = window.CampusApp.getLocationSnapshot();
    assert.ok(Math.abs(nearbySnapshot.east - projected[0]) < 1e-9);
    assert.ok(Math.abs(nearbySnapshot.north - projected[1]) < 1e-9);
    onAction('location', { latitude: origin.lat + 1, longitude: origin.lon, accuracy: 12, timestamp: Date.now() });
    assert.equal(window.CampusApp.getLocationSnapshot().inside, false);
    onAction('location', { latitude: origin.lat, longitude: origin.lon, accuracy: -5, timestamp: Date.now() });
    assert.equal(window.CampusApp.getLocationSnapshot().inside, false, 'invalid input cannot replace the previous valid reading');
    for (let i = 0; i < 2; i += 1) { onAction('campus', { campusId: catalog.activeCampusId }); assert.equal(window.CampusApp.getLocationSnapshot(), null); assert.equal(handlers.size, 1); }
    window.dispatchEvent(new window.Event('pagehide')); assert.equal(handlers.size, 0);
  } finally { dom.window.close(); }
});

test('one hundred LOD replacements keep one interior action and point measurement suppresses interior picking', () => {
  const dom=new JSDOM('<!doctype html><body><canvas id="renderCanvas"></canvas><section id="buildingDetail" hidden></section></body>',{runScripts:'outside-only'}),{window}=dom;
  const managers=[];
  class Manager { static OnPickTrigger=1;constructor(){this.actions=[];managers.push(this);}registerAction(action){this.actions.push(action);return action;}unregisterAction(action){this.actions=this.actions.filter(item=>item!==action);} }
  window.BABYLON={GUI:{AdvancedDynamicTexture:{CreateFullscreenUI:()=>({dispose(){}})}},ActionManager:Manager,ExecuteCodeAction:class{constructor(_trigger,action){this.execute=action;}}};
  window.eval(source);const scene={meshes:[]},hud=window.CampusHud.createHud(scene,null),panel=window.document.getElementById('buildingDetail');let disposeCurrent=()=>{};
  try{
    for(let index=0;index<100;index++){
      const mesh={parent:null,onDisposeObservable:{addOnce(callback){disposeCurrent=callback;}}};const disposeOld=disposeCurrent;scene.meshes=[mesh];hud.registerInterior(mesh,interior,null,'sample');disposeOld();
      assert.equal(managers.reduce((sum,manager)=>sum+manager.actions.length,0),1);
    }
    const action=scene.meshes[0].actionManager.actions[0];hud.setPickingEnabled(false);action.execute();assert.equal(panel.hidden,true);
    hud.setPickingEnabled(true);action.execute();assert.equal(panel.hidden,false);hud.hideInterior();disposeCurrent();
    assert.equal(managers.reduce((sum,manager)=>sum+manager.actions.length,0),0);hud.dispose();
  }finally{dom.window.close();}
});

test('incoming shared selection survives initial search highlighting without writing view history', async () => {
  const compiled = await build({ entryPoints: ['src/bootstrap.ts'], bundle: true, write: false, format: 'iife', platform: 'browser' });
  const incoming = 'https://campus.invalid/?version=1&campusId=hanshin-gg&entityId=hanshin-gg%3Abuilding%3Apractice&view=overview&layers=boundary,buildings,labels';
  const dom = new JSDOM('<!doctype html><body><canvas id="renderCanvas"></canvas><section id="buildingDetail" hidden></section></body>', { url: incoming, runScripts: 'outside-only', pretendToBeVisual: true });
  const { window } = dom;
  window.console.error = () => {}; window.console.info = () => {};
  window.BABYLON = { Engine: { IsSupported: false } };
  window.fetch = async () => ({ ok: true, headers: { get: () => null } });
  window.CampusSiteControls = { initialize() { return { update() {}, selectBuilding() {}, setStatus() {}, announce() {}, destroy() {} }; } };
  let highlight;
  window.CampusPlatformControls = { initialize(options) { highlight = () => options.onAction('search-highlight', { entityIds: ['hanshin-gg:building:practice'] }); highlight(); assert.equal(window.location.href, incoming); return { update() {}, destroy() {} }; } };
  for (const path of ['src/data/campus-data.js', 'src/data/interior-data.js', 'src/domain/site-geometry.js', 'src/domain/campus-platform.js', 'src/data/site-plan.js', 'src/ui/hud.js']) window.eval(fs.readFileSync(path, 'utf8'));
  try {
    window.eval(compiled.outputFiles[0].text);
    assert.equal(window.CampusApp.getState().selectedId, 'hanshin-gg:building:practice');
    assert.equal(window.localStorage.getItem('hanshin-campus-view-v1'), null);
    highlight();
    assert.equal(window.location.href, incoming);
    assert.equal(window.CampusApp.getState().selectedId, 'hanshin-gg:building:practice');
    assert.equal(window.localStorage.getItem('hanshin-campus-view-v1'), null);
    window.dispatchEvent(new window.Event('pagehide'));
  } finally { dom.window.close(); }
});
