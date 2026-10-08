/* global window, document, BABYLON, performance, HTMLCanvasElement */
import { test, expect } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const artifacts = resolve("evidence/screenshots");

function recordErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

async function ready(page) {
  await page.goto("/");
  await expect(page.locator("#siteControls")).toHaveAttribute("data-status", "ready");
  await expect(page.locator("#campusLoadStatus")).toBeHidden();
  await page.waitForFunction(() => window.CampusApp?.ready && window.CampusApp.scene?.getFrameId() > 2);
  await expect.poll(() => page.evaluate(() => window.CampusApp.models.size), {timeout:60_000}).toBe(16);
}

async function capture(page, testInfo, suffix) {
  await mkdir(artifacts, { recursive: true });
  const file = resolve(artifacts, `${testInfo.project.name}-${suffix}.png`);
  await page.screenshot({ path: file, animations: "disabled" });
  const image = await readFile(file);
  expect(image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
  expect(image.length).toBeGreaterThan(10_000);
  await testInfo.attach(suffix, { path: file, contentType: "image/png" });
}

async function assertBoundaryFits(page) {
  const projected = await page.evaluate(() => {
    const { scene, site } = window.CampusApp;
    const engine = scene.getEngine();
    const camera = scene.activeCamera;
    const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
    const canvas = engine.getRenderingCanvas().getBoundingClientRect();
    const points = window.SitePlanData.boundaries.campusMapped.pointsMeters.map((point) => {
      const [x, z] = site.worldPoint(point);
      const screen = BABYLON.Vector3.Project(new BABYLON.Vector3(x, site.terrainHeightAt(x, z), z), BABYLON.Matrix.Identity(), scene.getTransformMatrix(), viewport);
      return { x: screen.x * canvas.width / engine.getRenderWidth() + canvas.left, y: screen.y * canvas.height / engine.getRenderHeight() + canvas.top, depth: screen.z };
    });
    const sidebar = document.getElementById("siteControls").getBoundingClientRect();
    const toolsExpanded = document.querySelector(".site-panel-toggle")?.getAttribute("aria-expanded") === "true";
    return { points, width: canvas.width, height: canvas.height, sidebar: { left: sidebar.left, top: sidebar.top, right: sidebar.right, bottom: sidebar.bottom }, toolsExpanded };
  });
  expect(projected.points.length).toBeGreaterThan(3);
  for (const point of projected.points) {
    expect(point.x).toBeGreaterThanOrEqual(5);
    expect(point.x).toBeLessThanOrEqual(projected.width - 5);
    expect(point.y).toBeGreaterThanOrEqual(5);
    expect(point.y).toBeLessThanOrEqual(projected.height - 5);
    expect(point.depth).toBeGreaterThan(0);
    expect(point.depth).toBeLessThan(1);
    const obscured = point.x >= projected.sidebar.left && point.x <= projected.sidebar.right && point.y >= projected.sidebar.top && point.y <= projected.sidebar.bottom;
    expect(obscured, `Boundary point (${Math.round(point.x)}, ${Math.round(point.y)}) is covered by the exploration panel`).toBe(false);
  }
  return projected;
}

async function settleCamera(page) {
  await page.evaluate(() => new Promise((resolveFrame) => {
    let frames = 0;
    const scene = window.CampusApp.scene;
    const observer = scene.onAfterRenderObservable.add(() => {
      if (++frames >= 3) { scene.onAfterRenderObservable.remove(observer); resolveFrame(); }
    });
  }));
}

async function assertTerrainHasColor(page) {
  const observation = await page.evaluate(() => {
    const { scene, site } = window.CampusApp;
    const source = scene.getEngine().getRenderingCanvas();
    const viewport = scene.activeCamera.viewport.toGlobal(source.width, source.height);
    const polygon = window.SitePlanData.boundaries.campusMapped.pointsMeters.map((point) => {
      const [x, z] = site.worldPoint(point);
      const projected = BABYLON.Vector3.Project(new BABYLON.Vector3(x, site.terrainHeightAt(x, z), z), BABYLON.Matrix.Identity(), scene.getTransformMatrix(), viewport);
      return [projected.x, projected.y];
    });
    const copy = document.createElement("canvas");
    copy.width = source.width; copy.height = source.height;
    const context = copy.getContext("2d");
    context.drawImage(source, 0, 0);
    const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    let samples = 0;
    let nearlyBlack = 0;
    let nearlyWhite = 0;
    for (let y = 0; y < copy.height; y += 8) {
      for (let x = 0; x < copy.width; x += 8) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
          const [ax, ay] = polygon[i]; const [bx, by] = polygon[j];
          if (((ay > y) !== (by > y)) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
        }
        if (!inside) continue;
        const index = (y * copy.width + x) * 4;
        samples += 1;
        if (pixels[index] < 10 && pixels[index + 1] < 10 && pixels[index + 2] < 10) nearlyBlack += 1;
        if (pixels[index] > 245 && pixels[index + 1] > 245 && pixels[index + 2] > 245) nearlyWhite += 1;
      }
    }
    return { samples, nearlyBlack, nearlyWhite, ratio: samples ? nearlyBlack / samples : 1, whiteRatio: samples ? nearlyWhite / samples : 1 };
  });
  expect(observation.samples).toBeGreaterThan(20);
  expect(observation.ratio, "Campus surfaces should retain their green/beige materials, not render as black polygons").toBeLessThan(0.35);
  expect(observation.whiteRatio, "Campus surfaces should remain distinguishable rather than clipping to pure white").toBeLessThan(0.35);
}

