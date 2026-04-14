import http from './http'

const normalizeCoordinate = (coord = {}) => ({
  latitude: Number(coord.latitude),
  longitude: Number(coord.longitude),
})

const normalizeCircle = (circle = {}) => {
  if (!circle) return null
  if (circle.latitude == null || circle.longitude == null || circle.radiusMeters == null) {
    return null
  }
  return {
    latitude: Number(circle.latitude),
    longitude: Number(circle.longitude),
    radiusMeters: Number(circle.radiusMeters),
  }
}

const normalizeArea = (area = {}) => {
  const normalizedCoordinates = Array.isArray(area.coordinates)
    ? area.coordinates.map((coord) => normalizeCoordinate(coord))
    : []

  const normalizedCircle = normalizeCircle(area.circle)
  const normalizedPathDistance = (() => {
    const explicit = Number(area.pathDistanceMeters ?? area.alongEdgeDistanceMeters)
    if (Number.isFinite(explicit) && explicit > 0) {
      return explicit
    }
    return extractPathDistance(normalizedCoordinates)
  })()

  return {
    ...area,
    type: normalizeZoneType(area.type),
    coordinates: normalizedCoordinates,
    circle: normalizedCircle,
    pathDistanceMeters: normalizedPathDistance,
  }
}

const normalizeEffectivePeriod = (period = {}) => ({
  effectiveFrom: period.effectiveFrom != null ? Number(period.effectiveFrom) : null,
  effectiveTo: period.effectiveTo != null ? Number(period.effectiveTo) : null,
})

const normalizeZoneType = (type) => {
  if (type === 'POLYLINE' || type === 'CORRIDOR') {
    return 'PATH'
  }
  return type
}

const extractPathDistance = (coordinates = []) => {
  if (!Array.isArray(coordinates)) return null
  for (const coord of coordinates) {
    const distance = Number(coord?.distanceMeters ?? coord?.alongEdgeDistanceMeters)
    if (Number.isFinite(distance) && distance > 0) {
      return distance
    }
  }
  return null
}

export const normalizeNoFlyZone = (zone = {}) => {
  const normalizedArea = normalizeArea(zone)

  return {
    ...zone,
    type: normalizedArea.type,
    coordinates: normalizedArea.coordinates,
    circle: normalizedArea.circle,
    effectiveFrom: zone.effectiveFrom != null ? Number(zone.effectiveFrom) : null,
    effectiveTo: zone.effectiveTo != null ? Number(zone.effectiveTo) : null,
    effectivePeriods: Array.isArray(zone.effectivePeriods)
      ? zone.effectivePeriods.map((period) => normalizeEffectivePeriod(period))
      : [],
    pathDistanceMeters: normalizedArea.pathDistanceMeters,
    extra: Array.isArray(zone.extra) ? zone.extra.map((item) => normalizeArea(item)) : [],
  }
}

export const listNoFlyZones = async ({ page = 1, size = 20, sortOrder = 'DESC' } = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
    sortOrder,
  }
  const { data } = await http.get('/admin/no-fly-zones', { params })
  const payload = data?.data || {}
  return {
    content: Array.isArray(payload.content)
      ? payload.content.map((item) => normalizeNoFlyZone(item))
      : [],
    page: typeof payload.page === 'number' ? payload.page + 1 : page,
    size: payload.size || size,
    totalElements: payload.totalElements || 0,
    totalPages: payload.totalPages || 0,
  }
}

export const createNoFlyZone = async (payload) => {
  const { data } = await http.post('/admin/no-fly-zones', payload)
  return normalizeNoFlyZone(data?.data)
}

export const updateNoFlyZone = async (id, payload) => {
  if (!id) throw new Error('id is required')
  const { data } = await http.put(`/admin/no-fly-zones/${id}`, payload)
  return normalizeNoFlyZone(data?.data)
}

export const deleteNoFlyZone = async (id) => {
  if (!id) throw new Error('id is required')
  await http.delete(`/admin/no-fly-zones/${id}`)
  return true
}

export const getNoFlyZoneDetail = async (id) => {
  if (!id) throw new Error('id is required')
  const { data } = await http.get(`/admin/no-fly-zones/${id}`)
  return normalizeNoFlyZone(data?.data)
}

export const fetchNoFlyZoneRichTextConfig = async () => {
  const { data } = await http.get('/no-fly-zones/rich-text-config')
  return data?.data || { content: '', updatedAt: null }
}

export const saveNoFlyZoneRichTextConfig = async (payload) => {
  const { data } = await http.put('/admin/no-fly-zones/rich-text-config', payload)
  return data?.data || { content: payload?.content || '', updatedAt: null }
}

export default {
  listNoFlyZones,
  createNoFlyZone,
  updateNoFlyZone,
  deleteNoFlyZone,
  getNoFlyZoneDetail,
  fetchNoFlyZoneRichTextConfig,
  saveNoFlyZoneRichTextConfig,
}
