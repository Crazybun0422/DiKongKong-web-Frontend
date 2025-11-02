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

export const normalizeNoFlyZone = (zone = {}) => ({
  ...zone,
  coordinates: Array.isArray(zone.coordinates)
    ? zone.coordinates.map((coord) => normalizeCoordinate(coord))
    : [],
  circle: normalizeCircle(zone.circle),
  effectiveFrom: zone.effectiveFrom != null ? Number(zone.effectiveFrom) : null,
  effectiveTo: zone.effectiveTo != null ? Number(zone.effectiveTo) : null,
})

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

export default {
  listNoFlyZones,
  createNoFlyZone,
  updateNoFlyZone,
  deleteNoFlyZone,
  getNoFlyZoneDetail,
}