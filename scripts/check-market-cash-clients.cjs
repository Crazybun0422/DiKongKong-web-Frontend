const fs=require('fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const assets=process.env.MINI_ASSET_ROOT||'D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity';
process.env.MINI_ASSET_ROOT=assets;
const {fixture,server}=require('D:/Workspace/LowLatitudePlanet/scripts/check-mini-flows.cjs');
const platform=assets.includes('Harmony')?'harmony':'android';
function setup(){
 const product={id:7,revision:2,title:'户外飞行帽｜SKYLANE轻奢定制款',imageUrl:'/packages/market/assets/logo.png',imageUrls:['/packages/market/assets/logo.png'],description:'此商品为「预售款」\n将根据订单需求定制发货。',originalPrice:29,cashPrice:9,maxFlp:20,presale:true,pinned:true,stock:5,variants:[{id:'white',name:'白色经典款',originalPrice:29,cashPrice:9,maxFlp:20,stock:2},{id:'black',name:'黑色定制款',originalPrice:39,cashPrice:19,maxFlp:20,stock:3}]};
 window.cashOrders=[];const original=AndroidMini.call;
 AndroidMini.call=(id,method,payload)=>{const args=JSON.parse(payload);if(method==='request'){
  const p=new URL(args.url).pathname;let data;
  if(p==='/api/market/config')data={closed:false};
  else if(p==='/api/market/categories')data=[];
  else if(p==='/api/market/products')data={content:[product],last:true};
  else if(p==='/api/market/products/7')data=product;
  else if(p==='/api/market/orders'&&args.method==='POST'){const d=args.data;cashOrders.push(d);const sku=product.variants.find(v=>v.id===d.variantId);data={id:'cash-order',...d,cash:(d.paymentMode==='CASH'?sku.originalPrice:sku.cashPrice)*d.quantity,flp:d.paymentMode==='CASH'?0:sku.maxFlp*d.quantity};}
  else if(p==='/api/market/orders')data={content:[{id:'cash-order',title:product.title,imageUrl:product.imageUrl,paymentMode:'CASH',quantity:2,cash:78,flp:0,status:'WAITING_PAYMENT',recipient:'飞友',phone:'13800138000',address:'测试路1号'}],last:true};
  else if(p.endsWith('/pay'))data={timeStamp:'123',nonceStr:'fixture',packageValue:'prepay_id=fixture',signType:'RSA',paySign:'fixture'};
  if(data!==undefined){setTimeout(()=>miniReply(id,true,{statusCode:200,data:{success:true,data}}),0);return;}
 }return original(id,method,payload);};
}
server.listen(0,'127.0.0.1',async()=>{let browser;try{
 browser=await chromium.launch({headless:true});fs.mkdirSync('artifacts/market-fixes',{recursive:true});
 for(const width of [320,393,1200]){
  const page=await browser.newPage({viewport:{width,height:900},bypassCSP:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await fixture(page,'packages/market/index/index',true,setup);
  try{await page.locator('.product-pin').waitFor({timeout:5000});}catch(e){console.log(await page.evaluate(()=>({text:document.body.innerText,data:miniDebug.active.data,calls:platformCalls,errors:window.errors})));throw e;}
  assert.equal(await page.locator('.product-pin').innerText(),'置顶');
  await page.locator('.product-card').click();await page.locator('.buy-bar .direct-buy').click();
  await page.waitForFunction(()=>miniDebug.active.data.paymentMode==='CASH');assert.equal(await page.locator('.checkout-footer .price').innerText(),'¥29.00');assert((await page.locator('.footnote').innerText()).includes('不使用 FLP'));
  await page.locator('.variant-option').filter({hasText:'黑色定制款'}).click();await page.waitForFunction(()=>miniDebug.active.data.variantId==='black');await page.locator('[data-delta="1"]').click();await page.waitForFunction(()=>document.querySelector('.checkout-footer .price').textContent==='¥78.00');
  await page.locator('.payment-mode[data-mode="FLP"]').click();await page.waitForFunction(()=>document.querySelector('.checkout-footer .price').textContent==='¥38.00');assert((await page.locator('.checkout-footer').innerText()).includes('40.00 FLP'));
  await page.locator('.payment-mode[data-mode="CASH"]').click();
  await page.locator('[data-field="recipient"]').fill('飞友');await page.locator('[data-field="phone"]').fill('13800138000');await page.locator('[data-field="address"]').fill('测试路1号');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  const rects=await page.locator('.buy-bar').evaluate(e=>Array.from(e.querySelectorAll('button')).map(b=>{const r=b.getBoundingClientRect();return {x:r.x,right:r.right,w:r.width}}));assert(rects.every(r=>r.x>=0&&r.right<=width&&r.w>90));
  await page.screenshot({path:`artifacts/market-fixes/${platform}-cash-${width}.png`});
  await page.locator('.checkout-footer .primary').click();
  if(platform==='harmony'){await page.getByText('当前端暂不支持商城支付，请前往微信小程序购买',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>cashOrders.length),0);await page.close();console.log('PASS harmony',width,'cash/FLP UI and unsupported-payment guard before order creation');continue;}
  await page.waitForFunction(()=>cashOrders.length===1);const order=await page.evaluate(()=>cashOrders[0]);assert.equal(order.paymentMode,'CASH');assert.equal(order.quantity,2);assert.equal(order.variantId,'black');assert.equal(order.revision,2);assert(!Object.hasOwn(order,'cash'));
  await page.locator('.order-product').waitFor();assert(!(await page.locator('.order-product .price').innerText()).includes('FLP'));assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.errors),[]);
  await page.close();console.log('PASS',platform,width,'cash/FLP selection, SKU totals, payload and order');
 }
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server.close();}});
