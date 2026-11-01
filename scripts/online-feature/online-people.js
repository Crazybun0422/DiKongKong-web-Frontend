const api = require('../../utils/flight-meetups');
const images = require('../../utils/social-images');
const { uploadUserLocation } = require('../../utils/profile');
let reporting = null, lastReportAt = 0;
function reportPosition(point) {
  if (reporting || (lastReportAt && Date.now() - lastReportAt < 30000)) return;
  reporting = uploadUserLocation({ latitude: point.latitude, longitude: point.longitude })
    .then(() => { lastReportAt = Date.now(); }).catch(() => {}).finally(() => { reporting = null; });
}
function distanceStyle(meters) {
  if (meters == null || !Number.isFinite(Number(meters)) || Number(meters) < 0) return { distanceText: '—', distanceColor: '#45494f' };
  const distance = Number(meters), ratio = Math.max(0, Math.min(1, (distance - 5000) / 45000));
  const start = [173, 116, 25], end = [69, 73, 79];
  const color = start.map((value, i) => Math.round(value + (end[i] - value) * ratio));
  return { distanceText: distance < 1000 ? `${Math.round(distance)} m` : `${(distance / 1000).toFixed(1)} km`, distanceColor: `rgb(${color.join(',')})` };
}
function decorate(person) {
  return { ...person, avatarUrl: images.imageUrl(person.avatarUrl || '/assets/default-avatar.png'), ...distanceStyle(person.distanceMeters) };
}
function list(page = 0, size = 20, point) {
  return api.request('/online?' + api.query({ page, size, latitude: point?.latitude, longitude: point?.longitude }));
}
function locate() {
  return new Promise(resolve => wx.getLocation({ type: 'gcj02', success: point => { reportPosition(point); resolve(point); }, fail: () => resolve(null) }));
}
function locateIfAuthorized() {
  // Entry previews reuse existing permission. The full list handles first-time authorization.
  return new Promise(resolve => wx.getSetting({ success: settings => {
    if (settings.authSetting?.['scope.userLocation']) locate().then(resolve);
    else resolve(null);
  }, fail: () => resolve(null) }));
}
module.exports = { list, decorate, locate, locateIfAuthorized, distanceStyle };
