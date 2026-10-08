import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
for (const name of ['src/data/campus-data.js', 'src/data/interior-data.js', 'src/data/site-plan.js', 'src/domain/campus-platform.js']) vm.runInContext(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'), context, { filename: name });
const api = context.CampusPlatform;
const plain = (value) => JSON.parse(JSON.stringify(value));
const realCatalog = api.createCatalog(context.SitePlanData, context.window.CampusData);
const current = () => plain(realCatalog);
const ids = ['janggong', 'pilheon', 'manwoo'].map((name) => `hanshin-gg:building:${name}`);
const at = '2026-10-07T12:00:00Z';
const sourceId = 'hanshin-official-tour';

// Synthetic reviewed edge records are isolated fixtures, never production data.
function edge(id, from, to, lengthMeters, kind = 'walk', accessible = false) {
  return { id, from, to, campusId: 'hanshin-gg', lengthMeters, bidirectional: true, kind, verification: 'verified', sourceIds: [sourceId], reviewedAt: '2026-10-01T00:00:00Z', validFrom: '2026-10-01T00:00:00Z', validUntil: '2026-11-01T00:00:00Z', accessibility: { verification: accessible ? 'verified' : 'unverified', assessedProfile: accessible ? 'wheelchair' : null, widthMeters: accessible ? 1.2 : null, slopePercent: accessible ? 3 : null, thresholdMm: accessible ? 0 : null, surface: accessible ? 'reviewed-firm-surface' : null, stepFree: accessible ? true : null, operationalVerified: accessible, validUntil: accessible ? '2026-11-01T00:00:00Z' : null } };
}
function graph() { const catalog = current(); catalog.routes = { nodes: ids, edges: [edge('direct-stairs', ids[0], ids[1], 10, 'stairs'), edge('ramp-a', ids[0], ids[2], 15, 'ramp', true), edge('ramp-b', ids[2], ids[1], 15, 'walk', true)] }; return catalog; }
function operation(entityId, state = 'closed') { return { id: 'operation-closure', entityId, state, label: '검토된 임시 제한 fixture', sourceIds: [sourceId], visibility: 'public', verification: 'verified', observedAt: '2026-10-01T00:00:00Z', validFrom: '2026-10-05T00:00:00Z', validUntil: '2026-10-10T00:00:00Z' }; }
function storage() { const data = new Map(); return { data, getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) }; }

test('real source conversion preserves all 16 stable model identities without fabricating a second campus', () => {
  assert.equal(api.validateCatalog(realCatalog).valid, true);
  assert.equal(realCatalog.campuses.length, 1);
  assert.equal(realCatalog.campuses[0].id, 'hanshin-gg');
  const buildings = realCatalog.entities.filter((entity) => entity.kind === 'building');
  assert.equal(buildings.length, 16);
  for (const building of buildings) {
    assert.equal(building.id, `hanshin-gg:building:${building.legacyId}`);
    assert.equal(api.resolve(realCatalog, building.legacyId).id, building.id);
    assert.equal(building.claims.outline.confidence, 'estimated');
    assert.equal(building.claims.height.confidence, 'unverified');
    assert.equal(building.claims.operation.confidence, 'unverified');
  }
  assert.equal(realCatalog.campuses[0].boundaries.legal, null);
  assert.equal(realCatalog.campuses[0].boundaries.guide.isLegalBoundary, false);
  assert.equal(realCatalog.operations.length, 0);
  assert.equal(realCatalog.events.length, 0);
  assert.equal(realCatalog.services.length, 0);
});

