import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { chromium } from 'playwright'

const entry = '/virtual-geojson-manager.js'
const server = await createServer({ configFile: false, optimizeDeps: { entries: [] }, logLevel: 'error',
  define: { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify('/api') }, server: { host: '127.0.0.1', port: 0 },
  plugins: [vue(), { name: 'geojson-manager-check', resolveId: id => id === entry ? id : null,
    load: id => id === entry ? `import {createApp} from 'vue';import Antd from 'ant-design-vue';import {createI18n} from 'vue-i18n';
      import zh from '/src/locales/zh-CN.json';import Manager from '/src/components/noFlyZones/TemporaryNoFlyZoneManager.vue';
      localStorage.setItem('dikongkong_token','admin-test');createApp(Manager).use(Antd).use(createI18n({legacy:false,locale:'zh-CN',messages:{'zh-CN':zh}})).mount('#app');` : null,
    configureServer(s) { s.middlewares.use('/__manager-check', (_,res) => { res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<div id="app"></div><script type="module" src="${entry}"></script>`); }); },
  }],
})
let browser
try {
  await server.listen(); browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ timezoneId: 'America/New_York' })
  const errors = [], writes = []; page.on('pageerror', e => errors.push(e.message)); page.setDefaultTimeout(20000)
  await page.route('https://**', route => route.abort())
  const source = { type:'Polygon', coordinates:[[[114,30],[114.1,30],[114.1,30.1],[114,30]]] }
  const zone = { name:'外部上传的素材',type:'POLYGON',
    coordinates:[{longitude:114.005,latitude:29.997},{longitude:114.105,latitude:29.997},{longitude:114.105,latitude:30.097},{longitude:114.005,latitude:29.997}],
    effectiveFrom:1893456017,effectiveTo:1893459623,
    effectivePeriods:[{effectiveFrom:1893542417,effectiveTo:1893546023}],extra:[] }
  zone.announcement = {title:'正文标题',publisher:'市公安局',publishedAt:'2026-10-05',content:'<h2>管制范围</h2><p>固定版式公告正文</p>',sourceUrl:'https://example.org/notice',attachments:[]}
  const asset = {announcement:zone.announcement,id:'asset-1',title:zone.name,sourceUrl:'https://example.org/notice',sourceGeoJson:source,geoJson:source,draft:zone,
    effectivePeriods:[{effectiveFrom:zone.effectiveFrom,effectiveTo:zone.effectiveTo},...zone.effectivePeriods]}
  let saved = null
  let failSave = false
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    assert.equal(req.headers().authorization,'Bearer admin-test')
    let data = {}
    if(req.method() !== 'GET') {
      writes.push({path, body:req.postDataJSON()})
      assert.ok(path === '/api/admin/geojson-assets/asset-1/publish' || (req.method() === 'PUT' && path === '/api/admin/no-fly-zones/saved-1'), 'material must publish once; subsequent edits update the linked zone')
      if(failSave) { await route.fulfill({status:500,json:{success:false}}); return }
      saved = {id:'saved-1',...req.postDataJSON()}; asset.publication = {status:'PUBLISHED',zoneId:'saved-1',publishedAt:'2026-11-01T08:00:00'}; data = {publication:asset.publication,zone:saved}
    }
    else if(path === '/api/admin/geojson-assets/asset-1') data = asset
    else if(path === '/api/admin/geojson-assets') data = {content:[asset],page:0,size:10,totalElements:1,totalPages:1}
    else if(path.endsWith('/saved-1')) data = saved
    else if(path === '/api/admin/no-fly-zones') data = {content:saved?[saved]:[],page:0,size:10,totalElements:saved?1:0,totalPages:saved?1:0}
    else if(path.endsWith('/rich-text-config')) data = {content:''}
    await route.fulfill({json:{success:true,data}})
  })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__manager-check`)
  async function loadMaterial() {
    await page.getByRole('button',{name:'GeoJSON 素材库',exact:true}).click()
    const row = page.locator('tr[data-row-key="asset-1"]')
    await row.getByText(zone.name,{exact:true}).waitFor()
    const sourceLink = row.getByRole('link', {name: asset.sourceUrl, exact:true})
    assert.equal(await sourceLink.getAttribute('href'), asset.sourceUrl)
    assert.equal(await sourceLink.getAttribute('rel'), 'noopener noreferrer')
    await row.getByText('2030-01-01 08:00:17 ~ 2030-01-01 09:00:23',{exact:true}).waitFor()
    fs.mkdirSync('build/checks', {recursive:true})
    await page.waitForFunction(() => !document.querySelector('.ant-table-wrapper .ant-spin-spinning'))
    await page.locator('.ant-modal-content').screenshot({path:'build/checks/geojson-asset-library.png',animations:'disabled'})
    await row.getByRole('button',{name:'加载到编辑区',exact:true}).click()
    await page.getByText('未保存的 GeoJSON 草稿：' + zone.name,{exact:true}).waitFor()
    await page.getByRole('button',{name:'保存到临时禁飞区',exact:true}).waitFor()
  }
  await page.getByRole('button',{name:'GeoJSON 素材库',exact:true}).waitFor()
  assert.equal(await page.locator('tr[data-row-key]').count(),0)
  await loadMaterial()
  assert.equal(writes.length,0,'selection must be read-only')
  assert.equal(await page.locator('.no-fly-zone-manager tr[data-row-key]').count(),0,'selection must not enter the saved-zone list')
  await page.getByRole('button',{name:/^重\s*置$/}).click()
  assert.equal(await page.getByText('未保存的 GeoJSON 草稿：' + zone.name,{exact:true}).count(),0)
  assert.equal(writes.length,0,'discarding must not persist a draft')
  await loadMaterial()
  // Leaving the page discards the draft and must not persist it.
  await page.reload()
  await page.getByRole('button',{name:'GeoJSON 素材库',exact:true}).waitFor()
  assert.equal(await page.getByText('未保存的 GeoJSON 草稿：' + zone.name,{exact:true}).count(),0)
  assert.equal(writes.length,0)
  await loadMaterial()
  const save = page.getByRole('button',{name:'保存到临时禁飞区',exact:true})
  failSave = true
  const failedResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/api/admin/geojson-assets/asset-1/publish' && r.request().method() === 'POST')
  await save.click()
  await failedResponse
  await page.waitForFunction(() => ![...document.querySelectorAll('button')].some(el => el.textContent.includes('保存到临时禁飞区') && el.classList.contains('ant-btn-loading')))
  assert.equal(saved,null)
  await page.getByText('未保存的 GeoJSON 草稿：' + zone.name,{exact:true}).waitFor()
  failSave = false
  await save.click()
  await page.locator('tr[data-row-key="saved-1"]').getByText(zone.name,{exact:true}).waitFor()
  assert.equal(writes.length,2,'only explicit save and retry may write')
  assert.deepEqual(writes.at(-1).body.announcement,zone.announcement,'announcement must survive material loading, failure and explicit save')
  assert.deepEqual(writes.at(-1).body.coordinates,zone.coordinates,'GCJ-02 coordinates must not convert a second time')
  assert.equal(writes.at(-1).body.effectiveFrom,zone.effectiveFrom,'UTC+8 and seconds must survive loading and save')
  assert.deepEqual(writes.at(-1).body.effectivePeriods,zone.effectivePeriods)
  assert.equal(await page.getByText('未保存的 GeoJSON 草稿：' + zone.name,{exact:true}).count(),0)
  zone.type = 'CIRCLE'
  zone.coordinates = []
  zone.circle = {longitude:102.56366643788185,latitude:24.36500105409684,radiusMeters:1000}
  zone.extra = [{type:'CIRCLE',coordinates:[],circle:{longitude:102.56,latitude:24.36,radiusMeters:250}}]
  const previousWrites = writes.length
  await loadMaterial()
  assert.equal(writes.length, previousWrites, 'loading circles must be read-only')
  await save.click()
  await page.waitForFunction(() => !document.body.textContent.includes('未保存的 GeoJSON 草稿：'))
  assert.equal(writes.length, previousWrites + 1)
  assert.equal(writes.at(-1).body.type, 'CIRCLE')
  assert.deepEqual(writes.at(-1).body.circle, zone.circle)
  assert.ok(!writes.at(-1).body.coordinates?.length, 'circle must have no polygon vertices')
  assert.equal(writes.at(-1).body.extra[0].type, 'CIRCLE')
  assert.deepEqual(writes.at(-1).body.extra[0].circle, zone.extra[0].circle)
  const rectangle = {type:'RECTANGLE',coordinates:[{longitude:114,latitude:30},{longitude:114.1,latitude:30},{longitude:114.1,latitude:30.1},{longitude:114,latitude:30.1},{longitude:114,latitude:30}],circle:null}
  const pathArea = {type:'PATH',coordinates:[{longitude:114,latitude:30},{longitude:114.03,latitude:30.02},{longitude:114.06,latitude:30.01}],pathDistanceMeters:200,circle:null}
  const polygon = {type:'POLYGON',coordinates:rectangle.coordinates,circle:null}
  const circleArea = {type:'CIRCLE',coordinates:[],circle:{...zone.circle}}
  for (const primary of [rectangle, pathArea]) {
    Object.assign(zone, primary, {extra:[polygon,rectangle,pathArea,circleArea]})
    const count = writes.length
    await loadMaterial()
    assert.equal(writes.length, count)
    await save.click()
    await page.waitForFunction(() => !document.body.textContent.includes('未保存的 GeoJSON 草稿：'))
    const body = writes.at(-1).body
    assert.equal(body.type, primary.type)
    assert.deepEqual(body.coordinates, primary.coordinates)
    if (primary.type === 'PATH') assert.equal(body.pathDistanceMeters, 200)
    assert.deepEqual(body.extra.map(a=>a.type), ['POLYGON','RECTANGLE','PATH','CIRCLE'])
    assert.deepEqual(body.extra[1].coordinates, rectangle.coordinates)
    assert.deepEqual(body.extra[2].coordinates, pathArea.coordinates)
    assert.equal(body.extra[2].pathDistanceMeters, 200)
    assert.deepEqual(body.extra[3].circle, circleArea.circle)
  }
  await page.getByRole('button',{name:'GeoJSON 素材库',exact:true}).click()
  await page.locator('tr[data-row-key="asset-1"]').getByText('已发布',{exact:true}).waitFor()
  assert.equal(await page.locator('tr[data-row-key="asset-1"]').getByRole('button',{name:'发布',exact:true}).count(),0)
  await page.waitForFunction(() => !document.querySelector('.ant-message-notice'))
  await page.locator('.ant-modal-content').screenshot({path:'build/checks/geojson-asset-published.png',animations:'disabled'})
  assert.deepEqual(errors,[])
  console.log('PASS: published badge, linked zone editing, read-only load, failed-save retry, GCJ-02 shapes, announcements and multiple UTC+8 periods preserved.')
} finally { await browser?.close(); await server.close() }
