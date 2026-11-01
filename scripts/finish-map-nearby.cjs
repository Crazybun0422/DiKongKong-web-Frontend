const fs=require('fs'),vm=require('vm');
const root='D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity/';
let runtime=fs.readFileSync(root+'runtime.js','utf8');
const target="      page.onShow=()=>{refreshGift();requireModule('/utils/social-settings').watch(page);";
if(!runtime.includes(target))throw Error('headless lifecycle changed');
runtime=runtime.replace(target,`      const cancelNearby=()=>{
        page._nearbyRequestsHidden=true;
        const requests=requireModule('/utils/latest-map-request');
        requests.cancel(page,'_pendingPinsFetch');requests.cancel(page,'_pendingMarkersFetch');
        clearTimeout(page._pinsFetchTimer);clearTimeout(page._markersFetchTimer);
      };
      page.onShow=()=>{page._nearbyRequestsHidden=false;refreshGift();requireModule('/utils/social-settings').watch(page);`);
runtime=runtime.replace("page.onHide=()=>{requireModule('/utils/social-settings').stop(page);page.stopMyLocationDirectionTracking();};page.onUnload=()=>{requireModule('/utils/social-settings').stop(page);",
  "page.onHide=()=>{cancelNearby();requireModule('/utils/social-settings').stop(page);page.stopMyLocationDirectionTracking();};page.onUnload=()=>{cancelNearby();requireModule('/utils/social-settings').stop(page);");
new vm.Script(runtime);fs.writeFileSync(root+'runtime.js',runtime);
const zh=JSON.parse(fs.readFileSync(root+'zh.json','utf8'));
const key=Object.keys(zh).find(k=>zh[k]==='加载失败');if(!key)throw Error('missing failed translation');
let bundle=fs.readFileSync(root+'nearby-request-fixes.js','utf8');
bundle=bundle.replace('this._loadFailed ? "加载失败" : "评估中"',`this._loadFailed ? _t("${key}") : _t("mcab9bbad4e0b10ca")`);
new vm.Script(bundle);fs.writeFileSync(root+'nearby-request-fixes.js',bundle);
console.log('Android home hide/unload cancels pending nearby requests; reused existing translations.');
