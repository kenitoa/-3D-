import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sources = ["src/data/campus-data.js", "src/data/interior-data.js", "src/data/site-plan.js", "src/domain/campus-platform.js", "src/domain/refinement.js", "src/ui/refinement-controls.js", "src/ui/refinement-scene-preview.js"].map(read);
const uiSource = read("src/ui/platform-controls.js");
const adminSource = read("src/ui/admin.js");
const adminMarkup = read("admin.html").replace('data-admin-auto="true"', 'data-admin-auto="false"');

function setup(t, override = {}) {
  const dom = new JSDOM('<!doctype html><html><body><canvas id="renderCanvas"></canvas><aside id="siteControls"><div id="campusTools"></div></aside></body></html>', { runScripts: "outside-only", url: "http://localhost/" });
  const { window } = dom;
  sources.forEach((source) => window.eval(source));
  const catalog = window.CampusPlatform.publicCatalog(window.CampusPlatform.createCatalog(window.SitePlanData, window.CampusData));
  window.confirm = () => true;
  window.eval(uiSource);
  const actions = [];
  const controller = window.CampusPlatformControls.initialize({ catalog, onAction: (action, payload) => actions.push({ action, payload }), getState: () => ({ view: "overview", layers: ["boundary", "labels"], camera: { alpha: 2, beta: 0.6 }, selectedId: null }), ...override });
  t.after(() => { controller.destroy(); dom.window.close(); });
  const field = (name) => window.document.querySelector(`[data-field="${name}"]`);
  const output = (name) => window.document.querySelector(`[data-output="${name}"]`);
  const click = async (name) => { window.document.querySelector(`[data-command="${name}"]`).click(); await controller.whenIdle(); };
  const submit = async (name) => { window.document.querySelector(`[data-form="${name}"]`).dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); await controller.whenIdle(); };
  return { dom, window, document: window.document, catalog, controller, actions, field, output, click, submit };
}

test("progressive search uses the real catalog, stable IDs, hierarchy and keyboard selection", async (t) => {
  const { field, output, window, actions } = setup(t);
  field("query").value = "실습동"; field("query").dispatchEvent(new window.Event("input"));
  const button = output("search-results").querySelector("button");
  assert.match(button.textContent, /산학관/); assert.equal(button.dataset.spaceId, "hanshin-gg:building:practice");
  button.click(); assert.equal(actions.at(-1).payload.id, button.dataset.spaceId);
  field("building").value = "hanshin-gg:building:gyeongsam"; field("query").value = ""; field("building").dispatchEvent(new window.Event("change"));
  assert.ok(field("floor").options.length >= 5);
  field("floor").value = "hanshin-gg:building:gyeongsam:floor:2f"; field("floor").dispatchEvent(new window.Event("change"));
  assert.ok(output("search-results").textContent.includes("2F"));
  const first = output("search-results").querySelector("button"); first.focus(); first.dispatchEvent(new window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
  assert.equal(window.document.activeElement, Array.from(output("search-results").querySelectorAll("button")).at(-1));
});

test("language only uses reviewed translations and selected claims retain dates and source links", async (t) => {
  const { field, window, controller, output } = setup(t);
  field("language").value = "en"; field("language").dispatchEvent(new window.Event("change"));
  controller.update({ selectedId: "hanshin-gg:building:janggong" });
  assert.match(output("selected").textContent, /Verified English name is unavailable/);
  assert.match(output("selected").textContent, /2026-10-07/);
  assert.ok(Array.from(output("selected").querySelectorAll("a")).every((link) => link.protocol === "https:"));
});

test("text/2D mode covers the complete guide boundary and update causes no action loop", async (t) => {
  const { controller, document, actions, click, window } = setup(t);
  const before = actions.length; controller.update({ view: "2d" });
  const overlay = document.querySelector("#campusAlternativeMap"); assert.equal(overlay.hidden, false); assert.equal(actions.length, before);
  assert.ok(overlay.querySelector(".platform-guide-boundary")); assert.equal(overlay.querySelectorAll(".platform-map-point").length >= 16, true);
  const focus = document.activeElement; controller.update({ view: "2d" }); assert.equal(document.activeElement, focus);
  assert.equal(document.querySelector("#siteControls").inert, true);
  overlay.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); assert.equal(overlay.hidden, true); assert.equal(document.querySelector("#siteControls").inert, undefined);
  await click("text"); assert.equal(overlay.dataset.mode, "text"); assert.equal(overlay.querySelector("[data-map-svg]").hidden, true);
  controller.update({ view: "overview" }); assert.equal(overlay.hidden, true);
});

