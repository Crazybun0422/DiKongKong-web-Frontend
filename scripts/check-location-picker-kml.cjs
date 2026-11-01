const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {fixture,server}=require('D:/Workspace/LowLatitudePlanet/scripts/check-mini-flows.cjs');
server.listen(0,'127.0.0.1',async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  for(const host of ['android','weixin']) {
   const page=await browser.newPage({viewport:{width:393,height:852},bypassCSP:true});
   page.on('pageerror',e=>console.log('PAGE ERROR',e.message));
   page.on('console',e=>{if(e.type()==='warn'||e.type()==='error')console.log('BROWSER',e.text());});
   await fixture(page,'packages/market/detail/index');
   await page.evaluate(host=>{
    if(host==='weixin'){
     wx.getAppBaseInfo=()=>({appName:'weixin',platform:'ios'});
     wx.getDeviceInfo=()=>({platform:'ios',brand:'iPhone'});
    }
    const original=AndroidMini.call;
    window.kmlRequests=[];
    AndroidMini.call=(id,method,payload)=>{
     const args=JSON.parse(payload);
     if(method==='request' && args.url.includes('/api/offline-layer-kml/tiles')){
      kmlRequests.push(args.url);
      setTimeout(()=>miniReply(id,true,{statusCode:200,data:{data:{tiles:[{z:14,x:13685,y:6690,downloadUrl:'https://fixture.invalid/test.kml',featureCount:1}]}}}),0);
     }else if(method==='request' && args.url==='https://fixture.invalid/test.kml'){
      kmlRequests.push(args.url);
      setTimeout(()=>miniReply(id,true,{statusCode:200,data:'<kml xmlns="http://www.opengis.net/kml/2.2"><Document><Placemark><name>fixture</name><Polygon><outerBoundaryIs><LinearRing><coordinates>120.69,31.29,0 120.72,31.29,0 120.72,31.32,0 120.69,31.32,0 120.69,31.29,0</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>'}),0);
     }else original(id,method,payload);
    };
    miniDebug.active.chooseAddress();
   },host);
   await page.waitForFunction(()=>miniDebug.active.route==='pages/markers/location-picker/index' && miniDebug.active._activeUomPluginSource==='uom4' && miniDebug.active._uomPolygons.length>0, null, {timeout:5000});
   assert.ok(await page.evaluate(()=>kmlRequests.includes('https://fixture.invalid/test.kml')));
   assert.ok(await page.evaluate(()=>miniDebug.active.data.polygons.length>0));
   await page.evaluate(()=>miniDebug.active.onRegionChange({type:'regionchange',detail:{type:'end',causedBy:'scale',scale:12,centerLocation:{latitude:31.3,longitude:120.7}}}));
   await page.waitForFunction(()=>miniDebug.active.data.scale===12 && miniDebug.active._activeUomPluginSource!=='uom4');
   assert.equal(await page.evaluate(()=>miniDebug.active._activeUomPluginSource),host==='weixin'?'uom':'uom3');
   await page.evaluate(()=>miniDebug.active.onRegionChange({type:'end',causedBy:'scale',detail:{scale:16,centerLocation:{latitude:31.3,longitude:120.7}}}));
   await page.waitForFunction(()=>miniDebug.active._activeUomPluginSource==='uom4' && miniDebug.active._uomPolygons.length>0);
   assert.equal(await page.evaluate(()=>miniDebug.active._pendingUomPluginTransition),null);
   await page.evaluate(()=>{window.oldPicker=miniDebug.active;wx.navigateBack();});
   await page.waitForFunction(()=>miniDebug.active.route==='packages/market/detail/index');
   assert.ok(await page.evaluate(()=>Object.values(oldPicker._uomPluginRefs).every(plugin=>plugin._destroyed===true || plugin._destroyed===undefined)));
   console.log('PASS '+host+': high-zoom KML query, download, polygon render, zoom-out and zoom-back transition, original picker shared by marker and market.');
   await page.close();
  }
 }catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();server.close();}
});
