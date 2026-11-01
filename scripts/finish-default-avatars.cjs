const fs=require('fs'),path=require('path'),vm=require('vm');
const mini='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram',android='D:/Workspace/LowLatitudePlanet';
function edit(file,fn){const p=mini+'/'+file,s=fs.readFileSync(p,'utf8').replaceAll('\r\n','\n');fs.writeFileSync(p,fn(s));}
function rep(s,a,b){if(!s.includes(a))throw Error(a);return s.replace(a,b);}
edit('pages/profile/avatar-sheet.wxml',s=>rep(s,'      <view class="avatar-action-cancel"',`      <button class="avatar-action-item" bindtap="onResetDefaultAvatar" disabled="{{defaultAvatarSaving}}">
        <view class="avatar-action-copy"><text class="avatar-action-name">切回默认头像</text></view>
      </button>
      <view class="avatar-action-cancel"`));
edit('pages/profile/profile-page.js',s=>rep(s,'  onChooseAvatar(e) {',`  async onResetDefaultAvatar() {
    if (this.data.isSelf === false || this.data.defaultAvatarSaving || this.data.setupAvatarSaving || this.data.detailsSaving) return;
    const avatar = require('../../utils/default-avatar').defaultAvatar(this.data.gender || this.data.profile?.gender || this._storedProfileCache?.gender);
    this.setData({ defaultAvatarSaving: true });
    try {
      const remote = await updateUserProfile({ avatarUrl: avatar }, { apiBase: resolveApiBase() });
      await clearCyberPilotCharacterIdFromMapLayer({ silent: true }).catch(() => null);
      this.handleProfileUpdateResult(remote, { avatarFileName: avatar });
      this.setData({ avatarActionSheetVisible: false });
      wx.showToast({ title: '已切回默认头像', icon: 'success' });
    } catch (error) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' });
    } finally { this.setData({ defaultAvatarSaving: false }); }
  },

  onChooseAvatar(e) {`));
edit('pages/profile/home/index.js',s=>{
 s=rep(s,"socialImages.thumbnailUrl(source.avatarUrl,128) || social.avatar(null)","socialImages.thumbnailUrl(socialImages.avatarUrl(source.avatarUrl, raw.gender),128)");
 s=rep(s,'avatarUrl: source.avatarUrl, featureCode:', 'avatarUrl: raw.avatarUrl, gender: raw.gender, featureCode:');
 return rep(s,"['openAvatarActionSheet','onChooseAvatar'","['onResetDefaultAvatar','openAvatarActionSheet','onChooseAvatar'");
});
edit('pages/profile/home/index.wxml',s=>rep(s,'    <view class="edit-row nickname-edit-row',`    <view wx:if="{{!profileSetupGuide}}" class="edit-row" bindtap="onResetDefaultAvatar"><text>切回默认头像</text><text>›</text></view>
    <view class="edit-row nickname-edit-row`));
edit('pages/profile/edit/index.wxml',s=>rep(s,'    </view>\n\n    <view class="edit-form-item">','    </view>\n    <button class="avatar-reset" bindtap="onResetDefaultAvatar" disabled="{{saving}}">切回默认头像</button>\n\n    <view class="edit-form-item">'));
edit('pages/profile/edit/index.wxss',s=>s+'\n.avatar-reset { margin: 8px auto 16px; width: auto; padding: 0 14px; font-size: 14px; line-height: 36px; color: #334155; background: #f3f4f6; border-radius: 8px; }\n');
edit('pages/profile/edit/index.js',s=>{
 s=rep(s,'  onChooseAvatar(e) {',`  onResetDefaultAvatar() {
    if (this.data.saving) return;
    this._defaultAvatarSelected = require('../../../utils/default-avatar').defaultAvatar(this._profileFromParent?.gender || this._storedProfile?.gender);
    this._avatarTempPath = '';
    this.setData({ avatarPreview: this._defaultAvatarSelected });
  },
  onChooseAvatar(e) {`);
 s=rep(s,'    this._avatarTempPath = avatarUrl;',"    this._defaultAvatarSelected = '';\n    this._avatarTempPath = avatarUrl;");
 return rep(s,'      if (!this._avatarTempPath) return Promise.resolve(null);','      if (this._defaultAvatarSelected) return Promise.resolve(this._defaultAvatarSelected);\n      if (!this._avatarTempPath) return Promise.resolve(null);');
});
edit('utils/profile.js',s=>{
 s=rep(s,'const avatarUrl = profile.avatarUrl || existing.avatarUrl || "";','const gender = profile.gender || profile.pilotGender || existing.gender || existing.pilotGender;\n  const avatarUrl = resolveAvatar(profile.avatarUrl || existing.avatarUrl || "", gender);');
 s=rep(s,'    nickname,\n    avatarUrl,\n    featureCode,','    nickname,\n    avatarUrl,\n    gender,\n    featureCode,');
 s=rep(s,'const avatarUrl = cached.avatarUrl || "";','const avatarUrl = resolveAvatar(cached.avatarUrl, cached.gender || cached.pilotGender);');
 s=rep(s,'const avatarFromGlobal = (fromGlobal && fromGlobal.avatarUrl) || "";','const avatarFromGlobal = resolveAvatar(fromGlobal && fromGlobal.avatarUrl, fromGlobal?.gender || cached.gender);');
 s=s.replaceAll('avatarUrl: avatarFromGlobal || "",','avatarUrl: avatarFromGlobal || "",\n      gender: cached.gender,').replace('nickname: nicknameCandidate || DEFAULT_NICKNAME,\n      avatarUrl,','nickname: nicknameCandidate || DEFAULT_NICKNAME,\n      avatarUrl,\n      gender: cached.gender,');
 return s;
});
for(const file of ['utils/images.js','utils/planet-broadcast.js'])edit(file,s=>{
 const name=file.endsWith('/images.js')?'buildImageUrl(value, options = {}) {':'buildFileUrl(objectName, options = {}) {';
 const arg=file.endsWith('/images.js')?'value':'objectName';
 return rep(s,'function '+name,'function '+name+`\n  if (${arg} && require('./default-avatar').isDefaultAvatar(${arg})) return require('./default-avatar').resolveAvatar(${arg}, options.gender);`);
});
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