test("2D drawing preserves metre aspect ratio and holes rather than stretching the campus", async (t) => {
  const { controller, document, catalog } = setup(t); controller.update({ view: "2d" });
  const path = document.querySelector(".platform-guide-boundary"); const drawn = Array.from(path.getAttribute("d").matchAll(/[ML]([^MLZ ]+)/g), (match) => match[1].split(",").map(Number)); const original = catalog.campuses[0].boundaries.guide.coordinates[0][0];
  const span = (points, index) => Math.max(...points.map((point) => point[index])) - Math.min(...points.map((point) => point[index])); assert.ok(Math.abs(span(drawn, 0) / span(drawn, 1) - span(original, 0) / span(original, 1)) < 1e-9); assert.equal(path.getAttribute("fill-rule"), "evenodd");
});

test("2D labels remain inside the viewport without overlapping and retain stable marker identities", async (t) => {
  const { controller, document, catalog, window } = setup(t); controller.update({ view: "2d" });
  const labels = Array.from(document.querySelectorAll("[data-map-label]"));
  assert.equal(labels.filter((label) => catalog.entities.find((entity) => entity.id === label.dataset.mapLabel)?.kind === "building").length, 16);
  const rectangles = labels.map((label) => { const rect = label.querySelector("rect"); return Object.fromEntries(["x", "y", "width", "height"].map((name) => [name, Number(rect.getAttribute(name))])); });
  rectangles.forEach((rect, index) => { assert.ok(rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= 800 && rect.y + rect.height <= 600); rectangles.slice(index + 1).forEach((other) => assert.equal(rect.x < other.x + other.width && rect.x + rect.width > other.x && rect.y < other.y + other.height && rect.y + rect.height > other.y, false)); });
  assert.ok(document.querySelector('[data-map-marker="hanshin-gg:building:janggong"]'));
  controller.update({ selectedId: "hanshin-gg:building:janggong" }); assert.ok(document.querySelector('[data-map-marker="hanshin-gg:building:janggong"] .selected'));
  window.innerWidth = 390; controller.update({ view: "overview" }); controller.update({ view: "2d" }); assert.equal(Array.from(document.querySelectorAll("[data-map-label]")).filter((label) => catalog.entities.find((entity) => entity.id === label.dataset.mapLabel)?.kind === "building").length, 16); assert.equal(document.querySelector("[data-map-label] text").style.fontSize, "26px");
});

test("temporary device location renders an accuracy circle without entering links or personal storage", async (t) => {
  const { controller, document, click, field, window } = setup(t);
  controller.update({ view: "2d", location: { campusId: "hanshin-gg", east: 123.456, north: 45.678, accuracyMeters: 12, timestamp: "2026-10-07T11:00:00Z", inside: true } });
  assert.ok(document.querySelector(".platform-temporary-location")); assert.ok(Number(document.querySelector(".platform-location-accuracy").getAttribute("r")) > 0); assert.match(document.querySelector(".platform-temporary-location title").textContent, /약 12m/);
  controller.update({ view: "overview" }); await click("share"); assert.equal(field("share-url").value.includes("123.456"), false); assert.equal(field("share-url").value.includes("accuracy"), false); assert.equal(Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.getItem(window.localStorage.key(index))).some((value) => value.includes("123.456")), false);
  controller.update({ view: "2d", location: null }); assert.equal(document.querySelector(".platform-temporary-location"), null);
  controller.update({ location: { campusId: "hanshin-gg", east: 123.456, north: 45.678, inside: false } }); assert.equal(document.querySelector(".platform-temporary-location"), null);
});

