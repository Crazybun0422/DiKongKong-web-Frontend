import http from './http'

const toPageResult = (payload = {}, defaults = {}) => ({
  content: payload.content ?? defaults.content ?? [],
  page: typeof payload.page === 'number' ? payload.page + 1 : defaults.page ?? 1,
  size: payload.size ?? defaults.size ?? 10,
  totalElements: payload.totalElements ?? defaults.totalElements ?? 0,
  totalPages: payload.totalPages ?? defaults.totalPages ?? 0,
})

export const fetchSubscriptionPushes = async ({ page = 1, size = 10 } = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
  }
  const response = await http.get('/admin/weapp/subscription-pushes', { params })
  const data = response?.data?.data ?? {}
  return toPageResult(data, { page, size })
}

export const createSubscriptionPush = async (payload) => {
  const response = await http.post('/admin/weapp/subscription-pushes', payload)
  return response?.data?.data ?? response?.data ?? {}
}

export default {
  fetchSubscriptionPushes,
  createSubscriptionPush,
}