test('existing interior layouts remain concept records and never become geographic rooms or reviewed routes', () => {
  const floors = realCatalog.entities.filter((entity) => entity.kind === 'floor');
  const spaces = realCatalog.entities.filter((entity) => ['space', 'door'].includes(entity.kind) && entity.claims.name.sourceIds.includes('legacy-concept-interiors'));
  assert.ok(floors.length > 16);
  assert.ok(spaces.length > 50);
  for (const space of spaces) { assert.equal(space.position, null); assert.equal(space.geometry, null); assert.equal(space.claims.location.confidence, 'unverified'); }
  assert.equal(realCatalog.routes.edges.length, 0);
  assert.equal(api.route(realCatalog, { from: ids[0], to: ids[1], at }).status, 'unavailable');
  const building = api.resolve(realCatalog, ids[0]);
  assert.equal(building.interior.status, 'concept');
  assert.equal(building.interior.confidence, 'estimated');
  assert.ok(building.interior.zones.some((zone) => zone.id === 'general-affairs'));
});

test('residential private details are excluded while publicly described common facilities remain', () => {
  const dormitory = api.resolve(realCatalog, 'seongbin');
  assert.ok(dormitory.interior.zones.some((zone) => zone.id === 'seongbin-common'));
  assert.ok(dormitory.interior.zones.every((zone) => zone.kind !== 'dorm'));
  assert.ok(dormitory.interior.rooms.every((room) => !/[123]인실|기숙사실/.test(room.name)));
  assert.ok(!realCatalog.entities.some((entity) => entity.legacyId === 'seongbin-new'));
});

test('search supports actual aliases, purposes and floor labels, using only verified translations', () => {
  const catalog = current();
  assert.ok(api.search(catalog, '대학원').some((entity) => entity.legacyId === 'pilheon'));
  assert.ok(api.search(catalog, '203', { kind: 'space' }).some((entity) => entity.name.includes('203')));
  assert.ok(api.search(catalog, '2F', { kind: 'floor' }).length > 0);
  const building = catalog.entities.find((entity) => entity.id === ids[0]);
  building.translations.en = { name: 'Unreviewed invented label', verified: false, sourceId: null };
  assert.equal(api.search(catalog, 'Unreviewed invented label', { language: 'en' }).length, 0);
  building.translations.en = { name: 'Reviewed translation fixture', verified: true, sourceId };
  assert.equal(api.search(catalog, 'Reviewed translation fixture', { language: 'en' })[0].id, building.id);
  building.status = 'historic';
  assert.equal(api.search(catalog, 'Reviewed translation fixture', { language: 'en' }).length, 0);
});

test('virtual tours reference existing buildings and cite sources without implying a walking route', () => {
  for (const tour of realCatalog.tours) { assert.equal(tour.mode, 'virtual'); for (const stop of tour.stops) { assert.equal(api.resolve(realCatalog, stop.entityId).kind, 'building'); assert.ok(stop.sourceIds.length); } }
  assert.equal(realCatalog.tours[0].stops.length, 16);
});

test('schema rejects duplicate IDs, broken ownership, cycles, cross-campus references and unsupported versions', () => {
  for (const change of [
    (catalog) => catalog.entities.push(plain(catalog.entities[0])),
    (catalog) => { catalog.entities[1].parentId = 'missing-id'; },
    (catalog) => { catalog.entities[1].parentId = catalog.entities[1].id; },
    (catalog) => { catalog.entities[1].campusId = 'unregistered-campus'; },
    (catalog) => { catalog.entities[1].floorId = ids[0]; },
    (catalog) => { catalog.schemaVersion = 7; },
    (catalog) => { catalog.entities[1].kind = 'person'; },
    (catalog) => { catalog.entities[1].visibility = 'secret-public'; },
  ]) { const catalog = current(); change(catalog); assert.equal(api.validateCatalog(catalog).valid, false); }
});

test('geometry validation rejects malformed rings, self-crossing boundaries, unsupported units and missing sources', () => {
  for (const change of [
    (geometry) => { geometry.coordinates = [[[[0, 0], [1, 0], [1, 1], [0, 1]]]]; },
    (geometry) => { geometry.coordinates = [[[[0, 0], [4, 4], [0, 5], [5, 0], [0, 0]]]]; },
    (geometry) => { geometry.coordinates = [[[[0, 0], [3, 0], [3, 3], [0, 3], [0, 0]], [[5, 5], [6, 5], [6, 6], [5, 5]]]]; },
    (geometry) => { geometry.unit = 'mm'; },
    (geometry) => { geometry.sourceIds = ['invented-source']; },
    (geometry) => { geometry.originId = 'different-origin'; },
  ]) { const catalog = current(); change(catalog.campuses[0].boundaries.guide); assert.equal(api.validateCatalog(catalog).valid, false); }
});