test("unverified route data returns an honest unavailable state and manual location is preserved", async (t) => {
  const { field, output, submit, actions, click } = setup(t);
  field("from").value = "hanshin-gg:building:janggong"; field("to").value = "hanshin-gg:building:gyeongsam";
  field("accessible").checked = true; await submit("route");
  assert.match(output("route").textContent, /현장 검토한 경로 자료가 없습니다/); assert.equal(output("route-steps").children.length, 0); assert.equal(actions.at(-1).payload.result.status, "unavailable");
  await click("location"); assert.match(output("location").textContent, /출발 공간을 직접 선택/);
});

test("favorites, recent places and manual timetable survive reinitialization; reset needs UI confirmation", async (t) => {
  const { window, controller, field, submit, output, click } = setup(t);
  controller.update({ selectedId: "hanshin-gg:building:janggong" }); output("selected").querySelector("[data-favorite-id]").click();
  field("schedule-title").value = "내 강의"; field("schedule-space").value = "hanshin-gg:building:gyeongsam"; field("schedule-time").value = "09:00"; field("schedule-end").value = "10:00"; await submit("schedule");
  assert.match(output("timetable").textContent, /09:00~10:00/);
  const stored = JSON.parse(window.localStorage.getItem("hanshin-campus-personal-v1")); assert.equal(stored.schemaVersion, 1); assert.equal(stored.timetable[0].entityId, "hanshin-gg:building:gyeongsam");
  const next = window.CampusPlatformControls.initialize({ catalog: controller.catalog });
  t.after(() => next.destroy()); assert.match(window.document.querySelector('[data-output="timetable"]').textContent, /내 강의/); assert.match(window.document.querySelector('[data-output="favorites"]').textContent, /장공관/);
  window.confirm = () => false; await click("personal-reset"); assert.match(window.document.querySelector('[data-output="timetable"]').textContent, /내 강의/);
  window.confirm = () => true; window.document.querySelector('[data-command="personal-reset"]').click(); await next.whenIdle(); assert.match(window.document.querySelector('[data-output="timetable"]').textContent, /없습니다/);
});

test("storage quota errors and invalid timetable imports remain visible without losing current entries", async (t) => {
  const { window, field, submit, output, controller } = setup(t);
  Object.defineProperty(window.localStorage, "setItem", { value: () => { throw new window.Error("quota exceeded"); }, configurable: true });
  // Storage accessors are implemented on the prototype in jsdom.
  const original = window.Storage.prototype.setItem;
  window.Storage.prototype.setItem = () => { throw new window.Error("quota exceeded"); };
  t.after(() => { window.Storage.prototype.setItem = original; });
  field("schedule-title").value = "저장 실패 일정"; field("schedule-space").value = "hanshin-gg:building:janggong"; field("schedule-time").value = "11:00"; field("schedule-end").value = "12:00"; await submit("schedule");
  assert.match(output("storage").textContent, /저장할 수 없습니다/); assert.match(output("timetable").textContent, /저장 실패 일정/);
  Object.defineProperty(field("schedule-import"), "files", { value: [{ size: 20, text: async () => JSON.stringify({ version: 1, entries: [{ title: "bad" }] }) }] });
  field("schedule-import").dispatchEvent(new window.Event("change")); await controller.whenIdle(); assert.match(output("storage").textContent, /시간표를 변경하지 않았습니다/); assert.match(output("timetable").textContent, /저장 실패 일정/);
});

test("virtual tour next/previous/end restores the captured camera", async (t) => {
  const { click, actions, output } = setup(t);
  await click("tour-start"); assert.match(output("tour").textContent, /1\/16/); await click("tour-next"); assert.match(output("tour").textContent, /2\/16/); await click("tour-prev"); await click("tour-stop");
  assert.deepEqual(JSON.parse(JSON.stringify(actions.find((action) => action.action === "tour-restore").payload.snapshot)), { alpha: 2, beta: 0.6 });
});

test("share state round-trips canonical IDs and genuine QR encoder receives the exact URL", async (t) => {
  const { window, controller, click, field, output, catalog } = setup(t);
  controller.update({ selectedId: "hanshin-gg:building:practice" }); await click("share");
  const url = new URL(field("share-url").value); const state = window.CampusPlatform.parseState(url.hash, catalog); assert.equal(state.valid, true); assert.equal(state.state.entityId, "hanshin-gg:building:practice");
  let encoded = null; window.CampusQr = { toDataURL: async (value) => { encoded = value; return "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="; } };
  await click("qr"); assert.equal(encoded, url.href); assert.equal(output("qr").hidden, false); assert.equal(url.hash.includes("latitude"), false);
});

