import type { AbstractMesh, Material, Scene, Vector3, LinesMesh } from 'babylonjs';
import type { CampusCatalog, PlatformEntity, PlatformApi, EvidenceClaim, SpatialGeometry } from '../types/platform-types';
import type { RefinementApi, MeasurementKind, MeasurementResult, PointMeters } from '../types/refinement-types';
import type { SiteScene } from '../types/site-types';

export type SpatialTheme = 'default' | 'operations' | 'source-confidence' | 'lifecycle' | 'category' | 'none' | 'events' | 'construction' | 'access' | 'hours';
export type LightingMode = 'guide' | 'observe' | 'evening';
export type FloorView = 'exterior' | 'cut' | 'isolate' | 'explode';
export interface ThemeItem { entityId: string; label: string; color: string; pattern: string; scope: 'point-only'; pointMeters: [number, number, number]; validUntil: string | null }
export interface ThemeReport { theme: SpatialTheme; at: string; items: ThemeItem[]; legend: {key: string;label: string;color: string;pattern: string}[]; unavailable: number; note: string }
export interface FloorReport { applied: boolean; reason: string; floorId: string | null; mode: FloorView; meshCount: number }
export interface OutlineRing { polygonIndex: number; role: 'outer' | 'hole'; points: PointMeters[]; value: number }
export interface OutlineMeasurement extends MeasurementResult { polygonCount: number; holeCount: number; rings: OutlineRing[] }
export interface SpatialMeasurement extends MeasurementResult { kind: MeasurementKind; worldPoints: number[][]; notes: string[]; displayedPointCount: number; polygonCount?: number; holeCount?: number; worldRings?: {polygonIndex: number;role: 'outer' | 'hole';points: number[][]}[] }

/** Sum each registered exterior and subtract its holes. Coordinates stay in
 * meters; callers validate source references and polygon topology with the
 * shared Catalog validator before showing the result. */
export function measureOutlineGeometry(geometry: SpatialGeometry, measure: RefinementApi['measureGeometry'], version: string): OutlineMeasurement {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type) || geometry.coordinateSystem !== 'local-meters' || geometry.unit !== 'm') throw new Error('윤곽 측정에는 변환된 미터 좌표의 Polygon 또는 MultiPolygon이 필요합니다.');
  const polygons: unknown = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  if (!Array.isArray(polygons) || !polygons.length || polygons.length > 64) throw new Error('윤곽 구성요소가 유효하지 않습니다.');
  const rings: OutlineRing[] = []; let value = 0, pointCount = 0, holeCount = 0;
  for (const [polygonIndex, polygon] of polygons.entries()) {
    if (!Array.isArray(polygon) || !polygon.length || polygon.length > 64) throw new Error('윤곽에는 외곽 링이 필요합니다.');
    let polygonArea = 0;
    for (const [ringIndex, ring] of polygon.entries()) {
      if (!Array.isArray(ring) || !ring.every((point): point is [number, number] => Array.isArray(point) && point.length === 2 && point.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)))) throw new Error('윤곽 좌표가 유효하지 않습니다.');
      pointCount += ring.length; if (pointCount > 1000) throw new Error('장면 윤곽 측정은 최대 1000점까지 지원합니다.');
      const area = measure(ring, 'area', { confirmation: 'estimated', version });
      polygonArea += ringIndex === 0 ? area.value : -area.value; if (ringIndex > 0) holeCount++;
      rings.push({ polygonIndex, role: ringIndex === 0 ? 'outer' : 'hole', points: ring.map((point) => [...point]), value: area.value });
    }
    if (polygonArea <= 0) throw new Error('공제 영역이 외곽 면적을 초과합니다.'); value += polygonArea;
  }
  return { value, unit: 'm2', approximate: true, uncertainty: null, version, points: pointCount, polygonCount: polygons.length, holeCount, rings };
}

type SemanticMesh = { mesh: AbstractMesh; floor: PlatformEntity | null; entity: PlatformEntity | null; buildingId: string };
type MeshSnapshot = { enabled: boolean; visible: boolean; visibility: number; position: Vector3; material: Material | null };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const PUBLIC_NOTE = '표식은 등록 대상의 위치를 안내합니다. 실제 공사 면적·통행 가능성·실측 경계를 확정하지 않습니다.';

