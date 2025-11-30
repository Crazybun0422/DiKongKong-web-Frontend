import http from './http'

const endpoint = '/map-layer-settings'

export const fetchMapLayerSettings = async ({ featureCode } = {}) => {
  const params = {}
  if (featureCode) params.featureCode = featureCode
  const { data } = await http.get(endpoint, { params })
  return data?.data || null
}

export const updateMapLayerSettings = async (payload = {}, { featureCode } = {}) => {
  const params = {}
  if (featureCode) params.featureCode = featureCode
  const { data } = await http.put(endpoint, payload, { params })
  return data?.data || null
}

export default {
  fetchMapLayerSettings,
  updateMapLayerSettings,
}
