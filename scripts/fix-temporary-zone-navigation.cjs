const fs=require('fs');
const root='E:/source_code/wechat/DiKongKong-wechat-mini/miniprogram';
const file=root+'/pages/temporary-no-fly-announcement/index.js';
let src=fs.readFileSync(file,'utf8');
const start=src.indexOf('    const existingMap = findLatestMapPage();',src.indexOf('  onMapTap(event)'));
const end=src.indexOf('\n  resolveZoneFromEvent',start);
if(start<0||end<0)throw Error('Navigation block not found');
src=src.slice(0,start)+`    const preview = buildTemporaryPreviewPayload(item.raw, mapTarget?.index ?? targetIndex);
    const app = typeof getApp === "function" ? getApp() : null;
    if (!preview || !app?.globalData) {
      this.releaseNavigationLock();
      wx.showToast({ title: "禁飞区范围不可用", icon: "none" });
      return;
    }
    // Hand off every area, not just the center. The map consumes this in onShow,
    // after its hidden-page cleanup, without waiting for a nearby network query.
    app.globalData.pendingPinPreview = preview;
    app.globalData.pendingMarkerFocus = null;
    const navigationFailed = (err) => {
      if (app.globalData.pendingPinPreview === preview) app.globalData.pendingPinPreview = null;
      console.warn("temporary no-fly map navigate failed", err);
      this.releaseNavigationLock();
      wx.showToast({ title: "地图打开失败，请重试", icon: "none" });
    };
    const existingMap = findLatestMapPage();
    if (existingMap?.page) {
      wx.navigateBack({ delta: existingMap.delta, fail: navigationFailed });
      return;
    }
    const pages = typeof getCurrentPages === "function" ? getCurrentPages() : [];
    const navigate = Array.isArray(pages) && pages.length >= 9 ? wx.redirectTo : wx.navigateTo;
    // cs=1 is a center-only share route: bootstrap intentionally discards previews.
    navigate.call(wx, { url: "/pages/map/map", fail: navigationFailed });
  },
`+src.slice(end);
src=src.replace('  const active = isNoFlyZoneEffective(zone);','  const active = isNoFlyZoneEffective(zone);\n  const hasAnnouncement = !!zone.announcement && !!zone.id;');
src=src.replace('      hasLink: !!validLink,','      hasLink: hasAnnouncement || !!validLink,');
src=src.replace('      linkPath: validLink ? `/packages/city-report/h5/index?url=${encodeURIComponent(validLink)}` : "",','      linkPath: hasAnnouncement\n        ? `/packages/no-fly-announcement/detail/index?id=${encodeURIComponent(zone.id)}`\n        : validLink ? `/packages/city-report/h5/index?url=${encodeURIComponent(validLink)}` : "",');
fs.writeFileSync(file,src);
