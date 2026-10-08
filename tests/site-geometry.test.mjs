import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../src/domain/site-geometry.js', import.meta.url), 'utf8'), context);
const geometry = context.SiteGeometry;
const square = [[0, 0], [100, 0], [100, 100], [0, 100]];
const json = (value) => JSON.parse(JSON.stringify(value));

test('area uses metre coordinates, independent of ring direction, and subtracts courtyards', () => {
  assert.equal(geometry.polygonArea(square), 10000);
  assert.equal(geometry.polygonArea([...square].reverse()), 10000);
  assert.equal(geometry.polygonArea(square, [[[10, 10], [20, 10], [20, 20], [10, 20]]]), 9900);
  assert.throws(() => geometry.polygonArea([[0, 0], [1, Number.NaN], [2, 2]]), /finite/);
});
test('concave polygon includes boundary and correctly excludes its cut-out', () => {
  const polygon = [[0, 0], [10, 0], [10, 4], [4, 4], [4, 10], [0, 10]];
  assert.equal(geometry.pointInPolygon([2, 8], polygon), true);
  assert.equal(geometry.pointInPolygon([8, 8], polygon), false);
  assert.equal(geometry.pointInPolygon([4, 7], polygon), true);
  assert.equal(geometry.pointInPolygon([12, 0], polygon), false);
});
test('bounds report full footprint, with an explicit empty result', () => {
  assert.equal(geometry.bounds([]), null);
  assert.deepEqual(json(geometry.bounds([[-3, 8], [5, -2]])), { minX: -3, maxX: 5, minY: -2, maxY: 8, width: 8, depth: 10, center: [1, 3] });
});
test('WGS84 local projection has independent known meridian distances and round trips', () => {
  const origin = { lat: 0, lon: 0 };
  const east = geometry.projectWgs84({ lat: 0, lon: 0.001 }, origin);
  const north = geometry.projectWgs84({ lat: 0.001, lon: 0 }, origin);
  assert.ok(Math.abs(east[0] - 111.31949079327) < 1e-8);
  assert.ok(Math.abs(north[1] - 110.57427582159) < 1e-8);
  const campusOrigin = { lat: 37.1935378, lon: 127.0234698 };
  const location = { lat: 37.19411, lon: 127.0243 };
  const recovered = geometry.unprojectWgs84(geometry.projectWgs84(location, campusOrigin), campusOrigin);
  assert.ok(Math.abs(recovered.lat - location.lat) < 1e-10);
  assert.ok(Math.abs(recovered.lon - location.lon) < 1e-10);
  assert.throws(() => geometry.projectWgs84({ lat: 38, lon: 127.024 }, campusOrigin), /limited/);
});
test('100 metres always occupies ten world units regardless of bearing, north is negative z', () => {
  for (const point of [[100, 0], [0, 100], [60, 80]]) {
    const world = geometry.metersToWorld(point);
    assert.equal(Math.hypot(...world), 10);
    assert.deepEqual(json(geometry.worldToMeters(world)), point);
  }
  assert.deepEqual(json(geometry.metersToWorld([0, 100])), [0, -10]);
  assert.throws(() => geometry.metersToWorld([1, 2], 0), /positive/);
});
test('legacy affine inverse preserves old geometry, validation disallows reused fit anchors', () => {
  const transform = { x: [4, 3, 7], y: [-2, 5, 9] };
  const initial = [11, -4];
  const recovered = geometry.applyAffine(geometry.applyAffine(initial, transform), geometry.invertAffine(transform));
  assert.ok(geometry.distance(recovered, initial) < 1e-10);
  const validation = geometry.anchorResiduals([{ id: 'held-out', source: [0, 0], target: [10, 13] }], transform, ['fit']);
  assert.equal(validation.rmsMeters, 5);
  assert.equal(validation.independent, true);
  assert.throws(() => geometry.anchorResiduals([{ id: 'fit', source: [0, 0], target: [7, 9] }], transform, ['fit']), /independent/);
});
test('affine calibration validates a held-out point and rejects collinear anchors', () => {
  const anchors = [{ id: 'a', source: [0, 0], target: [2, 3] }, { id: 'b', source: [1, 0], target: [12, 5] }, { id: 'c', source: [0, 1], target: [5, 23] }];
  const transform = geometry.fitAffine(anchors);
  const heldOut = geometry.anchorResiduals([{ id: 'd', source: [2, 4], target: [34, 87] }], transform, anchors.map((anchor) => anchor.id));
  assert.ok(heldOut.maxMeters < 1e-9);
  assert.throws(() => geometry.fitAffine([{ id: 'a', source: [0, 0], target: [0, 0] }, { id: 'b', source: [1, 0], target: [1, 0] }, { id: 'c', source: [2, 0], target: [2, 0] }]), /collinear/);
});
test('hull includes all source points but does not claim a surveyed parcel', () => {
  const points = [...square, [50, 50], [20, 30], [0, 0]];
  const hull = geometry.convexHull(points);
  assert.equal(hull.length, 4);
  assert.equal(geometry.polygonArea(hull), 10000);
  for (const point of points) assert.equal(geometry.pointInPolygon(point, hull), true);
});
test('edge clipping preserves crossings when both original vertices are outside', () => {
  const segments = geometry.routeSegments([{ id: 'through', pointsMeters: [[-10, 50], [110, 50]] }], square);
  assert.equal(segments.length, 1);
  assert.ok(geometry.distance(segments[0].pointsMeters[0], [0, 50]) < 1e-7);
  assert.ok(geometry.distance(segments[0].pointsMeters[1], [100, 50]) < 1e-7);
  assert.ok(Math.abs(segments[0].lengthMeters - 100) < 1e-7);
});
test('clipping concave site does not invent a road across an excluded gap', () => {
  const polygon = [[0, 0], [10, 0], [10, 10], [7, 10], [7, 3], [3, 3], [3, 10], [0, 10]];
  const pieces = geometry.clipSegmentToPolygon([-1, 8], [11, 8], polygon);
  assert.equal(pieces.length, 2);
  assert.ok(Math.abs(pieces[0][1][0] - 3) < 1e-7);
  assert.ok(Math.abs(pieces[1][0][0] - 7) < 1e-7);
});
test('clipped edges retain inside shared OSM node IDs so intersections remain connected', () => {
  const clipped = geometry.routeSegments([
    { id: 'through', nodeIds: [1, 2, 3], pointsMeters: [[-10, 50], [50, 50], [110, 50]] },
    { id: 'branch', nodeIds: [2, 4], pointsMeters: [[50, 50], [50, 90]] }
  ], square);
  const graph = geometry.buildRouteGraph(clipped);
  assert.equal(geometry.shortestRoute(graph, 'osm-node-2', 'osm-node-4').lengthMeters, 40);
  assert.equal(graph.has('osm-node-1'), false);
  assert.equal(graph.has('osm-node-3'), false);
});
test('shared OSM node junctions connect, crossing grades with different IDs remain disconnected', () => {
  const graph = geometry.buildRouteGraph([
    { id: 'main', nodeIds: [1, 2, 3], pointsMeters: [[0, 0], [10, 0], [20, 0]] },
    { id: 'branch', nodeIds: [2, 4], pointsMeters: [[10, 0], [10, 10]] },
    { id: 'bridge', nodeIds: [20, 21], pointsMeters: [[10, 0], [10, -10]] }
  ]);
  assert.equal(geometry.shortestRoute(graph, 'osm-node-1', 'osm-node-4').lengthMeters, 20);
  assert.equal(geometry.shortestRoute(graph, 'osm-node-1', 'osm-node-21'), null);
});
test('steps exclusion produces a longer valid path without claiming accessible verification', () => {
  const graph = geometry.buildRouteGraph([
    { id: 'stairs', nodeIds: [1, 2], pointsMeters: [[0, 0], [10, 0]], tags: { highway: 'steps' } },
    { id: 'ramp', nodeIds: [1, 3, 2], pointsMeters: [[0, 0], [5, 5], [10, 0]], tags: { highway: 'footway' } }
  ]);
  const route = geometry.shortestRoute(graph, 'osm-node-1', 'osm-node-2', { avoidSteps: true });
  assert.ok(route.lengthMeters > 10);
  assert.deepEqual(json(route.wayIds), ['ramp', 'ramp']);
  assert.equal(route.accessibility, 'steps-excluded-other-accessibility-unverified');
});

