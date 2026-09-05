import http from '../services/http'
import chinaProvinceGeoJsonRaw from '../map-meta-data/China.geojson?raw'
import { wgs84ToGcj02 } from './coords'
import { buildProvinceLayerRecords, findProvinceLayerRecordForPoint } from './uomProvinceSelector'

export const UOM_KML_MIN_ZOOM = 14
export const UOM_KML_TILE_QUERY_LIMIT = 48
export const UOM3_SAFE_STATUS_TEXT = '\u9002\u98de\u7a7a\u57df\uff08\u9650\u9ad8120m\uff09'
export const UOM3_NON_RESTRICTED_STATUS_TEXT = '\u975e\u7ba1\u5236\u533a\u57df'
export const UOM3_RESTRICTED_STATUS_TEXT = '\u7ba1\u5236\u7a7a\u57df'
export const UOM3_PENDING_STATUS_TEXT = '\u8bc4\u4f30\u4e2d'

const DEFAULT_KML_COLOR = '66f4f401'
const KML_ALPHA_FACTOR = 0.7
const SPECIAL_REGION_CODE_SET = new Set(['71', '81', '82'])
const UOM_REGION_RECORDS = buildProvinceLayerRecords(JSON.parse(chinaProvinceGeoJsonRaw), { includeSpecialRegions: true })

const outOfChina = (longitude, latitude) =>
  longitude < 72.004 || longitude > 137.8347 || latitude < 0.8293 || latitude > 55.8271

const resolveExcludedRegionRecord = (point) => {
  const record = findProvinceLayerRecordForPoint(UOM_REGION_RECORDS, point)
  return record && SPECIAL_REGION_CODE_SET.has(record.provinceCode) ? record : null
}

const normalizeRegionBounds = (region = null) => {
  const northeast = region?.northeast || null
  const southwest = region?.southwest || null
  const neLng = Number(northeast?.longitude)
  const neLat = Number(northeast?.latitude)
  const swLng = Number(southwest?.longitude)
  const swLat = Number(southwest?.latitude)
  if (![neLng, neLat, swLng, swLat].every(Number.isFinite)) return null
  return {
    minLng: Math.min(neLng, swLng),
    maxLng: Math.max(neLng, swLng),
    minLat: Math.min(neLat, swLat),
    maxLat: Math.max(neLat, swLat),
  }
}

const expandBounds = (bounds = null, ratio = 0.6) => {
  if (!bounds) return null
  const lngSpan = Math.max(1e-6, bounds.maxLng - bounds.minLng)
  const latSpan = Math.max(1e-6, bounds.maxLat - bounds.minLat)
  const expandLng = lngSpan * Math.max(0, Number(ratio) || 0)
  const expandLat = latSpan * Math.max(0, Number(ratio) || 0)
  return {
    minLng: Math.max(-180, bounds.minLng - expandLng),
    maxLng: Math.min(180, bounds.maxLng + expandLng),
    minLat: Math.max(-90, bounds.minLat - expandLat),
    maxLat: Math.min(90, bounds.maxLat + expandLat),
  }
}

const normalizeKmlHexColor = (value = '') => {
  const raw = `${value || ''}`.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{8}$/.test(raw)) return raw.toLowerCase()
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `ff${raw.toLowerCase()}`
  return ''
}

const kmlColorAlpha = (value = '') => {
  const normalized = normalizeKmlHexColor(value)
  if (!normalized) return 0
  return parseInt(normalized.slice(0, 2), 16) || 0
}

const kmlColorToRgbaHex = (value = '') => {
  const normalized = normalizeKmlHexColor(value) || DEFAULT_KML_COLOR
  const rawAlpha = parseInt(normalized.slice(0, 2), 16) || 0
  const alpha = Math.max(0, Math.min(255, Math.round(rawAlpha * KML_ALPHA_FACTOR)))
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()
  const blue = normalized.slice(2, 4)
  const green = normalized.slice(4, 6)
  const red = normalized.slice(6, 8)
  return `#${red}${green}${blue}${alpha}`.toUpperCase()
}

