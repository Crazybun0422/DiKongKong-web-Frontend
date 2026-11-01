const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const mini='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const defaults=require(mini+'/utils/default-avatar');
const app={globalData:{}},cache={};global.getApp=()=>app;
global.wx={getStorageSync:k=>cache[k],setStorageSync:(k,v)=>cache[k]=v};
const profile=require(mini+'/utils/profile');
for(const gender of ['male','female','unknown'])for(const old of ['', '/assets/default-avatar.png','https://example.com/api/files/download/default-avatar.png']) {
 const result=profile.normalizeProfileData({avatarUrl:old,gender,featureCode:'ABCDEF'},{persistIdentity:false});
 assert.equal(result.avatarUrl,defaults.defaultAvatar(gender));
}
assert.equal(defaults.resolveAvatar(defaults.FEMALE,'unknown'),defaults.FEMALE);
assert.equal(defaults.resolveAvatar('custom.webp','female'),'custom.webp');
assert.equal(profile.buildAvatarDownloadUrl('/assets/default-avatar.png'),defaults.MALE);
assert.equal(profile.buildAvatarDownloadUrl(defaults.FEMALE),defaults.FEMALE);
profile.persistProfileLocally({nickname:'测试',featureCode:'ABCDEF',avatarUrl:defaults.FEMALE,gender:'female',vip:true});
assert.equal(profile.loadStoredProfile().avatarUrl,defaults.FEMALE);
assert.equal(profile.loadStoredProfile().gender,'female');assert.equal(profile.loadStoredProfile().vip,true);
app.globalData={};cache.userProfile={nickname:'已有昵称',featureCode:'ABCDEF',avatarUrl:'custom.webp'};
assert.equal(profile.loadStoredProfile().avatarUrl,'custom.webp');
const images=require(mini+'/utils/social-images');
assert.equal(images.avatarUrl('/assets/default-avatar.png','female'),defaults.FEMALE);
assert.equal(images.imageUrl(''), '');
const owner={data:{items:[{gender:'female',avatarUrl:'wxfile://broken'}]},setData(update){this.update=update;}};
images.onImageError.call(owner,{currentTarget:{dataset:{imagePath:'items[0].avatarUrl',source:'wxfile://broken',avatar:true}}});
assert.equal(owner.update['items[0].avatarUrl'],defaults.FEMALE);
for(const root of [mini,'D:/Workspace/LowLatitudePlanet/app/src/main/assets/mini-parity']){
 assert.deepEqual(fs.readFileSync(root+'/assets/default-avatar.png'),fs.readFileSync(root+'/assets/pilot-avatar-male.png'));
 for(const gender of ['male','female'])assert.deepEqual(fs.readFileSync(root+'/assets/pilot-avatar-'+gender+'.png'),fs.readFileSync('artifacts/default-avatars/pilot-avatar-'+gender+'.png'));
}
// Exercise the real reset handler with success, duplicate clicks and rejected persistence.
const source=fs.readFileSync(mini+'/pages/profile/profile-page.js','utf8');
const handler=source.slice(source.indexOf('  async onResetDefaultAvatar() {'),source.indexOf('  onChooseAvatar(e) {'));
let fail=false,calls=0,saved;
const page=vm.runInNewContext('({'+handler+'})',{require:()=>defaults,resolveApiBase:()=>'',updateUserProfile:async body=>{calls++;saved=body;if(fail)throw Error('offline');return body;},clearCyberPilotCharacterIdFromMapLayer:async()=>{},wx:{showToast(){}}});
page.data={gender:'female',profile:{vip:true}};page.setData=x=>Object.assign(page.data,x);page.handleProfileUpdateResult=(remote,options)=>page.updated={remote,options};
(async()=>{
 const pending=page.onResetDefaultAvatar();await page.onResetDefaultAvatar();await pending;
 assert.equal(calls,1);assert.equal(saved.avatarUrl,defaults.FEMALE);assert.equal(page.updated.options.avatarFileName,defaults.FEMALE);assert.equal(page.data.profile.vip,true);
 fail=true;page.updated=null;await page.onResetDefaultAvatar();assert.equal(page.updated,null);assert.equal(page.data.defaultAvatarSaving,false);
 page.data.isSelf=false;await page.onResetDefaultAvatar();assert.equal(calls,2);
 console.log('PASS: gender defaults, legacy migration, cached/custom avatars, fallback, asset bytes, persisted reset, duplicate/failure/self guards, VIP preserved.');
})().catch(e=>{console.error(e);process.exitCode=1;});
