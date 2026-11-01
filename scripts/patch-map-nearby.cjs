const fs = require('fs'), path = require('path'), vm = require('vm');
const mini = 'E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const android = 'D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity';
const helper = `// One pending request per layer and owner. Invalidate before abort callbacks run.
function cancel(owner, slot) {
  const pending = owner[slot];
  owner[slot] = null;
  if (pending) { try { pending.task?.abort(); } catch (_) {} }
}
function begin(owner, slot, key) {
  if (owner[slot]?.key === key) return null;
  cancel(owner, slot);
  const pending = { key, task: null };
  pending.current = () => owner[slot] === pending;
  pending.onRequestTask = task => {
    if (pending.current()) pending.task = task;
    else task?.abort();
  };
  pending.finish = () => { if (pending.current()) owner[slot] = null; };
  owner[slot] = pending;
  return pending;
}
// Match the precision actually sent by the nearby endpoints.
function queryKey(apiBase, token, latitude, longitude, radius, scale) {
  return JSON.stringify([apiBase, token, latitude.toFixed(6), longitude.toFixed(6),
    radius.toFixed(3), scale == null ? null : Math.round(scale)]);
}
module.exports = { begin, cancel, queryKey };
`;
function replace(s, a, b) { if (!s.includes(a)) throw Error('Missing anchor: '+a.slice(0,110)); return s.replace(a,b); }
function section(s, name, transform) {
  const start=s.indexOf('function '+name+'('); if(start<0)throw Error(name);
  const end=s.indexOf('\nfunction ',start+10);
  return s.slice(0,start)+transform(s.slice(start,end<0?s.length:end))+s.slice(end<0?s.length:end);
}
const transforms = {
  'utils/pins.js': s => resource(s,'requestPinResource','fetchNearbyPins'),
  'utils/markers.js': s => resource(s,'requestMarkerResource','fetchNearbyMarkers'),
  'utils/no-fly-zones.js': s => section(s,'fetchNearbyNoFlyZones',taskHook),
  'pages/map/utils/nearby-fetch.js': s => {
    s='const latest = require("../../../utils/latest-map-request");\n'+s;
    for(const [name,kind,enabled,cache] of [
      ['requestNearbyPins','Pins','page.isPinLayerEnabled()','_lastNearbyPinFetch'],
      ['requestNearbyMarkers','Markers','page.data.merchantMarkersEnabled !== false','_lastNearbyFetch']]) {
      s=section(s,name,t=>{
        const slot='_pending'+kind+'Fetch';
        t=replace(t,'  const center =',`  if (page._nearbyRequestsHidden) return;\n  const center =`);
        t=replace(t,'{\n  if (','{\n  if (');
        t=replace(t,kind==='Pins'?'  if (!page.isPinLayerEnabled()) {':'  if (page.data.merchantMarkersEnabled === false) {',
          (kind==='Pins'?'  if (!page.isPinLayerEnabled()) {':'  if (page.data.merchantMarkersEnabled === false) {')+`\n    latest.cancel(page, "${slot}");`);
        const threshold=kind==='Pins'?'  if (!force && !page.shouldFetchNearbyMarkers(scale, center.latitude)) {':'  if (!page.shouldFetchNearbyMarkers(scale, center.latitude)) {';
        t=replace(t,threshold,threshold+`\n    latest.cancel(page, "${slot}");`);
        t=replace(t,`  const prev = page.${cache} || {};`,
          `  const apiBase = page.getApiBase();\n  const token = page.getAuthToken();\n  const scope = JSON.stringify([apiBase, token]);\n  const scaleInMeters = page.getCurrentScaleInMeters(scale, center.latitude);\n  const key = latest.queryKey(apiBase, token, latitude, longitude, radiusKm, scaleInMeters);\n  if (page.${slot}?.key === key) return;\n  latest.cancel(page, "${slot}");\n  const prev = page.${cache} || {};`);
        t=replace(t,'if (!force && moveMeters < 50 && radiusDiff < 0.2 && !isStale)',
          'if (!force && prev.scope === scope && prev.scaleInMeters === Math.round(scaleInMeters) && moveMeters < 50 && radiusDiff < 0.2 && !isStale)');
        t=replace(t,`  const requestId = now;\n  page._active${kind}Request = requestId;`,
          `  const pending = latest.begin(page, "${slot}", key);\n  if (!pending) return;`);
        t=replace(t,'  fetchNearby'+kind+'(', '  return fetchNearby'+kind+'(');
        t=t.replace(/scaleInMeters: page.getCurrentScaleInMeters\(scale, (?:center.latitude|latitude)\)/,'scaleInMeters');
        t=replace(t,'apiBase: page.getApiBase(),\n      token: page.getAuthToken()', 'apiBase, token, onRequestTask: pending.onRequestTask');
        t=replace(t,`if (page._active${kind}Request !== requestId) return;`, `if (!pending.current() || !(${enabled}) || page._nearbyRequestsHidden) return;`);
        t=replace(t,'        timestamp: now','        scope, scaleInMeters: Math.round(scaleInMeters),\n        timestamp: Date.now()');
        t=replace(t,'    .catch((err) => {','    .catch((err) => {\n      if (!pending.current()) return;');
        t=replace(t,`      if (page._active${kind}Request === requestId) {\n        page._active${kind}Request = null;\n      }`,'      pending.finish();');
        return t;
      });
    }
    s=replace(s,'function scheduleFetchPins(page, delay = 0, options = {}) {','function scheduleFetchPins(page, delay = 0, options = {}) {\n  if (page._nearbyRequestsHidden) return;');
    s=replace(s,'function scheduleFetchMarkers(page, delay = 0, options = {}) {','function scheduleFetchMarkers(page, delay = 0, options = {}) {\n  if (page._nearbyRequestsHidden) return;');
    return s;
  },
  'pages/map/utils/cleanup.js': s => {
    for(const hook of ['onHide','onUnload']) s=replace(s,`function ${hook}(page) {`,`function ${hook}(page) {\n  page._nearbyRequestsHidden = true;\n  require("../../../utils/latest-map-request").cancel(page, "_pendingPinsFetch");\n  require("../../../utils/latest-map-request").cancel(page, "_pendingMarkersFetch");\n  if (page._pinsFetchTimer) clearTimeout(page._pinsFetchTimer);\n  if (page._markersFetchTimer) clearTimeout(page._markersFetchTimer);`);
    return s;
  },
  'pages/map/utils/lifecycle.js': s => replace(s,'function onShow(page) {',`function onShow(page) {
  const resumeNearby = page._nearbyRequestsHidden;
  page._nearbyRequestsHidden = false;
  if (resumeNearby) {
    page.scheduleFetchPins(0);
    page.scheduleFetchMarkers(0);
  }`),
  'pages/map/utils/layer-panel.js': s => {
    s=replace(s,'function applyMerchantMarkersToggle(page, enabled) {\n  if (enabled === false) {','function applyMerchantMarkersToggle(page, enabled) {\n  if (enabled === false) {\n    require("../../../utils/latest-map-request").cancel(page, "_pendingMarkersFetch");');
    return section(s,'applyPinLayerToggle',t=>replace(t,'  if (!page.isPinLayerEnabled()) {','  if (!page.isPinLayerEnabled()) {\n    require("../../../utils/latest-map-request").cancel(page, "_pendingPinsFetch");'));
  },
  'packages/dji/components/temporary-no-fly-layer/index.js': s => {
    s='const latest = require("../../../../utils/latest-map-request");\n'+s;
    s=replace(s,'    detached() {\n      this._activeRequestId = 0;\n    }','    detached() { this.destroy(); }');
    s=replace(s,'  methods: {',`  pageLifetimes: {
    hide() { this._requestHidden = true; latest.cancel(this, "_pendingZoneFetch"); },
    show() { this._requestHidden = false; this.fetchTemporaryZones(); }
  },
  methods: {
    destroy() { this._requestHidden = true; latest.cancel(this, "_pendingZoneFetch"); },`);
    s=replace(s,'      if (!nextEnabled) {','      if (!nextEnabled) {\n        latest.cancel(this, "_pendingZoneFetch");');
    s=replace(s,'    fetchTemporaryZones(options = {}) {\n      if (!this._enabled) return;', '    fetchTemporaryZones(options = {}) {\n      if (!this._enabled || this._requestHidden) return;');
    s=replace(s,'      const prev = this._lastFetch || {};',`      const scope = this._apiBase;
      const key = latest.queryKey(scope, "", latitude, longitude, radiusKm);
      if (this._pendingZoneFetch?.key === key) return;
      latest.cancel(this, "_pendingZoneFetch");
      const prev = this._lastFetch || {};`);
    s=replace(s,'if (!force && moveMeters < 50', 'if (!force && prev.scope === scope && moveMeters < 50');
    s=replace(s,'      const requestId = ++this._requestSeq;\n      this._activeRequestId = requestId;',`      const pending = latest.begin(this, "_pendingZoneFetch", key);
      if (!pending) return;
      this._ready = false;
      this._loadFailed = false;
      this.emitStatusChange(this.describeTemporaryStatus());`);
    s=replace(s,'      fetchNearbyNoFlyZones(', '      return fetchNearbyNoFlyZones(');
    s=replace(s,'          apiBase: this._apiBase\n','          apiBase: this._apiBase,\n          onRequestTask: pending.onRequestTask\n');
    s=replace(s,'if (this._activeRequestId !== requestId) return;', 'if (!pending.current() || !this._enabled || this._requestHidden) return;');
    s=replace(s,'            timestamp: now','            scope,\n            timestamp: Date.now()');
    const begin=s.indexOf('        .catch((err) => {',s.indexOf('fetchTemporaryZones(options'));
    const end=s.indexOf('\n    },',begin);
    s=s.slice(0,begin)+`        .catch((err) => {
          if (!pending.current()) return;
          console.warn("Fetch temporary no-fly zones failed", err);
          this._ready = false;
          this._loadFailed = true;
          this.emitStatusChange(this.describeTemporaryStatus());
        })
        .finally(() => pending.finish());`+s.slice(end);
    // Do not infer a safe area from an incomplete or failed request.
    s=replace(s,'      const center = this._center;\n',`      if (!this._ready) return {
        temporaryNoFlyZoneInfo: null,
        temporaryNoFlyText: this._loadFailed ? "加载失败" : "评估中",
        temporaryNoFlyTone: this._loadFailed ? "warn" : "neutral"
      };
      const center = this._center;
`);
    return s;
  }
};
function taskHook(t) {
  t=replace(t,'    wx.request({','    const requestTask = wx.request({');
  return replace(t,'      fail: (err) => reject(err)\n    });','      fail: (err) => reject(err)\n    });\n    options.onRequestTask?.(requestTask);');
}
function resource(s,request,fetch) {
  s=section(s,request,taskHook);
  return section(s,fetch,t=>replace(t,'    apiBase: options.apiBase,','    onRequestTask: options.onRequestTask,\n    apiBase: options.apiBase,'));
}
// Patch the existing Android bodies as well: do not replace Android-owned behavior with mini source.
const box={document:{addEventListener(){}}};box.window=box;vm.createContext(box);
vm.runInContext(fs.readFileSync(path.join(android,'source.js'),'utf8'),box);
for(const file of ['drone-game-sharing.js','android-page-fixes.js']) vm.runInContext(fs.readFileSync(path.join(android,file),'utf8'),box);
let bundle='/* Generated scoped nearby-request fixes; preserves Android module bodies. */\n';
const writes=[];
for(const [name,transform] of Object.entries(transforms)) {
  const filename=path.join(mini,name), original=fs.readFileSync(filename,'utf8').replace(/\r\n/g,'\n');
  const next=transform(original);new vm.Script(next);writes.push([filename,next]);
  const fn=box.MiniSource.modules[name].toString();
  const start=fn.indexOf('{'), finish=fn.lastIndexOf('}');
  const body=transform(fn.slice(start+1,finish).replace(/\r\n/g,'\n'));
  bundle+=`MiniSource.modules[${JSON.stringify(name)}]=${fn.slice(0,start+1)}${body}};\n`;
}
writes.push([path.join(mini,'utils/latest-map-request.js'),helper]);
bundle+=`MiniSource.modules["utils/latest-map-request.js"]=function(require,module,exports){\n${helper}\n};\n`;
new vm.Script(bundle);
writes.push([path.join(android,'nearby-request-fixes.js'),bundle]);
const htmlPath=path.join(android,'index.html'), html=fs.readFileSync(htmlPath,'utf8');
writes.push([htmlPath,replace(html,'<script src="runtime.js">','<script src="nearby-request-fixes.js"></script><script src="runtime.js">')]);
for(const [file,text] of writes) fs.writeFileSync(file,text);
console.log('Updated mini and Android nearby requests:', writes.length,'files');
