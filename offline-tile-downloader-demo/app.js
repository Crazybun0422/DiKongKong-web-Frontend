const DEFAULT_CENTER = { lat: 39.908823, lng: 116.39747 }
const DEFAULT_ZOOM = 11
const WMS_MIN_ZOOM = 5
const WMS_MAX_ZOOM = 18
const EMPTY_TILE_DATA_URL = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

const dom = {
  pickDirBtn: document.getElementById('pickDirBtn'),
  reloadTaskBtn: document.getElementById('reloadTaskBtn'),
  resumeTaskBtn: document.getElementById('resumeTaskBtn'),
  pauseBtn: document.getElementById('pauseBtn'),
  stopBtn: document.getElementById('stopBtn'),
  browseSplitKmlBtn: document.getElementById('browseSplitKmlBtn'),
  browseSplitOutputBtn: document.getElementById('browseSplitOutputBtn'),
  loadSplitPreviewKmlBtn: document.getElementById('loadSplitPreviewKmlBtn'),
  clearSplitPreviewKmlBtn: document.getElementById('clearSplitPreviewKmlBtn'),
  startSplitBtn: document.getElementById('startSplitBtn'),
  startCompressBtn: document.getElementById('startCompressBtn'),
  splitPreviewKmlInput: document.getElementById('splitPreviewKmlInput'),
  splitKmlDirectoryInput: document.getElementById('splitKmlDirectoryInput'),
  startDrawBtn: document.getElementById('startDrawBtn'),
  finishDrawBtn: document.getElementById('finishDrawBtn'),
  undoAnchorBtn: document.getElementById('undoAnchorBtn'),
  clearAnchorsBtn: document.getElementById('clearAnchorsBtn'),
  importKmlBtn: document.getElementById('importKmlBtn'),
  importKmlBatchBtn: document.getElementById('importKmlBatchBtn'),
  savePolygonBtn: document.getElementById('savePolygonBtn'),
  exportCurrentKmlBtn: document.getElementById('exportCurrentKmlBtn'),
  exportBatchKmlBtn: document.getElementById('exportBatchKmlBtn'),
  importKmlInput: document.getElementById('importKmlInput'),
  importKmlBatchInput: document.getElementById('importKmlBatchInput'),
  downloadCurrentBtn: document.getElementById('downloadCurrentBtn'),
  downloadRangeBtn: document.getElementById('downloadRangeBtn'),
  workspacePathInput: document.getElementById('workspacePathInput'),
  splitKmlRootInput: document.getElementById('splitKmlRootInput'),
  splitOutputPathInput: document.getElementById('splitOutputPathInput'),
  splitPreviewKmlLabel: document.getElementById('splitPreviewKmlLabel'),
  startZoomInput: document.getElementById('startZoomInput'),
  endZoomInput: document.getElementById('endZoomInput'),
  concurrencyInput: document.getElementById('concurrencyInput'),
  highZoomStageStartInput: document.getElementById('highZoomStageStartInput'),
  highZoomStageEndInput: document.getElementById('highZoomStageEndInput'),
  highZoomStageStartLabel: document.getElementById('highZoomStageStartLabel'),
  highZoomStageEndLabel: document.getElementById('highZoomStageEndLabel'),
  highZoomStageSummaryLabel: document.getElementById('highZoomStageSummaryLabel'),
  autoShutdownInput: document.getElementById('autoShutdownInput'),
  dirLabel: document.getElementById('dirLabel'),
  taskStatusLabel: document.getElementById('taskStatusLabel'),
  drawModeLabel: document.getElementById('drawModeLabel'),
  anchorCountLabel: document.getElementById('anchorCountLabel'),
  zoomLabel: document.getElementById('zoomLabel'),
  currentZoomLabel: document.getElementById('currentZoomLabel'),
  progressText: document.getElementById('progressText'),
  progressPercentText: document.getElementById('progressPercentText'),
  downloadedCountLabel: document.getElementById('downloadedCountLabel'),
  unavailableCountLabel: document.getElementById('unavailableCountLabel'),
  totalCountLabel: document.getElementById('totalCountLabel'),
  retryCountLabel: document.getElementById('retryCountLabel'),
  activeRequestCountLabel: document.getElementById('activeRequestCountLabel'),
  downloadChunkLabel: document.getElementById('downloadChunkLabel'),
  countChunkLabel: document.getElementById('countChunkLabel'),
  progressBar: document.getElementById('progressBar'),
  splitProgressText: document.getElementById('splitProgressText'),
  splitProgressPercentText: document.getElementById('splitProgressPercentText'),
  splitProgressBar: document.getElementById('splitProgressBar'),
  splitPackageTotalLabel: document.getElementById('splitPackageTotalLabel'),
  splitPackageCompletedLabel: document.getElementById('splitPackageCompletedLabel'),
  splitZipCompletedLabel: document.getElementById('splitZipCompletedLabel'),
  splitZipSkippedLabel: document.getElementById('splitZipSkippedLabel'),
  splitProcessedTileLabel: document.getElementById('splitProcessedTileLabel'),
  splitCopiedTileLabel: document.getElementById('splitCopiedTileLabel'),
  splitSkippedTileLabel: document.getElementById('splitSkippedTileLabel'),
  splitCurrentPackageLabel: document.getElementById('splitCurrentPackageLabel'),
  anchorList: document.getElementById('anchorList'),
  polygonLibraryList: document.getElementById('polygonLibraryList'),
  eventList: document.getElementById('eventList'),
  statusBox: document.getElementById('statusBox'),
  mapStateLabel: document.getElementById('mapStateLabel'),
  map: document.getElementById('map'),
}

const state = {
  map: null,
  drawMode: false,
  anchorMarkers: [],
  anchorPath: null,
  anchorPolygon: null,
  savedPolygonOverlays: [],
  selectedPolygonId: '',
  savedPolygons: [],
  mapReady: false,
  ws: null,
  reconnectTimer: null,
  taskState: null,
  workspacePath: '',
  activeRequests: 0,
  running: false,
  packageTask: null,
  splitKmlFiles: [],
  splitKmlSelectionLabel: '',
  splitPreviewPolygons: [],
  splitPreviewOverlays: [],
  splitPreviewFileName: '',
  pendingAction: '',
  overlayRange: { minZoom: 6, maxZoom: 7 },
  events: [],
  offlineMapType: null,
  offlineMapTypeIndex: -1,
  overlayVersion: 0,
  liveChunks: [],
}

const ACTION_BUTTONS = {
  applyWorkspace: dom.pickDirBtn,
  reloadWorkspace: dom.reloadTaskBtn,
  resumeTask: dom.resumeTaskBtn,
  pauseTask: dom.pauseBtn,
  stopTask: dom.stopBtn,
  browseSplitOutput: dom.browseSplitOutputBtn,
  startSplitPackages: dom.startSplitBtn,
  startCompressPackages: dom.startCompressBtn,
  startCurrentDownload: dom.downloadCurrentBtn,
  startRangeDownload: dom.downloadRangeBtn,
}

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function createPolygonId() {
  return `poly-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatDateTime(input = new Date()) {
  const value = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(value.getTime())) return String(input || '')
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())} ${pad2(value.getHours())}:${pad2(value.getMinutes())}:${pad2(value.getSeconds())}`
}

function setStatus(message) {
  dom.statusBox.textContent = message
}

function currentMapZoom() {
  if (!state.map || typeof state.map.getZoom !== 'function') return DEFAULT_ZOOM
  return Math.round(state.map.getZoom())
}

