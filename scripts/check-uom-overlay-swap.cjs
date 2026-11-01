const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const root='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/packages';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(pkg){
 const source=fs.readFileSync(`${root}/${pkg}/components/uom-plugin/index.js`,'utf8');
 const start=source.indexOf('    applyWmsOverlays(tiles, options = {}) {'),end=source.indexOf('    tileSignature(tile)',start);
 let timerId=0;const timers=new Map(),removed=[],callbacks=[];
 const retainStart=source.indexOf('    retainVisibleWmsBatchTiles('),retainEnd=source.indexOf('    cancelPendingWmsBatch(',retainStart);
 const methods=vm.runInNewContext('({'+source.slice(retainStart,retainEnd)+source.slice(start,end)+'})',{console:{error(){},warn(){}},setTimeout:(f,ms)=>{timers.set(++timerId,{f,ms});return timerId;},clearTimeout:id=>timers.delete(id),Date,Map,Set,Number,Promise,buildWmsTileListKey:tiles=>tiles.map(t=>t.id).join(',')});
 const old={overlayId:99,signature:'old',stale:false};
 const page=Object.assign({data:{uomDivisionEnabled:true},_wmsOverlayEpoch:1,_wmsBatchSeq:0,_wmsOverlaySeed:100,_wmsOverlayMap:new Map([['old',old]]),_currentWmsTileKeyApplied:'old',
  mapCtx:{addGroundOverlay:args=>callbacks.push(args)},processWmsOverlayRemovalQueue(){},clearWmsOverlayHandleTimer(){},queueWmsOverlayRemoval(id){removed.push(id);},cancelPendingWmsBatch(){this._wmsPendingBatch=null;},syncUomLoadingState(){},updateUomTileWarning(){},tileSignature:tile=>tile.id,ensureWmsTileResource:async src=>src,
  refreshWmsOverlay(){this.retried=(this.retried||0)+1;},recordOverlayEvent(){},triggerEvent(){},releaseWmsTileResource(){}},methods);
 return {page,old,removed,callbacks,timers};
}
const tiles=[{id:'new-a',src:'a',bounds:{}},{id:'new-b',src:'b',bounds:{}}];
(async()=>{for(const pkg of ['uom','uom5']){
 let f=fixture(pkg);f.page.applyWmsOverlays(tiles,{overlayKey:'new'});await flush();f.callbacks[0].success();f.callbacks[1].fail({errMsg:'network'});
 assert(!f.page._wmsOverlayMap.has('old'),`${pkg}: visible new level must retire obsolete old level despite a sibling failure`);assert(f.removed.includes(99));assert.equal(f.page._currentWmsTileKeyApplied,'');assert(!f.removed.includes(f.callbacks[0].id),'Keep successfully displayed tiles after sibling failure');assert.equal(f.page._wmsOverlayMap.get('new-a').overlayId,f.callbacks[0].id);
 assert([...f.timers.values()].some(t=>t.ms<10000),'Idle map must retry without needing a gesture');
 f=fixture(pkg);f.page.applyWmsOverlays(tiles,{overlayKey:'new'});await flush();f.callbacks[0].success();assert(f.removed.includes(99),'Retire old level with the first visible new tile');f.callbacks[1].success();assert.equal(f.removed.filter(id=>id===99).length,1);assert.equal(f.page._wmsOverlayMap.size,2);assert.equal(f.page._currentWmsTileKeyApplied,'new');
 f=fixture(pkg);f.page.applyWmsOverlays(tiles,{overlayKey:'new'});await flush();f.callbacks.forEach(c=>c.fail({errMsg:'offline'}));assert.equal(f.page._wmsOverlayMap.get('old'),f.old,'Keep old map when no replacement tile renders');assert(!f.removed.includes(99));
 f=fixture(pkg);f.page.mapCtx.addGroundOverlay=args=>args.success();f.page.applyWmsOverlays(tiles,{overlayKey:'new'});await flush();assert.equal(f.page._wmsOverlayMap.size,2,'Synchronous callbacks must not prematurely commit the first tile');
 f=fixture(pkg);f.page.applyWmsOverlays(tiles,{overlayKey:'new'});await flush();f.page._wmsOverlayEpoch++;f.callbacks.forEach(c=>c.success());assert.equal(f.page._wmsOverlayMap.get('old'),f.old,'Late old-epoch callbacks cannot commit');
 f=fixture(pkg);f.page.applyWmsOverlays(tiles,{overlayKey:'new'});await flush();const timeout=[...f.timers.values()].find(t=>t.ms>=10000);assert(timeout);timeout.f();assert.equal(f.page._wmsOverlayMap.get('old'),f.old,'Missing native callback must retain the old map');f.callbacks[0].success();assert.equal(f.page._wmsOverlayMap.get('old'),f.old);
 console.log(`PASS ${pkg}: progressive retirement, partial/all failure, idle retry, synchronous and late callbacks, timeout.`);
}})().catch(error=>{console.error(error);process.exitCode=1;});
