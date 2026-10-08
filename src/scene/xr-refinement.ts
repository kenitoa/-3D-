import type { Scene, Node, TransformNode, Vector3, Quaternion, WebXRDefaultExperience, Observer, WebXRTrackingState } from 'babylonjs';
import type { CampusCatalog } from '../types/platform-types';
import type { CameraSnapshot, SiteScene } from '../types/site-types';

export interface XrLandmark { id: string; role: 'control' | 'holdout'; siteMeters: [number, number, number] }
export interface XrAnchor { id: string; campusId: string; entityId: string; sourceIds: string[]; reviewedAt: string; validUntil: string; maxHorizontalErrorMeters: number; maxVerticalErrorMeters: number; landmarks: XrLandmark[] }
export interface XrCapture { id: string; xrMeters: [number, number, number] }
export interface XrCalibration { passed: boolean; reason: string; yawRadians: number | null; translationMeters: [number, number, number] | null; residuals: {id: string;role: 'control' | 'holdout';horizontalMeters: number;verticalMeters: number;passed: boolean}[]; holdoutCount: number; realDeviceVerified: false }
export interface XrPreferences { vrMovement?: 'teleport' | 'smooth'; vrTurn?: 'snap' | 'smooth'; eyeHeightMeters?: number; catalog?: CampusCatalog; campusId?: string }
export interface XrStatus { state: 'idle' | 'preparing' | 'vr' | 'calibrating' | 'ar' | 'tracking-lost' | 'unsupported' | 'error'; message: string; anchorId: string | null; capturedIds: string[]; lastHitAvailable: boolean; report: XrCalibration | null; realDeviceVerified: false }
const point = (value: unknown): value is [number, number, number] => Array.isArray(value) && value.length === 3 && value.every((item) => typeof item === 'number' && Number.isFinite(item) && Math.abs(item) < 1e7);
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,159}$/.test(value);

export function validateXrAnchor(anchor: XrAnchor, at = Date.now()): void {
  if (!anchor || !id(anchor.id) || !id(anchor.campusId) || !id(anchor.entityId) || !Array.isArray(anchor.sourceIds) || !anchor.sourceIds.length || !anchor.sourceIds.every(id) || new Set(anchor.sourceIds).size !== anchor.sourceIds.length || !Number.isFinite(Date.parse(anchor.reviewedAt)) || Date.parse(anchor.reviewedAt) > at || !Number.isFinite(Date.parse(anchor.validUntil)) || Date.parse(anchor.validUntil) <= at || Date.parse(anchor.validUntil) <= Date.parse(anchor.reviewedAt) || ![anchor.maxHorizontalErrorMeters, anchor.maxVerticalErrorMeters].every((value) => Number.isFinite(value) && value > 0 && value <= 100) || !Array.isArray(anchor.landmarks) || anchor.landmarks.length < 5 || anchor.landmarks.length > 100 || !anchor.landmarks.every((item) => item && id(item.id) && ['control', 'holdout'].includes(item.role) && point(item.siteMeters)) || new Set(anchor.landmarks.map((item) => item.id)).size !== anchor.landmarks.length) throw new Error('AR 기준 구역에는 유효한 검수·만료일·출처·미터 기준점·허용 오차가 필요합니다.');
  const controls = anchor.landmarks.filter((item) => item.role === 'control'), holdouts = anchor.landmarks.filter((item) => item.role === 'holdout');
  if (controls.length < 2 || holdouts.length < 3) throw new Error('AR 정합에는 서로 다른 기준점 두 개와 독립 검수점 세 개 이상이 필요합니다.');
  for (let index = 0; index < anchor.landmarks.length; index++) for (const other of anchor.landmarks.slice(index + 1)) if (Math.hypot(anchor.landmarks[index].siteMeters[0] - other.siteMeters[0], anchor.landmarks[index].siteMeters[1] - other.siteMeters[1]) < 0.01) throw new Error('기준점과 독립 검수점의 수평 위치가 중복됩니다.');
  let independentArea = 0;
  for (let a = 0; a < holdouts.length; a++) for (let b = a + 1; b < holdouts.length; b++) for (let c = b + 1; c < holdouts.length; c++) { const one = holdouts[a].siteMeters, two = holdouts[b].siteMeters, three = holdouts[c].siteMeters; independentArea = Math.max(independentArea, Math.abs((two[0] - one[0]) * (three[1] - one[1]) - (two[1] - one[1]) * (three[0] - one[0]))); }
  if (independentArea < 1e-4) throw new Error('독립 검수점은 한 직선에 몰리지 않는 현장 평면 범위를 확인해야 합니다.');
}

