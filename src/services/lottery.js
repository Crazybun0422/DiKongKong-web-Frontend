import http from './http'

const normalizePageResult = (payload = {}, defaults = {}) => ({
  content: payload.content ?? defaults.content ?? [],
  page: typeof payload.page === 'number' ? payload.page + 1 : defaults.page ?? 1,
  size: payload.size ?? defaults.size ?? 10,
  totalElements: payload.totalElements ?? defaults.totalElements ?? 0,
  totalPages: payload.totalPages ?? defaults.totalPages ?? 0,
})

const normalizeData = (response, fallback = {}) => response?.data?.data ?? response?.data ?? fallback

export const fetchLotteryConfig = async () => {
  const response = await http.get('/lottery/config')
  return normalizeData(response, { prizes: [], updatedAt: null })
}

export const saveLotteryConfig = async (payload) => {
  const response = await http.put('/lottery/config', payload)
  return normalizeData(response, {})
}

export const fetchLotteryLogs = async ({ page = 1, size = 10, featureCode } = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
  }

  if (featureCode) {
    params.featureCode = featureCode
  }

  const response = await http.get('/lottery/logs', { params })
  const data = normalizeData(response, {})
  return normalizePageResult(data, { page, size })
}

export default {
  fetchLotteryConfig,
  saveLotteryConfig,
  fetchLotteryLogs,
}
