const fs=require('fs'),path=require('path');
const mini='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const source=fs.readFileSync(path.join(mini,'packages/planet-broadcast/placeholder/index.wxss'),'utf8');
const rule=source.match(/\.pinned-text text\s*\{[^}]*\}/);
if(!rule)throw Error('Pinned single-line rule is missing');
const script='/* Pinned previews must override the runtime text pre-wrap rule. */\nMiniSource.definitions["packages/planet-broadcast/placeholder/index"].css += '+JSON.stringify('\n'+rule[0])+';\n';
for(const root of ['D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity','D:/Workspace/LowLatitudePlanetHarmony/entry/src/main/resources/rawfile/mini-parity']){
 fs.writeFileSync(path.join(root,'broadcast-pinned-layout.js'),script);
 const entry=path.join(root,'index.html');let html=fs.readFileSync(entry,'utf8');
 if(!html.includes('src="broadcast-pinned-layout.js"'))html=html.replace('<script src="runtime.js">','<script src="broadcast-pinned-layout.js"></script><script src="runtime.js">');
 fs.writeFileSync(entry,html);
}
console.log('Synced scoped pinned broadcast layout to Android and Harmony');
