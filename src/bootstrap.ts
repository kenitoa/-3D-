import { createMaterials } from './app';
import manifestInput from './data/model-manifest.json';
import mediaInput from '../assets/media/manifest.json';
import arInput from '../assets/ar/manifest.json';
import { createRefinementRuntime } from './scene/refinement-runtime';
import { createXrRefinement, validateXrAnchor } from './scene/xr-refinement';
import type { XrAnchor, XrStatus } from './scene/xr-refinement';
import type { MeasurementKind, PointMeters } from './types/refinement-types';
import type { SpatialGeometry } from './types/platform-types';
import { browserGlbModel, browserLegacyFactory, createModelLoader, modelsForCampus, validateModelManifest } from './scene/model-loader';
import type { ApplicationState, BuildingModel, CameraController, CameraSnapshot, CampusApplication, Controls, ControlsApi, Hud, LocationSnapshot, PlatformCatalog, PlatformControls, PlatformEntity, PlatformView, QualityMode, SiteFeature, SitePlan, SiteSceneApi, ViewMode } from './types/site-types';
import { viewSafeArea } from './ui/view-safe-area';
import type { ModelManifest } from './scene/model-loader';

declare const BABYLON: typeof import('babylonjs');
declare const CampusData: { campusInfo: Record<string, string>; terrain: unknown; confirmedBuildings: unknown[]; janggongResearch: unknown; [key: string]: unknown };
declare const CampusHud: { createHud: (scene: import('babylonjs').Scene, camera: import('babylonjs').Camera, info: unknown, buildings: unknown[], research: unknown, focus: () => void) => Hud; createTextInteriorController: () => { registerInterior: (mesh: null, data: Record<string, unknown>, focus: null, id: string) => void; openInterior: (id: string) => void; hide: () => void; dispose?: () => void } };
declare global {
  interface Window {
    CampusApp: CampusApplication;
    CampusSiteControls: ControlsApi;
    CampusSiteScene: SiteSceneApi;
    CampusPlatformControls: { initialize(options: { catalog: PlatformCatalog; onAction: (action: string, payload?: Record<string, unknown>) => void; getState: () => ApplicationState; apiBase?: string }): PlatformControls };
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function validatePlan(value: unknown): asserts value is SitePlan {
  if (!record(value) || !record(value.features) || !record(value.boundaries) || !record(value.boundaries.campusMapped) || !Array.isArray(value.sources) || !record(value.metadata)) throw new Error('Campus source data is missing.');
  const points = value.boundaries.campusMapped.pointsMeters;
  if (!Array.isArray(points) || points.length < 3 || !points.every((point: unknown) => Array.isArray(point) && point.length === 2 && point.every((n: unknown) => typeof n === 'number' && Number.isFinite(n)))) throw new Error('Campus boundary is invalid.');
  if (!Array.isArray(value.features.buildings) || !value.features.buildings.every((building: unknown) => record(building) && typeof building.id === 'string' && typeof building.name === 'string' && Array.isArray(building.pointsMeters))) throw new Error('Campus building data is invalid.');
}

const modelManifest: unknown = manifestInput;
validateModelManifest(modelManifest);
const manifest: ModelManifest = modelManifest;
const legacyKeys = manifest.models.flatMap((entry) => entry.legacyId ? [entry.legacyId] : []);
function initializeApplication(): void {
const planInput: unknown = Reflect.get(window, 'SitePlanData');
let plan: SitePlan;
try { validatePlan(planInput); plan = planInput; } catch (error) {
  const text = CampusHud.createTextInteriorController();
  const buildings = legacyKeys.flatMap((key) => {
    const interior = CampusData[`${key}Interior`];
    if (!record(interior)) return [];
    text.registerInterior(null, interior, null, key);
    return [{ id: key, name: String(interior.title || key).replace(/ 내부.*$/, ''), confidence: 'estimated', hasInterior: true }];
  });
  const safeControls = window.CampusSiteControls.initialize({ buildings, evidence: {}, onAction: (action, payload = {}) => { if (action === 'retry') window.location.reload(); if (action === 'select' && typeof payload.id === 'string') safeControls.selectBuilding(payload.id); if (action === 'interior' && typeof payload.id === 'string') text.openInterior(payload.id); } });
  safeControls.setStatus('error', '캠퍼스 부지 자료를 불러오지 못했습니다. 건물 목록과 내부 정보는 사용할 수 있습니다. 다시 시도해 주세요.');
  console.error('Campus data validation failed', error instanceof Error ? error.message : 'Unknown data error');
  return;
}
let catalog = window.CampusPlatform.publicCatalog(window.CampusPlatform.createCatalog(plan, CampusData));
catalog.assetsVersion=manifest.version;
let activeManifest:ModelManifest = location.protocol==='file:'?{...manifest,models:manifest.models.map(entry=>entry.kind==='legacy'?Object.fromEntries(Object.entries(entry).filter(([key])=>key!=='variants')) as unknown as typeof entry:entry)}:manifest;
let releaseId: string | null = null;
let sharedStatus = '';
let refinementRuntime: ReturnType<typeof createRefinementRuntime> | null = null;
let xrRuntime: ReturnType<typeof createXrRefinement> | null = null;
let xrStatus: XrStatus | null = null;
const arAnchors: XrAnchor[]=[];
for(const candidate of arInput.anchors as XrAnchor[]){try{validateXrAnchor(candidate);arAnchors.push(candidate);}catch{console.info('Unregistered or expired AR anchor excluded.');}}
let instrumentation: import('babylonjs').SceneInstrumentation | null = null;
const refinement: Record<string, unknown> = { purpose: 'visitor', reducedMotion: typeof window.matchMedia==='function'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches, vrMovement: 'teleport', vrTurn: 'snap', eyeHeightMeters: 1.7 };
let comparisonSnapshot: {catalog: PlatformCatalog; manifest: ModelManifest; releaseId: string | null} | null = null;
let measurementMode: MeasurementKind | null = null;
let measurementPoints: PointMeters[] = [];
let lastVisibilityTime = 0;
let lastFrameTime = 0;
const frameIntervals: number[] = [];
let frameP95Ms = 0;
let offlineBundle: Record<string, unknown> | null = null;
let offlineCatalogPending = false;
let mediaRecords: unknown[]=mediaInput.records;
let safeAreaKey='';
let approvedRefreshFailed=false;
let activeCampusId = catalog.activeCampusId;
const buildingById = new Map(plan.features.buildings.map((building) => [building.id, building]));
const buildingByLegacy = new Map(plan.features.buildings.filter((building) => building.legacyKey).map((building) => [building.legacyKey as string, building]));
const labels = new Map<string, HTMLButtonElement>();
const facilityLabels = new Map<string, { element: HTMLSpanElement; mesh: import('babylonjs').AbstractMesh }>();
const layers: Record<string, boolean> = Object.fromEntries(catalog.layers.map((layer) => [layer.id, layer.defaultVisible]));
Object.assign(layers, { boundary: true, trees: true, labels: true, contours: false });
let view: PlatformView = 'overview';
let exaggeration = 1;
let selectedId: string | null = null;
let hud: Hud | null = null;
let fallback: ReturnType<typeof CampusHud.createTextInteriorController> | null = null;
let lastUiTime = 0;
let cameraSnapshot: unknown;
let app: CampusApplication;
// Capture the incoming link before controls can update local view history.
const shared = parseLocationState();
let controls!: Controls;
let platformControls: PlatformControls | null = null;
let loader: ReturnType<typeof createModelLoader> | null = null;
let quality: QualityMode = 'auto';
let floor: string | null = null;
let publicSelectedId: string | null = null;
let activeTerrain: unknown = CampusData.terrain;
let bootGeneration = 0;
let routeMesh: import('babylonjs').LinesMesh | null = null;
let applyingState = false;
let tourSnapshot: ApplicationState | null = null;
let applicationClosed = false;
let locationSnapshot: LocationSnapshot | null = null;
let xrExperience: import('babylonjs').WebXRDefaultExperience | null = null;
let automaticLow = false;
let frameAverageMs = 16;
let qualityFrames = 0;
let qualityChangedAt = 0;
let lifecycle = 'current';
const detailVisibility = new Map<string, boolean>();

function interiorFor(key: string): Record<string, unknown> | null {
  const entity = catalog.entities.find((entry) => entry.campusId === activeCampusId && entry.kind === 'building' && (entry.legacyKey === key || entry.legacyId === key || entry.feature?.id === key));
  const value = entity?.interior;
  if (!record(value)) return null;
  const feature = buildingByLegacy.get(key);
  return { ...value, title: feature ? `${feature.number ? `${feature.number}동 ` : ''}${feature.name} 내부` : value.title, note: `${String(value.note || '')} 외부 출입 위치와 실측 내부 원도면의 일치 여부는 별도 확인이 필요합니다.` };
}
function featureKey(feature: SiteFeature): string {
  return feature.legacyKey || feature.id;
}
function controller(): CameraController | null { return app?.site?.cameraController || null; }
function getLocationSnapshot(): LocationSnapshot | null { return locationSnapshot ? { ...locationSnapshot } : null; }
function showLocation(payload: Record<string, unknown>): void {
  const latitude = payload.latitude, longitude = payload.longitude, accuracy = payload.accuracy, timestamp = payload.timestamp;
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || typeof accuracy !== 'number' || typeof timestamp !== 'number' || ![latitude, longitude, accuracy, timestamp].every(Number.isFinite) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || accuracy < 0 || accuracy > 100000 || timestamp < Date.now() - 300000 || timestamp > Date.now() + 60000) { controls.announce('현재 위치 값이나 확인 시각을 검증하지 못했습니다. 위치를 다시 확인해 주세요.'); return; }
  const campus = catalog.campuses.find((entry) => entry.id === activeCampusId); if (!campus) return;
  const earthRadius = 6378137, radians = Math.PI / 180, eccentricitySquared = 6.6943799901413165e-3;
  const originLatitude = campus.origin.lat * radians;
  const weight = Math.sqrt(1 - eccentricitySquared * Math.sin(originLatitude) ** 2);
  const east = (longitude - campus.origin.lon) * radians * earthRadius / weight * Math.cos(originLatitude);
  const north = (latitude - campus.origin.lat) * radians * earthRadius * (1 - eccentricitySquared) / weight ** 3;
  const insideRing = (ring: unknown): boolean => {
    if (!Array.isArray(ring) || ring.length < 3) return false;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a: unknown = ring[i], b: unknown = ring[j]; if (!Array.isArray(a) || !Array.isArray(b) || a.length !== 2 || b.length !== 2 || ![...a, ...b].every((n: unknown) => typeof n === 'number' && Number.isFinite(n))) return false; const [ax, ay] = a as [number, number]; const [bx, by] = b as [number, number]; if ((ay > north) !== (by > north) && east < (bx - ax) * (north - ay) / (by - ay) + ax) inside = !inside; }
    return inside;
  };
  const boundary = plan.boundaries.campusMapped;
  const parts: unknown[] = Array.isArray(boundary.polygonsMeters) ? boundary.polygonsMeters : [{ outer: boundary.pointsMeters, holes: [] }];
  const inside = parts.some((part) => record(part) && insideRing(part.outer) && (!Array.isArray(part.holes) || !part.holes.some(insideRing)));
  locationSnapshot = { campusId: activeCampusId, east, north, accuracyMeters: accuracy, timestamp, inside };
  if (inside) app.site?.showUserLocation?.(east, north, accuracy); else app.site?.clearUserLocation?.();
  platformControls?.update({ location: getLocationSnapshot() });
  controls.announce(inside ? `확인한 위치와 약 ${Math.round(accuracy)}m 정확도 범위를 일시 표시했습니다. 건물·실내 층·호실·통행 경로를 확정하지 않습니다.` : '확인한 위치가 현재 캠퍼스 안내 영역 밖입니다. 화면을 이동하지 않았습니다.');
}
function entityFor(id: string): PlatformEntity | undefined { return catalog.entities.find((entry) => entry.campusId === activeCampusId && entry.visibility === 'public' && !entry.sensitive && (entry.id === id || entry.legacyId === id || entry.legacyKey === id || entry.feature?.id === id)); }
function cameraState(value: unknown): value is CameraSnapshot {
  return record(value) && ['overview', 'top', 'free'].includes(String(value.view)) && ['alpha', 'beta', 'radius'].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key])) && (value.beta as number) >= 0.01 && (value.beta as number) <= Math.PI / 2 && Math.abs(value.alpha as number) < Math.PI * 100 && (value.radius as number) > 0 && (value.radius as number) < 10000 && ['target', 'freePosition', 'freeRotation'].every((key) => Array.isArray(value[key]) && value[key].length === 3 && value[key].every((n: unknown) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 100000));
}
function getState(): ApplicationState {
  const activeFloor = document.getElementById('buildingDetail')?.hidden ? null : document.querySelector<HTMLElement>('.floor-tab.is-active')?.dataset.floorTarget;
  const selected = publicSelectedId ? entityFor(publicSelectedId) : undefined;
  const currentFloor = activeFloor || floor;
  const floorEntity = catalog.entities.find((entry) => entry.campusId === activeCampusId && entry.kind === 'floor' && entry.owningBuildingId === (selected?.owningBuildingId || selected?.id) && entry.floorLabel === currentFloor);
  return { schemaVersion: 1, campusId: activeCampusId, datasetVersion: catalog.datasetVersion || catalog.contentVersion, contentVersion: catalog.contentVersion, assetsVersion: catalog.assetsVersion, releaseId, sharedStatus, refinement: {...refinement}, diagnostics: runtimeDiagnostics(), view, selectedId: publicSelectedId, layers: { ...layers }, floor: currentFloor, floorId: floorEntity?.id || null, quality, exaggeration, camera: controller()?.capture() || null };
}
function runtimeDiagnostics(): Record<string, unknown> {
  const scene = app?.scene;
  const diagnostics = loader?.getDiagnostics();
  return { meshCount: scene?.meshes.length || 0, drawCalls: instrumentation?.drawCallsCounter.current || 0, triangles: Math.round((scene?.getActiveIndices() || 0) / 3), fps: app?.engine?.getFps() || 0, measuredRenderMs: frameAverageMs, frameP95Ms, loadedDetails: diagnostics?.loaded || 0, lod: diagnostics?.variants || {}, residentBytes: diagnostics?.residentBytes || 0, resources: {textures: scene?.textures.length || 0,materials: scene?.materials.length || 0}, measurement: refinementRuntime?.getDiagnostics(), renderer: 'WebGL', timing: 'browser-frame-interval-and-cpu-render' };
}
function updateSafeArea(): void {
  const canvas = document.getElementById('renderCanvas'), panel = document.getElementById('siteControls') || document.querySelector('.site-controls');
  if (!canvas || !app?.engine) return;
  const rect = canvas.getBoundingClientRect(), bounds = panel?.getBoundingClientRect();
  const top = document.querySelector('.campus-title')?.getBoundingClientRect().bottom || 70;
  const insets=viewSafeArea({canvas:rect,panel:bounds,headerBottom:top,panelExpanded:panel?.querySelector('.site-panel-toggle')?.getAttribute('aria-expanded')==='true',renderWidth:app.engine.getRenderWidth(),renderHeight:app.engine.getRenderHeight()});
  const key=JSON.stringify(insets);if(key===safeAreaKey)return;
  safeAreaKey=key;
  controller()?.setSafeArea?.(insets,{preserveView:true});
}
function panCardinal(east:number,north:number):void {
  const camera=app?.scene?.activeCamera;if(!camera)return;
  const inverse=BABYLON.Matrix.Invert(camera.getViewMatrix()),right=BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(1,0,0),inverse).normalize(),forward=BABYLON.Vector3.TransformNormal(new BABYLON.Vector3(0,0,-1),inverse);forward.y=0;forward.normalize();
  const desired=new BABYLON.Vector3(east,0,-north);controller()?.pan?.(BABYLON.Vector3.Dot(desired,right),BABYLON.Vector3.Dot(desired,forward));
}
function updateVisibility(): void {
  const camera=app?.scene?.activeCamera,site=app?.site,engine=app?.engine;
  if (offlineCatalogPending || !loader || !camera || !site || !engine || view==='text' || view==='2d') return;
  const low=quality==='low'||quality==='auto'&&automaticLow;
  const currentLoader=loader;
  const visible=modelsForCampus(activeManifest,activeCampusId,plan.features.buildings).flatMap(entry=>{
    const feature=buildingById.get(entry.buildingId||entry.id)||buildingByLegacy.get(entry.legacyId||entry.id), bounds=feature&&site.featureBounds?.(feature.id);
    if (!feature || !bounds) return [];
    const selected=selectedId===feature.id;
    const projected=site.projectFeature?.(feature.id,{occlusion:false});
    const distanceMeters=BABYLON.Vector3.Distance(camera.position,new BABYLON.Vector3(...bounds.center as [number,number,number]))*10;
    const span=Math.max(...bounds.dimensionsMeters)/10;
    const screenCoverage=Math.min(1,view==='top'?span/Math.max(controller()?.capture().radius||100,1):span/Math.max(distanceMeters/10,1));
    const shown=selected||!!projected?.inViewport;
    if(!shown && currentLoader.models.has(entry.id))currentLoader.release(entry.id);
    return [{id:entry.id,distanceMeters,screenCoverage:low?Math.min(screenCoverage,.02):screenCoverage,visible:shown,selected}];
  });
  void currentLoader.updateVisibility(visible).catch(()=>controls.announce('일부 상세 모델을 불러오지 못했습니다. 부지와 건물 외곽 안내는 계속 사용할 수 있습니다.'));
}
function measurementKind(value: unknown): value is MeasurementKind { return ['planar-distance','path-distance','height-difference','area'].includes(String(value)); }
function measurePoints(kind: MeasurementKind, points: unknown): void {
  if (!Array.isArray(points)||points.length>256||!points.every((p:unknown)=>Array.isArray(p)&&[2,3].includes(p.length)&&p.every((v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<100000))) throw new Error('유효한 미터 좌표를 입력해 주세요.');
  const result=refinementRuntime?.setMeasurement(kind,points as PointMeters[]);
  platformControls?.update({measureResult:result?{...result,version:catalog.contentVersion}:null});
}
function compareCatalog(payload: Record<string,unknown>): void {
  const next=payload.clear?comparisonSnapshot?.catalog:payload.catalog;
  if (!next || !window.CampusPlatform.validateCatalog(next).valid) throw new Error('비교 자료를 검증하지 못했습니다.');
  const snapshot=controller()?.capture(),savedView=view;
  if(!comparisonSnapshot)comparisonSnapshot={catalog,manifest:activeManifest,releaseId};
  const retained=comparisonSnapshot;
  catalog=window.CampusPlatform.publicCatalog(next as PlatformCatalog);
  activeManifest=payload.clear?retained.manifest:catalog.assetManifest||manifest;
  validateModelManifest(activeManifest);releaseId=payload.clear?retained.releaseId:null;
  sharedStatus=payload.clear?'':'가져온 비교 자료입니다. 학교의 승인된 공개판 여부는 별도로 확인해야 합니다.';
  switchCampus(catalog.campuses.some(c=>c.id===activeCampusId)?activeCampusId:catalog.activeCampusId,true);
  setView(savedView);if(snapshot)controller()?.restore(snapshot);
  if(payload.clear)comparisonSnapshot=null;
}
function useSavedApprovedCatalog():void {
  const saved=offlineBundle;
  if(applicationClosed||!saved||!record(saved.catalog)||!window.CampusPlatform.validateCatalog(saved.catalog).valid)return;
  const state=getState();catalog=window.CampusPlatform.publicCatalog(saved.catalog as unknown as PlatformCatalog);
  const registered=catalog.assetManifest||manifest;
  activeManifest=Array.isArray(saved.availableModelIds)?{...registered,models:registered.models.filter(model=>(saved.availableModelIds as unknown[]).includes(model.id))}:registered;
  validateModelManifest(activeManifest);releaseId=typeof saved.releaseId==='string'?saved.releaseId:null;
  if(Array.isArray(saved.mediaRecords))mediaRecords=saved.mediaRecords;
  sharedStatus='저장된 승인 공개판입니다. 운영 정보는 저장 당시 기준입니다.';
  switchCampus(catalog.activeCampusId);applyState({...state,campusId:catalog.activeCampusId,camera:null});
}
async function offlineRelease(payload: Record<string,unknown>): Promise<void> {
  try{
    const api:unknown=Reflect.get(window,'CampusOffline');
    if(!record(api))throw new Error('이 브라우저에서 오프라인 저장을 사용할 수 없습니다.');
    const endpoint=new URL('/api/v1/bundle',location.href);if(releaseId)endpoint.searchParams.set('release',releaseId);
    const response=await fetch(endpoint,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('승인 공개판을 가져오지 못했습니다. 서버 연결을 확인해 주세요.');
    const value:unknown=await response.json(),bundle=record(value)?value.data:null;
    if(!record(bundle))throw new Error('공개 묶음 형식을 확인하지 못했습니다.');
    const method=payload.command==='inspect'?'inspect':'download',handler=api[method];
    if(typeof handler!=='function')throw new Error('오프라인 저장 기능을 준비한 뒤 시도해 주세요.');
    const result:unknown=await handler({bundle,scope:payload.scope,selectedId:publicSelectedId});
    if(record(result)){if(method==='download')offlineBundle=result;const warning=typeof result.warning==='string'?result.warning:result.cleanupPending?'이전 자료 정리가 남아 있습니다.':'';platformControls?.update({offlineBundle,offlineStatus:method==='inspect'?`저장 예상 용량 ${Math.ceil(Number(result.bytes)/1024)} KB · ${result.assets}개 파일 · ${result.scope}`:`승인 공개판 ${result.version} 저장 완료 · ${result.scope} 범위. 운영 정보는 저장 당시 기준입니다. ${warning}`});}
  }catch(error){platformControls?.update({offlineStatus:error instanceof Error?error.message:'오프라인 저장을 완료하지 못했습니다.'});}
}
async function requestAssistant(payload: Record<string,unknown>): Promise<void> {
  try{
    if(typeof payload.query!=='string'||payload.query.length>500)throw new Error('500자 이하로 질문을 입력해 주세요.');
    const response=await fetch('/api/v1/assistant',{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:payload.query,campusId:activeCampusId,contentVersion:catalog.contentVersion,purpose:refinement.purpose}),signal:AbortSignal.timeout(10000)});
    const value:unknown=await response.json();if(!response.ok||!record(value)||!record(value.data))throw new Error('현재 등록된 AI 안내를 사용할 수 없습니다. 자료 검색 결과를 이용해 주세요.');
    const data=value.data;
    const records=Array.isArray(data.entities)?data.entities:[];
    platformControls?.update({assistantStatus:records.map((item:unknown)=>record(item)?`${item.name||item.id}: ${item.purpose||item.description||'등록된 공간입니다.'}`:'').filter(Boolean).join(' / ')||'질문과 연결되는 승인 자료가 없습니다. 등록 공간 검색을 이용해 주세요.'});
  }catch(error){platformControls?.update({assistantStatus:error instanceof Error?error.message:'근거 안내를 완료하지 못했습니다. 등록 검색 결과를 이용해 주세요.'});}
}
function persistState(push = false): void {
  if (applyingState) return;
  const state = getState();
  try {
    localStorage.setItem('hanshin-campus-view-v1', JSON.stringify(state));
    if (location.protocol !== 'file:') {
      const url = new URL(location.href);
      const selected = state.selectedId ? entityFor(state.selectedId) : undefined;
      const ownerId = selected?.owningBuildingId || selected?.id;
      const sharedFloor = catalog.entities.find((entry) => entry.kind === 'floor' && entry.owningBuildingId === ownerId && (entry.floorLabel === state.floor || entry.id === state.floor));
      url.search = window.CampusPlatform.serializeState({ version: 1, campusId: state.campusId, contentVersion: catalog.contentVersion, assetsVersion: catalog.assetsVersion, ...(releaseId ? {releaseId} : {}), entityId: state.selectedId, view: state.view, layers: Object.keys(state.layers).filter((key) => state.layers[key] && catalog.layers.some((layer) => layer.id === key)), floorId: sharedFloor?.id || null, time: null });
      url.hash = '';
      if (push) history.pushState({ campusView: state }, '', url); else history.replaceState({ campusView: state }, '', url);
    }
  } catch (error) { console.info('View state storage unavailable', error instanceof Error ? error.message : 'Unavailable'); }
}
function setQuality(next: QualityMode): void {
  quality = next;
  if (next !== 'auto') automaticLow = false;
  applyQuality();
  platformControls?.update({ quality }); updateUi();
}
function applyQuality(): void {
  const low = quality === 'low' || (quality === 'auto' && automaticLow);
  app.engine?.setHardwareScalingLevel(low ? Math.max(1.5, window.devicePixelRatio || 1) : 1);
  catalog.entities.filter((entity) => entity.campusId === activeCampusId && typeof entity.feature?.id === 'string').forEach((entity) => app.site?.setFeatureVisible?.(String(entity.feature?.id), entity.status === lifecycle));
  loader?.models.forEach((model, entryId) => {
    const id: unknown = model.root.metadata?.featureId;
    const feature = typeof id === 'string' ? buildingById.get(id) : undefined;
    if (!feature) return;
    const publicEntity = entityFor(feature.id);
    const visible = !publicEntity || publicEntity.status === lifecycle;
    if (detailVisibility.get(entryId) !== visible) { detailVisibility.set(entryId, visible); app.site?.setBuildingDetailVisible?.(feature.id, visible); }
  });
  app.site?.setLayerVisible('trees', layers.trees && !low);
}
function applyState(value: unknown): boolean {
  if (record(value) && value.version === 1) {
    const parsed = window.CampusPlatform.parseState(value, catalog);
    if (!parsed.valid || !parsed.state) return false;
    const state = parsed.state;
    return applyState({ ...getState(), campusId: state.campusId, selectedId: state.entityId, view: state.view, layers: Object.fromEntries(Object.keys(layers).map((key) => [key, state.layers.includes(key)])), floor: state.floorId ? catalog.entities.find((entity) => entity.id === state.floorId && entity.campusId === state.campusId)?.floorLabel || null : null, floorId: state.floorId, camera: null });
  }
  if (!record(value) || value.schemaVersion !== 1 || typeof value.campusId !== 'string' || !catalog.campuses.some((campus) => campus.id === value.campusId) || !['overview', 'top', 'free', 'text', '2d'].includes(String(value.view))) return false;
  applyingState = true;
  try {
    if (value.campusId !== activeCampusId && !switchCampus(value.campusId)) return false;
    if (record(value.layers)) for (const key of Object.keys(layers) as (keyof typeof layers)[]) if (typeof value.layers[key] === 'boolean') { layers[key] = value.layers[key]; if (key !== 'labels') app.site?.setLayerVisible(key, layers[key]); }
    if (typeof value.selectedId === 'string' && entityFor(value.selectedId)) selectBuilding(value.selectedId); else { selectedId = null; publicSelectedId = null; }
    floor = typeof value.floor === 'string' && value.floor.length < 160 ? value.floor : null;
    if (typeof value.exaggeration === 'number' && value.exaggeration >= 1 && value.exaggeration <= 2 && Number.isInteger(value.exaggeration * 4) && value.exaggeration !== exaggeration) { exaggeration = value.exaggeration; app.site?.setVerticalExaggeration?.(exaggeration); }
    if (value.quality === 'auto' || value.quality === 'low' || value.quality === 'high') setQuality(value.quality);
    if(record(value.refinement)){
      const saved=value.refinement;
      if(typeof saved.reducedMotion==='boolean')refinement.reducedMotion=saved.reducedMotion;
      if(['teleport','smooth'].includes(String(saved.vrMovement)))refinement.vrMovement=saved.vrMovement;
      if(['snap','smooth'].includes(String(saved.vrTurn)))refinement.vrTurn=saved.vrTurn;
      if(typeof saved.eyeHeightMeters==='number'&&saved.eyeHeightMeters>=.5&&saved.eyeHeightMeters<=2.3)refinement.eyeHeightMeters=saved.eyeHeightMeters;
      controller()?.setObservationSettings?.({eyeHeightMeters:Number(refinement.eyeHeightMeters)});
    }
    setView(value.view as PlatformView);
    if (value.datasetVersion === (catalog.datasetVersion || catalog.contentVersion) && cameraState(value.camera)) controller()?.restore(value.camera);
    updateUi(); return true;
  } finally { applyingState = false; }
}
function setView(next: PlatformView): void {
  view = next;
  const canvas = document.getElementById('renderCanvas');
  if (canvas) canvas.hidden = next === 'text' || next === '2d';
  const labelLayer = document.getElementById('mapLabels'); if (labelLayer) labelLayer.hidden = next === 'text' || next === '2d';
  if (next !== 'text' && next !== '2d') controller()?.setView(next);
  platformControls?.update({ view: next }); updateUi();
}
function switchCampus(id: string, preserveControls = false): boolean {
  const campus = catalog.campuses.find((entry) => entry.id === id);
  if (!campus?.visualizationPlan) { controls.announce('이 캠퍼스의 검증된 표시 자료가 없습니다.'); return false; }
  try { validatePlan(campus.visualizationPlan); } catch { controls.announce('캠퍼스 자료를 검증하지 못했습니다.'); return false; }
  activeCampusId = id; catalog.activeCampusId = id; plan = campus.visualizationPlan; activeTerrain = campus.terrain;
  buildingById.clear(); buildingByLegacy.clear();
  plan.features.buildings.forEach((feature) => { buildingById.set(feature.id, feature); if (feature.legacyKey) buildingByLegacy.set(feature.legacyKey, feature); });
  selectedId = null; publicSelectedId = null; app.selectedId = null; floor = null; fallback?.dispose?.(); fallback?.hide(); fallback = null;
  const title = document.querySelector('.campus-title strong'); if (title) title.textContent = campus.name;
  const canvas = document.getElementById('renderCanvas'); if (canvas) canvas.setAttribute('aria-label', `${campus.name} 전체 부지 3D 조감도`);
  if(!preserveControls)installControls();
  boot(); platformControls?.update({ catalog, campusId: id, selectedId: null }); return true;
}
function updateUi(): void {
  const camera = controller();
  const northRadians = camera?.getNorthRotation() || 0;
  const rawScale = camera?.getScaleBar();
  controls.update({ view, layers, exaggeration, selectedId, northDegrees: northRadians * 180 / Math.PI, scale: rawScale?.visible === false ? { meters: 0, pixels: 0 } : rawScale || { meters: 0, pixels: 0 }, status: app?.ready ? 'ready' : 'error' });
  platformControls?.update({ catalog, view, layers, selectedId: publicSelectedId, quality, modelStates: loader?.getDiagnostics().states || {}, refinement: {...refinement}, diagnostics: runtimeDiagnostics(), contentVersion: catalog.contentVersion, assetsVersion: catalog.assetsVersion, releaseId, sharedStatus, boundaryLegend: app?.site?.getBoundaryLegend?.(), mediaRecords, offlineBundle, arAnchors:arAnchors.filter(anchor=>anchor.campusId===activeCampusId), arLandmarks:xrStatus?.capturedIds, arCalibrationReport:xrStatus?.report });
}
function selectBuilding(id: string): void {
  const entity = entityFor(id);
  const owner = entity?.owningBuildingId ? entityFor(entity.owningBuildingId) : entity;
  const feature = buildingByLegacy.get(owner?.legacyKey || owner?.legacyId || '') || buildingById.get(typeof owner?.feature?.id === 'string' ? owner.feature.id : '') || buildingById.get(id) || buildingByLegacy.get(id);
  publicSelectedId = entity?.id || catalog.entities.find((entry) => entry.kind === 'building' && entry.feature?.id === feature?.id)?.id || null;
  if (entity?.kind === 'floor' || entity?.kind === 'space') floor = entity.floorLabel || entity.floorId && entityFor(entity.floorId)?.floorLabel || null;
  else floor = null;
  if (!feature) {
    if (entity?.position && app.site) { const orbit = controller()?.orbit; if (orbit instanceof BABYLON.ArcRotateCamera) { const x = entity.position.east / 10; const z = -entity.position.north / 10; orbit.setTarget(new BABYLON.Vector3(x, app.site.terrainHeightAt(x, z), z), false, true, true); orbit.radius = 12; } }
    updateUi(); persistState(true); return;
  }
  selectedId = feature.id;
  app.selectedId = selectedId;
  if (view !== 'text' && view !== '2d' && view !== 'overview') setView('overview');
  updateSafeArea();
  controller()?.focusBuilding(featureKey(feature),{durationMs:280,reducedMotion:refinement.reducedMotion===true});
  app.site?.setInteractionState?.({selected:feature.id});
  controls.selectBuilding(feature.id);
  updateVisibility();
  applyQuality();
  if (view !== 'text' && view !== '2d' && (entity?.kind === 'floor' || entity?.kind === 'space')) openInterior(entity.id);
  updateUi();
  persistState(true);
}
function openInterior(id: string): void {
  const entity = entityFor(id);
  const owner = entity?.owningBuildingId ? entityFor(entity.owningBuildingId) : entity;
  const feature = buildingById.get(id) || buildingByLegacy.get(id) || buildingByLegacy.get(owner?.legacyKey || owner?.legacyId || '') || buildingById.get(typeof owner?.feature?.id === 'string' ? owner.feature.id : '');
  const key = feature ? featureKey(feature) : id;
  if (!feature || !interiorFor(key)) { controls.announce('이 시설은 확인된 내부도가 없습니다. 외부 위치와 자료 정보를 확인할 수 있습니다.'); return; }
  const requestedFloor = floor;
  if (hud) hud.openInterior(key); else fallback?.openInterior(key);
  if (requestedFloor) window.setTimeout(() => { const tab = [...document.querySelectorAll<HTMLButtonElement>('.floor-tab')].find((entry) => entry.dataset.floorTarget === requestedFloor || entry.textContent?.trim().startsWith(requestedFloor)); tab?.click(); }, 0);
}

