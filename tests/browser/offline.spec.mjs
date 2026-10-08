/* global window, navigator, caches, crypto */
import { test, expect } from '@playwright/test';

const platform = '#campusPlatform';
const command = (page, name) => page.locator(`${platform} [data-command="${name}"]`);
const output = (page, name) => page.locator(`${platform} [data-output="${name}"]`);

async function openSection(page, locator) {
  const panel = page.locator('.site-panel-toggle');
  if (await panel.getAttribute('aria-expanded') === 'false') await panel.click();
  const section = locator.locator('xpath=ancestor::details[1]');
  if (await section.count() && !await section.evaluate((element) => element.open)) await section.locator('summary').first().click();
  await locator.scrollIntoViewIfNeeded();
}

async function ready(page) {
  await expect(page.locator('#siteControls')).toHaveAttribute('data-status', 'ready');
  await expect(page.locator('#campusLoadStatus')).toBeHidden();
  await page.waitForFunction(() => window.CampusApp?.ready && window.CampusApp.scene?.getFrameId() > 2);
  await page.waitForFunction(() => { const state = window.CampusApp.diagnostics().modelLoader; return state?.loaded >= 1 && state.pending === 0 && state.active === 0; }, null, { timeout: 60000 });
  await expect(page.locator(platform)).toBeAttached();
}

