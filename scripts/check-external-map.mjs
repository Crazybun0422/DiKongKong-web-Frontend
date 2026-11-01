import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { chromium } from 'playwright'

const entry = '/virtual-external-map.js'
const server = await createServer({
  configFile: false,
  logLevel: 'error',
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') },
  server: { host: '127.0.0.1', port: 0 },
  plugins: [vue(), {
    name: 'external-map-check',
    resolveId: id => id === entry ? id : null,
    load: id => id === entry ? `
      import { createApp } from 'vue';
      import { createI18n } from 'vue-i18n';
      import Antd from 'ant-design-vue';
      import 'ant-design-vue/dist/reset.css';
      import Component from '/src/components/ExternalMapConfig.vue';
      localStorage.setItem('dikongkong_token', 'admin-test-token');
      const i18n = createI18n({ legacy: false, locale: 'zh-CN', fallbackLocale: 'en' });
      window.setTestLocale = value => i18n.global.locale.value = value;
      createApp(Component).use(i18n).use(Antd).mount('#app');
    ` : null,
    configureServer(s) {
      s.middlewares.use('/__external-map-check', (_req, res) => {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><script type="module" src="${entry}"></script>`)
      })
    },
  }],
})

let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({ viewport: { width: 1100, height: 1100 }, permissions: ['clipboard-read', 'clipboard-write'] })
  const page = await context.newPage()
  page.setDefaultTimeout(15000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const payloads = []
  let failLoad = true, failSave = false
  const status = { enabled: false, tokenConfigured: false, keyConfigured: false, ready: false }
  await page.route('**/api/**', async route => {
    const req = route.request()
    assert.equal(new URL(req.url()).pathname, '/api/admin/external-map/config')
    assert.equal(req.headers().authorization, 'Bearer admin-test-token')
    if ((req.method() === 'GET' && failLoad) || (req.method() === 'PUT' && failSave)) {
      await route.fulfill({ status: 503, json: { success: false } }); return
    }
    if (req.method() === 'PUT') {
      const body = req.postDataJSON()
      payloads.push(body)
      assert.equal('key' in body, false)
      assert.equal('signingSecret' in body, false)
      status.enabled = body.enabled
      if (body.authToken) status.tokenConfigured = true
      if (body.tencentKey) status.keyConfigured = true
      status.ready = status.enabled && status.tokenConfigured && status.keyConfigured
    }
    await route.fulfill({ json: { success: true, data: status } })
  })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__external-map-check`)
  const save = page.getByRole('button', { name: '保存配置', exact: true })
  const feedback = page.locator('.feedback')
  await feedback.getByText('读取配置失败，请刷新重试').waitFor()
  assert.equal(await save.isDisabled(), true)
  failLoad = false
  await page.getByRole('button', { name: '刷新配置', exact: true }).click()
  await page.getByRole('button', { name: '生成随机 Token', exact: true }).waitFor()
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled)
  await page.getByRole('switch').click()
  await save.click()
  await feedback.getByText('请先填写腾讯 Key 和 Auth Token').waitFor()
  assert.equal(payloads.length, 0)
  // Password inputs have no implicit textbox role.
  const keyInput = page.getByLabel('设置 / 更换腾讯 Key', { exact: true })
  const tokenInput = page.getByLabel('设置 / 更换 Auth Token', { exact: true })
  await keyInput.fill('bad&key')
  await save.click()
  await feedback.getByText('腾讯 Key 必须为 1–128 位字母、数字或短横线').waitFor()
  await keyInput.fill('DEDICATED-TENCENT-KEY')
  await tokenInput.fill('short')
  await save.click()
  await feedback.getByText('Auth Token 必须为 32–128 位字母、数字、下划线或短横线').waitFor()
  assert.equal(payloads.length, 0)
  await page.getByRole('button', { name: '生成随机 Token', exact: true }).click()
  const generated = await tokenInput.inputValue()
  assert.match(generated, /^[a-f0-9]{64}$/)
  await page.getByRole('button', { name: '复制 Token', exact: true }).click()
  await feedback.getByText('Token 已复制').waitFor()
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), generated)
  failSave = true
  await save.click()
  await feedback.getByText('保存失败，请重试').waitFor()
  assert.equal(await tokenInput.inputValue(), generated, 'failed saves must retain the unsaved token')
  assert.equal(await keyInput.inputValue(), 'DEDICATED-TENCENT-KEY', 'failed saves must retain the unsaved key')
  failSave = false
  await save.click()
  await feedback.getByText('配置已保存').waitFor()
  assert.equal(payloads.at(-1).authToken, generated)
  assert.equal(payloads.at(-1).enabled, true)
  assert.equal(payloads.at(-1).tencentKey, 'DEDICATED-TENCENT-KEY')
  assert.equal(await keyInput.inputValue(), '', 'saved keys must not be returned to the form')
  assert.equal(await tokenInput.inputValue(), '', 'saved tokens must not remain in the form')
  await page.getByRole('switch').click()
  await save.click()
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled)
  assert.deepEqual(payloads.at(-1), { enabled: false }, 'blank input must preserve the current token')
  await keyInput.fill('REPLACEMENT-TENCENT-KEY')
  await save.click()
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled)
  assert.deepEqual(payloads.at(-1), { enabled: false, tencentKey: 'REPLACEMENT-TENCENT-KEY' })
  await page.getByRole('button', { name: '刷新配置', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('button[type="submit"]').disabled)
  assert.equal(await keyInput.getAttribute('placeholder'), '已配置，留空保留现有 Key')
  assert.equal(await page.getByText('签名密钥', { exact: true }).count(), 0)
  assert.equal(await page.evaluate(() => localStorage.length), 1, 'no external credential is persisted in browser storage')
  await page.getByText('GET /api/open/v1/map/search', { exact: true }).waitFor()
  await page.waitForFunction(() => document.querySelectorAll('.ant-message-notice').length === 0)
  fs.mkdirSync('build/checks', { recursive: true })
  await page.screenshot({ path: 'build/checks/external-map-config.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth)
  await page.screenshot({ path: 'build/checks/external-map-config-mobile.png', fullPage: true })
  await page.evaluate(() => window.setTestLocale('en'))
  await page.getByText('External search key configuration', { exact: true }).waitFor()
  assert.deepEqual(errors, [])
  console.log('PASS: key entry/replacement/preservation, no Secret, readiness, token generation/copy, save retry, admin auth, locale and mobile layout.')
} finally {
  await browser?.close()
  await server.close()
}
