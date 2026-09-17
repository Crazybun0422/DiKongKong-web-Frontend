import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { chromium } from 'playwright'

// Mount the actual component with Ant Design Vue, and intercept all API traffic.
// This exercises form submission without changing a real backend key.
const root = fileURLToPath(new URL('../', import.meta.url))
const moduleId = '/virtual-android-map-check.js'
const server = await createServer({
  root, configFile: false, logLevel: 'error',
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') },
  server: { host: '127.0.0.1', port: 0 },
  plugins: [vue(), {
    name: 'android-map-check',
    resolveId(id) { if (id === moduleId) return id },
    load(id) {
      if (id !== moduleId) return
      return `
        import { createApp } from 'vue';
        import Antd from 'ant-design-vue';
        import { createI18n } from 'vue-i18n';
        import zh from '/src/locales/zh-CN.json';
        import Component from '/src/components/AndroidMapConfig.vue';
        localStorage.setItem('dikongkong_token', 'test-admin-token');
        createApp(Component).use(Antd).use(createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })).mount('#app');
      `
    },
    configureServer(s) {
      s.middlewares.use('/__android-map-check', (_, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(`<div id="app"></div><script type="module" src="${moduleId}"></script>`)
      })
    },
  }],
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  page.setDefaultTimeout(8000)
  const posts = []
  let responseMode = 'success'
  await page.route('**/api/**', async route => {
    const request = route.request()
    if (request.method() === 'GET' && request.url().endsWith('/android/config/map-key')) {
      return route.fulfill({ json: { success: true, data: { mapKey: 'OLD-KEY' } } })
    }
    assert.equal(new URL(request.url()).pathname, '/api/auth/android/config')
    assert.equal(request.method(), 'POST')
    posts.push({ body: request.postDataJSON(), authorization: request.headers().authorization })
    return route.fulfill({ status: responseMode === 'http-error' ? 500 : 200, json: { success: responseMode === 'success', data: null } })
  })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__android-map-check`)
  const input = page.getByRole('textbox')
  await input.waitFor()
  await page.waitForFunction(() => document.querySelector('input')?.value === 'OLD-KEY')
  await input.fill('  NEW-ANDROID-KEY  ')
  await page.getByRole('button', { name: /^保\s*存$/ }).click()
  await page.locator('[aria-live="polite"] .ant-alert-success').waitFor()
  assert.equal(posts.length, 1)
  assert.deepEqual(posts[0], { body: { mapKey: 'NEW-ANDROID-KEY' }, authorization: 'Bearer test-admin-token' })
  assert.match(await page.locator('[aria-live="polite"]').innerText(), /保存成功/)
  for (const mode of ['business-error', 'http-error']) {
    responseMode = mode
    await input.fill(`KEY-${mode}`)
    await page.getByRole('button', { name: /^保\s*存$/ }).click()
    await page.locator('[aria-live="polite"] .ant-alert-error').waitFor()
    assert.match(await page.locator('[aria-live="polite"]').innerText(), /保存失败/)
  }
  assert.equal(posts.length, 3)
  await input.fill('invalid key!')
  await page.getByRole('button', { name: /^保\s*存$/ }).click()
  await page.waitForFunction(() => document.querySelector('[aria-live="polite"]')?.textContent.includes('有效的地图 Key'))
  assert.equal(posts.length, 3)
  console.log('PASS: real form click, POST URL/body/token, success feedback, business/HTTP failures, invalid input')
} finally {
  await browser?.close()
  await server.close()
}
