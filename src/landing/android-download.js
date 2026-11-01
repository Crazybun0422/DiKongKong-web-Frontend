export function initAndroidDownload(openDialog) {
  const button = document.getElementById('download-app');
  const label = document.getElementById('download-label');
  const status = document.getElementById('android-version');
  const copy = document.getElementById('copy-android-link');
  let current = null, loading = false;
  async function load() {
    if (loading) return;
    loading = true;
    button.setAttribute('aria-busy', 'true'); label.textContent = '获取安装包…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/api/android/app-releases/latest', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!result.success) throw new Error();
      current = result.data;
      if (!current) {
        label.textContent = '刷新安装包'; status.textContent = '仅支持 Android · 安装包即将上线';
        button.removeAttribute('href'); return;
      }
      // Only link to immutable, published releases on our own server.
      if (!/^\/api\/android\/app-releases\/\d+\/(?:download|versions\/\d+\/[a-f0-9]{64}\.apk)$/.test(current.downloadUrl) || !(current.sizeBytes > 0)) throw new Error();
      button.href = current.downloadUrl;
      button.download = `LowLatitudePlanet-${current.versionCode}.apk`;
      label.textContent = '下载 Android APK';
      status.textContent = `v${current.versionName} · ${(current.sizeBytes / 1024 / 1024).toFixed(1)} MB · 仅支持 Android`;
    } catch {
      current = null; button.removeAttribute('href'); label.textContent = '重新获取安装包';
      status.textContent = '版本信息暂未获取，点击重试';
    } finally { clearTimeout(timeout); loading = false; button.setAttribute('aria-busy', 'false'); }
  }
  button.addEventListener('click', event => {
    if (loading || !current) { event.preventDefault(); if (!loading) load(); return; }
    const wechat = /MicroMessenger/i.test(navigator.userAgent);
    const apple = /iPhone|iPad|iPod/i.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    if (!wechat && !apple) return; // Stream/resume the APK through the browser, without buffering it in JS.
    event.preventDefault();
    document.getElementById('android-download-title').textContent = apple ? '仅支持 Android' : '在浏览器中下载';
    document.getElementById('android-download-tip').textContent = apple
      ? '此安装包适用于安卓手机。iOS 版本正在筹备，你也可以通过微信体验低空星球小程序。'
      : '点击微信右上角“···”，选择“在浏览器打开”，即可下载 Android 安装包。';
    copy.hidden = apple; copy.textContent = '复制下载地址';
    openDialog('android-download-dialog', button);
  });
  button.tabIndex = 0;
  button.addEventListener('keydown', event => { if (event.key === 'Enter' && !button.hasAttribute('href')) { event.preventDefault(); button.click(); } });
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(new URL(current.downloadUrl, location.origin).href);
      copy.textContent = '已复制，请在浏览器中打开';
    } catch { copy.textContent = '请点击右上角，在浏览器中打开'; }
  });
  load();
}
