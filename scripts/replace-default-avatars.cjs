const fs=require('fs'),path=require('path'),vm=require('vm');
const mini='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const android='D:/Workspace/LowLatitudePlanet';
const assets=android+'/app/src/main/assets/mini-parity';
const backend='E:/source_code/wechat/DiKongKong-Backend/src/main/java/com/example/dikongkongbackend';
const changed=new Set();
function edit(root,file,fn){const p=path.join(root,file),before=fs.readFileSync(p,'utf8'),after=fn(before);if(after!==before){fs.writeFileSync(p,after);if(root===mini)changed.add(file.replaceAll('\\','/'));}}
function replace(s,a,b){if(!s.includes(a))throw Error('Missing expected text: '+a);return s.replace(a,b);}
function walk(root){return fs.readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(root,e.name)):[path.join(root,e.name)]);}
// Both assets live in the main package, accessible from every subpackage offline.
for(const root of [mini,assets])for(const gender of ['male','female'])fs.copyFileSync(path.resolve('artifacts/default-avatars/pilot-avatar-'+gender+'.webp'),root+'/assets/pilot-avatar-'+gender+'.webp');
for(const f of walk(mini).filter(f=>/\.(js|wxml|wxss|json)$/.test(f)))edit(mini,path.relative(mini,f),s=>s.replaceAll('/assets/default-avatar.png','/assets/pilot-avatar-male.webp'));
const helper=`const MALE = '/assets/pilot-avatar-male.webp';
const FEMALE = '/assets/pilot-avatar-female.webp';
function defaultAvatar(gender) {
  return ['female', '女', '女生', '2'].includes(String(gender || '').trim().toLowerCase()) ? FEMALE : MALE;
}
function isDefaultAvatar(value) {
  return !value || /(?:^|[/=])(?:default-avatar\\.png|pilot-avatar-(?:male|female)\\.webp)(?:[?#&]|$)/i.test(String(value));
}
function resolveAvatar(value, gender) {
  if (!isDefaultAvatar(value)) return value;
  // Preserve an explicitly selected packaged female avatar when no gender was supplied.
  if (!gender && /pilot-avatar-female\\.webp(?:[?#&]|$)/i.test(String(value))) return FEMALE;
  return defaultAvatar(gender);
}
module.exports = { MALE, FEMALE, defaultAvatar, isDefaultAvatar, resolveAvatar };
`;
fs.writeFileSync(mini+'/utils/default-avatar.js',helper);changed.add('utils/default-avatar.js');
edit(mini,'utils/profile.js',s=>{
 s="const { defaultAvatar, isDefaultAvatar, resolveAvatar } = require('./default-avatar');\n"+s;
 s=replace(s,'if (!value) return DEFAULT_AVATAR_PATH;', 'if (isDefaultAvatar(value)) return resolveAvatar(value, options.gender);');
 s=replace(s,'const source = src || DEFAULT_AVATAR_PATH;', 'const source = resolveAvatar(src);');
 s=replace(s,'let displayAvatar = DEFAULT_AVATAR_PATH;', 'const gender = raw.gender || raw.pilotGender || nestedProfile.gender || nestedProfile.pilotGender || stored.gender || stored.pilotGender || "unknown";\n  let displayAvatar = defaultAvatar(gender);');
 s=replace(s,'if (/^\\/?assets\\//.test(normalizedAvatarCandidate)) {','if (isDefaultAvatar(avatarFileName)) {\n    displayAvatar = resolveAvatar(avatarFileName, gender);\n  } else if (/^\\/?assets\\//.test(normalizedAvatarCandidate)) {');
 s=replace(s,'avatarUrl: displayAvatar,','avatarUrl: displayAvatar,\n    gender,');
 return s;
});
edit(mini,'utils/profile-completion.js',s=>replace("const { isDefaultAvatar } = require('./default-avatar');\n"+s, 'const defaultAvatar = !avatar || avatar === DEFAULT_AVATAR_PATH\n    || /(?:^|[/=])default-avatar\\.png(?:[?#&]|$)/i.test(avatar);','const defaultAvatar = isDefaultAvatar(avatar);'));
edit(mini,'utils/social-images.js',s=>{
 s="const { defaultAvatar, isDefaultAvatar, resolveAvatar } = require('./default-avatar');\n"+s;
 s=replace(s,'const url = buildFileUrl(value);','const url = buildFileUrl(value ? resolveAvatar(value) : value);');
 s=replace(s,'function originalUrl(value) { return buildFileUrl(value); }','function originalUrl(value) { return buildFileUrl(value ? resolveAvatar(value) : value); }\nfunction avatarUrl(value, gender) { return imageUrl(resolveAvatar(value, gender)); }');
 s=replace(s,'  const fallback = () => {','  const ownerPath = path.replace(/\\.[^.]+$/, "");\n  const owner = ownerPath === path ? this.data : read(this.data, ownerPath);\n  const fallbackAvatar = defaultAvatar(event.currentTarget.dataset.gender || owner?.gender || owner?.pilotGender);\n  const fallback = () => {');
 s=replace(s,"avatar ? '/assets/pilot-avatar-male.webp' : ''","avatar ? fallbackAvatar : ''");
 s=replace(s,"if (source !== '/assets/pilot-avatar-male.webp') fallback();","if (!isDefaultAvatar(source)) fallback();");
 return replace(s,'module.exports = { imageUrl,','module.exports = { avatarUrl, imageUrl,');
});
edit(mini,'utils/social.js',s=>replace(replace(s,"function avatar(value) { return value ? imageUrl(value) : '/assets/pilot-avatar-male.webp'; }","function avatar(value, gender) { return require('./social-images').avatarUrl(value, gender); }"),'avatar(profile.avatarUrl)','avatar(profile.avatarUrl, gender)'));
edit(mini,'packages/flight-meetups/online-people.js',s=>replace(s,"images.imageUrl(person.avatarUrl||'/assets/pilot-avatar-male.webp')","images.avatarUrl(person.avatarUrl, person.gender)"));
edit(mini,'utils/flight-meetups.js',s=>replace(s,"imageUrl(p?.avatarUrl||'/assets/pilot-avatar-male.webp')","require('./social-images').avatarUrl(p?.avatarUrl, p?.gender)"));
edit(mini,'packages/social/blacklist/index.js',s=>replace(s,"images.thumbnailUrl(raw.avatarUrl,128) || '/assets/pilot-avatar-male.webp'","images.thumbnailUrl(images.avatarUrl(raw.avatarUrl, raw.gender),128)"));
edit(mini,'packages/location-sharing/utils/sharing.js',s=>{
 s="const { defaultAvatar, resolveAvatar } = require('../../../utils/default-avatar');\n"+s;
 s=replace(s,'let avatar = item.avatarUrl || DEFAULT_AVATAR;', 'let avatar = resolveAvatar(item.avatarUrl, item.gender);');
 s=replace(s,'if (avatar !== DEFAULT_AVATAR && !/^https?:\\/\\//.test(avatar))','if (!avatar.startsWith("/assets/") && !/^https?:\\/\\//.test(avatar))');
 return replace(s,'avatar: DEFAULT_AVATAR,','avatar: defaultAvatar(item.gender),');
});
edit(backend,'service/FlightMeetupOnlineService.java',s=>{
 s=replace(s,'import com.example.dikongkongbackend.entity.User;', 'import com.example.dikongkongbackend.entity.User;\nimport com.example.dikongkongbackend.entity.UserProfileKv;');
 s=replace(s,'String avatarUrl, boolean member','String avatarUrl, String gender, boolean member');
 s=replace(s,'signatures=new HashMap<>(),models=new HashMap<>();','signatures=new HashMap<>(),models=new HashMap<>(),genders=new HashMap<>();');
 s=replace(s,'if(!selectedCodes.isEmpty()) {','if(!selectedCodes.isEmpty()) {\n            mongo.find(Query.query(Criteria.where("featureCode").in(selectedCodes).and("key").is("pilotGender")),UserProfileKv.class)\n                    .forEach(p -> genders.put(p.getFeatureCode(),Objects.toString(p.getValue(),"unknown")));');
 return replace(s,'new Person(u.getFeatureCode(),u.getAvatarUrl(),','new Person(u.getFeatureCode(),u.getAvatarUrl(),genders.getOrDefault(u.getFeatureCode(),"unknown"),');
});
edit(android,'app/src/main/java/cn/llplanet/lowlatitudeplanet/map/NativeLocationIcons.kt',s=>{
 s=replace(s,'source=="default-avatar.png"->read(DEFAULT_AVATAR)','source=="default-avatar.png" || source=="/assets/default-avatar.png"->read(DEFAULT_AVATAR)');
 s=replace(s,'const val DEFAULT_AVATAR="/assets/default-avatar.png"','const val DEFAULT_AVATAR="/assets/pilot-avatar-male.webp"');
 return replace(s,'val chosen=(values.firstOrNull()?:DEFAULT_AVATAR).removePrefix("./")',`val gender=listOf(profile,nested).filterNotNull().flatMap {row->listOf("gender","pilotGender").map {row.optString(it)}}.firstOrNull {it.isNotBlank() && it!="unknown"}.orEmpty().lowercase()
            val fallback=if(gender in listOf("female","女","女生","2")) "/assets/pilot-avatar-female.webp" else DEFAULT_AVATAR
            val candidate=values.firstOrNull().orEmpty()
            val filename=candidate.substringBefore('?').substringBefore('#').substringAfterLast('/')
            val chosen=(if(candidate.isBlank() || filename in listOf("default-avatar.png","pilot-avatar-male.webp","pilot-avatar-female.webp")) {
                if(gender.isBlank() && filename=="pilot-avatar-female.webp") "/assets/pilot-avatar-female.webp" else fallback
            } else candidate).removePrefix("./")`);
});
// Preserve every Android-specific override; replace only old asset literals in compiled bundles.
for(const f of walk(assets).filter(f=>/\.(js|json|html)$/.test(f)))edit(assets,path.relative(assets,f),s=>s.replaceAll('/assets/default-avatar.png','/assets/pilot-avatar-male.webp'));
fs.writeFileSync('artifacts/default-avatars/changed.json',JSON.stringify([...changed],null,2));
// Regenerate only the changed utility modules; page modules keep their Android adaptations.
const compiler=android+'/scripts/sync-mini-parity.cjs',source=fs.readFileSync(compiler,'utf8');
const prefix=source.slice(0,source.indexOf('function addDefinition(route)'));
const modules=['utils/default-avatar.js','utils/profile.js','utils/profile-completion.js','utils/social-images.js','utils/social.js','utils/flight-meetups.js','packages/flight-meetups/online-people.js','packages/social/blacklist/index.js','packages/location-sharing/utils/sharing.js'];
const tail=`let bundle='/* Packaged gender-aware default avatars. */\\n';
for(const file of ${JSON.stringify(modules)})bundle+='MiniSource.modules['+JSON.stringify(file)+']=function(require,module,exports,Page,Component,App,_t){\\n'+localize(read(file))+'\\n};\\n';
new(require('vm').Script)(bundle);fs.writeFileSync(path.join(out,'default-avatars.js'),bundle);
const zh=JSON.parse(fs.readFileSync(path.join(out,'zh.json'),'utf8'));fs.writeFileSync(path.join(out,'zh.json'),JSON.stringify({...zh,...messages}));`;
vm.runInNewContext(prefix+tail,{require,__dirname:path.dirname(compiler),process:{argv:[]},console},{filename:compiler});
edit(assets,'index.html',s=>s.includes('src="default-avatars.js"')?s:s.replace('<script src="runtime.js">','<script src="default-avatars.js"></script><script src="runtime.js">'));
// Exact, verified file targets only: the user's obsolete default avatar assets.
for(const root of [mini,assets]){const old=path.resolve(root,'assets/default-avatar.png');if(!old.startsWith(path.resolve(root)+path.sep))throw Error('Invalid deletion target');if(fs.existsSync(old))fs.unlinkSync(old);}
console.log('Replaced default avatars in both clients; gender-aware utilities and online API updated.');
