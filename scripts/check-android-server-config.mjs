import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { chromium } from 'playwright'

const server = await createServer({
  root: fileURLToPath(new URL('../', import.meta.url)), configFile: false, logLevel: 'error',
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') },
  server: { host: '127.0.0.1', port: 0 },
  plugins: [vue(), {
    name: 'server-config-check',
    resolveId(id) { if (id === '/virtual-server.js') return id },
    load(id) {
      if (id !== '/virtual-server.js') return
      return `import {createApp} from 'vue';import Antd from 'ant-design-vue';import {createI18n} from 'vue-i18n';
        import zh from '/src/locales/zh-CN.json';import Component from '/src/components/AndroidServerConfig.vue';
        localStorage.setItem('dikongkong_token','test-admin-token');
        createApp(Component).use(Antd).use(createI18n({legacy:false,locale:'zh-CN',messages:{'zh-CN':zh}})).mount('#app');`
    },
    configureServer(s) { s.middlewares.use('/__check', (_,res) => {res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<div id="app"></div><script type="module" src="/virtual-server.js"></script>')}) },
  }],
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({headless:true})
  const page = await browser.newPage()
  const posts = []
  let fail = false
  await page.route('**/api/**', route => {
    const req = route.request()
    if (req.method() === 'GET') {
      assert.equal(new URL(req.url()).pathname, '/api/android/config/environments')
      return route.fulfill({json:{success:true,data:{debug:{apiBase:'',assetBase:''},release:{apiBase:'https://old.example.com',assetBase:''}}}})
    }
    assert.equal(new URL(req.url()).pathname, '/api/auth/android/config/environments')
    assert.equal(req.headers().authorization, 'Bearer test-admin-token')
    posts.push(req.postDataJSON())
    return route.fulfill({json:{success:!fail,data:null}})
  })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__check`)
  await page.waitForFunction(() => document.querySelector('[data-testid="release-apiBase"]')?.value === 'https://old.example.com')
  const save = page.locator('button[type="submit"]')
  await page.getByTestId('debug-apiBase').fill(' https://dev.example.com/ ')
  await page.getByTestId('release-apiBase').fill('')
  await page.getByTestId('release-assetBase').fill('https://cdn.example.com:8443/')
  await save.click()
  await page.locator('[aria-live] .ant-alert-success').waitFor()
  assert.deepEqual(posts, [{debug:{apiBase:'https://dev.example.com',assetBase:''},release:{apiBase:'',assetBase:'https://cdn.example.com:8443'}}])
  await page.getByTestId('debug-apiBase').fill('https://dev.example.com/api')
  await save.click()
  await page.locator('[aria-live] .ant-alert-error').waitFor()
  assert.equal(posts.length, 1)
  fail = true
  await page.getByTestId('debug-apiBase').fill('https://dev.example.com')
  await save.click()
  await page.waitForFunction(() => document.querySelector('[aria-live]')?.textContent.includes('保存失败'))
  assert.equal(posts.length, 2)
  console.log('PASS: real Android environment form, GET/POST/auth, separate channels, clear-to-default, normalization, validation and save feedback')
} finally {await browser?.close();await server.close()}