async function exportView(exportMode: string): Promise<void> {
  if (view === 'text' || view === '2d') { controls.announce('이미지는 전체 조감도 또는 위에서 보기에서 저장해 주세요. 2D 안내는 인쇄 기능으로 저장할 수 있습니다.'); return; }
  if (!app.ready || !app.engine || !app.scene) { controls.announce('3D 화면이 준비된 뒤 이미지를 저장할 수 있습니다.'); return; }
  const camera = controller();
  const snapshot = camera?.capture();
  const currentView = view;
  try {
    if (exportMode === 'top' || exportMode === 'overview') { camera?.setView(exportMode); view = exportMode; }
    app.scene.render();
    const source = document.getElementById('renderCanvas');
    if (!(source instanceof HTMLCanvasElement)) throw new Error('Canvas unavailable');
    const image = document.createElement('canvas');
    const activeCamera = app.scene.activeCamera;
    if (!activeCamera) throw new Error('Camera unavailable');
    const viewport = activeCamera.viewport.toGlobal(source.width, source.height);
    const crop = { x: Math.round(viewport.x), y: Math.round(source.height - viewport.y - viewport.height), width: Math.round(viewport.width), height: Math.round(viewport.height) };
    image.width = crop.width;
    const fontSize = Math.max(12, Math.min(17, image.width / 36));
    const footerLines: string[] = [];
    const context = image.getContext('2d');
    if (!context) throw new Error('Image context unavailable');
    context.font = `${fontSize}px Arial, Malgun Gothic, sans-serif`;
    const campusName = catalog.campuses.find((campus) => campus.id === activeCampusId)?.name || String(plan.metadata.title || '캠퍼스');
    const hasOsm = plan.sources.some((source) => record(source) && /openstreetmap|osm/i.test(`${source.id || ''} ${source.url || ''}`));
    const sourceCredit = hasOsm ? '© OpenStreetMap contributors · ODbL · https://www.openstreetmap.org/copyright' : `자료 출처: ${plan.sources.flatMap((source) => record(source) && typeof source.title === 'string' ? [source.title] : []).slice(0, 3).join(' · ') || '등록 출처 정보 확인 필요'}`;
    for (const paragraph of [`${campusName} · 캠퍼스 안내 영역 · 법적 소유 경계 아님`, `자료 ${catalog.contentVersion} · 모델 ${catalog.assetsVersion} · ${releaseId||'패키지 자료'} · 기준일 ${String(plan.metadata.referenceDate || '미확인')}`, `자료 확인 수준은 항목별 등록 출처 기준 · 미확인 외관·높이·내부 평면은 개념 모델`, sourceCredit]) {
      let line = '';
      for (const character of paragraph) {
        if (line && context.measureText(line + character).width > image.width - 32) { footerLines.push(line); line = ''; }
        line += character;
      }
      footerLines.push(line);
    }
    image.height = crop.height + footerLines.length * (fontSize + 8) + 24;
    context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    updateLabels();
    const canvasRect = source.getBoundingClientRect();
    context.font = `bold ${11 * source.width / canvasRect.width}px Arial, Malgun Gothic, sans-serif`;
    for (const label of document.querySelectorAll<HTMLElement>('.map-label')) {
      if (label.hidden || !layers.labels) continue;
      const bounds = label.getBoundingClientRect();
      const x = (bounds.left - canvasRect.left) * source.width / canvasRect.width - crop.x;
      const y = (bounds.top - canvasRect.top) * source.height / canvasRect.height - crop.y;
      const name = label.textContent || '';
      const style = window.getComputedStyle(label);
      const pixelRatio = source.width / canvasRect.width;
      const labelFontSize = parseFloat(style.fontSize) * pixelRatio;
      context.font = `${style.fontWeight} ${labelFontSize}px ${style.fontFamily}`;
      const width = bounds.width * pixelRatio; const height = bounds.height * source.height / canvasRect.height;
      if (x < 0 || y < 0 || x + width > crop.width || y + height > crop.height) continue;
      context.fillStyle = style.backgroundColor; context.fillRect(x, y, width, height);
      context.fillStyle = style.color; context.fillText(name, x + 7 * pixelRatio, y + 5 * pixelRatio + labelFontSize * 0.95);
    }
    context.save(); context.translate(30, 35);
    context.fillStyle = '#fff8dc'; context.fillRect(-22, -26, 44, 64);
    context.fillStyle = '#173625'; context.font = 'bold 13px Arial'; context.fillText('N', -5, -9);
    context.rotate(camera?.getNorthRotation() || 0);
    context.beginPath(); context.moveTo(0, -3); context.lineTo(-7, 22); context.lineTo(0, 17); context.lineTo(7, 22); context.closePath(); context.fill(); context.restore();
    const scale = camera?.getScaleBar();
    if (scale?.visible && typeof scale.pixels === 'number' && typeof scale.meters === 'number') {
      const bar = Math.min(scale.pixels, crop.width - 40);
      context.fillStyle = '#fff8dc'; context.fillRect(12, crop.height - 48, bar + 16, 38);
      context.strokeStyle = '#173625'; context.lineWidth = 2;
      context.beginPath(); context.moveTo(20, crop.height - 23); context.lineTo(20 + bar, crop.height - 23); context.stroke();
      context.fillStyle = '#173625'; context.font = 'bold 12px Arial'; context.fillText(`${Math.round(scale.meters * bar / scale.pixels)}m`, 20, crop.height - 30);
    }
    context.fillStyle = '#173625'; context.fillRect(0, crop.height, image.width, image.height - crop.height);
    context.fillStyle = '#fff8dc'; context.font = `${fontSize}px Arial, Malgun Gothic, sans-serif`;
    footerLines.forEach((line, index) => context.fillText(line, 16, crop.height + 20 + index * (fontSize + 8)));
    const blob = await new Promise<Blob>((resolve, reject) => image.toBlob((result) => result ? resolve(result) : reject(new Error('Image generation failed')), 'image/png'));
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `hanshin-campus-${exportMode}.png`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    controls.announce('현재 조감도 이미지가 저장되었습니다. 이미지 하단에 자료와 경계 기준을 포함했습니다.');
    controls.update({ exportStatus: '이미지를 저장했습니다. 자료·경계 기준을 이미지 하단에 포함했습니다.' });
  } catch (error) {
    console.error('Campus export failed', error instanceof Error ? error.message : 'Unknown export error');
    controls.announce('이미지를 저장하지 못했습니다. 브라우저에서 다시 시도해 주세요.');
    controls.update({ exportStatus: '이미지 저장에 실패했습니다. 다시 시도해 주세요.' });
  } finally {
    if (snapshot) camera?.restore(snapshot);
    view = currentView; updateUi();
  }
}

