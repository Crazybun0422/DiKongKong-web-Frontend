export function initHarmonyDownload(openDialog) {
  const button = document.getElementById('download-harmony');
  const label = document.getElementById('harmony-download-label');
  const status = document.getElementById('harmony-version');
  const copy = document.getElementById('copy-harmony-link');
  let current = null, loading = false;

  async function load() {
    if (loading) return;
    loading = true;
    current = null;
    button.removeAttribute('href');
    button.removeAttribute('download');
    button.setAttribute('aria-busy', 'true');
    label.textContent = '获取安装包…';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/api/harmony/app-releases/latest', { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (!result.success) throw new Error();
      if (!result.data) {
        label.textContent = '刷新安装包';
        status.textContent = '鸿蒙安装包尚未发布';
        return;
      }
      const release = result.data;
      // Only use the published HAP on our own server; never an APK or an arbitrary URL.
      if (!/^\/api\/harmony\/app-releases\/\d+\/(?:download|versions\/\d+\/[a-f0-9]{64}\.hap)$/.test(release.downloadUrl)
          || !Number.isFinite(release.sizeBytes) || release.sizeBytes <= 0
          || !Number.isSafeInteger(release.versionCode) || release.versionCode <= 0
          || typeof release.versionName !== 'string' || !release.versionName.trim()) throw new Error();
      current = release;
      button.href = release.downloadUrl;
      button.download = `LowLatitudePlanet-Harmony-${release.versionCode}.hap`;
      label.textContent = '下载鸿蒙 HAP';
      status.textContent = `v${release.versionName} · ${(release.sizeBytes / 1024 / 1024).toFixed(1)} MB`;
    } catch {
      label.textContent = '重新获取安装包';
      status.textContent = '版本信息暂未获取，点击重试';
    } finally {
      clearTimeout(timeout);
      loading = false;
      button.setAttribute('aria-busy', 'false');
    }
  }

  button.addEventListener('click', event => {
    if (loading || !current) {
      event.preventDefault();
      if (!loading) load();
      return;
    }
    const wechat = /MicroMessenger/i.test(navigator.userAgent);
    const apple = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    if (!wechat && !apple) return; // Browser streams the HAP, including resumable downloads.
    event.preventDefault();
    document.getElementById('harmony-download-title').textContent = apple ? '适用于原生鸿蒙' : '在浏览器中下载';
    document.getElementById('harmony-download-tip').textContent = apple
      ? 'HAP 无法安装在 iPhone 或 iPad 上，可通过微信体验低空星球小程序。'
      : '点击微信右上角“···”，选择“在浏览器打开”，即可下载鸿蒙 HAP 测试包。';
    copy.hidden = apple;
    copy.textContent = '复制下载地址';
    openDialog('harmony-download-dialog', button);
  });
  button.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !button.hasAttribute('href')) { event.preventDefault(); button.click(); }
  });
  copy.addEventListener('click', async () => {
    if (!current) return;
    try {
      await navigator.clipboard.writeText(new URL(current.downloadUrl, location.origin).href);
      copy.textContent = '已复制，请在浏览器中打开';
    } catch { copy.textContent = '请点击右上角，在浏览器中打开'; }
  });
  // Re-entering the tab picks up newly uploaded or switched releases, without polling.
  document.getElementById('tab-harmony').addEventListener('click', load);
  load();
}
