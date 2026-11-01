const fs=require('fs'),path=require('path'),vm=require('vm');
const mini='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram',android='D:/Workspace/LowLatitudePlanet';
function edit(file,fn){const p=mini+'/'+file,s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');fs.writeFileSync(p,fn(s));}
function rep(s,a,b){if(!s.includes(a))throw Error(a);return s.replace(a,b);}
// Rebuild only avatar-related definitions and modules, retaining native map/runtime patches.
const compiler=android+'/scripts/sync-mini-parity.cjs',source=fs.readFileSync(compiler,'utf8');
const prefix=source.slice(0,source.indexOf('function addDefinition(route)'));
const modules=['utils/default-avatar.js','utils/profile.js','utils/profile-completion.js','utils/social-images.js','utils/social.js','utils/flight-meetups.js','utils/images.js','utils/planet-broadcast.js','packages/flight-meetups/online-people.js','packages/social/blacklist/index.js','packages/location-sharing/utils/sharing.js','pages/profile/profile-page.js','pages/profile/home/index.js','pages/profile/edit/index.js'];
const tail=`let bundle='/* Packaged gender-aware avatars and reset action. */\\n';
for(const file of ${JSON.stringify(modules)})bundle+='MiniSource.modules['+JSON.stringify(file)+']=function(require,module,exports,Page,Component,App,_t){\\n'+localize(read(file))+'\\n};\\n';
for(const route of ['pages/profile/profile','pages/profile/home/index','pages/profile/edit/index'])bundle+='MiniSource.definitions['+JSON.stringify(route)+']=Object.assign({},MiniSource.definitions['+JSON.stringify(route)+'],{template:'+template(route+'.wxml')+',css:'+JSON.stringify(css(route+'.wxss'))+'});\\n';
new(require('vm').Script)(bundle);fs.writeFileSync(path.join(out,'default-avatars.js'),bundle);
const zh=JSON.parse(fs.readFileSync(path.join(out,'zh.json'),'utf8'));fs.writeFileSync(path.join(out,'zh.json'),JSON.stringify({...zh,...messages}));`;
vm.runInNewContext(prefix+tail,{require,__dirname:path.dirname(compiler),process:{argv:[]},console},{filename:compiler});
console.log('Added persisted reset action and synced both clients.');
