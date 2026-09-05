import http, { API_BASE_URL, AUTH_TOKEN_KEY } from './http'

const apiRoot = API_BASE_URL.replace(/\/$/, '')

export const fetchAdminPlanetBroadcasts = async (params = {}) => {
  const response = await http.get('/admin/planet-broadcasts', { params })
  return response.data?.data ?? response.data
}

export const createAdminPlanetBroadcast = async (payload = {}) => {
  const response = await http.post('/admin/planet-broadcasts', payload)
  return response.data?.data ?? response.data
}

export const fetchAdminPlanetBroadcastQuotaConfig = async () => {
  const response = await http.get('/admin/planet-broadcasts/quota-config')
  return response.data?.data ?? response.data
}

export const updateAdminPlanetBroadcastQuotaConfig = async (payload = {}) => {
  const response = await http.put('/admin/planet-broadcasts/quota-config', payload)
  return response.data?.data ?? response.data
}

export const fetchAdminPlanetBroadcastGovernanceConfig = async () => {
  const response = await http.get('/admin/planet-broadcasts/governance-config')
  return response.data?.data ?? response.data
}

export const updateAdminPlanetBroadcastGovernanceConfig = async (payload = {}) => {
  const response = await http.put('/admin/planet-broadcasts/governance-config', payload)
  return response.data?.data ?? response.data
}

export const updateAdminPlanetBroadcastPin = async (id, payload = {}) => {
  const response = await http.put(`/admin/planet-broadcasts/${encodeURIComponent(id)}/pin`, payload)
  return response.data?.data ?? response.data
}

export const pushAdminPlanetBroadcast = async (id) => {
  const response = await http.post(`/admin/planet-broadcasts/${encodeURIComponent(id)}/push`)
  return response.data?.data ?? response.data
}

export const deleteAdminPlanetBroadcast = async (id) => {
  const response = await http.delete(`/admin/planet-broadcasts/${encodeURIComponent(id)}`)
  return response.data?.data ?? response.data
}

export const fetchAdminPlanetBroadcastComments = async (id, params = {}) => {
  const response = await http.get(`/admin/planet-broadcasts/${encodeURIComponent(id)}/comments`, { params })
  return response.data?.data ?? response.data
}

export const deleteAdminPlanetBroadcastComment = async (id, commentId) => {
  const response = await http.delete(
    `/admin/planet-broadcasts/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`,
  )
  return response.data?.data ?? response.data
}

export const banAdminPlanetBroadcastAuthor = async (featureCode) => {
  const response = await http.put(`/admin/planet-broadcasts/authors/${encodeURIComponent(featureCode)}/ban`)
  return response.data?.data ?? response.data
}

export const unbanAdminPlanetBroadcastAuthor = async (featureCode) => {
  const response = await http.put(`/admin/planet-broadcasts/authors/${encodeURIComponent(featureCode)}/unban`)
  return response.data?.data ?? response.data
}

export const createAdminPlanetBroadcastEventSource = () => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY) || ''
  const url = `${apiRoot}/admin/planet-broadcasts/events?token=${encodeURIComponent(token)}`
  return new EventSource(url)
}

export default {
  fetchAdminPlanetBroadcasts,
  createAdminPlanetBroadcast,
  fetchAdminPlanetBroadcastQuotaConfig,
  fetchAdminPlanetBroadcastGovernanceConfig,
  updateAdminPlanetBroadcastQuotaConfig,
  updateAdminPlanetBroadcastGovernanceConfig,
  updateAdminPlanetBroadcastPin,
  pushAdminPlanetBroadcast,
  deleteAdminPlanetBroadcast,
  fetchAdminPlanetBroadcastComments,
  deleteAdminPlanetBroadcastComment,
  banAdminPlanetBroadcastAuthor,
  unbanAdminPlanetBroadcastAuthor,
  createAdminPlanetBroadcastEventSource,
}
