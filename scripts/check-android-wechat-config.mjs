import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { chromium } from 'playwright'

// Mount the actual component with Ant Design Vue, and intercept all API traffic.
// This exercises form submission without changing a real backend key.
const root = fileURLToPath(new URL('../', import.meta.url))
const moduleId = '/virtual-android-wechat-check.js'
const server = await createServer({
  root, configFile: false, logLevel: 'error',
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') },
  server: { host: '127.0.0.1', port: 0 },
  plugins: [vue(), {
    name: 'android-wechat-check',
    resolveId(id) { if (id === moduleId) return id },
    load(id) {
      if (id !== moduleId) return
      return `
        import { createApp } from 'vue';
        import Antd from 'ant-design-vue';
        import { createI18n } from 'vue-i18n';
        import zh from '/src/locales/zh-CN.json';
        import Component from '/src/components/AndroidWechatConfig.vue';
        localStorage.setItem('dikongkong_token', 'test-admin-token');
        createApp(Component).use(Antd).use(createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })).mount('#app');
      `
    },
    configureServer(s) {
      s.middlewares.use('/__android-wechat-check', (_, res) => {
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
  page.setDefaultTimeout(15000)
  page.on('pageerror',e=>console.error(e))
  page.on('console',msg=>{if(msg.type()==='error')console.error(msg.text())})
  const posts = []
  let responseMode = 'success', storedSecret = 'b'.repeat(32)
  await page.route('**/api/**', async route => {
    const request = route.request()
    assert.equal(new URL(request.url()).pathname, '/api/auth/android/wechat-config')
    assert.equal(request.headers().authorization, 'Bearer test-admin-token')
    if (request.method() === 'GET') return route.fulfill({json: {success:true,data:{appId:'wx1234567890abcdef',secretConfigured:true,appSecret:storedSecret}}})
    posts.push(request.postDataJSON())
    if(responseMode==='success' && request.postDataJSON().appSecret) storedSecret=request.postDataJSON().appSecret
    return route.fulfill({status:responseMode==='http-error'?500:200,json:{success:responseMode==='success',data:{appId:request.postDataJSON().appId,secretConfigured:true,appSecret:storedSecret}}})
  })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__android-wechat-check`)
  const appId=page.locator('input').nth(0), secret=page.locator('input').nth(1)
  await page.waitForFunction(() => document.querySelector('input')?.value === 'wx1234567890abcdef')
  assert.equal(await secret.inputValue(), storedSecret)
  assert.equal(await secret.getAttribute('type'), 'password')
  await page.locator('.ant-input-password-icon').click()
  assert.equal(await secret.getAttribute('type'), 'text')
  assert.equal(await secret.inputValue(), storedSecret)
  await page.locator('.ant-input-password-icon').click()
  assert.equal(await secret.getAttribute('type'), 'password')
  await secret.fill('')
  const save=page.getByRole('button', {name:/^保\s*存$/})
  await save.click()
  await page.locator('[aria-live="polite"] .ant-alert-success').waitFor()
  assert.deepEqual(posts[0],{appId:'wx1234567890abcdef',appSecret:''})
  await appId.fill('wx1234567890abcdee')
  await save.click()
  await page.locator('[aria-live="polite"] .ant-alert-error').waitFor()
  assert.equal(posts.length,1)
  await secret.fill('a'.repeat(32))
  await save.click()
  await page.locator('[aria-live="polite"] .ant-alert-success').waitFor()
  assert.deepEqual(posts[1],{appId:'wx1234567890abcdee',appSecret:'a'.repeat(32)})
  assert.equal(await secret.inputValue(),'a'.repeat(32))
  for(const mode of ['business-error','http-error']) {
    responseMode=mode;await save.click()
    await page.locator('[aria-live="polite"] .ant-alert-error').waitFor()
    assert.match(await page.locator('[aria-live="polite"]').innerText(),/保存失败/)
  }
  assert.equal(posts.length,4)
  console.log('PASS: Android WeChat admin form, authorized URL, saved secret echo and visibility toggle, secret retention/replacement, app change validation, success and failure feedback')

} finally {
  await browser?.close()
  await server.close()
}
