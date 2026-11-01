const fs=require('fs'),path=require('path'),vm=require('vm');
const compiler='D:/Workspace/LowLatitudePlanet/scripts/sync-mini-parity.cjs';
const original=fs.readFileSync(compiler,'utf8');
const prefix=original.slice(0,original.indexOf('function addDefinition(route)'));
const tail=`
const route='pages/profile/flp/global/index';
let bundle='/* Global FLP log participation links, shared with the mini-program. */\\n';
for(const file of ['utils/flp-reward-actions.js',route+'.js']) {
 bundle+='MiniSource.modules['+JSON.stringify(file)+']=function(require,module,exports,Page,Component,App,_t){\\n'+localize(read(file))+'\\n};\\n';
}
bundle+='MiniSource.definitions['+JSON.stringify(route)+'].template='+template(route+'.wxml')+';\\n';
bundle+='MiniSource.definitions['+JSON.stringify(route)+'].css='+JSON.stringify(css(route+'.wxss'))+';\\n';
new (require('vm').Script)(bundle);
fs.writeFileSync(path.join(out,'flp-reward-actions.js'),bundle);
const zh=JSON.parse(fs.readFileSync(path.join(out,'zh.json'),'utf8'));
fs.writeFileSync(path.join(out,'zh.json'),JSON.stringify({...zh,...messages}));
const entry=path.join(out,'index.html');let html=fs.readFileSync(entry,'utf8');
if(!html.includes('src="flp-reward-actions.js"'))html=html.replace('<script src="runtime.js">','<script src="flp-reward-actions.js"></script><script src="runtime.js">');
fs.writeFileSync(entry,html);
fs.writeFileSync(path.join(out,'flp-reward-actions-manifest.json'),JSON.stringify({files:manifest},null,2));
console.log('Synced FLP participation mapping, global log page and compact links to Android.');
`;
vm.runInNewContext(prefix+tail,{require,__dirname:path.dirname(compiler),process:{argv:[]},console},{filename:compiler});
