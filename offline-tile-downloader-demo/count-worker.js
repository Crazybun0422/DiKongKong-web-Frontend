import { parentPort, workerData } from 'node:worker_threads'

const EPSILON = Number(workerData?.constants?.EPSILON || 1e-10)
const COUNT_PROGRESS_STEP = Math.max(1, Number(workerData?.constants?.COUNT_PROGRESS_STEP || 100000))
const CHUNK_PROGRESS_STEP = 2048
const HIGH_ZOOM_STAGE_MIN_ZOOM = Number(workerData?.constants?.HIGH_ZOOM_STAGE_MIN_ZOOM || 15)
const STAGE_BUCKET_SCALE = Number(workerData?.constants?.STAGE_BUCKET_SCALE || 10000)
const descriptorMap = workerData?.descriptorMap || {}
const taskOptions = workerData?.options || {}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function normalizeStagePercent(value, fallback) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return clamp(num, 0, 100)
}

function stagePercentToBucket(percent, fallback) {
  const normalized = normalizeStagePercent(percent, fallback)
  return clamp(Math.round(normalized * 100), 0, STAGE_BUCKET_SCALE)
}

function normalizeTaskOptions(options = {}) {
  let startPercent = normalizeStagePercent(options?.highZoomStageStartPercent ?? options?.highZoomStage?.startPercent, 0)
  let endPercent = normalizeStagePercent(options?.highZoomStageEndPercent ?? options?.highZoomStage?.endPercent, 100)
  if (startPercent > endPercent) {
    [startPercent, endPercent] = [endPercent, startPercent]
  }
  return {
    highZoomStage: {
      minZoom: HIGH_ZOOM_STAGE_MIN_ZOOM,
      startPercent,
      endPercent,
    },
  }
}

function tileStageBucket(zoom, x, y) {
  let hash = (Math.imul(Number(zoom) || 0, 73856093)
    ^ Math.imul(Number(x) || 0, 19349663)
    ^ Math.imul(Number(y) || 0, 83492791)) >>> 0
  hash ^= hash >>> 16
  return hash % STAGE_BUCKET_SCALE
}

function tileSelectedForTask(zoom, x, y, options = {}) {
  const normalized = normalizeTaskOptions(options)
  const stage = normalized.highZoomStage
  if (Number(zoom) < Number(stage.minZoom || HIGH_ZOOM_STAGE_MIN_ZOOM)) {
    return true
  }
  const startBucket = stagePercentToBucket(stage.startPercent, 0)
  const endBucket = stagePercentToBucket(stage.endPercent, 100)
  if (startBucket <= 0 && endBucket >= STAGE_BUCKET_SCALE) {
    return true
  }
  if (startBucket === endBucket) {
    return false
  }
  const bucket = tileStageBucket(zoom, x, y)
  return bucket >= startBucket && bucket < endBucket
}

function outOfChina(lat, lng) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI)) + (20.0 * Math.sin(2.0 * x * Math.PI))) * 2.0 / 3.0
  ret += ((20.0 * Math.sin(y * Math.PI)) + (40.0 * Math.sin(y / 3.0 * Math.PI))) * 2.0 / 3.0
  ret += ((160.0 * Math.sin(y / 12.0 * Math.PI)) + (320 * Math.sin(y * Math.PI / 30.0))) * 2.0 / 3.0
  return ret
}

function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI)) + (20.0 * Math.sin(2.0 * x * Math.PI))) * 2.0 / 3.0
  ret += ((20.0 * Math.sin(x * Math.PI)) + (40.0 * Math.sin(x / 3.0 * Math.PI))) * 2.0 / 3.0
  ret += ((150.0 * Math.sin(x / 12.0 * Math.PI)) + (300.0 * Math.sin(x / 30.0 * Math.PI))) * 2.0 / 3.0
  return ret
}

function wgs84ToGcj02(lng, lat) {
  const longitude = Number(lng)
  const latitude = Number(lat)
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return { lng: longitude, lat: latitude }
  if (outOfChina(latitude, longitude)) return { lng: longitude, lat: latitude }
  const a = 6378245.0
  const ee = 0.00669342162296594323
  let dLat = transformLat(longitude - 105.0, latitude - 35.0)
  let dLng = transformLng(longitude - 105.0, latitude - 35.0)
  const radLat = latitude / 180.0 * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI)
  dLng = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI)
  return { lng: longitude + dLng, lat: latitude + dLat }
}

