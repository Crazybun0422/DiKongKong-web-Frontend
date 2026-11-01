import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { chromium } from 'playwright'

const entry = '/virtual-geojson-manager.js'
const server = await createServer({ configFile: false, logLevel: 'error',
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
  await page.route('https://flysafe-api.dji.com/**', route => route.fulfill({json:{areas:[{level:2,color:'#DE4329',shape:0,lng:114,lat:30,radius:600}]}}))
  const source = { type:'Polygon', coordinates:[[[114,30],[114.1,30],[114.1,30.1],[114,30]]] }
  const zone = { name:'外部上传的素材',type:'POLYGON',
    coordinates:[{longitude:114.005,latitude:29.997},{longitude:114.105,latitude:29.997},{longitude:114.105,latitude:30.097},{longitude:114.005,latitude:29.997}],
    effectiveFrom:1893456017,effectiveTo:1893459623,
    effectivePeriods:[{effectiveFrom:1893542417,effectiveTo:1893546023}],extra:[] }
  const asset = {id:'asset-1',title:zone.name,sourceUrl:'https://example.org/notice',sourceGeoJson:source,geoJson:source,draft:zone,
    effectivePeriods:[{effectiveFrom:zone.effectiveFrom,effectiveTo:zone.effectiveTo},...zone.effectivePeriods]}
  let saved = null
  let failSave = false
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname
    if(new URL(req.url()).hostname==='flysafe-api.dji.com')return route.fallback()
    assert.equal(req.headers().authorization,'Bearer admin-test')
    let data = {}
    if(req.method() !== 'GET') {
      writes.push({path, body:req.postDataJSON()})
      assert(path.startsWith('/api/admin/no-fly-zones'))
      if(failSave) { await route.fulfill({status:500,json:{success:false}}); return }
      saved = {id:'saved-1',...req.postDataJSON()}; data = saved
    }
    else if(path === '/api/admin/geojson-assets/asset-1') data = asset
    else if(path === '/api/admin/geojson-assets') data = {content:[asset],page:0,size:10,totalElements:1,totalPages:1}
    else if(path.endsWith('/saved-1')) data = saved
    else if(path === '/api/admin/no-fly-zones') data = {content:saved?[saved]:[],page:0,size:10,totalElements:saved?1:0,totalPages:saved?1:0}
    else if(path.endsWith('/rich-text-config')) data = {content:''}
    await route.fulfill({json:{success:true,data}})
  })
  await page.addInitScript(() => {
    window.mapHandles=[];window.mapShapes=[];window.mapEvents=[]
    class LatLng { constructor(lat,lng){this.lat=lat;this.lng=lng} getLat(){return this.lat} getLng(){return this.lng} }
    class Overlay {
      constructor(options={}){Object.assign(this,options);window.mapShapes.push(this)}
      setMap(map){this.map=map} setPath(path){this.path=path} setOptions(options){Object.assign(this,options)}
      setCenter(center){this.center=center} setRadius(radius){this.radius=radius} setClickable(v){this.clickable=v}
      setStyle(){} setVisible(v){this.visible=v} setPosition(p){this.position=p} getPosition(){return this.position}
    }
    class Marker extends Overlay {constructor(o){super(o);window.mapHandles.push(this)}}
    class Map {constructor(el,o){Object.assign(this,o);window.testMap=this} setMapTypeId(){} setCenter(v){this.center=v} getCenter(){return this.center} getBounds(){return {getNorthEast:()=>new LatLng(31,115),getSouthWest:()=>new LatLng(30,114)}} setZoom(v){this.zoom=v} getZoom(){return this.zoom} fitBounds(){} destroy(){} }
    window.qq={maps:{Map,LatLng,Marker,Polygon:Overlay,Polyline:Overlay,Circle:Overlay,Label:Overlay,MarkerImage:class{},Point:class{},Size:class{},Color:class{},LatLngBounds:class{extend(){}},MapTypeId:{ROADMAP:'road',HYBRID:'satellite'},event:{
      addListener(target,event,handler){const token={target,event,handler,active:true};window.mapEvents.push(token);return token},
      removeListener(t){t.active=false},trigger(target,event,payload){window.mapEvents.filter(t=>t.active&&t.target===target&&t.event===event).forEach(t=>t.handler(payload||{}))},
    }}}
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
  await page.getByText('已显示当前地图范围',{exact:true}).waitFor()
  assert.equal(await page.evaluate(()=>mapShapes.filter(s=>s.map&&s.zIndex===1).length),1)
  await page.getByRole('switch',{name:'大疆禁飞区对照'}).click()
  await page.waitForFunction(()=>mapShapes.filter(s=>s.map&&s.zIndex===1).length===0)
  await page.getByRole('switch',{name:'大疆禁飞区对照'}).click()
  await page.getByText('已显示当前地图范围',{exact:true}).waitFor()
  fs.mkdirSync('build/checks',{recursive:true})
  await page.locator('.map-panel').screenshot({path:'build/checks/no-fly-dji-reference.png'})
  await loadMaterial()
  assert.equal(writes.length,0)
  assert(await page.evaluate(()=>mapShapes.some(s=>s.map&&s.path&&s.zIndex===10)), 'editable polygon stays above DJI reference')
  const handles=()=>page.evaluate(()=>mapHandles.filter(m=>m.map&&m.draggable).length)
  await page.waitForFunction(()=>mapHandles.filter(m=>m.map&&m.draggable).length===6)
  await page.evaluate(()=>{
    const marker=mapHandles.find(m=>m.map&&m.draggable&&!m.title.includes('新增'))
    const p=new qq.maps.LatLng(29.98,114.02)
    qq.maps.event.trigger(marker,'dragging',{latLng:p})
    qq.maps.event.trigger(marker,'dragend',{latLng:p})
  })
  await page.waitForFunction(()=>mapHandles.some(m=>m.map&&m.draggable&&m.position.getLat()===29.98))
  await page.evaluate(()=>qq.maps.event.trigger(mapHandles.filter(m=>m.map&&m.draggable&&m.title.includes('新增')).at(-1),'click'))
  await page.waitForFunction(()=>mapHandles.filter(m=>m.map&&m.draggable).length===8)
  await page.locator('.map-container').focus()
  await page.keyboard.press('Control+z')
  await page.waitForFunction(()=>mapHandles.filter(m=>m.map&&m.draggable).length===6)
  await page.keyboard.press('Control+z')
  await page.waitForFunction(()=>mapHandles.some(m=>m.map&&m.draggable&&m.position.getLat()===29.997))
  // A fresh drag after undo creates a new branch; no server request is made.
  await page.evaluate(()=>{
    const marker=mapHandles.find(m=>m.map&&m.draggable&&!m.title.includes('新增'))
    const p=new qq.maps.LatLng(29.98,114.02)
    qq.maps.event.trigger(marker,'dragend',{latLng:p})
  })
  await page.waitForFunction(()=>mapHandles.some(m=>m.map&&m.draggable&&m.position.getLat()===29.98))
  await page.evaluate(()=>qq.maps.event.trigger(mapHandles.filter(m=>m.map&&m.draggable&&m.title.includes('新增')).at(-1),'click'))
  await page.waitForFunction(()=>mapHandles.filter(m=>m.map&&m.draggable).length===8)
  await page.getByRole('button',{name:'保存到临时禁飞区',exact:true}).click()
  await page.locator('tr[data-row-key="saved-1"]').getByText(zone.name,{exact:true}).waitFor()
  const updated=writes.at(-1).body.coordinates
  assert.equal(updated.length,5);assert.deepEqual(updated[0],{latitude:29.98,longitude:114.02});assert.deepEqual(updated[0],updated.at(-1))
  assert.equal(writes.length,1,'dragging and inserting do not auto-publish')
  const row=page.locator('tr[data-row-key="saved-1"]')
  await row.getByRole('button',{name:/编\s*辑/}).click()
  await page.waitForFunction(()=>mapHandles.filter(m=>m.map&&m.draggable).length===8)
  await page.evaluate(()=>{
    const marker=mapHandles.filter(m=>m.map&&m.draggable&&m.title.includes('新增'))[1]
    const p=new qq.maps.LatLng(30.04,114.11)
    qq.maps.event.trigger(marker,'dragging',{latLng:p});qq.maps.event.trigger(marker,'dragend',{latLng:p});qq.maps.event.trigger(marker,'click')
  })
  await page.waitForFunction(()=>mapHandles.filter(m=>m.map&&m.draggable).length===10)
  assert.equal(writes.length,1)
  await page.getByRole('button',{name:/^重\s*置$/}).click()
  assert.equal(await handles(),0,'reset removes all edit handles')
  await page.getByRole('button',{name:'开始绘制',exact:true}).click()
  await page.evaluate(()=>{
    const map=mapEvents.find(t=>t.active&&t.event==='click'&&t.target instanceof qq.maps.Map).target
    for(const [lat,lng] of [[30,114],[30,114.1],[30.1,114.1]]) qq.maps.event.trigger(map,'click',{latLng:new qq.maps.LatLng(lat,lng)})
  })
  await page.getByRole('button',{name:'完成绘制',exact:true}).click()
  await page.waitForFunction(()=>mapHandles.filter(m=>m.map&&m.draggable).length===6)
  assert.equal(writes.length,1,'newly finished drawing exposes editing handles without saving automatically')
  // Loaded rectangles remain rectangles; corridors use open path edit handles.
  for(const type of ['RECTANGLE','PATH','CIRCLE']) {
    zone.type=type
    zone.coordinates=type==='RECTANGLE'
      ? [{latitude:31,longitude:114},{latitude:31,longitude:115},{latitude:30,longitude:115},{latitude:30,longitude:114},{latitude:31,longitude:114}]
      : [{latitude:30,longitude:114},{latitude:31,longitude:115}]
    if(type==='CIRCLE') {zone.coordinates=[];zone.circle={latitude:30,longitude:114,radiusMeters:35}}
    zone.pathDistanceMeters=280
    await loadMaterial()
    const count=type==='CIRCLE'?1:type==='RECTANGLE'?4:3
    await page.waitForFunction(n=>mapHandles.filter(m=>m.map&&m.draggable).length===n,count)
    await page.evaluate(()=>{
      const marker=mapHandles.find(m=>m.map&&m.draggable&&!m.title.includes('新增'))
      const p=new qq.maps.LatLng(31.2,113.8)
      qq.maps.event.trigger(marker,'dragging',{latLng:p});qq.maps.event.trigger(marker,'dragend',{latLng:p})
    })
    await page.waitForFunction(()=>mapHandles.some(m=>m.map&&m.draggable&&m.position.getLat()===31.2))
    await page.locator('.map-container').focus();await page.keyboard.press('Control+z')
    await page.waitForFunction(()=>!mapHandles.some(m=>m.map&&m.draggable&&m.position.getLat()===31.2))
    await page.evaluate(()=>{
      const marker=mapHandles.find(m=>m.map&&m.draggable&&!m.title.includes('新增'))
      qq.maps.event.trigger(marker,'dragend',{latLng:new qq.maps.LatLng(31.2,113.8)})
    })
    await page.waitForFunction(()=>mapHandles.some(m=>m.map&&m.draggable&&m.position.getLat()===31.2))
    if(type==='PATH') {
      await page.evaluate(()=>qq.maps.event.trigger(mapHandles.find(m=>m.map&&m.draggable&&m.title.includes('新增')),'click'))
      await page.waitForFunction(()=>mapHandles.filter(m=>m.map&&m.draggable).length===5)
    }
    await page.getByRole('button',{name:'保存到临时禁飞区',exact:true}).click()
    await page.locator('tr[data-row-key="saved-1"]').getByText(zone.name,{exact:true}).waitFor()
    const body=writes.at(-1).body
    assert.equal(body.type,type)
    if(type==='CIRCLE') assert.deepEqual(body.circle,{latitude:31.2,longitude:113.8,radiusMeters:35})
    else assert.deepEqual(body.coordinates[0],{latitude:31.2,longitude:113.8})
    if(type==='RECTANGLE') {
      assert.equal(new Set(body.coordinates.map(p=>p.latitude)).size,2)
      assert.equal(new Set(body.coordinates.map(p=>p.longitude)).size,2)
      assert.deepEqual(body.coordinates[0],body.coordinates.at(-1))
    } else if(type==='PATH') { assert.equal(body.coordinates.length,3);assert.equal(body.pathDistanceMeters,280) }
    if(type==='CIRCLE') {
      await page.locator('tr[data-row-key="saved-1"]').getByRole('button',{name:/编\s*辑/}).click()
      await page.waitForFunction(()=>mapHandles.filter(m=>m.map&&m.draggable).length===1)
      assert(await page.evaluate(()=>mapShapes.some(m=>m.map&&m.radius===35&&m.center?.getLat()===31.2)),'saved circle reopens with edited center and unchanged radius')
    }
  }
  await page.getByRole('button',{name:/^重\s*置$/}).click()
  await page.getByRole('button',{name:'开始绘制',exact:true}).click()
  await page.evaluate(()=>{
    const map=mapEvents.find(t=>t.active&&t.event==='click'&&t.target instanceof qq.maps.Map).target
    for(const [lat,lng] of [[30,114],[30,114.1],[30.1,114.1]])qq.maps.event.trigger(map,'click',{latLng:new qq.maps.LatLng(lat,lng)})
  })
  await page.locator('.map-container').focus();await page.keyboard.press('Control+z')
  await page.evaluate(()=>qq.maps.event.trigger(mapEvents.find(t=>t.active&&t.event==='click'&&t.target instanceof qq.maps.Map).target,'click',{latLng:new qq.maps.LatLng(30.2,114.2)}))
  await page.getByRole('button',{name:'完成绘制',exact:true}).click()
  await page.waitForFunction(()=>mapHandles.filter(m=>m.map&&m.draggable).length===6)
  const positions=await page.evaluate(()=>mapHandles.filter(m=>m.map&&m.draggable&&!m.title.includes('新增')).map(m=>[m.position.getLat(),m.position.getLng()]))
  assert.deepEqual(positions,[[30,114],[30,114.1],[30.2,114.2]],'Ctrl+Z removes just the latest drawing point')
  assert.deepEqual(errors,[])
  console.log('PASS: polygon drag/insert undo, loaded rectangle, circle center and open buffer path editing/undo/save, point-by-point drawing undo, reset and listener cleanup. SDK events simulated locally.')
} finally {await browser?.close();await server.close()}
