const fs=require('fs');
const root='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
function edit(file,fn){const p=root+'/'+file;fs.writeFileSync(p,fn(fs.readFileSync(p,'utf8').replaceAll('\r\n','\n')));}
function replace(s,a,b){if(!s.includes(a))throw Error(a);return s.replace(a,b);}
edit('pages/map/utils/map-viewport.js',s=>replace(s,`    page._uomTileMarkers = [];
    page._uomPolygons = [];
    page._uomPolylines = [];
    page.queueMapGraphicsSync({ markers: true, overlay: true, polylines: true });`,`    // Keep the displayed geometry until the refreshed viewport is ready.
    // GPS recentering alone must not erase a valid layer while KML is loading.`));
edit('pages/map/utils/map-plugins.js',s=>replace(s,'? tone !== "neutral"','? tone !== "neutral" && tone !== "warn"'));
edit('packages/uom4/components/uom-plugin/index.js',s=>replace(s,`      const rawTiles = res?.data?.data?.tiles || res?.data?.tiles || [];
      return (Array.isArray(rawTiles) ? rawTiles : [])`,`      const rawTiles = res?.data?.data?.tiles ?? res?.data?.tiles;
      if (res?.data?.success === false || !Array.isArray(rawTiles)) {
        throw new Error("invalid-kml-tile-query-response");
      }
      return rawTiles`));
for(const pkg of ['uom','uom5'])edit(`packages/${pkg}/components/uom-plugin/index.js`,s=>{
 s=replace(s,'        if (finished || !active()) return;',`        if (finished || this._wmsPendingBatch !== batch) return;
        if (!active()) {
          finished = true;
          clearTimeout(batch.timeout);
          this.cancelPendingWmsBatch();
          if (!this._destroyed && this.data.uomDivisionEnabled !== false) this.refreshWmsOverlay();
          return;
        }`);
 return replace(s,'              if (success) { this.queueWmsOverlayRemoval(overlayId); this.processWmsOverlayRemovalQueue(); }\n              return;','              if (success) { this.queueWmsOverlayRemoval(overlayId); this.processWmsOverlayRemovalQueue(); }\n              if (this._wmsPendingBatch === batch) finish();\n              return;');
});
console.log('Protected GPS recenter, failed KML handover and invalid query responses.');