/** Fixed-scale planar rigid fit. Only controls affect the transform. Independent
 * holdouts test it in real XR meter coordinates; no GNSS or inferred landmarks
 * enter the calculation. Babylon yaw maps x'=c*x+s*z, z'=-s*x+c*z. */
export function fitXrCalibration(anchor: XrAnchor, captured: XrCapture[]): XrCalibration {
  validateXrAnchor(anchor);
  if (!Array.isArray(captured) || captured.length > anchor.landmarks.length || !captured.every((item) => item && id(item.id) && point(item.xrMeters) && anchor.landmarks.some((landmark) => landmark.id === item.id)) || new Set(captured.map((item) => item.id)).size !== captured.length) throw new Error('캡처 좌표와 기준점 연결이 유효하지 않습니다.');
  const unavailable = (reason: string): XrCalibration => ({ passed: false, reason, yawRadians: null, translationMeters: null, residuals: [], holdoutCount: 0, realDeviceVerified: false });
  const captures = new Map(captured.map((item) => [item.id, item.xrMeters]));
  if (anchor.landmarks.some((landmark) => !captures.has(landmark.id))) return unavailable('등록된 기준점과 독립 검수점을 모두 현장에서 캡처해 주세요.');
  const controls = anchor.landmarks.filter((item) => item.role === 'control');
  const sx = controls.reduce((sum, item) => sum + item.siteMeters[0], 0) / controls.length;
  const sz = controls.reduce((sum, item) => sum - item.siteMeters[1], 0) / controls.length;
  const tx = controls.reduce((sum, item) => sum + captures.get(item.id)![0], 0) / controls.length;
  const tz = controls.reduce((sum, item) => sum + captures.get(item.id)![2], 0) / controls.length;
  let dot = 0, cross = 0;
  for (const control of controls) { const a = control.siteMeters[0] - sx, b = -control.siteMeters[1] - sz, c = captures.get(control.id)![0] - tx, d = captures.get(control.id)![2] - tz; dot += a * c + b * d; cross += b * c - a * d; }
  if (Math.hypot(dot, cross) < 1e-8) return unavailable('수평 기준점의 방향을 계산할 수 없습니다. 서로 다른 현장 기준점을 다시 확인해 주세요.');
  const yaw = Math.atan2(cross, dot), cosine = Math.cos(yaw), sine = Math.sin(yaw);
  const translation: [number, number, number] = [tx - cosine * sx - sine * sz, controls.reduce((sum, item) => sum + captures.get(item.id)![1] - item.siteMeters[2], 0) / controls.length, tz + sine * sx - cosine * sz];
  const residuals = anchor.landmarks.map((landmark) => {
    const [east, north, up] = landmark.siteMeters, xr = captures.get(landmark.id)!;
    const horizontalMeters = Math.hypot(cosine * east - sine * north + translation[0] - xr[0], -sine * east - cosine * north + translation[2] - xr[2]);
    const verticalMeters = Math.abs(up + translation[1] - xr[1]);
    return { id: landmark.id, role: landmark.role, horizontalMeters, verticalMeters, passed: horizontalMeters <= anchor.maxHorizontalErrorMeters && verticalMeters <= anchor.maxVerticalErrorMeters };
  });
  const passed = residuals.every((item) => item.passed); return { passed, reason: passed ? '기준점과 독립 검수점이 등록된 허용 오차를 통과했습니다. 실기기·현장 인수 검사는 별도로 필요합니다.' : '허용 오차를 초과했습니다. 겹침 안내를 표시하지 않습니다. 기준점을 다시 캡처해 주세요.', yawRadians: yaw, translationMeters: translation, residuals, holdoutCount: residuals.filter((item) => item.role === 'holdout').length, realDeviceVerified: false };
}

