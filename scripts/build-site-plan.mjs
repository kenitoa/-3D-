import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceDirectory = path.join(root, 'evidence');
await mkdir(evidenceDirectory, { recursive: true });
const context = vm.createContext({ window: {} });
vm.runInContext(await readFile(path.join(root, 'src/domain/site-geometry.js'), 'utf8'), context);
vm.runInContext(await readFile(path.join(root, 'src/data/campus-data.js'), 'utf8'), context);
const geometry = context.SiteGeometry;
const legacy = context.window.CampusData;
const officialUrl = 'https://www.hs.ac.kr/kor/4891/subview.do';
let sourceManifest = null;
try { sourceManifest = JSON.parse(await readFile(path.join(evidenceDirectory, 'source-manifest.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
let markerDocument;
if (process.argv.includes('--extract-markers')) {
  const collectionManifest = JSON.parse(await readFile(path.join(evidenceDirectory, 'collection-manifest.json'), 'utf8'));
  const officialCollection = collectionManifest.sources?.find((source) => source.file === 'hanshin-campus-tour.html' && source.status !== 'unavailable');
  if (!officialCollection?.collectedAt || !officialCollection.sha256) throw new Error('A successful recorded official HTML collection is required for --extract-markers.');
  const officialHtml = await readFile(path.join(evidenceDirectory, 'hanshin-campus-tour.html'), 'utf8');
  const inputHash = createHash('sha256').update(officialHtml).digest('hex');
  if (inputHash !== officialCollection.sha256) throw new Error('Collected HTML checksum does not match its manifest. Refusing to extract changed input.');
  const field = (key, index) => officialHtml.match(new RegExp(`id="${key}_${index}"\\s+value="([^"]*)"`))?.[1];
  const extractedMarkers = [];
  for (let index = 1; index <= 30; index++) {
    const name = field('artclSj', index); const lat = Number(field('latitude', index)); const lon = Number(field('longitude', index));
    if (name && Number.isFinite(lat) && Number.isFinite(lon) && lat > 30 && lon > 120) extractedMarkers.push({ index, name, lat, lon, photoUrl: new URL((field('imgPath', index) ?? '') + (field('changeNm', index) ?? ''), officialUrl).href });
  }
  markerDocument = { sourceUrl: officialUrl, referenceDate: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(officialCollection.collectedAt)), generatedAt: new Date().toISOString(), sourceHtmlSha256: inputHash, hashScope: 'Downloaded HTML bytes validated against collection manifest', coordinateRole: 'Official website map markers, not measured building centroids or surveyed coordinates', markers: extractedMarkers };
} else {
  // Committed fact extraction is the default input. Raw HTML/PDF/PNG are optional local review copies.
  markerDocument = JSON.parse(await readFile(path.join(evidenceDirectory, 'official-campus-markers.json'), 'utf8'));
}
if (markerDocument.sourceUrl !== officialUrl || !/^\d{4}-\d{2}-\d{2}$/.test(markerDocument.referenceDate ?? '') || !/^[a-f0-9]{64}$/.test(markerDocument.sourceHtmlSha256 ?? '')) throw new Error('Official marker provenance, date and checksum must be preserved.');
const markers = markerDocument.markers;
if (!Array.isArray(markers) || markers.length < 15 || new Set(markers.map((marker) => marker.index)).size !== markers.length || !markers.every((marker) => Number.isInteger(marker.index) && typeof marker.name === 'string' && marker.name.trim() && Number.isFinite(marker.lat) && Number.isFinite(marker.lon) && marker.lat > 30 && marker.lat < 40 && marker.lon > 120 && marker.lon < 135)) throw new Error('At least 15 unique, valid official guide markers are required.');
for (let index = 1; index <= 15; index++) if (!markers.some((marker) => marker.index === index)) throw new Error(`Required official guide marker ${index} is missing.`);
const referenceDate = markerDocument.referenceDate;
const originalHash = markerDocument.sourceHtmlSha256;
const generatedAt = process.argv.includes('--extract-markers') ? markerDocument.generatedAt : (sourceManifest?.generatedAt ?? markerDocument.generatedAt);
if (process.argv.includes('--extract-markers')) await writeFile(path.join(evidenceDirectory, 'official-campus-markers.json'), JSON.stringify(markerDocument, null, 2) + '\n');
const records = [
  ['janggong', 1, 1, 6.2, 2.05], ['pilheon', 2, 2, 3.1, 1.45], ['manwoo', 6, 3, 6.4, 2.85], ['shalom', 13, 4, 3.5, 2.35],
  ['immanuel', 10, 5, 3.5, 1.65], ['gyeongsam', 4, 6, 4.25, 2.1], ['songam', 9, 7, 4.05, 2.1], ['sotong', 7, 8, 3.45, 2.05],
  ['practice', 15, 9, 3.1, 1.9], ['hanul', 11, 10, 5, 3], ['seongbin', 8, 11, 4.5, 2.25], ['saerom', null, 14, 2.45, 1.7],
  ['haeoreum', 12, 17, 3.55, 1.85], ['joonha', 3, 18, 4.05, 2.25], ['neutbom', 5, 20, 4, 1.85], ['childcare', 14, 32, 3.1, 1.9]
];
const originMarker = markers.find((marker) => marker.index === 1);
const origin = { lat: originMarker.lat, lon: originMarker.lon };
const allAnchors = records.filter((record) => record[1] !== null).map(([id, index]) => { const marker = markers.find((candidate) => candidate.index === index); return { id, source: legacy.campusBoundary.anchors[id], target: geometry.projectWgs84(marker, origin), marker }; });
const digitization = JSON.parse(await readFile(path.join(evidenceDirectory, 'campus-map-digitization.json'), 'utf8'));
const pixelAnchors = allAnchors.map((anchor) => ({ id: anchor.id, source: digitization.markerPixels[anchor.id], target: anchor.target }));
const illustrationTransform = geometry.fitAffine(pixelAnchors.filter((anchor) => digitization.globalCalibrationIds.includes(anchor.id)));
const illustrationResiduals = geometry.anchorResiduals(pixelAnchors.filter((anchor) => !digitization.globalCalibrationIds.includes(anchor.id)), illustrationTransform, digitization.globalCalibrationIds);
const pixelToMeters = (point, anchorIds) => {
  const anchors = pixelAnchors.filter((anchor) => anchorIds.includes(anchor.id));
  const [a, b, c] = anchors.map((anchor) => anchor.source);
  const first = [b[0] - a[0], b[1] - a[1]]; const second = [c[0] - a[0], c[1] - a[1]];
  const sine = Math.abs(first[0] * second[1] - first[1] * second[0]) / (Math.hypot(...first) * Math.hypot(...second));
  // Near-collinear points produce unbounded extrapolation in oblique artwork. Prefer the stable global registration in that case.
  return geometry.applyAffine(point, sine < 0.2 ? illustrationTransform : geometry.fitAffine(anchors));
};
const saeromReference = digitization.points.find((point) => point.id === 'saerom-marker');
const trainingIds = ['janggong', 'hanul', 'joonha', 'neutbom'];
const legacyToMeters = geometry.fitAffine(allAnchors.filter((anchor) => trainingIds.includes(anchor.id)));
const metersToLegacy = geometry.invertAffine(legacyToMeters);
const residuals = geometry.anchorResiduals(allAnchors.filter((anchor) => !trainingIds.includes(anchor.id)), legacyToMeters, trainingIds);
const oldTransform = { x: legacy.roadNetwork.transform.x, y: legacy.roadNetwork.transform.z };
const oldToGeographic = geometry.invertAffine(oldTransform);
const osmSnapshotLegacyToMeters = (point) => { const [lon, lat] = geometry.applyAffine(point, oldToGeographic); return geometry.projectWgs84({ lat, lon }, origin); };
const osmOrigin = osmSnapshotLegacyToMeters([0, 0]); const osmX = osmSnapshotLegacyToMeters([1, 0]); const osmY = osmSnapshotLegacyToMeters([0, 1]);
const osmSnapshotTransform = { x: [osmX[0] - osmOrigin[0], osmY[0] - osmOrigin[0], osmOrigin[0]], y: [osmX[1] - osmOrigin[1], osmY[1] - osmOrigin[1], osmOrigin[1]] };
const sources = [
  { id: 'hanshin-official-tour', title: '한신대학교 공식 캠퍼스투어 안내 마커', url: officialUrl, date: referenceDate, scope: '현재 건물명과 공개 지도 안내 마커 15개. 마커 작성일·측량 정확도 미제공.', confidence: 'verified', localFile: 'evidence/official-campus-markers.json', usage: '사실 정보 추출 및 출처 표시. 사진은 원문 링크만 제공하며 재배포하지 않음.' },
  { id: 'osm-2026-05-11', title: '기존 OSM 도로·보행로 기록', url: 'https://www.openstreetmap.org/copyright', date: '2026-05-11', scope: '기존 campus-data.js의 OSM way ID와 반올림된 변환 선형을 역변환. 원본 node ID·폭·최신 변경 미검증.', confidence: 'mapped', localFile: 'evidence/legacy-spatial-snapshot.json', usage: '© OpenStreetMap contributors, ODbL 1.0. 파생 공간 데이터의 출처 및 라이선스 유지.' },
  { id: 'legacy-capture', title: '기존 제공 지도 기반 모델링 영역', url: '', date: '2026-05-11', scope: '기존 campusBoundary 모델링 폴리곤. 원본 지도 캡처·지적 경계 좌표 없음.', confidence: 'estimated', usage: '프로젝트의 기존 추정 모델 데이터이며 공적 경계 자료가 아님.' },
  { id: 'legacy-model-envelope', title: '기존 상세 모델의 공간 추정', url: '', date: referenceDate, scope: '기존 exclusion envelope, 지형 패치, 진입 방향·운동장 앵커. 실제 footprint/시설 외곽 미확인.', confidence: 'estimated', usage: '표시용 개념 모델. 측량·면적·출입구 확정 자료로 사용하지 않음.' },
  { id: 'hanshin-2026-guide-illustration', title: '2026학년도 공식 모집요강 캠퍼스 안내 삽화', url: digitization.sourceUrl, date: referenceDate, scope: 'PDF 38~39페이지 조감 삽화의 운동장·테니스·주차 29/30/31·공원·연못·출입구를 직접 검토 후 픽셀 관찰. 정사영상이나 측량도면 아님.', confidence: 'estimated', localFile: 'evidence/campus-map-digitization.json', usage: '시설의 사실 정보·관찰 좌표와 출처만 앱에 포함. 원본 PDF·렌더 이미지는 로컬 검토 자료이며 배포 대상에서 제외.' },
  { id: 'eum-2021-54', title: '오산시 고시 제2021-54호', url: 'https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=502075&mobile_yn=', date: '2021-03-22', scope: '도시계획시설 한신대학교 결정 변경 및 지형도면 고시 존재 확인. 첨부 도면·최신 변경·소유권 미검증.', confidence: 'verified', usage: '공적 경계 확인을 위한 참고 링크. 도면 좌표 미확보.' }
];
const makeFeature = (id, name, kind, geometryType, pointsMeters, sourceId, confidence = 'estimated', extra = {}) => ({ id, name, kind, geometryType, pointsMeters, pointsLegacy: pointsMeters.map((point) => geometry.applyAffine(point, metersToLegacy)), sourceId, confidence, status: confidence === 'estimated' ? 'unverified' : 'snapshot-not-currently-verified', tags: {}, ...extra });
const angleRadians = Math.atan2(legacyToMeters.y[0], legacyToMeters.x[0]);
const buildings = records.map(([id, , number, halfX, halfY]) => {
  const anchorLegacy = legacy.campusBoundary.anchors[id]; const known = allAnchors.find((anchor) => anchor.id === id);
  const anchorMeters = known?.target ?? (id === 'saerom' ? pixelToMeters(saeromReference.pixel, saeromReference.referenceAnchors) : geometry.applyAffine(anchorLegacy, legacyToMeters)); const baselineCenter = geometry.applyAffine(anchorLegacy, legacyToMeters);
  const rectangle = [[anchorLegacy[0] - halfX, anchorLegacy[1] - halfY], [anchorLegacy[0] + halfX, anchorLegacy[1] - halfY], [anchorLegacy[0] + halfX, anchorLegacy[1] + halfY], [anchorLegacy[0] - halfX, anchorLegacy[1] + halfY]];
  const points = rectangle.map((point) => { const projected = geometry.applyAffine(point, legacyToMeters); return [projected[0] - baselineCenter[0] + anchorMeters[0], projected[1] - baselineCenter[1] + anchorMeters[1]]; });
  const name = known ? known.marker.name.replace(/^\d+\s*/, '') : '새롬터';
  const entry = legacy.entranceDirections.find((candidate) => candidate.osmBuilding && candidate.name.includes(number === 32 ? '어린이집' : `${number}동`));
  return makeFeature(id, name, 'building', 'polygon', points, 'legacy-model-envelope', 'estimated', { legacyKey: id, number, aliases: id === 'practice' ? ['실습동', '학과실습동', '창업보육센터'] : id === 'joonha' ? ['60주년기념관'] : [], anchor: { meters: anchorMeters, legacy: anchorLegacy, sourceId: known ? 'hanshin-official-tour' : 'hanshin-2026-guide-illustration', status: known ? 'official-guide-marker-not-surveyed' : 'illustration-derived-estimated' }, anchorMeters, angleRadians, rotationRadians: angleRadians, rotationStatus: 'estimated-legacy-model-axis', footprintMeters: points, footprintStatus: 'estimated-existing-model-envelope', markerSourceId: known ? 'hanshin-official-tour' : null, photoUrl: known?.marker.photoUrl ?? null, osmWay: entry?.osmBuilding ?? null, entrance: entry ? { status: 'estimated-position-and-direction', sourceId: 'legacy-model-envelope' } : null });
});
const digitizedFacilities = digitization.facilities.map((facility) => makeFeature(facility.id, facility.name, facility.kind, 'polygon', facility.pointsPixels.map((point) => pixelToMeters(point, facility.referenceAnchors)), 'hanshin-2026-guide-illustration', 'estimated', { number: facility.number, status: 'illustration-derived-estimated', extentStatus: 'estimated-illustration-observation-not-surveyed', sourcePixels: facility.pointsPixels, referenceAnchors: facility.referenceAnchors, capacityStatus: 'unknown', note: '조감 삽화에서 관찰한 개략 구획. 원근법·지붕 높이·마커 오차 때문에 실제 외곽·규격과 다를 수 있으며 면적/소유권 자료가 아님.' }));
const digitizedEntrances = digitization.points.filter((point) => point.kind === 'campus-entrance').map((point) => makeFeature(point.id, point.name, point.kind, 'point', [pixelToMeters(point.pixel, point.referenceAnchors)], 'hanshin-2026-guide-illustration', 'estimated', { number: point.number, status: 'illustration-derived-estimated', sourcePixel: point.pixel, referenceAnchors: point.referenceAnchors, directionStatus: 'unverified' }));
const originalOutline = legacy.campusBoundary.points.map((point) => geometry.applyAffine(point, legacyToMeters));
const originalBoundary = makeFeature('legacy-original-outline', '기존 제공 지도 기반 안내 범위', 'campus', 'polygon', originalOutline, 'legacy-capture');
// A visual envelope cannot establish ownership. Preserve original outline separately and mark all additions as inference.
const missingFootprints = [...buildings, ...digitizedFacilities, ...digitizedEntrances].flatMap((feature) => feature.pointsMeters).filter((point) => !geometry.pointInPolygon(point, originalOutline));
const campusPoints = missingFootprints.length ? geometry.convexHull([...originalOutline, ...missingFootprints]) : originalOutline;
const campusMapped = makeFeature('campus-guide-envelope', '한신대학교 경기캠퍼스 추정 안내 영역', 'campus', 'polygon', campusPoints, 'legacy-capture', 'estimated', { label: '제공 지도·공식 안내 마커 기반 추정 안내 영역', boundaryType: 'inferred-visual-guide-envelope', areaSquareMeters: geometry.polygonArea(campusPoints), areaStatus: 'inferred-model-envelope-not-official-site-area', isLegalBoundary: false, method: missingFootprints.length ? 'convex envelope of existing map outline and estimated building envelopes; additions explicitly inferred' : 'existing supplied-map model polygon', inferredExtensions: missingFootprints.length });
const routes = (ways, kind) => ways.map((way, index) => makeFeature(`osm-way-${way.osmWay}-${index}`, way.name, kind, 'line', way.points.map(osmSnapshotLegacyToMeters), 'osm-2026-05-11', 'mapped', { osmWay: way.osmWay, widthMeters: way.width * 10, widthStatus: 'estimated-legacy-display-width', tags: { highway: way.highway }, topology: 'coordinate-derived; original OSM node IDs unavailable; crossing grades and access unverified' }));
const roads = routes(legacy.roadNetwork.vehicleRoads, 'road'); const paths = routes(legacy.roadNetwork.pedestrianPaths ?? legacy.roadNetwork.walkways ?? [], 'path');
const greenery = legacy.terrain.slopePatches.filter((patch) => patch.kind === 'forest').map((patch) => makeFeature(patch.name, '수목 사면 추정 구역', 'forest', 'polygon', patch.points.map((point) => geometry.applyAffine(point, legacyToMeters)), 'legacy-model-envelope', 'estimated', { placementMode: 'estimated-canopy-clusters', surveyedTrees: false })).concat(digitizedFacilities.filter((feature) => feature.kind === 'park'));
const entrances = legacy.entranceDirections.map((entry) => {
  const building = buildings.find((candidate) => candidate.osmWay === entry.osmBuilding);
  const center = building?.anchorMeters ?? geometry.applyAffine(entry.door, legacyToMeters); const originalCenter = building ? geometry.applyAffine(building.anchor.legacy, legacyToMeters) : center;
  const points = [entry.door, entry.approach].map((point) => { const position = geometry.applyAffine(point, legacyToMeters); return [position[0] + center[0] - originalCenter[0], position[1] + center[1] - originalCenter[1]]; });
  return makeFeature(`entrance-${building?.id ?? entry.osmBuilding}`, `${entry.name} 추정 진입 방향`, 'building-entrance', 'line', points, 'legacy-model-envelope', 'estimated', { buildingId: building?.id, directionStatus: 'photo-reference-and-legacy-model-inference-not-surveyed', tags: { entrance: 'estimated' } });
});
entrances.push(...digitizedEntrances);
const sports = digitizedFacilities.filter((feature) => feature.kind === 'sports');
const parking = digitizedFacilities.filter((feature) => feature.kind === 'parking');
const water = digitizedFacilities.filter((feature) => feature.kind === 'water').concat([makeFeature('hwangguji-direction-reference', '황구지천 방향 참고', 'waterway', 'line', [[-66, 35], [66, 35]].map((point) => geometry.applyAffine(point, legacyToMeters)), 'legacy-model-envelope', 'estimated', { surveyedCenterline: false, widthStatus: 'unknown', note: '기존 지형 설명의 수변 방향을 나타낸 추정선. 실제 하천 중심선/제방/소유경계 미검증.' })]);
const surrounding = roads.filter((road) => !road.pointsMeters.some((point) => geometry.pointInPolygon(point, campusPoints))).map((road) => ({ ...road, kind: 'surrounding-road' }));
const unknown = ['최신 OSM 캠퍼스 면적 폴리곤과 건물 footprint 원본: 조회 서버 오류로 확보하지 못함', '법적 소유 경계, 필지 경계와 최신 도시계획시설 지형도면 좌표', '최신 정사영상·항공사진과 촬영일, 정밀 DEM 및 건물 대지 레벨', '개별 건물의 실제 footprint, 높이, 정면 방향·출입구·실내 평면', '운동장·주차장·테니스장·녹지·하천의 실제 외곽과 수목 위치', '보행로 접근 권한, 교차 지점의 연결·등급 분리, 경사·계단·무장애 이동 조건', '기존 190,636㎡ 등 면적·457대 주차값의 원자료와 집계 대상'];
const verification = { latestOsm: 'unavailable', latestOsmAttempts: ['Overpass main: HTTP 504 then 406', 'Overpass kumi: timeout', 'OSM API map and full way: HTTP 429'], officialMarkerCount: markers.length, illustratedFacilityPolygonCount: digitizedFacilities.length, illustratedEntranceCount: digitizedEntrances.length, legalBoundary: 'unverified', cadastralBoundary: 'unverified', aerialImagery: 'unverified', surveyedElevation: 'unverified', surveyedFootprints: 'unverified', calibration: { trainingIds, validationIds: residuals.samples.map((sample) => sample.id), ...residuals, interpretation: 'Held-out official guide markers versus legacy model-anchor fit. This measures registration error, not survey accuracy.' }, illustrationRegistration: { trainingIds: digitization.globalCalibrationIds, ...illustrationResiduals, method: 'Global fit diagnostics on held-out guide markers. Facilities use specified nearby three-anchor fits; local fits are estimates, not independently surveyed.', interpretation: 'Oblique illustration has inherent perspective and roof marker errors; dimensions remain unverified.' }, missingFootprintsFromOriginalOutline: missingFootprints.length, buildingAnchorsInsideGuideEnvelope: buildings.every((building) => geometry.pointInPolygon(building.anchorMeters, campusPoints)), facilityRingsInsideGuideEnvelope: digitizedFacilities.every((feature) => feature.pointsMeters.every((point) => geometry.pointInPolygon(point, campusPoints))) };
const data = { version: 1, metadata: { title: '한신대학교 경기캠퍼스 전체 조감도', campus: 'gyeonggi', address: '경기도 오산시 한신대길 137', referenceDate, sources, legalBoundaryVerified: false, displayedBoundary: 'inferred-visual-guide-envelope', metersPerWorldUnit: 10 }, projection: { kind: 'local-linear-WGS84', origin, unit: 'm', axes: ['east', 'north'], validity: 'within 0.1 degree of origin; campus-context use only', verticalDatum: 'unverified' }, transforms: { legacyToMeters, metersToLegacy, osmSnapshotLegacyToMeters: osmSnapshotTransform, world: { metersPerUnit: 10, x: 'east/10', z: '-north/10', verticalExaggeration: 1 } }, sources, boundaries: { campusMapped, originalGuide: originalBoundary, legal: null, cadastral: null, planning: null }, features: { buildings, roads: roads.filter((road) => !surrounding.some((contextRoad) => contextRoad.id === road.id)), paths, parking, sports, greenery, water, entrances, context: surrounding }, anchors: buildings.map((building) => ({ id: building.id, legacy: building.anchor.legacy, meters: building.anchorMeters, rotationRadians: building.rotationRadians, sourceId: building.anchor.sourceId, status: building.anchor.status })), terrain: { sourceId: 'legacy-model-envelope', source: legacy.terrain.source, elevations: legacy.terrain.elevations, baseElevationMeters: legacy.terrain.baseElevationMeters, xs: legacy.terrain.xs, zs: legacy.terrain.zs, verticalExaggeration: 1, status: 'coarse-SRTM-sample-and-estimated-modifiers-not-surveyed' }, evidence: { referenceDate, coordinateNote: 'WGS84 공식 안내 마커를 동일 지역 동·북 미터 좌표로 투영. 표시 1 unit=10m, 북쪽은 -z. 기존 모델 등록 오차는 별도 공개.', boundaryLabel: campusMapped.label, boundaryConfidence: 'estimated', boundaryNote: '안내용 추정 영역이며 법적 소유·필지 경계가 아닙니다. 최신 OSM 영역과 공적 도면 좌표는 미확보입니다.', areaNote: '표시 영역 면적은 추정 폴리곤 계산값입니다. 기존 190,636㎡는 원자료·집계 대상이 확인되지 않아 공식 부지 면적으로 사용하지 않습니다.', sources, unknown }, verification };
await writeFile(path.join(evidenceDirectory, 'legacy-spatial-snapshot.json'), JSON.stringify({ source: 'src/data/campus-data.js before site refinement', boundary: legacy.campusBoundary, roadNetwork: legacy.roadNetwork, entranceDirections: legacy.entranceDirections, terrain: legacy.terrain }, null, 2) + '\n');
await writeFile(path.join(evidenceDirectory, 'spatial-verification.json'), JSON.stringify(verification, null, 2) + '\n');
await writeFile(path.join(evidenceDirectory, 'source-manifest.json'), JSON.stringify({ generatedAt, referenceDate, officialHtmlSha256: originalHash, sources, accessFailures: verification.latestOsmAttempts, usage: ['OSM derivative data: OpenStreetMap contributors / ODbL 1.0.', 'Official website photo links are references only; photos not redistributed.', 'Only needed public guide source fragment and fact extraction retained.'] }, null, 2) + '\n');
await writeFile(path.join(root, 'src/data/site-plan.js'), `// @ts-check\n// Generated by scripts/build-site-plan.mjs from public source evidence and clearly marked legacy estimates.\n(() => {\n  const sitePlan = ${JSON.stringify(data, null, 2)};\n  Object.assign(globalThis, { SitePlanData: sitePlan });\n})();\n`);
console.log(JSON.stringify({ buildings: buildings.length, markers: markers.length, roads: roads.length, paths: paths.length, area: campusMapped.areaSquareMeters, registrationRmsMeters: residuals.rmsMeters, legalBoundary: 'unverified' }, null, 2));
