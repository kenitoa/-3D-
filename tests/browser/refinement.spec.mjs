/* global window, document */
import { test, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const refField = (page, name) => page.locator(`#campusRefinement [data-ref-field="${name}"]`);
const refOutput = (page, name) => page.locator(`#campusRefinement [data-ref-output="${name}"]`);
const refCommand = (page, name) => page.locator(`#campusRefinement [data-ref-command="${name}"]`);
async function open(locator) { const details = locator.locator("xpath=ancestor::details[1]"); if (await details.count() && !await details.evaluate((element) => element.open)) await details.locator("summary").click(); await locator.scrollIntoViewIfNeeded(); }
async function ready(page) { await page.goto("/"); await page.waitForFunction(() => window.CampusApp?.ready && window.CampusApp.scene?.getFrameId() > 2); await expect(page.locator("#campusRefinement")).toBeAttached(); const toggle = page.locator(".site-panel-toggle"); if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click(); }
function trackErrors(page) { const errors = []; page.on("pageerror", (error) => errors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); }); return errors; }
async function evidence(page, info, name, region = page) { await mkdir(resolve("evidence/screenshots"), { recursive: true }); const path = resolve("evidence/screenshots", `${info.project.name}-${name}.png`); await region.screenshot({ path, animations: "disabled" }); await info.attach(name, { path, contentType: "image/png" }); }

test("3D refinement connects purpose, camera, hierarchy, measured values and versioned sharing", async ({ page }, info) => {
  test.setTimeout(180000); const errors = trackErrors(page); await ready(page); await evidence(page, info, "refinement-default");
  await open(refField(page, "purpose")); await refField(page, "purpose").selectOption("visitor"); await refCommand(page, "purpose").click(); await expect(refOutput(page, "purpose")).toContainText("신분을 추정하지");
  const before = await page.evaluate(() => window.CampusApp.scene.activeCamera.radius); await page.locator('[data-ref-camera="zoom-in"]').click(); await expect.poll(() => page.evaluate(() => window.CampusApp.scene.activeCamera.radius)).toBeLessThan(before);
  await refField(page, "reduced-motion").check(); const move = page.locator('[data-ref-camera="move-north"]'); await move.focus(); const northBefore = await page.evaluate(() => window.CampusApp.scene.activeCamera.target.z); await move.press("ArrowUp"); await expect.poll(() => page.evaluate(() => window.CampusApp.scene.activeCamera.target.z)).not.toBe(northBefore);
  const query = page.locator('#campusPlatform [data-field="query"]'); await open(query); await query.fill("장공관"); await query.press("Enter"); await page.locator('#campusPlatform [data-output="search-results"] [data-space-id="hanshin-gg:building:janggong"]').click(); await expect(refOutput(page, "breadcrumb")).toContainText("장공관");
  await open(refOutput(page, "legend")); await expect(refOutput(page, "legend").locator('[data-boundary-kind="legal"]')).toContainText("자료 미확보"); await expect(refOutput(page, "claims")).toContainText("높이:");
  await open(refField(page, "measure-points")); await refField(page, "measure-points").fill("0,0,0\n3,4,12"); await refField(page, "measure-points").press("Tab"); await page.locator('#campusRefinement [data-ref-form="measure"] button[type="submit"]').click(); await expect(refOutput(page, "measure")).toContainText("약 5m"); await expect(refOutput(page, "measure")).toContainText("측량 오차 미확인");
  await open(refField(page, "helper-query")); await refField(page, "helper-query").fill("도서관"); await page.locator('#campusRefinement [data-ref-form="helper"] button[type="submit"]').click(); await expect(refOutput(page, "helper")).toContainText("경삼관"); await expect(refOutput(page, "helper")).toContainText("운영 unverified");
  const share = page.locator('#campusPlatform [data-command="share"]'); await open(share); await share.click(); const url = await page.locator('#campusPlatform [data-field="share-url"]').inputValue(); expect(new URL(url).searchParams.get("contentVersion")).toBeTruthy(); expect(decodeURIComponent(new URL(url).hash)).toContain("contentVersion=");
  await open(refField(page, "ar-anchor")); await expect(refCommand(page, "ar-start")).toBeDisabled(); await expect(refOutput(page, "xr")).toContainText("등록되지");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); expect(overflow).toBe(false); await evidence(page, info, "refinement-public"); await page.locator(".site-panel-toggle").click(); await evidence(page, info, "refinement-view"); expect(errors).toEqual([]);
});

