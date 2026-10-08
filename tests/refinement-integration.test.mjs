import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({ window: {} });
for (const path of ['src/data/campus-data.js', 'src/data/interior-data.js', 'src/domain/site-geometry.js', 'src/data/site-plan.js', 'src/domain/campus-platform.js']) vm.runInContext(readFileSync(path, 'utf8'), context, { filename: path });
const api = context.CampusPlatform, plain = (value) => JSON.parse(JSON.stringify(value));
const baseline = api.createCatalog(context.SitePlanData, context.window.CampusData), current = () => plain(baseline);
const manifest = JSON.parse(readFileSync('src/data/model-manifest.json', 'utf8'));

test('versioned shared views round-trip all release identities while old links remain valid', () => {
  const catalog = current(), state = { version: 1, campusId: 'hanshin-gg', entityId: 'hanshin-gg:building:janggong', floorId: null, time: null, view: 'top', layers: ['boundary', 'buildings'], contentVersion: catalog.contentVersion, assetsVersion: manifest.version, releaseId: 'published-fixture-1' };
  const query = api.serializeState(state);
  assert.deepEqual(plain(api.parseState(`https://campus.example/?${query}#panel`, catalog).state), state);
  const old = { ...state }; for (const key of ['contentVersion', 'assetsVersion', 'releaseId']) delete old[key];
  const oldQuery = api.serializeState(old), parsed = api.parseState(oldQuery, catalog);
  assert.equal(parsed.valid, true); assert.deepEqual(plain(parsed.state), old);
  for (const key of ['contentVersion', 'assetsVersion', 'releaseId']) assert.equal(oldQuery.includes(`${key}=`), false);
  assert.equal(api.parseState(`${query}&releaseId=duplicate`, catalog).valid, false);
  assert.equal(api.parseState(query.replace('published-fixture-1', '..%2Fprivate'), catalog).valid, false);
  assert.throws(() => api.serializeState({ ...state, assetsVersion: '' }));
});

test('public asset projection filters private geometry, private sources, campus mismatches and raw metadata', () => {
  const catalog = current();
  catalog.entities.find((item) => item.id === 'hanshin-gg:building:pilheon').visibility = 'restricted';
  catalog.sources.push({ ...catalog.sources[0], id: 'private-model-survey', title: 'PRIVATE_SOURCE_SENTINEL', visibility: 'restricted' });
  const placement = { ...manifest.models[0].variants[0].placement, secret: 'RAW_PLACEMENT_SENTINEL' }, publicEntry = { ...plain(manifest.models[0]), secret: 'RAW_MODEL_SENTINEL', provenance: { ...manifest.models[0].provenance, secret: 'RAW_PROVENANCE_SENTINEL' }, variants: manifest.models[0].variants.map((variant) => ({ ...variant, placement: variant.placement ? placement : undefined, rawIfc: 'RAW_GUID_SENTINEL' })) };
  catalog.assetManifest = { schemaVersion: 1, version: manifest.version, campusId: 'private-campus', raw: 'RAW_MANIFEST_SENTINEL', models: [
    { ...publicEntry, campusId: 'hanshin-gg' },
    { ...plain(manifest.models[1]), campusId: 'hanshin-gg' },
    { ...plain(manifest.models[2]), campusId: 'hanshin-gg', provenance: { ...manifest.models[2].provenance, sourceId: 'private-model-survey' } },
    { ...publicEntry, id: 'other-campus-model', buildingId: 'hanshin-gg:building:janggong', campusId: 'other-campus' }
  ] };
  const output = plain(api.publicCatalog(catalog));
  assert.deepEqual(output.assetManifest.models.map((entry) => entry.id), ['janggong']);
  assert.equal(output.assetManifest.campusId, undefined);
  assert.equal(output.entities.some((item) => item.id === 'hanshin-gg:building:pilheon' || item.owningBuildingId === 'hanshin-gg:building:pilheon'), false);
  for (const value of ['private-campus', 'PRIVATE_SOURCE_SENTINEL', 'RAW_MODEL_SENTINEL', 'RAW_GUID_SENTINEL', 'RAW_PROVENANCE_SENTINEL', 'RAW_PLACEMENT_SENTINEL', 'RAW_MANIFEST_SENTINEL']) assert.equal(JSON.stringify(output).includes(value), false);
  assert.equal(output.assetManifest.models[0].variants[0].source, publicEntry.variants[0].source);
  assert.equal(output.assetManifest.models[0].provenance.sourceId, publicEntry.provenance.sourceId);
  assert.deepEqual(plain(api.publicCatalog(output)), output);
});