test('MultiPolygon islands and holes survive public projection and generate every visualization part', () => {
  const catalog = current();
  catalog.campuses[0].boundaries.guide.coordinates = [
    [[[0, 0], [1000, 0], [1000, 1000], [0, 1000], [0, 0]], [[20, 20], [20, 40], [40, 40], [40, 20], [20, 20]]],
    [[[2000, 0], [2100, 0], [2100, 100], [2000, 100], [2000, 0]]],
  ];
  assert.equal(api.validateCatalog(catalog).valid, true);
  const output = api.publicCatalog(catalog);
  assert.deepEqual(plain(output.campuses[0].boundaries.guide.coordinates), catalog.campuses[0].boundaries.guide.coordinates);
  const parts = output.campuses[0].visualizationPlan.boundaries.campusMapped.polygonsMeters;
  assert.equal(parts.length, 2); assert.equal(parts[0].holes.length, 1);
});

test('boundary topology rejects repeated vertices, touching or overlapping holes, and overlapping islands', () => {
  const outer = [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]];
  const hole = [[20, 20], [20, 60], [60, 60], [60, 20], [20, 20]];
  for (const coordinates of [
    [[[[0, 0], [100, 0], [100, 100], [100, 0], [0, 100], [0, 0]]]],
    [[outer, [[0, 20], [10, 20], [10, 30], [0, 30], [0, 20]]]],
    [[outer, hole, [[30, 30], [30, 50], [50, 50], [50, 30], [30, 30]]]],
    [[outer], [[[50, 50], [150, 50], [150, 150], [50, 150], [50, 50]]]],
    [[[]]],
  ]) { const catalog = current(); catalog.campuses[0].boundaries.guide.coordinates = coordinates; assert.equal(api.validateCatalog(catalog).valid, false); }
  const nestedIsland = current(); nestedIsland.campuses[0].boundaries.guide.coordinates = [[outer, hole], [[[30, 30], [40, 30], [40, 40], [30, 40], [30, 30]]]];
  assert.equal(api.validateCatalog(nestedIsland).valid, true, 'an island entirely inside another component hole is disjoint');
});

test('normalized GIS import keeps independent campus origins and converts WGS84 without inventing another campus in production', () => {
  const catalog = current(); catalog.contentVersion = 'coordinate-fixture-2'; catalog.datasetVersion = catalog.contentVersion;
  const second = plain(catalog.campuses[0]); second.id = 'test-campus'; second.name = 'Isolated second-origin fixture'; second.origin = { lat: 40, lon: 128 }; second.terrain = null; second.visualizationPlan = null;
  second.boundaries.guide = { ...second.boundaries.guide, originId: second.id, coordinateSystem: 'WGS84', unit: 'degree', coordinates: [[[[128, 40], [128.001, 40], [128.001, 40.001], [128, 40.001], [128, 40]]]] };
  catalog.campuses.push(second);
  const secondEntity = plain(catalog.entities.find((item) => item.kind === 'campus')); secondEntity.id = second.id; secondEntity.campusId = second.id; secondEntity.geometry = second.boundaries.guide; secondEntity.name = second.name; secondEntity.displayTitle = second.name; catalog.entities.push(secondEntity);
  const result = api.validateImport(catalog, realCatalog); assert.equal(result.valid, true, result.errors.join('\n'));
  const imported = result.catalog.campuses.find((campus) => campus.id === second.id); const points = imported.visualizationPlan.boundaries.campusMapped.pointsMeters;
  assert.deepEqual(plain(points[0]), [0, 0]); assert.ok(points[1][0] > 85 && points[1][0] < 86); assert.ok(points[2][1] > 110 && points[2][1] < 112);
  assert.deepEqual(plain(result.catalog.campuses[0].origin), plain(realCatalog.campuses[0].origin));
  const outOfRange = plain(catalog); outOfRange.campuses[1].boundaries.guide.coordinates[0][0][1][0] = 129;
  assert.equal(api.validateImport(outOfRange).valid, false);
  const smallWgs = plain(catalog); smallWgs.campuses[1].boundaries.guide.coordinates = [[[[128, 40], [128.00001, 40], [128.00001, 40.00001], [128, 40.00001], [128, 40]]]];
  assert.equal(api.validateImport(smallWgs).valid, true, 'small degree-valued rings use geographic precision rather than metre-area tolerance');
  assert.equal(api.validateImport(realCatalog, realCatalog).valid, true, 'unchanged content is an idempotent import');
});