test("report retry reuses its idempotency key, preserves input on failure and clears only after a receipt", async (t) => {
  const { window, field, submit, output } = setup(t); const sent = [];
  window.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); if (sent.length === 1) throw new window.TypeError("offline"); return { ok: true, json: async () => ({ data: { id: "receipt-1", status: "received" }, error: null }) }; };
  field("report-space").value = "hanshin-gg:building:janggong"; field("report-description").value = "입구 설명이 확인 필요합니다.";
  await submit("report"); assert.match(output("report").textContent, /입력과 사진은 유지/); assert.ok(field("report-description").value);
  await submit("report"); assert.equal(sent[0].idempotencyKey, sent[1].idempotencyKey); assert.equal(sent[1].type, "map"); assert.equal(field("report-description").value, ""); assert.match(output("report").textContent, /receipt-1/);
});

test("oversized or non-image attachments are rejected before upload", async (t) => {
  const { field, output, window, controller } = setup(t);
  Object.defineProperty(field("report-photo"), "files", { value: [{ size: 3 * 1024 * 1024, type: "image/png" }] });
  field("report-photo").dispatchEvent(new window.Event("change")); await controller.whenIdle(); assert.match(output("report").textContent, /2MB 이하/); assert.equal(output("photo").hidden, true);
});

test("photo pixels are re-encoded, consent is required, and original file metadata is never submitted", async (t) => {
  const { window, field, output, controller, submit } = setup(t); const sent = [];
  window.URL.createObjectURL = () => "blob:fixture"; window.URL.revokeObjectURL = () => {};
  window.Image = class { naturalWidth = 80; naturalHeight = 50; set src(_value) { window.setTimeout(() => this.onload(), 0); } };
  window.HTMLCanvasElement.prototype.getContext = () => ({ drawImage() {} }); window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,cGl4ZWxz";
  Object.defineProperty(field("report-photo"), "files", { value: [{ size: 100, type: "image/png", name: "contains-location.png" }] });
  field("report-photo").dispatchEvent(new window.Event("change")); await controller.whenIdle(); assert.equal(output("photo").hidden, false);
  field("report-description").value = "사진을 포함한 확인 요청";
  window.fetch = async (_url, options) => { sent.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ data: { id: "receipt-photo", receiptToken: "private-token", status: "received" }, error: null }) }; };
  await submit("report"); assert.equal(sent.length, 0); assert.match(output("report").textContent, /동의/);
  field("photo-consent").checked = true; await submit("report"); assert.deepEqual(sent[0].photo, { mimeType: "image/png", dataBase64: "cGl4ZWxz" }); assert.equal(sent[0].photo.name, undefined); assert.equal(field("receipt-token").value, "private-token"); assert.equal(output("photo").hasAttribute("src"), false);
});

test("private receipt queries use a header and never leak the token into sharing or local storage", async (t) => {
  const { window, field, submit, output, click } = setup(t); let call;
  window.fetch = async (url, options) => { call = { url, options }; return { ok: true, json: async () => ({ data: { status: "reviewing", responseNote: "현장 확인 예정", updatedAt: "2026-10-07T10:00:00Z" }, error: null }) }; };
  field("receipt-id").value = "receipt-1"; field("receipt-token").value = "private-token"; await submit("receipt");
  assert.equal(call.options.headers["X-Report-Receipt"], "private-token"); assert.equal(call.url.includes("private-token"), false); assert.match(output("receipt").textContent, /검토 중.*현장 확인 예정/);
  await click("share"); assert.equal(field("share-url").value.includes("private-token"), false); assert.equal(Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.getItem(window.localStorage.key(index))).some((value) => value.includes("private-token")), false);
});

