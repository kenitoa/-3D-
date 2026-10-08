import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import { TextDecoder } from "node:util";
import { triangleGlb } from "./fixtures/self-contained-glb.mjs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const sources = ["src/data/campus-data.js", "src/data/interior-data.js", "src/data/site-plan.js", "src/domain/campus-platform.js", "src/domain/refinement.js"];
const copy = (value) => JSON.parse(JSON.stringify(value));
function setup(t, options = {}) {
  const dom = new JSDOM('<!doctype html><html><body><main id="mount"></main><textarea id="editor"></textarea><input id="summary"></body></html>', { runScripts: "outside-only", url: "http://localhost/" }), { window } = dom;
  window.TextDecoder = TextDecoder;
  sources.forEach((path) => window.eval(read(path)));
  const catalog = window.CampusPlatform.publicCatalog(window.CampusPlatform.createCatalog(window.SitePlanData, window.CampusData)), actions = [], state = { campusId: catalog.activeCampusId, quality: "auto" };
  window.eval(read("src/ui/refinement-controls.js"));
  const controller = window.CampusRefinementControls.initialize({ mount: window.document.getElementById("mount"), catalog, onAction: (action, payload) => actions.push({ action, payload }), getState: () => state, ...options });
  t.after(() => { controller.destroy(); dom.window.close(); });
  const field = (key) => window.document.querySelector(`[data-ref-field="${key}"]`), output = (key) => window.document.querySelector(`[data-ref-output="${key}"]`);
  const click = async (key) => { window.document.querySelector(`[data-ref-command="${key}"]`).click(); await controller.whenIdle(); };
  const submit = (key) => window.document.querySelector(`[data-ref-form="${key}"]`).dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
  return { dom, window, document: window.document, catalog, controller, actions, state, field, output, click, submit };
}

test("purpose presets apply registered layers without deriving a user identity", async (t) => {
  const { field, click, actions, output, catalog } = setup(t); field("purpose").value = "facilities"; await click("purpose");
  const applied = actions.at(-1); assert.equal(applied.action, "refinement-purpose"); assert.equal(applied.payload.purpose, "facilities"); assert.ok(applied.payload.layers.every((id) => catalog.layers.some((layer) => layer.id === id))); assert.match(output("purpose").textContent, /신분을 추정하지/);
});

test("breadcrumbs retain stable hierarchy IDs and equivalent view navigation without losing keyboard focus", (t) => {
  const { controller, output, actions, document } = setup(t), id = "hanshin-gg:building:gyeongsam:floor:2f";
  controller.update({ selectedId: id }); assert.match(output("breadcrumb").textContent, /경삼관/); const current = output("breadcrumb").querySelector('[aria-current="location"]'); assert.equal(current.dataset.refSpace, id); current.focus(); controller.update({ diagnostics: { fps: 31 } }); assert.equal(document.activeElement, current);
  document.querySelector('[data-ref-view="2d"]').click(); assert.equal(actions.at(-1).action, "view"); assert.equal(actions.at(-1).payload.id, id); document.querySelector("[data-ref-overview]").click(); assert.equal(actions.at(-1).payload.view, "overview");
});

test("boundary legends and property-specific evidence preserve absent legal geometry and references", (t) => {
  const { controller, output, document } = setup(t); controller.update({ selectedId: "hanshin-gg:building:janggong" });
  assert.match(output("legend").querySelector('[data-boundary-kind="guide"]').textContent, /추정/); assert.match(output("legend").querySelector('[data-boundary-kind="legal"]').textContent, /자료 미확보/); assert.match(output("claims").textContent, /명칭:/); assert.match(output("claims").textContent, /높이:/); assert.match(output("claims").textContent, /2026-10-07/); assert.ok(Array.from(document.querySelectorAll("a")).every((link) => link.protocol === "https:"));
});