test("administrator compares actual local GLB scenes and edits only a validated draft", async ({ page }, info) => {
  test.setTimeout(180000); const errors = trackErrors(page), remote = [], violations = [];
  page.on("request", (request) => { if (new URL(request.url()).origin !== "http://127.0.0.1:8767") remote.push(request.url()); }); await page.goto("/admin.html");
  await page.locator("#adminUsername").fill("editor"); await page.locator("#adminPassword").fill("CampusFixture!2026"); await page.locator("#adminLoginForm button[type=submit]").click(); await expect(page.locator("#adminWorkspace")).toBeVisible(); await page.locator("#adminUseCurrent").click();
  const review = page.locator("#adminSpatialReview"); await expect(review).toBeVisible(); await review.locator('[data-review-command="load"]').click(); await review.locator('[data-review-field="entity"]').selectOption("hanshin-gg:building:janggong");
  const oldEast = Number(await review.locator('[data-review-field="east"]').inputValue()); await review.locator('[data-review-field="east"]').fill(String(oldEast + 1)); await review.locator('[data-review-command="apply"]').click(); await expect(review.locator('[data-review-output="status"]')).toContainText("초안에");
  const draftEast = await page.locator("#adminCatalog").evaluate((element) => JSON.parse(element.value).entities.find((item) => item.id === "hanshin-gg:building:janggong").position.east); expect(draftEast).toBe(oldEast + 1); await review.locator('[data-review-command="undo"]').click();
  await page.evaluate(() => { window.refinementPolicyViolations = []; document.addEventListener("securitypolicyviolation", (event) => window.refinementPolicyViolations.push(event.violatedDirective)); });
  const audit = JSON.parse(await readFile(resolve("evidence/refinement-asset-audit.json"), "utf8"));
  const overview = audit.models.find((model) => model.id === "janggong").overview;
  const payload = { name: "private-review.glb", mimeType: "model/gltf-binary", buffer: await readFile(resolve(overview.source)) }; await review.locator('[data-review-field="glb-previous"]').setInputFiles(payload); await review.locator('[data-review-field="glb-incoming"]').setInputFiles(payload); await review.locator('[data-review-field="view"]').selectOption("isometric");
  await expect.poll(() => page.evaluate(() => window.BABYLON.EngineStore.Instances.flatMap((engine) => engine.scenes).filter((scene) => scene.meshes.some((mesh) => mesh.getTotalVertices() > 3)).length)).toBe(2);
  await expect(review.locator('[data-review-stats="incoming"]')).toContainText(`triangles${overview.statistics.triangles}`); const cameras = await page.evaluate(() => window.BABYLON.EngineStore.Instances.flatMap((engine) => engine.scenes).map((scene) => ({ alpha: scene.activeCamera.alpha, beta: scene.activeCamera.beta, radius: scene.activeCamera.radius, target: scene.activeCamera.target.asArray() }))); expect(cameras[0]).toEqual(cameras[1]);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('[data-review-canvas]')].every((canvas) => {
    const copy = document.createElement("canvas"); copy.width = canvas.width; copy.height = canvas.height; const context = copy.getContext("2d"); context.drawImage(canvas, 0, 0); const pixels = context.getImageData(0, 0, copy.width, copy.height).data;
    let samples = 0, visible = 0; for (let index = 0; index < pixels.length; index += 16) { samples++; if (Math.abs(pixels[index] - 232) + Math.abs(pixels[index + 1] - 237) + Math.abs(pixels[index + 2] - 222) > 25) visible++; }
    return visible > 50 && visible / samples > .01;
  }))).toBe(true);
  await evidence(page, info, "refinement-admin-glb", review.locator(".admin-review-canvases")); violations.push(...await page.evaluate(() => window.refinementPolicyViolations)); expect(violations).toEqual([]); expect(remote).toEqual([]); expect(errors).toEqual([]);
  await page.locator("#adminLogout").click(); await expect(page.locator("#adminWorkspace")).toBeHidden(); await expect(review.locator('[data-review-stats="incoming"]')).toBeEmpty(); expect(await page.evaluate(() => window.BABYLON.EngineStore.Instances.length)).toBe(0);
});