function onAction(action: string, payload: Record<string, unknown> = {}): void {
  const camera = controller();
  switch (action) {
    case 'refinement-purpose':
      if(['visitor','student','facilities'].includes(String(payload.purpose))){refinement.purpose=payload.purpose;const enabled=Array.isArray(payload.layers)?payload.layers:[];for(const layer of catalog.layers){layers[layer.id]=enabled.includes(layer.id);app.site?.setLayerVisible(layer.id,layers[layer.id]);}layers.labels=true;}
      break;
    case 'refinement-camera': {
      camera?.cancelTransition?.();
      const commands: Record<string,()=>void>={'rotate-left':()=>camera?.rotate(-1),'rotate-right':()=>camera?.rotate(1),'zoom-in':()=>camera?.zoom(1),'zoom-out':()=>camera?.zoom(-1),'move-north':()=>panCardinal(0,1),'move-south':()=>panCardinal(0,-1),'move-west':()=>panCardinal(-1,0),'move-east':()=>panCardinal(1,0)};
      commands[String(payload.command)]?.(); break;
    }
    case 'refinement-preferences':
      if(typeof payload.reducedMotion==='boolean')refinement.reducedMotion=payload.reducedMotion;
      if(['teleport','smooth'].includes(String(payload.vrMovement)))refinement.vrMovement=payload.vrMovement;
      if(['snap','smooth'].includes(String(payload.vrTurn)))refinement.vrTurn=payload.vrTurn;
      if(typeof payload.eyeHeightMeters==='number'&&payload.eyeHeightMeters>=.5&&payload.eyeHeightMeters<=2.3)refinement.eyeHeightMeters=payload.eyeHeightMeters;
      camera?.setObservationSettings?.({eyeHeightMeters:Number(refinement.eyeHeightMeters)});
      document.documentElement.classList.toggle('reduced-motion',refinement.reducedMotion===true);break;
    case 'refinement-lighting':
      if(payload.lighting==='guide'||payload.lighting==='evening'||payload.lighting==='day')refinementRuntime?.setLighting(payload.lighting==='day'?'observe':payload.lighting);break;
    case 'refinement-floor':
      if(typeof payload.floorId==='string'&&['exterior','cut','isolate','explode'].includes(String(payload.mode))){const report=refinementRuntime?.setFloorView(payload.floorId,payload.mode as 'exterior'|'cut'|'isolate'|'explode');platformControls?.update({floorStatus:report?.reason||'3D 장면을 준비한 뒤 시도해 주세요.'});}break;
    case 'refinement-theme':
      if(['none','events','construction','access','hours','source-confidence','lifecycle','category'].includes(String(payload.theme))){const report=refinementRuntime?.setTheme(payload.theme as 'none'|'events'|'construction'|'access'|'hours'|'source-confidence'|'lifecycle'|'category');platformControls?.update({refinementStatus:report?`${report.items.length}개 등록 위치 표식 · ${report.unavailable}개 위치 미확인. ${report.note}`:'장면이 준비되지 않았습니다.'});}break;
    case 'refinement-measure':
      try{
        if(payload.mode==='clear'){measurementMode=null;measurementPoints=[];refinementRuntime?.clearMeasurement();}
        else if(payload.mode==='outline'&&typeof payload.entityId==='string') {const entity=entityFor(payload.entityId);if(entity?.geometry){const result=refinementRuntime?.setOutlineMeasurement(entity.geometry as SpatialGeometry);platformControls?.update({measureResult:result?{...result,version:catalog.contentVersion}:null});}}
        else if(measurementKind(payload.mode)){if(payload.pick===true){if(exaggeration!==1&&['path-distance','height-difference'].includes(payload.mode))throw new Error('높이가 포함된 장면 측정 전에는 지형 강조를 1배로 복원해 주세요.');measurementMode=payload.mode;measurementPoints=[];}else{measurementMode=null;measurePoints(payload.mode,payload.points);}}
      }catch(error){platformControls?.update({refinementStatus:error instanceof Error?error.message:'측정 좌표를 확인해 주세요.'});}hud?.setPickingEnabled?.(!measurementMode);break;
    case 'refinement-compare':try{compareCatalog(payload);}catch(error){controls.announce(error instanceof Error?error.message:'자료판 비교를 완료하지 못했습니다.');}break;
    case 'refinement-offline':void offlineRelease(payload);break;
    case 'refinement-assistant':void requestAssistant(payload);break;
    case 'search-highlight':if(Array.isArray(payload.entityIds)){const ids=payload.entityIds.flatMap((id:unknown)=>{if(typeof id!=='string')return [];const entity=entityFor(id),owner=entity?.owningBuildingId?entityFor(entity.owningBuildingId):entity;return typeof owner?.feature?.id==='string'?[owner.feature.id]:[];});app?.site?.setInteractionState?.({searchIds:ids});}return;
    case 'refinement-ar':
      if(payload.command==='exit')void xrRuntime?.exit();
      else if(payload.command==='start'){const anchor=arAnchors.find(item=>item.id===payload.anchorId&&item.campusId===activeCampusId);if(anchor)void xrRuntime?.startAR(anchor).catch(error=>platformControls?.update({xrStatus:error instanceof Error?error.message:'AR 세션을 시작하지 못했습니다.'}));else platformControls?.update({xrStatus:'검수된 현장 기준점 자료가 등록되지 않았습니다.'});}
      else if(payload.command==='capture'&&typeof payload.landmarkId==='string'){try{xrRuntime?.capture(payload.landmarkId);}catch(error){platformControls?.update({xrStatus:error instanceof Error?error.message:'현장 기준점을 캡처하지 못했습니다.'});}}
      else if(payload.command==='review'){try{xrRuntime?.review();}catch(error){platformControls?.update({xrStatus:error instanceof Error?error.message:'현장 정합을 검증하지 못했습니다.'});}}break;
    case 'view':
      if (payload.view === 'overview' || payload.view === 'top' || payload.view === 'free' || payload.view === 'text' || payload.view === '2d') setView(payload.view);
      break;
    case 'reset': setView('overview'); camera?.reset(); break;
    case 'resize': camera?.resize(); updateSafeArea(); break;
    case 'zoom': if (typeof payload.direction === 'number') camera?.zoom(payload.direction); break;
    case 'rotate': if (typeof payload.direction === 'number') camera?.rotate(payload.direction); break;
    case 'toggle':
      if (typeof payload.layer === 'string' && payload.layer in layers && typeof payload.enabled === 'boolean') {
        const layer = payload.layer as keyof typeof layers;
        layers[layer] = payload.enabled;
        app.site?.setLayerVisible(layer, payload.enabled && (layer !== 'trees' || !(quality === 'low' || quality === 'auto' && automaticLow)));
      }
      break;
    case 'exaggeration':
      if (typeof payload.factor === 'number' && Number.isFinite(payload.factor) && payload.factor >= 1 && payload.factor <= 2 && Number.isInteger(payload.factor * 4)) {
        exaggeration = payload.factor;
        const change = app.site?.setVerticalExaggeration;
        if (typeof change === 'function') change(exaggeration);
      }
      break;
    case 'select': if (typeof payload.id === 'string') selectBuilding(payload.id); else if (payload.id === null) { selectedId = null; publicSelectedId = null; app.selectedId = null; app.site?.setInteractionState?.({selected:null}); controls.selectBuilding(''); } break;
    case 'interior': if (typeof payload.id === 'string') openInterior(payload.id); break;
    case 'retry': boot(); break;
    case 'export': void exportView(typeof payload.view === 'string' ? payload.view : view); break;
    case 'quality': if (payload.quality === 'auto' || payload.quality === 'low' || payload.quality === 'high') setQuality(payload.quality); break;
    case 'model-retry': if (typeof payload.id === 'string') { const entity = entityFor(payload.id); const feature = buildingByLegacy.get(entity?.legacyKey || entity?.legacyId || '') || buildingById.get(typeof entity?.feature?.id === 'string' ? entity.feature.id : payload.id); const registered = feature && modelsForCampus(activeManifest, activeCampusId, [feature])[0]; if (registered) void loader?.retry(registered.id); } break;
    case 'tour-capture': tourSnapshot = getState(); break;
    case 'tour-focus': if (typeof payload.id === 'string') selectBuilding(payload.id); break;
    case 'tour-restore': if (tourSnapshot) { applyState(tourSnapshot); tourSnapshot = null; } else if (cameraState(payload.snapshot)) { camera?.restore(payload.snapshot); view = payload.snapshot.view as ViewMode; } else applyState(payload.snapshot); break;
    case 'campus': if (typeof payload.campusId === 'string') switchCampus(payload.campusId); break;
    case 'switchCatalog': {
      const result = window.CampusPlatform.validateCatalog(payload.catalog);
      if (result.valid && record(payload.catalog)) { catalog = window.CampusPlatform.publicCatalog(payload.catalog as unknown as PlatformCatalog); activeManifest=catalog.assetManifest||manifest;validateModelManifest(activeManifest);releaseId=null;switchCampus(catalog.activeCampusId); }
      else controls.announce(`자료를 적용하지 못했습니다: ${result.errors.slice(0, 2).join(', ')}`);
      break;
    }
    case 'layer': if (typeof payload.layer === 'string' && typeof payload.enabled === 'boolean' && catalog.layers.some((layer) => layer.id === payload.layer)) { layers[payload.layer] = payload.enabled; app.site?.setLayerVisible(payload.layer, payload.enabled); applyQuality(); } break;
    case 'history': if (payload.status === 'current' || payload.status === 'historic' || payload.status === 'proposed') { lifecycle = payload.status; applyQuality(); } break;
    case 'location': showLocation(payload); break;
    case 'route': {
      routeMesh?.dispose(); routeMesh = null;
      const result = payload.result;
      if (!app.scene || !app.site || !record(result)) break;
      const points = Array.isArray(result.pointsMeters) ? result.pointsMeters : Array.isArray(result.points) ? result.points : Array.isArray(result.nodes) ? result.nodes.flatMap((node: unknown) => record(node) && record(node.position) ? [[node.position.east, node.position.north]] : []) : [];
      const vectors = points.flatMap((point: unknown) => Array.isArray(point) && point.length >= 2 && typeof point[0] === 'number' && typeof point[1] === 'number' && Number.isFinite(point[0]) && Number.isFinite(point[1]) ? [new BABYLON.Vector3(point[0] / 10, app.site!.terrainHeightAt(point[0] / 10, -point[1] / 10) + 0.12, -point[1] / 10)] : []);
      if (vectors.length >= 2) { routeMesh = BABYLON.MeshBuilder.CreateLines('platform-route-preview', { points: vectors }, app.scene); routeMesh.color = BABYLON.Color3.FromHexString('#b55e30'); routeMesh.isPickable = false; }
      const routeIds=Array.isArray(result.nodes)?result.nodes.flatMap((node:unknown)=>record(node)&&typeof node.id==='string'&&entityFor(node.id)?.feature?.id?[String(entityFor(node.id)?.feature?.id)]:[]):[];app.site.setInteractionState?.({routeIds});
      break;
    }
    case 'xr': {
      if(xrRuntime)void xrRuntime.startVR().catch(error=>platformControls?.update({xrStatus:error instanceof Error?error.message:'VR 세션을 시작하지 못했습니다.'}));
      else controls.announce('3D 화면이 준비된 뒤 XR을 사용할 수 있습니다.');
      break;
    }
  }
  updateUi();
  persistState(action === 'view' || action === 'campus');
}

