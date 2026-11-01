const fs=require('fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {fixture,server}=require('D:/Workspace/LowLatitudePlanet/scripts/check-mini-flows.cjs');
const assets='D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity';
const setup=`(()=>{const boot=AndroidMini.bootstrap,call=AndroidMini.call;window.rawVersion=0;window.rawReads=0;
AndroidMini.bootstrap=()=>{const c=JSON.parse(boot());c.nativeSharing=true;c.language='zh';return JSON.stringify(c)};
AndroidMini.call=(id,method,payload)=>{const a=JSON.parse(payload);if(method==='ridRawPage'){rawReads++;setTimeout(()=>miniReply(id,true,{id:'usb-session',source:a.source,page:0,pages:1,total:rawVersion,text:'RID frame '+rawVersion}),0);return;}call(id,method,payload)};
window.deliverRid=n=>{rawVersion=n;miniRidEvent({requested:true,running:true,usb:true,usbState:'connected',detected:1,mapped:1,rawCapture:{id:'usb-session',received:n,written:n,dropped:0},devices:[{source:'ble:01:02:03:04:05:06',mac:'01:02:03:04:05:06',transport:'ble',count:n,rid:true}],tracks:[{key:'0:id:serial',identity:'serial',protocol:0,latitude:31+n/1000,longitude:120+n/1000,pilotLatitude:32+n/1000,pilotLongitude:121+n/1000,ageMillis:0,telemetry:{height:n,speed:n/10}}]})};})();`;
server.listen(0,'127.0.0.1',async()=>{let browser;try{
 browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:393,height:852},bypassCSP:true});
 await page.route('**/runtime.js',r=>r.fulfill({contentType:'text/javascript',body:setup+fs.readFileSync(assets+'/runtime.js','utf8')}));
 await fixture(page,'packages/aircraft-scan/index/index');const ui=page.locator('planet-aircraft-ui');await ui.waitFor();
 await page.evaluate(()=>deliverRid(1));await ui.locator('.row').click();
 for(let n=2;n<=40;n++){
  await page.evaluate(n=>deliverRid(n),n);
  assert((await ui.locator('.coordinates').first().innerText()).includes((31+n/1000).toFixed(6)));
  assert((await ui.locator('.coordinates').nth(1).innerText()).includes((32+n/1000).toFixed(6)));
 }
 await ui.locator('[data-action=back]').click();assert.equal(await ui.locator('.row').count(),1);
 assert((await ui.locator('.metrics').innerText()).includes('40 m'));
 await ui.locator('[data-action=devices]').click();await ui.locator('[data-action=device-log]').click();
 await page.waitForFunction(()=>document.querySelector('planet-aircraft-ui').shadowRoot.querySelector('.diagnostic-text').textContent==='RID frame 40');
 for(let n=41;n<=60;n++){
  await page.evaluate(n=>{deliverRid(n);document.querySelector('planet-aircraft-ui').tick()},n);
  await page.waitForFunction(n=>document.querySelector('planet-aircraft-ui').shadowRoot.querySelector('.diagnostic-text').textContent==='RID frame '+n,n);
 }
 assert.deepEqual(await page.evaluate(()=>errors),[]);
 fs.mkdirSync('artifacts/rid-refresh',{recursive:true});await page.screenshot({path:'artifacts/rid-refresh/live.png'});
 console.log('PASS: stable aircraft ID updates position/pilot/telemetry; device and raw packet view keep refreshing across 60 deliveries.');
}catch(e){console.error(e);process.exitCode=1}finally{await browser?.close();server.close()}});
