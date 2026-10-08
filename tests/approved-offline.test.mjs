import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import { TextEncoder } from "node:util";

const code = readFileSync(new URL("../service-worker.js", import.meta.url), "utf8"), scope = "https://campus.test/app/", pointer = new URL("__offline_current__", scope).href, control = "hanshin-offline-control-v1", prefix = "hanshin-public-v1-";
const { Response, Request, Headers } = globalThis;
const digest = (body) => createHash("sha256").update(body).digest("hex"), clone = (value) => JSON.parse(JSON.stringify(value)), key = (value) => typeof value === "string" ? value : value.url || value.href;
function fixture(version = "release-1") {
  const bodies = new Map([["index.html", "approved static entry " + version], ["src/models/one.js", "window.OneModel={};"], ["src/models/two.js", "window.TwoModel={};"]]);
  const assets = [...bodies].map(([originalPath, body]) => ({ path: `assets/releases/${digest(body)}.${originalPath.split(".").at(-1)}`, originalPath, bytes: Buffer.byteLength(body), sha256: digest(body), detail: originalPath.startsWith("src/models/") }));
  const manifest = { schemaVersion: 1, version: "model-1", campusId: "campus", models: assets.filter((asset) => asset.detail).map((asset, index) => ({ id: index ? "two" : "one", kind: "legacy", source: asset.path, bytes: asset.bytes, sha256: asset.sha256 })) };
  const catalog = { schemaVersion: 1, contentVersion: version, datasetVersion: version, assetsVersion: "model-1", campuses: [{ id: "campus" }], sources: [{ id: "public-source", visibility: "public" }], entities: [{ id: "campus:building:one", campusId: "campus", kind: "building", legacyKey: "one", visibility: "public", sensitive: false, parentId: null }, { id: "campus:floor:one", campusId: "campus", kind: "floor", owningBuildingId: "campus:building:one", parentId: "campus:building:one", visibility: "public", sensitive: false }, { id: "campus:building:two", campusId: "campus", kind: "building", legacyKey: "two", visibility: "public", sensitive: false, parentId: null }], assetManifest: manifest };
  const bundle = { schemaVersion: 1, releaseId: version, contentVersion: version, assetsVersion: "model-1", createdAt: "2026-10-07T00:00:00Z", catalog, catalogHash: digest(JSON.stringify(catalog)), manifest, assets };
  return { bundle, bodies };
}
function worker() {
  const handlers = new Map(), stores = new Map(), replies = [], log = [], responses = new Map(); let online = true, hook = null;
  const caches = { async open(name) { if (!stores.has(name)) stores.set(name, new Map()); const entries = stores.get(name); return { async match(value) { return entries.get(key(value))?.clone(); }, async put(value, response) { if (hook) await hook(name, key(value), response); entries.set(key(value), response.clone()); log.push({ type: "put", name, url: key(value) }); } }; }, async keys() { return [...stores.keys()]; }, async delete(name) { log.push({ type: "delete", name }); return stores.delete(name); } };
  const self = { registration: { scope }, clients: { claim() {} }, skipWaiting() {}, addEventListener(type, handler) { handlers.set(type, handler); } };
  async function fetch(value, options) { const url = key(value); log.push({ type: "fetch", url, options }); if (!online) throw new Error("Offline"); const result = responses.get(url); return typeof result === "function" ? result() : result ? result.clone() : new Response("Not found", { status: 404 }); }
  vm.runInNewContext(code, { self, caches, fetch, URL, Response, Headers, Error, crypto: webcrypto, TextEncoder }, { filename: "service-worker.js" });
  async function message(action, options = {}) { const promises = []; let reply; handlers.get("message")({ data: { action, options }, ports: [{ postMessage(value) { reply = clone(value); replies.push(reply); } }], waitUntil(value) { promises.push(value); } }); await Promise.all(promises); return reply; }
  async function request(path, method = "GET") { let response; handlers.get("fetch")({ request: new Request(new URL(path, scope), { method }), respondWith(value) { response = value; } }); return response ? await response : undefined; }
  async function current() { return stores.get(control)?.get(pointer)?.clone().json(); }
  function publish(data) { const url = new URL("api/v1/bundle", scope); url.searchParams.set("release", data.bundle.releaseId); responses.set(url.href, Response.json({ data: data.bundle, error: null })); for (const asset of data.bundle.assets) responses.set(new URL(asset.path, scope).href, new Response(data.bodies.get(asset.originalPath))); }
  return { message, request, current, stores, responses, publish, log, setOnline(value) { online = value; }, onPut(value) { hook = value; } };
}

