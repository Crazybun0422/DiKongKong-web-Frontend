const fs=require('fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {fixture,server}=require('D:/Workspace/LowLatitudePlanet/scripts/check-mini-flows.cjs');
const assets='D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity';
const moods=require('E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/utils/mood');
assert.equal(moods.normalize(undefined),1);assert.equal(moods.normalize(0),1);assert.equal(moods.normalize(3),3);
const setup=`(()=>{const call=AndroidMini.call;let mood;window.moodWrites=[];
AndroidMini.call=(id,method,payload)=>{const args=JSON.parse(payload),p=args.url?new URL(args.url).pathname:'';let data;
 if(method==='request'&&p==='/api/social/profiles/ABC123')data={featureCode:'ABC123',nickname:'测试飞友',gender:'female',signature:'一起飞',member:true,online:mood!==3,mood,avatarUrl:'/assets/pilot-avatar-female.png'};
 else if(method==='request'&&p==='/api/social/profiles/ABC123/content')data={items:[],hasMore:false};
 else if(method==='request'&&p==='/api/social/profile'){mood=args.data.mood;moodWrites.push(args.data);data={};}
 else if(method==='request'&&p==='/api/flight-meetups/online')data={items:[1,2,3,4,undefined].map((m,i)=>({featureCode:'FLY'+i,avatarUrl:'/assets/default-avatar.png',member:i===0,mood:m,signature:'在同一片天空相遇',aircraftModel:'mini-4-pro',distanceMeters:1000+i*13000})),total:4,hasMore:false};
 if(data!==undefined){setTimeout(()=>miniReply(id,true,{statusCode:200,data:{success:true,data}}),0);return;}call(id,method,payload);};})();`;
server.listen(0,'127.0.0.1',async()=>{let browser;try{
 fs.mkdirSync('artifacts/profile-moods',{recursive:true});browser=await chromium.launch({headless:true});
 for(const width of [320,393,1024]) {
  const page=await browser.newPage({viewport:{width,height:852},bypassCSP:true});
  await page.route('**/runtime.js',r=>r.fulfill({contentType:'text/javascript',body:setup+fs.readFileSync(assets+'/runtime.js','utf8')}));
  await fixture(page,'pages/profile/home/index');await page.waitForFunction(()=>miniDebug.active.data.profile?.nickname==='测试飞友');
  await page.locator('.home-edit').click();
  assert.equal(await page.locator('.mood-option--selected').innerText(),'期待交流');
  await page.locator('.mood-option').nth(2).click();await page.locator('.settings-close').click();
  assert.equal(await page.evaluate(()=>miniDebug.active.data.mood),1,'Cancel does not persist an edited mood');
  for(const id of [2,3,4,1]){
   await page.locator('.home-edit').click();await page.locator('.mood-option').nth(id-1).click();
   if(id===3)await page.screenshot({path:'artifacts/profile-moods/settings-'+width+'.png'});
   await page.locator('.save-details').click();await page.waitForFunction(id=>!miniDebug.active.data.detailsSaving&&miniDebug.active.data.mood===id,id);
   assert.equal(await page.evaluate(()=>moodWrites.at(-1).mood),id);
   await page.waitForFunction(label=>document.querySelector('.profile-mood')?.textContent===label,moods.options[id-1].label);
  }
  assert.deepEqual(await page.evaluate(()=>errors),[]);await page.close();
  const online=await browser.newPage({viewport:{width,height:852},bypassCSP:true});
  await online.route('**/runtime.js',r=>r.fulfill({contentType:'text/javascript',body:setup+fs.readFileSync(assets+'/runtime.js','utf8')}));
  await fixture(online,'packages/flight-meetups/index/index');await online.waitForFunction(()=>document.querySelectorAll('.yf-online-avatar').length===4);
  assert.equal(await online.locator('.yf-online-stack .mood-icon--3').count(),0);
  assert.equal(await online.locator('.yf-online-avatar--member').count(),1);
  await online.screenshot({path:'artifacts/profile-moods/entry-'+width+'.png'});
  await online.locator('.yf-online-entry').click();await online.waitForFunction(()=>document.querySelectorAll('.online-person').length===4);
  await online.waitForTimeout(350); // Finish the native-parity route slide before measuring.
  assert.equal(await online.locator('.online-roster .mood-icon--3').count(),0);
  assert.equal(await online.locator('.online-roster .mood-icon--1').count(),2);
  assert.equal(await online.locator('.online-avatar--member').first().evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(245, 158, 11)');
  assert(await online.locator('.online-person').first().evaluate(el=>{const avatar=el.querySelector('.online-avatar').getBoundingClientRect(),badge=el.querySelector('.mood-badge').getBoundingClientRect();return badge.right>=avatar.right&&badge.bottom>=avatar.bottom&&badge.left>avatar.left&&badge.top>avatar.top;}));
  assert(await online.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await online.screenshot({path:'artifacts/profile-moods/online-'+width+'.png'});
  assert.deepEqual(await online.evaluate(()=>errors),[]);await online.close();
 }
 console.log('PASS: 320/393/1024px settings, all four saved moods, cancel, defaults, online filtering, badge placement and VIP rings.');
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server.close();}});