function installControls(): void {
  platformControls?.destroy(); platformControls = null;
  controls = window.CampusSiteControls.initialize({ onAction, buildings: plan.features.buildings.map((building) => ({ ...building, hasInterior: Boolean(interiorFor(featureKey(building))), description: building.role || '지도와 공개 안내 자료에 기반한 배치', entrance: '출입구 위치·이용 가능 여부는 자료 기준을 확인해 주세요.' })), evidence: plan.evidence || plan });
  if (app) app.controls = controls;
  platformControls = window.CampusPlatformControls.initialize({ catalog, onAction, getState, apiBase: '/api/v1' });
}
installControls();
app = window.CampusApp = { scene: null, engine: null, site: null, controls, ready: false, selectedId, models: new Map(), selectBuilding, exportView, getState, applyState, getLocationSnapshot, retryModel: (id) => { const entity = entityFor(id); const feature = buildingByLegacy.get(entity?.legacyKey || entity?.legacyId || '') || buildingById.get(typeof entity?.feature?.id === 'string' ? entity.feature.id : id); const entry = feature && modelsForCampus(activeManifest, activeCampusId, [feature])[0]; return entry ? loader?.retry(entry.id) || Promise.resolve(null) : Promise.resolve(null); }, setQuality, diagnostics: () => ({ ready: app.ready, view, layers: { ...layers }, selectedId, exaggeration, quality, effectiveQuality: quality === 'low' || quality === 'auto' && automaticLow ? 'low' : 'high', campusId: activeCampusId, catalogVersion: catalog.contentVersion, assetsVersion: catalog.assetsVersion, releaseId, modelLoader: loader?.getDiagnostics(), ...runtimeDiagnostics(), ...app.site?.getDiagnostics() }) };
const offline: unknown = Reflect.get(window, 'CampusOffline');
offlineCatalogPending = !navigator.onLine && record(offline) && typeof offline.initialize === 'function';
  if (record(offline) && typeof offline.initialize === 'function') void Promise.resolve(offline.initialize()).then(async () => {
    if(applicationClosed)return;
    platformControls?.update({offlineReady:true});
    if(typeof offline.readCatalog==='function'){
      const saved:unknown=await offline.readCatalog();
      if(record(saved)&&record(saved.catalog)&&window.CampusPlatform.validateCatalog(saved.catalog).valid){offlineBundle=saved;if(!navigator.onLine||approvedRefreshFailed)useSavedApprovedCatalog();}
    }
  }).catch(() => controls.announce('오프라인 저장을 준비하지 못했습니다. 현재 안내는 계속 사용할 수 있습니다.')).finally(() => { offlineCatalogPending=false;if(!applicationClosed)updateVisibility(); });

