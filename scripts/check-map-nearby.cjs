const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const mini='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const android='D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity';
const translations=JSON.parse(fs.readFileSync(path.join(android,'zh.json'),'utf8'));
const box={window:null,document:{addEventListener(){}}};box.window=box;vm.createContext(box);
for(const f of ['source.js','drone-game-sharing.js','android-page-fixes.js','nearby-request-fixes.js'])vm.runInContext(fs.readFileSync(path.join(android,f),'utf8'),box);
const tick=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
async function check(platform){
  const requests=[],cache={},components={};let currentFile;
  const wx={request(o){let aborted=false;const task={abort(){aborted=true;}};
    requests.push({o,task,get aborted(){return aborted;},ok(data=[]){o.success({statusCode:200,data:{data}});},fail(){o.fail({errMsg:'network failed'});}});return task;}};
  function load(file){
    if(cache[file])return cache[file].exports;
    const module={exports:{}};cache[file]=module;
    const requireLocal=name=>{
      const normalized=path.posix.normalize(path.posix.join(path.posix.dirname(file),name))+'.js';
      if(normalized==='utils/profile.js')return {resolveApiBase:x=>x||'https://test',getAuthToken:()=>''};
      if(normalized==='pages/map/utils/map-shared.js')return {clampMapScale:Number,applyMapStatusBarStyle(){}};
      return load(normalized);
    };
    const source=platform==='mini'?fs.readFileSync(path.join(mini,file),'utf8'):
      '('+box.MiniSource.modules[file].toString()+')(require,module,exports,Page,Component,App,_t);';
    vm.runInNewContext(source,{require:requireLocal,module,exports:module.exports,wx,Component:c=>components[file]=c,
      Page(){},App(){},_t:key=>translations[key]||key,console:{warn(){},log(){}},setTimeout,clearTimeout,Date,Math,Promise},{filename:file});
    return module.exports;
  }
  const nearby=load('pages/map/utils/nearby-fetch.js');
  function page(){return {data:{center:{latitude:31,longitude:120},scale:16,merchantMarkersEnabled:true},pinsOn:true,
    isPinLayerEnabled(){return this.pinsOn;},shouldFetchNearbyMarkers(s){return s>10;},getCurrentScaleInMeters(s){return 1000/s;},
    getApiBase(){return 'https://test';},getAuthToken(){return this.token||'';},
    applyNearbyPins(x){this.pins=x;},applyNearbyMarkers(x){this.markers=x;},
    updateOverlayGraphics(){},syncAllMarkers(){},updateCenterPinIndicator(){}};}
  for(const [kind,method] of [['pins','requestNearbyPins'],['markers','requestNearbyMarkers']]){
    const p=page(),call=(lat=31,extra={})=>nearby[method](p,{center:{latitude:lat,longitude:120},...extra});
    let start=requests.length;call();const first=requests.at(-1);call(31,{force:true});assert.equal(requests.length,start+1,'merge same pending forced query');
    call(32);const second=requests.at(-1);assert(first.aborted,'old request aborted');
    first.ok(['old']);second.ok(['new']);await tick();assert.equal(p[kind][0],'new','late old result ignored');
    call(33);const third=requests.at(-1);call(32);assert(third.aborted,'return to cached area cancels pending destination');
    start=requests.length;third.ok(['wrong']);await tick();assert.equal(p[kind][0],'new');assert.equal(requests.length,start);
    call(32,{force:true});assert.equal(requests.length,start+1,'force refresh after completion still fetches');requests.at(-1).ok(['fresh']);await tick();
    call(34);const disabled=requests.at(-1);if(kind==='pins')p.pinsOn=false;else p.data.merchantMarkersEnabled=false;
    call(34);assert(disabled.aborted);disabled.ok(['disabled']);await tick();assert.equal(p[kind][0],'fresh');
    if(kind==='pins')p.pinsOn=true;else p.data.merchantMarkersEnabled=true;
    call(35);const zoomed=requests.at(-1);call(35,{scale:5});assert(zoomed.aborted,'zoom outside display threshold aborts');
    call(36);requests.at(-1).fail();await tick();start=requests.length;call(36);assert.equal(requests.length,start+1,'failure can retry');
    requests.at(-1).ok([]);await tick();
    p.token='new-session';start=requests.length;call(36);assert.equal(requests.length,start+1,'session cache isolation');requests.at(-1).ok([]);await tick();
  }
  const file='packages/dji/components/temporary-no-fly-layer/index.js';load(file);const config=components[file];
  const c={...config.methods,triggerEvent(name,value){this[name]=value;}};config.lifetimes.attached.call(c);
  c._apiBase='https://test';c._center={latitude:31,longitude:120};c._scale=16;
  const fetch=(lat,force=false)=>{c._center={latitude:lat,longitude:120};c.fetchTemporaryZones({force});};
  fetch(31);const a=requests.at(-1),count=requests.length;fetch(31,true);assert.equal(requests.length,count);a.ok([]);await tick();assert(c._ready);
  fetch(32);const b=requests.at(-1);assert.equal(c.statuschange.temporaryNoFlyTone,'neutral');
  fetch(31);assert(b.aborted);b.fail();await tick();assert(c._ready,'cached area restores ready after cancel');assert.equal(c.statuschange.temporaryNoFlyTone,'safe');
  fetch(33);requests.at(-1).fail();await tick();assert.equal(c.statuschange.temporaryNoFlyText,'加载失败');assert.notEqual(c.statuschange.temporaryNoFlyTone,'safe');
  fetch(34);const hidden=requests.at(-1);config.pageLifetimes.hide.call(c);assert(hidden.aborted);hidden.ok([]);await tick();assert(!c._ready);
  const before=requests.length;config.pageLifetimes.show.call(c);assert.equal(requests.length,before+1);const shown=requests.at(-1);
  c.setEnabled(false);assert(shown.aborted);shown.ok([]);await tick();assert.equal(c.statuschange.temporaryNoFlyText,'已禁用');
  c.setEnabled(true);const detached=requests.at(-1);config.lifetimes.detached.call(c);assert(detached.aborted);detached.ok([]);await tick();assert(!c._ready);
  console.log(platform+': duplicate requests, abort, stale success/failure, cache return, zoom, account change, failure retry, hide/show, layer disable, detach passed');
}
(async()=>{await check('mini');await check('android');})().catch(e=>{console.error(e);process.exitCode=1;});
