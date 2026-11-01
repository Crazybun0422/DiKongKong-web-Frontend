const fs=require('fs');
const file='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/pages/map/utils/bootstrap.js';
let src=fs.readFileSync(file,'utf8');
const before='      page._skipNextApplyLayerInitialSync = true;\n      page.requestInitialLocation();';
const after='      page._skipNextApplyLayerInitialSync = true;\n      // A queued shape preview owns the initial viewport; GPS must not replace it.\n      if (!hasPendingPinPreview) page.requestInitialLocation();';
const normalized=src.replace(/\r\n/g,'\n');
if(!normalized.includes(before))throw Error('Initial location branch changed');
fs.writeFileSync(file,normalized.replace(before,after));