test("expired operating records stay expired and current parent closures restrict child spaces", async (t) => {
  const { catalog, controller, output } = setup(t); const next = JSON.parse(JSON.stringify(catalog));
  next.operations = [{ id: "ops-expired", entityId: "hanshin-gg:building:janggong", state: "open", label: "과거 운영", sourceIds: ["hanshin-official-tour"], visibility: "public", verification: "verified", observedAt: "2020-01-01T00:00:00Z", validFrom: "2020-01-01T00:00:00Z", validUntil: "2020-01-02T00:00:00Z" }];
  controller.update({ catalog: next, selectedId: "hanshin-gg:building:janggong" }); assert.match(output("selected").textContent, /유효기간이 지났습니다/); assert.equal(output("selected").textContent.includes("운영: 과거 운영"), false);
  next.operations[0] = { ...next.operations[0], state: "closed", label: "점검으로 출입 제한", observedAt: new Date(Date.now() - 60000).toISOString(), validFrom: new Date(Date.now() - 60000).toISOString(), validUntil: new Date(Date.now() + 3600000).toISOString() };
  const child = next.entities.find((entity) => entity.owningBuildingId === "hanshin-gg:building:janggong" && entity.kind === "floor"); controller.update({ selectedId: child.id }); assert.match(output("selected").textContent, /상위 공간 제한.*점검으로 출입 제한/);
});

test("catalog import is validated before switching and historical records stay visibly distinct", async (t) => {
  const { field, window, controller, catalog, output, click, actions } = setup(t);
  const next = JSON.parse(JSON.stringify(catalog)); next.contentVersion = "review-2"; next.datasetVersion = "review-2"; next.entities.find((entity) => entity.id === "hanshin-gg:building:practice").status = "historic";
  Object.defineProperty(field("catalog-import"), "files", { value: [{ size: 1000, text: async () => JSON.stringify(next) }] });
  field("catalog-import").dispatchEvent(new window.Event("change")); await controller.whenIdle(); assert.match(output("import").textContent, /검증한 공개 자료/); await click("catalog-apply"); assert.equal(actions.find((action) => action.action === "switchCatalog").payload.catalog.contentVersion, "review-2");
  field("history").value = "historic"; field("query").value = "산학관"; field("history").dispatchEvent(new window.Event("change")); assert.match(output("search-results").textContent, /산학관/); assert.match(output("history").textContent, /과거 기록/);
});

test("helper and imported names are rendered as text; sensitive entities never appear in alternatives", async (t) => {
  const { catalog, controller, window, field, submit, output, document } = setup(t);
  const next = JSON.parse(JSON.stringify(catalog)); const building = next.entities.find((entity) => entity.kind === "building"); building.name = '<img src=x onerror="evil()">'; building.displayTitle = building.name; building.sensitive = true; controller.update({ catalog: next });
  field("helper").value = "없는장소"; await submit("helper"); assert.match(output("helper").textContent, /등록된 자료에서 답을 찾지 못했습니다/);
  controller.update({ view: "text" }); assert.equal(document.querySelector("#campusAlternativeMap").querySelector("img[src=x]"), null); assert.equal(document.querySelector(`[data-map-list] [data-space-id="${building.id}"]`), null);
  assert.equal(window.CampusPlatformControls.safeSourceUrl("javascript:alert(1)"), null);
});

function adminSetup(t, role = "editor", override = {}) {
  const dom = new JSDOM(adminMarkup, { runScripts: "outside-only", url: "http://localhost/admin.html" }); const { window } = dom;
  sources.forEach((source) => window.eval(source)); window.confirm = () => true;
  const catalog = window.CampusPlatform.createCatalog(window.SitePlanData, window.CampusData);
  const user = { id: "user-1", username: "test-user", role, campusIds: ["hanshin-gg"] }; const calls = [];
  const draft = { id: "a1111111-1111-1111-1111-111111111111", summary: "변경 초안", status: "submitted", authorId: "user-2", revision: 4, baseRevision: 2, catalog };
  const defaultData = (path) => path === "/session" ? { user, csrfToken: "csrf-1", adminConfigured: true } : path === "/admin/status" ? { catalogRevision: 2, currentRelease: "release-1", reportCount: 0 } : path === "/admin/catalog" ? catalog : path === "/admin/drafts" ? [draft] : path === "/admin/releases" ? [{ id: "b1111111-1111-1111-1111-111111111111", summary: "공개판", createdAt: "2026-10-07T00:00:00Z" }] : [];
  window.fetch = async (url, options) => { const path = new URL(url).pathname.replace("/api/v1", ""); calls.push({ path, url: String(url), ...options }); if (override.fetch) return override.fetch(path, options, defaultData); return { ok: true, status: 200, json: async () => ({ data: defaultData(path), error: null, meta: { revision: 2 } }) }; };
  window.eval(adminSource); const controller = window.CampusAdmin.initialize(); t.after(() => { controller.destroy(); window.close(); });
  return { window, document: window.document, controller, calls, draft, catalog };
}

