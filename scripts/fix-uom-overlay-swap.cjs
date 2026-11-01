const fs=require('fs');
const root='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/packages';
for(const pkg of ['uom','uom5']){
 const file=`${root}/${pkg}/components/uom-plugin/index.js`;
 let source=fs.readFileSync(file,'utf8');
 const start=source.indexOf('    applyWmsOverlays(tiles, options = {}) {'),end=source.indexOf('    tileSignature(tile)',start);
 if(start<0||end<0)throw Error(pkg);
 source=source.slice(0,start)+fs.readFileSync('scripts/uom-overlay-swap-method.txt','utf8')+'\n'+source.slice(end);
 source=source.replace('      if (!batch) return;\n      this._wmsPendingBatch = null;','      if (!batch) return;\n      if (batch.timeout) clearTimeout(batch.timeout);\n      this._wmsPendingBatch = null;');
 // Preserve existing line endings when matching lifecycle cleanup.
 source=source.replace('      if (!batch) return;\r\n      this._wmsPendingBatch = null;','      if (!batch) return;\r\n      if (batch.timeout) clearTimeout(batch.timeout);\r\n      this._wmsPendingBatch = null;');
 source=source.replace('    clearMapOverlays(options = {}) {','    clearMapOverlays(options = {}) {\n      if (this._wmsOverlayRetryTimer) clearTimeout(this._wmsOverlayRetryTimer);\n      this._wmsOverlayRetryTimer = null;\n      this._wmsOverlayRetryKey = "";\n      this._wmsOverlayRetryCount = 0;');
 fs.writeFileSync(file,source);
}
console.log('Fixed atomic overlay replacement and bounded idle recovery in uom/uom5.');
