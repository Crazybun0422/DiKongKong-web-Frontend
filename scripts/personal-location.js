const { getAuthToken, resolveApiBase, uploadUserLocation } = require('./profile');
let state = null;
function reportPosition(point) {
  if (point?.latitude == null || point?.longitude == null) return Promise.resolve(false);
  const latitude = Number(point.latitude), longitude = Number(point.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return Promise.resolve(false);
  const token = getAuthToken(), apiBase = resolveApiBase();
  if (!token || !apiBase) return Promise.resolve(false);
  const identity = apiBase + '|' + token;
  if (state?.identity !== identity) state = { identity, pending: null, attempted: null, succeeded: null };
  const current = state, now = Date.now();
  if (current.pending) return current.pending;
  if ((current.succeeded !== null && now - current.succeeded < 30000) ||
      (current.attempted !== null && now - current.attempted < 5000)) return Promise.resolve(false);
  current.attempted = now;
  current.pending = Promise.resolve().then(() => uploadUserLocation({ latitude, longitude }, { token, apiBase }))
    .then(() => { current.succeeded = Date.now(); return true; })
    .catch(() => false).finally(() => { current.pending = null; });
  return current.pending;
}
// Only actual device fixes are reported, never a dragged map center or cached default center.
function getLocation(options = {}) {
  const type = options.type || 'gcj02';
  return wx.getLocation({ ...options, type, success(point) {
    if (type === 'gcj02') reportPosition(point);
    options.success?.(point);
  } });
}
module.exports = { getLocation, reportPosition };