test("admin editor sees scoped drafts but cannot approve, publish, restore or publish operations", async (t) => {
  const { document, controller } = adminSetup(t); await controller.whenIdle();
  assert.equal(document.getElementById("adminWorkspace").hidden, false); document.getElementById("adminDraftSelect").selectedIndex = 1; document.getElementById("adminLoadDraft").click();
  assert.equal(document.querySelector('[data-draft-action="approve"]').disabled, true); assert.equal(document.getElementById("adminPublish").disabled, true); assert.equal(document.querySelector("[data-restore-release]").disabled, true); assert.equal(document.getElementById("adminSaveOperation").disabled, true);
});

test("reviewer approval sends exact draft revision and CSRF without storing credentials", async (t) => {
  const { document, controller, calls, window } = adminSetup(t, "reviewer"); await controller.whenIdle();
  document.getElementById("adminDraftSelect").selectedIndex = 1; document.getElementById("adminLoadDraft").click(); const button = document.querySelector('[data-draft-action="approve"]'); assert.equal(button.disabled, false); button.click(); await controller.whenIdle();
  const mutation = calls.find((call) => call.method === "PATCH"); assert.equal(mutation.headers["X-CSRF-Token"], "csrf-1"); assert.equal(mutation.credentials, "same-origin"); assert.deepEqual(JSON.parse(mutation.body), { action: "approve", expectedRevision: 4 }); assert.equal(window.localStorage.length, 0);
});

test("admin revision conflicts preserve draft JSON and explain refresh; no partial success is reported", async (t) => {
  const { document, controller, catalog } = adminSetup(t, "admin", { fetch: async (path, options, defaultData) => options.method === "POST" && path === "/admin/drafts" ? { ok: false, status: 409, json: async () => ({ data: null, error: { code: "REVISION_CONFLICT", message: "다른 변경이 있습니다." }, meta: { revision: 3 } }) } : { ok: true, status: 200, json: async () => ({ data: defaultData(path), error: null, meta: { revision: 2 } }) } });
  await controller.whenIdle(); const next = JSON.parse(JSON.stringify(catalog)); next.contentVersion = "draft-new"; next.datasetVersion = "draft-new"; document.getElementById("adminCatalog").value = JSON.stringify(next); document.getElementById("adminDraftSummary").value = "보존할 변경"; document.getElementById("adminDraftForm").dispatchEvent(new document.defaultView.Event("submit", { bubbles: true, cancelable: true })); await controller.whenIdle(); assert.equal(document.getElementById("adminCatalog").value, JSON.stringify(next)); assert.match(document.getElementById("adminMessage").textContent, /편집 내용은 유지/); assert.equal(document.getElementById("adminMessage").dataset.error, "true");
});

test("static or unavailable admin API shows a recoverable connection failure", async (t) => {
  const { document, controller } = adminSetup(t, "editor", { fetch: async () => { throw new TypeError("offline"); } }); await controller.whenIdle(); assert.equal(document.getElementById("adminWorkspace").hidden, true); assert.match(document.getElementById("adminMessage").textContent, /서버/); assert.equal(document.getElementById("adminReconnect").disabled, false);
});

