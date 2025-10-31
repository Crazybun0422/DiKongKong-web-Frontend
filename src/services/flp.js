import http from './http'

const toPageResult = (payload = {}, defaults = {}) => ({
  content: payload.content ?? defaults.content ?? [],
  page: typeof payload.page === 'number' ? payload.page + 1 : defaults.page ?? 1,
  size: payload.size ?? defaults.size ?? 10,
  totalElements: payload.totalElements ?? defaults.totalElements ?? 0,
  totalPages: payload.totalPages ?? defaults.totalPages ?? 0,
})

export const fetchFlpLogs = async ({ page = 1, size = 10, featureCode } = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
  }

  if (featureCode) {
    params.featureCode = featureCode
  }

  const response = await http.get('/flp/logs', { params })
  const data = response?.data?.data ?? {}
  return toPageResult(data, { page, size })
}

export default {
  fetchFlpLogs,
}
