import { preview } from 'vite';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const server = await preview({build:{outDir:'.game-build/mobile'},preview:{host:'127.0.0.1',port:17820,strictPort:true}});
const browser = await chromium.launch({headless:true});
const errors=[];
try {
 for (const native of [false,true]) {
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
  page.on('pageerror',e=>errors.push(e.message));
  if(native) await page.addInitScript(()=>{window.DroneGameNative={postMessage(){}}});
  await page.goto('http://127.0.0.1:17820/games/drone-race/');
  const mode=page.locator('.header-actions .flight-mode-button');
  await mode.waitFor();
  assert.match(await mode.innerText(),/FPV竞速/);
  await mode.click();
  assert.match(await mode.innerText(),/自稳定/);
  await page.reload(); await mode.waitFor();
  assert.match(await mode.innerText(),/自稳定/);
  await mode.click();
  if(native) await page.locator('.all-aircraft-button').click();
  await page.getByRole('button',{name:'下一款机型',exact:true}).click();
  if(native) await page.locator('.hangar-dialog .game-dialog-close').click();
  else {await page.locator('.generate-button').click();await page.waitForFunction(()=>!document.querySelector('.solo-button').disabled);}
  await page.locator('.solo-button').click();
  const raceMode=page.locator('.race-mode-controls .flight-mode-button');
  await raceMode.waitFor();
  assert.match(await raceMode.innerText(),/FPV竞速/);
  await raceMode.click();assert.match(await raceMode.innerText(),/自稳定/);
  await raceMode.click();
  assert.ok(await page.locator('.race-mode-controls .camera-toggle').isVisible());
  await page.screenshot({path:'.game-build/flight-mode-'+(native?'android':'web')+'.png'});
  if(native) {
   for(const width of [844,640]) {
    await page.setViewportSize({width,height:390});
    const controls=await page.locator('.race-mode-controls').boundingBox();
    const progress=await page.locator('.race-progress').boundingBox();
    assert.ok(controls.x>=0 && controls.x+controls.width<=width);
    assert.ok(controls.x+controls.width<=progress.x || controls.y+controls.height<=progress.y || controls.y>=progress.y+progress.height,`mode controls overlap progress at ${width}: ${JSON.stringify({controls,progress})}`);
   }
  }
  await page.close();
 }
 assert.deepEqual(errors,[]);
 console.log('Web/Android UI: FPV default, mode persistence, in-flight switching, camera button retained, landscape control bounds passed.');
} finally {await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