test("registered provider sync creates a review draft using CSRF and never sends an arbitrary URL", async (t) => {
  const { document, controller, calls } = adminSetup(t, "editor", { fetch: async (path, options, defaultData) => ({ ok: true, status: 200, json: async () => ({ data: path === "/admin/providers" ? [{ id: "hanshin-source", kind: "catalog", campusId: "hanshin-gg", sourceId: "hanshin-official-tour", enabled: true, state: "ready" }] : path === "/admin/providers/hanshin-source/sync" ? { draftId: "a1111111-1111-1111-1111-111111111111", requiresReview: true } : defaultData(path), error: null, meta: { revision: 2 } }) }) });
  await controller.whenIdle(); const button = document.querySelector("[data-provider-sync]"); assert.equal(button.disabled, false); button.click(); await controller.whenIdle(); const call = calls.find((item) => item.path.endsWith("/sync")); assert.equal(call.headers["X-CSRF-Token"], "csrf-1"); assert.deepEqual(JSON.parse(call.body), { expectedRevision: 2 }); assert.match(document.getElementById("adminMessage").textContent, /아직 변경하지 않았습니다/);
});

test("admin logout removes private draft and provider contents from the DOM", async (t) => {
  const { document, controller } = adminSetup(t, "admin"); await controller.whenIdle(); document.getElementById("adminUseCurrent").click(); assert.ok(document.getElementById("adminCatalog").value); document.getElementById("adminLogout").click(); await controller.whenIdle(); assert.equal(document.getElementById("adminCatalog").value, ""); assert.equal(document.getElementById("adminWorkspace").hidden, true); assert.equal(document.getElementById("adminDraftSelect").options.length, 0); assert.equal(document.getElementById("adminProviders").textContent, "");
});

