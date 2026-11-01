import assert from 'node:assert/strict'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { chromium } from 'playwright'
const entry='/virtual-town-check.js'
const server=await createServer({configFile:false,logLevel:'error',define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('/api')},server:{host:'127.0.0.1',port:0},plugins:[vue(),{name:'town-check',resolveId:id=>id===entry?id:null,load:id=>id===entry?`
import {createApp} from 'vue';import Antd from 'ant-design-vue';import {createI18n} from 'vue-i18n';import zh from '/src/locales/zh-CN.json';
import Manager from '/src/components/noFlyZones/TemporaryNoFlyZoneManager.vue';import Upload from '/src/components/TownKmlUpload.vue';
localStorage.setItem('dikongkong_token','admin-test');
const app=createApp(Manager).use(Antd).use(createI18n({legacy:false,locale:'zh-CN',messages:{'zh-CN':zh}}));app.mount('#manager');window.manager=app._instance.setupState;
const up=createApp(Upload).use(Antd);up.mount('#upload');window.upload=up._instance.setupState;`:null,configureServer(s){s.middlewares.use('/__town-check',(_,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<div id="upload"></div><div id="manager"></div><script type="module" src="${entry}"></script>`);});}}]})
let browser
try {
 await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage();page.setDefaultTimeout(15000)
 const requests=[],writes=[],errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**',r=>r.abort())
 const points=[{longitude:113,latitude:28},{longitude:113.1,latitude:28},{longitude:113.1,latitude:28.1}]
 await page.route('**/api/**',async r=>{const req=r.request(),u=new URL(req.url());requests.push(u.pathname+u.search);assert.equal(req.headers().authorization,'Bearer admin-test');let data={}
   if(u.pathname==='/api/config/town-kml') {data={version:'2026.10.02',revision:'r1',townCount:2};if(req.method()==='POST'){assert(req.postData().includes('GCJ02'));writes.push(u.pathname)}}
   else if(u.pathname==='/api/town-regions/search') {const q=u.searchParams.get('keyword');data={revision:'r1',total:q.includes('不存在')?0:1,items:q.includes('不存在')?[]:[{id:'t',name:'青山镇',level:'town',path:'湖南省 / 长沙市 / 长沙县 / 青山镇'}]}}
   else if(u.pathname==='/api/town-regions') {const ids=['','p','c','x'],names=['湖南省','长沙市','长沙县','青山镇'],levels=['province','city','county','town'],i=ids.indexOf(u.searchParams.get('parentId'));data={revision:'r1',items:[{id:['p','c','x','t'][i],name:names[i],level:levels[i]}]}}
   else if(u.pathname.endsWith('/geometry')) {await r.fulfill({json:{id:'t',name:'青山镇',coordinateSystem:'GCJ02',parts:[points,points.map(p=>({...p,longitude:p.longitude+.2}))],polygons:[{points}]}});return}
   else if(u.pathname==='/api/admin/no-fly-zones') {if(req.method()==='POST'){writes.push(req.postDataJSON());data={id:'1',...req.postDataJSON()}}else data={content:[],totalElements:0,page:0,size:10}}
   else if(u.pathname.endsWith('/rich-text-config'))data={content:''}
   await r.fulfill({json:{success:true,data}})
 })
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__town-check`)
 await page.locator('#upload input[type=file]').setInputFiles({name:'town.zip',mimeType:'application/zip',buffer:Buffer.from('fixture')});await page.getByPlaceholder('例如 2026.10.02').fill('2026.10.02');await page.getByRole('button',{name:'上传并发布'}).click();await page.getByText('镇级范围已更新，共 2 个镇').waitFor()
 await page.getByRole('button',{name:'加载镇级范围'}).click()
 const search=page.getByPlaceholder('搜索镇、街道或省市县，例如：长沙 青山镇')
 await search.fill('不存在');await page.getByText('未找到匹配的镇或街道').waitFor()
 await search.fill('长沙 青山');await page.getByText('湖南省 / 长沙市 / 长沙县 / 青山镇',{exact:true}).waitFor()
 assert(!requests.some(x=>x.includes('/geometry')),'search does not download any geometry')
 await search.fill('');await page.locator('.town-region-picker').getByRole('button',{name:'湖南省 ›'}).waitFor()
 for(const name of ['湖南省','长沙市','长沙县'])await page.locator('.town-region-picker').getByRole('button',{name:name+' ›'}).click()
 assert(!requests.some(x=>x.includes('/geometry')),'directories never download geometry')
 await search.fill('长沙 青山');await page.getByText('湖南省 / 长沙市 / 长沙县 / 青山镇',{exact:true}).waitFor();
 await page.locator('.town-region-picker').getByRole('button',{name:'青山镇 湖南省 / 长沙市 / 长沙县 / 青山镇',exact:true}).click();await page.getByText('已加载 青山镇').waitFor()
 const form=await page.evaluate(()=>JSON.parse(JSON.stringify(manager.formState)));assert.equal(form.areas.length,2,'all detached regions retained');assert.deepEqual(form.areas[0].coordinates,points,'GCJ-02 not converted twice');assert.equal(writes.length,1,'selection does not publish a no-fly zone')
 await page.evaluate(async()=>{manager.formState.name='镇级测试范围';manager.formState.timeRange=['2030-01-01 08:00','2030-01-02 08:00'];await manager.handleSubmit()})
 assert.equal(writes.length,2);assert.deepEqual(writes[1].coordinates,points);assert.equal(writes[1].extra.length,1)
 assert.deepEqual(errors,[]);console.log('PASS: town upload, lazy hierarchy, download only selected town, all polygon parts saved without coordinate shift.')
} finally {await browser?.close();await server.close()}
