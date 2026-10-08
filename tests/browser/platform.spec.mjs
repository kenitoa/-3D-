/* global window, document */
import { test, expect } from "@playwright/test";
import { decodeQR } from "qr/decode.js";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const platform = "#campusPlatform";
const buildingId = "hanshin-gg:building:practice";
const password = "CampusFixture!2026";
const field = (page, name) => page.locator(`${platform} [data-field="${name}"]`);
const output = (page, name) => page.locator(`${platform} [data-output="${name}"]`);
const command = (page, name) => page.locator(`${platform} [data-command="${name}"]`);

function errorsFor(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  return errors;
}

async function openSection(locator) {
  const section = locator.locator("xpath=ancestor::details[1]");
  if (await section.count() && !await section.evaluate((element) => element.open)) await section.locator("summary").first().click();
  await locator.scrollIntoViewIfNeeded();
}

async function ready(page, url = "/") {
  await page.goto(url);
  await expect(page.locator("#siteControls")).toHaveAttribute("data-status", "ready");
  await page.waitForFunction(() => window.CampusApp?.ready && window.CampusApp.scene?.getFrameId() > 2);
  await expect(page.locator(platform)).toBeAttached();
  const panel = page.locator(".site-panel-toggle");
  if (await panel.getAttribute("aria-expanded") === "false") await panel.click();
}

async function cameraSettled(page) {
  await page.evaluate(() => new Promise((done) => {
    let count = 0;
    const scene = window.CampusApp.scene;
    const observer = scene.onAfterRenderObservable.add(() => { if (++count === 3) { scene.onAfterRenderObservable.remove(observer); done(); } });
  }));
}

