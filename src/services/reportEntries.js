import http from './http'

const toPageResult = (payload = {}, defaults = {}) => ({
  content: payload.content ?? defaults.content ?? [],
  page: typeof payload.page === 'number' ? payload.page + 1 : defaults.page ?? 1,
  size: payload.size ?? defaults.size ?? 10,
  totalElements: payload.totalElements ?? defaults.totalElements ?? 0,
  totalPages: payload.totalPages ?? defaults.totalPages ?? 0,
})

const normalizePayload = (response, fallback = {}) => response?.data?.data ?? response?.data ?? fallback

export const fetchReportEntries = async ({ page = 1, size = 10, sortOrder = 'DESC' } = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
    sortOrder,
  }
  const response = await http.get('/admin/report-entries', { params })
  const data = response?.data?.data ?? {}
  return toPageResult(data, { page, size })
}

export const fetchReportEntryDialogText = async () => {
  const response = await http.get('/admin/report-entries/dialog-text')
  return normalizePayload(response, { dialogText: '' })
}

export const saveReportEntryDialogText = async (payload) => {
  const response = await http.put('/admin/report-entries/dialog-text', payload)
  return normalizePayload(response, {})
}

export const createReportEntry = async (payload) => {
  const response = await http.post('/admin/report-entries', payload)
  return normalizePayload(response, {})
}

export const updateReportEntry = async (id, payload) => {
  const response = await http.put(`/admin/report-entries/${encodeURIComponent(id)}`, payload)
  return normalizePayload(response, {})
}

export const deleteReportEntry = async (id) => {
  const response = await http.delete(`/admin/report-entries/${encodeURIComponent(id)}`)
  return normalizePayload(response, {})
}

export default {
  fetchReportEntries,
  fetchReportEntryDialogText,
  saveReportEntryDialogText,
  createReportEntry,
  updateReportEntry,
  deleteReportEntry,
}