test("coordinate measurement computes real distances, rejects malformed polygons and discloses uncertainty", (t) => {
  const { field, submit, output, actions } = setup(t); field("measure-points").value = "0,0,0\n3,4,12"; submit("measure"); assert.match(output("measure").textContent, /약 5m/); assert.match(output("measure").textContent, /측량 오차 미확인/); assert.equal(actions.at(-1).payload.result.value, 5);
  field("measure-type").value = "area"; field("measure-points").value = "0,0\n10,0\n10,10\n0,10\n0,0"; submit("measure"); assert.match(output("measure").textContent, /100m²/);
  field("measure-points").value = "0,0\n10,10\n0,10\n10,0\n0,0"; const before = actions.length; submit("measure"); assert.equal(actions.length, before); assert.match(output("status").textContent, /intersect/);
});

test("selected multipolygon area accounts for holes while not claiming a legal site area", async (t) => {
  const { controller, catalog, output, click, actions } = setup(t), selected = catalog.entities.find((entity) => entity.kind === "building"); selected.geometry = { ...selected.geometry, type: "MultiPolygon", coordinates: [[[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], [[2, 2], [4, 2], [4, 4], [2, 4], [2, 2]]], [[[20, 0], [22, 0], [22, 2], [20, 2], [20, 0]]]], confidence: "estimated" };
  controller.update({ selectedId: selected.id }); await click("measure-outline"); assert.match(output("measure").textContent, /약 100m²/); assert.match(output("measure").textContent, /법적 부지 면적이 아닙니다/); assert.equal(actions.at(-1).payload.entityId, selected.id);
});

test("comparison strips private catalog geometry and gives versioned unverified approval context", async (t) => {
  const { catalog, field, controller, window, output, click, actions } = setup(t), next = copy(catalog); next.contentVersion = next.datasetVersion = "comparison-2"; next.entities.find((entity) => entity.kind === "building").name = "비교 이름";
  Object.defineProperty(field("compare-file"), "files", { value: [{ size: 1000, text: async () => JSON.stringify(next) }] }); field("compare-file").dispatchEvent(new window.Event("change")); await controller.whenIdle(); assert.match(output("compare").textContent, /comparison-2/); assert.match(output("compare").textContent, /학교 승인·현장 검증을 뜻하지/); assert.match(output("compare-diff").textContent, /변경/); await click("compare-other"); assert.equal(actions.at(-1).payload.version, "comparison-2"); controller.update({ catalog: controller.comparison }); assert.equal(window.document.querySelector('[data-ref-command="compare-other"]').disabled, false); await click("compare-current"); assert.equal(actions.at(-1).payload.version, catalog.contentVersion); assert.equal(actions.at(-1).payload.clear, true);
});

test("grounded helper uses public catalog IDs and dated source citations, leaving absent facts unknown", (t) => {
  const { field, submit, output } = setup(t); field("helper-query").value = "도서관"; submit("helper"); assert.match(output("helper").textContent, /경삼관/); assert.ok(output("helper").querySelector("[data-ref-space]")); assert.match(output("helper").textContent, /자료 hanshin-gg/); assert.match(output("helper").textContent, /위치 verified/); assert.match(output("helper").textContent, /운영 unverified/);
  field("helper-query").value = "알 수 없는 시설 이름 99999"; submit("helper"); assert.match(output("helper").textContent, /찾지 못했습니다/);
});

test("camera keys, reduced motion, device preferences and unsupported AR have explicit paths", async (t) => {
  const { document, window, field, actions, click, output } = setup(t); document.querySelector(".refinement-camera button").dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true, cancelable: true })); assert.equal(actions.at(-1).payload.command, "move-north"); field("reduced-motion").checked = true; field("reduced-motion").dispatchEvent(new window.Event("change")); assert.equal(actions.at(-1).payload.reducedMotion, true);
  field("eye-height").value = "99"; const before = actions.length; await click("vr-preferences"); assert.equal(actions.length, before); assert.match(output("status").textContent, /0.5~2.3/); await click("ar"); assert.match(output("status").textContent, /WebXR 지원 확인 기능이 없습니다/);
});