test('real service-worker saves verified public assets, survives offline reload and clears only its app cache', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'desktop', 'CacheStorage integration runs once on desktop; physical device behavior is separate.');
  test.setTimeout(240_000);
  const pageErrors = []; const failedRequests = []; const consoleErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failedRequests.push({ method: request.method(), url: request.url(), error: request.failure()?.errorText || '' }));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  try {
    await page.goto('/'); await ready(page);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    const manifestResponse = await page.request.get('/offline-manifest.json'); expect(manifestResponse.ok()).toBe(true);
    const manifest = await manifestResponse.json(); expect(manifest.schemaVersion).toBe(1);
    const expectedBytes = manifest.assets.reduce((sum, asset) => sum + asset.bytes, 0);
    expect(manifest.assets.some((asset) => asset.detail && asset.path.startsWith('src/models/'))).toBe(true);
    await openSection(page, command(page, 'offline-save')); await command(page, 'offline-save').click();
    await expect(output(page, 'offline')).toContainText(manifest.version, { timeout: 120_000 });
    const state = await page.evaluate(() => window.CampusOffline.status());
    expect(state.supported).toBe(true); expect(state.saved).toBe(true); expect(state.details).toBe(true); expect(state.version).toBe(manifest.version); expect(state.bytes).toBe(expectedBytes); expect(Number.isFinite(Date.parse(state.updatedAt))).toBe(true);

    const audit = await page.evaluate(async (assets) => {
      const registration = await navigator.serviceWorker.ready; const control = await caches.open('hanshin-offline-control-v1'); const pointer = await control.match(new URL('__offline_current__', registration.scope));
      if (!pointer) throw new Error('Committed offline cache pointer is missing.');
      const saved = await pointer.json(); const cache = await caches.open(saved.cacheName); const entries = await cache.keys(); const findings = [];
      for (const asset of assets) {
        const response = await cache.match(new URL(asset.path, registration.scope));
        if (!response) throw new Error(`Missing committed asset ${asset.path}`);
        const body = await response.arrayBuffer(); const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', body))].map((value) => value.toString(16).padStart(2, '0')).join('');
        findings.push({ path: asset.path, bytes: body.byteLength, sha256: digest });
      }
      const allKeys = [];
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) allKeys.push(request.url);
      return { saved, entryCount: entries.length, findings, allKeys };
    }, manifest.assets);
    expect(audit.saved.version).toBe(manifest.version); expect(audit.entryCount).toBe(manifest.assets.length);
    expect(audit.findings).toEqual(manifest.assets.map((asset) => ({ path: asset.path, bytes: asset.bytes, sha256: asset.sha256 })));
    expect(audit.allKeys.some((url) => /\/api\/|admin(?:\.html|\/)|\/src\/ui\/admin\.js|\/styles\/admin\.css/.test(url))).toBe(false);
    await info.attach('real-offline-cache-audit', { body: Buffer.from(JSON.stringify(audit, null, 2)), contentType: 'application/json' });

    const packagedVersion = await page.evaluate(() => window.CampusPlatform.createCatalog(window.SitePlanData, window.CampusData).contentVersion);
    await context.setOffline(true);
    const privateFetches = await page.evaluate(async () => {
      const outcomes = [];
      for (const path of ['/api/v1/catalog', '/admin.html']) { try { const response = await fetch(path, { cache: 'no-store' }); outcomes.push({ path, fetched: true, status: response.status }); } catch { outcomes.push({ path, fetched: false }); } }
      try { await fetch('/', { method: 'HEAD', cache: 'no-store' }); outcomes.push({ path: 'HEAD /', fetched: true }); } catch { outcomes.push({ path: 'HEAD /', fetched: false }); }
      return outcomes;
    });
    expect(privateFetches.every((entry) => entry.fetched === false)).toBe(true);
    await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page);
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    expect(await page.evaluate(() => window.CampusApp.diagnostics().catalogVersion)).toBe(packagedVersion);
    expect((await page.evaluate(() => window.CampusApp.site.getDiagnostics())).errors).toEqual([]);
    expect((await page.evaluate(() => window.CampusOffline.status())).version).toBe(manifest.version);

    const panel = page.locator('.site-panel-toggle'); if (await panel.getAttribute('aria-expanded') === 'false') await panel.click();
    const search = page.getByRole('searchbox', { name: '건물 이름·번호 검색' }); await search.fill('실습동');
    await expect(page.locator('.site-building-list button')).toHaveCount(1); await page.locator('.site-building-list button').click();
    await expect(page.locator('#selectedBuildingName')).toContainText(/산학관|실습/);
    await page.getByRole('button', { name: '건물 내부 상세 보기' }).click(); await expect(page.locator('#buildingDetail')).toBeVisible(); await expect(page.locator('#buildingDetail')).toContainText(/실습|개념|내부/); await page.keyboard.press('Escape');
    await openSection(page, command(page, '2d')); await command(page, '2d').click();
    const map = page.locator('#campusAlternativeMap'); await expect(map).toBeVisible(); await expect(map.locator('svg')).toBeVisible(); await expect(map.locator('.platform-guide-boundary')).toHaveAttribute('fill-rule', 'evenodd');
    await map.locator('[data-map-close]').click(); await command(page, 'text').click(); await expect(map).toHaveAttribute('data-mode', 'text'); await expect(map.locator('svg')).toBeHidden();
    await expect(map.locator('[data-map-list] [data-space-id="hanshin-gg:building:practice"]')).toBeVisible(); await map.locator('[data-map-close]').click();
    expect(failedRequests.some((entry) => entry.method === 'HEAD' && /ERR_(?:INTERNET_DISCONNECTED|FAILED)/.test(entry.error))).toBe(true);
    expect(pageErrors).toEqual([]); expect(consoleErrors.filter((message) => !/net::ERR_(?:INTERNET_DISCONNECTED|FAILED)|Failed to fetch|NetworkError/.test(message))).toEqual([]);

    await page.evaluate(async () => { await caches.open('unrelated-offline-browser-fixture'); });
    await openSection(page, command(page, 'offline-clear')); page.once('dialog', (dialog) => dialog.accept()); await command(page, 'offline-clear').click();
    await expect(output(page, 'offline')).toHaveText('저장된 오프라인 자료가 없습니다.');
    const after = await page.evaluate(async () => ({ keys: await caches.keys(), controlEntries: (await (await caches.open('hanshin-offline-control-v1')).keys()).length, status: await window.CampusOffline.status() }));
    expect(after.keys.filter((name) => name.startsWith('hanshin-public-v1-'))).toEqual([]); expect(after.controlEntries).toBe(0); expect(after.status.saved).toBe(false); expect(after.keys).toContain('unrelated-offline-browser-fixture');
  } finally { await context.setOffline(false); }
});
