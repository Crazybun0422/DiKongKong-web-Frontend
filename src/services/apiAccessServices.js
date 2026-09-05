import http from './http'

const unwrap = (response) => response?.data?.data ?? {}

export const fetchApiAccessServices = async ({ page = 1, size = 20, keyword = '', status = 'ALL' } = {}) => {
  const response = await http.get('/admin/api-access-services', {
    params: {
      page: Math.max(0, page - 1),
      size,
      keyword: keyword.trim() || undefined,
      status,
    },
  })
  const data = unwrap(response)
  return {
    content: Array.isArray(data.content) ? data.content : [],
    page: Number.isFinite(data.page) ? data.page + 1 : page,
    size: Number(data.size) || size,
    totalElements: Number(data.totalElements) || 0,
    totalPages: Number(data.totalPages) || 0,
  }
}

export const createApiAccessService = async (payload) => {
  const response = await http.post('/admin/api-access-services', payload)
  return unwrap(response)
}

export const updateApiAccessService = async (id, payload) => {
  const response = await http.put(`/admin/api-access-services/${encodeURIComponent(id)}`, payload)
  return unwrap(response)
}

export const fetchApiAccessServiceSummary = async () => {
  const response = await http.get('/admin/api-access-services/summary')
  const data = unwrap(response)
  return {
    expiredCount: Number(data.expiredCount) || 0,
    expiredCompanies: Array.isArray(data.expiredCompanies) ? data.expiredCompanies : [],
  }
}
