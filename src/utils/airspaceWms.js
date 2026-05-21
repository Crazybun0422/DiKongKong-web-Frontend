import { tileXYToBBOX3857, mercatorToLonLat, wgs84ToGcj02, lonLatToMercator, gcj02ToWgs84 } from './coords'
import chinaProvinceGeoJsonRaw from '../map-meta-data/China.geojson?raw'
import { buildProvinceLayerParams, buildProvinceLayerRecords } from './uomProvinceSelector'

const WMS_MIN_ZOOM = 5
const WMS_MAX_ZOOM = 18
const CAAC_TOKEN = 'c5771c6e-1f11-4955-8397-6986b70e05ee'
const CAAC_BASE = 'https://uom.caac.gov.cn/map/airspace/wms'
const EPSILON = 1e-10
const PROVINCE_LAYER_RECORDS = buildProvinceLayerRecords(JSON.parse(chinaProvinceGeoJsonRaw))
const TILE_LAYER_PARAM_CACHE = new Map()

const lonLatToTile = (lng, lat, zoom) => {
  const scale = Math.pow(2, zoom)
  const x = Math.floor(((lng + 180) / 360) * scale)
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const y = Math.floor((0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale)
  return { x, y }
}

const clampTileIndex = (value, zoom) => {
  const scale = Math.pow(2, zoom)
  const max = Math.max(0, scale - 1)
  return Math.max(0, Math.min(max, value))
}

const toQuery = (params) =>
  Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&')

const getTileLayerParams = (cacheKey, bbox) => {
  if (cacheKey && TILE_LAYER_PARAM_CACHE.has(cacheKey)) {
    return TILE_LAYER_PARAM_CACHE.get(cacheKey)
  }
  const params = buildProvinceLayerParams(PROVINCE_LAYER_RECORDS, bbox)
  if (cacheKey) TILE_LAYER_PARAM_CACHE.set(cacheKey, params)
  return params
}

const buildTileRequestBBox = (x, y, zoom) => {
  const bbox = tileXYToBBOX3857(x, y, zoom)
  const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
  const centerLL = mercatorToLonLat(center[0], center[1])
  const gcjLL = wgs84ToGcj02(centerLL.lng, centerLL.lat)
  const mWgs = lonLatToMercator(centerLL.lng, centerLL.lat)
  const mGcj = gcjLL ? lonLatToMercator(gcjLL.lng, gcjLL.lat) : mWgs
  const dx = mGcj.x - mWgs.x
  const dy = mGcj.y - mWgs.y
  return [bbox[0] - dx, bbox[1] - dy, bbox[2] - dx, bbox[3] - dy]
}

const buildWmsTileEntry = (x, y, zoom) => {
  const reqBBox = buildTileRequestBBox(x, y, zoom)
  const wgsSW = mercatorToLonLat(reqBBox[0], reqBBox[1])
  const wgsNE = mercatorToLonLat(reqBBox[2], reqBBox[3])
  const gcjSWRaw = wgs84ToGcj02(wgsSW.lng, wgsSW.lat)
  const gcjNERaw = wgs84ToGcj02(wgsNE.lng, wgsNE.lat)
  const gcjSW = gcjSWRaw || { lng: wgsSW.lng, lat: wgsSW.lat }
  const gcjNE = gcjNERaw || { lng: wgsNE.lng, lat: wgsNE.lat }
  const bounds = {
    southwest: { longitude: gcjSW.lng, latitude: gcjSW.lat },
    northeast: { longitude: gcjNE.lng, latitude: gcjNE.lat },
  }
  const { layers, styles, provinceCodes } = getTileLayerParams(`${zoom}-${x}-${y}`, bounds)
  if (!layers || !styles || !provinceCodes.length) return null
  const q = toQuery({
    token: CAAC_TOKEN,
    service: 'WMS',
    request: 'GetMap',
    layers,
    styles,
    format: 'image/png8',
    transparent: 'true',
    version: '1.1.0',
    srs: 'EPSG:3857',
    width: '256',
    height: '256',
    bbox: reqBBox.join(','),
  })
  const directUrl = `${CAAC_BASE}?${q}`

  return {
    id: `${zoom}-${x}-${y}`,
    src: directUrl,
    x,
    y,
    zoom,
    bounds,
    provinceCodes,
    alpha: 0.65,
    opacity: 0.65,
    zIndex: 1,
  }
}

const normalizeGcjPoint = (point) => {
  const latitude = Number(point?.latitude ?? point?.lat)
  const longitude = Number(point?.longitude ?? point?.lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
}

const pointInRect = (point, rect) =>
  point.longitude >= rect.minLng - EPSILON
  && point.longitude <= rect.maxLng + EPSILON
  && point.latitude >= rect.minLat - EPSILON
  && point.latitude <= rect.maxLat + EPSILON

const onSegment = (a, b, p) =>
  Math.min(a.longitude, b.longitude) - EPSILON <= p.longitude
  && p.longitude <= Math.max(a.longitude, b.longitude) + EPSILON
  && Math.min(a.latitude, b.latitude) - EPSILON <= p.latitude
  && p.latitude <= Math.max(a.latitude, b.latitude) + EPSILON
  && Math.abs(
    (b.longitude - a.longitude) * (p.latitude - a.latitude)
      - (b.latitude - a.latitude) * (p.longitude - a.longitude),
  ) <= EPSILON

const orientation = (a, b, c) =>
  (b.longitude - a.longitude) * (c.latitude - a.latitude)
  - (b.latitude - a.latitude) * (c.longitude - a.longitude)

const segmentsIntersect = (a, b, c, d) => {
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)

  if ((o1 > EPSILON && o2 < -EPSILON || o1 < -EPSILON && o2 > EPSILON)
    && (o3 > EPSILON && o4 < -EPSILON || o3 < -EPSILON && o4 > EPSILON)) {
    return true
  }
  if (Math.abs(o1) <= EPSILON && onSegment(a, b, c)) return true
  if (Math.abs(o2) <= EPSILON && onSegment(a, b, d)) return true
  if (Math.abs(o3) <= EPSILON && onSegment(c, d, a)) return true
  if (Math.abs(o4) <= EPSILON && onSegment(c, d, b)) return true
  return false
}

const pointInPolygon = (point, polygon) => {
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

const polygonIntersectsRect = (polygon, rectCorners) => {
  const rect = {
    minLng: Math.min(...rectCorners.map((p) => p.longitude)),
    maxLng: Math.max(...rectCorners.map((p) => p.longitude)),
    minLat: Math.min(...rectCorners.map((p) => p.latitude)),
    maxLat: Math.max(...rectCorners.map((p) => p.latitude)),
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

const tileIntersectsPolygon = (tile, polygon) => {
  const sw = tile?.bounds?.southwest
  const ne = tile?.bounds?.northeast
  if (!sw || !ne) return false
  const rectCorners = [
    { longitude: sw.longitude, latitude: sw.latitude },
    { longitude: ne.longitude, latitude: sw.latitude },
    { longitude: ne.longitude, latitude: ne.latitude },
    { longitude: sw.longitude, latitude: ne.latitude },
  ]
  return polygonIntersectsRect(polygon, rectCorners)
}

export const createWmsMapType = (qqGlobal) => {
  if (!qqGlobal?.maps?.ImageMapType || !qqGlobal?.maps?.Size) return null
  return new qqGlobal.maps.ImageMapType({
    name: 'UOM',
    tileSize: new qqGlobal.maps.Size(256, 256),
    isPng: true,
    getTileUrl: (tileCoord, zoom) => {
      const { x, y } = tileCoord
      if (zoom < WMS_MIN_ZOOM || zoom > WMS_MAX_ZOOM) return ''
      const reqBBox = buildTileRequestBBox(x, y, zoom)
      const wgsSW = mercatorToLonLat(reqBBox[0], reqBBox[1])
      const wgsNE = mercatorToLonLat(reqBBox[2], reqBBox[3])
      const gcjSW = wgs84ToGcj02(wgsSW.lng, wgsSW.lat) || { lng: wgsSW.lng, lat: wgsSW.lat }
      const gcjNE = wgs84ToGcj02(wgsNE.lng, wgsNE.lat) || { lng: wgsNE.lng, lat: wgsNE.lat }
      const { layers, styles } = getTileLayerParams(`${zoom}-${x}-${y}`, {
        southwest: { longitude: gcjSW.lng, latitude: gcjSW.lat },
        northeast: { longitude: gcjNE.lng, latitude: gcjNE.lat },
      })
      if (!layers || !styles) return ''
      const params = new URLSearchParams({
        token: CAAC_TOKEN,
        service: 'WMS',
        request: 'GetMap',
        layers,
        styles,
        format: 'image/png8',
        transparent: 'true',
        version: '1.1.0',
        srs: 'EPSG:3857',
        width: '256',
        height: '256',
        bbox: reqBBox.join(','),
      })
      const directUrl = `${CAAC_BASE}?${params.toString()}`
      return directUrl
    },
  })
}

export const buildWmsOverlay = (center, zoom, region) => {
  if (!center || zoom < WMS_MIN_ZOOM || zoom > WMS_MAX_ZOOM) return []

  const tiles = []

  let xMin
  let xMax
  let yMin
  let yMax

  if (region?.northeast && region?.southwest) {
    const { northeast: ne, southwest: sw } = region
    const wgsNE = gcj02ToWgs84(ne.longitude, ne.latitude)
    const wgsSW = gcj02ToWgs84(sw.longitude, sw.latitude)
    const tNE = lonLatToTile(wgsNE.lng, wgsNE.lat, zoom)
    const tSW = lonLatToTile(wgsSW.lng, wgsSW.lat, zoom)
    xMin = Math.min(tNE.x, tSW.x)
    xMax = Math.max(tNE.x, tSW.x)
    yMin = Math.min(tNE.y, tSW.y)
    yMax = Math.max(tNE.y, tSW.y)
    if (xMax - xMin > 6) xMax = xMin + 6
    if (yMax - yMin > 6) yMax = yMin + 6
  } else {
    const wgsCenter = gcj02ToWgs84(center.longitude, center.latitude)
    const t = lonLatToTile(wgsCenter.lng, wgsCenter.lat, zoom)
    xMin = t.x - 1
    xMax = t.x + 1
    yMin = t.y - 1
    yMax = t.y + 1
  }

  xMin = clampTileIndex(xMin, zoom)
  xMax = clampTileIndex(xMax, zoom)
  yMin = clampTileIndex(yMin, zoom)
  yMax = clampTileIndex(yMax, zoom)

  for (let x = xMin; x <= xMax; x += 1) {
    for (let y = yMin; y <= yMax; y += 1) {
      const tile = buildWmsTileEntry(x, y, zoom)
      if (tile) tiles.push(tile)
    }
  }

  return tiles
}

export const buildWmsTilesForGcjPolygon = (polygon, zoom, { maxTiles = Number.POSITIVE_INFINITY } = {}) => {
  if (!Array.isArray(polygon) || polygon.length < 3) return { tiles: [], truncated: false }
  if (zoom < WMS_MIN_ZOOM || zoom > WMS_MAX_ZOOM) return { tiles: [], truncated: false }

  const normalized = polygon.map(normalizeGcjPoint).filter(Boolean)
  if (normalized.length < 3) return { tiles: [], truncated: false }
  const first = normalized[0]
  const last = normalized[normalized.length - 1]
  if (
    normalized.length > 3
    && Math.abs(first.latitude - last.latitude) <= EPSILON
    && Math.abs(first.longitude - last.longitude) <= EPSILON
  ) {
    normalized.pop()
  }
  if (normalized.length < 3) return { tiles: [], truncated: false }

  const wgsPoints = normalized.map((point) => {
    const converted = gcj02ToWgs84(point.longitude, point.latitude)
    return {
      longitude: converted?.lng ?? point.longitude,
      latitude: converted?.lat ?? point.latitude,
    }
  })

  const lngs = wgsPoints.map((point) => point.longitude)
  const lats = wgsPoints.map((point) => point.latitude)
  const west = Math.min(...lngs)
  const east = Math.max(...lngs)
  const north = Math.max(...lats)
  const south = Math.min(...lats)

  const tileNW = lonLatToTile(west, north, zoom)
  const tileSE = lonLatToTile(east, south, zoom)
  let xMin = clampTileIndex(Math.min(tileNW.x, tileSE.x), zoom)
  let xMax = clampTileIndex(Math.max(tileNW.x, tileSE.x), zoom)
  let yMin = clampTileIndex(Math.min(tileNW.y, tileSE.y), zoom)
  let yMax = clampTileIndex(Math.max(tileNW.y, tileSE.y), zoom)

  if (xMin > xMax) [xMin, xMax] = [xMax, xMin]
  if (yMin > yMax) [yMin, yMax] = [yMax, yMin]

  const safeMaxTiles = Number.isFinite(maxTiles) && maxTiles > 0 ? Math.floor(maxTiles) : Number.POSITIVE_INFINITY
  const tiles = []
  let truncated = false

  outer: for (let x = xMin; x <= xMax; x += 1) {
    for (let y = yMin; y <= yMax; y += 1) {
      if (Number.isFinite(safeMaxTiles) && tiles.length >= safeMaxTiles) {
        truncated = true
        break outer
      }
      const tile = buildWmsTileEntry(x, y, zoom)
      if (tile && tileIntersectsPolygon(tile, normalized)) {
        tiles.push(tile)
      }
    }
  }

  return {
    tiles,
    truncated,
    range: { xMin, xMax, yMin, yMax },
  }
}

export { WMS_MIN_ZOOM, WMS_MAX_ZOOM }

export default {
  buildWmsOverlay,
  buildWmsTilesForGcjPolygon,
  createWmsMapType,
  WMS_MIN_ZOOM,
  WMS_MAX_ZOOM,
}