test("approved offline scopes estimate before downloading and retain only selected public model details", async () => {
  const app = worker(), data = fixture(); app.publish(data); const options = { bundle: data.bundle, scope: "selected", selectedId: "campus:floor:one" };
  const estimate = await app.message("INSPECT_BUNDLE", options); assert.equal(estimate.assets, 2); assert.equal(estimate.selectedId, "campus:building:one"); assert.equal(await app.current(), undefined); assert.equal(app.log.filter((entry) => entry.type === "put").length, 0);
  const result = await app.message("DOWNLOAD_BUNDLE", options); assert.equal(result.saved, true); assert.equal(result.releaseId, data.bundle.releaseId); assert.equal(result.scope, "selected"); assert.equal(result.assetsVersion, "model-1"); assert.equal(result.bytes, estimate.bytes);
  app.setOnline(false); assert.equal(await (await app.request("index.html")).text(), data.bodies.get("index.html")); assert.equal(await (await app.request("src/models/one.js")).text(), data.bodies.get("src/models/one.js")); assert.equal((await app.request("src/models/two.js")).status, 503); assert.equal(await (await app.request(data.bundle.assets[1].path)).text(), data.bodies.get("src/models/one.js")); const saved = await app.message("READ_CATALOG"); assert.deepEqual(saved.catalog, data.bundle.catalog); assert.equal(saved.releaseId, data.bundle.releaseId); assert.equal(saved.scope, "selected");
  assert.ok(app.log.filter((entry) => entry.type === "fetch").every((entry) => entry.options.credentials === "omit")); assert.ok([...app.stores.values()].every((entries) => [...entries.keys()].every((url) => !url.includes("/api/") && !url.includes("admin"))));
});

test("basic and all scopes use the same versioned catalog while missing details stay explicit", async () => {
  for (const selectedScope of ["basic", "all"]) { const app = worker(), data = fixture(); app.publish(data); const result = await app.message("DOWNLOAD_BUNDLE", { bundle: data.bundle, scope: selectedScope }); assert.equal(result.saved, true); const saved = await app.current(); assert.equal(app.stores.get(saved.cacheName).size, selectedScope === "basic" ? 2 : 4); app.setOnline(false); assert.equal((await app.request("src/models/one.js")).status, selectedScope === "basic" ? 503 : 200); assert.equal((await app.message("READ_CATALOG")).version, data.bundle.contentVersion); }
});

test("selected saves still fetch uncached approved assets online without enlarging the stored scope", async () => {
  const app=worker(),data=fixture();app.publish(data);
  await app.message('DOWNLOAD_BUNDLE',{bundle:data.bundle,scope:'selected',selectedId:'campus:building:one'});
  const saved=await app.current(),cache=app.stores.get(saved.cacheName),count=cache.size;
  app.responses.set(new URL('src/models/two.js',scope).href,new Response('changed-original-path'));
  const response=await app.request('src/models/two.js');
  assert.equal(response.status,200);assert.equal(await response.text(),data.bodies.get('src/models/two.js'));
  assert.equal(cache.size,count);assert.deepEqual((await app.message('READ_CATALOG')).availableModelIds,['one']);
  app.setOnline(false);assert.equal((await app.request('src/models/two.js')).status,503);
  assert.equal(cache.size,count);
});

