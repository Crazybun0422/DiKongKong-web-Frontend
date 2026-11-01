/* Check actual pinned templates, including the shipped old-WebView assets. */
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const old=process.argv.includes('--old');
if(old)process.env.MINI_ASSET_ROOT='D:/Workspace/LowLatitudePlanet/app/build/generated/compatible-web-assets/mini-parity';
const {fixture,server}=require('D:/Workspace/LowLatitudePlanet/scripts/check-mini-flows.cjs');
const {chromium}=require('playwright');
const legacy=require('D:/Workspace/LowLatitudePlanet/build/legacy-browser/driver/node_modules/puppeteer-core');
const esbuild=require('D:/Workspace/LowLatitudePlanet/scripts/node_modules/esbuild');
const compat=fn=>new Function(esbuild.transformSync('var fn='+fn.toString(),{target:'chrome70'}).code+';return fn.apply(this,arguments)');
function populate(){
 miniDebug.active.setData({pinned:[1,2,3].map(function(id){return {id:id,authorInitial:'星',authorMember:true,authorLifetimeMember:id===2,pinnedAuthorPreview:'低空星球官方',pinnedSummaryPreview:'各位Android用户：作品展示与平台功能升级，欢迎体验'};})});
}
function metrics(){return Array.from(document.querySelectorAll('.pinned-card')).map(function(card){var text=card.querySelector('.pinned-text'),span=text.querySelector('text'),r=card.getBoundingClientRect(),t=text.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(text);var lines=Array.from(range.getClientRects()).filter(function(x){return x.width>1&&x.height>1;});return {card:{top:r.top,bottom:r.bottom,width:r.width},text:{top:t.top,bottom:t.bottom,height:t.height},lines:lines.map(function(x){return {top:x.top,bottom:x.bottom}}),nowrap:getComputedStyle(span).whiteSpace,scrollHeight:text.scrollHeight,clientHeight:text.clientHeight};});}
server.listen(0,'127.0.0.1',async()=>{let browser;try{
 browser=old?await legacy.launch({executablePath:'D:/Workspace/LowLatitudePlanet/build/legacy-browser/chrome-win/chrome.exe',headless:true}):await chromium.launch({headless:true});
 fs.mkdirSync('artifacts/market-fixes',{recursive:true});
 for(const width of [320,393,1200]){
  const page=old?await browser.newPage():await browser.newPage({viewport:{width,height:800},bypassCSP:true});
  if(old){await page.setViewport({width,height:800});await page.setBypassCSP(true);await page.setRequestInterception(true);page.on('request',r=>r.url().startsWith('http://127.0.0.1:')?r.continue():r.abort());}
  const adapter=old?{route:async()=>{},addInitScript:(fn,arg)=>page.evaluateOnNewDocument(compat(fn),arg),goto:(...a)=>page.goto(...a),waitForFunction:fn=>page.waitForFunction(compat(fn))}:page;
  await fixture(adapter,'packages/planet-broadcast/placeholder/index');
  await page.waitForFunction(old?compat(()=>requests.some(r=>r.path==='/api/planet-broadcasts')):()=>requests.some(r=>r.path==='/api/planet-broadcasts'));
  await page.evaluate(populate);await page.waitForSelector('.pinned-card');
  const result=await page.evaluate(metrics);assert.equal(result.length,3);
  for(const r of result){assert.equal(r.nowrap,'nowrap');assert.equal(r.scrollHeight,r.clientHeight);assert(r.lines.every(l=>l.top>=r.card.top&&l.bottom<=r.card.bottom),JSON.stringify(r));}
  // Removing just the fix must reproduce vertical clipping from the submitted screenshot.
  if(width===393&&!old){await page.evaluate(()=>{var s=document.createElement('style');s.id='repro';s.textContent='.pinned-text text{white-space:pre-wrap}';document.head.appendChild(s);});const before=await page.evaluate(metrics);assert(before.some(r=>r.scrollHeight>r.clientHeight||r.lines.some(l=>l.top<r.card.top||l.bottom>r.card.bottom)));await page.screenshot({path:`artifacts/market-fixes/pinned-modern-before.png`});await page.evaluate(()=>document.getElementById('repro').remove());}
  await page.screenshot({path:`artifacts/market-fixes/pinned-${old?'old':'modern'}-${width}.png`});await page.close();console.log('PASS pinned',old?'Chromium71':'modern',width,'single line without clipping');
 }
}catch(e){console.error(e);process.exitCode=1;}finally{await browser?.close();server.close();}});