function createLabels(): void {
  let layer = document.getElementById('mapLabels');
  if (!layer) { layer = document.createElement('div'); layer.id = 'mapLabels'; layer.className = 'map-labels'; layer.setAttribute('aria-hidden', 'true'); document.body.append(layer); }
  layer.replaceChildren(); labels.clear(); facilityLabels.clear();
  for (const feature of plan.features.buildings) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'map-label'; button.tabIndex = -1;
    button.textContent = `${feature.number ? `${feature.number} ` : ''}${feature.name}`;
    button.addEventListener('click', () => selectBuilding(feature.id));
    layer.append(button); labels.set(feature.id, button);
  }
  const markers = app.site?.featureMarkers;
  if (Array.isArray(markers)) {
    for (const candidate of markers as unknown[]) {
      if (!record(candidate) || !record(candidate.feature) || !(candidate.mesh instanceof BABYLON.AbstractMesh)) continue;
      const feature = candidate.feature;
      if (typeof feature.name !== 'string' || typeof feature.id !== 'string') continue;
      if (!['sports', 'parking', 'water', 'gate'].includes(String(feature.kind)) && !/정문|동문|서문/.test(feature.name)) continue;
      const element = document.createElement('span');
      element.className = 'map-label map-feature-label'; element.textContent = feature.name;
      element.title = '공개 캠퍼스 안내 삽화 기반 추정 위치·외곽';
      layer.append(element); facilityLabels.set(feature.id, { element, mesh: candidate.mesh });
    }
  }
}
function updateLabels(): void {
  if (!app.scene || !app.engine) return;
  const camera = app.scene.activeCamera;
  if (!camera) return;
  const width = app.engine.getRenderWidth();
  const height = app.engine.getRenderHeight();
  const viewport = camera.viewport.toGlobal(width, height);
  const occupied: { x: number; y: number; w: number }[] = [];
  const sorted = [...labels].sort(([a], [b]) => Number(b === selectedId) - Number(a === selectedId));
  for (const [id, label] of sorted) {
    const detail = app.models.get(id);
    const model = detail?.root.isEnabled() ? detail : app.site?.getBuildingProxy?.(id);
    const mesh = model?.main || model?.hall || model?.newDorm || model?.mediaHall;
    if (!mesh || !model?.root.isEnabled() || !layers.labels) { label.hidden = true; continue; }
    const projected=app.site?.projectFeature?.(id,{occlusion:true});
    if(!projected){label.hidden=true;continue;}
    const rect = (document.getElementById('renderCanvas') as HTMLCanvasElement).getBoundingClientRect();
    const x = id===selectedId?Math.max(40,Math.min(rect.width-40,projected.x*rect.width/width)):projected.x*rect.width/width;
    const y = id===selectedId?Math.max(95,Math.min(rect.height-65,projected.y*rect.height/height)):projected.y*rect.height/height;
    const w = Math.max(76, label.textContent!.length * 11);
    const collision = occupied.some((item) => Math.abs(item.x - x) < (item.w + w) / 2 && Math.abs(item.y - y) < 30);
    label.hidden = projected.depth < 0 || projected.depth > 1 || x < 30 || x > rect.width - 30 || y < 95 || y > rect.height - 62 || ((collision||projected.occluded) && id !== selectedId);
    label.classList.toggle('is-selected', id === selectedId);
    if (!label.hidden) { label.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`; occupied.push({ x, y, w }); }
  }
  const rect = (document.getElementById('renderCanvas') as HTMLCanvasElement).getBoundingClientRect();
  for (const { element, mesh } of facilityLabels.values()) {
    mesh.computeWorldMatrix(true);
    const center = mesh.getBoundingInfo().boundingBox.centerWorld;
    const projected = BABYLON.Vector3.Project(center.add(new BABYLON.Vector3(0, 0.12, 0)), BABYLON.Matrix.Identity(), app.scene.getTransformMatrix(), viewport);
    const x = projected.x * rect.width / width; const y = projected.y * rect.height / height;
    const w = element.textContent!.length * 10 + 15;
    element.hidden = !layers.labels || projected.z < 0 || projected.z > 1 || x < 30 || x > rect.width - 30 || y < 95 || y > rect.height - 62 || occupied.some((item) => Math.abs(item.x - x) < (item.w + w) / 2 && Math.abs(item.y - y) < 26);
    if (!element.hidden) { element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(-50%, -100%)`; occupied.push({ x, y, w }); }
  }
}

