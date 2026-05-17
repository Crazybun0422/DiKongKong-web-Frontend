import http from './http'

const normalizePayload = (response, fallback = null) => response?.data?.data ?? response?.data ?? fallback

export const fetchAdminSuitableFlyZoneKmzInfos = async () => {
  const response = await http.get('/admin/suitable-fly-zone-kmz-infos')
  return normalizePayload(response, [])
}

export const createSuitableFlyZoneKmzInfo = async (payload) => {
  const response = await http.post('/admin/suitable-fly-zone-kmz-infos', payload)
  return normalizePayload(response, null)
}

export default {
  fetchAdminSuitableFlyZoneKmzInfos,
  createSuitableFlyZoneKmzInfo,
}
