const fs=require('fs'),path=require('path'),vm=require('vm');
const project='D:/Workspace/LowLatitudePlanet',compiler=project+'/scripts/sync-mini-parity.cjs';
const source=fs.readFileSync(compiler,'utf8');
const prefix=source.slice(0,source.indexOf('function addDefinition(route)'));
const tail=`
let bundle='/* Scoped meetup online directory. */\\n';
for(const file of ['packages/flight-meetups/online-people.js','packages/flight-meetups/index/index.js','packages/flight-meetups/online/index.js']) {
 bundle+='MiniSource.modules['+JSON.stringify(file)+']=function(require,module,exports,Page,Component,App,_t){\\n'+localize(read(file))+'\\n};\\n';
}
for(const route of ['packages/flight-meetups/index/index','packages/flight-meetups/online/index']) {
 bundle+='MiniSource.definitions['+JSON.stringify(route)+']=Object.assign({},MiniSource.definitions['+JSON.stringify(route)+']||{components:{}},{config:'+read(route+'.json')+',template:'+template(route+'.wxml')+',css:'+JSON.stringify(css(route+'.wxss'))+'});\\n';
}
bundle+='if(!MiniSource.pages.includes("packages/flight-meetups/online/index"))MiniSource.pages.push("packages/flight-meetups/online/index");\\n';
new (require('vm').Script)(bundle);
fs.writeFileSync(path.join(out,'meetup-online.js'),bundle);
const zh=JSON.parse(fs.readFileSync(path.join(out,'zh.json'),'utf8'));
fs.writeFileSync(path.join(out,'zh.json'),JSON.stringify({...zh,...messages}));
const entry=path.join(out,'index.html');let html=fs.readFileSync(entry,'utf8');
if(!html.includes('src="meetup-online.js"'))html=html.replace('<script src="runtime.js">','<script src="meetup-online.js"></script><script src="runtime.js">');
fs.writeFileSync(entry,html);
fs.writeFileSync(path.join(out,'meetup-online-manifest.json'),JSON.stringify({files:manifest},null,2));
console.log('Synced Android meetup entry, online directory, styles and route.');
`;
vm.runInNewContext(prefix+tail,{require,__dirname:path.dirname(compiler),process:{argv:[]},console},{filename:compiler});