function tileXYToBBOX3857(x, y, z) {
  const tileSize = 256
  const radius = 6378137
  const originShift = Math.PI * radius
  const resolution = (2 * originShift) / (tileSize * Math.pow(2, z))
  const minx = x * tileSize * resolution - originShift
  const maxx = (x + 1) * tileSize * resolution - originShift
  const maxy = originShift - y * tileSize * resolution
  const miny = originShift - (y + 1) * tileSize * resolution
  return [Number(minx.toFixed(6)), Number(miny.toFixed(6)), Number(maxx.toFixed(6)), Number(maxy.toFixed(6))]
}

function mercatorToLonLat(x, y) {
  const lng = (x / (Math.PI * 6378137)) * 180.0
  const lat = ((2 * Math.atan(Math.exp(y / 6378137)) - Math.PI / 2) * 180.0) / Math.PI
  return { lng, lat }
}

function lonLatToMercator(lng, lat) {
  const originShift = Math.PI * 6378137
  const x = (lng * originShift) / 180.0
  const y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360.0)) * 6378137
  return { x, y }
}

function buildTileRequestBBox(x, y, zoom) {
  const bbox = tileXYToBBOX3857(x, y, zoom)
  const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
  const centerLonLat = mercatorToLonLat(center[0], center[1])
  const gcjCenter = wgs84ToGcj02(centerLonLat.lng, centerLonLat.lat)
  const mercatorWgs = lonLatToMercator(centerLonLat.lng, centerLonLat.lat)
  const mercatorGcj = lonLatToMercator(gcjCenter.lng, gcjCenter.lat)
  const dx = mercatorGcj.x - mercatorWgs.x
  const dy = mercatorGcj.y - mercatorWgs.y
  return [bbox[0] - dx, bbox[1] - dy, bbox[2] - dx, bbox[3] - dy]
}

function buildTileBounds(x, y, zoom) {
  const requestBBox = buildTileRequestBBox(x, y, zoom)
  const wgsSW = mercatorToLonLat(requestBBox[0], requestBBox[1])
  const wgsNE = mercatorToLonLat(requestBBox[2], requestBBox[3])
  const gcjSW = wgs84ToGcj02(wgsSW.lng, wgsSW.lat)
  const gcjNE = wgs84ToGcj02(wgsNE.lng, wgsNE.lat)
  return {
    southwest: { longitude: gcjSW.lng, latitude: gcjSW.lat },
    northeast: { longitude: gcjNE.lng, latitude: gcjNE.lat },
  }
}

function pointInRect(point, rect) {
  return point.longitude >= rect.minLng - EPSILON
    && point.longitude <= rect.maxLng + EPSILON
    && point.latitude >= rect.minLat - EPSILON
    && point.latitude <= rect.maxLat + EPSILON
}

function onSegment(a, b, p) {
  return Math.min(a.longitude, b.longitude) - EPSILON <= p.longitude
    && p.longitude <= Math.max(a.longitude, b.longitude) + EPSILON
    && Math.min(a.latitude, b.latitude) - EPSILON <= p.latitude
    && p.latitude <= Math.max(a.latitude, b.latitude) + EPSILON
    && Math.abs((b.longitude - a.longitude) * (p.latitude - a.latitude) - (b.latitude - a.latitude) * (p.longitude - a.longitude)) <= EPSILON
}

function orientation(a, b, c) {
  return (b.longitude - a.longitude) * (c.latitude - a.latitude) - (b.latitude - a.latitude) * (c.longitude - a.longitude)
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)

  if (((o1 > EPSILON && o2 < -EPSILON) || (o1 < -EPSILON && o2 > EPSILON))
    && ((o3 > EPSILON && o4 < -EPSILON) || (o3 < -EPSILON && o4 > EPSILON))) {
    return true
  }
  if (Math.abs(o1) <= EPSILON && onSegment(a, b, c)) return true
  if (Math.abs(o2) <= EPSILON && onSegment(a, b, d)) return true
  if (Math.abs(o3) <= EPSILON && onSegment(c, d, a)) return true
  if (Math.abs(o4) <= EPSILON && onSegment(c, d, b)) return true
  return false
}