test('terrain declares grid units and origin and preserves an invertible legacy mapping', () => {
  assert.equal(realCatalog.campuses[0].terrain.coordinateSystem, 'legacy-model-units');
  for (const change of [
    (campus) => { delete campus.terrain.horizontalUnit; },
    (campus) => { campus.terrain.originId = 'different-origin'; },
    (campus) => { campus.terrain.xs[1] = campus.terrain.xs[0]; },
    (campus) => { campus.visualizationPlan.transforms.metersToLegacy.x[0] = 0; },
  ]) { const catalog = current(); change(catalog.campuses[0]); assert.equal(api.validateImport(catalog).valid, false); }
  const meterGrid = current(); const campus = meterGrid.campuses[0];
  campus.terrain = { source: 'Isolated meter-grid fixture', xs: [-100, 100], zs: [-100, 100], elevations: [[10, 20], [30, 40]], baseElevationMeters: 0, coordinateSystem: 'local-meters', horizontalUnit: 'm', verticalUnit: 'm', originId: campus.id };
  const output = api.validateImport(meterGrid); assert.equal(output.valid, true, output.errors.join('\n'));
  assert.deepEqual(plain(output.catalog.campuses[0].visualizationPlan.transforms.metersToLegacy), { x: [1, 0, 0], y: [0, 1, 0] });
});

test('public projection removes restricted descendants, private evidence, raw feature extras and relation leaks', () => {
  const catalog = current();
  const building = catalog.entities.find((entity) => entity.id === ids[1]); building.visibility = 'restricted';
  const descendants = catalog.entities.filter((entity) => entity.owningBuildingId === building.id).map((entity) => entity.id);
  catalog.metadata.password = 'PRIVATE-METADATA';
  catalog.sources.push({ ...plain(catalog.sources[0]), id: 'private-source', title: 'PRIVATE-SOURCE', visibility: 'restricted' });
  const disclosed = catalog.entities.find((entity) => entity.id === ids[0]);
  disclosed.feature.privateToken = 'PRIVATE-FEATURE';
  disclosed.claims.height = { ...plain(disclosed.claims.height), sourceIds: ['private-source'], method: 'PRIVATE-METHOD', notes: 'PRIVATE-NOTE', confidence: 'verified' };
  catalog.operations.push({ ...operation(building.id), visibility: 'restricted' });
  const output = api.publicCatalog(catalog); const text = JSON.stringify(output);
  for (const secret of ['PRIVATE-METADATA', 'PRIVATE-SOURCE', 'PRIVATE-FEATURE', 'PRIVATE-METHOD', 'PRIVATE-NOTE', 'private-source']) assert.ok(!text.includes(secret), secret);
  for (const entityId of descendants) assert.ok(!output.entities.some((entity) => entity.id === entityId));
  assert.ok(api.search(catalog, '', { kind: 'floor' }).every((item) => !descendants.includes(item.id)));
  assert.ok(output.tours.every((tour) => tour.stops.every((stop) => !descendants.includes(stop.entityId))));
  assert.equal(api.validateCatalog(output).valid, true);
  assert.equal(disclosed.claims.height.confidence, 'verified', 'projection never mutates the private input');
});