test("readable snapshot identifies only stored model families and media while retaining the complete approved manifest", async () => {
  const data = fixture();
  for (const [name, owner] of [["one", "campus:floor:one"], ["two", "campus:building:two"]]) {
    const body = `licensed-${name}-photo`, originalPath = `assets/media/${name}.png`, asset = { path: `assets/releases/${digest(body)}.png`, originalPath, bytes: Buffer.byteLength(body), sha256: digest(body), detail: true };
    data.bodies.set(originalPath, body); data.bundle.assets.push(asset); (data.bundle.mediaRecords ||= []).push({ kind: "image", path: asset.path, entityId: owner, sourceId: "public-source", license: "school-approved", public: true });
  }
  for (const selectedScope of ["basic", "selected", "all"]) {
    const app = worker(); app.publish(data); assert.equal((await app.message("DOWNLOAD_BUNDLE", { bundle: data.bundle, scope: selectedScope, selectedId: "campus:floor:one" })).saved, true); app.setOnline(false); const saved = await app.message("READ_CATALOG");
    assert.deepEqual(saved.manifest, data.bundle.manifest); assert.deepEqual(saved.catalog, data.bundle.catalog); assert.deepEqual(saved.availableModelIds, selectedScope === "basic" ? [] : selectedScope === "selected" ? ["one"] : ["one", "two"]); assert.equal(saved.selectedId, selectedScope === "selected" ? "campus:building:one" : null);
    assert.deepEqual(saved.mediaRecords.map(item => item.entityId), selectedScope === "basic" ? [] : selectedScope === "selected" ? ["campus:floor:one"] : ["campus:floor:one", "campus:building:two"]);
    for (const media of saved.mediaRecords) assert.equal((await app.request(media.path)).ok, true);
  }
});

test("catalog SHA, restricted descendants, private assets and model mismatch reject before cache mutation", async () => {
  for (const failure of ["catalog-sha", "private-descendant", "private-asset", "model-mismatch", "request-version"]) {
    const app = worker(), data = fixture(); let options = { bundle: data.bundle, scope: "all" };
    if (failure === "catalog-sha") data.bundle.catalogHash = "0".repeat(64);
    if (failure === "private-descendant") { data.bundle.catalog.entities[1].visibility = "restricted"; data.bundle.catalogHash = digest(JSON.stringify(data.bundle.catalog)); }
    if (failure === "private-asset") data.bundle.assets[0].originalPath = "src/ui/refinement-scene-preview.js";
    if (failure === "model-mismatch") data.bundle.manifest.models[0].sha256 = "0".repeat(64);
    if (failure === "request-version") options = { ...options, bundle: { ...data.bundle, contentVersion: "other" } };
    app.publish(data); const result = await app.message("DOWNLOAD_BUNDLE", options); assert.ok(result.error, failure); assert.equal(await app.current(), undefined); assert.equal([...app.stores.keys()].filter((name) => name.startsWith(prefix)).length, 0);
  }
});

test("failed asset download and pointer writes leave the complete prior public release readable", async () => {
  for (const failure of ["asset-sha", "asset-network", "pointer"]) { const app = worker(), old = fixture(); app.publish(old); await app.message("DOWNLOAD_BUNDLE", { bundle: old.bundle, scope: "all" }); const oldSaved = await app.current(), next = fixture("release-2"); app.publish(next);
    if (failure === "asset-sha") app.responses.set(new URL(next.bundle.assets[0].path, scope).href, new Response("Wrong version"));
    if (failure === "asset-network") app.responses.set(new URL(next.bundle.assets[1].path, scope).href, () => { throw new Error("Network failed"); });
    if (failure === "pointer") app.onPut(async (name) => { if (name === control) throw new Error("Pointer write failed"); });
    assert.ok((await app.message("DOWNLOAD_BUNDLE", { bundle: next.bundle, scope: "all" })).error, failure); assert.deepEqual(await app.current(), oldSaved); app.setOnline(false); assert.equal(await (await app.request("index.html")).text(), old.bodies.get("index.html")); assert.equal((await app.message("READ_CATALOG")).version, "release-1"); assert.deepEqual([...app.stores.keys()].filter((name) => name.startsWith(prefix)), [oldSaved.cacheName]);
  }
});

