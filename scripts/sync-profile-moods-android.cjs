const fs=require('fs'),path=require('path'),vm=require('vm');
const compiler='D:/Workspace/LowLatitudePlanet/scripts/sync-mini-parity.cjs';
const source=fs.readFileSync(compiler,'utf8');
// Template data is an object expression, not a top-level JavaScript block.
const prefix=source.slice(0,source.indexOf('function addDefinition(route)')).replace('localize(s)});}}`','localize("("+s+")")});}}`');
const tail=`
let bundle='/* Profile moods and visibility UI. Native location reporting stays unchanged. */\\n';
for(const file of ['utils/mood.js','pages/profile/home/index.js','packages/flight-meetups/online-people.js'])
 bundle+='MiniSource.modules['+JSON.stringify(file)+']=function(require,module,exports,Page,Component,App,_t){\\n'+localize(read(file))+'\\n};\\n';
for(const route of ['pages/profile/home/index','packages/flight-meetups/index/index','packages/flight-meetups/online/index'])
 bundle+='MiniSource.definitions['+JSON.stringify(route)+']=Object.assign({},MiniSource.definitions['+JSON.stringify(route)+'],{template:'+template(route+'.wxml')+',css:'+JSON.stringify(css(route+'.wxss'))+'});\\n';
new(require('vm').Script)(bundle);
fs.writeFileSync(path.join(out,'profile-moods.js'),bundle);
const zh=JSON.parse(fs.readFileSync(path.join(out,'zh.json'),'utf8'));fs.writeFileSync(path.join(out,'zh.json'),JSON.stringify({...zh,...messages}));
const entry=path.join(out,'index.html');let html=fs.readFileSync(entry,'utf8');
if(!html.includes('src="profile-moods.js"'))html=html.replace('<script src="runtime.js">','<script src="profile-moods.js"></script><script src="runtime.js">');
fs.writeFileSync(entry,html);
console.log('Synced scoped Android mood UI and templates.');`;
vm.runInNewContext(prefix+tail,{require,__dirname:path.dirname(compiler),process:{argv:[]},console},{filename:compiler});