test("administrator selects an operating record, extends or cancels it with its revision, and starts a separate new record", async (t) => {
  let record = { id: "operation-1", revision: 4, entityId: "hanshin-gg:building:janggong", title: "시설 점검", owner: "시설 담당", status: "closed", startsAt: "2026-10-08T01:00:00Z", endsAt: "2026-10-08T03:00:00Z", sourceId: "hanshin-official-tour", visibility: "public" };
  const { document, window, controller, calls } = adminSetup(t, "reviewer", { fetch: async (path, options, defaultData) => {
    if (path === "/admin/operations" && options.method === "POST") record = { ...JSON.parse(options.body), id: record.id, revision: record.revision + 1 };
    return { ok: true, status: 200, json: async () => ({ data: path === "/admin/operations" ? options.method === "POST" ? record : [record] : defaultData(path), error: null, meta: { revision: 2 } }) };
  } });
  await controller.whenIdle(); document.querySelector("[data-operation-edit]").click();
  assert.equal(document.getElementById("adminOperationTitle").value, "시설 점검");
  assert.match(document.getElementById("adminOperationInfo").textContent, /revision 4/);
  document.getElementById("adminOperationStatus").value = "cancelled";
  document.getElementById("adminOperationEnd").value = "2026-10-08T14:00";
  document.getElementById("adminOperationForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); await controller.whenIdle();
  const request = calls.find((call) => call.path === "/admin/operations" && call.method === "POST"), body = JSON.parse(request.body);
  assert.equal(body.id, "operation-1"); assert.equal(body.expectedRevision, 4); assert.equal(body.status, "cancelled"); assert.equal(body.endsAt, new Date("2026-10-08T14:00").toISOString()); assert.equal(request.headers["X-CSRF-Token"], "csrf-1");
  assert.match(document.getElementById("adminOperationInfo").textContent, /revision 5/);
  document.getElementById("adminNewOperation").click(); assert.equal(document.getElementById("adminOperationTitle").value, ""); assert.equal(document.getElementById("adminOperationInfo").textContent, "새 운영 기록");
});

test("operating record revision conflict preserves the edited period and status", async (t) => {
  const record = { id: "operation-1", revision: 4, entityId: "hanshin-gg:building:janggong", title: "시설 점검", owner: "시설 담당", status: "closed", startsAt: "2026-10-08T01:00:00Z", endsAt: "2026-10-08T03:00:00Z", sourceId: "hanshin-official-tour", visibility: "public" };
  const { document, window, controller } = adminSetup(t, "admin", { fetch: async (path, options, defaultData) => path === "/admin/operations" && options.method === "POST" ? { ok: false, status: 409, json: async () => ({ data: null, error: { code: "REVISION_CONFLICT", message: "다른 담당자가 변경했습니다." }, meta: { revision: 3 } }) } : { ok: true, status: 200, json: async () => ({ data: path === "/admin/operations" ? [record] : defaultData(path), error: null, meta: { revision: 2 } }) } });
  await controller.whenIdle(); document.querySelector("[data-operation-edit]").click(); document.getElementById("adminOperationStatus").value = "cancelled"; document.getElementById("adminOperationEnd").value = "2026-10-08T15:00";
  document.getElementById("adminOperationForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); await controller.whenIdle();
  assert.equal(document.getElementById("adminOperationEnd").value, "2026-10-08T15:00"); assert.equal(document.getElementById("adminOperationStatus").value, "cancelled"); assert.match(document.getElementById("adminMessage").textContent, /편집 내용은 유지/); assert.equal(document.getElementById("adminMessage").dataset.error, "true");
});

test("admin list pagination follows validated server offsets while preserving the draft editor", async (t) => {
  let page = 0;
  const { document, controller, calls } = adminSetup(t, "editor", { fetch: async (path, options, defaultData) => {
    if (path === "/admin/drafts" && options.method === "GET") { const offset = page++ % 2; const data = defaultData(path).map((draft) => ({ ...draft, id: offset ? "b1111111-1111-1111-1111-111111111111" : draft.id, summary: offset ? "다음 페이지 초안" : draft.summary })); return { ok: true, status: 200, json: async () => ({ data, error: null, meta: { revision: 2, pagination: { limit: 1, offset, hasMore: offset === 0, nextOffset: offset === 0 ? 1 : null } } }) }; }
    return { ok: true, status: 200, json: async () => ({ data: defaultData(path), error: null, meta: { revision: 2 } }) };
  } });
  await controller.whenIdle(); document.getElementById("adminCatalog").value = "진행 중인 편집";
  const next = document.querySelector('[data-admin-page="/admin/drafts"][data-page-direction="next"]'), previous = document.querySelector('[data-admin-page="/admin/drafts"][data-page-direction="previous"]');
  assert.equal(previous.disabled, true); assert.equal(next.disabled, false); next.click(); await controller.whenIdle();
  assert.ok(calls.some((call) => call.url.endsWith("/admin/drafts?limit=1&offset=1"))); assert.match(document.getElementById("adminDraftSelect").textContent, /다음 페이지 초안/); assert.equal(next.disabled, true); assert.equal(previous.disabled, false); assert.equal(document.getElementById("adminCatalog").value, "진행 중인 편집");
  previous.click(); await controller.whenIdle(); assert.ok(calls.some((call) => call.url.endsWith("/admin/drafts?limit=1&offset=0"))); assert.equal(previous.disabled, true);
});

test("staff without complete catalog scope retain their report and operations lists through a public catalog fallback", async (t) => {
  const { document, controller, calls } = adminSetup(t, "reviewer", { fetch: async (path, _options, defaultData) => path === "/admin/catalog" ? { ok: false, status: 403, json: async () => ({ data: null, error: { code: "FORBIDDEN", message: "전체 캠퍼스 담당 범위가 아닙니다." }, meta: {} }) } : { ok: true, status: 200, json: async () => ({ data: path === "/catalog" ? defaultData("/admin/catalog") : path === "/admin/reports" ? [{ id: "report-1", type: "map", status: "received", description: "담당 제보", spaceId: "hanshin-gg:building:janggong" }] : defaultData(path), error: null, meta: { revision: 2 } }) } });
  await controller.whenIdle(); assert.ok(calls.some((call) => call.path === "/catalog")); assert.equal(document.getElementById("adminWorkspace").hidden, false); assert.equal(document.getElementById("adminCatalog").disabled, true); assert.equal(document.getElementById("adminSaveDraft").disabled, true); assert.match(document.getElementById("adminCatalogPermission").textContent, /전체 Catalog 편집 권한이 없습니다/); assert.equal(document.getElementById("adminReportSelect").options.length, 1); assert.equal(document.getElementById("adminSaveOperation").disabled, false); assert.match(document.getElementById("adminMessage").textContent, /담당 제보·운영 목록/);
});
