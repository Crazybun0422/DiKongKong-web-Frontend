import http from './http'

export const fetchNearbyMarkers = async ({ latitude, longitude, radiusInKilometers }) => {
  const params = {}
  if (Number.isFinite(latitude)) params.latitude = latitude
  if (Number.isFinite(longitude)) params.longitude = longitude
  if (Number.isFinite(radiusInKilometers)) params.radiusInKilometers = radiusInKilometers

  const { data } = await http.get('/markers/nearby', { params })
  return Array.isArray(data?.data) ? data.data : []
}

export const fetchMarkerDetail = async (markerId) => {
  if (!markerId) throw new Error('markerId is required')
  const { data } = await http.get(`/markers/${encodeURIComponent(markerId)}`)
  return data?.data || null
}

export const fetchNearbyPins = async ({ latitude, longitude, radiusInKilometers }) => {
  const params = {}
  if (Number.isFinite(latitude)) params.latitude = latitude
  if (Number.isFinite(longitude)) params.longitude = longitude
  if (Number.isFinite(radiusInKilometers)) params.radiusInKilometers = radiusInKilometers

  const { data } = await http.get('/pins/nearby', { params })
  return Array.isArray(data?.data) ? data.data : []
}

export const fetchNearbyNoFlyZones = async ({ latitude, longitude, radiusInKilometers }) => {
  const params = {}
  if (Number.isFinite(latitude)) params.latitude = latitude
  if (Number.isFinite(longitude)) params.longitude = longitude
  if (Number.isFinite(radiusInKilometers)) params.radiusInKilometers = radiusInKilometers

  const { data } = await http.get('/no-fly-zones/nearby', { params })
  return Array.isArray(data?.data) ? data.data : []
}

export default {
  fetchNearbyMarkers,
  fetchMarkerDetail,
  fetchNearbyPins,
  fetchNearbyNoFlyZones,
}
