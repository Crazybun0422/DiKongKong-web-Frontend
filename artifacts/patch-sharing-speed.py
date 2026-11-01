from pathlib import Path
mini=Path('E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram')
android=Path('D:/Workspace/LowLatitudePlanet')
stage=Path('E:/source_code/wechat/DiKongKong-web-Frontend/artifacts')
def edit(p,old,new):
    s=p.read_text(encoding='utf-8'); assert old in s, (str(p),old[:80]); p.write_text(s.replace(old,new),encoding='utf-8')
(mini/'utils/network-scheduler.js').write_bytes((stage/'network-scheduler.js').read_bytes())
p=mini/'app.js';s=p.read_text(encoding='utf-8');p.write_text('require("./utils/network-scheduler").install(wx);\n'+s,encoding='utf-8')
p=mini/'packages/location-sharing/index/index.js'
edit(p,'let sharingJoinQueue = Promise.resolve();','let sharingJoinQueue = Promise.resolve();\nconst avatarFiles = new Map();')
edit(p,'this._sharingAvatarFiles = new Map();','this._sharingAvatarFiles = avatarFiles;')
edit(p,'this._sharingAvatarRevision = Date.now();','this._sharingAvatarRevision = Math.floor(Date.now() / 300000);')
edit(p,'    ++this._sharingCenterVersion;','    ++this._sharingCenterVersion;\n    ++this._sharingViewVersion;\n    this._sharingViewQueued = null;\n    this._sharingViewTask?.abort?.();\n    clearTimeout(this._sharingStartRetry);')
edit(p,'      if (!await this.ensureSharingProfile(generation, token) || !this.isSharingCurrent(generation)) return;\n      this.setData({ sharingStatus: "正在获取位置…", sharingError: false });\n      const position = await sharing.getPosition(this._myLocationDirection);',
'''      const [profileReady, position] = await Promise.all([
        this.ensureSharingProfile(generation, token), sharing.getPosition(this._myLocationDirection)
      ]);
      if (!profileReady || !this.isSharingCurrent(generation)) return;''')
edit(p,'      this._sharingSession = session.sessionId;','      this._sharingStartFailures = 0;\n      this._sharingSession = session.sessionId;')
edit(p,'        this.showSharingError(error);\n      }\n    } finally {\n      this._sharingJoining',
'''        this.showSharingError(error);
        if (sharing.isTransient(error) && (this._sharingStartFailures || 0) < 3) {
          const delay = 1000 * 2 ** (this._sharingStartFailures || 0);
          this._sharingStartFailures = (this._sharingStartFailures || 0) + 1;
          clearTimeout(this._sharingStartRetry);
          this._sharingStartRetry = setTimeout(() => {
            if (this.isSharingCurrent(generation) && this._sharingVisible) this.startSharing();
          }, delay);
        }
      }
    } finally {
      this._sharingJoining''')
edit(p,'  async refreshSharingView(index=this._sharingRequestedPage??this.data.sharingPage,propagate=false) {',
'''  refreshSharingView(index=this._sharingRequestedPage??this.data.sharingPage,propagate=false) {
    if (!this._sharingSession || !this._sharingVisible || this._sharingPaused || this._sharingUnloaded) return Promise.resolve();
    this._sharingViewVersion = (this._sharingViewVersion || 0) + 1;
    this._sharingViewQueued = { index };
    if (!this._sharingViewPromise) {
      this._sharingViewPromise = Promise.resolve().then(async () => {
        while (this._sharingViewQueued && this._sharingVisible && !this._sharingPaused && !this._sharingUnloaded) {
          const next = this._sharingViewQueued;
          this._sharingViewQueued = null;
          try { await this.fetchSharingView(next.index, true); }
          catch (error) { if (!this._sharingViewQueued) throw error; }
        }
      }).finally(() => { this._sharingViewPromise = null; });
    }
    return propagate ? this._sharingViewPromise : this._sharingViewPromise.catch(() => {});
  },

  async fetchSharingView(index=this._sharingRequestedPage??this.data.sharingPage,propagate=false) {''')
edit(p,"      const result=await sharing.request('POST',`/${this._sharingSession}/view`,overview.query(this,index),this._sharingToken);",
"      this._sharingViewTask=sharing.request('POST',`/${this._sharingSession}/view`,overview.query(this,index),this._sharingToken);\n      const result=await this._sharingViewTask;")
edit(p,'      const roster=result.participants||[],map=result.mapParticipants||[];','      this._sharingLastSuccess = Date.now();\n      const roster=result.participants||[],map=result.mapParticipants||[];')
edit(p,'      // Do not keep displaying peers whose current sharing state is unknown.\n      this._sharingPeople = [];\n      this._sharingClusters=[];this._sharingTotal=0;',
'''      // Brief network failures keep the last snapshot, never beyond the session lease.
      if (error.statusCode === 401 || error.statusCode === 409 || !this._sharingLastSuccess || Date.now() - this._sharingLastSuccess > 45000) {
        this._sharingPeople = [];
        this._sharingClusters=[];this._sharingTotal=0;
      }''')