function toQqColor(hex, opacity = 1) {
  if (!window.qq?.maps?.Color) return hex
  const normalized = String(hex || '').replace('#', '')
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return hex
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return new window.qq.maps.Color(r, g, b, clamp(Number(opacity), 0, 1))
}

function buildMarkerIcon() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
      <circle cx="8" cy="8" r="5" fill="#111111" stroke="#ffffff" stroke-width="2" />
    </svg>
  `
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

function normalizePoint(point) {
  const latitude = Number(point?.latitude ?? point?.lat)
  const longitude = Number(point?.longitude ?? point?.lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
}

function normalizePolygonPoints(points = []) {
  return points.map(normalizePoint).filter(Boolean)
}

function normalizePolygonsInput(polygons = [], fallbackPoints = []) {
  const normalized = Array.isArray(polygons)
    ? polygons.map((polygon) => normalizePolygonPoints(polygon)).filter((polygon) => polygon.length >= 3)
    : []
  if (normalized.length) return normalized
  const fallback = normalizePolygonPoints(fallbackPoints)
  return fallback.length >= 3 ? [fallback] : []
}

function polygonSignature(points = []) {
  return JSON.stringify(normalizePolygonPoints(points).map((point) => ({
    latitude: Number(point.latitude).toFixed(6),
    longitude: Number(point.longitude).toFixed(6),
  })))
}

function currentPolygonSignature() {
  return polygonSignature(getAnchorPoints())
}

function getAnchorPoints() {
  return state.anchorMarkers.map((marker) => {
    const position = marker.getPosition()
    return {
      latitude: Number(position.getLat()),
      longitude: Number(position.getLng()),
    }
  })
}

function renderAnchorList(points = getAnchorPoints()) {
  dom.anchorList.innerHTML = ''
  if (!points.length) {
    const item = document.createElement('li')
    item.textContent = '暂无锚点。点击“开始描点”后在地图上点选。'
    dom.anchorList.appendChild(item)
    return
  }

  points.forEach((point, index) => {
    const item = document.createElement('li')
    item.innerHTML = `<span class="anchor-index">#${index + 1}</span>${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`
    dom.anchorList.appendChild(item)
  })
}

function renderPolygonLibrary() {
  if (!dom.polygonLibraryList) return
  dom.polygonLibraryList.innerHTML = ''
  if (!state.savedPolygons.length) {
    const item = document.createElement('li')
    item.className = 'polygon-library__empty'
    item.textContent = '暂无已保存轮廓。可导入 KML，或先描点再点击“保存当前轮廓”。'
    dom.polygonLibraryList.appendChild(item)
    return
  }

  state.savedPolygons.forEach((polygon) => {
    const item = document.createElement('li')
    item.className = `polygon-library__item${polygon.id === state.selectedPolygonId ? ' is-active' : ''}`
    item.innerHTML = `
      <div class="polygon-library__meta">
        <strong>${polygon.name}</strong>
        <span>${polygon.points.length} 点</span>
      </div>
      <div class="polygon-library__actions">
        <button type="button" class="ghost" data-action="load" data-id="${polygon.id}">加载</button>
        <button type="button" class="ghost" data-action="export" data-id="${polygon.id}">导出</button>
        <button type="button" class="ghost" data-action="delete" data-id="${polygon.id}">删除</button>
      </div>
    `
    dom.polygonLibraryList.appendChild(item)
  })
}

function upsertSavedPolygon(polygon, { select = false } = {}) {
  const normalizedPoints = normalizePolygonPoints(polygon?.points || [])
  if (normalizedPoints.length < 3) return null
  const entry = {
    id: polygon.id || createPolygonId(),
    name: String(polygon.name || `轮廓 ${state.savedPolygons.length + 1}`),
    points: normalizedPoints,
  }
  const index = state.savedPolygons.findIndex((item) => item.id === entry.id)
  if (index >= 0) state.savedPolygons[index] = entry
  else state.savedPolygons.push(entry)
  if (select) state.selectedPolygonId = entry.id
  renderPolygonLibrary()
  renderSavedPolygonOverlays()
  refreshButtons()
  return entry
}

function findSavedPolygonByCurrentPoints() {
  const signature = currentPolygonSignature()
  return state.savedPolygons.find((polygon) => polygonSignature(polygon.points) === signature) || null
}

function syncSelectedPolygonFromCurrent() {
  const matched = findSavedPolygonByCurrentPoints()
  state.selectedPolygonId = matched?.id || ''
  renderPolygonLibrary()
}

function renderEventList(events = state.events || []) {
  dom.eventList.innerHTML = ''
  if (!events.length) {
    const item = document.createElement('li')
    item.textContent = '暂无任务节点。'
    dom.eventList.appendChild(item)
    return
  }
  events.forEach((event) => {
    const item = document.createElement('li')
    item.innerHTML = `<span class="event-time">${formatDateTime(event.time)}</span>${event.message}`
    dom.eventList.appendChild(item)
  })
}

