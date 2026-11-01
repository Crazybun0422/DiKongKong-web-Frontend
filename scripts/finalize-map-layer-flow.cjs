const fs=require('node:fs'),path=require('node:path');
const root='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';const changes=[];
function rep(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,80));return s.replace(a,b);}
let f='pages/map/utils/map-plugins.js',s=fs.readFileSync(`${root}/${f}`,'utf8');
s=rep(s,'function clearInactiveUomGraphics(page) {','function clearInactiveUomGraphics(page, reason = "source-switch") {');
s=rep(s,'  if (hadTileMarkers) {','  if (hadTileMarkers || hadPolygons || hadPolylines) console.info("[uom-graphics-clear]", {\n    reason, source: page._activeUomPluginSource, polygons: page._uomPolygons?.length || 0,\n    polylines: page._uomPolylines?.length || 0, markers: page._uomTileMarkers?.length || 0\n  });\n  if (hadTileMarkers) {');
s=rep(s,'if (transition.fromSource !== "uom4") clearInactiveUomGraphics(page);','if (transition.fromSource !== "uom4") clearInactiveUomGraphics(page, "transition-cancel");');
s=rep(s,'  if (!hasGraphics) {\n    clearInactiveUomGraphics(page);','  if (!hasGraphics) {\n    clearInactiveUomGraphics(page, "handoff-complete");');
s=rep(s,'function ensureUomPluginReady(page, optionsOrRetry = {}, explicitRetry = 0) {',`function setUomLayerEnabled(page, enabled) {
  if (enabled !== false) {
    const plugin = ensureUomPluginReady(page);
    if (plugin) plugin.setEnabled(true);
    return;
  }
  const transition = page._pendingUomPluginTransition;
  const plugins = new Set([page._uomPlugin, transition?.fromPlugin, transition?.toPlugin,
    ...Object.values(page._uomPluginRefs || {})]);
  page._pendingUomPluginTransition = null;
  page._pendingUomPluginSwitch = null;
  page._uomGraphicsCommit = null;
  if (page._uomPluginInitTimer) clearTimeout(page._uomPluginInitTimer);
  page._uomPluginInitTimer = null;
  if (transition) {
    page._uomPlugin = transition.fromPlugin;
    page._activeUomPluginSource = transition.fromSource;
  }
  plugins.forEach(plugin => { if (plugin) deactivateUomPlugin(plugin); });
  clearInactiveUomGraphics(page, "disabled");
}

function ensureUomPluginReady(page, optionsOrRetry = {}, explicitRetry = 0) {
  if (page.data.uomDivisionEnabled === false) {
    setUomLayerEnabled(page, false);
    return null;
  }`);
s=rep(s,'module.exports = {\n','module.exports = {\n  setUomLayerEnabled,\n');changes.push([f,s]);
f='pages/map/utils/layer-panel.js';s=fs.readFileSync(`${root}/${f}`,'utf8').replace(/\r\n/g,'\n');
s='const { setUomLayerEnabled } = require("./map-plugins");\n'+s;
s=rep(s,'      if (page._uomPlugin && typeof page._uomPlugin.setEnabled === "function") {\n        page._uomPlugin.setEnabled(nextValue);\n      }','      setUomLayerEnabled(page, nextValue);');changes.push([f,s]);
f='pages/map/utils/cleanup.js';s=fs.readFileSync(`${root}/${f}`,'utf8').replace(/\r\n/g,'\n');
s=rep(s,'  const uomPlugins = page._uomPluginRefs', '  page._pendingUomPluginTransition = null;\n  page._pendingUomPluginSwitch = null;\n  page._uomGraphicsCommit = null;\n  const uomPlugins = page._uomPluginRefs');changes.push([f,s]);
f='packages/dji/components/dji-no-fly-layer/index.js';s=fs.readFileSync(`${root}/${f}`,'utf8');
s=rep(s,'    cancelDjiRequest() {', '    destroy() {\n      this._enabled = false;\n      this.cancelDjiRequest();\n    },\n\n    cancelDjiRequest() {');
s=rep(s,'      if (task && typeof task.abort === "function") task.abort();','      if (task && typeof task.abort === "function") {\n        try { task.abort(); } catch (error) { console.warn("DJI request abort failed", error); }\n      }');changes.push([f,s]);
for(const pkg of ['uom','uom5']){
 f=`packages/${pkg}/components/uom-plugin/index.js`;s=fs.readFileSync(`${root}/${f}`,'utf8');
 s=rep(s,'retained: nextHandles.size - additions.length });','retained: nextHandles.size - additions.length,\n            ids: Array.from(nextHandles.values(), handle => handle.overlayId),\n            removedIds: Array.from(obsoleteHandles.values(), handle => handle.overlayId) });');
 changes.push([f,s]);
}
for(const [f,s]of changes){const backup=path.resolve('artifacts/map-layer-flow-before',f);if(!fs.existsSync(backup)){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(`${root}/${f}`,backup);}fs.writeFileSync(`${root}/${f}`,s);}