test("license-checked local media avoids autoplay and is not recreated during diagnostics updates", (t) => {
  const id = "hanshin-gg:building:janggong", { catalog, controller, output, document } = setup(t);
  controller.update({ selectedId: id, mediaRecords: [{ entityId: id, kind: "image", path: "assets/media/campus.png", sourceId: catalog.sources[0].id, license: "학교 제공 사용권", public: true }, { entityId: id, kind: "image", path: "https://tracking.invalid/image.png", sourceId: catalog.sources[0].id, license: "", public: true }] });
  const img = output("media").querySelector("img"); assert.ok(img); assert.equal(output("media").querySelectorAll("img").length, 1); assert.equal(document.querySelectorAll("[autoplay]").length, 0); controller.update({ diagnostics: { fps: 10 } }); assert.equal(output("media").querySelector("img"), img);
});

test("version mismatch and removed targets remain visible without fabricating a replacement", (t) => {
  const { controller, output } = setup(t); controller.update({ sharedVersion: "old-1", selectedId: "hanshin-gg:removed:1", sharedStatus: "retired" }); assert.match(output("shared").textContent, /제외/); assert.match(output("breadcrumb").textContent, /변경되거나 제외/); controller.update({ sharedStatus: "version-changed" }); assert.match(output("shared").textContent, /old-1/);
});

function reviewSetup(t) {
  const base = setup(t); base.window.eval(read("src/ui/refinement-scene-preview.js"));
  const editor = base.document.getElementById("editor"); editor.value = JSON.stringify(base.catalog);
  const review = base.window.CampusRefinementReview.initialize({ mount: base.document.getElementById("mount"), editor, summary: base.document.getElementById("summary") }); t.after(() => review.destroy()); review.update({ currentCatalog: base.catalog, editable: true });
  const field = (key) => base.document.querySelector(`[data-review-field="${key}"]`), output = (key) => base.document.querySelector(`[data-review-output="${key}"]`), click = (key) => base.document.querySelector(`[data-review-command="${key}"]`).click(), submit = (key) => base.document.querySelector(`[data-review-form="${key}"]`).dispatchEvent(new base.window.Event("submit", { bubbles: true, cancelable: true })); click("load"); field("entity").value = "hanshin-gg:building:janggong"; field("entity").dispatchEvent(new base.window.Event("change")); return { ...base, review, editor, field, output, click, submit };
}

test("admin coordinate review updates a validated draft only, preserves IDs and can undo", (t) => {
  const { field, editor, submit, output, click, catalog, review } = reviewSetup(t), before = catalog.entities.find((item) => item.id === field("entity").value), original = editor.value;
  field("east").value = before.position.east + 2; field("north").value = before.position.north + 3; submit("placement"); const changed = JSON.parse(editor.value).entities.find((item) => item.id === before.id); assert.equal(changed.position.east, before.position.east + 2); assert.equal(changed.claims.location.confidence, "estimated"); assert.equal(changed.id, before.id); assert.equal(changed.geometry.coordinates[0][0][0], before.geometry.coordinates[0][0][0] + 2); assert.match(output("status").textContent, /초안에 반영/);
  click("undo"); assert.equal(editor.value, original); review.update({ editable: false }); assert.equal(field("east").disabled, true);
});

test("admin registration needs explicit altitude and independent holdouts, without confidence promotion", (t) => {
  const { field, submit, output, editor } = reviewSetup(t); field("up").value = ""; field("horizontal").value = 1; field("vertical").value = 1; field("landmarks").value = "[]"; submit("registration"); assert.match(output("status").textContent, /높이 미확인/);
  field("up").value = 0; const east = Number(field("east").value), north = Number(field("north").value); field("landmarks").value = JSON.stringify(Array.from({ length: 3 }, (_, index) => ({ id: `check-${index}`, role: "holdout", model: [0, 0, 0], siteMeters: [east, north, 0] }))); const before = editor.value; submit("registration"); const report = JSON.parse(output("registration").textContent); assert.equal(report.holdoutSummary.count, 3); assert.equal(report.confirmationUnchanged, true); assert.equal(editor.value, before);
});

