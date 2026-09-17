import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { chromium } from 'playwright'

// Mount the actual component with Ant Design Vue, and intercept all API traffic.
// This exercises form submission without changing a real backend key.
const root = fileURLToPath(new URL('../', import.meta.url))
const moduleId = '/virtual-social-settings-check.js'
const server = await createServer({
  root, configFile: false, logLevel: 'error',
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') },
  server: { host: '127.0.0.1', port: 0 },
  plugins: [vue(), {
    name: 'social-settings-check',
    resolveId(id) { if (id === moduleId) return id },
    load(id) {
      if (id !== moduleId) return
      return `
        import { createApp } from 'vue';
        import Antd from 'ant-design-vue';
        import { createI18n } from 'vue-i18n';
        import zh from '/src/locales/zh-CN.json';
        import Component from '/src/components/SocialSettingsConfig.vue';
        localStorage.setItem('dikongkong_token', 'test-admin-token');
        createApp(Component).use(Antd).use(createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })).mount('#app');
      `
    },
    configureServer(s) {
      s.middlewares.use('/__social-settings-check', (_, res) => {
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
  let stored=false, failLoad=false
  const posts=[]
  await page.route('**/api/**',async route=>{
    const request=route.request()
    assert.equal(new URL(request.url()).pathname,'/api/auth/social-config')
    assert.equal(request.headers().authorization,'Bearer test-admin-token')
    if(request.method()==='POST'){posts.push(request.postDataJSON());stored=request.postDataJSON().closed}
    await route.fulfill({status:failLoad?500:200,json:{success:!failLoad,data:{closed:stored}}})
  })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__social-settings-check`)
  const toggle=page.getByRole('switch'),save=page.getByRole('button',{name:'保存',exact:true})
  await page.waitForFunction(()=>document.querySelector('[role="switch"]')?.disabled===false)
  assert.equal(await toggle.getAttribute('aria-checked'),'false')
  await toggle.click();await save.click()
  await page.waitForFunction(()=>document.body.textContent.includes('社交设置已保存'))
  assert.deepEqual(posts,[{closed:true}])
  await page.reload()
  await page.waitForFunction(()=>document.querySelector('[role="switch"]')?.getAttribute('aria-checked')==='true')
  await toggle.click();await save.click()
  await page.waitForFunction(()=>document.body.textContent.includes('社交设置已保存'))
  assert.deepEqual(posts,[{closed:true},{closed:false}])
  failLoad=true;await page.reload()
  await page.waitForFunction(()=>document.body.textContent.includes('社交设置加载失败'))
  assert.equal(await save.isDisabled(),true)
  console.log('Social settings admin UI passed: load, close, reopen, persistence and failed-load guard.')
} finally { await browser?.close();await server.close() }