async function assertNorthAndEastDirections(page) {
  const bearings = await page.evaluate(() => {
    const { scene, site } = window.CampusApp;
    const camera = scene.activeCamera;
    const source = scene.getEngine().getRenderingCanvas();
    const viewport = camera.viewport.toGlobal(source.width, source.height);
    const center = camera.getTarget();
    const project = (vector) => BABYLON.Vector3.Project(vector, BABYLON.Matrix.Identity(), scene.getTransformMatrix(), viewport);
    const origin = project(center);
    const northPoint = project(new BABYLON.Vector3(center.x, center.y, center.z - 1));
    const eastPoint = project(new BABYLON.Vector3(center.x + 1, center.y, center.z));
    const north = { x: northPoint.x - origin.x, y: northPoint.y - origin.y };
    const east = { x: eastPoint.x - origin.x, y: eastPoint.y - origin.y };
    const clockwiseDot = east.x * -north.y + east.y * north.x;
    const actualNorthDegrees = Math.atan2(north.x, -north.y) * 180 / Math.PI;
    const shownNorthDegrees = site.cameraController.getNorthRotation() * 180 / Math.PI;
    const difference = ((actualNorthDegrees - shownNorthDegrees + 540) % 360) - 180;
    return { clockwiseDot, actualNorthDegrees, shownNorthDegrees, difference };
  });
  expect(bearings.clockwiseDot, "East must appear clockwise from north; a mirrored map changes campus orientation").toBeGreaterThan(0);
  expect(Math.abs(bearings.difference), "Compass must follow projected world north").toBeLessThan(2);
}

