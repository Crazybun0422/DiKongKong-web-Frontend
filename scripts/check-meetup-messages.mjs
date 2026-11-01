import assert from 'node:assert/strict'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { chromium } from 'playwright'
import fs from 'node:fs'
const entry='/virtual-meetup-messages.js'
const server=await createServer({configFile:false,logLevel:'error',define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('/api')},server:{host:'127.0.0.1',port:0},plugins:[vue(),{name:'meetup-admin-check',resolveId:id=>id===entry?id:null,load:id=>id===entry?`import {createApp} from 'vue';import Antd from 'ant-design-vue';import Component from '/src/views/dashboard/FlightMeetupView.vue';localStorage.setItem('dikongkong_token','admin-test');createApp(Component).use(Antd).mount('#app');`:null,configureServer(s){s.middlewares.use('/__meetup-check',(_,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<div id="app"></div><script type="module" src="${entry}"></script>`);});}}]})
let browser
try{
 await server.listen();browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1360,height:900}});page.setDefaultTimeout(12000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 const event={id:'event-1',title:'周末江边约飞',host:{name:'发起人',featureCode:'123456'},startsAt:Date.now(),endsAt:Date.now()+3600000,address:'滨江公园',joinedCount:3,capacity:6,status:'PUBLISHED',participants:[]}
 const other={...event,id:'event-2',title:'另一场约飞',status:'DELETED'}
 const rows=Array.from({length:35},(_,i)=>({id:String(9007199254740993n+BigInt(i)),content:i===34?'集合点见\n记得带备用电池 <img src=x onerror=alert(1)>':'留言 '+i,createdAt:Date.now(),sender:{name:'飞友'+i,featureCode:'000002',avatarUrl:''}}))
 let fail=false,hold=false,release;const requests=[]
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url());assert.equal(req.headers().authorization,'Bearer admin-test');assert.equal(req.method(),'GET');requests.push(url)
  let data
  if(url.pathname==='/api/flight-meetups/admin')data={items:[event,other],total:2}
  else if(url.pathname.endsWith('/messages')){
   if(hold){hold=false;await new Promise(r=>release=r)}
   if(fail){await route.fulfill({status:500,json:{success:false,message:{zh:'加载失败，请重试'}}});return;}
   const source=url.pathname.includes('event-2')?[]:rows,before=url.searchParams.get('before');const selected=before?source.filter(r=>BigInt(r.id)<BigInt(before)):source;data={items:selected.slice(-30),hasMore:selected.length>30,canSend:false}
  }else data=event
  await route.fulfill({json:{success:true,data}})
 })
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__meetup-check`)
 const open=()=>page.getByRole('button',{name:'留言板',exact:true}).first().click()
 await open();await page.locator('.board-message').nth(29).waitFor();assert.equal(await page.locator('.board-message').count(),30)
 assert((await page.locator('.board-message-content').first().innerText()).includes('\n'))
 assert.equal(await page.locator('.board-message-content img').count(),0,'message text must not execute HTML')
 await page.getByRole('button',{name:'加载更早留言'}).click();await page.locator('.board-message').nth(34).waitFor();assert.equal(requests.at(-1).searchParams.get('before'),rows[5].id,'cursor retains full integer precision')
 await page.getByText('已显示全部留言').waitFor();fs.mkdirSync('build/checks',{recursive:true});await page.screenshot({path:'build/checks/meetup-admin-messages.png'})
 fail=true;await page.getByRole('button',{name:'刷新留言'}).click();await page.getByText('加载失败，请重试',{exact:true}).waitFor();assert.equal(await page.locator('.board-message').count(),0)
 fail=false;await page.getByRole('button',{name:/重\s*试/}).click();await page.locator('.board-message').nth(29).waitFor()
 await page.locator('.ant-drawer-close').click();await page.locator('.meetup-board-admin').waitFor({state:'hidden'})
 hold=true;await open();await page.waitForFunction(()=>document.querySelector('.ant-spin-spinning'))
 await page.locator('.ant-drawer-close').click();await page.getByRole('button',{name:'留言板',exact:true}).nth(1).click();await page.getByText('暂无留言',{exact:true}).waitFor();release();await page.waitForTimeout(100)
 assert.equal(await page.locator('.board-message').count(),0,'late first-event response cannot appear in another event')
 await page.locator('.ant-drawer-close').click();await page.getByRole('button',{name:/详\s*情/}).first().click();await page.getByRole('button',{name:'查看留言板',exact:true}).click();await page.locator('.board-message').nth(29).waitFor()
 assert.deepEqual(errors,[]);console.log('PASS: admin list/detail entries, history, string cursor, sender/time, safe multiline text, retry, deleted-event empty state and stale-response isolation.')
}finally{await browser?.close();await server.close()}
