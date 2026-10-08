/* global window, navigator, caches, crypto */
import { test, expect } from "@playwright/test";

const output = (page) => page.locator('#campusRefinement [data-ref-output="offline"]');
async function open(page, locator) { const panel = page.locator(".site-panel-toggle"); if (await panel.getAttribute("aria-expanded") === "false") await panel.click(); const section = locator.locator("xpath=ancestor::details[1]"); if (await section.count() && !await section.evaluate((element) => element.open)) await section.locator("summary").click(); await locator.scrollIntoViewIfNeeded(); }
async function ready(page) { await page.waitForFunction(() => window.CampusApp?.ready && window.CampusApp.scene?.getFrameId() > 2); await expect(page.locator("#campusRefinement")).toBeAttached(); }

test("approved selected-building bundle keeps catalog and asset versions through real offline reload", async ({ page, context }, info) => {
  test.setTimeout(240000); const pageErrors = [], consoleErrors = []; page.on("pageerror", (error) => pageErrors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  try {
    await page.goto("/"); await ready(page); await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const response = await page.request.get("/api/v1/bundle"); expect(response.ok()).toBe(true); const { data: bundle } = await response.json(); expect(bundle.schemaVersion).toBe(1); expect(bundle.assets.length).toBeGreaterThan(1);
    const query = page.locator('#campusPlatform [data-field="query"]'); await open(page, query); await query.fill("장공관"); await query.press("Enter"); await page.locator('#campusPlatform [data-output="search-results"] [data-space-id="hanshin-gg:building:janggong"]').click();
    const scope = page.locator('#campusRefinement [data-ref-field="offline-scope"]'); await open(page, scope); await scope.selectOption("selected"); await page.locator('#campusRefinement [data-ref-command="offline-bundle"]').click(); await expect(output(page)).toContainText("저장 예상 용량"); await page.locator('#campusRefinement [data-ref-command="offline-save"]').click(); await expect(output(page)).toContainText("저장 완료", { timeout: 120000 });
    const state = await page.evaluate(() => window.CampusOffline.status()); expect(state.kind).toBe("bundle"); expect(state.version).toBe(bundle.contentVersion); expect(state.assetsVersion).toBe(bundle.assetsVersion); expect(state.releaseId).toBe(bundle.releaseId); expect(state.scope).toBe("selected");
    const audit = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready, control = await caches.open("hanshin-offline-control-v1"), current = await (await control.match(new URL("__offline_current__", registration.scope))).json(), cache = await caches.open(current.cacheName), requests = await cache.keys(), saved = await window.CampusOffline.readCatalog();
      const hashes = []; for (const request of requests.filter((item) => item.url.includes("/assets/releases/"))) { const body = await (await cache.match(request)).arrayBuffer(); const sha256 = [...new Uint8Array(await crypto.subtle.digest("SHA-256", body))].map((value) => value.toString(16).padStart(2, "0")).join(""); hashes.push({ path: new URL(request.url).pathname.replace(/^\//, ""), bytes: body.byteLength, sha256 }); }
      const allKeys = []; for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) allKeys.push(request.url); return { current, saved, hashes, allKeys };
    });
    expect(audit.saved.catalog.contentVersion).toBe(bundle.contentVersion); expect(audit.saved.catalog.assetsVersion).toBe(bundle.assetsVersion); expect(audit.saved.manifest).toEqual(bundle.manifest); expect(audit.hashes.length).toBeLessThan(bundle.assets.length);
    for (const asset of audit.hashes) { const approved = bundle.assets.find((item) => item.path === asset.path); expect(approved).toBeTruthy(); expect(asset.bytes).toBe(approved.bytes); expect(asset.sha256).toBe(approved.sha256); }
    expect(audit.allKeys.some((url) => /\/api\/|admin|refinement-scene-preview/.test(url))).toBe(false); await info.attach("approved-offline-audit", { body: Buffer.from(JSON.stringify(audit, null, 2)), contentType: "application/json" });
    const offlineRequests = []; page.on("request", (request) => offlineRequests.push(new URL(request.url()).pathname.replace(/^\//, "")));
    await context.setOffline(true); await page.reload({ waitUntil: "domcontentloaded" }); await ready(page);
    await expect.poll(() => page.evaluate(() => window.CampusApp.diagnostics().catalogVersion)).toBe(bundle.contentVersion); expect((await page.evaluate(() => window.CampusOffline.readCatalog())).assetsVersion).toBe(bundle.assetsVersion); expect((await page.evaluate(() => window.CampusOffline.status())).releaseId).toBe(bundle.releaseId);
    const base = await page.evaluate(() => window.CampusApp.site.getDiagnostics()); expect(base.campusPartCount).toBeGreaterThan(0); expect(base.boundaryAreaMeaning).toBe("estimated-guide-area-not-legal-area");
    const privateReads = await page.evaluate(async () => { const result = []; for (const path of ["/api/v1/catalog", "/api/v1/admin/status", "/admin.html"]) { try { await fetch(path, { cache: "no-store" }); result.push(true); } catch { result.push(false); } } return result; }); expect(privateReads).toEqual([false, false, false]);
    const baseGuide = page.locator('#campusPlatform [data-command="2d"]'); await open(page, baseGuide); await baseGuide.click(); await expect(page.locator("#campusAlternativeMap .platform-guide-boundary")).toBeVisible(); await page.locator("#campusAlternativeMap [data-map-close]").click();
    await expect.poll(() => page.evaluate(() => { const loader = window.CampusApp.diagnostics().modelLoader; return loader.loaded >= 1 && loader.pending === 0 && loader.active === 0; })).toBe(true);
    const storedPaths = new Set(audit.hashes.map(asset => asset.path)), availableDetailPaths = new Set(bundle.assets.filter(asset => asset.detail && storedPaths.has(asset.path)).flatMap(asset => [asset.path, asset.originalPath]));
    const allDetailPaths = new Set(bundle.assets.filter(asset => asset.detail).flatMap(asset => [asset.path, asset.originalPath]));
    expect(offlineRequests.filter(path => (allDetailPaths.has(path) || /\.glb$/.test(path) || /^src\/models\/.+\.js$/.test(path)) && !availableDetailPaths.has(path))).toEqual([]);
    expect(pageErrors).toEqual([]); expect(consoleErrors.filter((message) => !/net::ERR_(?:INTERNET_DISCONNECTED|FAILED)|Failed to fetch|NetworkError/.test(message))).toEqual([]);
  } finally { await context.setOffline(false); }
});
