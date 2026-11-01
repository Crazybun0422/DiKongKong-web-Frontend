import { preview } from 'vite';
import { chromium } from 'playwright';
import { readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const server = await preview({ preview: { host: '127.0.0.1', port: 17818, strictPort: true } });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
  const catalog = { activeVersion: '', releases: [] }; let uploads = 0;
  await page.addInitScript(() => localStorage.setItem('dikongkong_token', 'fixture-admin'));
  await page.route('**/api/**', async route => {
    const request = route.request(), url = new URL(request.url()); let data = {};
    if (url.pathname.startsWith('/api/config/drone-flight-resources')) {
      assert.equal(request.headers().authorization, 'Bearer fixture-admin');
      if (url.pathname.endsWith('/activate')) { catalog.activeVersion = request.postDataJSON().version; }
      else if (request.method() === 'POST') {
        assert.match(request.headers()['content-type'], /^multipart\/form-data; boundary=/);
        const body = request.postDataBuffer().toString('latin1');
        assert.match(body, /filename="drone-flight-v21-/); assert.match(body, /name="version"\r\n\r\n21\.2\.0/);
        uploads++; catalog.releases.unshift({ version: '21.2.0', createdAt: '2026-09-21T12:00:00Z', packages: { android: { size: 5900000 }, mini: { size: 5700000 } } });
      }
      data = catalog;
    }
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
  await page.route('https://**', route => route.abort());
  await page.goto('http://127.0.0.1:17818/admin/settings', { waitUntil: 'networkidle' });
  await page.getByRole('tab', { name: '系统设置', exact: true }).click();
  const tab = page.getByRole('tab', { name: '涂鸦飞行资源', exact: true });
  await tab.scrollIntoViewIfNeeded(); await tab.click();
  await page.locator('.drone-resources input[type=file]').setInputFiles('dist/resource-packages/' + (await readdir('dist/resource-packages')).find(name => name.endsWith('.zip')));
  await page.getByPlaceholder('例如 21.2.0').fill('21.2.0');
  await page.getByRole('button', { name: '上传新版本', exact: true }).click();
  await page.getByRole('button', { name: '启用此版本', exact: true }).click();
  await page.getByText('当前启用：21.2.0', { exact: true }).waitFor();
  assert.equal(uploads, 1); assert.equal(catalog.activeVersion, '21.2.0');
  await page.screenshot({ path: '.game-build/admin-drone-resources.png' });
  console.log('Compiled management UI: multipart ZIP/version upload, catalog refresh and activation passed (isolated API fixture).');
} finally { await browser.close(); await new Promise(resolve => server.httpServer.close(resolve)); }