/** Adds reversible views to the existing scene. Only approved public Catalog
 * semantics can control floor geometry; no inferred rooms or floor heights are
 * created. Original materials and vertices remain owned by their model loader. */
export function createRefinementRuntime(B: typeof import('babylonjs'), scene: Scene, site: SiteScene, catalogGetter: () => CampusCatalog) {
  const globals = globalThis as unknown as { CampusRefinement?: RefinementApi; CampusPlatform?: PlatformApi; window?: { CampusRefinement?: RefinementApi; CampusPlatform?: PlatformApi } };
  const apis = () => ({ refinement: globals.window?.CampusRefinement || globals.CampusRefinement, platform: globals.window?.CampusPlatform || globals.CampusPlatform });
  const diagnostics = site.getDiagnostics();
  const metersPerUnit = typeof diagnostics.metersPerUnit === 'number' && diagnostics.metersPerUnit > 0 ? diagnostics.metersPerUnit : 10;
  const baseClearColor = scene.clearColor.clone();
  const baseAmbient = scene.ambientColor.clone();
  const originalLights = scene.lights.map((light) => ({ light, intensity: light.intensity, diffuse: light.diffuse.clone(), specular: light.specular.clone() }));
  const floorSnapshots = new Map<AbstractMesh, MeshSnapshot>();
  const clonedMaterials = new Set<Material>();
  const themeMeshes: LinesMesh[] = [];
  const measurementMeshes: LinesMesh[] = [];
  let disposed = false;
  let lighting: LightingMode = 'guide';
  let floorReport: FloorReport = { applied: true, reason: '외관을 표시합니다.', floorId: null, mode: 'exterior', meshCount: 0 };
  let themeReport: ThemeReport = { theme: 'default', at: new Date().toISOString(), items: [], legend: [], unavailable: 0, note: PUBLIC_NOTE };
  let measurement: SpatialMeasurement | null = null;

  const assertActive = () => { if (disposed) throw new Error('종료된 장면 고도화 기능입니다.'); };
  function publicEntities(catalog: CampusCatalog): PlatformEntity[] {
    const entities = new Map(catalog.entities.map((entity) => [entity.id, entity]));
    return catalog.entities.filter((entity) => {
      if (entity.visibility !== 'public' || entity.sensitive || entity.campusId !== catalog.activeCampusId) return false;
      const seen = new Set<string>(); let parentId = entity.parentId;
      while (parentId) { const parent = entities.get(parentId); if (!parent || parent.visibility !== 'public' || parent.sensitive || seen.has(parent.id)) return false; seen.add(parent.id); parentId = parent.parentId; }
      return true;
    });
  }
  function copyTheme(): ThemeReport { return { ...themeReport, items: themeReport.items.map((item) => ({ ...item, pointMeters: [...item.pointMeters] })), legend: themeReport.legend.map((item) => ({ ...item })) }; }
  function disposeLines(list: LinesMesh[]): void { list.splice(0).forEach((mesh) => mesh.dispose()); }
  function positionFor(entity: PlatformEntity, map: Map<string, PlatformEntity>): {point: [number, number, number]; indirect: boolean} | null {
    let item: PlatformEntity | undefined = entity; const seen = new Set<string>();
    while (item && !seen.has(item.id)) {
      seen.add(item.id);
      if (item.position && [item.position.east, item.position.north].every(Number.isFinite)) {
        const up = typeof item.position.up === 'number' && Number.isFinite(item.position.up) ? item.position.up : 0;
        return { point: [item.position.east, item.position.north, up], indirect: item.id !== entity.id };
      }
      item = map.get(item.owningBuildingId || item.parentId || '');
    }
    return null;
  }
  function drawTheme(items: ThemeItem[]): void {
    disposeLines(themeMeshes);
    const groups = new Map<string, {item: ThemeItem; lines: Vector3[][]; ids: string[]}>();
    for (const item of items) {
      const [east, north] = item.pointMeters; const x = east / metersPerUnit, z = -north / metersPerUnit;
      const height = site.terrainHeightAt(x, z) + 0.2;
      const radius = 1.8 / metersPerUnit;
      const key = `${item.color}:${item.pattern}`;
      const group = groups.get(key) || { item, lines: [], ids: [] }; group.ids.push(item.entityId);
      for (let index = 0; index < 24; index++) {
        if (item.pattern === 'dot' && index % 3 !== 0 || item.pattern === 'dash' && index % 4 === 3 || item.pattern === 'cross' && index % 2 !== 0) continue;
        const a = index * Math.PI / 12, b = (index + 1) * Math.PI / 12;
        group.lines.push([new B.Vector3(x + Math.cos(a) * radius, height, z + Math.sin(a) * radius), new B.Vector3(x + Math.cos(b) * radius, height, z + Math.sin(b) * radius)]);
      }
      if (item.pattern === 'cross') group.lines.push([new B.Vector3(x - radius, height, z - radius), new B.Vector3(x + radius, height, z + radius)], [new B.Vector3(x - radius, height, z + radius), new B.Vector3(x + radius, height, z - radius)]);
      groups.set(key, group);
    }
    for (const [key, group] of groups) {
      if (!group.lines.length) continue;
      const mesh = B.MeshBuilder.CreateLineSystem(`refinement-theme-${key}`, { lines: group.lines }, scene); mesh.color = B.Color3.FromHexString(group.item.color); mesh.isPickable = false;
      mesh.metadata = { refinementOverlay: 'theme', entityIds: [...group.ids], scope: 'point-only', representsActualArea: false, visualPriority: 'essential' }; themeMeshes.push(mesh);
    }
  }
  function setTheme(theme: SpatialTheme, at = new Date().toISOString()): ThemeReport {
    assertActive();
    if (!['default', 'operations', 'source-confidence', 'lifecycle', 'category', 'none', 'events', 'construction', 'access', 'hours'].includes(theme) || !Number.isFinite(Date.parse(at))) throw new Error('주제 또는 조회 시각이 유효하지 않습니다.');
    const catalog = catalogGetter(); const entities = publicEntities(catalog); const map = new Map(entities.map((entity) => [entity.id, entity])); const sourceIds = new Set(catalog.sources.filter((source) => source.visibility === 'public').map((source) => source.id));
    const items: ThemeItem[] = []; const legend = new Map<string, ThemeReport['legend'][number]>(); let unavailable = 0;
    const add = (entity: PlatformEntity, key: string, label: string, color: string, pattern: string, validUntil: string | null = null) => {
      const position = positionFor(entity, map); if (!position) { unavailable++; return; }
      if (items.length >= 500) { unavailable++; return; }
      items.push({ entityId: entity.id, label: `${label}${position.indirect ? ' · 소속 건물 위치의 공간 기록' : ''}`, color, pattern, scope: 'point-only', pointMeters: position.point, validUntil });
      legend.set(key, { key, label, color, pattern });
    };
    if (['source-confidence', 'lifecycle', 'category'].includes(theme)) {
      const palette = ['#285940', '#497386', '#8c6926', '#865577', '#62665d'];
      for (const entity of entities.filter((entry) => ['building', 'external-facility', 'door'].includes(entry.kind))) {
        if (theme === 'source-confidence') {
          const confirmation = entity.claims.location.confidence; const index = ['verified', 'mapped', 'estimated', 'unverified'].indexOf(confirmation);
          const names = { verified: '검수 확인', mapped: '지도 기반', estimated: '추정', unverified: '미확인' };
          add(entity, confirmation, `위치 근거 ${names[confirmation]}`, palette[Math.max(0, index)], ['solid', 'dash', 'dot', 'cross'][Math.max(0, index)]);
        } else if (theme === 'lifecycle') {
          const index = ['current', 'historic', 'proposed'].indexOf(entity.status); const names = { current: '현재', historic: '과거', proposed: '계획' }; add(entity, entity.status, `자료 상태 ${names[entity.status]}`, palette[Math.max(0, index)], ['solid', 'dot', 'dash'][Math.max(0, index)]);
        } else {
          const key = entity.category || '미분류'; const index = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length; add(entity, key, key, palette[index], index % 2 ? 'dash' : 'solid');
        }
      }
    } else if (['operations', 'access', 'hours'].includes(theme)) {
      const domain = apis().platform; if (!domain) unavailable++;
      else for (const entity of entities.filter((entry) => catalog.operations.some((record) => record.entityId === entry.id))) {
        const status = domain.operationStatus(catalog, entity.id, at); if (theme === 'access' && status.status !== 'closed' || theme === 'hours' && status.status !== 'open') continue;
        const style = status.status === 'closed' ? { color: '#8a4657', pattern: 'cross' } : status.status === 'open' ? { color: '#285940', pattern: 'solid' } : { color: '#767469', pattern: 'dot' };
        add(entity, status.status, status.label, style.color, style.pattern, status.expiresAt);
      }
    } else if (['events', 'construction'].includes(theme)) {
      for (const event of catalog.events) {
        const entity = map.get(event.entityId); if (!entity || event.visibility !== 'public' || !event.sourceIds.length || !event.sourceIds.every((id) => sourceIds.has(id)) || event.status !== 'current' || event.validFrom && Date.parse(event.validFrom) > Date.parse(at)) continue;
        if (theme === 'construction' && !/공사|construction/i.test(event.title)) continue;
        const expired = Boolean(event.validUntil && Date.parse(event.validUntil) <= Date.parse(at)); add(entity, expired ? 'expired' : 'event', `${event.title}${expired ? ' · 기간 만료' : ''}`, expired ? '#767469' : '#8c6926', expired ? 'dot' : 'dash', event.validUntil);
      }
    }
    themeReport = { theme, at: new Date(at).toISOString(), items, legend: [...legend.values()], unavailable, note: PUBLIC_NOTE }; drawTheme(items); return copyTheme();
  }
  function setLighting(mode: LightingMode): {mode: LightingMode; simulated: boolean; realSolarAnalysis: false} {
    assertActive(); if (!['guide', 'observe', 'evening'].includes(mode)) throw new Error('지원하지 않는 조명입니다.');
    lighting = mode;
    for (const saved of originalLights) {
      if (saved.light.isDisposed()) continue;
      saved.light.intensity = mode === 'guide' ? saved.intensity : mode === 'observe' ? saved.intensity * 1.15 : saved.intensity * 0.65;
      saved.light.diffuse.copyFrom(mode === 'evening' ? B.Color3.FromHexString('#edc69b') : saved.diffuse); saved.light.specular.copyFrom(saved.specular);
    }
    scene.clearColor.copyFrom(mode === 'evening' ? new B.Color4(0.46, 0.48, 0.45, 1) : baseClearColor); scene.ambientColor.copyFrom(baseAmbient);
    return { mode, simulated: mode !== 'guide', realSolarAnalysis: false };
  }
  function restoreFloors(): void {
    for (const [mesh, saved] of floorSnapshots) {
      if (mesh.isDisposed()) continue;
      mesh.setEnabled(saved.enabled); mesh.isVisible = saved.visible; mesh.visibility = saved.visibility; mesh.position.copyFrom(saved.position); mesh.material = saved.material;
    }
    floorSnapshots.clear(); for (const material of clonedMaterials) material.dispose(false, false); clonedMaterials.clear();
  }
  function semanticMeshes(entities: PlatformEntity[]): SemanticMesh[] {
    const map = new Map(entities.map((entity) => [entity.id, entity])); const result: SemanticMesh[] = [];
    for (const mesh of scene.meshes) {
      if (mesh.isDisposed() || isRecord(mesh.metadata) && mesh.metadata.refinementOverlay) continue;
      let entityId: string | null = null, floorId: string | null = null;
      let node: typeof mesh.parent | AbstractMesh = mesh; const seen = new Set<number>();
      while (node && !seen.has(node.uniqueId)) {
        seen.add(node.uniqueId); const metadata: unknown = node.metadata;
        if (isRecord(metadata)) {
          const gltf = isRecord(metadata.gltf) ? metadata.gltf : null;
          const groups = [metadata, isRecord(metadata.extras) ? metadata.extras : null, gltf && isRecord(gltf.extras) ? gltf.extras : null];
          for (const group of groups) if (group) { if (!entityId && typeof group.entityId === 'string') entityId = group.entityId; if (!floorId && typeof group.floorId === 'string') floorId = group.floorId; }
        }
        node = node.parent;
      }
      // Unknown/private semantic IDs cannot be rescued by an otherwise public
      // floor ID; the importer must explicitly assign a public mapping.
      if (entityId && !map.has(entityId) || floorId && !map.has(floorId)) continue;
      const entity = entityId ? map.get(entityId) || null : null;
      const floor = floorId ? map.get(floorId) || null : entity?.kind === 'floor' ? entity : entity?.floorId ? map.get(entity.floorId) || null : null;
      if (floor && floor.kind !== 'floor') continue;
      const buildingId = floor?.owningBuildingId || entity?.owningBuildingId || (entity?.kind === 'building' ? entity.id : null);
      if (buildingId && map.get(buildingId)?.kind === 'building') result.push({ mesh, entity, floor, buildingId });
    }
    return result;
  }
  function reviewed(claim: EvidenceClaim, catalog: CampusCatalog): boolean {
    const publicSources = new Set(catalog.sources.filter((source) => source.visibility === 'public').map((source) => source.id));
    return ['verified', 'mapped'].includes(claim.confidence) && claim.sourceIds.length > 0 && claim.sourceIds.every((id) => publicSources.has(id)) && Boolean(claim.dates.reviewedAt && Number.isFinite(Date.parse(claim.dates.reviewedAt)) && Date.parse(claim.dates.reviewedAt) <= Date.now());
  }
  function validFloor(floor: PlatformEntity | null, catalog: CampusCatalog): floor is PlatformEntity & {position: {east: number;north: number;up: number}} {
    return Boolean(floor?.kind === 'floor' && floor.position && typeof floor.position.up === 'number' && Number.isFinite(floor.position.up) && reviewed(floor.claims.location, catalog) && reviewed(floor.claims.height, catalog));
  }
  function setFloorView(floorId: string, mode: FloorView): FloorReport {
    assertActive(); if (!['exterior', 'cut', 'isolate', 'explode'].includes(mode)) throw new Error('지원하지 않는 층 보기입니다.');
    restoreFloors();
    const unavailable = (reason: string): FloorReport => { floorReport = { applied: false, reason, floorId: floorId || null, mode, meshCount: 0 }; return { ...floorReport }; };
    if (mode === 'exterior') { floorReport = { applied: true, reason: '원래 외관과 재질을 복원했습니다.', floorId: null, mode, meshCount: 0 }; return { ...floorReport }; }
    const catalog = catalogGetter(); const entities = publicEntities(catalog); const floor = entities.find((entity) => entity.id === floorId) || null;
    if (!validFloor(floor, catalog)) return unavailable('공개된 층 표고와 위치·높이 검수 근거가 필요합니다. 개념 실내도에는 적용하지 않습니다.');
    const buildingId = floor.owningBuildingId; if (!buildingId) return unavailable('층의 소속 건물이 등록되지 않았습니다.');
    const targets = semanticMeshes(entities).filter((item) => item.buildingId === buildingId && item.mesh.isEnabled());
    if (targets.length > 2048) return unavailable('개별 층 보기 예산인 2048개 메쉬를 초과했습니다. 자산 최적화와 분할 검수가 필요합니다.');
    if (!targets.length || mode !== 'cut' && !targets.some((item) => item.floor?.id === floor.id)) return unavailable('공개 공간 ID와 실제 메쉬의 층 매핑이 필요합니다.');
    const floors = entities.filter((entity) => entity.owningBuildingId === buildingId && validFloor(entity, catalog));
    if (mode === 'explode' && new Set(targets.map((item) => item.floor?.id).filter((id) => id && floors.some((entry) => entry.id === id))).size < 2) return unavailable('분리 보기에는 검수된 두 개 이상의 층 메쉬가 필요합니다.');
    let applied = 0;
    for (const item of targets) {
      const mesh = item.mesh; floorSnapshots.set(mesh, { enabled: mesh.isEnabled(false), visible: mesh.isVisible, visibility: mesh.visibility, position: mesh.position.clone(), material: mesh.material });
      if (mode === 'isolate') { mesh.isVisible = item.floor?.id === floor.id; applied++; }
      else if (mode === 'explode') {
        if (!item.floor || !validFloor(item.floor, catalog)) { mesh.isVisible = false; continue; }
        const minimum = Math.min(...floors.map((entry) => entry.position?.up ?? floor.position.up)); const shift = (item.floor.position.up - minimum) * 0.6 / metersPerUnit;
        let ancestor = mesh.parent; let inheritedShift = false;
        while (ancestor) { const parent = targets.find((candidate) => candidate.mesh === ancestor); if (parent?.floor?.id === item.floor.id) { inheritedShift = true; break; } ancestor = ancestor.parent; }
        if (inheritedShift) { applied++; continue; }
        const delta = new B.Vector3(0, shift, 0); if (mesh.parent) { mesh.parent.computeWorldMatrix(true); delta.copyFrom(B.Vector3.TransformNormal(delta, B.Matrix.Invert(mesh.parent.getWorldMatrix()))); }
        mesh.position.addInPlace(delta); applied++;
      } else if (mesh.material && !(mesh.material instanceof B.MultiMaterial)) {
        const material = mesh.material.clone(`refinement-floor-${floor.id}-${mesh.uniqueId}`); if (!material) continue;
        material.unfreeze(); const building = entities.find((entity) => entity.id === buildingId); const exaggeration = Number(site.getDiagnostics().verticalExaggeration) || 1;
        const anchor = typeof building?.position?.up === 'number' ? building.position.up : 0;
        const cutHeight = (floor.position.up + anchor * (exaggeration - 1)) / metersPerUnit;
        material.clipPlane = new B.Plane(0, 1, 0, -cutHeight); mesh.material = material; clonedMaterials.add(material); applied++;
      }
    }
    if (!applied) { restoreFloors(); return unavailable('이 자산의 재질 또는 층 매핑에 적용 가능한 공개 메쉬가 없습니다.'); }
    floorReport = { applied: true, reason: mode === 'cut' ? '등록된 층 기준 표고에서 선택 건물의 상부를 절단합니다.' : mode === 'explode' ? '검수된 층 메쉬를 설명용으로 분리합니다. 실제 층 높이는 변경하지 않습니다.' : '등록된 선택 층 메쉬를 표시합니다.', floorId, mode, meshCount: applied }; return { ...floorReport };
  }
  function clearMeasurement(): void { disposeLines(measurementMeshes); measurement = null; }
  function setMeasurement(kind: MeasurementKind, points: PointMeters[]): SpatialMeasurement {
    assertActive(); const domain = apis().refinement; if (!domain) throw new Error('측정 규칙 모듈을 불러오지 못했습니다.');
    if (!Array.isArray(points) || points.length > 1000) throw new Error('장면 측정은 최대 1000점까지 지원합니다.');
    // Calculate from the entered meter coordinates. Height is never silently
    // invented for a height-difference request with two-dimensional points.
    const result = domain.measureGeometry(points, kind, { confirmation: 'estimated', version: catalogGetter().contentVersion });
    const notes = ['실측 오차가 확인되지 않은 참고 측정입니다.', '안내 영역 면적은 법적 부지 면적이 아닙니다.'];
    const worldPoints = points.map((point) => {
      const x = point[0] / metersPerUnit, z = -point[1] / metersPerUnit;
      return new B.Vector3(x, point.length === 3 ? point[2] / metersPerUnit : site.terrainHeightAt(x, z) + 0.1, z);
    });
    if (Number(site.getDiagnostics().verticalExaggeration) !== 1) notes.push('화면에 지형 강조가 적용됐습니다. 측정 수치는 입력 원좌표로 계산합니다.');
    const newMesh = B.MeshBuilder.CreateLines('refinement-measurement', { points: worldPoints }, scene); newMesh.color = B.Color3.FromHexString('#6c3f70'); newMesh.isPickable = false; newMesh.metadata = { refinementOverlay: 'measurement', confirmation: 'estimated', measured: false, kind, visualPriority: 'essential' };
    const markers: Vector3[][] = worldPoints.map((point) => [point.add(new B.Vector3(-0.08, 0, 0)), point.add(new B.Vector3(0.08, 0, 0))]);
    const markerMesh = B.MeshBuilder.CreateLineSystem('refinement-measurement-points', { lines: markers }, scene); markerMesh.color = newMesh.color; markerMesh.isPickable = false; markerMesh.metadata = { ...newMesh.metadata };
    clearMeasurement(); measurementMeshes.push(newMesh, markerMesh); measurement = { ...result, kind, worldPoints: worldPoints.map((point) => point.asArray()), notes, displayedPointCount: points.length };
    return { ...measurement, worldPoints: measurement.worldPoints.map((point) => [...point]), notes: [...measurement.notes] };
  }
  function copyMeasurement(value: SpatialMeasurement): SpatialMeasurement { return { ...value, worldPoints: value.worldPoints.map((point) => [...point]), notes: [...value.notes], ...(value.worldRings ? { worldRings: value.worldRings.map((ring) => ({ ...ring, points: ring.points.map((point) => [...point]) })) } : {}) }; }
  function setOutlineMeasurement(geometry: SpatialGeometry): SpatialMeasurement {
    assertActive(); const { refinement, platform } = apis(); if (!refinement || !platform) throw new Error('윤곽 측정 검증 모듈을 불러오지 못했습니다.');
    const catalog = catalogGetter();
    if (geometry?.originId !== catalog.activeCampusId) throw new Error('현재 캠퍼스의 좌표 기준으로 변환된 윤곽이 필요합니다.');
    const result = measureOutlineGeometry(geometry, refinement.measureGeometry, catalog.contentVersion);
    const candidate = { ...catalog, entities: catalog.entities.map((entity, index) => index === 0 ? { ...entity, geometry } : entity) };
    const validation = platform.validateCatalog(candidate); if (!validation.valid) throw new Error(`윤곽 검증에 실패했습니다. ${validation.errors.join(' ')}`);
    const publicSources = new Set(catalog.sources.filter((source) => source.visibility === 'public').map((source) => source.id));
    if (!geometry.sourceIds.every((id) => publicSources.has(id))) throw new Error('공개 출처가 확인된 윤곽만 측정할 수 있습니다.');
    const worldRings = result.rings.map((ring) => ({ polygonIndex: ring.polygonIndex, role: ring.role, points: ring.points.map((point) => { const x = point[0] / metersPerUnit, z = -point[1] / metersPerUnit; return new B.Vector3(x, site.terrainHeightAt(x, z) + 0.1, z); }) }));
    const newMeshes: LinesMesh[] = [];
    for (const role of ['outer', 'hole'] as const) {
      const lines = worldRings.filter((ring) => ring.role === role).map((ring) => ring.points); if (!lines.length) continue;
      const mesh = B.MeshBuilder.CreateLineSystem(`refinement-measurement-${role}`, { lines }, scene); mesh.color = B.Color3.FromHexString(role === 'outer' ? '#6c3f70' : '#a2602e'); mesh.isPickable = false;
      mesh.metadata = { refinementOverlay: 'measurement', confirmation: 'estimated', measured: false, kind: 'area', ringRole: role, visualPriority: 'essential' }; newMeshes.push(mesh);
    }
    const notes = ['모든 외곽 링의 면적을 합산하고 각 내부 공제 링을 뺐습니다.', '실측 오차가 확인되지 않은 참고 측정입니다.', '안내 영역 면적은 법적 부지 면적이 아닙니다.'];
    if (Number(site.getDiagnostics().verticalExaggeration) !== 1) notes.push('화면에 지형 강조가 적용됐습니다. 측정 수치는 입력 원좌표로 계산합니다.');
    clearMeasurement(); measurementMeshes.push(...newMeshes);
    measurement = { value: result.value, unit: result.unit, approximate: result.approximate, uncertainty: result.uncertainty, version: result.version, points: result.points, kind: 'area', polygonCount: result.polygonCount, holeCount: result.holeCount, worldPoints: worldRings.flatMap((ring) => ring.points.map((point) => point.asArray())), worldRings: worldRings.map((ring) => ({ ...ring, points: ring.points.map((point) => point.asArray()) })), notes, displayedPointCount: result.points };
    return copyMeasurement(measurement);
  }
  return {
    setTheme, setLighting, setFloorView, setMeasurement, setOutlineMeasurement, clearMeasurement,
    getDiagnostics() { return { theme: copyTheme(), lighting, lightingIsSolarAnalysis: false, floor: { ...floorReport }, measurement: measurement ? copyMeasurement(measurement) : null, overlayMeshCount: themeMeshes.length + measurementMeshes.length, clonedMaterialCount: clonedMaterials.size, disposed }; },
    dispose() { if (disposed) return; restoreFloors(); disposeLines(themeMeshes); clearMeasurement(); setLighting('guide'); disposed = true; }
  };
}

export type RefinementRuntime = ReturnType<typeof createRefinementRuntime>;
