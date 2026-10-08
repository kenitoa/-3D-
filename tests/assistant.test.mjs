import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { build } from 'esbuild';

async function compile(path) { const result = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'esm', write: false }); return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`); }
const { answerApprovedQuestion } = await compile('server/assistant.ts'), { fetchProvider, publicNetworkAddress } = await compile('server/providers.ts');
const context = vm.createContext({ window: {} });
for (const name of ['src/data/campus-data.js', 'src/data/interior-data.js', 'src/data/site-plan.js', 'src/domain/campus-platform.js']) vm.runInContext(readFileSync(name, 'utf8'), context);
const original = JSON.parse(JSON.stringify(context.CampusPlatform.publicCatalog(context.CampusPlatform.createCatalog(context.SitePlanData, context.window.CampusData))));
const provider = { id: 'approved-assistant', url: 'https://approved.example.invalid/rank', sourceId: 'hanshin-official-tour', campusId: 'hanshin-gg', kind: 'assistant', enabled: true, secretEnv: null };
function fixture() {
  const catalog = JSON.parse(JSON.stringify(original)), building = catalog.entities.find((entity) => entity.kind === 'building');
  building.name = 'Alpha Building'; building.displayTitle = 'Alpha Building'; building.aliases = ['alpha']; building.purpose = 'education'; building.category = 'teaching'; building.claims.name.confidence = 'verified'; building.claims.name.sourceIds = [provider.sourceId];
  catalog.sources.find((source) => source.id === provider.sourceId).confidence = 'verified';
  return { request: { catalog, question: 'Where is alpha?', campusId: catalog.activeCampusId, contentVersion: catalog.contentVersion }, building };
}
test('unconfigured assistant uses current authored catalog search without inventing an answer', async () => {
  const { request, building } = fixture(), result = await answerApprovedQuestion(request, [], () => { throw new Error('No provider must run.'); });
  assert.equal(result.mode, 'catalog'); assert.equal(result.contentVersion, request.contentVersion); assert.equal(result.entities[0].id, building.id); assert.equal(result.entities[0].name, 'Alpha Building');
  request.question = 'A location that is absent'; assert.deepEqual((await answerApprovedQuestion(request, [])).entities, []);
});
test('registered Korean names survive question particles and name verification does not promote overall accuracy', async () => {
  const { request, building } = fixture(); building.name = '장공관'; building.displayTitle = '장공관'; building.aliases = ['장공관']; building.confidence = 'estimated'; request.question = '장공관이어디야?';
  const result = await answerApprovedQuestion(request, [], async () => { throw new Error('Unconfigured'); });
  assert.equal(result.entities[0].id, building.id); assert.equal(result.entities[0].confirmation, 'estimated'); assert.equal(result.entities[0].nameConfirmation, 'verified');
});
test('unverified entity names never reach the external ranking provider', async () => {
  const { request, building } = fixture(); building.claims.name.confidence = 'estimated'; let called = false;
  const result = await answerApprovedQuestion(request, [provider], async () => { called = true; throw new Error('Must not run'); });
  assert.equal(called, false); assert.equal(result.mode, 'catalog'); assert.equal(result.entities[0].nameConfirmation, 'estimated');
});
test('provider ranks approved IDs while names and explanations always come from the current catalog', async () => {
  const { request, building } = fixture(); let observed;
  const result = await answerApprovedQuestion(request, [provider], async (selected, payload) => { observed = payload; assert.equal(selected.id, provider.id); return { contentVersion: request.contentVersion, entityIds: [building.id], sourceIds: [provider.sourceId], text: 'Fabricated opening hours and invented building', entities: [{ id: building.id, name: 'Provider invented name' }] }; });
  assert.equal(result.mode, 'provider'); assert.equal(result.entities[0].name, building.name); assert.equal(JSON.stringify(result).includes('Fabricated'), false); assert.equal(JSON.stringify(result).includes('Provider invented'), false);
  assert.ok(observed.candidates.every((entity) => typeof entity.id === 'string')); assert.equal(observed.contentVersion, request.contentVersion);
  for (const forbidden of ['position', 'geometry', 'interior', 'operations', 'timetable', 'gps', 'latitude', 'longitude']) assert.equal(JSON.stringify(observed).includes(`"${forbidden}"`), false);
});
test('assistant excludes private ancestors, other campuses and historic records from results and payloads', async () => {
  const { request, building } = fixture(), clone = (id, patch) => ({ ...JSON.parse(JSON.stringify(building)), id, ...patch });
  const restricted = clone('hanshin-gg:building:private', { visibility: 'restricted', name: 'Alpha Private' });
  request.catalog.entities.push(restricted, clone('hanshin-gg:space:hidden-child', { kind: 'space', visibility: 'public', parentId: restricted.id, name: 'Alpha Child' }), clone('other:building:one', { campusId: 'other', name: 'Alpha Other' }), clone('hanshin-gg:building:old', { status: 'historic', name: 'Alpha Historic' }), clone('hanshin-gg:building:sensitive', { sensitive: true, name: 'Alpha Sensitive' }));
  const result = await answerApprovedQuestion(request, [provider], async (_selected, payload) => { assert.deepEqual(payload.candidates.map((entity) => entity.id), [building.id]); return { contentVersion: request.contentVersion, entityIds: [building.id], sourceIds: [provider.sourceId] }; });
  assert.deepEqual(result.entities.map((entity) => entity.id), [building.id]);
});
test('stale, unapproved or mismatched provider output falls back to the registered catalog', async () => {
  const { request, building } = fixture();
  for (const patch of [{ contentVersion: 'old' }, { entityIds: ['not-approved'] }, { sourceIds: ['private-source'] }, { entityIds: [building.id, building.id] }, { entityIds: [] }, { sourceIds: [] }, { sourceIds: [provider.sourceId, provider.sourceId] }]) {
    const result = await answerApprovedQuestion(request, [provider], async () => ({ contentVersion: request.contentVersion, entityIds: [building.id], sourceIds: [provider.sourceId], ...patch })); assert.equal(result.mode, 'catalog'); assert.equal(result.entities[0].id, building.id);
  }
  assert.equal((await answerApprovedQuestion(request, [provider], async () => { throw new Error('Provider timeout'); })).mode, 'catalog');
});
test('only enabled matching-campus providers with a verified public source may receive questions', async () => {
  const { request } = fixture();
  for (const patch of [{ enabled: false }, { campusId: 'other' }, { kind: 'catalog' }, { sourceId: 'nonexistent' }]) await answerApprovedQuestion(request, [{ ...provider, ...patch }], () => { throw new Error('An ineligible provider must never be called.'); });
  request.catalog.sources.find((source) => source.id === provider.sourceId).visibility = 'restricted';
  const result = await answerApprovedQuestion(request, [provider], () => { throw new Error('A private source must never be used.'); }); assert.equal(result.mode, 'catalog');
});
test('assistant rejects mismatched versions, absent campuses and oversized or empty questions', async () => {
  const { request } = fixture();
  for (const patch of [{ question: ' ' }, { question: 'a'.repeat(501) }, { question: 'a\u0000b' }, { campusId: 'absent' }, { contentVersion: 'different' }, { purpose: 'a'.repeat(121) }]) await assert.rejects(answerApprovedQuestion({ ...request, ...patch }, []), /ASSISTANT_REQUEST_REJECTED/);
});
function networkFixture({ status = [200], response = '{}', contentType = 'application/json', addresses = [{ address: '1.1.1.1', family: 4 }], streaming = false, timeoutMs = 1000 } = {}) {
  const calls = [];
  const network = { timeoutMs, async lookup() { return addresses; }, request(url, options, callback) {
    const request = new EventEmitter(); let interval;
    request.destroy = (error) => { if (interval) globalThis.clearInterval(interval); if (error) request.emit('error', error); };
    request.end = (body) => { calls.push({ url, options, body }); const incoming = new EventEmitter(); incoming.statusCode = status[Math.min(calls.length - 1, status.length - 1)]; incoming.headers = { 'content-type': contentType }; incoming.destroy = () => { if (interval) globalThis.clearInterval(interval); }; callback(incoming); if (streaming) { interval = globalThis.setInterval(() => incoming.emit('data', Buffer.from(' ')), 5); } else if (incoming.statusCode >= 200 && incoming.statusCode < 300 && contentType.startsWith('application/json')) { incoming.emit('data', Buffer.from(response)); incoming.emit('end'); } };
    return request;
  } };
  return { calls, network };
}
test('provider POST sends bounded JSON once and pins its approved DNS address', async () => {
  const f = networkFixture({ response: '{"entityIds":[]}' }), payload = { contentVersion: 'version-1', question: 'alpha' };
  assert.deepEqual(await fetchProvider(provider, payload, f.network), { entityIds: [] }); assert.equal(f.calls.length, 1);
  const call = f.calls[0]; assert.equal(call.options.method, 'POST'); assert.equal(call.body, JSON.stringify(payload)); assert.equal(call.options.headers['Content-Length'], Buffer.byteLength(call.body));
  let pinned; call.options.lookup('untrusted-rebinding-name', {}, (_error, address, family) => { pinned = [address, family]; }); assert.deepEqual(pinned, ['1.1.1.1', 4]);
  const fail = networkFixture({ status: [503, 200] }); await assert.rejects(fetchProvider(provider, payload, fail.network), /PROVIDER_TEMPORARY_FAILURE/); assert.equal(fail.calls.length, 1);
});
test('GET providers retry only a bounded temporary failure and reject redirects, large bodies and invalid formats', async () => {
  const get = { ...provider, kind: 'catalog' }, retry = networkFixture({ status: [503, 200], response: '{"ok":true}' }); assert.deepEqual(await fetchProvider(get, undefined, retry.network), { ok: true }); assert.equal(retry.calls.length, 2); assert.equal(retry.calls[0].options.method, 'GET');
  for (const options of [{ status: [302] }, { contentType: 'text/html' }, { response: 'invalid-json' }, { response: 'a'.repeat(2 * 1024 * 1024 + 1) }]) { const f = networkFixture(options); await assert.rejects(fetchProvider(get, undefined, f.network)); assert.equal(f.calls.length, 1); }
});
test('provider boundary rejects private DNS aliases, payload overrun and unsafe direct provider configuration', async () => {
  const f = networkFixture({ addresses: [{ address: '1.1.1.1', family: 4 }, { address: '127.0.0.1', family: 4 }] }); await assert.rejects(fetchProvider(provider, {}, f.network), /PROVIDER_NETWORK_REJECTED/); assert.equal(f.calls.length, 0);
  await assert.rejects(fetchProvider(provider, { question: 'a'.repeat(32769) }, networkFixture().network), /PROVIDER_PAYLOAD_TOO_LARGE/);
  await assert.rejects(fetchProvider({ ...provider, url: 'http://127.0.0.1/' }, {}, networkFixture().network), /HTTPS/);
  await assert.rejects(fetchProvider(provider, undefined, networkFixture().network), /PROVIDER_PAYLOAD_REQUIRED/);
  for (const address of ['0:0:0:0:0:ffff:127.0.0.1', '0000:0000:0000:0000:0000:0000:0000:0001', '2001:0000::1', '2001:0010::1', '2001:0020::1', '4000::1']) assert.equal(publicNetworkAddress(address), false, address);
});
test('an absolute deadline bounds both DNS delay and an endlessly active response stream', async () => {
  const delayed = networkFixture({ timeoutMs: 20 }); delayed.network.lookup = () => new Promise(() => {}); await assert.rejects(fetchProvider(provider, {}, delayed.network), /PROVIDER_TIMEOUT/); assert.equal(delayed.calls.length, 0);
  const streaming = networkFixture({ streaming: true, timeoutMs: 25 }); await assert.rejects(fetchProvider(provider, {}, streaming.network), /PROVIDER_TIMEOUT/); assert.equal(streaming.calls.length, 1);
});
