const fs=require('fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {fixture,server}=require('D:/Workspace/LowLatitudePlanet/scripts/check-mini-flows.cjs');
const assets='D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity';
const setup=`(()=>{const call=AndroidMini.call;window.encounterNoLocation=false;window.encounterEmpty=false;window.encounterError=false;window.encounterRequests=[];
AndroidMini.call=(id,method,payload)=>{const args=JSON.parse(payload),url=args.url?new URL(args.url):null;
 if(method==='location'&&encounterNoLocation){setTimeout(()=>miniReply(id,false,'denied'),0);return;}
 if(method==='request'&&url.pathname==='/api/flight-meetups/encounters'){
  encounterRequests.push(args);const page=Number(url.searchParams.get('page')),size=Number(url.searchParams.get('size'));
  const all=Array.from({length:23},(_,i)=>({featureCode:'PAST'+i,avatarUrl:'/assets/default-avatar.png',signature:'周末一起飞',member:i===0,mood:i%2?4:1,aircraftModel:'mini-4-pro',distanceMeters:100+i*300}));
  const rows=encounterEmpty||encounterNoLocation?[]:all;
  setTimeout(()=>miniReply(id,true,encounterError?{statusCode:503,data:{success:false,message:{zh:'加载失败'}}}:{statusCode:200,data:{success:true,data:{items:rows.slice(page*size,(page+1)*size),total:rows.length,hasMore:(page+1)*size<rows.length,located:!encounterNoLocation}}}),10);return;
 }
 if(method==='request'&&url.pathname==='/api/flight-meetups/online'){setTimeout(()=>miniReply(id,true,{statusCode:200,data:{success:true,data:{items:[],total:0,hasMore:false}}}),0);return;}
 call(id,method,payload);
};})();`;
server.listen(0,'127.0.0.1',async()=>{let browser;try{
 browser=await chromium.launch({headless:true});fs.mkdirSync('artifacts/encounters',{recursive:true});
 for(const width of [320,393,1024]){
  const page=await browser.newPage({viewport:{width,height:852},bypassCSP:true});
  await page.route('**/runtime.js',r=>r.fulfill({contentType:'text/javascript',body:setup+fs.readFileSync(assets+'/runtime.js','utf8')}));
  await fixture(page,'packages/flight-meetups/index/index');await page.waitForFunction(()=>document.querySelector('.yf-encounter-count')?.textContent.includes('23 人'));
  assert.equal(await page.locator('.yf-message-logo').count(),1);
  assert.equal(await page.locator('.yf-encounter-slogan').innerText(),'每一次起飞，都可能是一场奇遇。');
  assert(await page.locator('.yf-encounter-entry').evaluate(e=>e.previousElementSibling.textContent.includes('约飞消息')));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'artifacts/encounters/entry-'+width+'.png'});
  await page.locator('.yf-encounter-entry').click();await page.waitForFunction(()=>document.querySelectorAll('.online-person').length===20);await page.waitForTimeout(350);
  assert.equal(await page.locator('.yf-nav').innerText(),'星球奇遇');
  assert.equal(await page.locator('.encounter-summary').innerText(),'10 km 内 · 23 位飞友曾出现');
  assert.equal(await page.locator('.online-avatar--member').count(),1);
  assert.equal(await page.locator('.encounter-distance').first().innerText(),'曾出现于\n100 m');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:'artifacts/encounters/list-'+width+'.png'});
  await page.evaluate(()=>miniDebug.active.onMore());await page.waitForFunction(()=>miniDebug.active.data.items.length===23);
  assert.equal(await page.evaluate(()=>miniDebug.active.data.hasMore),false);
  await page.evaluate(()=>{encounterNoLocation=true;miniDebug.active._point=null;return miniDebug.active.refresh();});await page.waitForFunction(()=>!miniDebug.active.data.loading&&!miniDebug.active.data.located);
  assert((await page.locator('.yf-empty').innerText()).includes('定位后查看附近飞友'));
  await page.evaluate(()=>{encounterNoLocation=false;encounterEmpty=true;return miniDebug.active.refresh();});await page.waitForFunction(()=>!miniDebug.active.data.loading&&miniDebug.active.data.located);
  await page.waitForFunction(()=>document.querySelector('.yf-empty')?.textContent==='附近还没有飞友留下足迹');
  await page.evaluate(()=>{encounterEmpty=false;encounterError=true;return miniDebug.active.load(true);});await page.waitForFunction(()=>document.querySelector('.yf-error')?.textContent.includes('加载失败'));
  await page.evaluate(()=>{encounterError=false;return miniDebug.active.refresh();});await page.waitForFunction(()=>document.querySelectorAll('.online-person').length===20);
  await page.locator('.online-person').first().click();await page.waitForFunction(()=>miniDebug.active.route==='pages/profile/home/index');
  assert.deepEqual(await page.evaluate(()=>errors),[]);await page.close();
 }
 console.log('PASS: encounters entry order, count, icons, slogan, page navigation, historical distance, VIP, pagination, missing location, empty/error states at 320/393/1024px.');
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server.close();}});
