const fs=require('fs');
const file='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/packages/market/orders/index.wxss';
const rule='.actions .cancel-order + .primary{flex:1;min-width:0;max-width:220px;box-sizing:border-box;margin:0;white-space:nowrap}';
let css=fs.readFileSync(file,'utf8');if(!css.includes(rule))fs.writeFileSync(file,css+'\n'+rule+'\n');
