const fs=require('fs');
const file='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram/packages/market/index/index.wxss';
let css=fs.readFileSync(file,'utf8');
const before='.catalog-page .search{margin-bottom:4px;gap:8px}.catalog-page .search input{min-height:36px;height:36px;font-size:13px;padding:8px 12px}.catalog-page .search button{padding:8px 12px;font-size:12px}';
const after='.catalog-page .search{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,1fr);margin-bottom:4px;gap:8px}.catalog-page .search input{width:100%;min-width:0;box-sizing:border-box;min-height:36px;height:36px;font-size:13px;padding:8px 12px}.catalog-page .search button{width:100%;min-width:0;box-sizing:border-box;height:36px;margin:0;padding:8px 0;font-size:12px}';
if(css.includes(before))fs.writeFileSync(file,css.replace(before,after));else if(!css.includes(after))throw Error('Search styles changed; inspect before editing.');