test('public visualization preserves model orientation and excludes unknown raw plan metadata', () => {
  const catalog = current(); const building = catalog.entities.find((entity) => entity.id === ids[0]);
  building.modelPose.rotationRadians = 0.731;
  catalog.campuses[0].visualizationPlan.secret = 'PRIVATE-RAW-PLAN';
  const output = api.publicCatalog(catalog);
  const model = output.campuses[0].visualizationPlan.features.buildings.find((entity) => entity.legacyKey === 'janggong');
  assert.equal(model.angleRadians, 0.731);
  assert.ok(!JSON.stringify(output).includes('PRIVATE-RAW-PLAN'));
});

test('public visualization preserves reviewed entity aliases across repeated catalog projections', () => {
  const catalog = current();
  const practice = catalog.entities.find((entity) => entity.legacyId === 'practice');
  assert.ok(practice.aliases.includes('실습동'));
  practice.feature.aliases = ['PRIVATE-RAW-ALIAS'];
  const first = api.publicCatalog(catalog);
  const second = api.publicCatalog(first);
  for (const output of [first, second]) {
    const feature = output.campuses[0].visualizationPlan.features.buildings.find((entity) => entity.legacyKey === 'practice');
    assert.deepEqual(plain(feature.aliases), plain(practice.aliases));
    assert.ok(!JSON.stringify(output).includes('PRIVATE-RAW-ALIAS'));
  }
});

test('public forest drawing style survives projection without exposing raw vegetation metadata', () => {
  const catalog = current();
  const forests = catalog.entities.filter((entity) => entity.category === 'greenery' && entity.feature?.kind === 'forest');
  assert.ok(forests.length > 0);
  for (const forest of forests) forest.feature.privateNotes = 'PRIVATE-VEGETATION-METADATA';
  const first = api.publicCatalog(catalog);
  const second = api.publicCatalog(first);
  for (const output of [first, second]) {
    assert.equal(output.campuses[0].visualizationPlan.features.greenery.filter((feature) => feature.kind === 'forest').length, forests.length);
    assert.ok(!JSON.stringify(output).includes('PRIVATE-VEGETATION-METADATA'));
    assert.equal(api.validateCatalog(output).valid, true);
  }
});

test('public projection whitelists nested spatial and review fields instead of copying hidden importer annotations', () => {
  const catalog = graph(); const building = catalog.entities.find((item) => item.id === ids[0]);
  for (const item of [building.position, building.geometry, building.modelPose, building.claims.location.dates, catalog.sources[0].dates, catalog.campuses[0].origin, catalog.campuses[0].boundaries.guide, catalog.routes.edges[0].accessibility]) item.privateAnnotation = 'PRIVATE-NESTED-IMPORT';
  const output = api.publicCatalog(catalog); assert.ok(!JSON.stringify(output).includes('PRIVATE-NESTED-IMPORT')); assert.equal(api.validateCatalog(output).valid, true);
  assert.equal(building.geometry.privateAnnotation, 'PRIVATE-NESTED-IMPORT');
});

test('reviewed routing respects direction, edge expiry, missing verification and graph disconnection', () => {
  const catalog = graph();
  assert.equal(api.validateCatalog(catalog).valid, true);
  const route = api.route(catalog, { from: ids[0], to: ids[1], at });
  assert.equal(route.status, 'found'); assert.equal(route.verified, true); assert.equal(route.distanceMeters, 10);
  assert.deepEqual(plain(route.nodes.map((node) => node.id)), ids.slice(0, 2));
  catalog.routes.edges.forEach((record) => { record.bidirectional = false; });
  assert.equal(api.route(catalog, { fromId: ids[1], toId: ids[0], at }).status, 'unavailable');
  assert.equal(api.route(catalog, { from: ids[0], to: ids[1], at: '2027-01-01T00:00:00Z' }).status, 'unavailable');
  catalog.routes.edges.forEach((record) => { record.verification = 'estimated'; });
  assert.equal(api.route(catalog, { from: ids[0], to: ids[1], at }).status, 'unavailable');
});

