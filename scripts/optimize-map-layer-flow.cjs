const fs = require('node:fs');
const path = require('node:path');
const root = 'E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const pending = new Map();
function read(file) { return fs.readFileSync(`${root}/${file}`, 'utf8').replace(/\r\n/g, '\n'); }
function replace(s, before, after) { if (!s.includes(before)) throw Error(`Missing ${before.slice(0,100)}`); return s.replace(before, after); }
function save(file, s) {pending.set(file, s);}
for (const pkg of ['uom','uom5']) {
  const file = `packages/${pkg}/components/uom-plugin/index.js`;
  let s = read(file);
  s = replace(s, '    init(options = {}) {', '    init(options = {}) {\n      this._wmsViewportVersion = {};');
  s = replace(s, '      this._destroyed = true;', '      this._destroyed = true;\n      this._wmsViewportVersion = {};');
  s = replace(s, '      this.data.uomDivisionEnabled = next;', '      this._wmsViewportVersion = {};\n      this.data.uomDivisionEnabled = next;');
  s = replace(s, '    handleRegionChange(options = {}) {', '    handleRegionChange(options = {}) {\n      this._wmsViewportVersion = {};');
  s = replace(s, '      if (this._wmsFinalRefreshTimer) clearTimeout(this._wmsFinalRefreshTimer);\n      this._wmsFinalRefreshTimer = setTimeout(() => {\n        if (!this.mapCtx) return;',
    '      if (this._wmsFinalRefreshTimer) clearTimeout(this._wmsFinalRefreshTimer);\n      const version = this._wmsViewportVersion;\n      const request = this._wmsViewportRead = {};\n      const ctx = this.mapCtx;\n      const current = () => !this._destroyed && this.data.uomDivisionEnabled !== false &&\n        this.mapCtx === ctx && this._wmsViewportVersion === version && this._wmsViewportRead === request;\n      this._wmsFinalRefreshTimer = setTimeout(() => {\n        this._wmsFinalRefreshTimer = null;\n        if (!current()) return;');
  s = replace(s, '        const apply = (center, region) => {\n', '        const apply = (center, region) => {\n          if (!current()) return;\n');
  s = replace(s, '            success: (res) => {\n              const center = {', '            success: (res) => {\n              if (!current()) return;\n              const center = {');
  s = replace(s, '        this._currentWmsTiles = overlays;', '        if (this._wmsPendingBatch && this._wmsPendingBatch.overlayKey !== overlayKey) {\n          this.cancelPendingWmsBatch();\n        }\n        this._currentWmsTiles = overlays;');
  // Do not restart the same in-flight batch, including its downloads.
  s = replace(s, '      this.processWmsOverlayRemovalQueue();\n      this.cancelPendingWmsBatch();\n      const ctx = this.mapCtx;', '      const ctx = this.mapCtx;');
  const keyLine = '      const overlayKey = typeof options.overlayKey === "string" ? options.overlayKey : buildWmsTileListKey(tiles);';
  s = replace(s, keyLine, keyLine + '\n      if (this._wmsPendingBatch?.overlayKey === overlayKey && this._wmsPendingBatch.epoch === epoch) return;\n      this.processWmsOverlayRemovalQueue();\n      this.cancelPendingWmsBatch();');
  s = replace(s, 'createdHandles: new Map(), requestedSrcs: new Set(), timeout: null };', 'overlayKey, epoch, createdHandles: new Map(), requestedSrcs: new Set(), timeout: null };');
  s = replace(s, '      this._wmsPendingBatch = batch;', '      this._wmsPendingBatch = batch;\n      this.recordOverlayEvent("batch-start", { batch: batch.id, requested: (tiles || []).length });');
  s = replace(s, '          this._uomOverlayFailed = true;\n          this.updateUomTileWarning();', '          this._uomOverlayFailed = true;\n          this.recordOverlayEvent("batch-failed", { batch: batch.id, retained: currentHandles.size });\n          this.updateUomTileWarning();');
  s = replace(s, '          this._currentWmsTileKeyApplied = overlayKey;', '          this._currentWmsTileKeyApplied = overlayKey;\n          this.recordOverlayEvent("batch-commit", { batch: batch.id, added: additions.length, removed: obsoleteHandles.size, retained: nextHandles.size - additions.length });');
  s = replace(s, '        this.syncUomLoadingState();\n      };\n      (tiles || [])', '        this.syncUomLoadingState();\n        if (!failed) this.triggerEvent("statuschange", { uomRenderReady: true });\n      };\n      (tiles || [])');
  s = replace(s, '            success: () => settle(true), fail: () => settle(false) });', '            success: () => settle(true), fail: (error) => {\n              this.recordOverlayEvent("native-add-failed", { id: overlayId, error: error?.errMsg || "unknown" });\n              settle(false);\n            } });');
  s = replace(s, '    clearMapOverlays(options = {}) {', `    recordOverlayEvent(event, details = {}) {
      const entry = Object.assign({ event, at: Date.now(), epoch: this._wmsOverlayEpoch }, details);
      const trace = this._overlayTrace || (this._overlayTrace = []);
      trace.push(entry);
      if (trace.length > 80) trace.shift();
      if (event === "clear" || event.includes("failed")) console.info("[${pkg}-overlay]", entry);
    },

    clearMapOverlays(options = {}) {
      this.recordOverlayEvent("clear", { reason: options.reason || "explicit-clear", count: this._wmsOverlayMap?.size || 0 });`);
  // Reasons for all intentional full clears, with no per-tile console flood.
  s = replace(s, '      this.clearMapOverlays();\n      this.mapCtx = null;', '      this.clearMapOverlays({ reason: "destroy" });\n      this.mapCtx = null;');
  if (pkg === 'uom') s = replace(s, 'this.clearMapOverlays({ onCleared });', 'this.clearMapOverlays({ onCleared, reason: "disabled" });');
  else s = replace(s, '        this.clearMapOverlays();', '        this.clearMapOverlays({ reason: "disabled" });');
  const refresh = s.indexOf('    refreshWmsOverlay(');
  let head=s.slice(0,refresh), tail=s.slice(refresh);
  if (head.includes('this.clearMapOverlays();')) head=head.replace('this.clearMapOverlays();', 'this.clearMapOverlays({ reason: "render-color-change" });');
  tail=tail.replace('this.clearMapOverlays();','this.clearMapOverlays({ reason: "disabled-refresh" });');
  if (pkg==='uom') {
    tail=tail.replace('this.clearMapOverlays();','this.clearMapOverlays({ reason: "excluded-region" });');
    // Descriptor refresh is a load, not evidence that visible data should be erased.
    tail=tail.replace('        this.clearMapOverlays();\n        this._currentWmsTiles = [];\n        this._currentWmsTileKey = "";\n        this.updateStatusPanel();\n        return;\n      }\n      if (scale < descriptor.minZoom', '        this.updateStatusPanel();\n        return;\n      }\n      if (scale < descriptor.minZoom');
    tail=tail.replace('this.clearMapOverlays();','this.clearMapOverlays({ reason: "unsupported-scale" });');
  }
  s=head+tail;
  save(file,s);
}
// A ready vector event (including a valid empty result) owns the handoff, not the status text.
let file='packages/uom4/components/uom-plugin/index.js', s=read(file);
s=replace(s, '    setEnabled(enabled) {\n      this._enabled = enabled !== false;', '    setEnabled(enabled) {\n      const next = enabled !== false;\n      if (this._enabled === next) return;\n      this._enabled = next;');
s=replace(s, '      this._refreshSeq += 1;', '      this._refreshSeq += 1;\n      this._viewportRequestKey = this.buildTileQueryUrl();');
s=replace(s, '      if (options.force === true || !this._viewportDataReady || !this._resourceEntries.length || needsCoverage) {', '      const samePendingViewport = this.data.uomLoading === true && this._viewportRequestKey === this.buildTileQueryUrl();\n      if (!samePendingViewport && (options.force === true || !this._viewportDataReady || needsCoverage)) {');
s=replace(s, '        polylines: Array.isArray(this._graphics?.polylines) ? this._graphics.polylines : []\n', '        polylines: Array.isArray(this._graphics?.polylines) ? this._graphics.polylines : [],\n        ready: this._enabled && this._viewportDataReady,\n        revision: this._refreshSeq\n');
s=replace(s, '      return rawTiles\n        .map((tile) => normalizeTile(tile, this._apiBase))\n        .filter(Boolean);', '      const tiles = rawTiles.map((tile) => normalizeTile(tile, this._apiBase));\n      if (tiles.some(tile => !tile)) throw new Error("invalid-kml-tile-descriptor");\n      return tiles;');
save(file,s);
file='pages/map/utils/map-plugins.js'; s=read(file);
s=replace(s,'return !!previousSource && previousSource !== desiredSource && desiredSource === "uom4";', 'return !!previousSource && previousSource !== desiredSource && (desiredSource === "uom4" ||\n    (previousSource === "uom4" && ["uom", "uom5"].includes(desiredSource)));');
s=replace(s, '  clearInactiveUomGraphics(page);\n  return true;\n}\n\nfunction initUomPluginForSource', '  if (transition.fromSource !== "uom4") clearInactiveUomGraphics(page);\n  return true;\n}\n\nfunction initUomPluginForSource');
const a=s.indexOf('  const loading = detail?.uomLoading === true;', s.indexOf('function tryFinalizePendingUomTransition'));
const b=s.indexOf('  page._pendingUomPluginTransition = null;',a);
s=s.slice(0,a)+`  const ready = transition.toSource === "uom4"
    ? options.graphicsApplied === true && options.ready === true
    : detail.uomRenderReady === true;
  if (!ready) return false;
  console.info("[uom-handoff]", { from: transition.fromSource, to: transition.toSource,
    polygons: polygons.length, polylines: polylines.length });
`+s.slice(b);
save(file,s);
file='pages/map/utils/misc-actions.js';s=read(file);
const start=s.indexOf('  if (mapPluginsUtils.isPendingUomTransitionSource(page, source)) {',s.indexOf('function onUomGraphicsChange'));
const end=s.indexOf('  if (!isActiveUomEvent(page, event)) {',start);
s=s.slice(0,start)+`  if (mapPluginsUtils.isPendingUomTransitionSource(page, source)) {
    if (detail.ready !== true) return;
    const transition = page._pendingUomPluginTransition;
    const commit = page._uomGraphicsCommit = {};
    page._uomPolygons = nextPolygons;
    page._uomPolylines = nextPolylines;
    page.queueMapGraphicsSync({ overlay: true, polylines: true, onApplied: () => {
      if (page._pendingUomPluginTransition !== transition || page._uomGraphicsCommit !== commit ||
          page.data.uomDivisionEnabled === false || transition.toPlugin?._refreshSeq !== detail.revision) return;
      mapPluginsUtils.tryFinalizePendingUomTransition(page, source, {}, {
        polygons: nextPolygons, polylines: nextPolylines, ready: true, graphicsApplied: true
      });
    } });
    return;
  }
`+s.slice(end);
s=replace(s,'  if (shouldPreserveCurrentUomGraphics(page, nextPolygons, nextPolylines)) {','  if (detail.ready !== true && shouldPreserveCurrentUomGraphics(page, nextPolygons, nextPolylines)) {');
save(file,s);
// Coalesce the existing per-layer composition into one view-layer update.
file='pages/map/utils/map-graphics.js';s=read(file);
s=replace(s, '  page._pendingMapGraphicsSync = next;', '  if (typeof options.onApplied === "function") {\n    (next.callbacks || (next.callbacks = [])).push(options.onApplied);\n  }\n  page._pendingMapGraphicsSync = next;');
const sa=s.indexOf('    if (pending.markers) {'), sb=s.indexOf('\n  }, 0);',sa);
s=s.slice(0,sa)+`    const updates = {};
    if (pending.markers) syncAllMarkers(page, updates);
    if (pending.polylines) syncAllPolylines(page, updates);
    if (pending.overlay) updateOverlayGraphics(page, updates);
    const complete = () => (pending.callbacks || []).forEach(callback => callback());
    if (Object.keys(updates).length) page.setData(updates, complete);
    else complete();`+s.slice(sb);