type RootSnapshot = { parent: Node | null; position: Vector3; rotation: Vector3; quaternion: Quaternion | null; scaling: Vector3; enabled: boolean };

export function createXrRefinement(B: typeof import('babylonjs'), scene: Scene, site: SiteScene, preferencesGetter: () => XrPreferences, onStatus: (status: XrStatus) => void) {
  const metersPerUnit = Number(site.getDiagnostics().metersPerUnit) || 10;
  let experience: WebXRDefaultExperience | null = null;
  let mode: 'vr' | 'ar' | null = null;
  let anchor: XrAnchor | null = null;
  let root: TransformNode | null = null;
  const roots = new Map<TransformNode, RootSnapshot>();
  const captures = new Map<string, XrCapture>();
  let lastHit: Vector3 | null = null, lastHitAt = 0;
  let calibrated = false, disposed = false, generation = 0;
  let report: XrCalibration | null = null;
  let cameraSnapshot: CameraSnapshot | null = null;
  let state: XrStatus['state'] = 'idle', message = 'XR 실기기와 현장 인수 검사는 아직 확인되지 않았습니다.';
  const observers: (() => void)[] = [];
  const status = (): XrStatus => ({ state, message, anchorId: anchor?.id || null, capturedIds: [...captures.keys()], lastHitAvailable: Boolean(lastHit && Date.now() - lastHitAt < 1000), report: report ? { ...report, translationMeters: report.translationMeters ? [...report.translationMeters] : null, residuals: report.residuals.map((item) => ({ ...item })) } : null, realDeviceVerified: false });
  function announce(next: XrStatus['state'], text: string): void { state = next; message = text; if (!disposed) onStatus(status()); }
  function sourceBound(candidate: XrAnchor): void {
    validateXrAnchor(candidate); const preferences = preferencesGetter(), catalog = preferences.catalog;
    if (Number(site.getDiagnostics().verticalExaggeration || 1) !== 1) throw new Error('현장 AR 정합 전에는 지형 강조를 1배로 복원해 주세요.');
    if (!catalog || candidate.campusId !== (preferences.campusId || catalog.activeCampusId)) throw new Error('현재 공개 캠퍼스 자료와 연결된 AR 구역만 사용할 수 있습니다.');
    const map = new Map(catalog.entities.map((entity) => [entity.id, entity])); let entity = map.get(candidate.entityId); const seen = new Set<string>();
    if (!entity || entity.campusId !== candidate.campusId) throw new Error('AR 구역에 연결된 공개 공간이 없습니다.');
    while (entity) { if (entity.visibility !== 'public' || entity.sensitive || seen.has(entity.id)) throw new Error('AR 구역은 공개 공간과 공개 소속 공간에 연결되어야 합니다.'); seen.add(entity.id); if (!entity.parentId) break; entity = map.get(entity.parentId); if (!entity) throw new Error('AR 소속 공간의 검수가 필요합니다.'); }
    if (!candidate.sourceIds.every((sourceId) => catalog.sources.some((source) => source.id === sourceId && source.visibility === 'public' && source.confidence === 'verified'))) throw new Error('AR 기준점의 검수된 공개 출처가 필요합니다.');
  }
  function contentRoots(): TransformNode[] {
    const result = new Set<TransformNode>();
    for (const mesh of scene.meshes) {
      if (mesh.isDisposed()) continue;
      let node: Node | null = mesh, owned = false;
      while (node && node !== root) { if (node.metadata?.siteLayer || node.metadata?.featureId || node.metadata?.refinementOverlay) owned = true; if (!node.parent || node.parent === root) break; node = node.parent; }
      if (owned && node instanceof B.TransformNode && node !== root) result.add(node);
    }
    return [...result];
  }
  function synchronizeContent(): void {
    if (mode !== 'ar') return;
    for (const node of contentRoots()) {
      if (!roots.has(node)) roots.set(node, { parent: node.parent, position: node.position.clone(), rotation: node.rotation.clone(), quaternion: node.rotationQuaternion?.clone() || null, scaling: node.scaling.clone(), enabled: node.isEnabled(false) });
      if (!calibrated || !root) node.setEnabled(false);
      else { node.parent = root; node.setEnabled(roots.get(node)!.enabled); }
    }
  }
  function restoreContent(): void {
    for (const [node, snapshot] of roots) if (!node.isDisposed()) { node.parent = snapshot.parent; node.position.copyFrom(snapshot.position); node.rotation.copyFrom(snapshot.rotation); node.rotationQuaternion = snapshot.quaternion?.clone() || null; node.scaling.copyFrom(snapshot.scaling); node.setEnabled(snapshot.enabled); }
    roots.clear(); root?.dispose(); root = null; calibrated = false;
  }
  function invalidateTracking(): void {
    lastHit = null; lastHitAt = 0; captures.clear(); report = null; calibrated = false; if (root) root.setEnabled(false); synchronizeContent();
    announce('tracking-lost', '현장 위치 추적이 끊겼거나 기준 좌표가 변경됐습니다. 겹침 안내를 숨겼습니다. 기준점을 다시 캡처하거나 2D·문자 안내를 이용해 주세요.');
  }
  function cleanup(): void {
    observers.splice(0).forEach((remove) => remove()); restoreContent(); captures.clear(); lastHit = null; lastHitAt = 0; report = null; mode = null; anchor = null;
    if (cameraSnapshot && !scene.isDisposed) site.cameraController.restore(cameraSnapshot); cameraSnapshot = null;
  }
  async function exit(): Promise<void> {
    generation++; const current = experience; experience = null; cleanup();
    if (current) { try { if (current.baseExperience.state !== B.WebXRState.NOT_IN_XR) await current.baseExperience.exitXRAsync(); } catch { announce('error', 'XR 세션 종료를 확인하지 못했습니다. 기기의 XR 종료 기능을 사용해 주세요.'); } finally { current.dispose(); } }
    if (!disposed) announce('idle', '기존 캠퍼스 시점으로 돌아왔습니다.');
  }
  async function start(next: 'vr' | 'ar', candidate?: XrAnchor): Promise<boolean> {
    if (disposed) throw new Error('종료된 XR 기능입니다.');
    if (next === 'ar') { if (!candidate) throw new Error('현장 AR 기준 구역을 선택해 주세요.'); sourceBound(candidate); }
    await exit(); const epoch = ++generation;
    announce('preparing', `${next.toUpperCase()} 기기와 세션을 확인하고 있습니다.`);
    let supported = false;
    try { supported = await B.WebXRSessionManager.IsSessionSupportedAsync(next === 'vr' ? 'immersive-vr' : 'immersive-ar'); } catch { if (epoch === generation && !disposed) announce('unsupported', '이 브라우저에서 XR 기기 지원을 확인할 수 없습니다. 조감도·2D·문자 안내를 이용해 주세요.'); return false; }
    if (epoch !== generation || disposed) return false;
    if (!supported) { announce('unsupported', '현재 기기·브라우저에서 해당 XR 세션을 지원하지 않습니다. 조감도·2D·문자 안내를 이용해 주세요.'); return false; }
    cameraSnapshot = site.cameraController.capture(); site.cameraController.cancelTransition?.();
    try {
      const preferences = preferencesGetter();
      const current = await scene.createDefaultXRExperienceAsync({ disableDefaultUI: true, disableTeleportation: next === 'ar', disableNearInteraction: true, disableHandTracking: true, ignoreNativeCameraTransformation: next === 'ar', inputOptions: { doNotLoadControllerMeshes: true, disableOnlineControllerRepository: true }, floorMeshes: next === 'vr' ? scene.meshes.filter((mesh) => mesh.metadata?.siteLayer === 'terrain' && mesh.isEnabled()) : [], optionalFeatures: next === 'ar' ? ['hit-test'] : [] });
      if (epoch !== generation || disposed) { current.dispose(); return false; }
      experience = current; mode = next; anchor = candidate || null;
      current.baseExperience.sessionManager.worldScalingFactor = 1 / metersPerUnit;
      current.baseExperience.sessionManager.defaultHeightCompensation = Number.isFinite(preferences.eyeHeightMeters) ? Math.max(0.5, Math.min(2.3, preferences.eyeHeightMeters!)) : 1.7;
      // This fallback does not overwrite a headset's real tracked height.
      if (next === 'vr') {
        if (current.teleportation) { current.teleportation.teleportationEnabled = preferences.vrMovement !== 'smooth'; current.teleportation.backwardsMovementEnabled = preferences.vrMovement !== 'smooth'; current.teleportation.rotationEnabled = preferences.vrTurn !== 'smooth'; current.teleportation.rotationAngle = Math.PI / 6; }
        if (preferences.vrMovement === 'smooth') {
          // Babylon's movementSpeed is a camera-speed multiplier, not meters
          // per second. Normalize only virtual controller locomotion to the
          // same 1.4 m/s as the observation camera; tracked head pose stays native.
          const camera = current.baseExperience.camera, originalSpeed = camera._computeLocalCameraSpeed;
          camera._computeLocalCameraSpeed = () => 1.4 / metersPerUnit * Math.min(100, Math.max(0, scene.getEngine().getDeltaTime())) / 1000;
          observers.push(() => { camera._computeLocalCameraSpeed = originalSpeed; });
        }
        if (preferences.vrMovement === 'smooth' || preferences.vrTurn === 'smooth') current.baseExperience.featuresManager.enableFeature(B.WebXRFeatureName.MOVEMENT, 'stable', { xrInput: current.input, movementEnabled: preferences.vrMovement === 'smooth', movementSpeed: 1, rotationEnabled: preferences.vrTurn === 'smooth', rotationSpeed: 0.15, movementOrientationFollowsViewerPose: true, movementOrientationFollowsController: false });
      } else {
        synchronizeContent();
        const hit = current.baseExperience.featuresManager.enableFeature(B.WebXRFeatureName.HIT_TEST, 'stable', { testOnPointerDownOnly: false });
        const hitObserver = hit.onHitTestResultObservable.add((results) => { if (epoch !== generation || mode !== 'ar') return; const wasAvailable = Boolean(lastHit); const found = results[0]; lastHit = found ? found.position.clone() : null; lastHitAt = found ? Date.now() : 0; if (wasAvailable !== Boolean(lastHit) && !disposed) onStatus(status()); });
        observers.push(() => hit.onHitTestResultObservable.remove(hitObserver));
        const tracking: Observer<WebXRTrackingState> | null = current.baseExperience.camera.onTrackingStateChanged.add((trackingState) => { if (epoch === generation && mode === 'ar' && trackingState !== B.WebXRTrackingState.TRACKING) invalidateTracking(); });
        observers.push(() => current.baseExperience.camera.onTrackingStateChanged.remove(tracking));
        const reference = current.baseExperience.sessionManager.onXRReferenceSpaceChanged.add(() => { if (mode === 'ar' && calibrated) invalidateTracking(); }); observers.push(() => current.baseExperience.sessionManager.onXRReferenceSpaceChanged.remove(reference));
        const frame = current.baseExperience.sessionManager.onXRFrameObservable.add(() => { if (epoch === generation) synchronizeContent(); }); observers.push(() => current.baseExperience.sessionManager.onXRFrameObservable.remove(frame));
      }
      const ended = current.baseExperience.sessionManager.onXRSessionEnded.add(() => { if (experience !== current) return; generation++; experience = null; cleanup(); current.dispose(); announce('idle', 'XR 세션이 종료되어 기존 캠퍼스 시점으로 돌아왔습니다.'); }); observers.push(() => current.baseExperience.sessionManager.onXRSessionEnded.remove(ended));
      await current.baseExperience.enterXRAsync(next === 'vr' ? 'immersive-vr' : 'immersive-ar', next === 'vr' ? 'local-floor' : 'local');
      if (epoch !== generation || disposed) { if (current.baseExperience.state !== B.WebXRState.NOT_IN_XR) await current.baseExperience.exitXRAsync(); current.dispose(); return false; }
      announce(next === 'vr' ? 'vr' : 'calibrating', next === 'vr' ? '가상 캠퍼스 관찰을 시작했습니다. 실제 통행 안내가 아닙니다. 실기기 성능·멀미 검수는 별도로 필요합니다.' : '기준점과 독립 검수점을 실제 현장에서 히트 테스트로 캡처해 주세요. 정합 검토 전에는 캠퍼스 겹침 안내를 표시하지 않습니다.'); return true;
    } catch (error) {
      if (epoch !== generation || disposed) return false;
      const current = experience; experience = null; cleanup(); current?.dispose(); announce('error', `XR을 시작할 수 없습니다. ${error instanceof Error ? error.message : '기기 지원과 권한을 확인해 주세요.'}`); return false;
    }
  }
  function capture(landmarkId: string): XrCapture {
    if (!experience || mode !== 'ar' || !anchor || experience.baseExperience.state !== B.WebXRState.IN_XR || experience.baseExperience.camera.trackingState !== B.WebXRTrackingState.TRACKING || !lastHit || Date.now() - lastHitAt >= 1000) throw new Error('실제 AR 세션에서 추적된 최신 히트 테스트가 필요합니다.');
    if (!anchor.landmarks.some((landmark) => landmark.id === landmarkId)) throw new Error('등록된 현장 기준점 또는 독립 검수점만 캡처할 수 있습니다.');
    const value: XrCapture = { id: landmarkId, xrMeters: [lastHit.x * metersPerUnit, lastHit.y * metersPerUnit, lastHit.z * metersPerUnit] };
    captures.set(landmarkId, value); calibrated = false; root?.setEnabled(false); synchronizeContent(); announce('calibrating', `현장 점 ${landmarkId}을 캡처했습니다. 독립 검수까지 통과한 후 겹침 안내를 표시합니다.`); return { ...value, xrMeters: [...value.xrMeters] };
  }
  function review(): XrCalibration {
    if (!anchor || !experience || mode !== 'ar') throw new Error('검토할 실제 AR 세션과 등록된 기준 구역이 없습니다.');
    if (experience.baseExperience.state !== B.WebXRState.IN_XR || experience.baseExperience.camera.trackingState !== B.WebXRTrackingState.TRACKING) throw new Error('정상적으로 추적되는 실제 AR 세션에서 정합을 검토해 주세요.');
    sourceBound(anchor); report = fitXrCalibration(anchor, [...captures.values()]); calibrated = report.passed;
    if (report.passed && report.translationMeters && report.yawRadians !== null) {
      if (!root) root = new B.TransformNode('verified-ar-alignment', scene);
      root.position.copyFrom(B.Vector3.FromArray(report.translationMeters).scale(1 / metersPerUnit)); root.rotation.y = report.yawRadians; root.scaling.set(1, 1, 1); root.setEnabled(true); synchronizeContent(); announce('ar', report.reason);
    } else { root?.setEnabled(false); synchronizeContent(); announce('calibrating', report.reason); }
    return { ...report, translationMeters: report.translationMeters ? [...report.translationMeters] : null, residuals: report.residuals.map((item) => ({ ...item })) };
  }
  return {
    startVR: () => start('vr'), startAR: (candidate: XrAnchor) => start('ar', candidate), capture, review, exit,
    dispose() { if (disposed) return; disposed = true; generation++; const current = experience; experience = null; cleanup(); if (current) void current.baseExperience.exitXRAsync().catch(() => { message = 'XR 세션 종료를 기기에서 확인해야 합니다.'; }).finally(() => current.dispose()); },
    diagnostics() { return { ...status(), mode, worldScalingFactor: 1 / metersPerUnit, metersPerWorldUnit: metersPerUnit, alignedRootCount: roots.size, calibrated, disposed, controllerAssetsRemote: false, usesGnssForAlignment: false }; }
  };
}
export type XrRefinement = ReturnType<typeof createXrRefinement>;
