const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const root='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
function method(file,start,end,context={}){const s=fs.readFileSync(root+'/'+file,'utf8');return vm.runInNewContext('({'+s.slice(s.indexOf(start),s.indexOf(end,s.indexOf(start)))+'})',context);}
const s=fs.readFileSync(root+'/pages/map/utils/map-plugins.js','utf8');
const fn=vm.runInNewContext('('+s.slice(s.indexOf('function tryFinalizePendingUomTransition('),s.indexOf('\nfunction deactivateUomPlugin('))+')',{console:{info(){}},clearInactiveUomGraphics:p=>p.cleared=true,deactivateUomPlugin:p=>p.disabled=true});
function page(){return {_pendingUomPluginTransition:{fromSource:'uom',toSource:'uom4',fromPlugin:{},toPlugin:{}},_activeUomPluginSource:'uom'};}
let p=page();assert.equal(fn(p,'uom4',{uomLoading:false,uomTone:'warn',uomStatus:'空域数据加载失败'}),false);assert(!p.cleared);assert(p._pendingUomPluginTransition);
p=page();assert.equal(fn(p,'uom4',{uomLoading:false,uomTone:'alert',uomStatus:'管制空域'}),false,'Status alone cannot retire visible layers');
assert.equal(fn(p,'uom4',{}, {ready:true,graphicsApplied:true,polygons:[],polylines:[]}),true);assert(p.cleared,'Committed valid empty KML may complete the handover');
const query=method('packages/uom4/components/uom-plugin/index.js','    async queryKmlTiles() {','    rememberTileResource(',{requestRaw:()=>({}),normalizeTile:t=>t});
query.buildTileQueryUrl=()=>'/tiles';
(async()=>{
 for(const response of [{data:{success:false}},{data:{}},{data:{tiles:null}},{data:'gateway error'}]){query.trackRequest=async()=>response;await assert.rejects(query.queryKmlTiles(),/invalid-kml/);}
 query.trackRequest=async()=>({data:{success:true,data:{tiles:[]}}});assert.equal((await query.queryKmlTiles()).length,0);
 query.trackRequest=async()=>({data:{tiles:[{key:'known'}]}});assert.equal((await query.queryKmlTiles())[0].key,'known');
 const viewport=fs.readFileSync(root+'/pages/map/utils/map-viewport.js','utf8');
 const body=viewport.slice(viewport.indexOf('function centerOnPoint('),viewport.indexOf('\nfunction ',viewport.indexOf('function centerOnPoint(')+1));
 assert(!body.includes('page._uomPolygons = []'));assert(!body.includes('page._uomPolylines = []'));assert(body.includes('syncUomViewport(page,'));
 console.log('PASS: failed KML handover preserves old layer; valid empty data can clear; malformed responses cannot become empty maps; GPS recenter retains geometry while refreshing.');
})().catch(e=>{console.error(e);process.exitCode=1;});