test("local GLB review produces real file statistics without uploads and clears private review on logout", async (t) => {
  const { field, review, window, document, output } = reviewSetup(t), bytes = triangleGlb(); const buffer = new window.Uint8Array(bytes.length); buffer.set(bytes);
  Object.defineProperty(field("glb-incoming"), "files", { value: [{ name: "actual.glb", size: bytes.length, lastModified: 1, arrayBuffer: async () => buffer.buffer }] }); field("glb-incoming").dispatchEvent(new window.Event("change")); await review.whenIdle(); assert.match(document.querySelector('[data-review-stats="incoming"]').textContent, /vertices3/); assert.match(document.querySelector('[data-review-stats="incoming"]').textContent, /triangles1/); assert.match(output("status").textContent, /공개·업로드되지/);
  field("review-note").value = "비공개 검수 메모"; review.update({ editable: false, clear: true }); assert.equal(field("review-note").value, ""); assert.equal(document.querySelector('[data-review-stats="incoming"]').textContent, "");
});

test("destroy removes refinement listeners and private preview DOM", (t) => {
  const { controller, document, actions } = setup(t); const button = document.querySelector('[data-ref-camera="zoom-in"]'); controller.destroy(); const before = actions.length; button.click(); assert.equal(actions.length, before); assert.equal(document.getElementById("campusRefinement"), null);
});

test("AR requires registered landmarks and sends explicit capture identities before review", async (t) => {
  const { controller, document, field, click, actions, output } = setup(t); assert.equal(document.querySelector('[data-ref-command="ar-start"]').disabled, true); assert.match(output("xr").textContent, /등록되지 않았습니다/);
  controller.update({ arAnchors: [{ id: "survey-zone-1", title: "현장 검수 구역", landmarks: [{ id: "check-1", role: "holdout", siteMeters: [1, 2, 3] }] }] }); assert.equal(field("ar-anchor").value, "survey-zone-1"); await click("ar-capture"); assert.equal(actions.at(-1).action, "refinement-ar"); assert.equal(actions.at(-1).payload.command, "capture"); assert.equal(actions.at(-1).payload.landmarkId, "check-1"); assert.equal(actions.at(-1).payload.role, "holdout");
  controller.update({ arCalibrationReport: { passed: false, reason: "insufficient-holdout" }, xrStatus: "현장 정합 자료가 부족합니다." }); assert.match(output("ar-report").textContent, /false/); assert.match(output("xr").textContent, /부족/);
});

test("offline scopes require a selected entity and include only declared public snapshot options", async (t) => {
  const { controller, field, click, actions, output } = setup(t); field("offline-scope").value = "selected"; const count = actions.length; await click("offline-save"); assert.equal(actions.length, count); assert.match(output("status").textContent, /건물을 먼저 선택/);
  controller.update({ selectedId: "hanshin-gg:building:janggong", offlineEstimate: { bytes: 1048576, scope: "selected" } }); assert.match(output("offline").textContent, /1.0MB/); await click("offline-save"); assert.equal(actions.at(-1).payload.command, "download"); assert.equal(actions.at(-1).payload.selectedOnly, true); assert.equal(actions.at(-1).payload.details, true);
  controller.update({ offlineStatus: "승인 공개판 저장 완료" }); controller.update({ diagnostics: { fps: 30 } }); assert.match(output("offline").textContent, /저장 완료/);
});

test("verified external helper is optional, preserves registered fallback and binds returned citations", async (t) => {
  const { controller, field, click, actions, output, catalog, document } = setup(t); assert.equal(document.querySelector('[data-ref-command="assistant"]').disabled, true); controller.update({ assistantConfigured: true }); field("helper-query").value = "도서관"; await click("assistant"); assert.equal(actions.at(-1).action, "refinement-assistant"); assert.match(output("helper").textContent, /경삼관/);
  controller.update({ assistantResult: { answer: "등록 자료에서 경삼관을 찾았습니다.", entityIds: ["hanshin-gg:building:gyeongsam", "unknown"], sourceIds: [catalog.sources[0].id] } }); assert.match(output("assistant").textContent, /경삼관/); assert.equal(output("assistant").querySelectorAll("[data-ref-space]").length, 1); assert.equal(output("assistant").querySelectorAll("a").length, 1);
});