vm.runInContext(readFileSync(new URL('../src/data/site-plan.js', import.meta.url), 'utf8'), context);
const plan = context.SitePlanData;
const markerSource = JSON.parse(readFileSync(new URL('../evidence/official-campus-markers.json', import.meta.url), 'utf8'));
test('all 15 official source markers retain their geographic positions and 16 existing models remain addressable', () => {
  assert.equal(plan.features.buildings.length, 16);
  assert.equal(new Set(plan.features.buildings.map((building) => building.id)).size, 16);
  for (const building of plan.features.buildings.filter((feature) => feature.markerSourceId === 'hanshin-official-tour')) {
    const marker = markerSource.markers.find((candidate) => candidate.name.replace(/^\d+\s*/, '') === building.name);
    assert.ok(marker, `official marker for ${building.name}`);
    const recovered = geometry.unprojectWgs84(building.anchorMeters, plan.projection.origin);
    assert.ok(Math.abs(recovered.lat - marker.lat) < 1e-10);
    assert.ok(Math.abs(recovered.lon - marker.lon) < 1e-10);
  }
});
test('guide envelope includes every represented building and digitized physical facility without claiming a legal boundary', () => {
  const guide = plan.boundaries.campusMapped;
  assert.equal(guide.isLegalBoundary, false);
  assert.equal(plan.boundaries.legal, null);
  assert.equal(plan.boundaries.cadastral, null);
  assert.equal(guide.confidence, 'estimated');
  for (const feature of [...plan.features.buildings, ...plan.features.parking, ...plan.features.sports, ...plan.features.water.filter((feature) => feature.geometryType === 'polygon')]) {
    for (const point of feature.pointsMeters) assert.equal(geometry.pointInPolygon(point, guide.pointsMeters), true, `${feature.id} is inside visual guide`);
  }
});
test('facility polygons cite inspected official illustration and remain estimates rather than measured extents', () => {
  assert.equal(plan.features.sports.length, 3);
  assert.equal(plan.features.parking.length, 3);
  for (const facility of [...plan.features.sports, ...plan.features.parking]) {
    assert.equal(facility.geometryType, 'polygon');
    assert.equal(facility.sourceId, 'hanshin-2026-guide-illustration');
    assert.equal(facility.status, 'illustration-derived-estimated');
    assert.equal(facility.confidence, 'estimated');
    assert.ok(geometry.polygonArea(facility.pointsMeters) > 0);
  }
});
test('registration validation uses held-out anchors and explicitly reports unavailable operational evidence', () => {
  const check = plan.verification.calibration;
  assert.ok(check.validationIds.every((id) => !check.trainingIds.includes(id)));
  assert.equal(check.validationIds.length, 11);
  assert.ok(check.rmsMeters > 0);
  assert.equal(plan.verification.latestOsm, 'unavailable');
  assert.equal(plan.verification.aerialImagery, 'unverified');
  assert.equal(plan.verification.surveyedFootprints, 'unverified');
  assert.ok(plan.evidence.unknown.length > 0);
});

