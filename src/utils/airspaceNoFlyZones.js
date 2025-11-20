import { lonLatToMercator, mercatorToLonLat, wgs84ToGcj02 } from './coords'

const DEFAULT_COLOR = '#DE4329'
const FILL_OPACITY = 0.3
const STROKE_OPACITY = 0.95
const STROKE_WIDTH = 1

const normalizeHex = (hex) => (hex ? (hex.startsWith('#') ? hex : `#${hex}`) : DEFAULT_COLOR)

const clampColorOpacity = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return 0
  return Math.max(0, Math.min(1, numeric))
}

const toAlphaHex = (opacity) => Math.round(clampColorOpacity(opacity) * 255).toString(16).padStart(2, '0').toUpperCase()

const colorWithAlpha = (hex, opacity) => `${normalizeHex(hex)}${toAlphaHex(opacity)}`

const extractCoordinate = (raw) => {
  if (!raw) return null
  if (Array.isArray(raw)) {
    if (raw.length < 2) return null
    const lng = Number(raw[0])
    const lat = Number(raw[1])
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null
    return { lng, lat }
  }
  const lat = Number(raw.latitude ?? raw.lat)
  const lng = Number(raw.longitude ?? raw.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lng, lat }
}

const ensureClosedRing = (ring) => {
  if (!Array.isArray(ring) || !ring.length) return []
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (!first || !last) return ring.slice()
  const same = Math.abs(Number(first[0]) - Number(last[0])) <= 1e-8 && Math.abs(Number(first[1]) - Number(last[1])) <= 1e-8
  if (same) return ring.slice()
  return [...ring, [first[0], first[1]]]
}

const buildPolygonRings = (rawCoordinates) => {
  if (!Array.isArray(rawCoordinates)) return []
  const buildSingleRing = (points) => {
    if (!Array.isArray(points)) return null
    const ring = points
      .map((pt) => extractCoordinate(pt))
      .filter((pt) => pt && Number.isFinite(pt.lng) && Number.isFinite(pt.lat))
      .map((pt) => [pt.lng, pt.lat])
    if (ring.length < 3) return null
    return ensureClosedRing(ring)
  }

  if (rawCoordinates.length && Array.isArray(rawCoordinates[0])) {
    return rawCoordinates
      .map((entry) => buildSingleRing(entry))
      .filter((ring) => Array.isArray(ring) && ring.length >= 4)
  }

  const single = buildSingleRing(rawCoordinates)
  return single ? [single] : []
}

const buildPathRing = (rawCoordinates, offsetMeters) => {
  const distance = Number(offsetMeters)
  if (!Array.isArray(rawCoordinates) || rawCoordinates.length < 2) return null
  if (!Number.isFinite(distance) || distance <= 0) return null
  const points = rawCoordinates
    .map((pt) => extractCoordinate(pt))
    .filter((pt) => pt && Number.isFinite(pt.lng) && Number.isFinite(pt.lat))
  if (points.length < 2) return null

  const mercatorPoints = points
    .map((pt) => {
      const m = lonLatToMercator(pt.lng, pt.lat)
      if (!m || !Number.isFinite(m.x) || !Number.isFinite(m.y)) return null
      return m
    })
    .filter(Boolean)
  if (mercatorPoints.length < 2) return null

  const left = []
  const right = []
  for (let i = 0; i < mercatorPoints.length - 1; i += 1) {
    const start = mercatorPoints[i]
    const end = mercatorPoints[i + 1]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (!len) continue
    const nx = -dy / len
    const ny = dx / len
    const offsetX = nx * distance
    const offsetY = ny * distance
    const leftStart = { x: start.x + offsetX, y: start.y + offsetY }
    const leftEnd = { x: end.x + offsetX, y: end.y + offsetY }
    const rightStart = { x: start.x - offsetX, y: start.y - offsetY }
    const rightEnd = { x: end.x - offsetX, y: end.y - offsetY }
    if (!left.length) left.push(leftStart)
    left.push(leftEnd)
    if (!right.length) right.push(rightStart)
    right.push(rightEnd)
  }

  if (left.length < 2 || right.length < 2) return null
  const merged = [...left, ...right.reverse()]
  if (!merged.length) return null
  const first = merged[0]
  const last = merged[merged.length - 1]
  if (Math.abs(first.x - last.x) > 1e-8 || Math.abs(first.y - last.y) > 1e-8) {
    merged.push({ x: first.x, y: first.y })
  }
  const ring = merged
    .map((pt) => mercatorToLonLat(pt.x, pt.y))
    .filter((pt) => pt && Number.isFinite(pt.lng) && Number.isFinite(pt.lat))
    .map((pt) => [pt.lng, pt.lat])
  if (ring.length < 3) return null
  return ensureClosedRing(ring)
}