function escapeXml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function slugifyFileName(value = '') {
  return String(value || 'polygon')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

function buildKmlCoordinates(points = []) {
  const normalized = normalizePolygonPoints(points)
  if (!normalized.length) return ''
  const closed = [...normalized]
  const first = normalized[0]
  const last = normalized[normalized.length - 1]
  if (!last || last.latitude !== first.latitude || last.longitude !== first.longitude) {
    closed.push(first)
  }
  return closed.map((point) => `${point.longitude},${point.latitude},0`).join(' ')
}

function buildKmlDocument(items = []) {
  const placemarks = items.map((item) => `
    <Placemark>
      <name>${escapeXml(item.name)}</name>
      <Polygon>
        <outerBoundaryIs>
          <LinearRing>
            <coordinates>${buildKmlCoordinates(item.points)}</coordinates>
          </LinearRing>
        </outerBoundaryIs>
      </Polygon>
    </Placemark>`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    ${placemarks}
  </Document>
</kml>
`
}

function downloadTextFile(fileName, content, mimeType = 'application/vnd.google-earth.kml+xml') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

function elementsByLocalName(root, localName) {
  const byNs = Array.from(root.getElementsByTagNameNS('*', localName))
  return byNs.length ? byNs : Array.from(root.getElementsByTagName(localName))
}

function parseKmlText(text, fallbackName = 'Imported Polygon') {
  const parser = new DOMParser()
  const xml = parser.parseFromString(text, 'application/xml')
  if (xml.getElementsByTagName('parsererror').length) {
    throw new Error('KML 解析失败，请检查文件内容')
  }

  const placemarks = elementsByLocalName(xml, 'Placemark')
  const polygons = []
  placemarks.forEach((placemark, index) => {
    const nameNode = elementsByLocalName(placemark, 'name')[0]
    const baseName = (nameNode?.textContent || '').trim() || `${fallbackName}-${index + 1}`
    const polygonNodes = elementsByLocalName(placemark, 'Polygon')
    const coordinateSources = polygonNodes.length
      ? polygonNodes
      : [placemark]

    coordinateSources.forEach((sourceNode, polygonIndex) => {
      const coordinateNode = elementsByLocalName(sourceNode, 'coordinates')[0]
      if (!coordinateNode?.textContent) return
      const points = coordinateNode.textContent
        .trim()
        .split(/\s+/)
        .map((row) => row.split(','))
        .map(([longitude, latitude]) => normalizePoint({ longitude, latitude }))
        .filter(Boolean)
      if (points.length >= 2) {
        const first = points[0]
        const last = points[points.length - 1]
        if (first && last && first.latitude === last.latitude && first.longitude === last.longitude) {
          points.pop()
        }
      }
      if (points.length < 3) return
      polygons.push({
        id: createPolygonId(),
        name: coordinateSources.length > 1 ? `${baseName}-${polygonIndex + 1}` : baseName,
        points,
      })
    })
  })

  if (!polygons.length) {
    throw new Error('KML 中没有可用的 Polygon')
  }
  return polygons
}

async function importKmlFiles(fileList) {
  const files = Array.from(fileList || [])
  if (!files.length) return
  let importedCount = 0
  let bestImportedPolygon = null
  for (const file of files) {
    const text = await file.text()
    const polygons = parseKmlText(text, file.name.replace(/\.kml$/i, '') || 'Imported')
    polygons.forEach((polygon) => {
      const entry = upsertSavedPolygon({
        ...polygon,
        name: polygons.length > 1 ? `${polygon.name}` : (polygon.name || file.name.replace(/\.kml$/i, '')),
      })
      if (entry && (!bestImportedPolygon || estimatePolygonWeight(entry.points) > estimatePolygonWeight(bestImportedPolygon.points))) {
        bestImportedPolygon = entry
      }
    })
    importedCount += polygons.length
  }
  if (bestImportedPolygon) {
    restoreAnchorsFromModel(bestImportedPolygon.points)
    state.selectedPolygonId = bestImportedPolygon.id
  }
  renderPolygonLibrary()
  if (bestImportedPolygon) {
    setStatus(`已导入 ${importedCount} 个 KML 轮廓，已加载最大轮廓：${bestImportedPolygon.name}。`)
  } else {
    setStatus(`已导入 ${importedCount} 个 KML 轮廓。`)
  }
}

function exportPolygonAsKml(polygon) {
  const entry = polygon || { name: 'Current Polygon', points: getAnchorPoints() }
  const points = normalizePolygonPoints(entry.points)
  if (points.length < 3) {
    throw new Error('当前轮廓至少需要 3 个点才能导出 KML')
  }
  const fileName = `${slugifyFileName(entry.name || 'polygon') || 'polygon'}.kml`
  downloadTextFile(fileName, buildKmlDocument([{ name: entry.name || 'Polygon', points }]))
}

function exportBatchPolygons() {
  const polygons = state.savedPolygons.map((polygon) => ({
    name: polygon.name,
    points: polygon.points,
  }))
  const currentPoints = normalizePolygonPoints(getAnchorPoints())
  const hasCurrent = currentPoints.length >= 3
  const hasCurrentInLibrary = Boolean(findSavedPolygonByCurrentPoints())
  if (hasCurrent && !hasCurrentInLibrary) {
    polygons.push({ name: 'Current Polygon', points: currentPoints })
  }
  if (!polygons.length) {
    throw new Error('没有可批量导出的轮廓')
  }
  downloadTextFile('polygons-batch.kml', buildKmlDocument(polygons))
}

function estimatePolygonWeight(points = []) {
  const normalized = normalizePolygonPoints(points)
  if (normalized.length < 3) return 0
  let area = 0
  for (let i = 0; i < normalized.length; i += 1) {
    const current = normalized[i]
    const next = normalized[(i + 1) % normalized.length]
    area += (current.longitude * next.latitude) - (next.longitude * current.latitude)
  }
  return Math.abs(area / 2)
}

function clearSplitPreviewOverlays() {
  state.splitPreviewOverlays.forEach((overlay) => overlay?.setMap?.(null))
  state.splitPreviewOverlays = []
}

function fitMapToPolygons(polygons = []) {
  if (!state.map || !window.qq?.maps?.LatLngBounds) return
  const bounds = new window.qq.maps.LatLngBounds()
  let hasPoint = false
  polygons.forEach((polygon) => {
    normalizePolygonPoints(polygon).forEach((point) => {
      bounds.extend(new window.qq.maps.LatLng(point.latitude, point.longitude))
      hasPoint = true
    })
  })
  if (hasPoint) state.map.fitBounds(bounds)
}

function renderSplitPreviewOverlays() {
  clearSplitPreviewOverlays()
  if (!state.map || !window.qq?.maps || !state.splitPreviewPolygons.length) return
  state.splitPreviewOverlays = state.splitPreviewPolygons
    .filter((polygon) => polygon.length >= 3)
    .map((polygon) => new window.qq.maps.Polygon({
      map: state.map,
      path: polygon.map((point) => new window.qq.maps.LatLng(point.latitude, point.longitude)),
      strokeColor: toQqColor('#e0c24f', 0.88),
      strokeWeight: 2,
      strokeOpacity: 0.88,
      fillColor: toQqColor('#fff3a6', 0.3),
      fillOpacity: 0.3,
      zIndex: 4,
    }))
}

function updateSplitPreviewLabel() {
  if (!dom.splitPreviewKmlLabel) return
  if (!state.splitPreviewPolygons.length) {
    dom.splitPreviewKmlLabel.textContent = '未加载预览 KML'
    return
  }
  dom.splitPreviewKmlLabel.textContent = `${state.splitPreviewFileName || '未命名 KML'} | ${state.splitPreviewPolygons.length} 个区域`
}

function clearSplitPreview({ silent = false } = {}) {
  clearSplitPreviewOverlays()
  state.splitPreviewPolygons = []
  state.splitPreviewFileName = ''
  updateSplitPreviewLabel()
  refreshButtons()
  if (!silent) {
    setStatus('已清除 KML 预览区域。')
  }
}

async function loadSplitPreviewKml(file) {
  if (!file) return
  const text = await file.text()
  const polygons = parseKmlText(text, file.name.replace(/\.kml$/i, '') || 'Split Preview')
  state.splitPreviewPolygons = polygons.map((polygon) => normalizePolygonPoints(polygon.points)).filter((polygon) => polygon.length >= 3)
  state.splitPreviewFileName = String(file.name || '未命名 KML')
  updateSplitPreviewLabel()
  renderSplitPreviewOverlays()
  fitMapToPolygons(state.splitPreviewPolygons)
  refreshButtons()
  setStatus(`已加载 KML 预览：${state.splitPreviewFileName}，共 ${state.splitPreviewPolygons.length} 个区域。`)
}

function clearSavedPolygonOverlays() {
  state.savedPolygonOverlays.forEach((overlay) => overlay?.setMap?.(null))
  state.savedPolygonOverlays = []
}

function renderSavedPolygonOverlays() {
  clearSavedPolygonOverlays()
  if (!state.map || !window.qq?.maps || !state.savedPolygons.length) return
  const currentSignature = currentPolygonSignature()
  state.savedPolygonOverlays = state.savedPolygons
    .filter((polygon) => polygonSignature(polygon.points) !== currentSignature)
    .map((polygon) => new window.qq.maps.Polygon({
      map: state.map,
      path: polygon.points.map((point) => new window.qq.maps.LatLng(point.latitude, point.longitude)),
      strokeColor: toQqColor('#7fb7ff', 0.72),
      strokeWeight: 1,
      strokeOpacity: 0.72,
      fillColor: toQqColor('#dbeeff', 0.08),
      fillOpacity: 0.08,
      zIndex: 1,
    }))
}

function getTaskPolygons() {
  const currentPoints = normalizePolygonPoints(getAnchorPoints())
  const polygons = state.savedPolygons.map((polygon) => normalizePolygonPoints(polygon.points)).filter((polygon) => polygon.length >= 3)
  if (currentPoints.length >= 3) {
    const signature = polygonSignature(currentPoints)
    const exists = polygons.some((polygon) => polygonSignature(polygon) === signature)
    if (!exists) polygons.push(currentPoints)
  }
  return polygons
}

function syncSavedPolygonsFromTask(taskState = null) {
  const polygons = normalizePolygonsInput(taskState?.polygons, taskState?.polygon)
  state.savedPolygons = polygons.map((points, index) => ({
    id: createPolygonId(),
    name: `区域 ${index + 1}`,
    points,
  }))
  renderPolygonLibrary()
  renderSavedPolygonOverlays()
}

function removeAnchorMarker(marker) {
  const index = state.anchorMarkers.indexOf(marker)
  if (index < 0) return
  marker.setMap(null)
  state.anchorMarkers.splice(index, 1)
  updateAnchorVisuals()
}

function addAnchor(lat, lng) {
  if (!state.map || !window.qq?.maps) return
  const iconSize = new window.qq.maps.Size(16, 16)
  const marker = new window.qq.maps.Marker({
    map: state.map,
    position: new window.qq.maps.LatLng(lat, lng),
    draggable: true,
    zIndex: 5,
    icon: new window.qq.maps.MarkerImage(
      buildMarkerIcon(),
      iconSize,
      new window.qq.maps.Point(0, 0),
      new window.qq.maps.Point(8, 8),
      iconSize,
    ),
  })
  window.qq.maps.event.addListener(marker, 'drag', updateAnchorVisuals)
  window.qq.maps.event.addListener(marker, 'dragend', updateAnchorVisuals)
  window.qq.maps.event.addListener(marker, 'dblclick', () => removeAnchorMarker(marker))
  window.qq.maps.event.addListener(marker, 'rightclick', () => removeAnchorMarker(marker))
  state.anchorMarkers.push(marker)
  updateAnchorVisuals()
}

function clearAllAnchors() {
  state.anchorMarkers.forEach((marker) => marker.setMap(null))
  state.anchorMarkers = []
  state.selectedPolygonId = ''
  updateAnchorVisuals()
}

function restoreAnchorsFromModel(points = []) {
  clearAllAnchors()
  points.map(normalizePoint).filter(Boolean).forEach((point) => addAnchor(point.latitude, point.longitude))
  setDrawMode(false)
}

function updateAnchorVisuals() {
  const points = getAnchorPoints()

  if (state.anchorPath) {
    state.anchorPath.setMap(null)
    state.anchorPath = null
  }
  if (state.anchorPolygon) {
    state.anchorPolygon.setMap(null)
    state.anchorPolygon = null
  }

  if (state.map && window.qq?.maps && points.length >= 2) {
    state.anchorPath = new window.qq.maps.Polyline({
      map: state.map,
      path: points.map((point) => new window.qq.maps.LatLng(point.latitude, point.longitude)),
      strokeColor: toQqColor('#5aa9ff', 0.95),
      strokeWeight: 2,
      strokeOpacity: 0.95,
      zIndex: 3,
    })
  }

  if (state.map && window.qq?.maps && points.length >= 3) {
    state.anchorPolygon = new window.qq.maps.Polygon({
      map: state.map,
      path: points.map((point) => new window.qq.maps.LatLng(point.latitude, point.longitude)),
      strokeColor: toQqColor('#5aa9ff', 0.9),
      strokeWeight: 2,
      strokeOpacity: 0.9,
      fillColor: toQqColor('#8fd0ff', 0.12),
      fillOpacity: 0.12,
      zIndex: 2,
    })
  }

  dom.anchorCountLabel.textContent = String(points.length)
  renderAnchorList(points)
  const selected = state.savedPolygons.find((polygon) => polygon.id === state.selectedPolygonId)
  if (selected) {
    selected.points = normalizePolygonPoints(points)
  }
  syncSelectedPolygonFromCurrent()
  renderSavedPolygonOverlays()
  refreshButtons()
}

function setDrawMode(enabled) {
  state.drawMode = Boolean(enabled)
  dom.drawModeLabel.textContent = state.drawMode ? '描点中' : '已结束'
  setStatus(state.drawMode ? '描点模式已开启，点击地图添加锚点。' : '描点模式已结束，可继续拖拽黑点调整。')
  refreshButtons()
}

function ensureOfflineMapType() {
  if (state.offlineMapType || !window.qq?.maps?.ImageMapType || !window.qq?.maps?.Size) {
    return state.offlineMapType
  }
  state.offlineMapType = new window.qq.maps.ImageMapType({
    name: 'OfflineDownloadedTiles',
    tileSize: new window.qq.maps.Size(256, 256),
    isPng: true,
    getTileUrl: (tileCoord, zoom) => {
      const z = Number(zoom)
      const x = Number(tileCoord?.x)
      const y = Number(tileCoord?.y)
      if (z < state.overlayRange.minZoom || z > state.overlayRange.maxZoom) return EMPTY_TILE_DATA_URL
      return `/api/offline-tiles/${z}/${x}/${y}.png?v=${state.overlayVersion}`
    },
  })
  return state.offlineMapType
}

function setOfflineLayerVisible(visible) {
  if (!state.map || !window.qq?.maps) return
  if (!visible || !state.offlineMapType) {
    if (state.offlineMapTypeIndex > -1) {
      state.map.overlayMapTypes.removeAt(state.offlineMapTypeIndex)
      state.offlineMapTypeIndex = -1
    }
    return
  }
  if (state.offlineMapTypeIndex === -1) {
    state.offlineMapTypeIndex = state.map.overlayMapTypes.push(state.offlineMapType) - 1
  }
}

function refreshOfflineLayer() {
  if (!state.map || !state.offlineMapType) return
  setOfflineLayerVisible(false)
  setOfflineLayerVisible(true)
}

function syncOfflineLayerForCurrentZoom() {
  const zoom = currentMapZoom()
  ensureOfflineMapType()
  if (!state.taskState || zoom < state.overlayRange.minZoom || zoom > state.overlayRange.maxZoom) {
    setOfflineLayerVisible(false)
    return
  }
  const downloaded = Number(state.taskState?.levels?.[String(zoom)]?.downloaded || 0)
  setOfflineLayerVisible(downloaded > 0)
  refreshOfflineLayer()
}

function refreshButtons() {
  const anchorCount = state.anchorMarkers.length
  const hasPolygon = anchorCount >= 3
  const hasTaskPolygons = getTaskPolygons().length > 0
  const hasWorkspace = Boolean((dom.workspacePathInput.value || state.workspacePath || '').trim())
  const hasSplitKmlRoot = state.splitKmlFiles.length > 0
  const hasSplitOutput = Boolean((dom.splitOutputPathInput.value || '').trim() || hasWorkspace)
  const taskStatus = state.taskState?.status || ''
  const running = ['running', 'stopping', 'pausing'].includes(taskStatus)
  const packageStatus = state.packageTask?.status || ''
  const packageRunning = ['running', 'preparing', 'zipping'].includes(packageStatus)
  const pending = Boolean(state.pendingAction)
  const resumeAvailable = Boolean(state.taskState && ['paused', 'stopped', 'failed', 'ready'].includes(taskStatus))

  dom.workspacePathInput.disabled = true
  dom.splitKmlRootInput.disabled = true
  dom.splitOutputPathInput.disabled = true
  dom.startZoomInput.disabled = pending || running || packageRunning
  dom.endZoomInput.disabled = pending || running || packageRunning
  dom.concurrencyInput.disabled = pending || running || packageRunning
  dom.highZoomStageStartInput.disabled = pending || running || packageRunning
  dom.highZoomStageEndInput.disabled = pending || running || packageRunning
  dom.autoShutdownInput.disabled = pending || running || packageRunning

  dom.pickDirBtn.disabled = pending || running || packageRunning
  dom.reloadTaskBtn.disabled = pending || running || packageRunning || !hasWorkspace
  dom.loadSplitPreviewKmlBtn.disabled = pending || !state.mapReady || running || packageRunning
  dom.clearSplitPreviewKmlBtn.disabled = pending || running || packageRunning || !state.splitPreviewPolygons.length
  dom.browseSplitKmlBtn.disabled = pending || running || packageRunning || !hasWorkspace
  dom.browseSplitOutputBtn.disabled = pending || running || packageRunning || !hasWorkspace
  dom.startSplitBtn.disabled = pending || running || packageRunning || !hasWorkspace || !hasSplitKmlRoot
  dom.startCompressBtn.disabled = pending || running || packageRunning || !hasWorkspace || !hasSplitOutput
  dom.startDrawBtn.disabled = pending || !state.mapReady || running || packageRunning
  dom.finishDrawBtn.disabled = pending || !state.mapReady || running || packageRunning || !state.drawMode
  dom.undoAnchorBtn.disabled = pending || running || packageRunning || anchorCount === 0
  dom.clearAnchorsBtn.disabled = pending || running || packageRunning || anchorCount === 0
  dom.importKmlBtn.disabled = pending || running || packageRunning
  dom.importKmlBatchBtn.disabled = pending || running || packageRunning
  dom.savePolygonBtn.disabled = pending || running || packageRunning || !hasPolygon
  dom.exportCurrentKmlBtn.disabled = pending || packageRunning || !hasPolygon
  dom.exportBatchKmlBtn.disabled = pending || packageRunning || (!state.savedPolygons.length && !hasPolygon)
  dom.downloadCurrentBtn.disabled = pending || !state.mapReady || !hasTaskPolygons || !hasWorkspace || running || packageRunning
  dom.downloadRangeBtn.disabled = pending || !state.mapReady || !hasTaskPolygons || !hasWorkspace || running || packageRunning
  dom.pauseBtn.disabled = pending || taskStatus !== 'running'
  dom.stopBtn.disabled = pending || !running || packageRunning
  dom.resumeTaskBtn.disabled = pending || !resumeAvailable || running || packageRunning
}

function setButtonLoading(actionName, loading) {
  const button = ACTION_BUTTONS[actionName]
  if (!button) return
  if (!button.dataset.labelDefault) {
    button.dataset.labelDefault = button.textContent.trim()
  }
  const defaultLabel = button.dataset.labelDefault
  if (loading) {
    button.classList.add('is-loading')
    button.textContent = `${defaultLabel}...`
  } else {
    button.classList.remove('is-loading')
    button.textContent = defaultLabel
  }
}

async function withPendingAction(actionName, handler) {
  if (state.pendingAction) return
  state.pendingAction = actionName
  setButtonLoading(actionName, true)
  refreshButtons()
  try {
    return await handler()
  } finally {
    setButtonLoading(actionName, false)
    state.pendingAction = ''
    refreshButtons()
  }
}

function refreshProgress() {
  const taskState = state.taskState
  const liveDownloadChunk = state.liveChunks.find((item) => item.phase === 'download')
  const liveCountChunk = state.liveChunks.find((item) => item.phase === 'count')
  if (!taskState) {
    dom.taskStatusLabel.textContent = '空闲'
    dom.progressText.textContent = '尚未开始下载'
    dom.progressPercentText.textContent = '0.00000000%'
    dom.downloadedCountLabel.textContent = '0'
    dom.unavailableCountLabel.textContent = '0'
    dom.totalCountLabel.textContent = '0'
    dom.currentZoomLabel.textContent = '-'
    dom.retryCountLabel.textContent = '0'
    dom.activeRequestCountLabel.textContent = String(state.activeRequests)
    dom.downloadChunkLabel.textContent = '-'
    dom.countChunkLabel.textContent = '-'
    dom.progressBar.style.width = '0%'
    renderEventList([])
    return
  }
  const progress = taskState.progress || {}
  const downloadedTiles = Number(progress.downloadedTiles) || 0
  const unavailableTiles = Number(progress.unavailableTiles) || 0
  const handledTiles = Number(progress.handledTiles)
    || (downloadedTiles + unavailableTiles)
  const totalTiles = Number(progress.totalTiles) || 0
  const percent = totalTiles > 0 ? clamp((handledTiles / totalTiles) * 100, 0, 100) : 0

  dom.taskStatusLabel.textContent = taskState.status || '空闲'
  dom.progressText.textContent = `${taskState.status || 'idle'} | Z${taskState.range.startZoom}-${taskState.range.endZoom}`
  dom.progressPercentText.textContent = `${percent.toFixed(8)}%`
  dom.downloadedCountLabel.textContent = String(downloadedTiles)
  dom.unavailableCountLabel.textContent = String(unavailableTiles)
  dom.totalCountLabel.textContent = String(totalTiles)
  dom.currentZoomLabel.textContent = Number.isFinite(Number(taskState.currentZoom)) ? `Z${taskState.currentZoom}` : '-'
  dom.retryCountLabel.textContent = String(Number(progress.retryCount) || 0)
  dom.activeRequestCountLabel.textContent = String(state.activeRequests)
  dom.downloadChunkLabel.textContent = liveDownloadChunk
    ? `Z${liveDownloadChunk.zoom} ${liveDownloadChunk.downloaded}/${Math.max(Number(liveDownloadChunk.totalTiles || 0), Number(liveDownloadChunk.discovered || 0), Number(liveDownloadChunk.downloaded || 0))} (${liveDownloadChunk.xStart}-${liveDownloadChunk.xEnd})`
    : '-'
  dom.countChunkLabel.textContent = liveCountChunk
    ? `Z${liveCountChunk.zoom} ${liveCountChunk.discovered} (${liveCountChunk.xStart}-${liveCountChunk.xEnd})`
    : '-'
  dom.progressBar.style.width = `${percent}%`
  renderEventList(state.events)
}

function refreshSplitProgress() {
  const task = state.packageTask
  if (!task) {
    dom.splitProgressText.textContent = '尚未开始分包'
    dom.splitProgressPercentText.textContent = '0%'
    dom.splitPackageTotalLabel.textContent = '0'
    dom.splitPackageCompletedLabel.textContent = '0'
    dom.splitZipCompletedLabel.textContent = '0'
    dom.splitZipSkippedLabel.textContent = '0'
    dom.splitProcessedTileLabel.textContent = '0'
    dom.splitCopiedTileLabel.textContent = '0'
    dom.splitSkippedTileLabel.textContent = '0'
    dom.splitCurrentPackageLabel.textContent = '-'
    dom.splitProgressBar.style.width = '0%'
    return
  }

  const totalTiles = Number(task.totalTiles || 0)
  const processedTiles = Number(task.processedTiles || 0)
  const totalPackages = Number(task.totalPackages || 0)
  const zippedPackages = Number(task.zippedPackages || 0)
  const skippedZipPackages = Number(task.skippedZipPackages || 0)
  const zipHandledPackages = Number(task.completedPackages || 0)
  const phase = String(task.phase || '')
  const mode = String(task.mode || 'split')
  const tilePercent = totalTiles > 0 ? processedTiles / totalTiles : 0
  const zipPercent = totalPackages > 0 ? zipHandledPackages / totalPackages : 0
  let percent = 0

  if (mode === 'compress') {
    if (phase === 'scan-packages') {
      percent = 5
    } else if (phase === 'zipping') {
      percent = 10 + (zipPercent * 80)
    } else if (phase === 'bundling') {
      percent = 95
    } else if (phase === 'completed' || task.status === 'completed') {
      percent = 100
    } else if (phase === 'failed' || task.status === 'failed') {
      percent = clamp(zipPercent * 90, 0, 99)
    }
  } else if (phase === 'scan-kml') {
    percent = 2
  } else if (phase === 'scan-tiles') {
    percent = 8
  } else if (phase === 'copying') {
    percent = 10 + (tilePercent * 70)
  } else if (phase === 'zipping') {
    percent = 80 + (zipPercent * 15)
  } else if (phase === 'bundling') {
    percent = 95
  } else if (phase === 'completed' || task.status === 'completed') {
    percent = 100
  } else if (phase === 'failed' || task.status === 'failed') {
    percent = clamp((tilePercent * 70) + (zipPercent * 15), 0, 99)
  }

  dom.splitProgressText.textContent = `${task.status || 'idle'} | ${task.phaseLabel || task.phase || '等待中'}`
  dom.splitProgressPercentText.textContent = `${percent.toFixed(2).replace(/\.?0+$/, '')}%`
  dom.splitPackageTotalLabel.textContent = String(totalPackages)
  dom.splitPackageCompletedLabel.textContent = String(Number(task.completedPackages || 0))
  dom.splitZipCompletedLabel.textContent = String(zippedPackages)
  dom.splitZipSkippedLabel.textContent = String(skippedZipPackages)
  dom.splitProcessedTileLabel.textContent = String(processedTiles)
  dom.splitCopiedTileLabel.textContent = String(Number(task.copiedTiles || 0))
  dom.splitSkippedTileLabel.textContent = String(Number(task.skippedTiles || 0))
  dom.splitCurrentPackageLabel.textContent = task.currentPackageName || '-'
  dom.splitProgressBar.style.width = `${percent}%`
}

function parseRangeInputs() {
  let startZoom = Math.round(toNumber(dom.startZoomInput.value, 6))
  let endZoom = Math.round(toNumber(dom.endZoomInput.value, 18))
  startZoom = clamp(startZoom, WMS_MIN_ZOOM, WMS_MAX_ZOOM)
  endZoom = clamp(endZoom, WMS_MIN_ZOOM, WMS_MAX_ZOOM)
  if (startZoom > endZoom) [startZoom, endZoom] = [endZoom, startZoom]
  dom.startZoomInput.value = String(startZoom)
  dom.endZoomInput.value = String(endZoom)
  return { startZoom, endZoom }
}

function getConcurrency() {
  return Math.max(1, Math.floor(toNumber(dom.concurrencyInput.value, 4)))
}

function formatStagePercentLabel(rawValue) {
  const percent = clamp(Number(rawValue) / 100, 0, 100)
  return `${percent.toFixed(2).replace(/\.?0+$/, '')}%`
}

function syncHighZoomStageInputs(changedSide = '') {
  let start = clamp(Math.round(toNumber(dom.highZoomStageStartInput.value, 0)), 0, 10000)
  let end = clamp(Math.round(toNumber(dom.highZoomStageEndInput.value, 10000)), 0, 10000)
  if (changedSide === 'start' && start > end) {
    end = start
  } else if (changedSide === 'end' && end < start) {
    start = end
  } else if (start > end) {
    [start, end] = [end, start]
  }
  dom.highZoomStageStartInput.value = String(start)
  dom.highZoomStageEndInput.value = String(end)
  dom.highZoomStageStartLabel.textContent = formatStagePercentLabel(start)
  dom.highZoomStageEndLabel.textContent = formatStagePercentLabel(end)
  dom.highZoomStageSummaryLabel.textContent = `${formatStagePercentLabel(start)} - ${formatStagePercentLabel(end)}`
}

function getHighZoomStageRange() {
  syncHighZoomStageInputs()
  return {
    highZoomStageStartPercent: Number(dom.highZoomStageStartInput.value) / 100,
    highZoomStageEndPercent: Number(dom.highZoomStageEndInput.value) / 100,
  }
}

function shouldAutoShutdown() {
  return Boolean(dom.autoShutdownInput.checked)
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `请求失败：${response.status}`)
  }
  return payload.data
}

async function chooseDirectory({ title, initialPath } = {}) {
  const data = await requestJson('/api/dialog/select-directory', {
    method: 'POST',
    body: {
      title,
      initialPath,
    },
  })
  return String(data?.path || '').trim()
}

function formatSplitKmlSelectionLabel(files = []) {
  const normalizedFiles = Array.isArray(files) ? files : []
  if (!normalizedFiles.length) return ''
  const firstRelativePath = String(normalizedFiles[0]?.webkitRelativePath || normalizedFiles[0]?.relativePath || normalizedFiles[0]?.name || '')
  const rootName = firstRelativePath.split('/')[0] || firstRelativePath.split('\\')[0] || '已选目录'
  return `${rootName}（${normalizedFiles.length} 个 KML）`
}

function setSplitKmlSelection(files = []) {
  state.splitKmlFiles = Array.from(files || []).filter((file) => /\.kml$/i.test(file?.name || ''))
  state.splitKmlSelectionLabel = formatSplitKmlSelectionLabel(state.splitKmlFiles)
  dom.splitKmlRootInput.value = state.splitKmlSelectionLabel || ''
  refreshButtons()
}

async function serializeSelectedKmlFiles(files = []) {
  const normalizedFiles = Array.from(files || []).filter((file) => /\.kml$/i.test(file?.name || ''))
  return Promise.all(normalizedFiles.map(async (file) => ({
    name: String(file.name || ''),
    relativePath: String(file.webkitRelativePath || file.relativePath || file.name || ''),
    content: await file.text(),
  })))
}

function applySnapshot(snapshot, { syncAnchors = false } = {}) {
  if (!snapshot) return
  state.workspacePath = snapshot.workspacePath || ''
  state.taskState = snapshot.taskState || null
  state.activeRequests = Number(snapshot.activeRequests || 0)
  state.running = Boolean(snapshot.running)
  state.packageTask = snapshot.packageTask || null
  state.overlayRange = snapshot.overlay || state.overlayRange
  state.events = Array.isArray(snapshot.events) ? snapshot.events : []
  state.liveChunks = Array.isArray(snapshot.liveChunks) ? snapshot.liveChunks : []
  const stage = snapshot.taskState?.options?.highZoomStage || {}
  dom.highZoomStageStartInput.value = String(Math.round(toNumber(stage.startPercent, 0) * 100))
  dom.highZoomStageEndInput.value = String(Math.round(toNumber(stage.endPercent, 100) * 100))
  syncHighZoomStageInputs()
  dom.autoShutdownInput.checked = Boolean(snapshot.taskState?.options?.autoShutdown)
  dom.dirLabel.textContent = state.workspacePath || '未设置'
  dom.workspacePathInput.value = state.workspacePath || ''
  dom.splitKmlRootInput.value = snapshot.packageTask?.kmlRootPath || state.splitKmlSelectionLabel || ''
  dom.splitOutputPathInput.value = snapshot.packageTask?.outputPath || dom.splitOutputPathInput.value || snapshot.splitOutputDefaultPath || ''
  syncSavedPolygonsFromTask(state.taskState)
  if (syncAnchors) {
    const editablePolygon = normalizePolygonPoints(state.taskState?.polygon || state.taskState?.polygons?.[0] || [])
    if (editablePolygon.length) {
      restoreAnchorsFromModel(editablePolygon)
    }
  }
  state.overlayVersion += 1
  refreshProgress()
  refreshSplitProgress()
  refreshButtons()
  syncOfflineLayerForCurrentZoom()
}

function wsUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/ws`
}

function connectWebSocket() {
  if (state.ws) {
    state.ws.close()
  }
  const ws = new WebSocket(wsUrl())
  state.ws = ws
  ws.addEventListener('open', () => {
    setStatus('WebSocket 已连接，等待服务端推送任务状态。')
  })
  ws.addEventListener('message', (event) => {
    const payload = JSON.parse(event.data)
    if (payload.type === 'snapshot') {
      applySnapshot(payload.data)
    }
  })
  ws.addEventListener('close', () => {
    setStatus('WebSocket 已断开，正在重连。')
    if (state.reconnectTimer) clearTimeout(state.reconnectTimer)
    state.reconnectTimer = window.setTimeout(connectWebSocket, 1500)
  })
  ws.addEventListener('error', () => {
    ws.close()
  })
}

async function applyWorkspace() {
  return withPendingAction('applyWorkspace', async () => {
    setStatus('正在打开下载目录选择器...')
    const basePath = await chooseDirectory({
      title: '选择离线瓦片下载目录',
      initialPath: String(dom.workspacePathInput.value || state.workspacePath || '').trim(),
    })
    if (!basePath) {
      setStatus('已取消目录选择。')
      return
    }
    dom.workspacePathInput.value = basePath
    const data = await requestJson('/api/workspace', { method: 'POST', body: { basePath } })
    applySnapshot(data, { syncAnchors: true })
    setStatus(`服务端目录已应用：${data.workspacePath}`)
  })
}

async function pickSplitKmlDirectory() {
  dom.splitKmlDirectoryInput.click()
}

async function pickSplitPreviewKml() {
  dom.splitPreviewKmlInput.click()
}

async function pickSplitOutputDirectory() {
  return withPendingAction('browseSplitOutput', async () => {
    const selectedPath = await chooseDirectory({
      title: '选择分包输出目录',
      initialPath: String(dom.splitOutputPathInput.value || state.workspacePath || '').trim(),
    })
    if (!selectedPath) {
      setStatus('已取消输出目录选择。')
      return
    }
    dom.splitOutputPathInput.value = selectedPath
    refreshButtons()
    setStatus(`分包输出目录已选择：${selectedPath}`)
  })
}

async function reloadWorkspace() {
  return withPendingAction('reloadWorkspace', async () => {
    const data = await requestJson('/api/task/reload', { method: 'POST' })
    applySnapshot(data, { syncAnchors: true })
    setStatus('已从服务端重新读取任务目录。')
  })
}

async function resumeTask() {
  return withPendingAction('resumeTask', async () => {
    const stage = getHighZoomStageRange()
    const data = await requestJson('/api/task/resume', {
      method: 'POST',
      body: { concurrency: getConcurrency(), autoShutdown: shouldAutoShutdown(), ...stage },
    })
    applySnapshot(data)
    setStatus('已向服务端发送恢复任务请求。')
  })
}

async function pauseTask() {
  return withPendingAction('pauseTask', async () => {
    const data = await requestJson('/api/task/pause', { method: 'POST' })
    applySnapshot(data)
    setStatus('已向服务端发送暂停请求，正在保存当前 chunk 游标。')
  })
}

async function stopTask() {
  return withPendingAction('stopTask', async () => {
    const data = await requestJson('/api/task/stop', { method: 'POST' })
    applySnapshot(data)
    setStatus('已向服务端发送停止请求。')
  })
}

async function startSplitPackages() {
  return withPendingAction('startSplitPackages', async () => {
    if (!state.splitKmlFiles.length) {
      throw new Error('请先选择 KML 根目录')
    }
    const outputPath = String(dom.splitOutputPathInput.value || '').trim()
    const kmlFiles = await serializeSelectedKmlFiles(state.splitKmlFiles)
    const data = await requestJson('/api/task/split-packages', {
      method: 'POST',
      body: {
        kmlRootPath: state.splitKmlSelectionLabel || '浏览器已选目录',
        kmlFiles,
        outputPath,
      },
    })
    applySnapshot(data)
    setStatus('KML 分包任务已启动，进度将通过 WebSocket 实时更新。')
  })
}

async function startCompressPackages() {
  return withPendingAction('startCompressPackages', async () => {
    const outputPath = String(dom.splitOutputPathInput.value || '').trim()
    const data = await requestJson('/api/task/compress-packages', {
      method: 'POST',
      body: {
        outputPath,
      },
    })
    applySnapshot(data)
    setStatus('分包压缩任务已启动，进度将通过 WebSocket 实时更新。')
  })
}

async function startCurrentDownload() {
  return withPendingAction('startCurrentDownload', async () => {
    const stage = getHighZoomStageRange()
    const polygons = getTaskPolygons()
    const data = await requestJson('/api/task/current', {
      method: 'POST',
      body: {
        polygons,
        polygon: polygons[0] || [],
        zoom: currentMapZoom(),
        concurrency: getConcurrency(),
        autoShutdown: shouldAutoShutdown(),
        ...stage,
      },
    })
    applySnapshot(data)
    setStatus('已向服务端发送当前层级下载请求。')
  })
}

async function startRangeDownload() {
  return withPendingAction('startRangeDownload', async () => {
    const { startZoom, endZoom } = parseRangeInputs()
    const stage = getHighZoomStageRange()
    const polygons = getTaskPolygons()
    const data = await requestJson('/api/task/range', {
      method: 'POST',
      body: {
        polygons,
        polygon: polygons[0] || [],
        startZoom,
        endZoom,
        concurrency: getConcurrency(),
        autoShutdown: shouldAutoShutdown(),
        ...stage,
      },
    })
    applySnapshot(data)
    setStatus(`已向服务端发送范围下载请求：Z${startZoom}-Z${endZoom}。`)
  })
}

function saveCurrentPolygon() {
  const points = normalizePolygonPoints(getAnchorPoints())
  if (points.length < 3) {
    throw new Error('当前轮廓至少需要 3 个点才能保存')
  }
  const existing = state.savedPolygons.find((polygon) => polygon.id === state.selectedPolygonId)
  const defaultName = existing?.name || `轮廓 ${state.savedPolygons.length + 1}`
  const name = window.prompt('请输入轮廓名称', defaultName)
  if (name === null) return
  const entry = upsertSavedPolygon({
    id: existing?.id,
    name: name.trim() || defaultName,
    points,
  }, { select: true })
  if (!entry) return
  state.selectedPolygonId = entry.id
  renderPolygonLibrary()
  setStatus(`已保存轮廓：${entry.name}`)
}

function loadSavedPolygon(polygonId) {
  const polygon = state.savedPolygons.find((item) => item.id === polygonId)
  if (!polygon) return
  state.selectedPolygonId = polygon.id
  restoreAnchorsFromModel(polygon.points)
  state.selectedPolygonId = polygon.id
  renderPolygonLibrary()
  setStatus(`已加载轮廓：${polygon.name}`)
}

function deleteSavedPolygon(polygonId) {
  const polygon = state.savedPolygons.find((item) => item.id === polygonId)
  state.savedPolygons = state.savedPolygons.filter((item) => item.id !== polygonId)
  if (state.selectedPolygonId === polygonId) {
    state.selectedPolygonId = ''
  }
  renderPolygonLibrary()
  renderSavedPolygonOverlays()
  refreshButtons()
  setStatus(`已删除轮廓：${polygon?.name || polygonId}`)
}

async function loadInitialState() {
  const data = await requestJson('/api/state')
  if (data.workspacePath) {
    dom.workspacePathInput.value = data.workspacePath
  }
  applySnapshot(data, { syncAnchors: true })
}

async function loadTencentMap() {
  if (window.qq?.maps) return window.qq.maps
  throw new Error('腾讯地图脚本未加载，请检查网络或 index.html 中的脚本标签')
}

async function initMap() {
  await loadTencentMap()
  state.map = new window.qq.maps.Map(dom.map, {
    center: new window.qq.maps.LatLng(DEFAULT_CENTER.lat, DEFAULT_CENTER.lng),
    zoom: DEFAULT_ZOOM,
    mapTypeControl: true,
  })
  state.mapReady = true
  dom.zoomLabel.textContent = `Z${DEFAULT_ZOOM}`
  dom.mapStateLabel.textContent = '腾讯地图已加载'
  ensureOfflineMapType()
  renderSplitPreviewOverlays()

  window.qq.maps.event.addListener(state.map, 'click', (event) => {
    if (!state.drawMode) return
    const lat = Number(event?.latLng?.getLat?.())
    const lng = Number(event?.latLng?.getLng?.())
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
    addAnchor(lat, lng)
  })

  window.qq.maps.event.addListener(state.map, 'zoom_changed', () => {
    dom.zoomLabel.textContent = `Z${currentMapZoom()}`
    syncOfflineLayerForCurrentZoom()
  })

  refreshButtons()
}

function bindEvents() {
  dom.pickDirBtn.addEventListener('click', () => applyWorkspace().catch((error) => setStatus(error.message || String(error))))
  dom.reloadTaskBtn.addEventListener('click', () => reloadWorkspace().catch((error) => setStatus(error.message || String(error))))
  dom.loadSplitPreviewKmlBtn.addEventListener('click', () => pickSplitPreviewKml().catch((error) => setStatus(error.message || String(error))))
  dom.clearSplitPreviewKmlBtn.addEventListener('click', () => clearSplitPreview())
  dom.browseSplitKmlBtn.addEventListener('click', () => pickSplitKmlDirectory().catch((error) => setStatus(error.message || String(error))))
  dom.browseSplitOutputBtn.addEventListener('click', () => pickSplitOutputDirectory().catch((error) => setStatus(error.message || String(error))))
  dom.startSplitBtn.addEventListener('click', () => startSplitPackages().catch((error) => setStatus(error.message || String(error))))
  dom.startCompressBtn.addEventListener('click', () => startCompressPackages().catch((error) => setStatus(error.message || String(error))))
  dom.resumeTaskBtn.addEventListener('click', () => resumeTask().catch((error) => setStatus(error.message || String(error))))
  dom.pauseBtn.addEventListener('click', () => pauseTask().catch((error) => setStatus(error.message || String(error))))
  dom.highZoomStageStartInput.addEventListener('input', () => syncHighZoomStageInputs('start'))
  dom.highZoomStageEndInput.addEventListener('input', () => syncHighZoomStageInputs('end'))
  dom.stopBtn.addEventListener('click', () => stopTask().catch((error) => setStatus(error.message || String(error))))
  dom.startDrawBtn.addEventListener('click', () => setDrawMode(true))
  dom.finishDrawBtn.addEventListener('click', () => setDrawMode(false))
  dom.importKmlBtn.addEventListener('click', () => dom.importKmlInput.click())
  dom.importKmlBatchBtn.addEventListener('click', () => dom.importKmlBatchInput.click())
  dom.savePolygonBtn.addEventListener('click', () => {
    try {
      saveCurrentPolygon()
    } catch (error) {
      setStatus(error.message || String(error))
    }
  })
  dom.exportCurrentKmlBtn.addEventListener('click', () => {
    try {
      const selected = state.savedPolygons.find((polygon) => polygon.id === state.selectedPolygonId)
      exportPolygonAsKml(selected || { name: 'Current Polygon', points: getAnchorPoints() })
      setStatus('当前 KML 已导出。')
    } catch (error) {
      setStatus(error.message || String(error))
    }
  })
  dom.exportBatchKmlBtn.addEventListener('click', () => {
    try {
      exportBatchPolygons()
      setStatus('批量 KML 已导出。')
    } catch (error) {
      setStatus(error.message || String(error))
    }
  })
  dom.importKmlInput.addEventListener('change', async (event) => {
    try {
      await importKmlFiles(event.target.files)
    } catch (error) {
      setStatus(error.message || String(error))
    } finally {
      event.target.value = ''
    }
  })
  dom.importKmlBatchInput.addEventListener('change', async (event) => {
    try {
      await importKmlFiles(event.target.files)
    } catch (error) {
      setStatus(error.message || String(error))
    } finally {
      event.target.value = ''
    }
  })
  dom.splitKmlDirectoryInput.addEventListener('change', (event) => {
    try {
      setSplitKmlSelection(event.target.files)
      if (state.splitKmlFiles.length) {
        setStatus(`已选择 KML 目录：${state.splitKmlSelectionLabel}`)
      } else {
        setStatus('所选目录中没有找到 KML 文件。')
      }
    } finally {
      event.target.value = ''
    }
  })
  dom.splitPreviewKmlInput.addEventListener('change', async (event) => {
    try {
      await loadSplitPreviewKml(event.target.files?.[0])
    } catch (error) {
      setStatus(error.message || String(error))
    } finally {
      event.target.value = ''
    }
  })
  dom.polygonLibraryList?.addEventListener('click', (event) => {
    const action = event.target?.dataset?.action
    const polygonId = event.target?.dataset?.id
    if (!action || !polygonId) return
    if (action === 'load') {
      loadSavedPolygon(polygonId)
      return
    }
    if (action === 'export') {
      const polygon = state.savedPolygons.find((item) => item.id === polygonId)
      if (!polygon) return
      exportPolygonAsKml(polygon)
      setStatus(`已导出轮廓：${polygon.name}`)
      return
    }
    if (action === 'delete') {
      deleteSavedPolygon(polygonId)
    }
  })
  dom.undoAnchorBtn.addEventListener('click', () => {
    const marker = state.anchorMarkers[state.anchorMarkers.length - 1]
    if (marker) removeAnchorMarker(marker)
  })
  dom.clearAnchorsBtn.addEventListener('click', clearAllAnchors)
  dom.downloadCurrentBtn.addEventListener('click', () => startCurrentDownload().catch((error) => setStatus(error.message || String(error))))
  dom.downloadRangeBtn.addEventListener('click', () => startRangeDownload().catch((error) => setStatus(error.message || String(error))))
}

async function bootstrap() {
  dom.drawModeLabel.textContent = '未开始'
  dom.zoomLabel.textContent = `Z${DEFAULT_ZOOM}`
  renderAnchorList([])
  renderPolygonLibrary()
  renderEventList([])
  updateSplitPreviewLabel()
  syncHighZoomStageInputs()
  refreshProgress()
  refreshSplitProgress()
  refreshButtons()

  if (window.location.protocol === 'file:') {
    dom.mapStateLabel.textContent = '请通过 Node 服务访问'
    setStatus('当前页面是通过 file:// 打开的。请先运行 `npm run offline-tile-server`，再访问 http://127.0.0.1:7060')
    bindEvents()
    return
  }

  try {
    await initMap()
    await loadInitialState()
    connectWebSocket()
    setStatus('腾讯地图和服务端连接已初始化，可以开始描点。')
  } catch (error) {
    dom.mapStateLabel.textContent = '初始化失败'
    setStatus(error.message || String(error))
  }

  bindEvents()
}

bootstrap()