async function withExtractedCheckout(callback) {
  const temporaryRoot = await mkdtemp(path.join(tmpdir(), 'hanshin-site-data-'));
  const resolved = path.resolve(temporaryRoot);
  if (!resolved.startsWith(path.resolve(tmpdir()) + path.sep) || !path.basename(resolved).startsWith('hanshin-site-data-')) throw new Error('Refusing cleanup outside the isolated test directory.');
  try {
    for (const name of ['scripts/build-site-plan.mjs', 'src/domain/site-geometry.js', 'src/data/campus-data.js', 'evidence/official-campus-markers.json', 'evidence/campus-map-digitization.json', 'evidence/source-manifest.json']) {
      const target = path.join(temporaryRoot, name);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, await readFile(new URL(`../${name}`, import.meta.url)));
    }
    return await callback(temporaryRoot);
  } finally {
    await rm(resolved, { recursive: true });
  }
}
test('fresh checkout regenerates exactly from committed extraction without HTML, PDF, PNG or network collection', async () => {
  await withExtractedCheckout(async (temporaryRoot) => {
    const markersBefore = await readFile(path.join(temporaryRoot, 'evidence/official-campus-markers.json'), 'utf8');
    const manifestBefore = await readFile(path.join(temporaryRoot, 'evidence/source-manifest.json'), 'utf8');
    execFileSync(process.execPath, [path.join(temporaryRoot, 'scripts/build-site-plan.mjs')], { cwd: temporaryRoot, timeout: 15000, stdio: 'pipe' });
    assert.equal(await readFile(path.join(temporaryRoot, 'src/data/site-plan.js'), 'utf8'), readFileSync(new URL('../src/data/site-plan.js', import.meta.url), 'utf8'));
    assert.equal(await readFile(path.join(temporaryRoot, 'evidence/official-campus-markers.json'), 'utf8'), markersBefore);
    assert.equal(await readFile(path.join(temporaryRoot, 'evidence/source-manifest.json'), 'utf8'), manifestBefore);
    const verification = JSON.parse(await readFile(path.join(temporaryRoot, 'evidence/spatial-verification.json'), 'utf8'));
    assert.equal(verification.latestOsm, 'unavailable');
    assert.equal(verification.legalBoundary, 'unverified');
  });
});
test('regeneration refuses missing provenance rather than inventing a successful source collection', async () => {
  await withExtractedCheckout(async (temporaryRoot) => {
    const markerPath = path.join(temporaryRoot, 'evidence/official-campus-markers.json');
    const document = JSON.parse(await readFile(markerPath, 'utf8'));
    delete document.sourceHtmlSha256;
    await writeFile(markerPath, JSON.stringify(document));
    assert.throws(() => execFileSync(process.execPath, [path.join(temporaryRoot, 'scripts/build-site-plan.mjs')], { cwd: temporaryRoot, timeout: 15000, stdio: 'pipe' }), /Command failed/);
  });
});
