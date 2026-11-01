import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createServer } from 'vite';
import vue from '@vitejs/plugin-vue';
import { chromium } from 'playwright';

const server = await createServer({ configFile: false, plugins: [vue(), {
  name: 'harmony-manager-fixture',
  resolveId(id) { if (id === '/__hap-fixture.js') return id; },
  load(id) { if (id === '/__hap-fixture.js') return `import {createApp} from 'vue';import Antd from 'ant-design-vue';import App from '/src/components/HarmonyHapManager.vue';createApp(App).use(Antd).mount('#app');`; },
  configureServer(s) { s.middlewares.use('/__hap-test', (_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script type="module" src="/__hap-fixture.js"></script></body></html>');
  }); }
}], optimizeDeps: { entries: ['index.html'] }, server: { host: '127.0.0.1', port: 0 } });
await server.listen();
const origin = `http://127.0.0.1:${server.httpServer.address().port}`;
const browser = await chromium.launch({ headless: true });
const release = (id = 7, platform = 'harmony') => ({ id, versionCode: id, versionName: `1.0.${id}`, sizeBytes: 50 * 1024 * 1024,
  selected: true, downloadUrl: `/api/${platform}/app-releases/${id}/versions/${id}/${'a'.repeat(64)}.${platform === 'harmony' ? 'hap' : 'apk'}` });
let selected = 7, available = true, failing = false, invalid = '', uploaded = 0;
try {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 },
    userAgent: 'Mozilla/5.0 (Phone; OpenHarmony 5.0) AppleWebKit/537.36 Chrome/114 Safari/537.36' });
  await context.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (/\.(hap|apk)$/.test(path)) {
      await route.fulfill({ contentType: 'application/octet-stream', headers: { 'Content-Disposition': `attachment; filename="test.${path.endsWith('.hap') ? 'hap' : 'apk'}"` }, body: 'test download' }); return;
    }
    if (path === '/api/android/app-releases/latest') {
      await route.fulfill({ json: { success: true, data: release(2, 'android') } }); return;
    }
    if (req.method() === 'POST') { assert.match(req.postData(), /filename="sample.hap"/); selected = 8; uploaded++; }
    if (req.method() === 'PUT') selected = Number(path.split('/').at(-2));
    const current = { ...release(selected), ...(invalid ? { downloadUrl: invalid } : {}) };
    const data = path.endsWith('/latest') ? available ? current : null
      : req.method() === 'GET' ? [8, 7, 6].map(id => ({ ...release(id), selected: id === selected })) : current;
    await route.fulfill({ status: failing ? 503 : 200, json: { success: !failing, data } });
  });
  const page = await context.newPage();
  await page.goto(origin);
  await page.waitForFunction(() => document.querySelector('#download-harmony')?.hasAttribute('href'));
  assert.equal(await page.locator('#tab-harmony').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#download-harmony').getAttribute('href'), release().downloadUrl);
  assert.match(await page.locator('#harmony-version').innerText(), /1\.0\.7.*50\.0 MB/);
  await fs.mkdir('output/harmony-download', { recursive: true });
  for (const width of [320, 393, 1280]) {
    await page.setViewportSize({ width, height: 852 });
    await page.locator('#panel-harmony').scrollIntoViewIfNeeded();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `viewport ${width}`);
    await page.locator('.app-card').screenshot({ path: `output/harmony-download/home-${width}.png` });
  }
  const download = page.waitForEvent('download');
  await page.locator('#download-harmony').click();
  assert((await download).suggestedFilename().endsWith('.hap'));

  // The actual upload/selection component updates the same published version read by the homepage.
  const admin = await context.newPage();
  await admin.goto(`${origin}/__hap-test`);
  await admin.getByText('当前升级版本 1.0.7', { exact: true }).waitFor();
  await admin.locator('input[type=file]').setInputFiles({ name: 'sample.hap', mimeType: 'application/octet-stream', buffer: Buffer.from('fixture only') });
  await admin.getByRole('button', { name: '上传并发布' }).click();
  await admin.getByText('当前升级版本 1.0.8', { exact: true }).waitFor();
  assert.equal(uploaded, 1);
  await page.locator('#tab-harmony').click();
  await page.waitForFunction(url => document.querySelector('#download-harmony')?.getAttribute('href') === url, release(8).downloadUrl);
  await admin.locator('.hap-history-row').filter({ hasText: '1.0.6' }).getByRole('button', { name: '设为升级包' }).click();
  await admin.getByRole('button', { name: /切\s*换/ }).click();
  await admin.getByText('当前升级版本 1.0.6', { exact: true }).waitFor();
  await page.locator('#tab-harmony').click();
  await page.waitForFunction(url => document.querySelector('#download-harmony')?.getAttribute('href') === url, release(6).downloadUrl);

  available = false;
  await page.locator('#tab-harmony').click();
  await page.getByText('鸿蒙安装包尚未发布', { exact: true }).waitFor();
  assert.equal(await page.locator('#download-harmony').getAttribute('href'), null);
  available = true; failing = true;
  await page.locator('#download-harmony').click();
  await page.locator('#harmony-version').filter({ hasText: '点击重试' }).waitFor();
  assert.equal(await page.locator('#download-harmony').getAttribute('href'), null);
  failing = false;
  for (const url of ['https://example.com/test.hap', release(2, 'android').downloadUrl]) {
    invalid = url;
    await page.locator('#download-harmony').click();
    await page.waitForFunction(() => document.querySelector('#download-harmony')?.getAttribute('aria-busy') === 'false');
    assert.equal(await page.locator('#download-harmony').getAttribute('href'), null);
  }
  invalid = '';
  await page.locator('#download-harmony').press('Enter');
  await page.waitForFunction(() => document.querySelector('#download-harmony')?.hasAttribute('href'));

  await page.evaluate(() => Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'OpenHarmony MicroMessenger' }));
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.copiedLink = value; } } }));
  await page.locator('#download-harmony').click();
  await page.locator('#harmony-download-dialog[open]').waitFor();
  await page.locator('#copy-harmony-link').click();
  assert.equal(await page.evaluate(() => window.copiedLink), origin + release(6).downloadUrl);
  await page.locator('#harmony-download-dialog .dialog-close').click();
  await page.evaluate(() => Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'iPhone MicroMessenger' }));
  await page.locator('#download-harmony').click();
  await page.getByText('适用于原生鸿蒙', { exact: true }).waitFor();
  assert.equal(await page.locator('#copy-harmony-link').isVisible(), false);
  await page.locator('#harmony-download-dialog .dialog-close').click();
  await page.locator('#tab-ios').click();
  await page.locator('#panel-ios [data-app]').click();
  await page.locator('#download-dialog[open]').waitFor();

  const legacy = await context.newPage();
  await legacy.addInitScript(() => Object.defineProperty(navigator, 'userAgent', { value: 'Mozilla/5.0 (Linux; Android 10; HUAWEI) HarmonyOS' }));
  await legacy.goto(origin);
  await legacy.waitForFunction(() => document.querySelector('#download-app')?.hasAttribute('href'));
  assert.equal(await legacy.locator('#tab-android').getAttribute('aria-selected'), 'true');
  assert.equal(await legacy.locator('#download-app').getAttribute('href'), release(2, 'android').downloadUrl);
  console.log('PASS: HAP homepage, actual manager upload/select flow, direct download, 320/393/1280px, WeChat/iOS, unavailable/error/retry, URL isolation and legacy Android. API responses are fixtures.');
} finally { await browser.close(); await server.close(); }