async function screenshot(page, info, name) {
  const folder = resolve("evidence/screenshots");
  await mkdir(folder, { recursive: true });
  const path = resolve(folder, `${info.project.name}-${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  const data = await readFile(path);
  expect(data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
  await info.attach(name, { path, contentType: "image/png" });
}

async function selectPractice(page) {
  await openSection(field(page, "query"));
  await field(page, "query").fill("실습동");
  await field(page, "query").press("Enter");
  const result = output(page, "search-results").locator("button[data-space-id]").first();
  await expect(result).toHaveAttribute("data-space-id", buildingId);
  await result.click();
  await expect(output(page, "selected")).toContainText("실습");
  await expect.poll(() => page.evaluate(() => window.CampusApp.getState().selectedId)).toBe(buildingId);
}

test("registered spaces, accessible alternatives, personal state, tour restoration and decodable sharing", async ({ page, browser }, info) => {
  test.setTimeout(180_000);
  const errors = errorsFor(page);
  await ready(page);
  await selectPractice(page);
  await output(page, "selected").locator(`[data-favorite-id="${buildingId}"]`).click();

  await field(page, "query").fill("");
  await field(page, "building").selectOption("hanshin-gg:building:gyeongsam");
  const floorId = "hanshin-gg:building:gyeongsam:floor:2f";
  await field(page, "floor").selectOption(floorId);
  const floorResults = await output(page, "search-results").locator("[data-space-id]").evaluateAll((buttons) => buttons.map((button) => button.dataset.spaceId));
  expect(floorResults).toContain(floorId);
  expect(floorResults).not.toContain(buildingId);
  await output(page, "search-results").locator(`[data-space-id="${floorId}"]`).click();
  await expect(page.locator("#buildingDetail")).toBeVisible();
  await expect(page.locator('#buildingDetail [data-floor-target="2F"]')).toHaveAttribute("aria-selected", "true");
  await expect.poll(() => page.evaluate(() => window.CampusApp.getState().selectedId)).toBe(floorId);
  await page.keyboard.press("Escape");
  await expect(page.locator("#buildingDetail")).toBeHidden();

  await openSection(field(page, "from"));
  await field(page, "from").selectOption("hanshin-gg:building:janggong");
  await field(page, "to").selectOption(buildingId);
  await field(page, "accessible").check();
  await page.locator(`${platform} [data-form="route"] button[type="submit"]`).click();
  await expect(output(page, "route")).toContainText("현장 검토한 경로 자료가 없습니다");
  await expect(output(page, "route-steps").locator("li")).toHaveCount(0);
  const mockPosition = await page.evaluate(() => {
    const origin = window.SitePlanData.projection.origin, [east, north] = window.SitePlanData.features.buildings.find((entry) => entry.id === "janggong").anchorMeters;
    const radians = Math.PI / 180, weight = Math.sqrt(1 - 6.6943799901413165e-3 * Math.sin(origin.lat * radians) ** 2);
    return { latitude: origin.lat + north / (6378137 * (1 - 6.6943799901413165e-3) / weight ** 3) / radians, longitude: origin.lon + east / (6378137 / weight * Math.cos(origin.lat * radians)) / radians, accuracy: 12 };
  });
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation(mockPosition);
  await command(page, "location").click();
  await expect.poll(() => page.evaluate(() => window.CampusApp.getLocationSnapshot()?.inside)).toBe(true);

  await openSection(command(page, "2d"));
  await command(page, "2d").click();
  const map = page.locator("#campusAlternativeMap");
  await expect(map).toBeVisible();
  await expect(map.locator("svg")).toBeVisible();
  await expect(map.locator(".platform-guide-boundary")).toHaveAttribute("fill-rule", "evenodd");
  await expect(map.locator(".platform-location-point")).toBeVisible();
  await expect(map.locator(".platform-location-accuracy")).toBeVisible();
  await map.locator(`[data-map-list] [data-space-id="${floorId}"]`).click();
  await expect(map.locator("[data-map-selected]")).toContainText("개념 평면");
  await expect(page.locator("#buildingDetail")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.CampusApp.getState().selectedId)).toBe(floorId);
  await screenshot(page, info, "platform-2d");
  await page.keyboard.press("Escape");
  await expect(map).toBeHidden();
  await expect(command(page, "2d")).toBeFocused();
  await command(page, "text").click();
  await expect(map).toHaveAttribute("data-mode", "text");
  await expect(map.locator("svg")).toBeHidden();
  await map.locator(`[data-map-list] [data-space-id="${buildingId}"]`).click();
  await expect(map.locator("[data-map-selected]")).toContainText("실습");
  await map.locator("[data-map-close]").click();

  await openSection(field(page, "schedule-title"));
  await expect(output(page, "favorites").locator(`[data-space-id="${buildingId}"]`)).toBeVisible();
  await field(page, "schedule-title").fill("캠퍼스 공간 확인");
  await field(page, "schedule-space").selectOption(buildingId);
  await field(page, "schedule-day").selectOption("1");
  await field(page, "schedule-time").fill("09:00");
  await field(page, "schedule-end").fill("10:00");
  await page.locator(`${platform} [data-form="schedule"] button[type="submit"]`).click();
  await expect(output(page, "timetable")).toContainText("09:00~10:00 · 캠퍼스 공간 확인");
  await screenshot(page, info, "platform-personal");
  await page.reload();
  await readyExisting(page);
  await openSection(field(page, "schedule-title"));
  await expect(output(page, "favorites").locator(`[data-space-id="${buildingId}"]`)).toBeVisible();
  await expect(output(page, "timetable")).toContainText("캠퍼스 공간 확인");

  await selectPractice(page);
  await cameraSettled(page);
  const beforeTour = await page.evaluate(() => window.CampusApp.getState());
  await openSection(command(page, "tour-start"));
  await command(page, "tour-start").click();
  await expect(output(page, "tour")).toContainText("1/16");
  await expect(command(page, "tour-prev")).toBeDisabled();
  await command(page, "tour-next").click();
  await expect(output(page, "tour")).toContainText("2/16");
  await command(page, "tour-prev").click();
  await expect(output(page, "tour")).toContainText("1/16");
  await command(page, "tour-stop").click();
  await cameraSettled(page);
  const restored = await page.evaluate(() => window.CampusApp.getState());
  expect(restored.selectedId).toBe(beforeTour.selectedId);
  expect(restored.view).toBe(beforeTour.view);
  expect(restored.camera.radius).toBeCloseTo(beforeTour.camera.radius, 6);
  expect(restored.camera.beta).toBeCloseTo(beforeTour.camera.beta, 6);
  restored.camera.target.forEach((value, index) => expect(value).toBeCloseTo(beforeTour.camera.target[index], 6));

  await openSection(command(page, "qr"));
  await command(page, "share").click();
  const sharedUrl = await field(page, "share-url").inputValue();
  expect(sharedUrl).toContain(encodeURIComponent(buildingId));
  expect(sharedUrl).not.toContain("캠퍼스 공간 확인");
  expect(sharedUrl).not.toContain("latitude");
  expect(sharedUrl).not.toContain("accuracy");
  await command(page, "qr").click();
  await expect(output(page, "qr")).toBeVisible();
  const image = await output(page, "qr").evaluate(async (element) => {
    await element.decode();
    const canvas = document.createElement("canvas"); canvas.width = element.naturalWidth; canvas.height = element.naturalHeight;
    const context = canvas.getContext("2d"); context.drawImage(element, 0, 0);
    return { width: canvas.width, height: canvas.height, data: Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data) };
  });
  expect(decodeQR({ width: image.width, height: image.height, data: new Uint8Array(image.data) }, { format: "RGBA", timeLimit: 1000 })).toBe(sharedUrl);
  await screenshot(page, info, "platform-share-qr");
  const isolated = await browser.newContext({ viewport: info.project.use.viewport, reducedMotion: "reduce" });
  try {
    const receiver = await isolated.newPage();
    const receiverErrors = errorsFor(receiver);
    await ready(receiver, sharedUrl);
    await expect.poll(() => receiver.evaluate(() => window.CampusApp.getState().selectedId)).toBe(buildingId);
    expect(await receiver.evaluate(() => window.localStorage.getItem("hanshin-campus-personal-v1"))).toBeNull();
    expect(receiverErrors).toEqual([]);
  } finally { await isolated.close(); }
  expect(errors).toEqual([]);
});

test("reviewer creates an operation, extends its period and cancels the same revisioned record", async ({ page }, info) => {
  test.skip(info.project.name !== "desktop", "Operating record mutation is covered once against the shared isolated fixture database.");
  const errors = errorsFor(page);
  await login(page, "reviewer");
  const times = await page.evaluate(() => {
    const format = (offset) => { const date = new Date(Date.now() + offset); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
    return { start: format(-60_000), end: format(3_600_000), extended: format(7_200_000) };
  });
  await page.locator("#adminOperationEntity").selectOption(buildingId);
  await page.locator("#adminOperationTitle").fill("격리 검증용 시설 점검");
  await page.locator("#adminOperationOwner").fill("브라우저 검증 담당");
  await page.locator("#adminOperationStatus").selectOption("closed");
  await page.locator("#adminOperationStart").fill(times.start);
  await page.locator("#adminOperationEnd").fill(times.end);
  await page.locator("#adminOperationSource").selectOption("hanshin-official-tour");
  const creation = page.waitForResponse((value) => value.url().endsWith("/api/v1/admin/operations") && value.request().method() === "POST");
  await page.locator("#adminSaveOperation").click();
  const createdResponse = await creation; expect(createdResponse.status()).toBe(201);
  const record = (await createdResponse.json()).data;
  expect(record.revision).toBe(1);
  const recordButton = page.locator(`[data-operation-edit="${record.id}"]`);
  await expect(recordButton).toBeVisible(); await recordButton.click();
  await expect(page.locator("#adminOperationInfo")).toContainText("revision 1");
  await expect(page.locator("#adminOperationTitle")).toHaveValue("격리 검증용 시설 점검");
  await page.locator("#adminOperationEnd").fill(times.extended);
  const extension = page.waitForResponse((value) => value.url().endsWith("/api/v1/admin/operations") && value.request().method() === "POST");
  await page.locator("#adminSaveOperation").click();
  const extendedResponse = await extension; expect(extendedResponse.status()).toBe(200);
  const extended = (await extendedResponse.json()).data; expect(extended.id).toBe(record.id); expect(extended.revision).toBe(2); expect(Date.parse(extended.endsAt)).toBeGreaterThan(Date.parse(record.endsAt));
  await expect(page.locator("#adminOperationInfo")).toContainText("revision 2");
  await page.locator("#adminOperationStatus").selectOption("cancelled");
  const cancellation = page.waitForResponse((value) => value.url().endsWith("/api/v1/admin/operations") && value.request().method() === "POST");
  await page.locator("#adminSaveOperation").click();
  const cancelledResponse = await cancellation; expect(cancelledResponse.status()).toBe(200);
  const cancelled = (await cancelledResponse.json()).data; expect(cancelled.id).toBe(record.id); expect(cancelled.revision).toBe(3); expect(cancelled.status).toBe("cancelled");
  await expect(page.locator("#adminOperationInfo")).toContainText("revision 3");
  await expect(page.locator("#adminOperations [data-operation-edit]")).toHaveCount(1);
  await screenshot(page, info, "admin-operation-cancelled");
  await page.locator("#adminNewOperation").click();
  await expect(page.locator("#adminOperationTitle")).toHaveValue("");
  await expect(page.locator("#adminOperationInfo")).toHaveText("새 운영 기록");
  expect(errors).toEqual([]);
});

async function readyExisting(page) {
  await expect(page.locator("#siteControls")).toHaveAttribute("data-status", "ready");
  await page.waitForFunction(() => window.CampusApp?.ready);
  const panel = page.locator(".site-panel-toggle");
  if (await panel.getAttribute("aria-expanded") === "false") await panel.click();
}

test("private photo report requires consent and receipt lookup returns the actual stored status", async ({ page }, info) => {
  const errors = errorsFor(page);
  await ready(page);
  await openSection(field(page, "report-description"));
  await field(page, "report-space").selectOption(buildingId);
  await field(page, "report-type").selectOption("map");
  await field(page, "report-description").fill(`브라우저 검증: ${info.project.name} 안내 표시 위치를 확인해 주세요.`);
  const imageData = await page.evaluate(() => { const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 24; const context = canvas.getContext("2d"); context.fillStyle = "#31593e"; context.fillRect(0, 0, 32, 24); return canvas.toDataURL("image/png").split(",")[1]; });
  await field(page, "report-photo").setInputFiles({ name: "campus-report.png", mimeType: "image/png", buffer: Buffer.from(imageData, "base64") });
  await expect(output(page, "photo")).toBeVisible();
  await page.locator(`${platform} [data-form="report"] button[type="submit"]`).click();
  await expect(output(page, "report")).toContainText("동의하거나 사진을 제거");
  await field(page, "photo-consent").check();
  const response = page.waitForResponse((value) => value.url().endsWith("/api/v1/reports") && value.request().method() === "POST");
  await page.locator(`${platform} [data-form="report"] button[type="submit"]`).click();
  expect((await response).status()).toBe(201);
  await expect(field(page, "receipt-id")).not.toHaveValue("");
  await expect(field(page, "receipt-token")).not.toHaveValue("");
  const receipt = { id: await field(page, "receipt-id").inputValue(), token: await field(page, "receipt-token").inputValue() };
  await expect(output(page, "report")).toContainText("검토 전에는 지도에 공개되지 않습니다");
  const receiptLookup = page.waitForResponse((value) => value.url().endsWith(`/api/v1/reports/${receipt.id}`) && value.request().method() === "GET");
  await page.locator(`${platform} [data-form="receipt"] button[type="submit"]`).click();
  const receiptResponse = await receiptLookup; expect(receiptResponse.status()).toBe(200);
  expect((await receiptResponse.json()).data.status).toBe("received");
  await expect(output(page, "receipt")).toContainText("접수");
  const persisted = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(window.localStorage))));
  expect(persisted).not.toContain(receipt.token);
  expect(page.url()).not.toContain(receipt.token);
  await expect(output(page, "photo")).toBeHidden();
  await screenshot(page, info, "platform-report-receipt");
  expect(errors).toEqual([]);
});

async function login(page, username) {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/admin.html");
  await expect(page.locator("#adminLogin")).toBeVisible();
  await page.locator("#adminUsername").fill(username);
  await page.locator("#adminPassword").fill(password);
  await page.locator("#adminLoginForm button[type=submit]").click();
  await expect(page.locator("#adminWorkspace")).toBeVisible();
  await expect(page.locator("#adminIdentity")).toContainText(username);
  await expect(page.locator("#adminMessage")).toHaveAttribute("data-error", "false");
  await expect(page.locator("#adminMessage")).toContainText("최신 상태를 확인했습니다");
}

test("editor submits a versioned draft and a different reviewer approves and publishes it", async ({ browser, page }, info) => {
  test.setTimeout(180_000);
  test.skip(info.project.name !== "desktop", "One shared database publication verifies both roles; avoid duplicate mobile mutation.");
  const editorContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const reviewerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  try {
    const editor = await editorContext.newPage(), reviewer = await reviewerContext.newPage();
    const editorErrors = errorsFor(editor), reviewerErrors = errorsFor(reviewer), publicErrors = errorsFor(page);
    await login(editor, "editor");
    await expect(editor.locator("[data-draft-action=approve]")).toBeDisabled();
    await expect(editor.locator("#adminSaveOperation")).toBeDisabled();
    await editor.locator("#adminUseCurrent").click();
    const catalog = JSON.parse(await editor.locator("#adminCatalog").inputValue());
    const marker = `브라우저 검증 ${Date.now()}`;
    const version = `browser-${Date.now()}`;
    catalog.contentVersion = version; catalog.datasetVersion = version;
    const target = catalog.entities.find((entity) => entity.id === buildingId);
    target.aliases = [...(target.aliases || []), marker];
    await editor.locator("#adminCatalog").fill(JSON.stringify(catalog));
    await editor.locator("#adminDraftSummary").fill("격리 브라우저 검증용 공간 별칭 추가");
    await editor.locator("#adminValidate").click();
    await expect(editor.locator("#adminValidation")).toContainText("구조 검증 통과");
    const saved = editor.waitForResponse((value) => value.url().endsWith("/api/v1/admin/drafts") && value.request().method() === "POST");
    await editor.locator("#adminSaveDraft").click();
    const draftResponse = await saved; expect(draftResponse.status()).toBe(201);
    const draft = (await draftResponse.json()).data;
    await expect(editor.locator("[data-draft-action=submit]")).toBeEnabled();
    await editor.locator("[data-draft-action=submit]").click();
    await expect(editor.locator("#adminMessage")).toContainText("submitted");
    await expect(editor.locator("[data-draft-action=approve]")).toBeDisabled();

    await login(reviewer, "reviewer");
    await reviewer.locator("#adminDraftSelect").selectOption(draft.id);
    await reviewer.locator("#adminLoadDraft").click();
    await expect(reviewer.locator("#adminDraftInfo")).toContainText("submitted");
    await expect(reviewer.locator("[data-draft-action=approve]")).toBeEnabled();
    await reviewer.locator("[data-draft-action=approve]").click();
    await expect(reviewer.locator("#adminPublish")).toBeEnabled();
    await screenshot(reviewer, info, "admin-approved-draft");
    const publication = reviewer.waitForResponse((value) => value.url().endsWith("/api/v1/admin/releases") && value.request().method() === "POST");
    await reviewer.locator("#adminPublish").click();
    expect((await publication).status()).toBe(201);
    await expect(reviewer.locator("#adminMessage")).toContainText("발행했습니다");
    await ready(page);
    await expect.poll(() => page.evaluate(() => window.CampusApp.diagnostics().catalogVersion)).toBe(version);
    await openSection(field(page, "query"));
    await field(page, "query").fill(marker); await field(page, "query").press("Enter");
    await expect(output(page, "search-results").locator(`[data-space-id="${buildingId}"]`)).toBeVisible();
    await editor.locator("#adminLogout").click();
    await expect(editor.locator("#adminWorkspace")).toBeHidden();
    await expect(editor.locator("#adminCatalog")).toHaveValue("");
    expect(editorErrors).toEqual([]); expect(reviewerErrors).toEqual([]); expect(publicErrors).toEqual([]);
  } finally { await Promise.all([editorContext.close(), reviewerContext.close()]); }
});