test("complete campus overview, map views, search, layers, interiors and exported image", async ({ page }, testInfo) => {
  const errors = recordErrors(page);
  await ready(page);
  const diagnostics = await page.evaluate(() => window.CampusApp.site.getDiagnostics());
  expect(diagnostics.errors).toEqual([]);
  expect(diagnostics.boundaryAreaMeters2).toBeGreaterThan(10_000);
  expect(diagnostics.legalBoundaryAvailable).toBe(false);
  const models = await page.evaluate(() => window.CampusApp.models.size);
  expect(models).toBe(16);
  await assertBoundaryFits(page);
  await assertTerrainHasColor(page);
  await capture(page, testInfo, "overview");

  const toolsToggle = page.getByRole("button", { name: /캠퍼스 탐색/ });
  if (await toolsToggle.getAttribute("aria-expanded") !== "true") await toolsToggle.click();
  await page.getByRole("button", { name: "위에서 보기", exact: true }).click();
  if (testInfo.project.name === "mobile") await toolsToggle.click();
  await expect(page.locator("[data-current-view]")).toHaveText("위에서 보기");
  await settleCamera(page);
  await assertBoundaryFits(page);
  await assertTerrainHasColor(page);
  await expect(page.locator("#campusScale")).toBeVisible();
  await assertNorthAndEastDirections(page);
  await expect(page.locator("#campusScaleLabel")).toContainText(/m|km/);
  await capture(page, testInfo, "top");

  if (await toolsToggle.getAttribute("aria-expanded") !== "true") await toolsToggle.click();
  const search = page.getByRole("searchbox", { name: "건물 이름·번호 검색" });
  await search.fill("실습동");
  const result = page.locator(".site-building-list button");
  await expect(result).toHaveCount(1);
  await search.press("ArrowDown");
  await expect(result).toBeFocused();
  await result.press("Enter");
  await expect(page.locator("#selectedBuildingName")).toContainText(/산학관|실습동/);
  await expect(page.locator("[data-current-view]")).toHaveText("전체 조감도");
  await expect(page.locator("[data-selected-confidence]")).toContainText(/확인|지도|추정/);
  const selectedContext = await page.evaluate(() => window.CampusApp.site.cameraController.capture());
  await page.getByRole("button", { name: "건물 내부 상세 보기" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "상세 화면 닫기" })).toBeFocused();
  const tabs = dialog.getByRole("tab");
  if (await tabs.count() > 1) {
    await tabs.first().focus();
    await tabs.first().press("ArrowRight");
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await expect(tabs.nth(1)).toBeFocused();
  }
  await capture(page, testInfo, "interior");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "건물 내부 상세 보기" })).toBeFocused();
  const restoredContext = await page.evaluate(() => window.CampusApp.site.cameraController.capture());
  expect(restoredContext.view).toBe(selectedContext.view);
  expect(restoredContext.radius).toBeCloseTo(selectedContext.radius, 6);
  expect(restoredContext.target).toEqual(selectedContext.target);

  await page.getByText("표시 설정", { exact: true }).click();
  await page.locator('input[data-layer="boundary"]').uncheck();
  expect(await page.evaluate(() => window.CampusApp.site.layers.boundary.every((mesh) => !mesh.isEnabled()))).toBe(true);
  await page.locator('input[data-layer="boundary"]').check();
  await page.locator('input[data-layer="trees"]').uncheck();
  expect(await page.evaluate(() => window.CampusApp.site.layers.trees.length > 0 && window.CampusApp.site.layers.trees.every((mesh) => !mesh.isEnabled()))).toBe(true);
  await page.locator('input[data-layer="trees"]').check();
  await page.locator('input[data-layer="labels"]').uncheck();
  await expect(page.locator(".map-label:visible")).toHaveCount(0);
  await page.locator('input[data-layer="labels"]').check();
  await page.locator('input[data-layer="contours"]').check();
  expect(await page.evaluate(() => window.CampusApp.site.layers.contours.length > 0 && window.CampusApp.site.layers.contours.every((mesh) => mesh.isEnabled()))).toBe(true);
  const height = page.getByRole("slider", { name: /지형 높이/ });
  await height.focus();
  await height.press("Home");
  await height.press("ArrowRight");
  await height.press("ArrowRight");
  await expect(page.locator("#campusExaggerationValue")).toHaveText("1.5배");
  expect(await page.evaluate(() => window.CampusApp.site.getDiagnostics().verticalExaggeration)).toBe(1.5);
  await height.press("Home");
  await page.locator('input[data-layer="contours"]').uncheck();
  await page.getByRole("button", { name: "전체 보기", exact: true }).click();
  await settleCamera(page);

  const downloadPromise = page.waitForEvent("download");
  const exportViewport = await page.evaluate(() => {
    const app = window.CampusApp;
    const canvas = app.engine.getRenderingCanvas();
    const viewport = app.scene.activeCamera.viewport.toGlobal(canvas.width, canvas.height);
    return { width: Math.round(viewport.width), height: Math.round(viewport.height) };
  });
  await page.getByRole("button", { name: "현재 조감도 이미지 저장" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const downloadedPath = await download.path();
  await download.saveAs(resolve(artifacts, `${testInfo.project.name}-export.png`));
  const image = await readFile(downloadedPath);
  expect(image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
  expect(image.length).toBeGreaterThan(10_000);
  expect(image.readUInt32BE(16), "PNG crops out the control-panel margins").toBe(exportViewport.width);
  expect(image.readUInt32BE(20), "PNG reserves room for attribution and boundary confidence text").toBeGreaterThan(exportViewport.height + 60);
  expect(image.readUInt32BE(20)).toBeLessThan(exportViewport.height + 400);
  await expect(page.locator("[data-export-status]")).toContainText(/저장|다운로드/);

  // Record an observed software-renderer sample without treating it as a device benchmark.
  const performanceSample = await page.evaluate(() => new Promise((resolveSample) => {
    const scene = window.CampusApp.scene;
    const start = performance.now();
    const initialFrame = scene.getFrameId();
    const observer = scene.onAfterRenderObservable.add(() => {
      const elapsedMs = performance.now() - start;
      if (elapsedMs >= 500) {
        scene.onAfterRenderObservable.remove(observer);
        resolveSample({ elapsedMs, renderedFrames: scene.getFrameId() - initialFrame, meshCount: scene.meshes.length, renderer: scene.getEngine().getGlInfo().renderer, evidenceLimit: "Headless Chromium software rendering; not a real device performance guarantee." });
      }
    });
  }));
  expect(performanceSample.renderedFrames).toBeGreaterThan(0);
  await writeFile(resolve(artifacts, `${testInfo.project.name}-render-observation.json`), `${JSON.stringify(performanceSample, null, 2)}\n`);
  expect(errors).toEqual([]);
});

test("local file delivery works offline with packaged runtime dependencies", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The same packaged files are shared by both viewports.");
  const errors = recordErrors(page);
  const remoteRequests = [];
  page.on("request", (request) => {
    if (/^https?:/.test(request.url())) remoteRequests.push(request.url());
  });
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(resolve("index.html")).href);
  await expect(page.locator("#siteControls")).toHaveAttribute("data-status", "ready");
  await expect(page.locator("#campusLoadStatus")).toBeHidden();
  await expect(page.locator(".site-building-list button")).toHaveCount(16);
  expect(remoteRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("entrance, perimeter and responsive canvas remain usable", async ({ page }, testInfo) => {
  const errors = recordErrors(page);
  await ready(page);
  if (testInfo.project.name === "mobile") {
    const toggle = page.getByRole("button", { name: /캠퍼스 탐색/ });
    if (await toggle.getAttribute("aria-expanded") === "true") await toggle.click();
    await expect(page.locator("#campusTools")).toBeHidden();
    await capture(page, testInfo, "overview-tools-closed");
  }
  const focused = await page.evaluate(() => {
    const { site } = window.CampusApp;
    const entry = window.SitePlanData.features.entrances?.find((feature) => feature.kind === "campus-entrance" && feature.name === "정문") || window.SitePlanData.features.entrances?.[0];
    const orbit = site.cameraController.orbit;
    if (!entry) return false;
    const point = entry.anchorMeters || entry.pointsMeters?.[0];
    if (!point) return false;
    const [x, z] = site.worldPoint(point);
    site.cameraController.setView("overview");
    orbit.setTarget(new BABYLON.Vector3(x, site.terrainHeightAt(x, z) + 0.3, z));
    orbit.radius = 18;
    return true;
  });
  expect(focused).toBe(true);
  await settleCamera(page);
  await capture(page, testInfo, "entry");
  await page.evaluate(() => {
    const { site } = window.CampusApp;
    const point = window.SitePlanData.boundaries.campusMapped.pointsMeters[0];
    const [x, z] = site.worldPoint(point);
    const orbit = site.cameraController.orbit;
    orbit.setTarget(new BABYLON.Vector3(x, site.terrainHeightAt(x, z) + 0.3, z));
    orbit.radius = 22;
  });
  await settleCamera(page);
  await capture(page, testInfo, "perimeter");
  await page.evaluate(() => window.CampusApp.site.cameraController.reset());
  await settleCamera(page);
  await assertBoundaryFits(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("WebGL unavailable provides text buildings, source information and interior details", async ({ page }, testInfo) => {
  const errors = recordErrors(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContext(type, ...args) {
      if (String(type).includes("webgl")) return null;
      return original.call(this, type, ...args);
    };
  });
  await page.goto("/");
  await expect(page.locator("#siteControls")).toHaveAttribute("data-status", "error");
  await expect(page.getByRole("heading", { name: "3D 화면을 표시하지 못했습니다" })).toBeVisible();
  await expect(page.getByRole("button", { name: "3D 화면 다시 시도" })).toBeVisible();
  await page.getByRole("button", { name: "건물 목록으로 확인", exact: true }).click();
  await expect(page.locator("#campusLoadStatus")).toBeHidden();
  await expect(page.getByRole("button", { name: "3D 다시 시도", exact: true })).toBeVisible();
  const search = page.getByRole("searchbox", { name: "건물 이름·번호 검색" });
  await search.fill("경삼관");
  await search.press("Enter");
  await expect(page.locator("#selectedBuildingName")).toContainText("경삼관");
  await page.getByRole("button", { name: "건물 내부 상세 보기" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByText("자료·부지 확인 수준", { exact: true }).click();
  await expect(page.locator("[data-boundary-note]")).toContainText(/소유|법적/);
  await capture(page, testInfo, "webgl-fallback");
  expect(errors.filter((message) => !/^Campus initialization failed WebGL is unavailable$/.test(message))).toEqual([]);
});
