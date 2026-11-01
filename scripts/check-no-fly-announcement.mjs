import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createServer} from 'vite'
import vue from '@vitejs/plugin-vue'
import {chromium} from 'playwright'
const entry='/virtual-announcement-check.js'
const fixture={title:'关于活动期间临时空域管制的公告',publisher:'市公安局',publishedAt:'2026-10-05',content:'<h2>一、管制时段</h2><p>2026年10月9日00:00至24:00。</p><h2>二、管制范围</h2><p>活动场馆及周边道路，请查看公告附图。</p>',sourceUrl:'https://example.gov.cn/notice',attachments:[]}
const server=await createServer({configFile:false,logLevel:'error',define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('/api')},server:{host:'127.0.0.1',port:0},plugins:[vue(),{name:'fixture',resolveId:id=>id===entry?id:null,load:id=>id===entry?`import {createApp,ref,h} from 'vue';import Antd from 'ant-design-vue';import Editor from '/src/components/noFlyZones/AnnouncementEditor.vue';const a=ref(${JSON.stringify(fixture)});window.announcement=a;createApp({render:()=>h(Editor,{modelValue:a.value,'onUpdate:modelValue':v=>a.value=v})}).use(Antd).mount('#app');`:null,configureServer(s){s.middlewares.use('/__announcement',(_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end('<meta name="viewport" content="width=device-width,initial-scale=1"><div id="app"></div><script type="module" src="'+entry+'"></script>')})}}]})
let browser
try{await server.listen();browser=await chromium.launch({headless:true});for(const width of [393,1200]){
 const page=await browser.newPage({viewport:{width,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.message));let uploads=0
 await page.route('**/api/admin/no-fly-zones/announcement-files',async r=>{uploads++;assert(r.request().postDataBuffer().includes(Buffer.from('%PDF-1.7')));await r.fulfill({status:201,json:{success:true,data:{name:'原始通告.pdf',url:'/api/no-fly-zone-announcement-files/0123456789abcdef0123456789abcdef.pdf',mediaType:'application/pdf',size:8}}})})
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__announcement`)
 await page.locator('.body-editor').getByText('一、管制时段',{exact:true}).waitFor()
 await page.locator('input[type=file]').nth(1).setInputFiles({name:'原始通告.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7')})
 await page.waitForFunction(()=>announcement.value.attachments.length===1);assert.equal(uploads,1)
 // Hostile copied markup must be cleaned before the editor displays it.
 await page.locator('.body-editor').evaluate(el=>{el.focus();const data=new DataTransfer();data.setData('text/html','<p onclick="alert(1)">补充正文<script>window.bad=1</script><a href="javascript:alert(1)">链接</a></p>');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}))})
 assert.equal(await page.evaluate(()=>window.bad),undefined)
 assert(!(await page.evaluate(()=>announcement.value.content)).includes('onclick'))
 await page.getByRole('button',{name:'查看公告',exact:true}).click();await page.locator('.announcement-paper').waitFor()
 assert.equal(await page.locator('.announcement-paper footer a').getAttribute('href'),fixture.sourceUrl)
 assert.equal(await page.locator('.announcement-paper .announcement-files a').getAttribute('href'),'/api/no-fly-zone-announcement-files/0123456789abcdef0123456789abcdef.pdf')
 assert(await page.locator('.announcement-paper').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'preview must fit viewport')
 fs.mkdirSync('build/checks',{recursive:true});await page.screenshot({path:`build/checks/no-fly-announcement-${width}.png`,fullPage:true,animations:'disabled'})
 assert.deepEqual(errors,[]);await page.close()
}console.log('PASS: web announcement paste sanitation, server attachment upload and fixed preview at 393/1200px')}
finally{await browser?.close();await server.close()}
