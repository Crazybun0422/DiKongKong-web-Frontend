const fs=require('fs'),path=require('path'),vm=require('vm');
const compiler='D:/Workspace/LowLatitudePlanet/scripts/sync-mini-parity.cjs';
const original=fs.readFileSync(compiler,'utf8');
const prefix=original.slice(0,original.indexOf('function addDefinition(route)'));
const tail=`
let bundle='/* Shared market visibility settings and entry points. */\\n';
for(const file of ['utils/market-settings.js','pages/discover/index.js','pages/profile/flp/index.js','components/social-unread-dot/index.js','packages/market/index/index.js','packages/market/detail/index.js']) {
 bundle+='MiniSource.modules['+JSON.stringify(file)+']=function(require,module,exports,Page,Component,App,_t){\\n'+localize(read(file))+'\\n};\\n';
}
for(const route of ['pages/discover/index','packages/market/index/index','packages/market/detail/index']) {
 bundle+='MiniSource.definitions['+JSON.stringify(route)+'].template='+template(route+'.wxml')+';\\n';
}
new (require('vm').Script)(bundle);
fs.writeFileSync(path.join(out,'market-settings.js'),bundle);
const zh=JSON.parse(fs.readFileSync(path.join(out,'zh.json'),'utf8'));
fs.writeFileSync(path.join(out,'zh.json'),JSON.stringify({...zh,...messages}));
const entry=path.join(out,'index.html');let html=fs.readFileSync(entry,'utf8');
if(!html.includes('src="market-settings.js"'))html=html.replace('<script src="runtime.js">','<script src="market-settings.js"></script><script src="runtime.js">');
fs.writeFileSync(entry,html);
fs.writeFileSync(path.join(out,'market-settings-manifest.json'),JSON.stringify({files:manifest},null,2));
console.log('Synced market settings, discovery/FLP entries, catalog and product page to Android.');
`;
vm.runInNewContext(prefix+tail,{require,__dirname:path.dirname(compiler),process:{argv:[]},console},{filename:compiler});
