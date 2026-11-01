const fs = require('fs'), vm = require('vm'), assert = require('node:assert/strict');
const root = 'E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/';
const plain = value => JSON.parse(JSON.stringify(value));
function load(file, dependencies = {}, extra = '') {
  const ctx = {module:{exports:{}}, console, setTimeout:()=>1, clearTimeout(){},
    require:key=>dependencies[key] || {USER_CREDENTIAL_TYPES:{}, USER_CREDENTIAL_META:{}},
    Page:definition=>ctx.page=definition, wx:{}, getApp:()=>ctx.app,
    app:{globalData:{}}, getCurrentPages:()=>[]};
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(root+file, 'utf8')+'\n'+extra,ctx,{filename:file});
  return ctx;
}
const zones = load('utils/no-fly-zones.js').module.exports;
const dependencies = {'../../utils/no-fly-zones':zones, '../../../utils/no-fly-zones':zones,
  '../../../utils/map-key':{getMapKeySync:()=>''},
  '../utils/preflight-qualification':{buildQualificationAssessment:()=>({})},
  './marker-shared':{isKmlShapeType:()=>false},
  './map-shared':{hasValidCoordinate:(lat,lng)=>Number.isFinite(lat)&&Number.isFinite(lng)}};
const preview = load('pages/map/utils/pin-preview.js',dependencies).module.exports;
const notice = load('pages/temporary-no-fly-announcement/index.js',dependencies,
  'globalThis.normalize=normalizeZoneItem; globalThis.payload=buildTemporaryPreviewPayload;');
const preflight = load('packages/preflight/index/index.js',dependencies,'globalThis.targets=buildMapTargets;');
const path = {type:'PATH', pathDistanceMeters:250, coordinates:[
  {latitude:23.1,longitude:113.2},{latitude:23.5,longitude:113.6},{latitude:23.8,longitude:113.3}]};
const first = path.coordinates[0];
assert.deepEqual(plain(zones.computeNoFlyZoneMapTarget(path)),first);
assert.notDeepEqual(plain(zones.computeNoFlyZoneCenter(path)),first);
assert.deepEqual(plain(zones.computeNoFlyZoneMapTarget({...path,coordinates:[[113.2,23.1],[113.6,23.5]]})),first);
assert.deepEqual(plain(zones.computeNoFlyZoneMapTarget({...path,coordinates:[{lat:23.1,lng:113.2}]})),first);
assert.equal(zones.computeNoFlyZoneMapTarget({...path,coordinates:[]}),null);
assert.equal(zones.computeNoFlyZoneMapTarget({...path,coordinates:[{latitude:100,longitude:113}]}),null);
const circle = {type:'CIRCLE',circle:{latitude:22.5,longitude:112.5,radiusMeters:1000}};
const polygon = {type:'POLYGON',coordinates:[{latitude:22,longitude:113},{latitude:22,longitude:114},{latitude:23,longitude:114}]};
for (const shape of [circle,polygon]) assert.deepEqual(plain(zones.computeNoFlyZoneMapTarget(shape)),plain(zones.computeNoFlyZoneCenter(shape)));
const second = {...path,coordinates:[{latitude:24.2,longitude:114.3},{latitude:25,longitude:115}]};
const combined = {...circle,id:'combo',name:'组合区域',extra:[path,second]};
const before = JSON.stringify(combined);
const normalized = notice.normalize(combined);
assert.equal(normalized.mapTargets.length,3);
let destination;
notice.wx.navigateTo=o=>destination=o.url;
notice.page.data.zones=[normalized];
for (const [index,start] of [[1,first],[2,second.coordinates[0]]]) {
  notice.page._navigationLocked=false;
  notice.page.onMapTap({currentTarget:{dataset:{id:'combo',targetIndex:index}}});
  assert.equal(destination,'/pages/map/map');
  const pending=notice.app.globalData.pendingPinPreview;
  assert.deepEqual(plain(pending.location),start);
  assert.deepEqual(plain(preview.computePinPreviewCenter({},pending.shape,pending)),start);
  assert.equal(pending.shapes.length,3);
  assert.deepEqual(plain(pending.shape.coordinates),index===1?path.coordinates:second.coordinates);
  assert.equal(pending.shape.width,250);
  preflight.wx.navigateTo=o=>destination=o.url;
  preflight.page.data.activeTemporaryNoFlyZoneCard={mapTargets:preflight.targets(combined)};
  preflight.page._navigationLocked=false;
  preflight.page.onTemporaryNoticeMapTap({currentTarget:{dataset:{targetIndex:index}}});
  const params=new URL(destination,'https://fixture.invalid').searchParams;
  assert.equal(Number(params.get('clat')),start.latitude);
  assert.equal(Number(params.get('clng')),start.longitude);
}
assert.equal(JSON.stringify(combined),before);
const ordinaryCenter=preview.computePinPreviewCenter({},path,{});
assert(Math.abs(ordinaryCenter.latitude-23.45)<1e-10);
assert(Math.abs(ordinaryCenter.longitude-113.4)<1e-10);
console.log('PASS mini: path start, mixed areas, both navigation handlers, preview focus, intact geometry and non-path compatibility');

const {fixture,server}=require('D:/Workspace/LowLatitudePlanet/scripts/check-mini-flows.cjs');
const {chromium}=require('playwright');
server.listen(0,'127.0.0.1',async()=>{let browser;try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage();
  page.setDefaultTimeout(10000);
  await fixture(page,'pages/temporary-no-fly-announcement/index');
  await page.waitForFunction(()=>typeof miniDebug!=='undefined'&&miniDebug.active?.data?.zones?.length);
  const result=await page.evaluate(({combined,first})=>{
    const api=miniDebug.require('/utils/no-fly-zones');
    const pin=miniDebug.require('/pages/map/utils/pin-preview');
    const current=miniDebug.active;
    const shapes=[combined,...combined.extra];
    current.data.zones=[{id:'combo',raw:combined,mapTargets:shapes.map((shape,index)=>({index,center:api.computeNoFlyZoneMapTarget(shape)}))}];
    current.onMapTap({currentTarget:{dataset:{id:'combo',targetIndex:1}}});
    const handoff=platformCalls.findLast(c=>c.method==='home');
    const payload=handoff?.args?.globalData?.pendingPinPreview;
    return {location:payload?.location,center:payload&&pin.computePinPreviewCenter({},payload.shape,payload),
      count:payload?.shapes?.length,coordinates:payload?.shape?.coordinates};
  },{combined,first});
  assert.deepEqual(result.location,first);
  assert.deepEqual(result.center,first);
  assert.equal(result.count,3);
  assert.deepEqual(result.coordinates,path.coordinates);
  console.log('PASS Android: bundled page -> native home handoff -> preview focus at path start, all shapes preserved');
}catch(e){console.error(e);process.exitCode=1}finally{await browser?.close();server.close()}});