function pointInPolygon(point, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i]
    const pj = polygon[j]
    if (onSegment(pj, pi, point)) return true
    const crosses = (pi.latitude > point.latitude) !== (pj.latitude > point.latitude)
    if (!crosses) continue
    const slope = (pj.longitude - pi.longitude) / ((pj.latitude - pi.latitude) || EPSILON)
    const xAtY = slope * (point.latitude - pi.latitude) + pi.longitude
    if (point.longitude < xAtY) inside = !inside
  }
  return inside
}

function polygonIntersectsRect(polygon, rectCorners) {
  const rect = {
    minLng: Math.min(...rectCorners.map((point) => point.longitude)),
    maxLng: Math.max(...rectCorners.map((point) => point.longitude)),
    minLat: Math.min(...rectCorners.map((point) => point.latitude)),
    maxLat: Math.max(...rectCorners.map((point) => point.latitude)),
  }

  if (polygon.some((point) => pointInRect(point, rect))) return true
  if (rectCorners.some((point) => pointInPolygon(point, polygon))) return true
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    for (let j = 0; j < rectCorners.length; j += 1) {
      const c = rectCorners[j]
      const d = rectCorners[(j + 1) % rectCorners.length]
      if (segmentsIntersect(a, b, c, d)) return true
    }
  }
  return false
}

function tileIntersectsPolygon(x, y, zoom, polygon) {
  const bounds = buildTileBounds(x, y, zoom)
  const sw = bounds.southwest
  const ne = bounds.northeast
  const rectCorners = [
    { longitude: sw.longitude, latitude: sw.latitude },
    { longitude: ne.longitude, latitude: sw.latitude },
    { longitude: ne.longitude, latitude: ne.latitude },
    { longitude: sw.longitude, latitude: ne.latitude },
  ]
  return polygonIntersectsRect(polygon, rectCorners)
}

function tileIntersectsAnyPolygon(x, y, zoom, polygons = []) {
  return (Array.isArray(polygons) ? polygons : []).some((polygon) => Array.isArray(polygon) && polygon.length >= 3 && tileIntersectsPolygon(x, y, zoom, polygon))
}

function postChunkProgress(record) {
  parentPort.postMessage({
    type: 'chunk-progress',
    record,
  })
}

function postChunkCount(record) {
  parentPort.postMessage({
    type: 'chunk-count',
    record,
  })
}

async function run() {
  let totalDiscovered = 0
  let lastProgressAt = 0
  const zooms = Object.keys(descriptorMap).map(Number).filter(Number.isFinite).sort((a, b) => a - b)

  for (const zoom of zooms) {
    const descriptors = Array.isArray(descriptorMap[String(zoom)]) ? descriptorMap[String(zoom)] : []
    for (const descriptor of descriptors) {
      let discovered = 0
      let lastChunkProgress = 0
      for (let x = Number(descriptor.xStart); x <= Number(descriptor.xEnd); x += 1) {
        for (let y = Number(descriptor.yStart); y <= Number(descriptor.yEnd); y += 1) {
          if (!tileIntersectsAnyPolygon(x, y, zoom, descriptor.polygons || [descriptor.polygon])) continue
          if (!tileSelectedForTask(zoom, x, y, taskOptions)) continue
          discovered += 1
          totalDiscovered += 1
          if (discovered - lastChunkProgress >= CHUNK_PROGRESS_STEP) {
            lastChunkProgress = discovered
            postChunkProgress({
              key: descriptor.key,
              zoom,
              xStart: descriptor.xStart,
              xEnd: descriptor.xEnd,
              yStart: descriptor.yStart,
              yEnd: descriptor.yEnd,
              discovered,
            })
          }
          if (totalDiscovered - lastProgressAt >= COUNT_PROGRESS_STEP) {
            lastProgressAt = totalDiscovered
            parentPort.postMessage({
              type: 'progress',
              totalDiscovered,
            })
          }
        }
      }
      postChunkCount({
        key: descriptor.key,
        zoom,
        xStart: descriptor.xStart,
        xEnd: descriptor.xEnd,
        yStart: descriptor.yStart,
        yEnd: descriptor.yEnd,
        status: 'counted',
        attempted: discovered,
        discovered,
        downloaded: 0,
      })
    }
  }

  parentPort.postMessage({
    type: 'done',
    totalDiscovered,
  })
}

run().catch((error) => {
  throw error
})
