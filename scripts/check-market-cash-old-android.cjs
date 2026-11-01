const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
process.env.MINI_ASSET_ROOT='D:/Workspace/LowLatitudePlanet/app/build/generated/compatible-web-assets/mini-parity';
const {fixture,server}=require('D:/Workspace/LowLatitudePlanet/scripts/check-mini-flows.cjs');
const legacy=require('D:/Workspace/LowLatitudePlanet/build/legacy-browser/driver/node_modules/puppeteer-core');
const esbuild=require('D:/Workspace/LowLatitudePlanet/scripts/node_modules/esbuild');
const compat=fn=>new Function(esbuild.transformSync('var fn='+fn.toString(),{target:'chrome70'}).code+';return fn.apply(this,arguments)');
const source=fs.readFileSync(__dirname+'/check-market-cash-clients.cjs','utf8');
const setup=vm.runInNewContext(source.slice(source.indexOf('function setup(){'),source.indexOf('server.listen'))+';setup');
server.listen(0,'127.0.0.1',async()=>{let browser;try{
 browser=await legacy.launch({executablePath:'D:/Workspace/LowLatitudePlanet/build/legacy-browser/chrome-win/chrome.exe',headless:true});
 for(const width of [320,393]){
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewport({width,height:800});await page.setBypassCSP(true);await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
  const adapter={route:async()=>{},addInitScript:(fn,arg)=>page.evaluateOnNewDocument(compat(fn),arg),goto:(...a)=>page.goto(...a),waitForFunction:fn=>page.waitForFunction(compat(fn))};
  await fixture(adapter,'packages/market/index/index',true,setup);await page.waitForSelector('.product-pin');await page.click('.product-card');await page.waitForSelector('.direct-buy');
  const buttons=await page.evaluate(()=>Array.from(document.querySelectorAll('.buy-bar button')).map(function(e){var r=e.getBoundingClientRect();return {x:r.left,right:r.right,width:r.width,height:r.height};}));assert(buttons.every(r=>r.x>=0&&r.right<=width&&r.width>90&&r.height>=40));
  await page.click('.direct-buy');await page.waitForSelector('.variant-option[data-id="black"]');await page.waitForFunction(()=>miniDebug.active.data.paymentMode==='CASH');
  await page.click('.variant-option[data-id="black"]');await page.waitForFunction(()=>miniDebug.active.data.variantId==='black');await page.click('[data-delta="1"]');await page.waitForFunction(()=>document.querySelector('.checkout-footer .price').textContent==='¥78.00');
  await page.click('.payment-mode[data-mode="FLP"]');await page.waitForFunction(()=>document.querySelector('.checkout-footer .price').textContent==='¥38.00');
  await page.click('.payment-mode[data-mode="CASH"]');await page.type('[data-field="recipient"]','飞友');await page.type('[data-field="phone"]','13800138000');await page.type('[data-field="address"]','测试路1号');
  await page.screenshot({path:`artifacts/market-fixes/old-android-cash-${width}.png`});await page.click('.checkout-footer .primary');await page.waitForFunction(()=>cashOrders.length===1);assert.equal(await page.evaluate(()=>cashOrders[0].paymentMode),'CASH');assert.equal(await page.evaluate(()=>cashOrders[0].quantity),2);await page.waitForSelector('.order-product');assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.errors),[]);await page.close();console.log('PASS Chromium71 cash checkout',width);
 }
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server.close();}});
