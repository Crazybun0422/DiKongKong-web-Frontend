import { gcj02ToWgs84, wgs84ToGcj02 } from './coords'

const DEFAULT_LEVELS = '2,6,1,4,3,7,8,10'
const DEFAULT_DRONE = 'spark'
const DJI_FLYSAFE_RECT_URL = 'https://flysafe-api.dji.com/api/qep/geo/feedback/areas/in_rectangle'
const NFZ_FILL_ALPHA = 0.3
const NFZ_SUBAREA_ALPHA_SCALE = 0.7
const NFZ_STROKE_OPACITY = 0.95
const NFZ_DEFAULT_COLOR = '#DE4329'

const NFZ_PALETTE = {
  1: '#000000',
  2: '#DE4329',
  3: '#EE8815',
  4: '#FFCC00',
  6: '#979797',
  7: '#37C4DB',
  8: '#35C759',
  10: '#A9D86E',
}

const normalizeHex = (hex) => {
  const h = hex || NFZ_DEFAULT_COLOR
  return h.startsWith('#') ? h : `#${h}`
}

const toAlphaHex = (opacity) =>
  Math.round(Math.max(0, Math.min(1, Number(opacity))) * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase()

const levelFillOpacity = (level, scale = 1) => {
  const base = Number(level) === 6 ? NFZ_FILL_ALPHA * 0.9 : NFZ_FILL_ALPHA
  return base * scale
}

const colorWithAlpha = (hex, opacity) => `${normalizeHex(hex)}${toAlphaHex(opacity)}`

const styleForLevel = (level) => ({
  strokeColor: NFZ_PALETTE[level] || NFZ_DEFAULT_COLOR,
  fillColor: NFZ_PALETTE[level] || NFZ_DEFAULT_COLOR,
  strokeWidth: 1,
  level,
  fillAlphaScale: 1,
})

const toPolygonPoints = (ring) =>
  ring
    .map((pt) => {
      const lng = Number(pt[0])
      const lat = Number(pt[1])
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
      const gcj = wgs84ToGcj02(lng, lat)
      return { longitude: gcj.lng, latitude: gcj.lat }
    })
    .filter(Boolean)

const drawSingleArea = (area, style, polygons, circles, polygonOnly = false) => {
  let base = normalizeHex(style.strokeColor)
  const fillScale = style.fillAlphaScale || 1
  const fillOpacity = levelFillOpacity(style.level || area.level, fillScale)
  const strokeColor = colorWithAlpha(base, NFZ_STROKE_OPACITY)

  if (base !== area.color) {
    base = area.color
  }
  const fillColor = colorWithAlpha(base, fillOpacity)
  const source = polygonOnly ? area?.polygon_points : area?.polygon_points || area?.points || area?.polygon || area?.geometry?.coordinates
  const hasPolygon = Array.isArray(source) && source.length > 0
  if (!hasPolygon) {
    if (area.shape === 0 || (!area.polygon_points && area.radius && area.lat && area.lng)) {
      const center = wgs84ToGcj02(Number(area.lng), Number(area.lat))
      circles.push({
        longitude: center.lng,
        latitude: center.lat,
        radius: Number(area.radius) || 0,
        color: strokeColor,
        fillColor,
        strokeWidth: style.strokeWidth || 1,
      })
    }
    return
  }

  const pts = source
  if (Array.isArray(pts[0]) && Array.isArray(pts[0][0]) && Array.isArray(pts[0][0][0])) {
    pts.forEach((poly) => {
      const outer = Array.isArray(poly[0]) ? poly[0] : poly
      const ring = Array.isArray(outer[0]) ? outer[0] : outer
      const points = toPolygonPoints(ring)
      if (points.length) {
        polygons.push({ points, strokeColor, fillColor, strokeWidth: style.strokeWidth || 1 })
      }
    })
  } else if (Array.isArray(pts[0]) && Array.isArray(pts[0][0])) {
    const ring = Array.isArray(pts[0]) ? pts[0] : pts
    const points = toPolygonPoints(ring)
    if (points.length) {
      polygons.push({ points, strokeColor, fillColor, strokeWidth: style.strokeWidth || 1 })
    }
  } else {
    const points = toPolygonPoints(pts)
    if (points.length) {
      polygons.push({ points, strokeColor, fillColor, strokeWidth: style.strokeWidth || 1 })
    }
  }
}

export const buildAreaGraphics = (areas) => {
  const polygons = []
  const circles = []
  if (!Array.isArray(areas)) return { polygons, circles }

  areas.forEach((area) => {
    const baseStyle = styleForLevel(Number(area.level))
    if (Array.isArray(area.sub_areas) && area.sub_areas.length) {
      const subStyle = { ...baseStyle, fillAlphaScale: NFZ_SUBAREA_ALPHA_SCALE }
      area.sub_areas.forEach((sub) => drawSingleArea(sub, subStyle, polygons, circles, true))
    } else {
      drawSingleArea(area, baseStyle, polygons, circles, false)
    }
  })

  return { polygons, circles }
}

export const fetchDjiAreas = async ({ rect, levels, drone }) => {
  if (!rect || rect.ltlat == null || rect.ltlng == null || rect.rblat == null || rect.rblng == null) {
    throw new Error('Rectangle bounds required')
  }

  const params = {
    ltlat: String(rect.ltlat),
    ltlng: String(rect.ltlng),
    rblat: String(rect.rblat),
    rblng: String(rect.rblng),
    zones_mode: 'flysafe_website',
    level: levels || DEFAULT_LEVELS,
    drone: drone || DEFAULT_DRONE,
    country: 'CN',
  }

  const url = new URL(DJI_FLYSAFE_RECT_URL)
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))

  const response = await fetch(url.toString())
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`DJI request failed: ${response.status} ${text}`)
  }

  const body = await response.json()
  const areas = body?.areas || body?.data?.areas || body?.data?.data?.areas || body?.data?.zones || []
  return Array.isArray(areas) ? areas : []
}