const extractTagText = (xml = '', tagName = '') => {
  if (!xml || !tagName) return ''
  const match = xml.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
  return (match?.[1] || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim()
}

const mergeStyle = (base = null, extra = null) =>
  Object.assign(
    {
      lineColor: '',
      lineWidth: 1,
      polyColor: '',
      fillEnabled: true,
      outlineEnabled: true,
    },
    base || {},
    extra || {},
  )

const parseStyleBlock = (styleText = '') => {
  const lineStyleText = extractTagText(styleText, 'LineStyle')
  const polyStyleText = extractTagText(styleText, 'PolyStyle')
  const width = Number(extractTagText(lineStyleText, 'width'))
  const fillText = extractTagText(polyStyleText, 'fill')
  const outlineText = extractTagText(polyStyleText, 'outline')
  return mergeStyle(null, {
    lineColor: normalizeKmlHexColor(extractTagText(lineStyleText, 'color')),
    lineWidth: Number.isFinite(width) && width > 0 ? width : 1,
    polyColor: normalizeKmlHexColor(extractTagText(polyStyleText, 'color')),
    fillEnabled: fillText === '' ? true : fillText !== '0',
    outlineEnabled: outlineText === '' ? true : outlineText !== '0',
  })
}

const buildStyleDictionaries = (xml = '') => {
  const styles = new Map()
  const styleMaps = new Map()
  let match = null
  const styleRegex = /<Style\b[^>]*\sid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/Style>/gi
  while ((match = styleRegex.exec(xml))) styles.set(`${match[1]}`.trim(), parseStyleBlock(match[2]))
  const styleMapRegex = /<StyleMap\b[^>]*\sid=["']([^"']+)["'][^>]*>([\s\S]*?)<\/StyleMap>/gi
  while ((match = styleMapRegex.exec(xml))) {
    const pairRegex = /<Pair\b[^>]*>([\s\S]*?)<\/Pair>/gi
    let pair = null
    while ((pair = pairRegex.exec(match[2] || ''))) {
      const pairText = `${pair[1] || ''}`
      const key = extractTagText(pairText, 'key')
      const styleUrl = extractTagText(pairText, 'styleUrl').replace(/^#/, '')
      if (key === 'normal' && styleUrl) {
        styleMaps.set(`${match[1]}`.trim(), styleUrl)
        break
      }
    }
  }
  return { styles, styleMaps }
}

const resolveStyleByUrl = (styleUrl = '', dictionaries = {}, seen = new Set()) => {
  const id = `${styleUrl || ''}`.replace(/^#/, '').trim()
  if (!id || seen.has(id)) return mergeStyle()
  seen.add(id)
  const style = dictionaries.styles?.get(id)
  if (style) return mergeStyle(style)
  const mapped = dictionaries.styleMaps?.get(id)
  return mapped ? resolveStyleByUrl(mapped, dictionaries, seen) : mergeStyle()
}

const extractFirstCoordinatesBlock = (text = '') => {
  const match = text.match(/<coordinates\b[^>]*>([\s\S]*?)<\/coordinates>/i)
  return match?.[1] || ''
}

const extractCoordinatesBlocksWithinTag = (text = '', tagName = '') => {
  const regex = new RegExp(
    `<${tagName}\\b[\\s\\S]*?<coordinates\\b[^>]*>([\\s\\S]*?)<\\/coordinates>`,
    'gi',
  )
  const blocks = []
  let match = null
  while ((match = regex.exec(text))) {
    if (match?.[1]) blocks.push(match[1])
  }
  return blocks
}

const parseCoordinateText = (coordinateText = '') => {
  const points = `${coordinateText || ''}`
    .trim()
    .split(/\s+/)
    .map((chunk) => {
      const [lng, lat] = chunk.split(',').map(Number)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
      return { longitude: lng, latitude: lat }
    })
    .filter(Boolean)
  const first = points[0]
  const last = points[points.length - 1]
  if (first && last && Math.abs(first.longitude - last.longitude) <= 1e-9 && Math.abs(first.latitude - last.latitude) <= 1e-9) {
    points.pop()
  }
  return points
}

const convertWgsPointsToGcj = (points = []) =>
  points
    .map((point) => {
      if (!Number.isFinite(point?.longitude) || !Number.isFinite(point?.latitude)) return null
      if (outOfChina(point.longitude, point.latitude)) {
        return { longitude: point.longitude, latitude: point.latitude }
      }
      const converted = wgs84ToGcj02(point.longitude, point.latitude)
      return { longitude: Number(converted.lng), latitude: Number(converted.lat) }
    })
    .filter(Boolean)

const buildBounds = (points = []) => {
  if (!Array.isArray(points) || !points.length) return null
  return points.reduce(
    (acc, point) => ({
      minLng: Math.min(acc.minLng, point.longitude),
      maxLng: Math.max(acc.maxLng, point.longitude),
      minLat: Math.min(acc.minLat, point.latitude),
      maxLat: Math.max(acc.maxLat, point.latitude),
    }),
    {
      minLng: Number.POSITIVE_INFINITY,
      maxLng: Number.NEGATIVE_INFINITY,
      minLat: Number.POSITIVE_INFINITY,
      maxLat: Number.NEGATIVE_INFINITY,
    },
  )
}

const pointInBounds = (point = {}, bounds = null) => {
  if (!point || !bounds) return false
  return (
    point.longitude >= bounds.minLng &&
    point.longitude <= bounds.maxLng &&
    point.latitude >= bounds.minLat &&
    point.latitude <= bounds.maxLat
  )
}

const pointInPolygon = (point = {}, ring = []) => {
  if (!point || !Array.isArray(ring) || ring.length < 3) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = Number(ring[i].longitude)
    const yi = Number(ring[i].latitude)
    const xj = Number(ring[j].longitude)
    const yj = Number(ring[j].latitude)
    const intersect = yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / ((yj - yi) || 1e-12) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export const buildParsedResourceFromKmlText = (kmlText = '') => {
  const xml = `${kmlText || ''}`
  const dictionaries = buildStyleDictionaries(xml)
  const placemarkMatches = xml.match(/<Placemark\b[\s\S]*?<\/Placemark>/gi) || []
  const placemarks = placemarkMatches.length ? placemarkMatches : [xml]
  const polygons = []
  const polylines = []

  placemarks.forEach((placemarkText) => {
    const style = mergeStyle(
      resolveStyleByUrl(extractTagText(placemarkText, 'styleUrl'), dictionaries),
      parseStyleBlock(extractTagText(placemarkText, 'Style')),
    )
    const polygonMatches = placemarkText.match(/<Polygon\b[\s\S]*?<\/Polygon>/gi) || []
    polygonMatches.forEach((polygonText) => {
      const outer = extractCoordinatesBlocksWithinTag(polygonText, 'outerBoundaryIs')[0] || extractFirstCoordinatesBlock(polygonText)
      const holes = extractCoordinatesBlocksWithinTag(polygonText, 'innerBoundaryIs')
        .map(parseCoordinateText)
        .filter((points) => points.length >= 3)
      const wgs84Points = parseCoordinateText(outer)
      if (wgs84Points.length < 3) return
      const gcjPoints = convertWgsPointsToGcj(wgs84Points)
      const gcjHolePointsList = holes.map(convertWgsPointsToGcj).filter((points) => points.length >= 3)
      polygons.push({
        wgs84Points,
        gcjPoints,
        gcjHolePointsList,
        gcjBounds: buildBounds(gcjPoints),
        lineColor: style.lineColor || DEFAULT_KML_COLOR,
        polyColor: style.polyColor || DEFAULT_KML_COLOR,
        lineWidth: Number(style.lineWidth) > 0 ? Number(style.lineWidth) : 1,
        fillEnabled: style.fillEnabled !== false,
        outlineEnabled: style.outlineEnabled !== false,
      })
    })
    const lineMatches = placemarkText.match(/<LineString\b[\s\S]*?<\/LineString>/gi) || []
    lineMatches.forEach((lineText) => {
      const wgs84Points = parseCoordinateText(extractFirstCoordinatesBlock(lineText))
      if (wgs84Points.length < 2) return
      const gcjPoints = convertWgsPointsToGcj(wgs84Points)
      polylines.push({
        gcjPoints,
        gcjBounds: buildBounds(gcjPoints),
        lineColor: style.lineColor || style.polyColor || DEFAULT_KML_COLOR,
        lineWidth: Number(style.lineWidth) > 0 ? Number(style.lineWidth) : 2,
      })
    })
  })

  return { polygons, polylines }
}

export const mergeKmlResources = (resources = []) => ({
  polygons: resources.flatMap((resource) => (Array.isArray(resource?.polygons) ? resource.polygons : [])),
  polylines: resources.flatMap((resource) => (Array.isArray(resource?.polylines) ? resource.polylines : [])),
})

export const pointCoveredBySuitableZone = (center = {}, resource = {}) => {
  const longitude = Number(center?.longitude)
  const latitude = Number(center?.latitude)
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return false
  const point = { longitude, latitude }
  for (const polygon of Array.isArray(resource?.polygons) ? resource.polygons : []) {
    if (!polygon || polygon.fillEnabled === false || kmlColorAlpha(polygon.polyColor) <= 0) continue
    if (!pointInBounds(point, polygon.gcjBounds)) continue
    if (!pointInPolygon(point, polygon.gcjPoints)) continue
    const inHole = (Array.isArray(polygon.gcjHolePointsList) ? polygon.gcjHolePointsList : []).some((hole) =>
      pointInPolygon(point, hole),
    )
    if (!inHole) return true
  }
  return false
}

export const buildGraphicsFromParsedResource = (resource = {}, region = null) => {
  const viewportBounds = normalizeRegionBounds(region)
  return {
    polygons: (Array.isArray(resource?.polygons) ? resource.polygons : [])
      .filter((polygon) => !viewportBounds || !polygon.gcjBounds || boundsIntersect(polygon.gcjBounds, viewportBounds))
      .map((polygon, index) => ({
        id: `uom-kml-polygon-${index}`,
        points: polygon.gcjPoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
        strokeColor: polygon.outlineEnabled === false ? '#00000000' : kmlColorToRgbaHex(polygon.lineColor),
        fillColor: polygon.fillEnabled === false ? '#00000000' : kmlColorToRgbaHex(polygon.polyColor),
        strokeWidth: polygon.outlineEnabled === false ? 0 : Math.max(1, Math.round(Number(polygon.lineWidth) || 1)),
      }))
      .filter((polygon) => polygon.points.length >= 3),
    polylines: (Array.isArray(resource?.polylines) ? resource.polylines : [])
      .filter((polyline) => !viewportBounds || !polyline.gcjBounds || boundsIntersect(polyline.gcjBounds, viewportBounds))
      .map((polyline, index) => ({
        id: `uom-kml-line-${index}`,
        points: polyline.gcjPoints.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
        color: kmlColorToRgbaHex(polyline.lineColor),
        width: Math.max(1, Math.round(Number(polyline.lineWidth) || 2)),
      }))
      .filter((polyline) => polyline.points.length >= 2),
  }
}

const boundsIntersect = (a = null, b = null) => {
  if (!a || !b) return false
  return a.minLng <= b.maxLng && a.maxLng >= b.minLng && a.minLat <= b.maxLat && a.maxLat >= b.minLat
}

const normalizeTileUrl = (tile = {}) => {
  const publicUrl = `${tile.url || ''}`.trim()
  const downloadUrl = `${tile.downloadUrl || ''}`.trim()
  let rawUrl = downloadUrl || publicUrl
  if (!rawUrl) return ''
  if (rawUrl.startsWith('/api/')) rawUrl = rawUrl.slice(4)
  return rawUrl
}

const normalizeTile = (tile = {}) => {
  const z = Number(tile.z)
  const x = Number(tile.x)
  const y = Number(tile.y)
  const url = normalizeTileUrl(tile)
  const relativePath = `${tile.relativePath || url}`.toLowerCase()
  if (!Number.isFinite(z) || !Number.isFinite(x) || !Number.isFinite(y) || !url || !relativePath.endsWith('.kml')) return null
  return { z, x, y, key: `${z}/${x}/${y}`, url }
}

export const queryUomKmlTiles = async ({ center, region, limit = UOM_KML_TILE_QUERY_LIMIT }) => {
  const bounds = expandBounds(normalizeRegionBounds(region))
  const params = bounds
    ? { minLng: bounds.minLng, minLat: bounds.minLat, maxLng: bounds.maxLng, maxLat: bounds.maxLat, limit }
    : {
        longitude: center?.longitude,
        latitude: center?.latitude,
        radiusMeters: 5000,
        limit,
      }
  const endpoint = bounds ? '/offline-layer-kml/tiles' : '/offline-layer-kml/tiles/nearby'
  const { data } = await http.get(endpoint, { params })
  const rawTiles = data?.data?.tiles || data?.tiles || []
  return (Array.isArray(rawTiles) ? rawTiles : []).map(normalizeTile).filter(Boolean)
}

export const fetchUomKmlResource = async (tile) => {
  if (!tile?.url) return null
  const response = await http.get(tile.url, {
    responseType: 'text',
    transformResponse: [(data) => data],
  })
  return buildParsedResourceFromKmlText(response.data)
}

export const resolveUomKmlStatus = ({ center, loading, empty, resource }) => {
  const longitude = Number(center?.longitude)
  const latitude = Number(center?.latitude)
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    return { status: UOM3_PENDING_STATUS_TEXT, tone: 'neutral' }
  }
  if (outOfChina(longitude, latitude) || resolveExcludedRegionRecord({ longitude, latitude })) {
    return { status: UOM3_NON_RESTRICTED_STATUS_TEXT, tone: 'safe' }
  }
  if (loading) return { status: UOM3_PENDING_STATUS_TEXT, tone: 'neutral' }
  if (!resource) {
    return empty
      ? { status: UOM3_RESTRICTED_STATUS_TEXT, tone: 'alert' }
      : { status: UOM3_PENDING_STATUS_TEXT, tone: 'neutral' }
  }
  const covered = pointCoveredBySuitableZone(center, resource)
  return covered
    ? { status: UOM3_SAFE_STATUS_TEXT, tone: 'safe' }
    : { status: UOM3_RESTRICTED_STATUS_TEXT, tone: 'alert' }
}
