const fs=require('node:fs');
const root='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const edits=[];
function rep(s,a,b){if(!s.includes(a))throw Error('Missing '+a.slice(0,100));return s.replace(a,b);}
for(const pkg of ['uom','uom5']){
 const file=`packages/${pkg}/components/uom-plugin/index.js`;let s=fs.readFileSync(`${root}/${file}`,'utf8');
 s=rep(s,'this._wmsPendingBatch.overlayKey !== overlayKey) {','this._wmsPendingBatch.overlayKey !== overlayKey && overlayKey === this._currentWmsTileKeyApplied) {');
 const batch='      const batch = { id: `${Date.now()}-${this._wmsBatchSeq++}`, overlayKey, epoch, createdHandles: new Map(), requestedSrcs: new Set(), timeout: null };';
 s=rep(s,batch+'\n','');
 s=rep(s,'      this.processWmsOverlayRemovalQueue();\n      this.cancelPendingWmsBatch();\n      if (this._wmsOverlayRetryKey',batch+`
      // Reserve shared downloads before releasing the previous viewport's consumers.
      for (const tile of tiles || []) {
        if (!tile?.id || !tile.bounds || !tile.src) continue;
        const entry = this._wmsTileResourceCache?.get(tile.src);
        if (entry?.status !== "pending") continue;
        if (!entry.consumers) entry.consumers = new Set();
        entry.consumers.add(batch.id);
        batch.requestedSrcs.add(tile.src);
      }
      this.processWmsOverlayRemovalQueue();
      this.cancelPendingWmsBatch();
      if (this._wmsOverlayRetryKey`);
 s=rep(s,'      this._wmsOverlayRemovals.add(overlayId);','      this.recordOverlayEvent("remove-request", { id: overlayId });\n      this._wmsOverlayRemovals.add(overlayId);');
 s=rep(s,'        success: () => {\n          if (this._wmsOverlayRemovals)', '        success: () => {\n          this.recordOverlayEvent("remove-success", { id: overlayId });\n          if (this._wmsOverlayRemovals)');
 s=rep(s,'          console.warn("removeGroundOverlay failed", overlayId, err);','          this.recordOverlayEvent("native-remove-failed", { id: overlayId, error: err?.errMsg || "unknown" });\n          console.warn("removeGroundOverlay failed", overlayId, err);');
 if(pkg==='uom5'){
  // Remaining explicit branches in the original WMS source.
  const i=s.indexOf('    refreshWmsOverlay(');let head=s.slice(0,i),tail=s.slice(i);
  tail=rep(tail,'this.clearMapOverlays();','this.clearMapOverlays({ reason: "excluded-region" });');
  tail=rep(tail,'this.clearMapOverlays();','this.clearMapOverlays({ reason: "unsupported-scale" });');s=head+tail;
 }
 edits.push([file,s]);
}
let file='pages/map/utils/map-graphics.js',s=fs.readFileSync(`${root}/${file}`,'utf8');
s=rep(s,'  if (page._mapGraphicsSyncTimer) return;','  if (page._mapGraphicsSyncTimer || page._mapGraphicsSyncApplying) return;');
s=rep(s,'    if (Object.keys(updates).length) page.setData(updates, complete);\n    else complete();',`    if (Object.keys(updates).length) {
      const trace = page._mapGraphicsTrace || (page._mapGraphicsTrace = []);
      trace.push({ at: Date.now(), source: page._activeUomPluginSource,
        uom: page._uomPolygons?.length || 0, dji: page._djiPolygons?.length || 0,
        temporary: page._nfzPolygons?.length || 0, pins: page._nearbyPinPolygons?.length || 0,
        fields: Object.keys(updates) });
      if (trace.length > 40) trace.shift();
      page._mapGraphicsSyncApplying = true;
      page.setData(updates, () => {
        page._mapGraphicsSyncApplying = false;
        complete();
        if (page._pendingMapGraphicsSync) queueMapGraphicsSync(page);
      });
    } else complete();`);
edits.push([file,s]);
for(const [f,s]of edits)fs.writeFileSync(`${root}/${f}`,s);
