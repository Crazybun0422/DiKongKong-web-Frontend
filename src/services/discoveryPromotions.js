import http from './http'

const unwrap = (response, fallback = null) => {
  const body = response?.data
  if (body?.success === false) throw new Error(body.message?.zh || (typeof body.message === 'string' ? body.message : '') || '配置保存失败，请稍后重试')
  return body?.data ?? body ?? fallback
}

export const fetchDiscoveryPromotions = async () => {
  const response = await http.get('/admin/discovery-promotions')
  const data = unwrap(response, [])
  return Array.isArray(data) ? data : []
}

export const createDiscoveryPromotion = async (payload) => {
  const response = await http.post('/admin/discovery-promotions', payload)
  return unwrap(response, {})
}

export const updateDiscoveryPromotion = async (id, payload) => {
  const response = await http.put(`/admin/discovery-promotions/${id}`, payload)
  return unwrap(response, {})
}

export const deleteDiscoveryPromotion = async (id) => {
  await http.delete(`/admin/discovery-promotions/${id}`)
}

export default {
  fetchDiscoveryPromotions,
  createDiscoveryPromotion,
  updateDiscoveryPromotion,
  deleteDiscoveryPromotion,
}
