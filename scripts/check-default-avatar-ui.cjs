const assert=require('node:assert/strict'),fs=require('fs'),{chromium}=require('playwright');
const {fixture,server}=require('D:/Workspace/LowLatitudePlanet/scripts/check-mini-flows.cjs');
server.listen(0,'127.0.0.1',async()=>{let browser;try{
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:393,height:852}});
 await page.route('**/runtime.js',async route=>{
  const source=fs.readFileSync('D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity/runtime.js','utf8');
  await route.fulfill({contentType:'text/javascript',body:`(()=>{const call=AndroidMini.call;AndroidMini.call=(id,method,payload)=>{const args=JSON.parse(payload);if(method==='request' && args.url.includes('/api/social/profiles/ABC123')){setTimeout(()=>miniReply(id,true,{statusCode:200,data:{success:true,data:{featureCode:'ABC123',nickname:'测试飞友',gender:'female',member:true,avatarUrl:requests.findLast(r=>r.path==='/api/user/profile'&&r.method==='PUT')?.data.avatarUrl || '/assets/default-avatar.png'}}}),0);return;}call(id,method,payload);};})();`+source});
 });
 await fixture(page,'pages/profile/home/index');
 await page.waitForFunction(()=>!!miniDebug.active.data.profile);
 await page.evaluate(()=>{miniDebug.active.setData({gender:'female'});miniDebug.active.openAvatarActionSheet();});
 await page.getByText('切回默认头像',{exact:true}).click();
 await page.waitForFunction(()=>requests.some(r=>r.path==='/api/user/profile'&&r.method==='PUT'&&r.data.avatarUrl==='/assets/pilot-avatar-female.png'));
 await page.waitForFunction(()=>!miniDebug.active.data.defaultAvatarSaving);
 assert.equal(await page.evaluate(()=>miniDebug.active.data.profile.avatarUrl),'/assets/pilot-avatar-female.png');
 assert.equal(await page.evaluate(()=>miniDebug.active.data.avatarActionSheetVisible),false);
 const image=await page.evaluate(async()=>{const image=new Image();image.src='/assets/pilot-avatar-female.png';await image.decode();return [image.naturalWidth,image.naturalHeight];});assert.deepEqual(image,[256,256]);
 await page.screenshot({path:'artifacts/default-avatars/profile-reset.png'});
 assert.deepEqual(await page.evaluate(()=>errors),[]);
 await page.close();
 const edit=await browser.newPage({viewport:{width:393,height:852}});await fixture(edit,'pages/profile/edit/index');
 await edit.getByText('切回默认头像',{exact:true}).click();await edit.locator('input[name=nickname]').fill('Pilot2026');await edit.locator('.edit-submit').click();
 await edit.waitForFunction(()=>requests.some(r=>r.path==='/api/user/profile'&&r.method==='PUT'));
 assert.equal(await edit.evaluate(()=>requests.find(r=>r.path==='/api/user/profile'&&r.method==='PUT').data.avatarUrl),'/assets/pilot-avatar-male.png');
 assert.deepEqual(await edit.evaluate(()=>errors),[]);
 console.log('PASS: real Android-rendered reset menu, persistent female reset, packaged PNG decoding, edit-form male reset and no runtime errors.');
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server.close();}});
