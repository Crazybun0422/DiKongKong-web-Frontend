const fs=require('fs'),path=require('path'),vm=require('vm');
const project='D:/Workspace/LowLatitudePlanet';
const compiler=project+'/scripts/sync-mini-parity.cjs';
const original=fs.readFileSync(compiler,'utf8');
// Reuse the established compiler for checkout/orders and catalog search styles only.
const prefix=original.slice(0,original.indexOf('function addDefinition(route)'));
const tail=`
let bundle='/* Scoped market variant images and compact cancellation UI. */\\n';
for(const file of ['packages/market/api.js','packages/market/detail/index.js']) {
 const code=localize(read(file));
 bundle+='MiniSource.modules['+JSON.stringify(file)+']=function(require,module,exports,Page,Component,App,_t){\\n'+code+'\\n};\\n';
}
for(const route of ['packages/market/detail/index','packages/market/orders/index','packages/market/index/index']) {
 bundle+='MiniSource.definitions['+JSON.stringify(route)+'].template='+template(route+'.wxml')+';\\n';
 bundle+='MiniSource.definitions['+JSON.stringify(route)+'].css='+JSON.stringify(css(route+'.wxss'))+';\\n';
}
bundle+='MiniSource.definitions["packages/market/index/index"].css='+JSON.stringify(css('packages/market/index/index.wxss'))+';\\n';
new (require('vm').Script)(bundle);
fs.writeFileSync(path.join(out,'market-variant-fixes.js'),bundle);
const zh=JSON.parse(fs.readFileSync(path.join(out,'zh.json'),'utf8'));
fs.writeFileSync(path.join(out,'zh.json'),JSON.stringify({...zh,...messages}));
const entry=path.join(out,'index.html');let html=fs.readFileSync(entry,'utf8');
if(!html.includes('src="market-variant-fixes.js"'))html=html.replace('<script src="runtime.js">','<script src="market-variant-fixes.js"></script><script src="runtime.js">');
fs.writeFileSync(entry,html);
fs.writeFileSync(path.join(out,'market-variant-manifest.json'),JSON.stringify({files:manifest},null,2));
console.log('Synced market API, checkout, order list and catalog styles; unrelated Android pages preserved.');
`;
vm.runInNewContext(prefix+tail,{require,__dirname:path.dirname(compiler),process:{argv:[]},console},{filename:compiler});
// Share only this feature bundle; preserve platform-owned routes and bridges.
const android=path.join(project,'app/src/main/assets/mini-parity');
const harmony='D:/Workspace/LowLatitudePlanetHarmony/entry/src/main/resources/rawfile/mini-parity';
for(const file of ['market-variant-fixes.js','market-variant-manifest.json'])fs.copyFileSync(path.join(android,file),path.join(harmony,file));
const zh=JSON.parse(fs.readFileSync(path.join(android,'zh.json'),'utf8'));
const harmonyZh=JSON.parse(fs.readFileSync(path.join(harmony,'zh.json'),'utf8'));
// IDs are hashes of the original text; retain Harmony-only IDs.
fs.writeFileSync(path.join(harmony,'zh.json'),JSON.stringify({...harmonyZh,...zh}));
for(const assets of [android,harmony]){
 const file=path.join(assets,'index.html');let html=fs.readFileSync(file,'utf8');
 html=html.replace(/<script src="market-variant-fixes.js"><\/script>/g,'');
 html=html.replace('<script src="runtime.js">','<script src="market-variant-fixes.js"></script><script src="runtime.js">');
 fs.writeFileSync(file,html);
}