function createTextFallback(): void {
  if (fallback) return;
  fallback = CampusHud.createTextInteriorController();
  for (const feature of plan.features.buildings) { const key = featureKey(feature); const interior = interiorFor(key); if (interior) fallback.registerInterior(null, interior, null, key); }
}
function boot(): void {
  const generation = ++bootGeneration;
  controls.setStatus('loading', '캠퍼스 조감도를 준비하고 있습니다.');
  hud?.dispose?.(); hud?.hideInterior(); hud = null; fallback?.dispose?.(); fallback = null;
  app.ready = false;
  locationSnapshot = null; platformControls?.update({ location: null });
  loader?.dispose(); loader = null; routeMesh?.dispose(); routeMesh = null;
  refinementRuntime?.dispose();refinementRuntime=null;instrumentation?.dispose();instrumentation=null;
  xrRuntime?.dispose();xrRuntime=null;xrStatus=null;
  xrExperience?.dispose(); xrExperience = null;
  detailVisibility.clear(); automaticLow = false; frameAverageMs = 16; qualityFrames = 0; qualityChangedAt = 0;
  measurementMode=null;measurementPoints=[];
  safeAreaKey='';
  frameIntervals.length=0;lastFrameTime=0;frameP95Ms=0;lastVisibilityTime=0;
  app.site?.dispose(); app.scene?.dispose(); app.engine?.dispose();
  app.site = null; app.scene = null; app.engine = null; app.models.clear();
  try {
    if (typeof BABYLON === 'undefined' || !BABYLON.Engine.IsSupported) throw new Error('WebGL is unavailable');
    const canvas = document.getElementById('renderCanvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Canvas is missing');
    const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, powerPreference: 'high-performance' });
    app.engine = engine;
    const scene = new BABYLON.Scene(engine); app.scene = scene;
    scene.useRightHandedSystem = true;
    scene.clearColor = new BABYLON.Color4(0.72, 0.78, 0.7, 1);
    const hemi = new BABYLON.HemisphericLight('sky-light', new BABYLON.Vector3(0, 1, 0), scene); hemi.intensity = 0.5;
    const sun = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.45, -0.85, 0.35), scene); sun.intensity = 0.45;
    const materials = createMaterials(scene);
    const site = window.CampusSiteScene.create(scene, materials, plan, { terrain: activeTerrain, canvas, metersPerUnit: 10 });
    app.site = site;
    site.cameraController.setObservationSettings?.({eyeHeightMeters:Number(refinement.eyeHeightMeters)});
    refinementRuntime=createRefinementRuntime(BABYLON,scene,site,()=>catalog);
    xrRuntime=createXrRefinement(BABYLON,scene,site,()=>({vrMovement:refinement.vrMovement==='smooth'?'smooth':'teleport',vrTurn:refinement.vrTurn==='smooth'?'smooth':'snap',eyeHeightMeters:Number(refinement.eyeHeightMeters),catalog,campusId:activeCampusId}),status=>{xrStatus=status;platformControls?.update({xrStatus:status.message,arLandmarks:status.capturedIds,arCalibrationReport:status.report});});
    instrumentation=new BABYLON.SceneInstrumentation(scene);
    for (const feature of plan.features.buildings) { const proxy = site.getBuildingProxy?.(feature.id); if (proxy) app.models.set(feature.id, proxy); }
    site.cameraController.reset(); view = 'overview';
    if (!scene.activeCamera) throw new Error('Camera is unavailable');
    hud = CampusHud.createHud(scene, scene.activeCamera, CampusData.campusInfo, CampusData.confirmedBuildings, CampusData.janggongResearch, () => site.cameraController.reset());
    hud.setInteriorLifecycle?.({ capture: () => { cameraSnapshot = { camera: site.cameraController.capture(), view }; return cameraSnapshot; }, restore: (snapshot: unknown) => { if (record(snapshot)) { site.cameraController.restore(snapshot.camera); if (snapshot.view === 'overview' || snapshot.view === 'top' || snapshot.view === 'free') view = snapshot.view; } updateUi(); }, onOpen: (id) => { const feature = buildingByLegacy.get(id) || buildingById.get(id); if (feature) { selectedId = feature.id; app.selectedId = selectedId; controls.selectBuilding(selectedId); const owner = entityFor(feature.id); const current = publicSelectedId ? entityFor(publicSelectedId) : undefined; if (owner && (current?.owningBuildingId || current?.id) !== owner.id) { publicSelectedId = owner.id; floor = null; } } } });
    for (const [id, model] of app.models) {
      const feature = buildingById.get(id)!;
      const mesh = model.main || model.hall || model.newDorm || model.mediaHall;
      const interior = interiorFor(featureKey(feature));
      if (mesh && interior) hud.registerInterior(mesh, interior, () => site.cameraController.focusBuilding(featureKey(feature)), featureKey(feature));
    }
    const activeEntries = modelsForCampus(activeManifest, activeCampusId, plan.features.buildings);
    loader = createModelLoader({ scene, materials, site, manifest: { ...activeManifest, models: activeEntries }, maxConcurrent:2, maxResidentModels:24,maxResidentBytes:128*1024*1024, legacyFactory: browserLegacyFactory, importGlb: (entry, signal) => browserGlbModel(BABYLON, scene, site, entry, signal), onState(id, state) {
      if (generation !== bootGeneration) return;
      if (state.status !== 'ready' && !loader?.models.has(id)) { const entry = activeEntries.find((item) => item.id === id); const feature = entry && (buildingById.get(entry.buildingId || entry.id) || buildingByLegacy.get(entry.legacyId || entry.id)); const proxy = feature && site.getBuildingProxy?.(feature.id); if (feature && proxy) app.models.set(feature.id, proxy); }
      updateUi();
    }, onLoaded(entry, model) {
      if (generation !== bootGeneration) return;
      const feature = buildingById.get(entry.buildingId || entry.id) || buildingByLegacy.get(entry.legacyId || entry.id);
      if (!feature) return;
      model.root.metadata = { ...(model.root.metadata || {}), featureId: feature.id };
      if(entry.kind==='glb')site.registerExternalModel?.(model, feature.id);
      app.models.set(feature.id, model);
      const mesh = model.main || model.hall || model.newDorm || model.mediaHall;
      const interior = interiorFor(featureKey(feature));
      if (mesh && interior) hud?.registerInterior(mesh, interior, () => site.cameraController.focusBuilding(featureKey(feature)), featureKey(feature));
      detailVisibility.delete(entry.id); applyQuality();
      updateLabels();
    } });
    createLabels(); app.ready = true;
    updateSafeArea();
    Object.entries(layers).forEach(([layer, enabled]) => site.setLayerVisible(layer, enabled));
    if (exaggeration !== 1) site.setVerticalExaggeration?.(exaggeration); applyQuality();
    controls.setStatus('ready', '전체 부지를 둘러보거나 건물을 선택해 주세요.');
    engine.runRenderLoop(() => {
      if (view !== 'text' && view !== '2d') {
        const start = performance.now(); scene.render(); const elapsed = performance.now() - start;
        frameAverageMs = frameAverageMs * 0.94 + elapsed * 0.06; qualityFrames += 1;
        const time = performance.now();
        if (quality === 'auto' && !document.hidden && qualityFrames >= 90 && time - qualityChangedAt > 8000) {
          const nextLow = automaticLow ? frameAverageMs >= 13 : frameAverageMs > 28;
          if (nextLow !== automaticLow) { automaticLow = nextLow; qualityChangedAt = time; qualityFrames = 0; applyQuality(); }
        }
      }
      const now = performance.now();
      if(lastFrameTime&&!document.hidden){const interval=now-lastFrameTime;if(interval<2000){frameIntervals.push(interval);if(frameIntervals.length>240)frameIntervals.shift();}}
      lastFrameTime=now;
      if (now-lastVisibilityTime>500) {lastVisibilityTime=now;updateSafeArea();updateVisibility();const sorted=[...frameIntervals].sort((a,b)=>a-b);frameP95Ms=sorted.length?sorted[Math.floor((sorted.length-1)*.95)]:0;}
      if (now - lastUiTime > 300) { lastUiTime = now; updateLabels(); updateUi(); }
    });
    scene.onPointerObservable.add((info,eventState) => {
      if(!info.pickInfo?.hit){if(info.type===BABYLON.PointerEventTypes.POINTERMOVE)site.setInteractionState?.({hovered:null});return;}
      if(info.type===BABYLON.PointerEventTypes.POINTERPICK&&measurementMode&&info.pickInfo.pickedPoint){eventState.skipNextObservers=true;const point=info.pickInfo.pickedPoint;measurementPoints.push([point.x*10,-point.z*10,point.y*10]);const minimum=measurementMode==='area'?3:2;if(measurementPoints.length>=minimum){measurePoints(measurementMode,measurementPoints);if(measurementMode==='planar-distance'||measurementMode==='height-difference'||measurementPoints.length>=256){measurementMode=null;hud?.setPickingEnabled?.(true);}}return;}
      if(info.type!==BABYLON.PointerEventTypes.POINTERPICK&&info.type!==BABYLON.PointerEventTypes.POINTERMOVE)return;
      let node: import('babylonjs').Node | null = info.pickInfo.pickedMesh;
      while (node) { const id: unknown = node.metadata?.featureId; if (typeof id === 'string' && (buildingById.has(id) || entityFor(id))) {if(info.type===BABYLON.PointerEventTypes.POINTERMOVE)site.setInteractionState?.({hovered:id});else selectBuilding(id); break; } node = node.parent; }
    });
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      if (generation !== bootGeneration) return;
      updateVisibility();
    }));
    engine.onContextLostObservable.add(() => { app.ready = false; controls.setStatus('error', '3D 표시가 중단되었습니다. 건물 목록은 계속 사용할 수 있습니다. 다시 시도해 주세요.'); createTextFallback(); });
    engine.onContextRestoredObservable.add(()=>{if(generation===bootGeneration){app.ready=true;controls.setStatus('ready','3D 표시가 복구되었습니다.');updateVisibility();}});
    updateUi();
  } catch (error) {
    app.ready = false;
    app.site?.dispose(); app.scene?.dispose(); app.engine?.dispose();
    app.site = null; app.scene = null; app.engine = null;
    controls.setStatus('error', '3D 화면을 열지 못했습니다. 건물 목록과 내부 정보는 사용할 수 있습니다. 다시 시도하거나 WebGL을 지원하는 브라우저에서 열어 주세요.');
    console.error('Campus initialization failed', error instanceof Error ? error.message : 'Unknown initialization error');
    createTextFallback();
  }
}
window.addEventListener('resize', () => { app.engine?.resize(); controller()?.resize(); updateSafeArea();updateUi(); });
const floorSelection = (event: MouseEvent) => { const tab = event.target instanceof Element ? event.target.closest<HTMLElement>('.floor-tab') : null; if (tab?.dataset.floorTarget) { floor = tab.dataset.floorTarget; persistState(true); } };
document.addEventListener('click', floorSelection);
function parseLocationState() { const hash = window.CampusPlatform.parseState(location.hash); return hash.valid ? hash : window.CampusPlatform.parseState(location.search); }
const popstate = (event: PopStateEvent) => { if (record(event.state) && event.state.campusView) applyState(event.state.campusView); else { const parsed = parseLocationState(); if (parsed.valid && parsed.state) applyState(parsed.state); } };
window.addEventListener('popstate', popstate);
window.addEventListener('pagehide', () => { applicationClosed = true; persistState(); locationSnapshot = null; loader?.dispose();refinementRuntime?.dispose();xrRuntime?.dispose();instrumentation?.dispose(); hud?.dispose?.(); fallback?.dispose?.(); xrExperience?.dispose(); platformControls?.destroy(); app.site?.dispose(); app.scene?.dispose(); app.engine?.dispose(); controls.destroy(); document.removeEventListener('click', floorSelection); window.removeEventListener('popstate', popstate); });
boot();
if (shared.valid && shared.state) applyState(shared.state);
else { try { const saved: unknown = JSON.parse(localStorage.getItem('hanshin-campus-view-v1') || 'null'); if (saved) applyState(saved); } catch { controls.announce('저장된 보기 상태를 읽지 못해 전체 부지로 시작했습니다.'); } }
async function refreshApprovedCatalog(): Promise<void> {
  if (!/^https?:$/.test(location.protocol)) return;
  const request = new AbortController(); const timeout = window.setTimeout(() => request.abort(), 5000);
  try {
    const capability = await fetch(location.pathname || '/', { method: 'HEAD', signal: request.signal, credentials: 'same-origin', cache: 'no-store' });
    if (!capability.ok || capability.headers.get('X-Campus-Api') !== '/api/v1') return;
    const endpoint = new URL('/api/v1/catalog', location.href);
    const requested=shared.valid?shared.state:null;
    if(requested?.releaseId)endpoint.searchParams.set('release',requested.releaseId);
    if (endpoint.origin !== location.origin) return;
    const response = await fetch(endpoint, { signal: request.signal, credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) {if(requested?.releaseId){sharedStatus='공유한 공개판을 찾을 수 없습니다. 현재 자료를 표시합니다.';updateUi();}return;}
    const encoded = await response.text(); if (encoded.length > 2 * 1024 * 1024) throw new Error('Public catalog exceeds import limit.');
    const payload: unknown = JSON.parse(encoded); const value = record(payload) && record(payload.data) ? payload.data.catalog || payload.data : payload;
    const checked = window.CampusPlatform.validateCatalog(value);
    if (!checked.valid || !record(value)) throw new Error('Public catalog validation failed.');
    const next = window.CampusPlatform.publicCatalog(value as unknown as PlatformCatalog);
    const meta=record(payload)&&record(payload.meta)?payload.meta:null;
    if(meta&&Array.isArray(meta.mediaRecords))mediaRecords=meta.mediaRecords;
    const nextRelease=meta&&typeof meta.releaseId==='string'?meta.releaseId:null;
    if(requested?.contentVersion&&requested.contentVersion!==next.contentVersion)sharedStatus='공유 링크의 자료판과 현재 공개판이 다릅니다. 공간의 변경·폐기를 확인해 주세요.';
    if (applicationClosed || next.contentVersion === catalog.contentVersion&&releaseId===nextRelease) return;
    const state = getState(); catalog = next;
    activeManifest=catalog.assetManifest||manifest;validateModelManifest(activeManifest);releaseId=nextRelease;
    const targetId = catalog.campuses.some((campus) => campus.id === state.campusId) ? state.campusId : catalog.activeCampusId;
    if (switchCampus(targetId)) { applyState({ ...state, campusId: targetId, camera: null });if(requested)applyState(requested); controls.announce(`승인된 공개 자료 ${next.contentVersion}로 갱신했습니다. 화면과 자료 기준을 확인해 주세요.`); }
  } catch (error) { approvedRefreshFailed=true;useSavedApprovedCatalog();console.info('Approved catalog refresh unavailable; saved or packaged catalog remains active', error instanceof Error ? error.message : 'Unavailable'); }
  finally { window.clearTimeout(timeout); }
}
void refreshApprovedCatalog();
}
initializeApplication();
