import miniprogramCodeUrl from './assets/miniprogram-code.jpg';

document.getElementById('download-code').href = miniprogramCodeUrl;

const appTabs = Array.from(document.querySelectorAll('.app-tab'));
function selectAppTab(selectedTab) {
  appTabs.forEach(tab => {
    const selected = tab === selectedTab;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
  });
}
appTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectAppTab(tab));
  tab.addEventListener('keydown', event => {
    let nextIndex;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % appTabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + appTabs.length) % appTabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = appTabs.length - 1;
    else return;
    event.preventDefault();
    selectAppTab(appTabs[nextIndex]);
    appTabs[nextIndex].focus();
  });
});

const dialogTriggers = new WeakMap();
function openDialog(id, trigger) {
  const dialog = document.getElementById(id);
  dialogTriggers.set(dialog, trigger);
  dialog.showModal();
}
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.querySelectorAll('.dialog-close, .dialog-dismiss').forEach(button => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const r = dialog.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close();
  });
  dialog.addEventListener('close', () => dialogTriggers.get(dialog)?.focus());
});
document.querySelectorAll('[data-app]').forEach(button => {
  button.addEventListener('click', event => {
    document.querySelector('#download-dialog p').textContent = `${button.dataset.app} 正在紧锣密鼓地筹备中，敬请期待。`;
    openDialog('download-dialog', event.currentTarget);
  });
});
document.getElementById('show-code').addEventListener('click', event => openDialog('code-dialog', event.currentTarget));
document.getElementById('year').textContent = new Date().getFullYear();

// Autoplay is native. The animated WebP stays visible until playback starts,
// and remains a continuously moving fallback if browser autoplay is blocked.
(() => {
  const scene = document.getElementById('space-scene');
  const video = document.getElementById('flight-video');
  video.defaultMuted = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  const showVideo = () => {
    if (!video.paused && video.currentTime > 0) scene.classList.add('video-playing');
  };
  const showFallback = () => scene.classList.remove('video-playing');
  const play = () => {
    const pending = video.play();
    if (pending && typeof pending.catch === 'function') pending.catch(showFallback);
  };
  video.addEventListener('playing', showVideo);
  video.addEventListener('timeupdate', showVideo);
  video.addEventListener('pause', showFallback);
  video.addEventListener('waiting', showFallback);
  video.addEventListener('error', showFallback);
  video.addEventListener('canplay', play);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && video.paused) play();
  });
  document.addEventListener('pointerdown', () => {
    if (video.paused) play();
  }, { once: true, passive: true });
  play();
})();
