const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict'),{createRequire}=require('module');
const root='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const app={globalData:{}};global.getApp=()=>app;
global.wx={request(){throw Error('Preview must not depend on a request');},getStorageSync(){return ''}};
const req=createRequire(root+'/pages/temporary-no-fly-announcement/index.js');
const preview=require(root+'/pages/map/utils/pin-preview.js');
const graphics=require(root+'/pages/map/utils/map-graphics.js');
const launch=require(root+'/pages/map/utils/share-launch.js');
const zoneApi=require(root+'/utils/no-fly-zones.js');
const geometry=require(root+'/pages/map/utils/map-geometry.js');
const circle={type:'CIRCLE',circle:{latitude:31.305,longitude:120.705,radiusMeters:800}};
const square={type:'POLYGON',coordinates:[{latitude:31.28,longitude:120.68},{latitude:31.28,longitude:120.72},{latitude:31.32,longitude:120.72},{latitude:31.32,longitude:120.68}]};
let pageDef,nav,stack;
vm.runInNewContext(fs.readFileSync(root+'/pages/temporary-no-fly-announcement/index.js','utf8'),{
 require:req,Page:p=>pageDef=p,getApp:()=>app,getCurrentPages:()=>stack,
 wx:{navigateBack:o=>nav={type:'back',...o},navigateTo:o=>nav={type:'new',...o},redirectTo:o=>nav={type:'redirect',...o},showToast(){}},
 console:{warn(){}},setTimeout:()=>1,clearTimeout(){}
});
function map(){return {route:'pages/map/map',ringContains:geometry.ringContains,data:{temporaryNoFlyZoneEnabled:false},setData(v){Object.assign(this.data,v)},syncAllMarkers(){},updateCenterPinIndicator(){},centerOnPoint(p){this.data.center=p},updateOverlayGraphics(){graphics.updateOverlayGraphics(this)},applyPinPreview(p){preview.applyPinPreview(this,p)}};}
function tap(raw,index,mode){
 app.globalData={pendingMarkerFocus:{id:'old'}};const existing=map();
 stack=mode==='back'?[existing,{route:'pages/temporary-no-fly-announcement/index'}]:mode==='redirect'?Array.from({length:9},()=>({route:'other'})):[{route:'pages/temporary-no-fly-announcement/index'}];
 const shapes=[{...raw,extra:[]},...raw.extra];const page={...pageDef,data:{zones:[{id:'zone',raw,center:zoneApi.computeNoFlyZoneCenter(raw),mapTargets:shapes.map((s,i)=>({index:i,center:zoneApi.computeNoFlyZoneCenter(s)}))}]}};
 page.onMapTap({currentTarget:{dataset:{id:'zone',targetIndex:index}}});
 assert.equal(nav.type,mode);if(mode!=='back')assert.equal(nav.url,'/pages/map/map','center-share path would discard the preview');
 assert.equal(app.globalData.pendingMarkerFocus,null);assert.equal(app.globalData.pendingPinPreview.shapes.length,2);
 const target=mode==='back'?existing:map();assert(!target.data.polygons,'Do not render into a hidden page');
 launch.consumePendingPinPreview(target);
 assert.equal(app.globalData.pendingPinPreview,null);assert.equal(target.data.circles.length,1);assert.equal(target.data.polygons.length,1);
 assert.equal(target.data.circles[0].radius,800);assert.equal(target.data.polygons[0].points.length,5);
 assert.equal(target.data.center.latitude,zoneApi.computeNoFlyZoneCenter(shapes[index]).latitude);
 assert.equal(target._previewMarker,null);assert.equal(target.data.temporaryNoFlyZoneEnabled,false,'Explicit preview must not change saved layer preference');
 // An empty nearby response and other layer updates must not erase the selected shape.
 target._nfzCircles=[];target._nfzPolygons=[];target._uomPolygons=[];target._djiPolygons=[];target.updateOverlayGraphics();
 assert.equal(target.data.circles.length,1);assert.equal(target.data.polygons.length,1);
 assert.equal(target._previewTemporaryNoFlyPayload.temporaryNoFlyZoneInfo.linkPath,'/packages/no-fly-announcement/detail/index?id=zone');
 return {page,target};
}
for(const [base,extra] of [[circle,square],[square,circle]])for(const i of [0,1])for(const mode of ['back','new','redirect']){
 tap({...base,id:'zone',name:'圆形与方形组合',extra:[extra],announcement:{content:'测试'},effectiveFrom:1,effectiveTo:4102444800},i,mode);
}
const raw={...circle,id:'zone',extra:[square],announcement:{content:'测试'}};
const {page}=tap(raw,0,'back');app.globalData.pendingPinPreview={id:'newer'};nav.fail({errMsg:'cancel'});assert.equal(app.globalData.pendingPinPreview.id,'newer');
page._navigationLocked=false;page.onMapTap({currentTarget:{dataset:{id:'zone',targetIndex:1}}});nav.fail({errMsg:'cancel'});assert.equal(app.globalData.pendingPinPreview,null);assert.equal(page._navigationLocked,false);
console.log('PASS: circle/polygon both orders; both location links; existing/new/full-stack map; offline preview; later layer refresh; failed navigation cleanup.');
// Exercise the real bootstrap lifecycle with platform/UI side effects stubbed.
const bootFile=root+'/pages/map/utils/bootstrap.js',bootReq=createRequire(bootFile),boot={exports:{}};
vm.runInNewContext(fs.readFileSync(bootFile,'utf8'),{module:boot,require:n=>n==='./map-shared'?{...bootReq(n),applyMapStatusBarStyle(){}}:bootReq(n),getApp:()=>app,wx:{createMapContext(){return {}}},console:{log(){}},setTimeout,clearTimeout});
for(const pending of [false,true]){
 let locations=0;app.globalData={pendingPinPreview:pending?{id:'zone'}:null};
 const p=new Proxy({data:{center:{latitude:31,longitude:120},scale:13},consumeInitialUsePlanetCenterPoint:()=>true,consumePendingLaunchOptions:()=>({}),requestInitialLocation(){locations++},setData(v){Object.assign(this.data,v)}},{get:(o,k)=>k in o?o[k]:()=>undefined});
 boot.exports.onLoad(p,{});assert.equal(locations,pending?0:1,'GPS only auto-centers ordinary launches');
 if(pending)assert.equal(app.globalData.pendingPinPreview.id,'zone','Preview survives cold map bootstrap');
}
console.log('PASS: queued preview survives cold bootstrap; initial GPS cannot replace its viewport; ordinary launch still locates.');
