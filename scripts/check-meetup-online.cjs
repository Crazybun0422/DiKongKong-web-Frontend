const fs=require('fs'),assert=require('node:assert/strict'),vm=require('vm'),{chromium}=require('playwright');
const {fixture,server}=require('D:/Workspace/LowLatitudePlanet/scripts/check-mini-flows.cjs');
const assets='D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity';
const source='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/packages/flight-meetups';
const helper={exports:{}};
vm.runInNewContext(fs.readFileSync(source+'/online-people.js','utf8'),{module:helper,require:()=>({imageUrl:v=>v})});
const distance=helper.exports.distanceStyle;
assert.equal(distance(0).distanceColor,distance(5000).distanceColor);
assert.equal(distance(50000).distanceColor,distance(100000).distanceColor);
assert.notEqual(distance(25000).distanceColor,distance(5000).distanceColor);
assert.equal(distance(null).distanceText,'—');assert.equal(distance(1200).distanceText,'1.2 km');
const setup=`(()=>{const call=AndroidMini.call;window.onlineFailure=false;window.noLocation=false;window.onlineEmpty=false;
AndroidMini.call=(id,method,payload)=>{const args=JSON.parse(payload);
 if(method==='location'&&noLocation){setTimeout(()=>miniReply(id,false,'denied'),0);return;}
 if(method==='request'&&args.url.includes('/api/flight-meetups/online')){
  requests.push(args); const query=new URL(args.url).searchParams, page=Number(query.get('page')||0),size=Number(query.get('size')||20);
  const rows=Array.from({length:23},(_,i)=>({featureCode:'FLY'+String(i).padStart(4,'0'),member:i%2===0,avatarUrl:'/assets/default-avatar.png',signature:i===0?'在同一片天空相遇，周末一起记录山河与城市。':i===1?'喜欢航拍与穿越机，签名较长时也要保持距离清晰可见。':'一起飞，去遇见同好。',aircraftModel:i===2?'potensic-atom-3':'mini-4-pro',distanceMeters:query.has('latitude')?(i===4?null:[500,5000,27500,50000,60000][i%5]):null}));
  setTimeout(()=>miniReply(id,true,onlineFailure?{statusCode:503,data:{success:false,message:{zh:'网络连接失败'}}}:{statusCode:200,data:{success:true,data:{items:onlineEmpty?[]:rows.slice(page*size,(page+1)*size),total:onlineEmpty?0:23,hasMore:!onlineEmpty&&(page+1)*size<23}}}),15);return;
 }call(id,method,payload);
};})();`;
server.listen(0,'127.0.0.1',async()=>{let browser;try{
 browser=await chromium.launch({headless:true});fs.mkdirSync('artifacts/meetup-online',{recursive:true});
 for(const width of [320,393,1024]) {
  const page=await browser.newPage({viewport:{width,height:852},bypassCSP:true});
  await page.route('**/runtime.js',r=>r.fulfill({contentType:'text/javascript',body:setup+fs.readFileSync(assets+'/runtime.js','utf8')}));
  await fixture(page,'packages/flight-meetups/index/index');
  await page.waitForFunction(()=>document.querySelectorAll('.yf-online-avatar').length===5);
  assert.equal(await page.locator('.yf-online-avatar--member').count(),3);
  assert.equal(await page.locator('.yf-online-avatar').first().evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(245, 158, 11)');
  assert.notEqual(await page.locator('.yf-online-avatar').nth(1).evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(245, 158, 11)');
  const boxes=await page.evaluate(()=>{const a=document.querySelector('.yf-entry-heading .yf-heading'),b=document.querySelector('.yf-online-entry');return {a:a.getBoundingClientRect().toJSON(),b:b.getBoundingClientRect().toJSON(),scroll:document.documentElement.scrollWidth,width:innerWidth};});
  assert(boxes.a.right<=boxes.b.left);assert(boxes.b.right<=width);assert(boxes.scroll<=width);
  await page.screenshot({path:`artifacts/meetup-online/entry-${width}.png`});
  await page.locator('.yf-online-entry').click();
  await page.waitForFunction(()=>miniDebug.active.route==='packages/flight-meetups/online/index'&&document.querySelector('.online-distance')?.textContent==='500 m');
  // Measure after the Android page slide-in has completed.
  await page.waitForTimeout(350);
  assert(await page.evaluate(()=>requests.some(r=>r.url.includes('/api/user/location')&&r.method==='POST')),'Normal location must be reported independently of sharing');
  assert.equal(await page.evaluate(()=>requests.some(r=>r.url.includes('/api/location-sharing')&&r.method==='POST')),false,'Opening online users must not join location sharing');
  assert.equal(await page.locator('.online-person').count(),20);
  assert.equal(await page.locator('.online-avatar--member').count(),10);
  assert.equal(await page.locator('.online-avatar').first().evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(245, 158, 11)');
  assert.equal(await page.locator('.online-avatar').first().evaluate(e=>getComputedStyle(e).borderTopWidth),'2px');
  assert.notEqual(await page.locator('.online-avatar').nth(1).evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(245, 158, 11)');
  assert.equal(await page.locator('.online-aircraft').first().innerText(),'DJI Mini 4 Pro');
  assert.equal(await page.locator('.online-aircraft').nth(2).innerText(),'ATOM 3');
  assert.equal(await page.locator('.online-distance').nth(1).evaluate(e=>getComputedStyle(e).color),'rgb(173, 116, 25)');
  assert.equal(await page.locator('.online-distance').nth(3).evaluate(e=>getComputedStyle(e).color),'rgb(69, 73, 79)');
  assert.equal(await page.locator('.online-distance').nth(4).innerText(),'—');
  const boxesOnline=await page.locator('.online-person').first().evaluate(e=>{const avatar=e.querySelector('.online-avatar').getBoundingClientRect(),profile=e.querySelector('.online-profile').getBoundingClientRect(),distance=e.querySelector('.online-distance').getBoundingClientRect();return {avatar:avatar.toJSON(),profile:profile.toJSON(),distance:distance.toJSON(),width:innerWidth};});assert(boxesOnline.avatar.right<=boxesOnline.profile.left&&boxesOnline.profile.right<=boxesOnline.distance.left&&boxesOnline.distance.right<=width,JSON.stringify(boxesOnline));
  await page.screenshot({path:`artifacts/meetup-online/list-${width}.png`});
  await page.evaluate(()=>miniDebug.active.onMore());await page.waitForFunction(()=>miniDebug.active.data.items.length===23);assert.equal(await page.evaluate(()=>miniDebug.active.data.hasMore),false);
  await page.evaluate(()=>{noLocation=true;miniDebug.active._point=null;return miniDebug.active.refresh();});await page.waitForFunction(()=>!miniDebug.active.data.loading);assert.equal(await page.locator('.online-distance').first().innerText(),'—');
  await page.evaluate(()=>{onlineFailure=true;return miniDebug.active.load(true);});assert((await page.locator('.yf-error').innerText()).includes('网络连接失败'));
  await page.evaluate(()=>{onlineFailure=false;onlineEmpty=true;return miniDebug.active.load(true);});await page.waitForFunction(()=>document.querySelector('.yf-empty')?.textContent==='暂无在线飞友');
  await page.evaluate(()=>{onlineEmpty=false;return miniDebug.active.load(true);});
  await page.locator('.online-person').first().click();await page.waitForFunction(()=>miniDebug.active.route==='pages/profile/home/index');
  assert.deepEqual(await page.evaluate(()=>errors),[]);await page.close();
 }
 console.log('PASS: 320/393/1024px entry, five overlapping avatars, navigation, aircraft names, distance gradient, pagination, denied location, errors, empty state and profile navigation.');
}catch(error){console.error(error);process.exitCode=1;}finally{await browser?.close();server.close();}});
