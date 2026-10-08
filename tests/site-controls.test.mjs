import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const controlsSource = readFileSync(new URL("../src/ui/site-controls.js", import.meta.url), "utf8");
const hudSource = readFileSync(new URL("../src/ui/hud.js", import.meta.url), "utf8");
const documentMarkup = `<!doctype html><html><body><canvas id="renderCanvas" tabindex="0"></canvas><aside id="siteControls"></aside><div id="campusViewBadge"></div><div id="campusDataBadge"></div><div id="campusNorth"><div id="campusNorthNeedle"></div></div><div id="campusScale"><span id="campusScaleLabel"></span><span id="campusScaleBar"></span></div><section id="campusLoadStatus"><h2 id="campusLoadTitle"></h2><p id="campusLoadMessage"></p><button id="campusRetry" hidden></button><button id="campusFallbackDismiss" hidden></button></section><div id="campusAnnouncement"></div><section id="buildingDetail" hidden></section></body></html>`;
const buildings = [
  { id: "osm-1", legacyKey: "janggong", name: "장공관", number: "1동", role: "본관", confidence: "mapped" },
  { id: "osm-2", legacyKey: "practice", name: "산학관", number: "9동", aliases: ["실습동"], confidence: "verified" }
];

function createControls(options = {}) {
  const dom = new JSDOM(documentMarkup, { runScripts: "outside-only", url: "http://localhost/" });
  dom.window.eval(controlsSource);
  const actions = [];
  const controls = dom.window.CampusSiteControls.initialize({ buildings, onAction: (action, payload) => actions.push({ action, payload }), ...options });
  return { dom, document: dom.window.document, window: dom.window, controls, actions };
}

test("search matches Korean names, numbers and official/legacy aliases", () => {
  const { document, window } = createControls();
  const input = document.querySelector(".site-search");
  input.value = "실습 동";
  input.dispatchEvent(new window.Event("input"));
  assert.equal(document.querySelectorAll(".site-building-list button").length, 1);
  assert.equal(document.querySelector(".site-building-list button").dataset.buildingId, "osm-2");
  input.value = "잘못된 이름";
  input.dispatchEvent(new window.Event("input"));
  assert.equal(document.querySelector(".site-no-results").hidden, false);
  assert.equal(document.querySelectorAll(".site-building-list button").length, 0);
});

test("keyboard selects actual building IDs and moves through the list", () => {
  const { document, window, actions, controls } = createControls();
  controls.update({ status: "ready" });
  const input = document.querySelector(".site-search");
  input.focus();
  input.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  const first = document.querySelector(".site-building-list button");
  assert.equal(document.activeElement, first);
  first.dispatchEvent(new window.KeyboardEvent("keydown", { key: "End", bubbles: true }));
  assert.equal(document.activeElement.dataset.buildingId, "osm-2");
  document.activeElement.click();
  assert.equal(actions[0].action, "select");
  assert.equal(actions[0].payload.id, "osm-2");
  assert.equal(document.querySelector(".site-selected").hidden, false);
  assert.match(document.querySelector("[data-selected-confidence]").textContent, /공식자료 확인/);
});

test("search and selected data are rendered as text, source links allow only HTTPS", () => {
  const { document, window } = createControls({
    buildings: [{ id: "unsafe", name: "<img src=x onerror=alert(1)>", number: "1" }],
    evidence: { sources: [{ title: "<script>bad()</script>", url: "javascript:alert(1)" }, { title: "공식 안내", url: "https://www.hs.ac.kr/" }] }
  });
  assert.equal(document.querySelector(".site-building-list img"), null);
  assert.equal(document.querySelector("[data-source-list] script"), null);
  assert.equal(document.querySelectorAll("[data-source-list] a").length, 1);
  assert.equal(window.CampusSiteControls.safeSourceUrl("http://example.com/"), null);
});

test("view, zoom, rotation and layer actions use controller contract", () => {
  const { document, window, controls, actions } = createControls();
  controls.update({ status: "ready", view: "top", layers: { trees: false } });
  assert.equal(document.querySelector("[data-view=top]").getAttribute("aria-pressed"), "true");
  document.querySelector("[data-view=free]").click();
  document.querySelector("[data-action=zoom-in]").click();
  document.querySelector("[data-action=rotate-left]").click();
  const boundary = document.querySelector("[data-layer=boundary]");
  boundary.checked = false;
  boundary.dispatchEvent(new window.Event("change"));
  assert.deepEqual(actions.map((item) => item.action), ["view", "zoom", "rotate", "toggle"]);
  assert.equal(actions[0].payload.view, "free");
  assert.equal(actions[1].payload.direction, 1);
  assert.equal(actions[3].payload.layer, "boundary");
  assert.equal(actions[3].payload.enabled, false);
});

test("dynamic scale, true north direction and exaggerated height have visible state", () => {
  const { document, controls } = createControls();
  controls.update({ northDegrees: 62, scale: { meters: 50, pixels: 110, approximate: true }, exaggeration: 1.5 });
  assert.equal(document.getElementById("campusNorthNeedle").style.transform, "rotate(62deg)");
  assert.match(document.getElementById("campusNorth").getAttribute("aria-label"), /62도/);
  assert.equal(document.getElementById("campusScaleBar").style.width, "110px");
  assert.match(document.getElementById("campusScaleLabel").textContent, /50 m · 화면 중심/);
  assert.equal(document.getElementById("campusExaggerationValue").textContent, "1.5배");
  controls.update({ scale: { meters: 0, pixels: 0 } });
  assert.equal(document.getElementById("campusScale").hidden, true);
});