test('WGS84 guide, legal, planning and cadastral boundaries preserve meter rings, holes and islands', () => {
  const catalog = current(), campus = catalog.campuses[0], lat = campus.origin.lat * Math.PI / 180, w = Math.sqrt(1 - 6.6943799901413165e-3 * Math.sin(lat) ** 2);
  const eastScale = 6378137 / w * Math.cos(lat), northScale = 6378137 * (1 - 6.6943799901413165e-3) / w ** 3;
  const coordinates = (value) => typeof value[0] === 'number' ? [campus.origin.lon + value[0] / eastScale * 180 / Math.PI, campus.origin.lat + value[1] / northScale * 180 / Math.PI] : value.map(coordinates);
  const ring = (x, y, size) => [[x, y], [x + size, y], [x + size, y + size], [x, y + size], [x, y]];
  const shapes = { guide: [[ring(0, 0, 100), [...ring(10, 10, 10)].reverse()], [ring(120, 20, 10)]], legal: [ring(-5, -5, 110)], planning: [[ring(-10, -10, 120)], [ring(130, 10, 20)]], cadastral: [ring(20, 20, 40)] };
  for (const kind of ['guide', 'legal', 'planning', 'cadastral']) campus.boundaries[kind] = { type: ['guide', 'planning'].includes(kind) ? 'MultiPolygon' : 'Polygon', coordinates: coordinates(shapes[kind]), coordinateSystem: 'WGS84', unit: 'degree', originId: campus.id, sourceIds: ['hanshin-official-tour'], confidence: kind === 'guide' ? 'estimated' : 'verified', boundaryType: kind, isLegalBoundary: kind === 'legal' };
  assert.equal(api.validateCatalog(catalog).valid, true, JSON.stringify(api.validateCatalog(catalog).errors));
  const output = plain(api.publicCatalog(catalog)), plan = output.campuses[0].visualizationPlan;
  for (const kind of ['guide', 'legal', 'planning', 'cadastral']) {
    const feature = plan.boundaries[kind === 'guide' ? 'campusMapped' : kind], parts = ['guide', 'planning'].includes(kind) ? shapes[kind] : [shapes[kind]];
    assert.equal(feature.boundaryType, kind); assert.equal(feature.isLegalBoundary, kind === 'legal'); assert.equal(feature.polygonsMeters.length, parts.length);
    for (let i = 0; i < parts.length; i++) {
      const rings = [feature.polygonsMeters[i].outer, ...feature.polygonsMeters[i].holes]; assert.equal(rings.length, parts[i].length);
      for (let j = 0; j < rings.length; j++) { assert.equal(rings[j].length, parts[i][j].length - 1); for (let p = 0; p < rings[j].length; p++) for (let axis = 0; axis < 2; axis++) assert.ok(Math.abs(rings[j][p][axis] - parts[i][j][p][axis]) < 0.000001, `${kind} ring ${i}/${j}/${p}/${axis}`); }
    }
  }
  assert.equal(plan.metadata.legalBoundaryVerified, true);
  assert.deepEqual(plain(api.publicCatalog(output)), output);
  campus.boundaries.legal.confidence = 'estimated'; assert.equal(api.validateCatalog(catalog).valid, false);
  assert.equal(baseline.campuses[0].boundaries.legal, null);
});
