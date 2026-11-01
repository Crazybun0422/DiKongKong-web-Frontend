import assert from 'node:assert/strict'
import { createServer } from 'vite'
import vue from '@vitejs/plugin-vue'
import { chromium } from 'playwright'
import fs from 'node:fs'
const entry='/virtual-member-gifts.js'
const server=await createServer({configFile:false,logLevel:'error',define:{'import.meta.env.VITE_API_BASE_URL':JSON.stringify('/api')},server:{host:'127.0.0.1',port:0},plugins:[vue(),{name:'member-gift-check',resolveId:id=>id===entry?id:null,load:id=>id===entry?`import {createApp} from 'vue';import Antd from 'ant-design-vue';import Component from '/src/components/MemberGiftPanel.vue';localStorage.setItem('dikongkong_token','admin-test');createApp(Component).use(Antd).mount('#app');`:null,configureServer(s){s.middlewares.use('/__gift-check',(_,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<div id="app"></div><script type="module" src="${entry}"></script>`);});}}]})
let browser
try {
 await server.listen();browser=await chromium.launch({headless:true})
 const page=await browser.newPage({viewport:{width:1360,height:950}});page.setDefaultTimeout(15000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 const requests=[],logs=[];let fail=true
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url());assert.equal(req.headers().authorization,'Bearer admin-test')
  let data
  if(url.pathname==='/api/admin/users/search')data={content:[{id:1,username:'测试飞友',featureCode:'123456',member:true,memberExpireDate:'2027-01-31'}],totalElements:1,page:0,size:20}
  else if(req.method()==='POST') {
   const body=req.postDataJSON();requests.push(body)
   if(fail){await route.fulfill({status:503,json:{success:false,message:{zh:'暂时失败，请重试'}}});return}
   data={id:1,...body,username:'测试飞友',adminUsername:'测试管理员',baseDate:'2027-01-31',beforeExpireDate:'2027-01-31',afterExpireDate:'2027-04-30',createdAt:'2026-09-30T19:00:00'};logs.push(data)
  } else data={content:logs,page:0,size:10,totalElements:logs.length}
  await route.fulfill({json:{success:true,data}})
 })
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__gift-check`)
 const grant=page.getByRole('button',{name:'赠送会员',exact:true})
 assert.equal(await grant.isDisabled(),true)
 await page.getByPlaceholder('输入用户名或6位特征码').fill('123456')
 await page.getByRole('button',{name:'搜索用户'}).click()
 await page.locator('.user-select').click();await page.locator('.ant-select-item-option-content').getByText('测试飞友（123456）',{exact:true}).click()
 await page.locator('input.ant-input-number-input').fill('3')
 await page.getByPlaceholder('填写赠送原因，记录到操作日志').fill('活动赠送')
 await grant.click();assert.equal(requests.length,0,'confirmation must precede the mutation')
 await page.locator('.ant-modal-confirm .ant-btn-primary').click();await page.getByText('暂时失败，请重试',{exact:true}).waitFor()
 assert.equal(requests.length,1);fail=false
 await page.locator('.ant-modal-confirm').waitFor({state:'hidden'});await grant.click()
 await page.locator('.ant-modal-confirm .ant-btn-primary').click()
 await page.getByText('赠送成功，会员有效期至 2027-04-30',{exact:true}).waitFor()
 assert.equal(requests.length,2);assert.equal(requests[0].requestId,requests[1].requestId,'network retries retain idempotency key')
 assert.equal(requests[1].quantity,3);assert.equal(requests[1].unit,'MONTH')
 await page.locator('.ant-table-tbody').getByText('测试管理员',{exact:true}).waitFor()
 await page.getByText('按年赠送',{exact:true}).click()
 assert.equal(await page.locator('input.ant-input-number-input').inputValue(),'1')
 fs.mkdirSync('build/checks',{recursive:true});await page.screenshot({path:'build/checks/member-gifts.png',fullPage:true})
 assert.deepEqual(errors,[]);console.log('PASS: user search/selection, duration, confirmation, retry idempotency, updated expiry and audit display.')
} finally {await browser?.close();await server.close()}