edit(p,'    this.setData({ sharingError: true, sharingStatus: error.message || "共享连接失败，请重试" });',
'''    if (!this._sharingVisible || this._sharingPaused || this._sharingUnloaded) return;
    const transient = sharing.isTransient(error);
    this.setData({ sharingError: true, sharingStatus: transient
      ? (this._sharingLastSuccess ? "位置更新中，正在重新连接…" : "连接繁忙，正在重试…")
      : (error.message || "共享连接失败，请重试") });''')
edit(p,'      this._sharingAvatarFiles.set(source, { path, revision });','      if (this._sharingAvatarFiles.size >= 256) this._sharingAvatarFiles.delete(this._sharingAvatarFiles.keys().next().value);\n      this._sharingAvatarFiles.set(source, { path, revision });')
# These services are not used on the shared map; retain airspace and personal layer settings.
edit(p,'  scheduleAddMiniAppPopupCheck() {},','  prefetchSubscriptionLatest() {},\n  loadMapGuideConfigs() { return Promise.resolve(); },\n  prefetchTencentCosConfig() {},\n  ensureTencentCosSts() { return Promise.resolve(); },\n  autoLoginOnLaunch() {},\n  scheduleAddMiniAppPopupCheck() {},')
p=mini/'packages/location-sharing/utils/sharing.js'
edit(p,'  return new Promise((resolve, reject) => {\n    const base = resolveApiBase();','  let task;\n  const promise = new Promise((resolve, reject) => {\n    const base = resolveApiBase();')
edit(p,'    wx.request({','    task = wx.request({')
edit(p,'      fail() { reject(new Error("网络连接失败，请重试")); }','      fail(detail) { const error = new Error("网络连接失败，请重试"); error.errMsg = detail?.errMsg; error.transient = true; reject(error); }')
edit(p,'  });\n}\n\nfunction getPosition','  });\n  promise.abort = () => task?.abort();\n  return promise;\n}\n\nfunction isTransient(error) {\n  return error?.transient === true || error?.statusCode >= 500 || /network|timeout|request:fail|request-failed|网络连接/i.test(error?.errMsg || error?.message || "");\n}\n\nfunction getPosition')
edit(p,'module.exports = { QUICK_INTERACTION_RADIUS,','module.exports = { isTransient, QUICK_INTERACTION_RADIUS,')
p=mini/'pages/map/utils/layer-panel.js';edit(p,'if (page._uomLayerConfigPromise && !force)','if (page._uomLayerConfigPromise)')
p=mini/'utils/uom-layer-config.js';edit(p,'if (!options.forceRefresh && pendingUomLayerConfigRequest)','if (pendingUomLayerConfigRequest)')
# Share in-flight profile reads only; do not cache identity or authoritative membership.
p=mini/'utils/profile.js'
edit(p,'function fetchUserProfile(options = {}) {\n  return authorizedRequest({','const profileRequests = new Map();\nfunction fetchUserProfile(options = {}) {\n  const key = `${resolveApiBase(options.apiBase)}|${options.token || getAuthToken()}`;\n  if (profileRequests.has(key)) return profileRequests.get(key);\n  const pending = authorizedRequest({')
edit(p,'  }).then((body) => body?.data || {});\n}\n\nfunction updateUserProfile','  }).then((body) => body?.data || {}).finally(() => profileRequests.delete(key));\n  profileRequests.set(key, pending);\n  return pending;\n}\n\nfunction updateUserProfile')
# On Android use the same updated modules; preserve unrelated native page overrides.
p=android/'scripts/sync-drone-game-sharing.cjs'
edit(p,"const modules = ['packages/location-sharing/utils/sharing.js', 'packages/location-sharing/index/index.js'];", "const modules = ['packages/location-sharing/utils/sharing.js', 'packages/location-sharing/index/index.js', 'utils/network-scheduler.js', 'utils/profile.js', 'utils/uom-layer-config.js', 'pages/map/utils/layer-panel.js'];")
p=android/'app/src/main/assets/mini-parity/runtime.js'
edit(p,"requireModule('app.js');Object.assign(app.globalData", "requireModule('/utils/network-scheduler').install(wx);requireModule('app.js');Object.assign(app.globalData")
print('Updated mini and scoped Android sharing source.')