test("WebGL failure preserves text building list and interior action with retry", () => {
  const { document, controls, actions } = createControls();
  controls.setStatus("error", "WebGL을 사용할 수 없습니다.");
  assert.equal(document.getElementById("campusRetry").hidden, false);
  assert.equal(document.querySelector("[data-view=overview]").disabled, true);
  document.querySelector(".site-building-list button").click();
  assert.equal(document.querySelector("[data-action=interior]").disabled, false);
  document.querySelector("[data-action=interior]").click();
  document.getElementById("campusRetry").click();
  assert.deepEqual(actions.map((item) => item.action), ["select", "interior", "retry"]);
});

test("reinitialization removes previous event listeners", () => {
  const { window, document, controls, actions } = createControls();
  controls.destroy();
  const secondActions = [];
  const second = window.CampusSiteControls.initialize({ buildings, onAction: (action) => secondActions.push(action), status: "ready" });
  document.querySelector("[data-action=zoom-in]").click();
  assert.equal(actions.length, 0);
  assert.deepEqual(secondActions, ["zoom"]);
  second.destroy();
});

test("fallback notice can be dismissed for text navigation while retry remains available", () => {
  const { document, controls, actions } = createControls();
  controls.setStatus("error", "WebGL을 사용할 수 없습니다.");
  document.getElementById("campusFallbackDismiss").click();
  assert.equal(document.getElementById("campusLoadStatus").hidden, true);
  assert.equal(document.activeElement.id, "campusBuildingSearch");
  controls.update({ status: "error" });
  assert.equal(document.getElementById("campusLoadStatus").hidden, true);
  const retry = document.querySelector(".site-inline-retry");
  assert.equal(retry.hidden, false);
  assert.equal(retry.disabled, false);
  retry.click();
  assert.equal(actions[0].action, "retry");
  controls.setStatus("loading");
  assert.equal(document.getElementById("campusLoadStatus").hidden, false);
});

function createInterior() {
  const dom = new JSDOM(documentMarkup, { runScripts: "outside-only" });
  dom.window.eval(hudSource);
  const controller = dom.window.CampusHud.createTextInteriorController();
  const data = { id: "test-interior", title: "테스트 건물 내부", floors: ["1F", "2F"], zones: [{ id: "entry", label: "입구", floor: "1F", kind: "entry", x: 10, y: 10, w: 30, h: 30 }], confirmed: ["출입 기능 확인"], rooms: [], note: "추정 평면", source: "공개자료" };
  controller.registerInterior(null, data, null);
  return { dom, document: dom.window.document, window: dom.window, controller, data };
}

test("interior opens as a modal, restores focus and scene context when closed", () => {
  const { document, controller } = createInterior();
  const trigger = document.getElementById("campusRetry");
  trigger.hidden = false;
  trigger.focus();
  const events = [];
  controller.setLifecycle({ capture: () => "previous-view", restore: (saved) => events.push(saved), onOpen: (id) => events.push(id) });
  assert.equal(controller.openInterior("test"), true);
  const panel = document.getElementById("buildingDetail");
  assert.equal(panel.getAttribute("aria-modal"), "true");
  assert.equal(document.activeElement.className, "detail-close");
  assert.equal(document.getElementById("siteControls").inert, true);
  controller.hide();
  assert.equal(panel.hidden, true);
  assert.equal(document.activeElement, trigger);
  assert.equal(document.getElementById("siteControls").inert, false);
  assert.deepEqual(events, ["test", "previous-view"]);
});

test("floor tabs support arrow navigation and panel semantics; Escape restores background", () => {
  const { document, window, controller } = createInterior();
  controller.openInterior("test-interior");
  const tab = document.querySelector("[role=tab]");
  tab.focus();
  tab.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.equal(document.activeElement.getAttribute("aria-selected"), "true");
  assert.equal(document.activeElement.dataset.floorTarget, "2F");
  assert.equal(document.querySelector("[role=tabpanel]:not([hidden])").dataset.floorLayer, "2F");
  document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(document.getElementById("buildingDetail").hidden, true);
});

test("modal focus trap wraps to close button instead of reaching canvas", () => {
  const { document, window, controller } = createInterior();
  controller.openInterior("test");
  const close = document.querySelector(".detail-close");
  close.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }));
  assert.equal(document.activeElement.getAttribute("role"), "tabpanel");
  document.activeElement.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }));
  assert.equal(document.activeElement, close);
});

test("camera snapshot is captured before building focus and restored after detail", () => {
  const { document, controller, data } = createInterior();
  let view = "overview";
  controller.setLifecycle({ capture: () => view, restore: (saved) => { view = saved; } });
  controller.registerInterior(null, data, () => { view = "building"; }, "building");
  controller.openInterior("building");
  assert.equal(view, "building");
  document.querySelector(".detail-close").click();
  assert.equal(view, "overview");
});