test("approved bundles never intercept APIs, private preview, admin or another origin", async () => {
  const app = worker(), data = fixture(); app.publish(data); await app.message("DOWNLOAD_BUNDLE", { bundle: data.bundle, scope: "all" }); app.setOnline(false);
  for (const path of ["api/v1/catalog", "api/v1/bundle?release=release-1", "api/v1/admin/status", "admin.html", "src/ui/admin.js", "https://outside.test/app/index.html"]) assert.equal(await app.request(path), undefined, path); assert.equal(await app.request("index.html", "POST"), undefined);
  assert.equal((await app.message("CLEAR")).saved, false); assert.equal(await app.message("READ_CATALOG"), null);
});

test("approved public entry alias has the self-only app policy while raw immutable HTML stays non-executable", async () => {
  const app = worker(), data = fixture(); app.publish(data); const immutableEntry = new URL(data.bundle.assets[0].path, scope).href;
  app.responses.set(immutableEntry, new Response(data.bodies.get("index.html"), { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'", "X-Content-Type-Options": "nosniff", "Content-Disposition": "attachment" } }));
  assert.equal((await app.message("DOWNLOAD_BUNDLE", { bundle: data.bundle, scope: "basic" })).saved, true); app.setOnline(false);
  for (const alias of ["index.html", ""]) { const entry = await app.request(alias), policy = entry.headers.get("Content-Security-Policy"); assert.match(policy, /script-src 'self'/); assert.match(policy, /connect-src 'self'/); assert.match(policy, /object-src 'none'/); assert.doesNotMatch(policy, /script-src[^;]*unsafe/); assert.equal(entry.headers.get("Content-Disposition"), null); assert.equal(entry.headers.get("X-Content-Type-Options"), "nosniff"); assert.equal(await entry.text(), data.bodies.get("index.html")); }
  const raw = await app.request(data.bundle.assets[0].path); assert.equal(raw.headers.get("Content-Security-Policy"), "default-src 'none'; frame-ancestors 'none'"); assert.equal(raw.headers.get("Content-Disposition"), "attachment");
});

test("identical immutable bodies can have multiple original aliases without duplicate storage or costs", async () => {
  const app = worker(), data = fixture(); data.bodies.set("src/data/copy.js", data.bodies.get("index.html")); const original = data.bundle.assets[0]; data.bundle.assets.push({ ...original, originalPath: "src/data/copy.js" }); app.publish(data);
  const estimate = await app.message("INSPECT_BUNDLE", { bundle: data.bundle, scope: "basic" }); assert.equal(estimate.assets, 1); assert.equal(estimate.bytes, original.bytes); assert.equal((await app.message("DOWNLOAD_BUNDLE", { bundle: data.bundle, scope: "basic" })).saved, true); app.setOnline(false); assert.equal(await (await app.request("src/data/copy.js")).text(), data.bodies.get("index.html"));
});

test("licensed public media follows the selected building scope and loses invalid source or privacy records", async () => {
  const data = fixture(), body = "licensed-photo", mediaAsset = { path: `assets/releases/${digest(body)}.png`, originalPath: "assets/media/library.png", bytes: Buffer.byteLength(body), sha256: digest(body), detail: true }; data.bodies.set(mediaAsset.originalPath, body); data.bundle.assets.push(mediaAsset); data.bundle.mediaRecords = [{ kind: "image", path: mediaAsset.path, entityId: "campus:floor:one", sourceId: "public-source", license: "school-approved", public: true }];
  const app = worker(); app.publish(data); const result = await app.message("DOWNLOAD_BUNDLE", { bundle: data.bundle, scope: "selected", selectedId: "campus:building:one" }); assert.equal(result.saved, true); app.setOnline(false); assert.equal(await (await app.request(mediaAsset.path)).text(), body); assert.equal((await app.message("READ_CATALOG")).mediaRecords.length, 1);
  const invalid = { bundle: clone(data.bundle), bodies: data.bodies }; invalid.bundle.mediaRecords[0].sourceId = "private-source"; const failed = worker(); failed.publish(invalid); assert.ok((await failed.message("DOWNLOAD_BUNDLE", { bundle: invalid.bundle, scope: "all" })).error); assert.equal(await failed.current(), undefined);
});
