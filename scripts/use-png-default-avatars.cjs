const fs=require('fs'),path=require('path');
const mini='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const android='D:/Workspace/LowLatitudePlanet';
const assets=android+'/app/src/main/assets/mini-parity';
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
for(const root of [mini,assets]){
 for(const sex of ['male','female'])fs.copyFileSync('artifacts/default-avatars/pilot-avatar-'+sex+'.png',root+'/assets/pilot-avatar-'+sex+'.png');
 // Compatibility alias for accounts and cached data using the original default path.
 fs.copyFileSync(root+'/assets/pilot-avatar-male.png',root+'/assets/default-avatar.png');
 for(const f of walk(root).filter(f=>/\.(js|wxml|json)$/.test(f))){
  const s=fs.readFileSync(f,'utf8'),next=s.replaceAll('pilot-avatar-male.webp','pilot-avatar-male.png').replaceAll('pilot-avatar-female.webp','pilot-avatar-female.png');
  if(s!==next)fs.writeFileSync(f,next);
 }
}
// Migrate both previously stored WebP paths and legacy default paths to packaged PNGs.
const helper=mini+'/utils/default-avatar.js';
fs.writeFileSync(helper,fs.readFileSync(helper,'utf8').replace('(?:male|female)\\.webp','(?:male|female)\\.(?:png|webp)').replace('pilot-avatar-female\\.webp','pilot-avatar-female\\.(?:png|webp)'));
const configFile=path.dirname(mini)+'/project.config.json',config=JSON.parse(fs.readFileSync(configFile,'utf8'));
config.packOptions??={};config.packOptions.include??=[];
for(const name of ['pilot-avatar-male.png','pilot-avatar-female.png','default-avatar.png']){
 const value='assets/'+name;
 if(!config.packOptions.include.some(p=>p.type==='file'&&p.value===value))config.packOptions.include.push({type:'file',value});
}
fs.writeFileSync(configFile,JSON.stringify(config,null,2)+'\n');
const native=android+'/app/src/main/java/cn/llplanet/lowlatitudeplanet/map/NativeLocationIcons.kt';
let s=fs.readFileSync(native,'utf8').replaceAll('pilot-avatar-male.webp','pilot-avatar-male.png').replaceAll('pilot-avatar-female.webp','pilot-avatar-female.png');
s=s.replace('source=="default-avatar.png" || source=="/assets/default-avatar.png"->read(DEFAULT_AVATAR)',`source=="default-avatar.png" || source=="/assets/default-avatar.png" || source=="pilot-avatar-male.webp" || source=="/assets/pilot-avatar-male.webp"->read(DEFAULT_AVATAR)
        source=="pilot-avatar-female.webp" || source=="/assets/pilot-avatar-female.webp"->read("/assets/pilot-avatar-female.png")`);
s=s.replace('listOf("default-avatar.png","pilot-avatar-male.png","pilot-avatar-female.png")','listOf("default-avatar.png","pilot-avatar-male.png","pilot-avatar-female.png","pilot-avatar-male.webp","pilot-avatar-female.webp")').replace('filename=="pilot-avatar-female.png"','filename in listOf("pilot-avatar-female.png","pilot-avatar-female.webp")');
fs.writeFileSync(native,s);
require('./sync-default-avatars.cjs');
console.log('PNG defaults installed in both clients; original default-avatar.png retained as male alias.');