const toGcjPoint = (lng, lat) => {
  const latitude = Number(lat)
  const longitude = Number(lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  const gcj = wgs84ToGcj02(longitude, latitude)
  const gcjLng = Number.isFinite(gcj?.lng) ? gcj.lng : longitude
  const gcjLat = Number.isFinite(gcj?.lat) ? gcj.lat : latitude
  return { latitude: gcjLat, longitude: gcjLng }
}

const toGcjRing = (ring) =>
  Array.isArray(ring)
    ? ring
        .map((pt) => toGcjPoint(pt[0], pt[1]))
        .filter(Boolean)
        .map((pt) => [pt.longitude, pt.latitude])
    : []

export const buildNoFlyZoneGraphics = (zones = []) => {
  const polygons = []
  const circles = []
  const shapes = []
  if (!Array.isArray(zones)) {
    return { polygons, circles, shapes }
  }

  zones.forEach((zone) => {
    const type = String(zone?.type || '').toUpperCase()
    if (type === 'CIRCLE' && zone?.circle) {
      const center = extractCoordinate(zone.circle)
      const radius = Number(zone.circle.radiusMeters ?? zone.circle.radius ?? 0)
      if (center && Number.isFinite(radius) && radius > 0) {
        const gcj = toGcjPoint(center.lng, center.lat)
        if (gcj) {
          circles.push({
            longitude: gcj.longitude,
            latitude: gcj.latitude,
            radius,
            color: colorWithAlpha(DEFAULT_COLOR, STROKE_OPACITY),
            fillColor: colorWithAlpha(DEFAULT_COLOR, FILL_OPACITY),
            strokeWidth: STROKE_WIDTH,
          })
          shapes.push({ type: 'circle', center: { lng: gcj.longitude, lat: gcj.latitude }, radius, zone })
        }
      }
      return
    }

    if (type === 'PATH') {
      const ring = buildPathRing(zone?.coordinates, zone?.pathDistanceMeters)
      if (ring && ring.length >= 3) {
        const gcjRing = toGcjRing(ring)
        if (gcjRing.length >= 3) {
          polygons.push({
            points: gcjRing.map((pt) => ({ longitude: pt[0], latitude: pt[1] })),
            strokeColor: colorWithAlpha(DEFAULT_COLOR, STROKE_OPACITY),
            fillColor: colorWithAlpha(DEFAULT_COLOR, FILL_OPACITY),
            strokeWidth: STROKE_WIDTH,
          })
          shapes.push({ type: 'polygon', rings: [gcjRing], zone })
        }
      }
      return
    }

    const rings = buildPolygonRings(zone?.coordinates)
    if (rings.length) {
      rings.forEach((ring) => {
        const gcjRing = toGcjRing(ring)
        if (gcjRing.length >= 3) {
          polygons.push({
            points: gcjRing.map((pt) => ({ longitude: pt[0], latitude: pt[1] })),
            strokeColor: colorWithAlpha(DEFAULT_COLOR, STROKE_OPACITY),
            fillColor: colorWithAlpha(DEFAULT_COLOR, FILL_OPACITY),
            strokeWidth: STROKE_WIDTH,
          })
        }
      })
      const gcjRings = rings
        .map((ring) => toGcjRing(ring))
        .filter((ring) => Array.isArray(ring) && ring.length >= 3)
      shapes.push({ type: 'polygon', rings: gcjRings.length ? gcjRings : rings, zone })
    }
  })

  return { polygons, circles, shapes }
}

export default {
  buildNoFlyZoneGraphics,
}
