const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require('../node_modules/playwright');
const miniRoot = 'E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const androidRoot = 'D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity';
global.getApp = () => ({globalData:{apiBase:'https://current-api.example'}});
const profile = require(miniRoot+'/utils/profile.js');
const mini = require(miniRoot+'/packages/market/api.js');
const source = fs.readFileSync(androidRoot+'/source.js','utf8');
const start=source.indexOf('MiniSource.modules["packages/market/api.js"]');
const end=source.indexOf('MiniSource.modules[',start+1);
const sandbox={MiniSource:{modules:{}}};
vm.runInNewContext(source.slice(start,end),sandbox);
const moduleValue={exports:{}};
sandbox.MiniSource.modules['packages/market/api.js'](()=>profile,moduleValue,moduleValue.exports,null,null,null,s=>s);
for(const [name,api] of [['mini',mini],['android',moduleValue.exports]]){
 for(const input of ['商品 图.png','http://old-host/api/files/download/%E5%95%86%E5%93%81%20%E5%9B%BE.png?token=old','https://old-host/storage/商品 图.png','/api/files/download/商品 图.png']){
  const expected='https://current-api.example/api/files/download/'+encodeURIComponent('商品 图.png');
  assert.equal(api.product({imageUrl:input}).imageUrl,expected,name+' product');
  assert.equal(api.order({imageUrl:input}).imageUrl,expected,name+' order');
 }
 assert.equal(api.product({imageUrl:''}).imageUrl,'');
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.addInitScript(()=>localStorage.setItem('dikongkong_token','fixture'));
  const image=fs.readFileSync(miniRoot+'/packages/market/assets/logo.png');
  let saved,uploaded=false;
  const product={id:1,revision:1,title:'测试商品',brand:'星球好物',category:'配件',imageUrl:'http://retired-host/storage/legacy.png',originalPrice:10,maxFlp:2,costPrice:7,supplier:'供应商',stock:2,published:true,presale:false};
  await page.route('**/api/**',async route=>{
   const req=route.request(),p=new URL(req.url()).pathname;
   if(p.startsWith('/api/files/download/'))return route.fulfill({contentType:'image/png',body:image});
   let data={};
   if(p==='/api/files/upload'){uploaded=true;data='http://upload-host/api/files/download/uploaded.png';}
   else if(p==='/api/market/admin/products' && req.method()==='GET')data={content:[product],totalElements:1};
   else if(p==='/api/market/admin/products/1'){saved=req.postDataJSON();data=saved;}
   return route.fulfill({json:{success:true,data}});
  });
  await page.goto('http://127.0.0.1:5179/admin/planet-market');
  await page.getByRole('button',{name:'编辑',exact:true}).click();
  assert((await page.locator('.product img').getAttribute('src')).endsWith('/api/files/download/legacy.png'));
  await page.locator('input[type=file]').setInputFiles({name:'uploaded.png',mimeType:'image/png',buffer:image});
  await page.waitForFunction(()=>document.querySelector('.preview')?.src.endsWith('/api/files/download/uploaded.png') && document.querySelector('.preview').naturalWidth>0);
  await page.getByRole('button',{name:/保\s*存/}).click();
  await page.waitForFunction(()=>!document.querySelector('.ant-modal-wrap')||getComputedStyle(document.querySelector('.ant-modal-wrap')).display==='none');
  assert(uploaded);assert.equal(saved.imageUrl,'uploaded.png');
  console.log('PASS: mini + Android product/order filename extraction; legacy HTTP/HTTPS URLs; encoded filenames; admin upload, decoded preview, filename-only save.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