export const normalizedAreaLevel = (area) => {
  const level = Number(area?.level)
  if (!Number.isFinite(level)) return level
  const color = typeof area?.color === 'string' ? area.color.trim().toUpperCase() : ''
  if (color === '#979797' && level === 2) return 6
  return level
}

export const labelForArea = (area, parent) => {
  const level = normalizedAreaLevel(area)
  switch (level) {
    case 2:
      return '禁飞区'
    case 6:
      return '限高区'
    case 1:
      return '授权区'
    case 4:
      return '警示区'
    case 3:
      return '加强警示区'
    case 7:
      return '法规限制区'
    case 8:
      return '法规适飞区'
    case 10:
      return '风景示范区'
    default:
      return parent ? '空域限制' : '空域'
  }
}

export const toneForLevel = (level) => {
  const normalized = Number(level)
  if (normalized === 2 || normalized === 1) return 'alert'
  if (normalized === 6 || normalized === 4 || normalized === 3) return 'warn'
  if (normalized === 8 || normalized === 10) return 'safe'
  return 'neutral'
}

export const colorForArea = (area) => {
  const level = normalizedAreaLevel(area)
  if (level === 6) return '#FFFFFF'
  const explicit = typeof area?.color === 'string' ? area.color.trim() : ''
  if (explicit) return explicit
  return NFZ_PALETTE[level] || NFZ_DEFAULT_COLOR
}

export const severityRank = (area) => {
  const level = normalizedAreaLevel(area)
  if (level === 2) return 0
  if (level === 6) return 1
  if (level === 1) return 2
  if (level === 3) return 3
  if (level === 4) return 4
  if (level === 7) return 5
  if (level === 8) return 6
  if (level === 10) return 7
  return 8
}

export const effectiveHeight = (area, parent) => {
  const height = Number(area?.limit || area?.height || area?.limit_height || area?.limit_height_meter)
  if (Number.isFinite(height)) return height
  const parentHeight = Number(parent?.limit || parent?.limit_height || parent?.height)
  if (Number.isFinite(parentHeight)) return parentHeight
  return null
}

export const areaContainsWgsPoint = (area, lng, lat, { polygonOnly = false } = {}) => {
  if (!area) return false
  const poly = polygonOnly ? area?.polygon_points : area?.polygon_points || area?.points || area?.polygon || area?.geometry?.coordinates
  if (Array.isArray(poly) && poly.length > 0) {
    return polygonPointsContain(poly, lng, lat)
  }
  return circleContainsArea(area, lng, lat)
}

const polygonPointsContain = (poly, lng, lat) => {
  if (!Array.isArray(poly) || !poly.length) return false
  if (Array.isArray(poly[0]) && Array.isArray(poly[0][0]) && Array.isArray(poly[0][0][0])) {
    return poly.some((single) => {
      const outer = Array.isArray(single[0]) ? single[0] : single
      const ring = Array.isArray(outer[0]) ? outer[0] : outer
      return ringContains(ring, lng, lat)
    })
  }
  if (Array.isArray(poly[0]) && Array.isArray(poly[0][0])) {
    const ring = Array.isArray(poly[0]) ? poly[0] : poly
    return ringContains(ring, lng, lat)
  }
  return ringContains(poly, lng, lat)
}

const circleContainsArea = (area, lng, lat) => {
  if (!area) return false
  const isCircleShape = area.shape === 0
  const hasCircleParams = area.radius && area.lat && area.lng
  if (!isCircleShape && !hasCircleParams) return false
  const radius = Number(area.radius)
  const centerLng = Number(area.lng)
  const centerLat = Number(area.lat)
  if (!Number.isFinite(radius) || radius <= 0) return false
  if (!Number.isFinite(centerLng) || !Number.isFinite(centerLat)) return false
  const dist = Math.hypot(lng - centerLng, lat - centerLat)
  return Number.isFinite(dist) && dist <= radius
}

export const ringContains = (ring, lng, lat) => {
  if (!Array.isArray(ring) || ring.length === 0) return false
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i += 1) {
    const xi = Number(ring[i][0])
    const yi = Number(ring[i][1])
    const xj = Number(ring[j][0])
    const yj = Number(ring[j][1])
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-12) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export default {
  fetchDjiAreas,
  buildAreaGraphics,
  normalizedAreaLevel,
  labelForArea,
  toneForLevel,
  severityRank,
  colorForArea,
  effectiveHeight,
  areaContainsWgsPoint,
  ringContains,
}
