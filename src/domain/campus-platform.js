// @ts-check
// Framework-free catalog, review-safe spatial import, navigation and local preferences.
(() => {
  /** @typedef {import('../types/platform-types').CampusCatalog} Catalog */
  /** @typedef {import('../types/platform-types').PlatformEntity} Entity */
  /** @typedef {import('../types/platform-types').SpatialGeometry} Geometry */
  /** @typedef {import('../types/platform-types').EvidenceDates} Dates */
  /** @typedef {import('../types/platform-types').EvidenceClaim} Claim */
  /** @typedef {import('../types/platform-types').Confirmation} Confirmation */
  /** @typedef {import('../types/platform-types').OperationRecord} Operation */
  /** @typedef {import('../types/platform-types').LocalPreferences} Preferences */
  const KINDS = ['campus', 'facility-group', 'building', 'floor', 'space', 'external-facility', 'door', 'connection'];
  const VISIBILITY = ['public', 'campus', 'restricted'];
  const CONFIRMATIONS = ['verified', 'mapped', 'estimated', 'unverified'];
  const LIFECYCLES = ['current', 'historic', 'proposed'];
  const BUILDINGS = ['janggong', 'pilheon', 'manwoo', 'shalom', 'immanuel', 'gyeongsam', 'songam', 'sotong', 'practice', 'hanul', 'seongbin', 'saerom', 'haeoreum', 'joonha', 'neutbom', 'childcare'];
  const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
  const MAX_ENTITIES = 10000;
  /** @param {string} value */
  function utf8Length(value) { let bytes = 0; for (let i = 0; i < value.length; i++) { const code = value.charCodeAt(i); if (code < 128) bytes++; else if (code < 2048) bytes += 2; else if (code >= 0xd800 && code <= 0xdbff && value.charCodeAt(i + 1) >= 0xdc00 && value.charCodeAt(i + 1) <= 0xdfff) { bytes += 4; i++; } else bytes += 3; } return bytes; }
  /** @param {unknown} value @returns {value is Record<string,unknown>} */
  function record(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
  /** @param {unknown} value */
  function string(value) { return typeof value === 'string' ? value : ''; }
  /** @param {unknown} value @returns {unknown[]} */
  function array(value) { return Array.isArray(value) ? value : []; }
  /** @param {unknown} value @returns {Record<string,unknown>[]} */
  function records(value) { return array(value).filter(record); }
  /** @template T @param {T} value @returns {T} */
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  /** @param {unknown} value */
  function id(value) { return typeof value === 'string' && /^[a-z0-9][a-z0-9:_-]{0,159}$/.test(value); }
  /** @param {unknown} value @returns {value is string} */
  function date(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\d(?:T\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d))?$/.test(value)) return false;
    const time = Date.parse(value); const day = Date.parse(value.slice(0, 10));
    return Number.isFinite(time) && Number.isFinite(day) && new Date(day).toISOString().slice(0, 10) === value.slice(0, 10) && (value.length === 10 || /^\d{4}-\d\d-\d\dT(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d/.test(value));
  }
  /** @param {unknown} value @returns {value is string} */
  function timestamp(value) { return date(value) && string(value).includes('T'); }
  /** @param {string | undefined} value */
  function atTime(value) { const at = value || new Date().toISOString(); if (!timestamp(at)) throw new TypeError('A valid ISO timestamp is required.'); return Date.parse(at); }
  /** @param {unknown} value @returns {Confirmation} */
  function confirmation(value) { return CONFIRMATIONS.includes(string(value)) ? /** @type {Confirmation} */ (value) : 'unverified'; }
  /** @param {string | null} [referenceDate] @returns {Dates} */
  function dates(referenceDate = null) { return { referenceDate, issuedAt: null, observedAt: null, collectedAt: null, reviewedAt: null, validFrom: null, validUntil: null }; }
  /** @param {Dates} value @returns {Dates} */
  function publicDates(value) { return { referenceDate: value.referenceDate, issuedAt: value.issuedAt, observedAt: value.observedAt, collectedAt: value.collectedAt, reviewedAt: value.reviewedAt, validFrom: value.validFrom, validUntil: value.validUntil }; }
  /** @param {string[]} sourceIds @param {Confirmation} confidence @param {string} method @param {Dates} evidenceDates @param {string} [notes] @returns {Claim} */
  function claim(sourceIds, confidence, method, evidenceDates, notes = '') { return { sourceIds: [...sourceIds], confidence, method, dates: publicDates(evidenceDates), notes }; }
  /** @param {unknown} value @returns {number[][]} */
  function points(value) { const result = array(value); if (!result.every((point) => Array.isArray(point) && point.length === 2 && point.every((n) => typeof n === 'number' && Number.isFinite(n)))) throw new TypeError('Expected finite east/north metre coordinates.'); return /** @type {number[][]} */ (result); }
  /** @param {number[][]} ring */
  function closed(ring) { const copy = ring.map((point) => [...point]); if (copy.length && (copy[0][0] !== copy.at(-1)?.[0] || copy[0][1] !== copy.at(-1)?.[1])) copy.push([...copy[0]]); return copy; }
  /** @param {Record<string,unknown>} feature @param {string} campusId @returns {Geometry | null} */
  function featureGeometry(feature, campusId) {
    const coordinates = points(feature.pointsMeters);
    if (!coordinates.length) return null;
    const type = feature.geometryType === 'polygon' ? 'Polygon' : feature.geometryType === 'line' ? 'LineString' : 'Point';
    return { type, coordinates: type === 'Polygon' ? [closed(coordinates)] : type === 'Point' ? coordinates[0] : coordinates, coordinateSystem: 'local-meters', unit: 'm', originId: campusId, sourceIds: string(feature.sourceId) ? [string(feature.sourceId)] : [], confidence: confirmation(feature.confidence) };
  }
  /** @param {string} entityId @param {import('../types/platform-types').EntityKind} kind @param {string} campusId @param {string} name @param {Dates} evidenceDates @returns {Entity} */
  function entity(entityId, kind, campusId, name, evidenceDates) {
    const unknown = claim([], 'unverified', 'not-acquired', evidenceDates);
    return { id: entityId, kind, campusId, parentId: kind === 'campus' ? null : campusId, owningBuildingId: null, legacyId: null, legacyKey: null, name, displayTitle: name, aliases: [], purpose: '', category: kind, translations: {}, position: null, geometry: null, floorId: null, floorLabel: null, sortOrder: null, roomCode: null, visibility: 'public', status: 'current', confidence: 'estimated', sensitive: false, claims: { name: clone(unknown), location: clone(unknown), outline: clone(unknown), height: clone(unknown), operation: clone(unknown) }, interior: null, feature: null, modelPose: null };
  }
  /** @param {unknown} value @param {string} legacyId @returns {import('../types/platform-types').ConceptInterior | null} */
  function conceptInterior(value, legacyId) {
    if (!record(value)) return null;
    const residential = /기숙사실|[1234]인실|개인|입주자|거주자|호실|숙소/;
    const zones = records(value.zones).filter((zone) => zone.kind !== 'dorm' && !(legacyId === 'seongbin' && residential.test(string(zone.label)))).filter((zone) => [zone.x, zone.y, zone.w, zone.h].every((n) => typeof n === 'number' && Number.isFinite(n))).map((zone) => ({ id: string(zone.id), label: string(zone.label), kind: string(zone.kind), x: Number(zone.x), y: Number(zone.y), w: Number(zone.w), h: Number(zone.h) }));
    const rooms = records(value.rooms).filter((room) => !(legacyId === 'seongbin' && residential.test(`${string(room.name)} ${string(room.use)}`))).map((room) => ({ name: string(room.name), use: string(room.use) }));
    const accuracyNote = '내부 위치는 기존 개념도이며 실측 호실 좌표·통행 검증·운영시간이 없다.';
    return { title: string(value.title), subtitle: string(value.subtitle), floor: string(value.floor), source: string(value.source), note: string(value.note).includes(accuracyNote) ? string(value.note) : `${string(value.note)} ${accuracyNote}`, status: 'concept', confidence: 'estimated', zones, rooms };
  }
  /** @param {string} text */
  function floorLabels(text) {
    const found = new Set();
    for (const match of text.matchAll(/(?:\bB(\d{1,2})F?\b|\b(\d{1,2})F\b|(\d{1,2})층)/g)) found.add(match[1] ? `B${match[1]}` : `${match[2] || match[3]}F`);
    for (const match of text.matchAll(/\b(B?\d{1,2})F?\s*[-~]\s*(\d{1,2})F/g)) {
      const first = match[1].startsWith('B') ? -Number(match[1].slice(1)) : Number(match[1]); const last = Number(match[2]);
      if (last - first <= 20) for (let n = first; n <= last; n++) if (n !== 0) found.add(n < 0 ? `B${-n}` : `${n}F`);
    }
    return [...found].sort((a, b) => floorOrder(a) - floorOrder(b));
  }
  /** @param {string} label */
  function floorOrder(label) { return label.startsWith('B') ? -Number(label.slice(1)) : Number(label.replace('F', '')); }
  /** @param {unknown} planInput @param {unknown} legacyInput @returns {Catalog} */
  function createCatalog(planInput, legacyInput) {
    const plan = planInput;
    if (!record(plan) || !record(plan.features) || !record(plan.metadata) || !record(plan.projection) || !record(plan.projection.origin) || !record(plan.boundaries) || !record(plan.boundaries.campusMapped)) throw new TypeError('A validated campus site plan is required.');
    const legacy = record(legacyInput) ? legacyInput : {}; const campusId = 'hanshin-gg';
    const referenceDate = date(plan.metadata.referenceDate) ? string(plan.metadata.referenceDate) : null; const evidenceDates = dates(referenceDate);
    /** @type {Catalog} */
    const catalog = { schemaVersion: 1, contentVersion: `hanshin-gg-${referenceDate || 'undated'}-1`, assetsVersion: 'legacy-models-1', datasetVersion: '', activeCampusId: campusId, metadata: { title: '한신대학교 공간 안내', referenceDate, boundaryNote: '전체 안내 영역은 추정이며 법적 소유 경계가 아니다.', modelStatus: 'concept', operationalData: 'not-acquired', latestOsm: record(plan.verification) ? string(plan.verification.latestOsm) : 'unavailable' }, campuses: [], entities: [], sources: [], routes: { nodes: [], edges: [] }, operations: [], tours: [], events: [], services: [], layers: [] };
    catalog.datasetVersion = catalog.contentVersion;
    catalog.sources = records(plan.sources).map((source) => ({ id: string(source.id), title: string(source.title), url: string(source.url), scope: string(source.scope), usage: string(source.usage), visibility: 'public', dates: dates(date(source.date) ? string(source.date) : null), confidence: confirmation(source.confidence) }));
    catalog.sources.push({ id: 'legacy-concept-interiors', title: '기존 공개 조사 기반 개념 내부도', url: '', scope: '기존 CampusData 내부도 문구·공간 기능. 원문 작성일·현재 호실·위치·실측 치수·통행 가능 여부 재검증 없음.', usage: '기존 개념 내부도. 개인 및 기숙사 거주 공간 상세 제외.', visibility: 'public', dates: dates(null), confidence: 'estimated' });
    const guidePoints = points(plan.boundaries.campusMapped.pointsMeters);
    /** @type {Geometry} */ const guide = { type: 'MultiPolygon', coordinates: [[closed(guidePoints)]], coordinateSystem: 'local-meters', unit: 'm', originId: campusId, sourceIds: [string(plan.boundaries.campusMapped.sourceId)], confidence: 'estimated', boundaryType: 'guide', isLegalBoundary: false };
    catalog.campuses.push({ id: campusId, name: '한신대학교 경기캠퍼스', address: string(plan.metadata.address), origin: { lat: Number(plan.projection.origin.lat), lon: Number(plan.projection.origin.lon) }, unit: 'm', verticalDatum: 'unverified', terrain: record(legacy.terrain) ? { ...clone(legacy.terrain), coordinateSystem: 'legacy-model-units', horizontalUnit: 'world-unit', verticalUnit: 'm', originId: campusId } : null, boundaries: { guide, legal: null, planning: null, cadastral: null }, visualizationPlan: null });
    const campus = entity(campusId, 'campus', campusId, '한신대학교 경기캠퍼스', evidenceDates); campus.geometry = guide; campus.category = 'campus'; campus.claims.name = claim(['hanshin-official-tour'], 'verified', 'official-guide', evidenceDates); campus.claims.outline = claim(guide.sourceIds, 'estimated', 'visual-guide-envelope', evidenceDates); catalog.entities.push(campus);
    for (const feature of records(plan.features.buildings)) {
      const legacyId = string(feature.legacyKey) || string(feature.id); const buildingId = `${campusId}:building:${legacyId}`;
      const building = entity(buildingId, 'building', campusId, string(feature.name), evidenceDates); building.legacyId = legacyId; building.legacyKey = legacyId; building.owningBuildingId = buildingId; building.category = legacyId === 'seongbin' ? 'residential' : 'building'; building.aliases = array(feature.aliases).filter((alias) => typeof alias === 'string'); building.geometry = featureGeometry(feature, campusId); building.feature = clone(feature); building.confidence = confirmation(feature.confidence);
      building.modelPose = { rotationRadians: typeof feature.angleRadians === 'number' && Number.isFinite(feature.angleRadians) ? feature.angleRadians : 0, confidence: 'estimated' };
      const anchor = points(Array.isArray(feature.anchorMeters) ? [feature.anchorMeters] : []); building.position = anchor.length ? { east: anchor[0][0], north: anchor[0][1], up: null } : null;
      const markerSource = string(feature.markerSourceId) || (record(feature.anchor) ? string(feature.anchor.sourceId) : '');
      building.claims.name = claim([markerSource || string(feature.sourceId)].filter(Boolean), markerSource === 'hanshin-official-tour' ? 'verified' : 'estimated', 'source-name', evidenceDates);
      building.claims.location = claim([markerSource].filter(Boolean), markerSource === 'hanshin-official-tour' ? 'verified' : 'estimated', 'guide-marker-not-surveyed-centroid', evidenceDates);
      building.claims.outline = claim([string(feature.sourceId)].filter(Boolean), 'estimated', 'legacy-model-envelope', evidenceDates);
      building.interior = conceptInterior(legacy[`${legacyId}Interior`], legacyId); building.purpose = building.interior?.subtitle || string(feature.description);
      if (building.interior) building.aliases.push(...building.interior.rooms.map((room) => room.name));
      if (legacyId === 'seongbin') { const group = entity(`${campusId}:facility-group:seongbin`, 'facility-group', campusId, '성빈학사 시설군', evidenceDates); group.claims.name = clone(building.claims.name); group.purpose = '기존 복합 생활관 모델을 묶는 안내 그룹. 개별 동의 실측 위치·호실은 미확인.'; catalog.entities.push(group); building.parentId = group.id; }
      catalog.entities.push(building);
      if (building.interior) {
        const labels = floorLabels(`${building.interior.floor} ${building.interior.zones.map((zone) => zone.label).join(' ')}`);
        for (const label of labels) { const floor = entity(`${buildingId}:floor:${label.toLowerCase()}`, 'floor', campusId, `${building.name} ${label}`, evidenceDates); floor.parentId = buildingId; floor.owningBuildingId = buildingId; floor.floorId = floor.id; floor.floorLabel = label; floor.sortOrder = floorOrder(label); floor.category = 'floor'; floor.purpose = '기존 개념도에 표현된 층. 높이와 실측 평면은 미확인.'; floor.claims.name = claim(['legacy-concept-interiors'], 'estimated', 'concept-floor-label', dates(null)); catalog.entities.push(floor); }
        for (const zone of building.interior.zones) {
          if (!zone.id || zone.kind === 'marker' || zone.kind === 'outside' || zone.kind === 'yard') continue;
          const kind = zone.kind === 'entry' ? 'door' : zone.kind === 'corridor' ? 'connection' : 'space';
          const space = entity(`${buildingId}:${kind}:${zone.id}`, kind, campusId, zone.label.replace(/\n/g, ' '), dates(null)); space.legacyId = zone.id; space.owningBuildingId = buildingId; space.category = zone.kind; space.purpose = zone.label.replace(/\n/g, ' '); space.aliases = [zone.label.replace(/\n/g, ' '), zone.id];
          const explicit = floorLabels(zone.label); const floorLabel = explicit.length === 1 ? explicit[0] : labels.length === 1 ? labels[0] : null;
          space.floorId = floorLabel ? `${buildingId}:floor:${floorLabel.toLowerCase()}` : null; space.floorLabel = floorLabel; space.parentId = space.floorId || buildingId; space.claims.name = claim(['legacy-concept-interiors'], 'estimated', 'concept-zone-not-surveyed-room', dates(null)); space.claims.location = claim(['legacy-concept-interiors'], 'unverified', 'concept-percent-layout-not-geographic-coordinates', dates(null)); catalog.entities.push(space);
        }
      }
    }
    for (const [layer, value] of Object.entries(plan.features)) {
      if (layer === 'buildings') continue;
      for (const feature of records(value)) {
        const kind = layer === 'entrances' ? 'door' : ['roads', 'paths', 'context'].includes(layer) ? 'connection' : 'external-facility';
        const item = entity(`${campusId}:${kind}:${layer}-${string(feature.id)}`, kind, campusId, string(feature.name) || string(feature.id), evidenceDates); item.category = layer; item.geometry = featureGeometry(feature, campusId); item.confidence = confirmation(feature.confidence); item.feature = clone(feature); item.purpose = layer === 'paths' || layer === 'roads' ? '자료 기반 선형. 현재 통행과 연결은 미검증.' : item.name; item.claims.name = claim([string(feature.sourceId)].filter(Boolean), item.confidence, 'source-feature', evidenceDates); item.claims.outline = claim([string(feature.sourceId)].filter(Boolean), item.confidence, 'source-feature', evidenceDates);
        const p = item.geometry?.type === 'Point' ? points([item.geometry.coordinates])[0] : null; if (p) item.position = { east: p[0], north: p[1], up: null };
        if (typeof feature.buildingId === 'string') { const owner = catalog.entities.find((candidate) => candidate.kind === 'building' && (candidate.legacyId === feature.buildingId || candidate.id === feature.buildingId)); if (owner) { item.parentId = owner.id; item.owningBuildingId = owner.id; } }
        catalog.entities.push(item);
      }
    }
    catalog.tours.push({ id: `${campusId}:tour:campus-overview`, name: '전체 캠퍼스 가상 살펴보기', campusId, mode: 'virtual', stops: catalog.entities.filter((item) => item.kind === 'building').map((item) => ({ entityId: item.id, title: item.name, sourceIds: [...item.claims.name.sourceIds] })), note: '실존 건물의 자료를 차례로 보는 가상 투어다. 실제 도보 경로·소요시간·출입 가능 여부를 보장하지 않는다.' });
    catalog.layers = ['boundary', 'buildings', 'roads', 'paths', 'parking', 'sports', 'greenery', 'trees', 'water', 'entrances', 'context', 'labels', 'contours'].map((layer) => ({ id: layer, name: layer, defaultVisible: layer !== 'contours', status: 'estimated' }));
    catalog.campuses[0].visualizationPlan = visualizationPlan(catalog.campuses[0], catalog.entities, catalog.sources, plan);
    const validation = validateCatalog(catalog); if (!validation.valid) throw new TypeError(validation.errors.join('\n'));
    return catalog;
  }

  /** @param {number[]} p @param {number[]} a @param {number[]} b */
  function cross(p, a, b) { return (a[0] - p[0]) * (b[1] - p[1]) - (a[1] - p[1]) * (b[0] - p[0]); }
  /** @param {number[][]} ring */
  function ringArea(ring) { const origin = ring[0]; return ring.slice(0, -1).reduce((sum, p, i) => sum + (p[0] - origin[0]) * (ring[i + 1][1] - origin[1]) - (ring[i + 1][0] - origin[0]) * (p[1] - origin[1]), 0) / 2; }
  /** @param {number[]} p @param {number[]} a @param {number[]} b */
  function orientation(p, a, b) { const value = cross(p, a, b); const scale = Math.max(1, ...[a, b].flatMap((point) => [Math.abs(point[0] - p[0]), Math.abs(point[1] - p[1])])); const tolerance = 64 * Number.EPSILON * scale ** 2; return Math.abs(value) <= tolerance ? 0 : Math.sign(value); }
  /** @param {number[]} p @param {number[][]} ring */
  function inside(p, ring) { let result = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const a = ring[i]; const b = ring[j]; if (orientation(a, b, p) === 0 && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0]) && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1])) return true; if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result; } return result; }
  /** @param {number[]} a @param {number[]} b @param {number[]} c @param {number[]} d */
  function intersects(a, b, c, d) {
    const c1 = orientation(a, b, c); const c2 = orientation(a, b, d); const c3 = orientation(c, d, a); const c4 = orientation(c, d, b);
    /** @param {number[]} p @param {number[]} x @param {number[]} y */ const on = (p, x, y) => orientation(x, y, p) === 0 && p[0] >= Math.min(x[0], y[0]) && p[0] <= Math.max(x[0], y[0]) && p[1] >= Math.min(x[1], y[1]) && p[1] <= Math.max(x[1], y[1]);
    return c1 * c2 < 0 && c3 * c4 < 0 || on(c, a, b) || on(d, a, b) || on(a, c, d) || on(b, c, d);
  }
  /** @param {number[][]} first @param {number[][]} second */
  function ringsIntersect(first, second) { for (let i = 0; i < first.length - 1; i++) for (let j = 0; j < second.length - 1; j++) if (intersects(first[i], first[i + 1], second[j], second[j + 1])) return true; return false; }
  /** @param {unknown} value @param {string} path @param {string[]} errors @param {Set<string>} sources @param {Set<string>} campuses */
  function geometryCheck(value, path, errors, sources, campuses) {
    if (!record(value)) { errors.push(`${path}: geometry must be an object`); return; }
    const shape = value;
    if (!['Point', 'LineString', 'Polygon', 'MultiPolygon'].includes(string(value.type))) { errors.push(`${path}: unsupported geometry type`); return; }
    if (!['local-meters', 'WGS84'].includes(string(value.coordinateSystem)) || value.unit !== (value.coordinateSystem === 'WGS84' ? 'degree' : 'm')) errors.push(`${path}: coordinate system and units disagree`);
    if (!campuses.has(string(value.originId))) errors.push(`${path}: unknown coordinate origin`);
    if (!CONFIRMATIONS.includes(string(value.confidence))) errors.push(`${path}: confirmation required`);
    refs(value.sourceIds, sources, `${path}.sourceIds`, errors);
    let count = 0;
    /** @param {unknown} p @returns {p is number[]} */
    function point(p) { count++; const good = Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n)); if (!good || count > 10000) { errors.push(`${path}: invalid or excessive coordinates`); return false; } if (shape.coordinateSystem === 'WGS84' && (Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90)) errors.push(`${path}: WGS84 coordinates out of range`); if (shape.coordinateSystem === 'local-meters' && p.some((n) => Math.abs(n) > 100000)) errors.push(`${path}: local coordinates outside supported campus range`); return true; }
    /** @param {unknown} ring @returns {ring is number[][]} */
    function checkRing(ring) {
      if (!Array.isArray(ring) || ring.length < 4 || ring.length > 1000 || !ring.every(point)) { errors.push(`${path}: invalid closed ring`); return false; }
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) { errors.push(`${path}: ring must close`); return false; }
      if (Math.abs(ringArea(ring)) < (shape.coordinateSystem === 'WGS84' ? 1e-16 : 1e-8)) errors.push(`${path}: ring has no area`);
      if (new Set(ring.slice(0, -1).map((p) => `${p[0]},${p[1]}`)).size !== ring.length - 1) errors.push(`${path}: repeated ring vertex`);
      for (let i = 0; i < ring.length - 1; i++) for (let j = i + 2; j < ring.length - 1; j++) if (!(i === 0 && j === ring.length - 2) && intersects(ring[i], ring[i + 1], ring[j], ring[j + 1])) errors.push(`${path}: self-intersecting ring`);
      return true;
    }
    /** @param {unknown} polygon */
    function checkPolygon(polygon) {
      if (!Array.isArray(polygon) || !polygon.length || polygon.length > 64) { errors.push(`${path}: polygon requires exterior and at most 63 holes`); return; }
      const rings = polygon.filter(checkRing);
      for (const hole of rings.slice(1)) { if (!hole.slice(0, -1).every((p) => inside(p, rings[0])) || ringsIntersect(hole, rings[0])) errors.push(`${path}: hole is outside or touches exterior`); if (Math.abs(ringArea(hole)) >= Math.abs(ringArea(rings[0]))) errors.push(`${path}: hole exceeds exterior`); }
      for (let i = 1; i < rings.length; i++) for (let j = i + 1; j < rings.length; j++) if (ringsIntersect(rings[i], rings[j]) || inside(rings[i][0], rings[j]) || inside(rings[j][0], rings[i])) errors.push(`${path}: overlapping holes`);
    }
    if (value.type === 'Point') point(value.coordinates);
    else if (value.type === 'LineString') { if (!Array.isArray(value.coordinates) || value.coordinates.length < 2 || !value.coordinates.every(point)) errors.push(`${path}: invalid line`); }
    else if (value.type === 'Polygon') checkPolygon(value.coordinates);
    else if (!Array.isArray(value.coordinates) || !value.coordinates.length || value.coordinates.length > 64) errors.push(`${path}: MultiPolygon requires 1 to 64 components`);
    else {
      value.coordinates.forEach(checkPolygon);
      const polygons = /** @type {number[][][][]} */ (value.coordinates.filter((polygon) => Array.isArray(polygon) && polygon.length && polygon.length <= 64 && polygon.every((ring) => Array.isArray(ring) && ring.length >= 4 && ring.length <= 1000 && ring.every((p) => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n))))));
      /** @param {number[]} p @param {number[][][]} polygon */ const inPolygon = (p, polygon) => inside(p, polygon[0]) && !polygon.slice(1).some((hole) => inside(p, hole));
      for (let i = 0; i < polygons.length; i++) for (let j = i + 1; j < polygons.length; j++) if (polygons[i].some((first) => polygons[j].some((second) => ringsIntersect(first, second))) || inPolygon(polygons[i][0][0], polygons[j]) || inPolygon(polygons[j][0][0], polygons[i])) errors.push(`${path}: overlapping MultiPolygon components`);
    }
  }
  /** @param {unknown} value @param {Set<string>} known @param {string} path @param {string[]} errors */
  function refs(value, known, path, errors) { if (!Array.isArray(value) || !value.every((v) => typeof v === 'string' && known.has(v)) || new Set(value).size !== value.length) errors.push(`${path}: invalid references`); }
  /** @param {unknown} value @param {string} path @param {string[]} errors */
  function datesCheck(value, path, errors) { if (!record(value)) { errors.push(`${path}: dates required`); return; } for (const key of ['referenceDate', 'issuedAt', 'observedAt', 'collectedAt', 'reviewedAt', 'validFrom', 'validUntil']) if (value[key] !== null && !date(value[key])) errors.push(`${path}.${key}: invalid date`); if (value.validFrom && value.validUntil && Date.parse(string(value.validFrom)) >= Date.parse(string(value.validUntil))) errors.push(`${path}: invalid validity interval`); }
  /** @param {unknown} input @returns {import('../types/platform-types').ValidationResult} */
  function validateCatalog(input) {
    const errors = [];
    if (!record(input)) return { valid: false, errors: ['Catalog must be an object.'] };
    let encoded;
    try { encoded = JSON.stringify(input); } catch { return { valid: false, errors: ['Catalog must be acyclic JSON.'] }; }
    if (utf8Length(encoded) > MAX_IMPORT_BYTES) return { valid: false, errors: ['Catalog exceeds the 2 MiB import limit.'] };
    if (/"(?:__proto__|prototype|constructor)"\s*:/.test(encoded)) errors.push('Prototype-related keys are forbidden.');
    if (input.schemaVersion !== 1) errors.push('Unsupported schemaVersion.');
    if (!record(input.metadata)) errors.push('metadata: object required.');
    for (const key of ['contentVersion', 'assetsVersion', 'datasetVersion']) if (typeof input[key] !== 'string' || !input[key] || string(input[key]).length > 128) errors.push(`${key}: version required`);
    if (input.datasetVersion !== input.contentVersion) errors.push('datasetVersion must match contentVersion.');
    for (const key of ['campuses', 'entities', 'sources', 'operations', 'tours', 'events', 'services', 'layers']) if (!Array.isArray(input[key]) || !array(input[key]).every(record)) errors.push(`${key}: object array required`);
    if (array(input.entities).length > MAX_ENTITIES) errors.push('Too many entities.');
    const campuses = records(input.campuses); const entities = records(input.entities); const sourceRows = records(input.sources);
    const campusIds = new Set(campuses.map((c) => string(c.id))); const entityIds = new Set(entities.map((e) => string(e.id))); const sourceIds = new Set(sourceRows.map((s) => string(s.id)));
    if (input.assetManifest !== undefined) {
      const manifest = input.assetManifest;
      if (!record(manifest) || manifest.schemaVersion !== 1 || !string(manifest.version) || !Array.isArray(manifest.models) || manifest.models.length > 1000 || !manifest.models.every(record)) errors.push('assetManifest: invalid model manifest.');
      else for (const model of manifest.models) {
        if (!id(model.id) || !['glb','legacy'].includes(string(model.kind)) || !string(model.source) || !string(model.status)) errors.push('assetManifest: invalid model registration.');
        if (!entities.some((item) => item.kind === 'building' && item.campusId === (model.campusId || manifest.campusId) && [item.id,item.legacyId,item.legacyKey].some((key) => key && [model.id,model.buildingId,model.legacyId].includes(key)))) errors.push('assetManifest: model does not belong to a registered building.');
        if (model.provenance && (!record(model.provenance) || !sourceIds.has(string(model.provenance.sourceId)))) errors.push('assetManifest: unknown provenance source.');
      }
    }
    /** @type {[string,Record<string,unknown>[]][]} */ const collections = [['campus', campuses], ['entity', entities], ['source', sourceRows], ['operation', records(input.operations)], ['tour', records(input.tours)], ['event', records(input.events)], ['service', records(input.services)], ['layer', records(input.layers)]];
    for (const [name, values] of collections) { const seen = new Set(); for (const value of values) { if (!id(value.id) || seen.has(value.id)) errors.push(`${name}: invalid or duplicate ID ${string(value.id)}`); seen.add(value.id); } }
    if (!campusIds.size || !campusIds.has(string(input.activeCampusId))) errors.push('activeCampusId: unknown campus.');
    for (const source of sourceRows) { if (!string(source.title) || !string(source.scope) || typeof source.usage !== 'string' || !VISIBILITY.includes(string(source.visibility)) || !CONFIRMATIONS.includes(string(source.confidence))) errors.push(`${string(source.id)}: incomplete source`); if (source.url !== '' && (typeof source.url !== 'string' || !/^https:\/\/[^\s/@]+(?:\/[^\s]*)?$/.test(source.url) || /[?&](?:token|api[_-]?key|secret|password|signature)=/i.test(source.url))) errors.push(`${string(source.id)}: source URL must be credential-free HTTPS`); datesCheck(source.dates, `${string(source.id)}.dates`, errors); }
    for (const campus of campuses) {
      if (!record(campus.origin) || typeof campus.origin.lat !== 'number' || typeof campus.origin.lon !== 'number' || !Number.isFinite(campus.origin.lat) || !Number.isFinite(campus.origin.lon) || Math.abs(campus.origin.lat) >= 85 || Math.abs(campus.origin.lon) > 180 || campus.unit !== 'm') errors.push(`${string(campus.id)}: invalid independent origin or units`);
      if (!string(campus.name) || !string(campus.address) || !string(campus.verticalDatum)) errors.push(`${string(campus.id)}: campus identity required`);
      if (campus.terrain !== null) {
        const terrain = campus.terrain;
        if (!record(terrain) || !Array.isArray(terrain.xs) || !Array.isArray(terrain.zs) || !Array.isArray(terrain.elevations) || !terrain.xs.every((n) => typeof n === 'number' && Number.isFinite(n)) || !terrain.zs.every((n) => typeof n === 'number' && Number.isFinite(n)) || terrain.xs.length < 2 || terrain.zs.length < 2 || terrain.elevations.length !== terrain.zs.length || !terrain.elevations.every((row) => Array.isArray(row) && row.length === array(terrain.xs).length && row.every((n) => typeof n === 'number' && Number.isFinite(n))) || typeof terrain.baseElevationMeters !== 'number' || !Number.isFinite(terrain.baseElevationMeters)) errors.push(`${string(campus.id)}: invalid terrain grid`);
        if (record(terrain)) {
          if (!['local-meters', 'legacy-model-units'].includes(string(terrain.coordinateSystem)) || terrain.horizontalUnit !== (terrain.coordinateSystem === 'local-meters' ? 'm' : 'world-unit') || terrain.verticalUnit !== 'm' || terrain.originId !== campus.id) errors.push(`${string(campus.id)}: terrain units and origin required`);
          for (const key of ['xs', 'zs']) { const axis = array(terrain[key]); if (axis.length > 1000 || axis.some((n, index) => index > 0 && Number(n) <= Number(axis[index - 1]))) errors.push(`${string(campus.id)}: terrain axes must be increasing and bounded`); }
          if (terrain.coordinateSystem === 'legacy-model-units' && (!record(campus.visualizationPlan) || !record(campus.visualizationPlan.transforms) || !validTransformPair(campus.visualizationPlan.transforms))) errors.push(`${string(campus.id)}: legacy terrain requires inverse coordinate transforms`);
        }
      }
      if (!record(campus.boundaries)) { errors.push(`${string(campus.id)}: boundaries required`); continue; }
      for (const key of ['guide', 'legal', 'planning', 'cadastral']) {
        const boundary = campus.boundaries[key]; if (boundary === null && key !== 'guide') continue;
        geometryCheck(boundary, `${string(campus.id)}.${key}`, errors, sourceIds, campusIds);
        if (!record(boundary) || !['Polygon', 'MultiPolygon'].includes(string(boundary.type)) || boundary.boundaryType !== key || boundary.originId !== campus.id) errors.push(`${string(campus.id)}.${key}: boundary contract mismatch`);
        if (key !== 'guide' && record(boundary) && (boundary.confidence !== 'verified' || !array(boundary.sourceIds).length)) errors.push(`${string(campus.id)}.${key}: confirmed public boundary evidence required`);
        if (key === 'guide' && record(boundary) && boundary.isLegalBoundary !== false) errors.push(`${string(campus.id)}: guide is not a legal boundary`);
      }
    }
    for (const item of entities) {
      const path = string(item.id);
      if (!KINDS.includes(string(item.kind)) || !campusIds.has(string(item.campusId)) || !VISIBILITY.includes(string(item.visibility)) || !LIFECYCLES.includes(string(item.status)) || !CONFIRMATIONS.includes(string(item.confidence)) || typeof item.sensitive !== 'boolean') errors.push(`${path}: invalid kind/campus/status/visibility`);
      if (item.kind !== 'campus' && !path.startsWith(`${string(item.campusId)}:`)) errors.push(`${path}: stable ID must be namespaced by campus`);
      if (!string(item.name) || !string(item.displayTitle) || !Array.isArray(item.aliases) || !item.aliases.every((alias) => typeof alias === 'string') || typeof item.purpose !== 'string' || typeof item.category !== 'string') errors.push(`${path}: invalid display/search fields`);
      for (const key of ['name', 'displayTitle', 'purpose', 'category']) if (string(item[key]).length > 4096) errors.push(`${path}: display text too long`);
      for (const key of ['legacyId', 'legacyKey', 'floorLabel', 'roomCode']) if (item[key] !== null && typeof item[key] !== 'string') errors.push(`${path}.${key}: string or null required`);
      if (item.sortOrder !== null && (typeof item.sortOrder !== 'number' || !Number.isFinite(item.sortOrder))) errors.push(`${path}: invalid floor order`);
      if (item.modelPose !== null && (!record(item.modelPose) || typeof item.modelPose.rotationRadians !== 'number' || !Number.isFinite(item.modelPose.rotationRadians) || !CONFIRMATIONS.includes(string(item.modelPose.confidence)))) errors.push(`${path}: invalid model pose`);
      for (const key of ['parentId', 'owningBuildingId', 'floorId']) if (item[key] !== null && (!entityIds.has(string(item[key])) || entities.find((other) => other.id === item[key])?.campusId !== item.campusId)) errors.push(`${path}.${key}: invalid cross-campus reference`);
      if (item.kind === 'campus' && item.id !== item.campusId) errors.push(`${path}: campus identity mismatch`);
      if (item.kind === 'floor' && entities.find((other) => other.id === item.parentId)?.kind !== 'building') errors.push(`${path}: floor requires a building parent`);
      if (item.floorId !== null && entities.find((other) => other.id === item.floorId)?.kind !== 'floor') errors.push(`${path}: floorId must refer to a floor`);
      if (item.owningBuildingId !== null && entities.find((other) => other.id === item.owningBuildingId)?.kind !== 'building') errors.push(`${path}: invalid owning building`);
      const seen = new Set([item.id]); let parent = item.parentId;
      while (typeof parent === 'string') { if (seen.has(parent)) { errors.push(`${path}: parent cycle`); break; } seen.add(parent); parent = entities.find((other) => other.id === parent)?.parentId; }
      if (item.position !== null && (!record(item.position) || ![item.position.east, item.position.north].every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 100000) || item.position.up !== null && (typeof item.position.up !== 'number' || !Number.isFinite(item.position.up)))) errors.push(`${path}: invalid position`);
      if (item.geometry !== null) { geometryCheck(item.geometry, `${path}.geometry`, errors, sourceIds, campusIds); if (record(item.geometry) && item.geometry.originId !== item.campusId) errors.push(`${path}: geometry origin must match campus`); }
      if (!record(item.claims)) errors.push(`${path}: property claims required`);
      else for (const key of ['name', 'location', 'outline', 'height', 'operation']) { const proof = item.claims[key]; if (!record(proof) || !CONFIRMATIONS.includes(string(proof.confidence)) || !string(proof.method)) errors.push(`${path}.${key}: invalid claim`); else { refs(proof.sourceIds, sourceIds, `${path}.${key}.sources`, errors); datesCheck(proof.dates, `${path}.${key}.dates`, errors); if (proof.confidence === 'verified' && !array(proof.sourceIds).length) errors.push(`${path}.${key}: verified claim requires evidence`); } }
      if (!record(item.translations)) errors.push(`${path}: translations required`);
      else for (const [language, translation] of Object.entries(item.translations)) if (!/^[a-z]{2}(?:-[A-Z]{2})?$/.test(language) || !record(translation) || !string(translation.name) || typeof translation.verified !== 'boolean' || translation.verified && !sourceIds.has(string(translation.sourceId))) errors.push(`${path}: invalid verified translation`);
      if (item.interior !== null && (!record(item.interior) || item.interior.status !== 'concept' || item.interior.confidence !== 'estimated' || !Array.isArray(item.interior.zones) || !item.interior.zones.every((zone) => record(zone) && id(zone.id) && typeof zone.label === 'string' && typeof zone.kind === 'string' && [zone.x, zone.y, zone.w, zone.h].every((n) => typeof n === 'number' && Number.isFinite(n)) && Number(zone.w) > 0 && Number(zone.h) > 0) || !Array.isArray(item.interior.rooms) || !item.interior.rooms.every((room) => record(room) && typeof room.name === 'string' && typeof room.use === 'string'))) errors.push(`${path}: invalid concept interior`);
    }
    if (!record(input.routes)) errors.push('routes: graph required');
    else {
      refs(input.routes.nodes, entityIds, 'routes.nodes', errors);
      const routeNodes = new Set(array(input.routes.nodes));
      if (!Array.isArray(input.routes.edges) || !input.routes.edges.every(record)) errors.push('routes.edges: object array required');
      const seen = new Set();
      for (const edge of records(input.routes.edges)) {
        if (!id(edge.id) || seen.has(edge.id) || !routeNodes.has(edge.from) || !routeNodes.has(edge.to) || !campusIds.has(string(edge.campusId)) || typeof edge.lengthMeters !== 'number' || !Number.isFinite(edge.lengthMeters) || edge.lengthMeters <= 0 || typeof edge.bidirectional !== 'boolean' || !['walk', 'stairs', 'ramp', 'lift', 'door'].includes(string(edge.kind)) || !CONFIRMATIONS.includes(string(edge.verification))) errors.push(`${string(edge.id)}: invalid edge`); seen.add(edge.id);
        if (entities.find((item) => item.id === edge.from)?.campusId !== edge.campusId || entities.find((item) => item.id === edge.to)?.campusId !== edge.campusId) errors.push(`${string(edge.id)}: cross-campus edge`);
        refs(edge.sourceIds, sourceIds, `${string(edge.id)}.sources`, errors);
        for (const key of ['reviewedAt', 'validFrom', 'validUntil']) if (edge[key] !== null && !timestamp(edge[key])) errors.push(`${string(edge.id)}.${key}: invalid timestamp`);
        if (edge.verification === 'verified' && (!array(edge.sourceIds).length || !timestamp(edge.reviewedAt) || !timestamp(edge.validUntil))) errors.push(`${string(edge.id)}: verified edge requires review/evidence/expiry`);
        if (edge.validFrom && edge.validUntil && Date.parse(string(edge.validFrom)) >= Date.parse(string(edge.validUntil))) errors.push(`${string(edge.id)}: invalid edge validity interval`);
        if (!record(edge.accessibility)) errors.push(`${string(edge.id)}: accessibility assessment required`);
        else {
          const a = edge.accessibility;
          if (!['verified', 'unverified'].includes(string(a.verification)) || !['wheelchair', null].includes(/** @type {'wheelchair' | null} */ (a.assessedProfile)) || ![true, false, null].includes(/** @type {boolean | null} */ (a.stepFree)) || typeof a.operationalVerified !== 'boolean' || a.surface !== null && typeof a.surface !== 'string') errors.push(`${string(edge.id)}: invalid accessibility profile`);
          for (const key of ['widthMeters', 'slopePercent', 'thresholdMm']) if (a[key] !== null && (typeof a[key] !== 'number' || !Number.isFinite(a[key]) || Number(a[key]) < 0)) errors.push(`${string(edge.id)}: invalid accessibility measurement`);
          if (a.validUntil !== null && !timestamp(a.validUntil)) errors.push(`${string(edge.id)}: invalid accessibility expiry`);
        }
      }
    }
    for (const operation of records(input.operations)) { if (!id(operation.id) || !entityIds.has(string(operation.entityId)) || !['open', 'closed'].includes(string(operation.state)) || !VISIBILITY.includes(string(operation.visibility)) || !CONFIRMATIONS.includes(string(operation.verification)) || !timestamp(operation.observedAt) || !timestamp(operation.validFrom) || !timestamp(operation.validUntil) || Date.parse(string(operation.validFrom)) >= Date.parse(string(operation.validUntil))) errors.push(`${string(operation.id)}: invalid operation or expiry`); refs(operation.sourceIds, sourceIds, `${string(operation.id)}.sources`, errors); }
    for (const tour of records(input.tours)) { if (!id(tour.id) || tour.mode !== 'virtual' || !campusIds.has(string(tour.campusId)) || !Array.isArray(tour.stops)) errors.push(`${string(tour.id)}: virtual tour contract required`); for (const stop of records(tour.stops)) { if (!entityIds.has(string(stop.entityId)) || entities.find((item) => item.id === stop.entityId)?.campusId !== tour.campusId) errors.push(`${string(tour.id)}: invalid stop`); refs(stop.sourceIds, sourceIds, `${string(tour.id)}.stop.sources`, errors); } }
    for (const key of ['events', 'services']) for (const activity of records(input[key])) { if (!id(activity.id) || !string(activity.title) || !entityIds.has(string(activity.entityId)) || !VISIBILITY.includes(string(activity.visibility)) || !LIFECYCLES.includes(string(activity.status))) errors.push(`${key}: invalid activity`); refs(activity.sourceIds, sourceIds, `${key}.sources`, errors); for (const dateKey of ['validFrom', 'validUntil']) if (activity[dateKey] !== null && !timestamp(activity[dateKey])) errors.push(`${key}: invalid validity`); }
    for (const layer of records(input.layers)) if (!string(layer.name) || typeof layer.defaultVisible !== 'boolean' || !CONFIRMATIONS.includes(string(layer.status))) errors.push(`${string(layer.id)}: invalid layer contract`);
    return { valid: errors.length === 0, errors: [...new Set(errors)] };
  }

  /** @param {Catalog} catalog @param {string} targetId @returns {Entity | null} */
  function resolve(catalog, targetId) { return catalog.entities.find((item) => item.id === targetId) || catalog.entities.find((item) => item.legacyId === targetId && item.campusId === catalog.activeCampusId) || null; }
  /** @param {string} value */
  function normalized(value) { return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim(); }
  /** @param {Catalog} catalog @param {string} query @param {{kind?:string,category?:string,campusId?:string,language?:string}} [options] */
  function search(catalog, query, options = {}) {
    const words = normalized(string(query)).split(' ').filter(Boolean); const language = options.language || 'ko';
    return publicCatalog(catalog).entities.filter((item) => item.status === 'current' && (!options.kind || item.kind === options.kind) && (!options.category || item.category === options.category) && (!options.campusId || item.campusId === options.campusId)).filter((item) => { const translation = item.translations[language]; const text = normalized([item.name, item.displayTitle, item.purpose, item.category, item.floorLabel, item.roomCode, ...item.aliases, translation?.verified ? translation.name : ''].filter(Boolean).join(' ')); return words.every((word) => text.includes(word)); }).sort((a, b) => Number(normalized(b.name) === normalized(string(query))) - Number(normalized(a.name) === normalized(string(query))) || a.name.localeCompare(b.name, language === 'en' ? 'en' : 'ko'));
  }
  /** @param {Operation} row @returns {Operation} */
  function publicOperation(row) { return { id: row.id, entityId: row.entityId, state: row.state, label: row.label, sourceIds: [...row.sourceIds], visibility: 'public', verification: row.verification, observedAt: row.observedAt, validFrom: row.validFrom, validUntil: row.validUntil }; }
  /** @param {Operation[] | Catalog} input @param {string} entityId @param {string} [at] @returns {import('../types/platform-types').OperationResult} */
  function operationStatus(input, entityId, at) {
    const now = atTime(at); let rows;
    if (Array.isArray(input)) rows = input;
    else { const sourceIds = new Set(input.sources.filter((source) => source.visibility === 'public').map((source) => source.id)); const allowed = publicEntityIds(input, sourceIds); rows = input.operations.filter((row) => allowed.has(row.entityId) && row.sourceIds.every((sourceId) => sourceIds.has(sourceId))); }
    const relevant = rows.filter((row) => row.entityId === entityId && row.visibility === 'public' && row.verification === 'verified' && row.sourceIds.length && timestamp(row.observedAt) && timestamp(row.validFrom) && timestamp(row.validUntil) && Date.parse(row.observedAt) <= now && Date.parse(row.validFrom) <= now);
    const active = relevant.filter((row) => now < Date.parse(row.validUntil)).sort((a, b) => Number(b.state === 'closed') - Number(a.state === 'closed') || Date.parse(b.observedAt) - Date.parse(a.observedAt));
    if (active.length) return { status: active[0].state, label: active[0].label || (active[0].state === 'closed' ? '현재 이용 제한' : '확인된 운영 정보'), records: active.map(publicOperation), expiresAt: active[0].validUntil };
    if (relevant.length) return { status: 'expired', label: '운영 정보의 유효기간이 지났습니다.', records: [], expiresAt: relevant.map((row) => row.validUntil).sort().at(-1) || null };
    return { status: 'unknown', label: '운영시간과 현재 이용 가능 여부는 미확인입니다.', records: [], expiresAt: null };
  }
  /** @param {Catalog} catalog @param {{from?:string,to?:string,fromId?:string,toId?:string,accessible?:boolean,at?:string}} options @returns {import('../types/platform-types').RouteResult} */
  function route(catalog, options) {
    const unavailable = (/** @type {string} */ reason) => ({ status: /** @type {const} */ ('unavailable'), reason, nodes: [], edges: [], distanceMeters: null, steps: [], verified: false });
    if (!validateCatalog(catalog).valid) return unavailable('공간 자료가 유효하지 않습니다.');
    catalog = publicCatalog(catalog);
    const from = resolve(catalog, options.from || options.fromId || ''); const to = resolve(catalog, options.to || options.toId || '');
    if (!from || !to || from.visibility !== 'public' || to.visibility !== 'public' || from.sensitive || to.sensitive || from.status !== 'current' || to.status !== 'current') return unavailable('공개된 출발지와 목적지를 선택해 주세요.');
    if (from.campusId !== to.campusId) return unavailable('서로 다른 캠퍼스 사이의 검증된 이동 자료가 없습니다.');
    let now; try { now = atTime(options.at); } catch { return unavailable('올바른 조회 시각이 필요합니다.'); }
    const closedNode = (/** @type {Entity} */ node) => { let target = /** @type {Entity | null} */ (node); while (target) { if (['closed', 'expired'].includes(operationStatus(catalog, target.id, new Date(now).toISOString()).status)) return true; target = target.parentId ? resolve(catalog, target.parentId) : null; } return false; };
    const nodes = new Map(catalog.entities.filter((item) => catalog.routes.nodes.includes(item.id) && item.visibility === 'public' && !item.sensitive && item.status === 'current' && item.position && item.claims.location.confidence === 'verified' && !closedNode(item)).map((item) => [item.id, item]));
    if (!nodes.has(from.id) || !nodes.has(to.id)) return unavailable('출입구·공간 연결을 현장 검토한 경로 자료가 없습니다.');
    const edges = catalog.routes.edges.filter((edge) => edge.verification === 'verified' && edge.sourceIds.length && timestamp(edge.reviewedAt) && Date.parse(edge.reviewedAt) <= now && timestamp(edge.validUntil) && now < Date.parse(edge.validUntil) && (!edge.validFrom || Date.parse(edge.validFrom) <= now) && nodes.has(edge.from) && nodes.has(edge.to)).filter((edge) => {
      if (!options.accessible) return true;
      const a = edge.accessibility;
      return edge.kind !== 'stairs' && a.verification === 'verified' && a.assessedProfile === 'wheelchair' && a.stepFree === true && a.operationalVerified === true && typeof a.widthMeters === 'number' && a.widthMeters > 0 && typeof a.slopePercent === 'number' && a.slopePercent >= 0 && typeof a.thresholdMm === 'number' && a.thresholdMm >= 0 && !!a.surface && timestamp(a.validUntil) && now < Date.parse(a.validUntil);
    });
    const distance = new Map([...nodes.keys()].map((nodeId) => [nodeId, Infinity])); distance.set(from.id, 0);
    /** @type {Map<string,{previous:string,edge:import('../types/platform-types').RouteEdge}>} */ const previous = new Map(); const pending = new Set(nodes.keys());
    while (pending.size) {
      let current = ''; let best = Infinity; for (const nodeId of pending) { const value = distance.get(nodeId) ?? Infinity; if (value < best) { current = nodeId; best = value; } }
      if (!current || current === to.id) break; pending.delete(current);
      for (const edge of edges) { const next = edge.from === current ? edge.to : edge.bidirectional && edge.to === current ? edge.from : null; if (!next || !pending.has(next)) continue; const alternative = best + edge.lengthMeters; if (alternative < (distance.get(next) ?? Infinity)) { distance.set(next, alternative); previous.set(next, { previous: current, edge }); } }
    }
    if (!Number.isFinite(distance.get(to.id))) return unavailable(options.accessible ? '폭·경사·문턱·노면·운영상태를 확인한 무장애 경로가 없습니다.' : '현재 유효한 검증 경로가 연결되지 않습니다.');
    const path = [to.id]; const routeEdges = []; let current = to.id;
    while (current !== from.id) { const link = previous.get(current); if (!link) return unavailable('경로 연결 정보를 확인할 수 없습니다.'); routeEdges.unshift(link.edge); current = link.previous; path.unshift(current); }
    const routeNodes = path.map((nodeId) => /** @type {Entity} */ (nodes.get(nodeId)));
    return { status: 'found', reason: options.accessible ? '현재 유효한 휠체어 이용 프로필 검토 경로입니다.' : '현재 유효한 현장 검토 연결입니다.', nodes: clone(routeNodes), edges: clone(routeEdges), distanceMeters: distance.get(to.id) || 0, steps: routeEdges.map((edge, index) => ({ fromId: path[index], toId: path[index + 1], text: `${routeNodes[index].displayTitle} → ${routeNodes[index + 1].displayTitle}`, distanceMeters: edge.lengthMeters, kind: edge.kind })), verified: true };
  }
  /** @param {Catalog} before @param {Catalog} after @returns {import('../types/platform-types').CatalogDiff} */
  function diffCatalog(before, after) {
    const old = new Map(before.entities.map((item) => [item.id, item])); const next = new Map(after.entities.map((item) => [item.id, item])); const changes = [];
    for (const [entityId, item] of next) { const prior = old.get(entityId); if (prior) { const fields = Object.keys(item).filter((key) => JSON.stringify(Reflect.get(item, key)) !== JSON.stringify(Reflect.get(prior, key))); if (fields.length) changes.push({ id: entityId, fields }); } }
    return { added: [...next.keys()].filter((entityId) => !old.has(entityId)), removed: [...old.keys()].filter((entityId) => !next.has(entityId)), changed: changes.map((change) => change.id), changes, sections: ['campuses', 'sources', 'routes', 'operations', 'tours', 'events', 'services', 'layers', 'assetsVersion'].filter((key) => JSON.stringify(Reflect.get(before, key)) !== JSON.stringify(Reflect.get(after, key))), fromVersion: before.contentVersion, toVersion: after.contentVersion };
  }
  /** @param {Geometry} value @param {import('../types/platform-types').PlatformCampus} campus */
  function localGeometry(value, campus) {
    if (value.coordinateSystem === 'local-meters') return clone(value.coordinates);
    const lat = campus.origin.lat * Math.PI / 180; const w = Math.sqrt(1 - 6.6943799901413165e-3 * Math.sin(lat) ** 2);
    const east = 6378137 / w * Math.cos(lat); const north = 6378137 * (1 - 6.6943799901413165e-3) / w ** 3;
    /** @param {unknown} item @returns {unknown} */ function convert(item) {
      if (Array.isArray(item) && item.length === 2 && item.every((v) => typeof v === 'number')) {
        if (Math.abs(item[0] - campus.origin.lon) > 0.1 || Math.abs(item[1] - campus.origin.lat) > 0.1) throw new RangeError('WGS84 geometry exceeds the local campus projection range.');
        return [(item[0] - campus.origin.lon) * Math.PI / 180 * east, (item[1] - campus.origin.lat) * Math.PI / 180 * north];
      }
      if (!Array.isArray(item)) throw new TypeError('Invalid geometry coordinates.'); return item.map(convert);
    }
    return convert(value.coordinates);
  }
  /** @param {Record<string,unknown>} transforms */
  function validTransformPair(transforms) {
    const first = transforms.legacyToMeters; const second = transforms.metersToLegacy;
    if (!record(first) || !record(second)) return false;
    for (const value of [first, second]) if (!['x', 'y'].every((axis) => Array.isArray(value[axis]) && value[axis].length === 3 && value[axis].every((n) => typeof n === 'number' && Number.isFinite(n)))) return false;
    const x = /** @type {number[]} */ (first.x); const y = /** @type {number[]} */ (first.y); const u = /** @type {number[]} */ (second.x); const v = /** @type {number[]} */ (second.y);
    return Math.abs(x[0] * y[1] - x[1] * y[0]) > 1e-12 && [u[0] * x[0] + u[1] * y[0] - 1, u[0] * x[1] + u[1] * y[1], u[0] * x[2] + u[1] * y[2] + u[2], v[0] * x[0] + v[1] * y[0], v[0] * x[1] + v[1] * y[1] - 1, v[0] * x[2] + v[1] * y[2] + v[2]].every((residual) => Math.abs(residual) < 1e-6);
  }
  /** @param {import('../types/platform-types').PlatformCampus} campus @param {Entity[]} entities @param {import('../types/platform-types').PlatformSource[]} sources @param {Record<string,unknown> | null} seed @returns {Record<string,unknown>} */
  function visualizationPlan(campus, entities, sources, seed) {
    /** @param {Geometry | null} value @param {string} kind */
    const boundaryFeature = (value, kind) => {
      if (!value) return null;
      const local = localGeometry(value, campus);
      const parts = /** @type {number[][][][]} */ (value.type === 'Polygon' ? [local] : local);
      const polygons = parts.map((part) => ({ outer: part[0].slice(0, -1), holes: part.slice(1).map((hole) => hole.slice(0, -1)) }));
      return { id: `${campus.id}:${kind}`, name: ({legal:'법적 경계',planning:'계획 경계',cadastral:'지적 경계'})[kind] || kind, geometryType:'polygon', pointsMeters:polygons[0]?.outer || [], polygonsMeters:polygons, sourceId:value.sourceIds[0], confidence:value.confidence, boundaryType:kind, isLegalBoundary:kind === 'legal' };
    };
    const shape = localGeometry(campus.boundaries.guide, campus);
    const polygons = /** @type {number[][][][]} */ (campus.boundaries.guide.type === 'Polygon' ? [shape] : shape);
    const polygonsMeters = polygons.map((polygon) => ({ outer: polygon[0].slice(0, -1), holes: polygon.slice(1).map((hole) => hole.slice(0, -1)) }));
    /** @type {Record<string,Record<string,unknown>[]>} */ const features = { buildings: [], roads: [], paths: [], parking: [], sports: [], greenery: [], water: [], entrances: [], context: [] };
    const anchors = [];
    for (const item of entities.filter((candidate) => candidate.campusId === campus.id && candidate.geometry && candidate.kind !== 'campus')) {
      const geom = /** @type {Geometry} */ (item.geometry); const data = localGeometry(geom, campus);
      const polygonShapes = /** @type {number[][][][]} */ (geom.type === 'Polygon' ? [data] : geom.type === 'MultiPolygon' ? data : []);
      const parts = polygonShapes.map((polygon) => ({ outer: polygon[0].slice(0, -1), holes: polygon.slice(1).map((hole) => hole.slice(0, -1)) }));
      const pointsMeters = geom.type === 'Point' ? [data] : parts.length ? parts[0].outer : data;
      const feature = { id: item.legacyId || item.id, legacyKey: item.legacyKey || undefined, name: item.name, aliases: [...item.aliases], kind: item.category === 'greenery' && item.feature?.kind === 'forest' ? 'forest' : item.category, geometryType: geom.type === 'Point' ? 'point' : geom.type === 'LineString' ? 'line' : 'polygon', pointsMeters, polygonsMeters: parts.length ? parts : undefined, sourceId: geom.sourceIds[0] || '', confidence: geom.confidence, status: item.confidence === 'verified' ? 'mapped' : 'estimated', anchorMeters: item.position ? [item.position.east, item.position.north] : undefined, angleRadians: item.modelPose?.rotationRadians || 0 };
      const layer = item.kind === 'building' ? 'buildings' : item.category === 'entrances' ? 'entrances' : Object.prototype.hasOwnProperty.call(features, item.category) ? item.category : 'context'; features[layer].push(feature);
      if (item.kind === 'building' && item.position) anchors.push({ id: item.legacyId || item.id, meters: [item.position.east, item.position.north], rotationRadians: feature.angleRadians, sourceId: item.claims.location.sourceIds[0], status: item.claims.location.confidence, rotationStatus: 'estimated' });
    }
    const sourceRows = sources.map((source) => ({ id: source.id, title: source.title, url: source.url, date: source.dates.referenceDate, scope: source.scope, usage: source.usage, confidence: source.confidence }));
    const result = { metadata: { title: campus.name, address: campus.address, referenceDate: seed && record(seed.metadata) && date(seed.metadata.referenceDate) ? seed.metadata.referenceDate : null, legalBoundaryVerified: campus.boundaries.legal !== null, metersPerWorldUnit: 10 }, projection: { kind: 'local-linear-WGS84', origin: { lat: campus.origin.lat, lon: campus.origin.lon }, unit: 'm', axes: ['east', 'north'], verticalDatum: campus.verticalDatum }, boundaries: { campusMapped: { id: `${campus.id}:guide`, name: '캠퍼스 안내 영역', geometryType: 'polygon', pointsMeters: polygonsMeters[0]?.outer || [], polygonsMeters, sourceId: campus.boundaries.guide.sourceIds[0], confidence: campus.boundaries.guide.confidence, isLegalBoundary: false, boundaryType: 'guide' }, legal: boundaryFeature(campus.boundaries.legal, 'legal'), planning: boundaryFeature(campus.boundaries.planning, 'planning'), cadastral: boundaryFeature(campus.boundaries.cadastral, 'cadastral') }, features, anchors, sources: sourceRows, transforms: {} };
    if (seed && record(seed.transforms)) {
      const transforms = {};
      for (const name of ['legacyToMeters', 'metersToLegacy']) { const value = seed.transforms[name]; if (record(value) && ['x', 'y'].every((axis) => Array.isArray(value[axis]) && value[axis].length === 3 && value[axis].every((n) => typeof n === 'number' && Number.isFinite(n)))) Reflect.set(transforms, name, { x: clone(value.x), y: clone(value.y) }); }
      result.transforms = transforms;
    }
    if (campus.terrain?.coordinateSystem === 'local-meters') result.transforms = { legacyToMeters: { x: [1, 0, 0], y: [0, 1, 0] }, metersToLegacy: { x: [1, 0, 0], y: [0, 1, 0] } };
    return result;
  }
  /** @param {Catalog} catalog @param {Set<string>} sourceIds */
  function publicEntityIds(catalog, sourceIds) {
    const allowed = new Set(catalog.entities.filter((item) => item.visibility === 'public' && !item.sensitive).map((item) => item.id));
    const campusIds = new Set(catalog.campuses.filter((campus) => campus.boundaries.guide.sourceIds.every((sourceId) => sourceIds.has(sourceId))).map((campus) => campus.id));
    for (const item of catalog.entities) if (!campusIds.has(item.campusId)) allowed.delete(item.id);
    let changed = true; while (changed) { changed = false; for (const item of catalog.entities) if (allowed.has(item.id) && (item.parentId && !allowed.has(item.parentId) || item.owningBuildingId && !allowed.has(item.owningBuildingId) || item.floorId && !allowed.has(item.floorId))) { allowed.delete(item.id); changed = true; } }
    return allowed;
  }
  /** @param {import('../scene/model-loader').ModelManifest} manifest @param {Entity[]} entities @param {Set<string>} sourceIds @returns {import('../scene/model-loader').ModelManifest} */
  function publicModels(manifest, entities, sourceIds) {
    /** @param {Record<string,unknown>} value @param {string[]} keys */
    const pick = (value, keys) => Object.fromEntries(keys.filter((key) => value[key] !== undefined).map((key) => [key,clone(value[key])]));
    const models = manifest.models.filter((model) => (!model.provenance || sourceIds.has(model.provenance.sourceId)) && entities.some((item) => item.kind === 'building' && item.campusId === (model.campusId || manifest.campusId) && [item.id,item.legacyId,item.legacyKey].some((key) => key && [model.buildingId,model.id,model.legacyId].includes(key)))).map((model) => {
      const output = pick(/** @type {Record<string,unknown>} */ (/** @type {unknown} */ (model)), ['id','campusId','buildingId','legacyId','kind','source','global','export','status','bytes','sha256']);
      if (model.placement) output.placement = pick(/** @type {Record<string,unknown>} */ (/** @type {unknown} */ (model.placement)), ['units','upAxis','origin','anchorMeters','yawRadians','altitudeDatum','mode']);
      if (model.variants) output.variants = model.variants.map((variant) => ({ ...pick(/** @type {Record<string,unknown>} */ (/** @type {unknown} */ (variant)), ['id','source','kind','global','export','maxDistanceMeters','minScreenCoverage','bytes','sha256']), ...(variant.placement ? {placement:pick(/** @type {Record<string,unknown>} */ (/** @type {unknown} */ (variant.placement)), ['units','upAxis','origin','anchorMeters','yawRadians','altitudeDatum','mode'])} : {}) }));
      if (model.provenance && sourceIds.has(model.provenance.sourceId)) output.provenance = pick(/** @type {Record<string,unknown>} */ (/** @type {unknown} */ (model.provenance)), ['sourceId','license','creator','tool','settings','sourceHash']);
      return /** @type {import('../scene/model-loader').ModelEntry} */ (/** @type {unknown} */ (output));
    });
    return {schemaVersion:1,version:manifest.version,...(manifest.campusId && entities.some(item=>item.campusId===manifest.campusId) ? {campusId:manifest.campusId}:{}),models};
  }
  /** @param {Catalog} catalog @returns {Catalog} */
  function publicCatalog(catalog) {
    const sourceIds = new Set(catalog.sources.filter((source) => source.visibility === 'public').map((source) => source.id));
    const allowed = publicEntityIds(catalog, sourceIds);
    const geometry = (/** @type {Geometry | null} */ value) => value && value.sourceIds.every((sourceId) => sourceIds.has(sourceId)) ? { type: value.type, coordinates: clone(value.coordinates), coordinateSystem: value.coordinateSystem, unit: value.unit, originId: value.originId, sourceIds: [...value.sourceIds], confidence: value.confidence, ...(value.boundaryType ? { boundaryType: value.boundaryType } : {}), ...(typeof value.isLegalBoundary === 'boolean' ? { isLegalBoundary: value.isLegalBoundary } : {}) } : null;
    const publicEntities = catalog.entities.filter((item) => allowed.has(item.id)).map((item) => {
      const output = entity(item.id, item.kind, item.campusId, item.name, dates(null));
      for (const key of ['parentId', 'owningBuildingId', 'legacyId', 'legacyKey', 'displayTitle', 'aliases', 'purpose', 'category', 'floorId', 'floorLabel', 'sortOrder', 'roomCode', 'status', 'confidence']) Reflect.set(output, key, clone(Reflect.get(item, key)));
      output.modelPose = item.modelPose ? { rotationRadians: item.modelPose.rotationRadians, confidence: item.modelPose.confidence } : null;
      output.geometry = geometry(item.geometry); output.position = item.position && item.claims.location.sourceIds.every((sourceId) => sourceIds.has(sourceId)) ? { east: item.position.east, north: item.position.north, up: item.position.up } : null;
      output.translations = Object.fromEntries(Object.entries(item.translations).filter(([, translation]) => translation.verified && translation.sourceId && sourceIds.has(translation.sourceId)).map(([language, translation]) => [language, { name: translation.name, verified: true, sourceId: translation.sourceId }]));
      for (const key of ['name', 'location', 'outline', 'height', 'operation']) { const proof = /** @type {Claim} */ (Reflect.get(item.claims, key)); const filtered = proof.sourceIds.filter((sourceId) => sourceIds.has(sourceId)); const disclosed = filtered.length === proof.sourceIds.length; Reflect.set(output.claims, key, claim(filtered, disclosed ? proof.confidence : 'unverified', disclosed ? proof.method : 'withheld-evidence', disclosed ? proof.dates : dates(null), disclosed ? proof.notes : '비공개 근거 제외')); }
      output.interior = conceptInterior(item.interior, item.legacyId || '');
      // Only the registered forest drawing style survives; raw feature payloads stay private.
      output.feature = output.geometry && item.category === 'greenery' && item.feature?.kind === 'forest' ? { kind: 'forest' } : null;
      return output;
    });
    const publicSources = catalog.sources.filter((source) => sourceIds.has(source.id)).map((source) => ({ id: source.id, title: source.title, url: source.url, scope: source.scope, usage: source.usage, visibility: /** @type {const} */ ('public'), dates: publicDates(source.dates), confidence: source.confidence }));
    const campuses = catalog.campuses.filter((campus) => allowed.has(campus.id) && geometry(campus.boundaries.guide)).map((campus) => ({ id: campus.id, name: campus.name, address: campus.address, origin: { lat: campus.origin.lat, lon: campus.origin.lon }, unit: /** @type {const} */ ('m'), verticalDatum: campus.verticalDatum, terrain: terrainProjection(campus.terrain), boundaries: { guide: /** @type {Geometry} */ (geometry(campus.boundaries.guide)), legal: geometry(campus.boundaries.legal), planning: geometry(campus.boundaries.planning), cadastral: geometry(campus.boundaries.cadastral) }, visualizationPlan: /** @type {Record<string,unknown> | null} */ (null) }));
    for (const campus of campuses) campus.visualizationPlan = visualizationPlan(campus, publicEntities, publicSources, catalog.campuses.find((item) => item.id === campus.id)?.visualizationPlan || null);
    const publicEdges = catalog.routes.edges.filter((edge) => allowed.has(edge.from) && allowed.has(edge.to) && edge.sourceIds.every((sourceId) => sourceIds.has(sourceId))).map((edge) => ({ id: edge.id, from: edge.from, to: edge.to, campusId: edge.campusId, lengthMeters: edge.lengthMeters, bidirectional: edge.bidirectional, kind: edge.kind, verification: edge.verification, sourceIds: [...edge.sourceIds], reviewedAt: edge.reviewedAt, validFrom: edge.validFrom, validUntil: edge.validUntil, accessibility: { verification: edge.accessibility.verification, assessedProfile: edge.accessibility.assessedProfile, widthMeters: edge.accessibility.widthMeters, slopePercent: edge.accessibility.slopePercent, thresholdMm: edge.accessibility.thresholdMm, surface: edge.accessibility.surface, stepFree: edge.accessibility.stepFree, operationalVerified: edge.accessibility.operationalVerified, validUntil: edge.accessibility.validUntil } }));
    const activity = (/** @type {import('../types/platform-types').CatalogActivity[]} */ rows) => rows.filter((row) => row.visibility === 'public' && allowed.has(row.entityId) && row.sourceIds.every((sourceId) => sourceIds.has(sourceId))).map((row) => ({ id: row.id, title: row.title, entityId: row.entityId, sourceIds: [...row.sourceIds], visibility: /** @type {const} */ ('public'), validFrom: row.validFrom, validUntil: row.validUntil, status: row.status, description: row.description }));
    const output = { schemaVersion: /** @type {const} */ (1), contentVersion: catalog.contentVersion, assetsVersion: catalog.assetsVersion, datasetVersion: catalog.contentVersion, activeCampusId: campuses.some((campus) => campus.id === catalog.activeCampusId) ? catalog.activeCampusId : campuses[0]?.id || '', metadata: { title: string(catalog.metadata.title), referenceDate: date(catalog.metadata.referenceDate) ? catalog.metadata.referenceDate : null, boundaryNote: '안내 영역과 법적 경계를 구분한다.', operationalData: string(catalog.metadata.operationalData) }, campuses, entities: publicEntities, sources: publicSources, routes: { nodes: catalog.routes.nodes.filter((nodeId) => allowed.has(nodeId)), edges: publicEdges }, operations: catalog.operations.filter((row) => row.visibility === 'public' && allowed.has(row.entityId) && row.sourceIds.every((sourceId) => sourceIds.has(sourceId))).map((row) => ({ id: row.id, entityId: row.entityId, state: row.state, label: row.label, sourceIds: [...row.sourceIds], visibility: /** @type {const} */ ('public'), verification: row.verification, observedAt: row.observedAt, validFrom: row.validFrom, validUntil: row.validUntil })), tours: catalog.tours.map((tour) => ({ id: tour.id, name: tour.name, campusId: tour.campusId, mode: /** @type {const} */ ('virtual'), stops: tour.stops.filter((stop) => allowed.has(stop.entityId) && stop.sourceIds.every((sourceId) => sourceIds.has(sourceId))).map((stop) => ({ entityId: stop.entityId, title: stop.title, sourceIds: [...stop.sourceIds] })), note: tour.note })).filter((tour) => campuses.some((campus) => campus.id === tour.campusId) && tour.stops.length), events: activity(catalog.events), services: activity(catalog.services), layers: catalog.layers.map((layer) => ({ id: layer.id, name: layer.name, defaultVisible: layer.defaultVisible, status: layer.status })) };
    const result = /** @type {Catalog} */ (output);
    if (catalog.assetManifest) result.assetManifest = publicModels(catalog.assetManifest, publicEntities, sourceIds);
    return result;
  }
  /** @param {Record<string,unknown> | null} terrain */
  function terrainProjection(terrain) { if (!terrain) return null; return { source: string(terrain.source), baseElevationMeters: terrain.baseElevationMeters, xs: clone(terrain.xs ?? []), zs: clone(terrain.zs ?? []), elevations: clone(terrain.elevations ?? []), coordinateSystem: terrain.coordinateSystem, horizontalUnit: terrain.horizontalUnit, verticalUnit: terrain.verticalUnit, originId: terrain.originId, status: 'unverified', verticalDatum: 'unverified' }; }
  /** @param {unknown} input @param {Catalog} [current] @returns {import('../types/platform-types').ImportResult} */
  function validateImport(input, current) {
    let candidate = input;
    if (typeof input === 'string') { if (utf8Length(input) > MAX_IMPORT_BYTES) return { valid: false, errors: ['Import exceeds the 2 MiB limit.'], catalog: null, diff: null }; try { candidate = JSON.parse(input); } catch { return { valid: false, errors: ['Import is not valid JSON.'], catalog: null, diff: null }; } }
    const result = validateCatalog(candidate); if (!result.valid) return { ...result, catalog: null, diff: null };
    const catalog = clone(/** @type {Catalog} */ (candidate));
    try { for (const campus of catalog.campuses) campus.visualizationPlan = visualizationPlan(campus, catalog.entities, catalog.sources, campus.visualizationPlan); } catch (error) { return { valid: false, errors: [error instanceof Error ? error.message : 'Coordinate transformation failed.'], catalog: null, diff: null }; }
    if (current && current.contentVersion === catalog.contentVersion && JSON.stringify(current) !== JSON.stringify(candidate)) return { valid: false, errors: ['Changed content requires a new contentVersion.'], catalog: null, diff: null };
    return { valid: true, errors: [], catalog, diff: current ? diffCatalog(current, catalog) : null };
  }
  /** @param {unknown} input @param {Catalog} [catalog] @returns {import('../types/platform-types').ParsedState} */
  function parseState(input, catalog) {
    const errors = []; let value = input;
    const available = catalog ? publicCatalog(catalog) : undefined;
    if (typeof input === 'string') {
      if (input.length > 4096) return { valid: false, errors: ['Shared state is too long.'], state: null };
      const query = input.includes('?') ? input.slice(input.indexOf('?') + 1).split('#')[0] : input.replace(/^[?#]/, ''); const p = new Map();
      try { for (const entry of query.split('&').filter(Boolean)) { const split = entry.indexOf('='); const key = decodeURIComponent(split < 0 ? entry : entry.slice(0, split)); const content = decodeURIComponent((split < 0 ? '' : entry.slice(split + 1)).replace(/\+/g, ' ')); if (p.has(key)) throw new TypeError('Duplicate shared state fields.'); p.set(key, content); } } catch { return { valid: false, errors: ['Malformed shared state encoding.'], state: null }; }
      value = { version: Number(p.get('version')), campusId: p.get('campusId'), entityId: p.get('entityId') || null, view: p.get('view'), layers: (p.get('layers') || '').split(',').filter(Boolean), floorId: p.get('floorId') || null, time: p.get('time') || null, ...Object.fromEntries(['contentVersion','assetsVersion','releaseId'].filter((key) => p.has(key)).map((key) => [key,p.get(key)])) };
    }
    if (!record(value)) return { valid: false, errors: ['Shared state must be an object or URL query.'], state: null };
    if (value.version !== 1 || !id(value.campusId) || !['overview', 'top', 'free', '2d', 'text'].includes(string(value.view))) errors.push('Invalid shared state version, campus or view.');
    for (const key of ['entityId', 'floorId']) if (value[key] !== null && !id(value[key])) errors.push(`Invalid ${key}.`);
    const layerIds = available ? available.layers.map((layer) => layer.id) : ['boundary', 'buildings', 'roads', 'paths', 'parking', 'sports', 'greenery', 'trees', 'water', 'entrances', 'context', 'labels', 'contours'];
    if (!Array.isArray(value.layers) || !value.layers.every((layer) => typeof layer === 'string' && layerIds.includes(layer)) || new Set(value.layers).size !== value.layers.length) errors.push('Invalid layer selection.');
    if (value.time !== null && !timestamp(value.time)) errors.push('Invalid shared time.');
    for (const key of ['contentVersion','assetsVersion','releaseId']) if (value[key] !== undefined && (typeof value[key] !== 'string' || !/^[a-zA-Z0-9_.:-]{1,160}$/.test(value[key]))) errors.push(`Invalid shared ${key}.`);
    if (available) { if (!available.campuses.some((campus) => campus.id === value.campusId)) errors.push('Unknown campus.'); for (const key of ['entityId', 'floorId']) if (typeof value[key] === 'string') { const target = resolve(available, string(value[key])); if (!target || target.id !== value[key] || target.campusId !== value.campusId || target.visibility !== 'public' || target.sensitive || key === 'floorId' && target.kind !== 'floor') errors.push(`Unknown or unavailable ${key}.`); } if (typeof value.entityId === 'string' && typeof value.floorId === 'string' && resolve(available, value.entityId)?.owningBuildingId !== resolve(available, value.floorId)?.owningBuildingId) errors.push('Floor and selected entity belong to different buildings.'); }
    return { valid: errors.length === 0, errors, state: errors.length ? null : { version: 1, campusId: string(value.campusId), entityId: typeof value.entityId === 'string' ? value.entityId : null, view: /** @type {import('../types/platform-types').SharedState['view']} */ (value.view), layers: array(value.layers).filter((layer) => typeof layer === 'string'), floorId: typeof value.floorId === 'string' ? value.floorId : null, time: typeof value.time === 'string' ? value.time : null, ...Object.fromEntries(['contentVersion','assetsVersion','releaseId'].filter((key) => typeof value[key] === 'string').map((key) => [key,value[key]])) } };
  }
  /** @param {import('../types/platform-types').SharedState} state */
  function serializeState(state) { const check = parseState(state); if (!check.valid) throw new TypeError(check.errors.join(' ')); const p = [['version', '1'], ['campusId', state.campusId], ['view', state.view], ['layers', state.layers.join(',')]]; if (state.entityId) p.push(['entityId', state.entityId]); if (state.floorId) p.push(['floorId', state.floorId]); if (state.time) p.push(['time', state.time]); for (const key of ['contentVersion','assetsVersion','releaseId']) { const value = Reflect.get(state,key); if (typeof value === 'string' && value) p.push([key,value]); } return p.map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`).join('&'); }
  /** @returns {Preferences} */
  function emptyPreferences() { return { schemaVersion: 1, favorites: [], recent: [], timetable: [] }; }
  /** @param {string} targetId */
  function migratedId(targetId) { return BUILDINGS.includes(targetId) ? `hanshin-gg:building:${targetId}` : targetId; }
  /** @param {unknown} value @returns {Preferences} */
  function preferences(value) {
    if (!record(value) || ![0, 1].includes(Number(value.schemaVersion ?? value.version))) throw new TypeError('Unsupported local preference version.');
    const result = emptyPreferences();
    for (const key of ['favorites', 'recent']) { if (!Array.isArray(value[key]) || !value[key].every((v) => typeof v === 'string' && id(migratedId(v)))) throw new TypeError('Invalid saved place IDs.'); Reflect.set(result, key, [...new Set(value[key].map((v) => migratedId(v)))].slice(0, key === 'recent' ? 30 : 500)); }
    if (!Array.isArray(value.timetable) || value.timetable.length > 200) throw new TypeError('Invalid local timetable.');
    result.timetable = value.timetable.map((entry) => { if (!record(entry) || !id(entry.id) || !id(entry.entityId) || typeof entry.title !== 'string' || entry.title.length > 120 || !Number.isInteger(entry.day) || Number(entry.day) < 0 || Number(entry.day) > 6 || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(string(entry.start)) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(string(entry.end)) || string(entry.end) <= string(entry.start)) throw new TypeError('Invalid timetable entry.'); return { id: string(entry.id), entityId: migratedId(string(entry.entityId)), title: entry.title, day: Number(entry.day), start: string(entry.start), end: string(entry.end) }; });
    if (new Set(result.timetable.map((entry) => entry.id)).size !== result.timetable.length) throw new TypeError('Duplicate timetable IDs.');
    return result;
  }
  /** @param {import('../types/platform-types').StorageAdapter | null | undefined} storage @param {string} [key] @returns {import('../types/platform-types').LocalStore} */
  function createLocalStore(storage, key = 'hanshin-campus-platform:v1') {
    /** @type {Preferences} */ let memory = emptyPreferences();
    /** @param {unknown} error */ function failure(error) { return { ok: false, value: clone(memory), error: error instanceof Error ? error.message : '로컬 저장소를 사용할 수 없습니다.' }; }
    function load() { try { if (!storage) throw new Error('로컬 저장소를 사용할 수 없습니다.'); const raw = storage.getItem(key); memory = raw ? preferences(JSON.parse(raw)) : emptyPreferences(); if (raw && JSON.stringify(memory) !== raw) storage.setItem(key, JSON.stringify(memory)); return { ok: true, value: clone(memory), error: null }; } catch (error) { return failure(error); } }
    /** @param {(value:Preferences)=>void} change */ function update(change) { const current = load(); if (!current.ok) return current; try { const next = clone(current.value); change(next); const checked = preferences(next); if (!storage) throw new Error('로컬 저장소를 사용할 수 없습니다.'); storage.setItem(key, JSON.stringify(checked)); memory = checked; return { ok: true, value: clone(memory), error: null }; } catch (error) { return failure(error); } }
    return { load, save: (value) => { try { const checked = preferences(value); if (!storage) throw new Error('로컬 저장소를 사용할 수 없습니다.'); storage.setItem(key, JSON.stringify(checked)); memory = checked; return { ok: true, value: clone(memory), error: null }; } catch (error) { return failure(error); } }, addFavorite: (targetId) => update((value) => { if (!id(targetId)) throw new TypeError('Invalid favorite ID.'); value.favorites = [...new Set([...value.favorites, targetId])]; }), removeFavorite: (targetId) => update((value) => { value.favorites = value.favorites.filter((saved) => saved !== targetId); }), recordRecent: (targetId) => update((value) => { if (!id(targetId)) throw new TypeError('Invalid recent ID.'); value.recent = [targetId, ...value.recent.filter((saved) => saved !== targetId)].slice(0, 30); }), saveTimetable: (entry) => update((value) => { value.timetable = [...value.timetable.filter((saved) => saved.id !== entry.id), entry]; }), removeTimetable: (entryId) => update((value) => { value.timetable = value.timetable.filter((saved) => saved.id !== entryId); }), reset: () => { try { if (!storage) throw new Error('로컬 저장소를 사용할 수 없습니다.'); storage.removeItem(key); memory = emptyPreferences(); return { ok: true, value: clone(memory), error: null }; } catch (error) { return failure(error); } } };
  }
  /** @type {import('../types/platform-types').PlatformApi} */
  const api = { createCatalog, validateCatalog, search, resolve, route, operationStatus, diffCatalog, publicCatalog, validateImport, serializeState, parseState, createLocalStore };
  Object.assign(globalThis, { CampusPlatform: api });
  if (typeof window !== 'undefined') Object.assign(window, { CampusPlatform: api });
})();
