const fs=require('fs'),path=require('path'),vm=require('vm');
const compiler='D:/Workspace/LowLatitudePlanet/scripts/sync-mini-parity.cjs';
const source=fs.readFileSync(compiler,'utf8');
const prefix=source.slice(0,source.indexOf('function addDefinition(route)')).replace('localize(s)});}}`','localize("("+s+")")});}}`');
const tail=`let bundle='/* Star encounters entry and historical nearby people. */\\n';
for(const file of ['packages/flight-meetups/index/index.js','packages/flight-meetups/encounters/api.js','packages/flight-meetups/encounters/index.js'])
 bundle+='MiniSource.modules['+JSON.stringify(file)+']=function(require,module,exports,Page,Component,App,_t){\\n'+localize(read(file))+'\\n};\\n';
for(const route of ['packages/flight-meetups/index/index','packages/flight-meetups/encounters/index','packages/flight-meetups/online/index'])
 bundle+='MiniSource.definitions['+JSON.stringify(route)+']=Object.assign({},MiniSource.definitions['+JSON.stringify(route)+']||{components:{}},{config:'+read(route+'.json')+',template:'+template(route+'.wxml')+',css:'+JSON.stringify(css(route+'.wxss'))+'});\\n';
bundle+='if(!MiniSource.pages.includes("packages/flight-meetups/encounters/index"))MiniSource.pages.push("packages/flight-meetups/encounters/index");\\n';
new(require('vm').Script)(bundle);fs.writeFileSync(path.join(out,'encounters.js'),bundle);
const zh=JSON.parse(fs.readFileSync(path.join(out,'zh.json'),'utf8'));fs.writeFileSync(path.join(out,'zh.json'),JSON.stringify({...zh,...messages}));
const entry=path.join(out,'index.html');let html=fs.readFileSync(entry,'utf8');if(!html.includes('src="encounters.js"'))html=html.replace('<script src="runtime.js">','<script src="encounters.js"></script><script src="runtime.js">');fs.writeFileSync(entry,html);
console.log('Synced Android encounters entry and page.');`;
vm.runInNewContext(prefix+tail,{require,__dirname:path.dirname(compiler),process:{argv:[]},console},{filename:compiler});