s=replace(s,'function syncAllPolylines(page) {','function syncAllPolylines(page, updates = null) {');
s=replace(s,'function syncAllMarkers(page) {','function syncAllMarkers(page, updates = null) {');
s=replace(s,'function updateOverlayGraphics(page) {','function updateOverlayGraphics(page, updates = null) {');
for(const [before,after] of [
['  page.setData({ polylines });','  if (updates) updates.polylines = polylines;\n  else page.setData({ polylines });'],
['    page.setData({ markers });','    if (updates) updates.markers = markers;\n    else page.setData({ markers });'],
['  page.setData({ markers: combined });','  if (updates) updates.markers = combined;\n  else page.setData({ markers: combined });'],
['  page.setData({ polygons, circles });','  if (updates) Object.assign(updates, { polygons, circles });\n  else page.setData({ polygons, circles });']]) s=replace(s,before,after);
save(file,s);
file='pages/markers/location-picker/index.js';s=read(file);
s=replace(s,'  queueMapGraphicsSync() {\n    this.updateOverlayGraphics();','  queueMapGraphicsSync(options = {}) {\n    this.updateOverlayGraphics(options.onApplied);');
s=replace(s,'  updateOverlayGraphics() {','  updateOverlayGraphics(onApplied) {');
s=replace(s,'      circles\n    });\n  },\n\n  onUomStatusChange','      circles\n    }, typeof onApplied === "function" ? onApplied : undefined);\n  },\n\n  onUomStatusChange');save(file,s);
file='pages/markers/pin-picker/index.js';s=read(file);
s=replace(s,'  queueMapGraphicsSync() {\n    this.applyMapGraphics();','  queueMapGraphicsSync(options = {}) {\n    this.applyMapGraphics({ onApplied: options.onApplied });');
s=replace(s,'      markers: this.composeMapMarkers(this._shapeMarkers)\n    });','      markers: this.composeMapMarkers(this._shapeMarkers)\n    }, typeof options.onApplied === "function" ? options.onApplied : undefined);');save(file,s);
// Capture the exact pre-change files for a narrow rollback; never reset unrelated edits.
const backup=path.resolve('artifacts/map-layer-flow-before');
for(const [file,s] of pending) {
  const target=path.join(backup,file);fs.mkdirSync(path.dirname(target),{recursive:true});
  if(fs.existsSync(target)) throw Error(`Backup already exists: ${target}`);
}
for(const [file,s] of pending) {
  fs.copyFileSync(`${root}/${file}`,path.join(backup,file));
  fs.writeFileSync(`${root}/${file}`,s);
  console.log(file);
}