test('accessible routing requires the full reviewed profile and does not equate avoiding steps with accessibility', () => {
  const catalog = graph();
  const found = api.route(catalog, { from: ids[0], to: ids[1], accessible: true, at });
  assert.equal(found.status, 'found'); assert.equal(found.distanceMeters, 30); assert.ok(found.edges.every((record) => record.kind !== 'stairs'));
  for (const field of ['widthMeters', 'slopePercent', 'thresholdMm', 'surface', 'stepFree', 'operationalVerified', 'validUntil']) {
    const incomplete = graph(); incomplete.routes.edges.filter((record) => record.kind !== 'stairs').forEach((record) => { record.accessibility[field] = field === 'operationalVerified' ? false : null; });
    assert.equal(api.route(incomplete, { from: ids[0], to: ids[1], accessible: true, at }).status, 'unavailable', field);
  }
});

test('closure and expired operational evidence prevent a current verified route', () => {
  const catalog = graph(); catalog.operations.push(operation(ids[1]));
  assert.equal(api.operationStatus(catalog, ids[1], at).status, 'closed');
  assert.equal(api.route(catalog, { from: ids[0], to: ids[1], at }).status, 'unavailable');
  assert.equal(api.operationStatus(catalog.operations, ids[1], '2026-10-11T00:00:00Z').status, 'expired');
  assert.equal(api.route(catalog, { from: ids[0], to: ids[1], at: '2026-10-11T00:00:00Z' }).status, 'unavailable');
  assert.equal(api.operationStatus([], ids[0], at).status, 'unknown');
});

test('operation validity does not turn future, private or unverified observations into a current status', () => {
  for (const change of [(row) => { row.observedAt = '2026-10-08T00:00:00Z'; }, (row) => { row.visibility = 'restricted'; }, (row) => { row.verification = 'estimated'; }]) { const row = operation(ids[0], 'open'); change(row); assert.equal(api.operationStatus([row], ids[0], at).status, 'unknown'); }
  assert.equal(api.route(graph(), { from: ids[0], to: ids[1], at: 'invalid' }).status, 'unavailable');
  const privateProof = graph(); privateProof.sources.push({ ...plain(privateProof.sources[0]), id: 'private-route-proof', visibility: 'restricted' });
  privateProof.routes.edges.forEach((record) => { record.sourceIds = ['private-route-proof']; });
  privateProof.operations = [{ ...operation(ids[0], 'open'), sourceIds: ['private-route-proof'] }];
  assert.equal(api.operationStatus(privateProof, ids[0], at).status, 'unknown');
  assert.equal(api.route(privateProof, { from: ids[0], to: ids[1], at }).status, 'unavailable');
});

test('import validates JSON, byte limit, prototype keys, credential URLs and impossible dates', () => {
  assert.equal(api.validateImport('{not JSON').valid, false);
  assert.equal(api.validateImport('x'.repeat(2 * 1024 * 1024 + 1)).valid, false);
  const oversized = current(); oversized.metadata.large = '한'.repeat(750000); assert.equal(api.validateImport(oversized).valid, false);
  for (const change of [(catalog) => { catalog.metadata = JSON.parse('{"__proto__":{"injected":true}}'); }, (catalog) => { catalog.sources[0].url = 'https://user:private@example.com/'; }, (catalog) => { catalog.sources[0].dates.referenceDate = '2026-02-30'; }, (catalog) => { catalog.sources[0].dates.reviewedAt = '2026-10-07T24:00:00Z'; }]) { const catalog = current(); change(catalog); assert.equal(api.validateImport(catalog).valid, false); }
});

test('content changes require a new version and diffs include boundary/source changes', () => {
  const before = current(); const after = current();
  after.entities.find((entity) => entity.id === ids[0]).name = '개정된 명칭 fixture';
  assert.equal(api.validateImport(after, before).valid, false);
  after.contentVersion = 'review-fixture-2'; after.datasetVersion = after.contentVersion; after.sources[0].scope += ' 검토 변경'; after.campuses[0].boundaries.guide.coordinates[0][0][1][0] += 0.1;
  const result = api.validateImport(JSON.stringify(after), before);
  assert.equal(result.valid, true, result.errors.join('\n'));
  assert.ok(result.diff.changed.includes(ids[0])); assert.ok(result.diff.sections.includes('sources')); assert.ok(result.diff.sections.includes('campuses'));
  assert.equal(api.resolve(before, ids[0]).name, '장공관(본관)');
});

