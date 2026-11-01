const fs=require('fs');
for(const file of ['E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/packages/dji/components/temporary-no-fly-layer/index.js','D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity/nearby-request-fixes.js']){
  let s=fs.readFileSync(file,'utf8');
  const old='if (!force && prev.scope === scope && moveMeters < 50 && radiusDiff < 0.2 && scaleDiff < 1 && !isStale) {\n        this.emitStatusChange';
  if(!s.includes(old))throw Error(file);
  s=s.replace(old,old.replace('\n        this.emitStatusChange','\n        this._ready = true;\n        this._loadFailed = false;\n        this.emitStatusChange'));
  fs.writeFileSync(file,s);
}
