const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const root='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const silent={log(){},info(){},warn(){},error(){}};
function clock(){let seq=0;const timers=new Map();return {timers,setTimeout(fn,ms){timers.set(++seq,{fn,ms});return seq;},clearTimeout(id){timers.delete(id);},run(ms){for(const [id,t]of [...timers])if(t.ms===ms){timers.delete(id);t.fn();}}};}
function component(pkg, overrides={}) {
  const file=`${root}/packages/${pkg}/components/${pkg==='dji'?'dji-no-fly-layer':'uom-plugin'}/index.js`;
  const time=clock();let definition;
  const req=createRequire(file);
  vm.runInNewContext(fs.readFileSync(file,'utf8'),{require:id=>overrides.require?.(id)||req(id),Component:def=>definition=def,
    console:silent,...time,wx:overrides.wx||{getStorageSync:()=>null},Promise,Map,Set,Number,Date,ArrayBuffer,TextDecoder});
  const events=[];
  const page={data:{...definition.data},...definition.methods,setData(patch,done){Object.assign(this.data,patch);done?.();},triggerEvent(name,detail){events.push({name,detail});}};
  definition.lifetimes.created?.call(page);
  definition.lifetimes.attached?.call(page);
  return {page,time,events};
}
function nativeFixture(pkg, overrides={}) {
  const f=component(pkg,overrides),p=f.page;
  const calls=[],visible=new Set();
  const ctx={addGroundOverlay(args){calls.push(args);},removeGroundOverlay(args){visible.delete(args.id);args.success();}};
  p.detectUomOverlaySupport=()=>{};p.updateUomTileWarning=()=>{};p.syncUomLoadingState=()=>{};
  const refresh=p.refreshWmsOverlay;p.refreshWmsOverlay=()=>{};
  p.init({mapCtx:ctx,center:{latitude:28.2,longitude:112.9},scale:11,enabled:true});
  p.refreshWmsOverlay=refresh;
  return {...f,calls,ctx,visible};
}
const tile=id=>({id,src:`https://tiles/${id}.png`,bounds:{southwest:{latitude:28,longitude:112},northeast:{latitude:29,longitude:113}}});
function commonJs(file,overrides={}){const exports={};const module={exports};const req=createRequire(root+'/'+file);vm.runInNewContext(fs.readFileSync(root+'/'+file,'utf8'),{module,exports,require:id=>overrides.require?.(id)||req(id),console:silent,...overrides});return module.exports;}
(async()=>{
  for(const pkg of ['uom','uom5']) {
    // Load the complete component, including its actual init, batch and cleanup methods.
    let f=nativeFixture(pkg),downloads=0,resolveDownload;
    f.page.ensureWmsTileResource=()=>{downloads++;return new Promise(resolve=>resolveDownload=resolve);};
    for(let i=0;i<100;i++)f.page.applyWmsOverlays([tile('A')],{overlayKey:'A'});
    assert.equal(downloads,1,`${pkg}: identical pending view must share downloads`);
    resolveDownload('local-A');await flush();assert.equal(f.calls.length,1);
    f.calls[0].success();assert.equal(f.page._wmsOverlayMap.size,1,'Initial draw completes');
    assert(f.events.some(e=>e.detail.uomRenderReady),'Readiness comes from native success');
    // Move A -> B -> cached A before B's native callback returns.
    const old=f.page._wmsOverlayMap.get('A');f.visible.add(old.overlayId);
    f.page.ensureWmsTileResource=async src=>src;
    f.page._currentWmsTileKeyApplied='A';
    f.page.applyWmsOverlays([tile('B')],{overlayKey:'B'});await flush();
    const late=f.calls.at(-1);
    f.page.cancelPendingWmsBatch(); // The actual refresh path is tested below.
    late.success();assert.equal(f.page._wmsOverlayMap.get('A'),old);assert(f.visible.has(old.overlayId));
    // getCenterLocation/getRegion responses must not cross viewport generations.
    let centerCallback,refreshes=0;
    f.ctx.getCenterLocation=args=>centerCallback=args;
    f.page.refreshWmsOverlay=()=>refreshes++;
    f.page.scheduleFinalRefresh();f.time.run(150);
    const before=f.page._centerPin;
    f.page.handleRegionChange({center:{latitude:30,longitude:114},scale:12});
    const after=f.page._centerPin,count=refreshes;
    centerCallback.success({latitude:20,longitude:100});
    assert.equal(refreshes,count);assert.equal(f.page._centerPin,after);assert.notEqual(before,after);
    // Native failure keeps the previous overlay and records its real error.
    f.page.applyWmsOverlays([tile('C')],{overlayKey:'C'});await flush();
    f.calls.at(-1).fail({errMsg:'native-test-failure'});
    assert.equal(f.page._wmsOverlayMap.get('A'),old);
    assert(f.page._overlayTrace.some(e=>e.error==='native-test-failure'));
    console.log(`PASS ${pkg}: 100 pending refreshes -> 1 download / 1 native add; first draw, late callbacks, retained old layer, diagnostics.`);
    // Real resource cache and cancellation: overlapping pending tile stays in flight.
    const downloadsInFlight=[];
    f=nativeFixture(pkg,{wx:{getStorageSync:()=>null,downloadFile(options){const d={options,aborted:false};downloadsInFlight.push(d);return {abort(){d.aborted=true;options.fail({errMsg:'aborted'});}};}}});
    f.page.applyWmsOverlays([tile('shared'),tile('old-only')],{overlayKey:'old-view'});
    f.page.applyWmsOverlays([tile('shared'),tile('new-only')],{overlayKey:'new-view'});
    assert.equal(downloadsInFlight.length,3,'Two overlapping views download three unique tiles, not four');
    assert.equal(downloadsInFlight[0].aborted,false,'Keep shared download');
    assert.equal(downloadsInFlight[1].aborted,true,'Abort obsolete download');
    for(const d of downloadsInFlight.filter(d=>!d.aborted))d.options.success({statusCode:200,tempFilePath:'local:'+d.options.url});
    await flush();assert.equal(f.calls.length,2);f.calls.forEach(c=>c.success());
    assert.equal(f.page._currentWmsTileKeyApplied,'new-view');
  }
  // Actual refreshWmsOverlay: cached A cancels pending B without requesting A again.
  {
    let f=nativeFixture('uom',{require:id=>id==='../../utils/offline-layer-tiles'?{
      DEFAULT_MIN_ZOOM:0,DEFAULT_MAX_ZOOM:13,getCachedLayerTileDescriptor:()=>({urlTemplate:'tiles',minZoom:0,maxZoom:13,tileSize:256}),
      buildOfflineLayerTiles:()=>[tile('A')],resolveLayerTileDescriptor:async()=>({})}:null});
    const p=f.page;p.getMapViewportSize=()=>({width:375,height:700});p.pickUomMaskTiles=()=>[];p.updateStatusPanel=()=>{};
    p.pruneUomTileMasks=()=>{};p.pruneWmsTileResourceCache=()=>{};
    p._currentWmsTileKeyApplied='';let requests=0;p.applyWmsOverlays=()=>requests++;
    p.refreshWmsOverlay();p._currentWmsTileKeyApplied=p._currentWmsTileKey;
    p._wmsPendingBatch={overlayKey:'B',createdHandles:new Map(),requestedSrcs:new Set()};
    p.refreshWmsOverlay();assert.equal(p._wmsPendingBatch,null);assert.equal(requests,1);
  }
  const plugins=commonJs('pages/map/utils/map-plugins.js');
  const actions=commonJs('pages/map/utils/misc-actions.js',{require:id=>id==='./map-plugins'?plugins:null});
  const time=clock(),graphics=commonJs('pages/map/utils/map-graphics.js',time);
  function handoff(){let retired=0,applied;const target={_refreshSeq:7};const from={setEnabled(enabled){if(!enabled)retired++;}};
    const p={data:{uomDivisionEnabled:true},_activeUomPluginSource:'uom',_pendingUomPluginTransition:{fromSource:'uom',toSource:'uom4',fromPlugin:from,toPlugin:target},
      _djiPolygons:[{id:'dji',points:[]}],_nfzPolygons:[{id:'nfz',points:[]}],
      setData(data,done){Object.assign(this.data,data);applied=done;},queueMapGraphicsSync(options){graphics.queueMapGraphicsSync(this,options);}};
    return {p,target,retired:()=>retired,apply:()=>applied?.()};}
  {
    const h=handoff(),event={currentTarget:{dataset:{source:'uom4'}},detail:{uomStatus:'适飞空域',uomTone:'safe',uomLoading:false}};
    actions.onUomStatusChange(h.p,event);assert.equal(h.retired(),0,'Status cannot remove old native layer');
    actions.onUomGraphicsChange(h.p,{...event,detail:{polygons:[{id:'uom',points:[]}],polylines:[],ready:true,revision:7}});
    time.run(0);assert.equal(h.retired(),0,'Wait for view-layer commit callback');
    assert.deepEqual(Array.from(h.p.data.polygons,p=>p.id),['uom','dji','nfz']);
    h.apply();assert.equal(h.retired(),1);assert.equal(h.p._activeUomPluginSource,'uom4');
  }
  {
    const h=handoff();actions.onUomGraphicsChange(h.p,{currentTarget:{dataset:{source:'uom4'}},detail:{polygons:[],polylines:[],ready:true,revision:7}});
    time.run(0);h.target._refreshSeq=8;h.apply();assert.equal(h.retired(),0,'Outdated view commit cannot finish newer handoff');
  }
  {
    const h=handoff();actions.onUomGraphicsChange(h.p,{currentTarget:{dataset:{source:'uom4'}},detail:{polygons:[],polylines:[],ready:true,revision:7}});
    time.run(0);h.apply();assert.equal(h.retired(),1,'Validated empty data can clear');
  }
  // KML identical updates should not abort an in-flight query, including repeated enable.
  {
    const {page:p}=component('uom4');p._apiBase='https://api.test';p._center={latitude:28.2,longitude:112.9};
    p.updateStatusPanel=()=>{};p.invalidateViewport();const revision=p._refreshSeq;
    for(let i=0;i<100;i++){p.setEnabled(true);p.handleRegionChange({center:p._center,force:true});}
    assert.equal(p._refreshSeq,revision);
    p.handleRegionChange({center:{latitude:28.3,longitude:113},force:true});assert(p._refreshSeq>revision);
  }
  {
    const disabled=[];
    const from={setEnabled(value){disabled.push(['from',value]);}},to={setEnabled(value){disabled.push(['to',value]);}};
    const p={data:{uomDivisionEnabled:false},_uomPlugin:to,_uomPluginRefs:{uom:from,uom4:to},_uomPolygons:[{id:'old'}],
      _pendingUomPluginTransition:{fromSource:'uom',toSource:'uom4',fromPlugin:from,toPlugin:to},queueMapGraphicsSync(){}};
    plugins.setUomLayerEnabled(p,false);
    assert.equal(disabled.length,2);assert(disabled.every(([,enabled])=>enabled===false));
    assert.equal(p._pendingUomPluginTransition,null);assert.equal(p._uomPolygons.length,0);
    assert.equal(plugins.ensureUomPluginReady(p),null,'Disabled layer cannot start a source switch');
  }
  console.log('PASS: cached viewport return, coalesced view update, independent layers, handoff only after apply, stale handoff, valid empty KML, KML request reuse.');
  // Multiple queued updates must wait for the previous view-layer acknowledgement.
  {
    const c=clock(),g=commonJs('pages/map/utils/map-graphics.js',c);const acks=[],writes=[];
    const p={data:{uomDivisionEnabled:true},_uomPolygons:[{id:'A',points:[]}],setData(data,done){writes.push(data);acks.push(done);}};
    g.queueMapGraphicsSync(p,{overlay:true});c.run(0);assert.equal(writes.length,1);
    p._uomPolygons=[{id:'B',points:[]}];let done=false;
    g.queueMapGraphicsSync(p,{overlay:true,onApplied:()=>done=true});c.run(0);
    assert.equal(writes.length,1);assert.equal(done,false);
    acks.shift()();c.run(0);assert.equal(writes.length,2);assert.equal(done,false);
    acks.shift()();assert.equal(done,true);
  }
  // Raster handoff keeps KML until native add success; cancellation keeps prior vectors.
  {
    let retired=0;
    const old={setEnabled(){retired++;}},next={setEnabled(){}};
    const p={data:{uomDivisionEnabled:true},_activeUomPluginSource:'uom4',_uomPolygons:[{id:'old'}],queueMapGraphicsSync(){},
      _pendingUomPluginTransition:{fromSource:'uom4',toSource:'uom',fromPlugin:old,toPlugin:next}};
    assert.equal(plugins.tryFinalizePendingUomTransition(p,'uom',{uomStatus:'适飞空域',uomTone:'safe',uomLoading:false}),false);
    assert.equal(retired,0);assert.equal(p._uomPolygons.length,1);
    plugins.cancelPendingUomTransition(p);assert.equal(p._uomPolygons.length,1);assert.equal(retired,0);
    p._pendingUomPluginTransition={fromSource:'uom4',toSource:'uom',fromPlugin:old,toPlugin:next};
    assert.equal(plugins.tryFinalizePendingUomTransition(p,'uom',{uomRenderReady:true}),true);
    assert.equal(retired,1);assert.equal(p._uomPolygons.length,0);
  }
  // DJI repeated pending viewport requests, cancellation, and old-response rejection.
  {
    const calls=[];
    const {page:p}=component('dji',{require:id=>id==='../../utils/dji'?{fetchDjiAreas(options){let resolve;const promise=new Promise(r=>resolve=r);const call={options,resolve,aborted:false};calls.push(call);options.onRequestTask({abort(){call.aborted=true;}});return promise;},buildAreaGraphics:areas=>({polygons:areas,circles:[]})}:null});
    p.describeDjiStatus=()=>({});
    p.init({center:{latitude:28.2,longitude:112.9},scale:11});
    for(let i=0;i<100;i++)p.updateViewport({center:{latitude:28.2,longitude:112.9},scale:11,force:true});
    assert.equal(calls.length,1);calls[0].resolve([{id:'A'}]);await flush();
    p.updateViewport({center:{latitude:30,longitude:115},scale:11});assert.equal(calls.length,2);
    p.updateViewport({center:{latitude:28.2,longitude:112.9},scale:11});assert(calls[1].aborted);
    calls[1].resolve([{id:'B'}]);await flush();assert.equal(p._polygons[0].id,'A');
    p.updateViewport({center:{latitude:31,longitude:116},scale:11});p.setEnabled(false);
    assert(calls[2].aborted);calls[2].resolve([{id:'C'}]);await flush();assert.equal(p._polygons.length,0);
  }
  console.log('PASS DJI: identical requests merged; return to cached viewport cancels stale request; disabled layer cannot reappear.');
  {
    let response;
    const api=commonJs('packages/dji/utils/dji.js',{wx:{request(options){options.success({statusCode:200,data:response});return {abort(){}};}}});
    const params={rect:{ltlat:30,ltlng:112,rblat:28,rblng:114}};
    response={error:'gateway'};await assert.rejects(api.fetchDjiAreas(params),/Invalid DJI/);
    response={data:{areas:[]}};assert.equal((await api.fetchDjiAreas(params)).length,0);
  }
  console.log('PASS: overlapping downloads reused, serial view commits, reverse/cancelled handoff, invalid DJI response retains data semantics.');
  {
    const calls=[];
    const {page:p}=component('uom4',{wx:{getStorageSync:()=>null,request(options){const call={options,aborted:false};calls.push(call);return {abort(){call.aborted=true;options.fail({errMsg:'aborted'});}};}}});
    const shared={key:'13/1/1',url:'https://api.test/shared.kml'},obsolete={key:'13/1/2',url:'https://api.test/old.kml'};
    const first=p.loadTileResource(shared),unused=p.loadTileResource(obsolete);
    const unusedResult=Promise.allSettled([unused]);
    p.abortActiveRequests();assert(calls.every(c=>!c.aborted),'Viewport query cancellation retains static downloads');
    const reused=p.loadTileResource(shared);assert.equal(calls.length,2,'Reuse in-flight KML resource');
    p.retainTileRequests([shared]);assert.equal(calls[0].aborted,false);assert.equal(calls[1].aborted,true);
    calls[0].options.success({statusCode:200,data:'<kml><Document></Document></kml>'});
    await Promise.all([first,reused,unusedResult]);
    await p.loadTileResource(shared);assert.equal(calls.length,2,'Reuse decoded resource without a new request');
    const changed=p.loadTileResource({...shared,url:'https://api.test/new-version.kml'});
    const changedResult=Promise.allSettled([changed]);assert.equal(calls.length,3,'Changed resource URL cannot reuse old geometry');
    p.setEnabled(false);await changedResult;assert.equal(calls[2].aborted,true);
  }
  console.log('PASS KML: in-flight and decoded resource reuse; obsolete resources aborted; URL versions isolated; disable cancels remaining resources.');
})().catch(error=>{console.error(error);process.exitCode=1;});