test('state URL roundtrips only stable public IDs and rejects cross-building floors and malicious parameters', () => {
  const catalog = current(); const floor = catalog.entities.find((entity) => entity.kind === 'floor' && entity.owningBuildingId === ids[0]);
  const state = { version: 1, campusId: 'hanshin-gg', entityId: ids[0], floorId: floor.id, view: '2d', layers: ['boundary', 'buildings', 'trees'], time: at };
  assert.deepEqual(plain(api.parseState(api.serializeState(state), catalog).state), state);
  assert.equal(api.parseState('version=1&campusId=hanshin-gg&view=top&layers=boundary&entityId=%E0%A4%A', catalog).valid, false);
  assert.equal(api.parseState('version=1&version=1&campusId=hanshin-gg&view=top&layers=boundary', catalog).valid, false);
  assert.equal(api.parseState({ ...state, entityId: ids[1] }, catalog).valid, false);
  catalog.entities.find((entity) => entity.id === ids[0]).visibility = 'restricted';
  assert.equal(api.parseState(state, catalog).valid, false);
  assert.equal(api.parseState({ ...state, entityId: floor.id }, catalog).valid, false, 'a nominally public floor cannot reveal its restricted parent');
  assert.throws(() => api.serializeState({ ...state, layers: ['invented-layer'] }), /Invalid layer/);
});

test('local favorites, recent history and timetable use atomic CRUD without changing unrelated storage', () => {
  const adapter = storage(); adapter.data.set('unrelated', 'keep'); const store = api.createLocalStore(adapter);
  assert.equal(store.addFavorite(ids[0]).ok, true); store.addFavorite(ids[0]); store.recordRecent(ids[0]); store.recordRecent(ids[1]);
  const entry = { id: 'lesson-1', entityId: ids[0], title: '개인 시간표', day: 1, start: '09:00', end: '10:00' };
  assert.equal(store.saveTimetable(entry).ok, true); assert.equal(store.saveTimetable({ ...entry, end: '08:00' }).ok, false);
  assert.deepEqual(plain(store.load().value.favorites), [ids[0]]); assert.deepEqual(plain(store.load().value.recent), [ids[1], ids[0]]);
  assert.equal(store.load().value.timetable.length, 1);
  store.removeTimetable(entry.id); store.removeFavorite(ids[0]); assert.equal(store.load().value.timetable.length, 0);
  assert.equal(store.reset().ok, true); assert.equal(adapter.data.get('unrelated'), 'keep'); assert.equal(adapter.data.has('hanshin-campus-platform:v1'), false);
});

test('local preference migration preserves known legacy identities and storage failures do not claim persistence', () => {
  const adapter = storage(); adapter.data.set('hanshin-campus-platform:v1', JSON.stringify({ version: 0, favorites: ['janggong'], recent: ['pilheon'], timetable: [] }));
  const store = api.createLocalStore(adapter); assert.equal(store.load().ok, true); assert.equal(store.load().value.favorites[0], ids[0]);
  const before = adapter.data.get('hanshin-campus-platform:v1'); adapter.setItem = () => { throw new Error('Quota exceeded'); };
  const failing = api.createLocalStore(adapter); assert.equal(failing.addFavorite(ids[1]).ok, false); assert.equal(adapter.data.get('hanshin-campus-platform:v1'), before);
  assert.equal(api.createLocalStore(null).load().ok, false);
  const corrupt = storage(); corrupt.data.set('hanshin-campus-platform:v1', '{broken'); const broken = api.createLocalStore(corrupt); assert.equal(broken.load().ok, false); assert.equal(broken.reset().ok, true);
});
