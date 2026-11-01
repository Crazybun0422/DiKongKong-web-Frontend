function formatDjiTime(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 253402271999) return "";
  const date = new Date((seconds + 8 * 3600) * 1000);
  const pad = n => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth()+1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
}
function formatDjiEffectiveTimes(area = {}, parent = {}) {
  const start = formatDjiTime(area.begin_at) || formatDjiTime(parent?.begin_at);
  const end = formatDjiTime(area.end_at) || formatDjiTime(parent?.end_at);
  return [start, end].filter(Boolean).join("至");
}
export { formatDjiTime, formatDjiEffectiveTimes };
