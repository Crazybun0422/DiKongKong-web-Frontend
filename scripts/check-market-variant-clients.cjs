const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {fixture,server}=require('D:/Workspace/LowLatitudePlanet/scripts/check-mini-flows.cjs');
const {chromium}=require('playwright');
const mini='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram',android='D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity';
global.getApp=()=>({globalData:{apiBase:'https://current-api.example'}});
const profile=require(mini+'/utils/profile.js');
const sandbox={MiniSource:{modules:{},definitions:{'packages/market/index/index':{},'packages/market/detail/index':{},'packages/market/orders/index':{}}}};
vm.runInNewContext(fs.readFileSync(android+'/market-variant-fixes.js','utf8'),sandbox);
const m={exports:{}};sandbox.MiniSource.modules['packages/market/api.js'](()=>profile,m,m.exports,null,null,null,s=>s);
for(const [name,api] of [['mini',require(mini+'/packages/market/api.js')],['android',m.exports]]){
 const p=api.product({imageUrl:'cover.png',variants:[{id:'a',imageUrl:'http://retired.example/files/spec%20one.png?old=1'},{id:'b'}]});
 assert.equal(p.variants[0].imageUrl,'https://current-api.example/api/files/download/spec%20one.png',name);
 assert.equal(p.variants[1].imageUrl,p.imageUrl,name+' cover fallback');
}
const product={id:7,title:'飞行收纳包',imageUrl:'cover.png',imageUrls:['cover.png'],originalPrice:10,cashPrice:8,maxFlp:2,stock:9,variants:[{id:'a',name:'标准版',imageUrl:'http://old.example/spec-a.png',originalPrice:10,cashPrice:8,maxFlp:2,stock:3},{id:'b',name:'双电池套装',imageUrl:'spec-b.png',originalPrice:20,cashPrice:17,maxFlp:3,stock:3},{id:'c',name:'无规格图套餐',originalPrice:10,cashPrice:8,maxFlp:2,stock:3}]};
const setup=`const product=${JSON.stringify(product)};const original=AndroidMini.call;AndroidMini.call=(id,method,payload)=>{const args=JSON.parse(payload);if(method==='request'&&args.url.includes('/api/market/')){platformCalls.push({method,args});const p=new URL(args.url).pathname;let data;if(p.endsWith('/config'))data={closed:false};else if(p.endsWith('/latest'))data={version:7};else if(p.endsWith('/categories'))data=[];else if(p==='/api/market/products')data={content:[product],last:true};else if(p==='/api/market/products/7')data=product;else if(p==='/api/market/orders')data={content:[{id:'LLP202610081200000001',title:'飞行收纳包',imageUrl:'spec-b.png',variantName:'双电池套装',quantity:1,cash:17,flp:3,status:'WAITING_PAYMENT',recipient:'测试飞友',phone:'13800138000',address:'测试路1号'}],last:true};else throw Error(p);setTimeout(()=>miniReply(id,true,{statusCode:200,data:{success:true,data}}),0);return;}return original(id,method,payload);};`;
const out='artifacts/market-variant-images';fs.mkdirSync(out,{recursive:true});
server.listen(0,'127.0.0.1',async()=>{let browser;try{browser=await chromium.launch({headless:true});for(const width of [320,393,1200]){
 const page=await browser.newPage({viewport:{width,height:900},bypassCSP:true});
 await page.route('**/runtime.js',r=>r.fulfill({contentType:'text/javascript',body:setup+fs.readFileSync(android+'/runtime.js','utf8')}));
 await fixture(page,'packages/market/index/index');
 await page.route('**/api/files/download/**',r=>r.fulfill({contentType:'image/png',body:fs.readFileSync(mini+'/packages/market/assets/logo.png')}));
 await page.reload();await page.locator('.product-card').click();await page.locator('.buy-bar .flp-buy').click();
 for(const [name,file] of [['标准版','spec-a.png'],['双电池套装','spec-b.png'],['无规格图套餐','cover.png']]){
  await page.locator('.variant-option').filter({hasText:name}).click();
  await page.waitForFunction(file=>{const i=document.querySelector('.checkout-product img');return i?.src.endsWith('/'+file)&&i.naturalWidth>0},file);
 }
 assert.equal(await page.locator('.footnote').innerText(),'提交后FLP将锁定，30分钟内未支付会释放。');
 await page.locator('.variant-option').filter({hasText:'双电池套装'}).click();
 await page.locator('.checkout-product img').click();
 await page.waitForFunction(()=>document.querySelector('.mini-preview img')?.src.endsWith('/spec-b.png'));
 await page.evaluate(()=>miniBack());
 await page.screenshot({path:`${out}/checkout-${width}.png`});
 await page.evaluate(()=>wx.navigateTo({url:'/packages/market/orders/index'}));await page.locator('.cancel-order').waitFor();
 await page.evaluate(async()=>{await Promise.all(document.querySelector('#page').getAnimations().map(a=>a.finished));});
 const size=await page.locator('.actions').evaluate(e=>{const a=e.querySelector('.cancel-order').getBoundingClientRect(),b=e.querySelector('.primary').getBoundingClientRect();return {cancel:a.width,pay:b.width,right:b.right}});
 await page.screenshot({path:`${out}/orders-${width}.png`});console.log('button dimensions',width,size);
 assert(Math.abs(size.cancel-88)<0.01);assert(size.pay>size.cancel);assert(size.right<=width);
 assert(await page.locator('.order-product img').getAttribute('src').then(s=>s.endsWith('/spec-b.png')));
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.deepEqual(await page.evaluate(()=>errors),[]);await page.screenshot({path:`${out}/orders-${width}.png`});await page.close();console.log('PASS width',width);
}console.log('PASS mini + Android image normalization/fallback; selected spec image/preview; exact lock copy; compact cancellation.');}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server.close();}});
