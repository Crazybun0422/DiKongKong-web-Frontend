import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { chromium } from 'playwright'

const entry = '/virtual-geojson-editor.js'
const source = { type: 'Polygon', coordinates: [[[114, 30], [114.1, 30], [114.1, 30.1], [114, 30]]] }
const server = await createServer({ configFile: false, optimizeDeps: { entries: [] }, logLevel: 'error',
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') }, server: { host: '127.0.0.1', port: 0 },
  plugins: [vue(), { name: 'geojson-editor-check', resolveId: id => id === entry ? id : null,
    load: id => id === entry ? `
      import {createApp,ref,h} from 'vue'; import Antd from 'ant-design-vue';
      import 'ant-design-vue/dist/reset.css'; import Editor from '/src/components/noFlyZones/GeoJsonZoneEditor.vue';
      localStorage.setItem('dikongkong_token','admin-test');
      createApp({setup(){const editor=ref(null);return ()=>h('div',[
        h('button',{onClick:()=>editor.value.open()},'新增'),
        h('button',{onClick:()=>editor.value.open('zone-1')},'加载上传区域'),h(Editor,{ref:editor})
      ])}}).use(Antd).mount('#app');
    ` : null,
    configureServer(s) { s.middlewares.use('/__geojson-check', (_,res) => { res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><script type="module" src="${entry}"></script>`); }); },
  }],
})
let browser
try {
  await server.listen()
  browser = await chromium.launch({ headless: true })
  // Verify timestamps do not depend on the administrator's browser timezone.
  const page = await browser.newPage({ viewport: { width: 1150, height: 1100 }, timezoneId: 'America/New_York' })
  page.setDefaultTimeout(15000)
  const errors = [], writes = []
  page.on('pageerror', e => errors.push(e.message))
  let failSave = false, deleted = false
  let detail = { id: 'zone-1', title: '武汉上传区域', sourceGeoJson: source, geoJson: { ...source, converted: true },
    coordinateSystem: 'GCJ-02', sourceCoordinateSystem: 'WGS84', sourceUrl: 'https://example.org/original',
    effectivePeriods: [{ effectiveFrom: 1893456000, effectiveTo: 1893459600 }, { effectiveFrom: 1893542400, effectiveTo: 1893546000 }] }
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    assert.equal(req.headers().authorization, 'Bearer admin-test')
    assert.ok(path.startsWith('/api/admin/geojson-assets'), 'the editor must only use admin endpoints')
    if (req.method() === 'DELETE') { deleted = true; await route.fulfill({ json: { success: true, data: null } }); return }
    if (req.method() === 'PUT' || req.method() === 'POST') {
      if (failSave) { await route.fulfill({ status: 400, json: { success: false, message: { zh: '测试保存失败' } } }); return }
      const body = req.postDataJSON(); writes.push({ method: req.method(), body })
      assert.equal('converted' in body.geoJson, false, 'must edit original WGS84, not stored GCJ-02')
      detail = { ...detail, title: body.title, sourceUrl: body.sourceUrl, effectivePeriods: body.effectivePeriods, sourceGeoJson: body.geoJson, sourceCoordinateSystem: body.coordinateSystem }
    }
    await route.fulfill({ json: { success: true, data: detail } })
  })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__geojson-check`)
  await page.getByRole('button', { name: '加载上传区域', exact: true }).click()
  const title = page.getByLabel('GeoJSON 标题', { exact: true })
  const json = page.getByLabel('GeoJSON 内容', { exact: true })
  await page.waitForFunction(() => document.querySelector('input[aria-label="GeoJSON 标题"]')?.value === '武汉上传区域')
  assert.deepEqual(JSON.parse(await json.inputValue()), source)
  const sourceUrl = page.getByLabel('来源 URL', { exact: true })
  assert.equal(await sourceUrl.inputValue(), 'https://example.org/original')
  await sourceUrl.fill('javascript:alert(1)')
  await page.getByRole('button', { name: '保存素材和时间', exact: true }).click()
  await page.locator('.geojson-error').getByText('请填写有效的 http:// 或 https:// 来源 URL，且不能包含账号密码').waitFor()
  assert.equal(writes.length, 0)
  await sourceUrl.fill('https://example.org/updated')
  assert.equal(await page.getByLabel('开始时间 1', { exact: true }).inputValue(), '2030-01-01T08:00')
  assert.equal(await page.locator('.period-row').count(), 2)
  await page.getByLabel('删除时段 2', { exact: true }).click()
  await page.getByRole('button', { name: '新增生效时段', exact: true }).click()
  await page.getByLabel('开始时间 2', { exact: true }).fill('2030-01-03T08:00')
  await page.getByLabel('结束时间 2', { exact: true }).fill('2030-01-03T09:00')
  await title.fill('修改后的区域')
  await page.locator('input[type="file"][accept*=".geojson"]').setInputFiles({ name: 'replacement.geojson', mimeType: 'application/geo+json', buffer: Buffer.from(JSON.stringify(source).replaceAll('114','115')) })
  await page.waitForFunction(() => document.querySelector('textarea').value.includes('115'))
  failSave = true
  await page.getByRole('button', { name: '保存素材和时间', exact: true }).click()
  await page.locator('.geojson-error').getByText('测试保存失败').waitFor()
  assert.equal(await title.inputValue(), '修改后的区域')
  failSave = false
  await page.getByRole('button', { name: '保存素材和时间', exact: true }).click()
  await page.locator('.ant-modal').waitFor({ state: 'hidden' })
  assert.equal(writes.at(-1).method, 'PUT')
  assert.equal(writes.at(-1).body.sourceUrl, 'https://example.org/updated')
  assert.equal(writes.at(-1).body.coordinateSystem, 'WGS84', 'legacy source CRS must be retained')
  assert.equal(writes.at(-1).body.geoJson.coordinates[0][0][0], 115)
  assert.equal(writes.at(-1).body.effectivePeriods[1].effectiveFrom, 1893628800)
  await page.getByRole('button', { name: '加载上传区域', exact: true }).click()
  await page.waitForFunction(() => document.querySelector('input[aria-label="GeoJSON 标题"]')?.value === '修改后的区域')
  assert.equal(await sourceUrl.inputValue(), 'https://example.org/updated')
  await page.waitForFunction(() => document.querySelectorAll('.ant-message-notice').length === 0)
  fs.mkdirSync('build/checks', { recursive: true })
  await page.screenshot({ path: 'build/checks/geojson-zone-editor.png', fullPage: true })
  await page.getByRole('button', { name: '删除该 GeoJSON', exact: true }).click()
  assert.equal(deleted, false)
  await page.locator('.ant-modal-confirm .ant-btn-primary').click()
  await page.waitForFunction(() => document.querySelectorAll('.ant-modal').length === 0 || [...document.querySelectorAll('.ant-modal')].every(el => el.offsetParent === null))
  assert.equal(deleted, true)
  await page.getByRole('button', { name: '新增', exact: true }).click()
  assert.equal(await page.getByLabel('输入坐标系', {exact:true}).inputValue(), 'GCJ-02')
  await title.fill('新增区域')
  await json.fill(JSON.stringify(source))
  await page.getByLabel('开始时间 1', { exact: true }).fill('2030-01-01T08:00')
  await page.getByLabel('结束时间 1', { exact: true }).fill('2030-01-01T07:00')
  await page.getByRole('button', { name: '保存素材和时间', exact: true }).click()
  await page.locator('.geojson-error').getByText('每个时间段都必须填写起止时间，且结束晚于开始').waitFor()
  await page.getByLabel('结束时间 1', { exact: true }).fill('2030-01-01T09:00')
  await page.getByRole('button', { name: '保存素材和时间', exact: true }).click()
  await page.locator('.ant-modal').waitFor({ state: 'hidden' })
  assert.equal(writes.at(-1).method, 'POST')
  assert.equal(writes.at(-1).body.sourceUrl, '', 'new form must not inherit the previous material source')
  assert.equal(writes.at(-1).body.coordinateSystem, 'GCJ-02', 'new uploads must default to GCJ-02')
  await page.getByRole('button', {name:'加载上传区域',exact:true}).click()
  await page.waitForFunction(() => document.querySelector('input[aria-label="GeoJSON 标题"]')?.value === '新增区域')
  assert.equal(await page.getByLabel('输入坐标系', {exact:true}).inputValue(), 'GCJ-02')
  assert.deepEqual(JSON.parse(await json.inputValue()), source)
  await page.getByLabel('输入坐标系', {exact:true}).selectOption('WGS84')
  await page.getByRole('button', {name:'保存素材和时间',exact:true}).click()
  await page.locator('.ant-modal').waitFor({state:'hidden'})
  assert.equal(writes.at(-1).body.coordinateSystem, 'WGS84', 'explicit source CRS correction must be sent')
  await page.getByRole('button', {name:'加载上传区域',exact:true}).click()
  await page.waitForFunction(() => document.querySelector('input[aria-label="GeoJSON 标题"]')?.value === '新增区域')
  const circle = {type:'Feature',properties:{shape:'CIRCLE',radiusMeters:1000,sourceUrl:'https://example.org/circle'},geometry:{type:'Point',coordinates:[102.56366643788185,24.36500105409684]}}
  await json.fill(JSON.stringify(circle))
  assert.equal(await page.getByLabel('圆形半径 1', {exact:true}).inputValue(), '1000')
  await page.getByLabel('圆形半径 1', {exact:true}).fill('1200')
  await page.getByLabel('圆心纬度 1', {exact:true}).fill('24.366')
  await page.getByLabel('输入坐标系', {exact:true}).selectOption('GCJ-02')
  await page.getByRole('button', {name:'保存素材和时间',exact:true}).click()
  await page.locator('.ant-modal').waitFor({state:'hidden'})
  const savedCircle = writes.at(-1).body.geoJson
  assert.equal(savedCircle.geometry.type, 'Point')
  assert.equal(savedCircle.geometry.coordinates.length, 2)
  assert.deepEqual(savedCircle.geometry.coordinates, [102.56366643788185,24.366])
  assert.equal(savedCircle.properties.radiusMeters, 1200)
  assert.equal(savedCircle.properties.sourceUrl, circle.properties.sourceUrl)
  await page.getByRole('button', {name:'加载上传区域',exact:true}).click()
  await page.getByLabel('圆形半径 1', {exact:true}).waitFor()
  assert.equal(await page.getByLabel('圆形半径 1', {exact:true}).inputValue(), '1200')
  await page.screenshot({path:'build/checks/geojson-circle-editor.png',fullPage:true})
  const path = {type:'Feature',properties:{shape:'PATH',pathDistanceMeters:200},geometry:{type:'LineString',coordinates:[[114,30],[114.1,30.1]]}}
  const rectangle = {type:'Feature',properties:{shape:'RECTANGLE'},geometry:{type:'Polygon',coordinates:[[[114,30],[114.1,30],[114.1,30.1],[114,30.1],[114,30]]]}}
  await json.fill(JSON.stringify({type:'FeatureCollection',features:[savedCircle,path,rectangle]}))
  await page.getByLabel('路径扩展距离 2', {exact:true}).fill('500')
  await page.getByRole('button', {name:'保存素材和时间',exact:true}).click()
  await page.locator('.ant-modal').waitFor({state:'hidden'})
  const mixed = writes.at(-1).body.geoJson.features
  assert.deepEqual(mixed[0],savedCircle)
  assert.deepEqual(mixed[1].geometry,path.geometry)
  assert.equal(mixed[1].properties.pathDistanceMeters,500)
  assert.deepEqual(mixed[2],rectangle)
  assert.deepEqual(errors, [])
  console.log('PASS: default GCJ-02, explicit WGS84, preserved source CRS on reload, admin-only requests, file replacement, multiple periods, UTC+8 in overseas browser, save retry, delete confirmation and creation.')
} finally { await browser?.close(); await server.close() }
