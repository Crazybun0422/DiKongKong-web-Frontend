import http, { API_BASE_URL, AUTH_TOKEN_KEY } from './http'

export const LOW_ALTITUDE_CIRCLE_REVIEW_STATUS = {
  ALL: 'ALL',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
}

const normalizePagePayload = (response, fallback = {}) => {
  const data = response?.data?.data ?? response?.data ?? fallback
  return data
}

const normalizeCircle = (circle = {}) => ({
  ...circle,
  listed: circle.listed !== false,
  likeCount: Number.isFinite(Number(circle.likeCount)) ? Number(circle.likeCount) : 0,
  rejectReason: circle.rejectReason || '',
  showcaseImages: Array.isArray(circle.showcaseImages) ? circle.showcaseImages : [],
})

export const fetchAdminLowAltitudeCircles = async ({
  page = 1,
  size = 10,
  status = LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.ALL,
} = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
  }
  if (status && status !== LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.ALL) {
    params.status = status
  }
  const response = await http.get('/admin/low-altitude-circles', { params })
  const payload = normalizePagePayload(response, {})
  return {
    content: Array.isArray(payload.content) ? payload.content.map((item) => normalizeCircle(item)) : [],
    page: typeof payload.page === 'number' ? payload.page + 1 : page,
    size: payload.size || size,
    totalElements: payload.totalElements || 0,
    totalPages: payload.totalPages || 0,
  }
}

export const reviewLowAltitudeCircle = async (circleId, status, rejectReason, sortOrder) => {
  if (!circleId) throw new Error('circleId is required')
  const payload = { status }
  if (typeof rejectReason === 'string' && rejectReason.trim()) {
    payload.rejectReason = rejectReason.trim()
  }
  if (sortOrder !== undefined && sortOrder !== null && sortOrder !== '') {
    const numericSort = Number(sortOrder)
    if (Number.isFinite(numericSort)) {
      payload.sortOrder = numericSort
    }
  }
  const response = await http.post(`/admin/low-altitude-circles/${circleId}/review`, payload)
  return normalizeCircle(normalizePagePayload(response, {}))
}

export const updateLowAltitudeCircleListing = async (circleId, listed) => {
  if (!circleId) throw new Error('circleId is required')
  const response = await http.put(`/admin/low-altitude-circles/${circleId}/listing`, {
    listed: Boolean(listed),
  })
  return normalizeCircle(normalizePagePayload(response, {}))
}

export const updateAdminLowAltitudeCircle = async (circleId, payload) => {
  if (!circleId) throw new Error('circleId is required')
  const response = await http.put(`/admin/low-altitude-circles/${circleId}`, payload)
  return normalizeCircle(normalizePagePayload(response, {}))
}

export const fetchAdminLowAltitudeCircleReceipts = async (circleId, {
  scope = 'CIRCLE',
  page = 1,
  size = 10,
} = {}) => {
  if (!circleId) throw new Error('circleId is required')
  const response = await http.get(`/admin/low-altitude-circles/${circleId}/receipts`, {
    params: {
      scope,
      page: Math.max(page - 1, 0),
      size,
    },
  })
  const payload = normalizePagePayload(response, {})
  return {
    content: Array.isArray(payload.content) ? payload.content : [],
    page: typeof payload.page === 'number' ? payload.page + 1 : page,
    size: payload.size || size,
    totalElements: payload.totalElements || 0,
    totalPages: payload.totalPages || 0,
  }
}

export const startLowAltitudeCircleExport = async ({ all = false, ids = [], status } = {}) => {
  const payload = { all, ids }
  if (status && status !== LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.ALL) payload.status = status
  const response = await http.post('/admin/low-altitude-circles/batch/export/jobs', payload)
  return normalizePagePayload(response, {})
}

export const startLowAltitudeCircleImport = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await http.post('/admin/low-altitude-circles/batch/import/jobs', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return normalizePagePayload(response, {})
}

export const subscribeLowAltitudeCircleBatchJob = async (jobId, onProgress, signal) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  const response = await fetch(`${API_BASE_URL}/admin/low-altitude-circles/batch/jobs/${encodeURIComponent(jobId)}/events`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  })
  if (!response.ok || !response.body) throw new Error('batch event stream unavailable')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() || ''
    events.forEach((event) => {
      const data = event.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('')
      if (!data) return
      try { onProgress?.(JSON.parse(data)) } catch (error) { console.warn('Invalid batch progress event', error) }
    })
    if (done) break
  }
}

export const downloadLowAltitudeCircleExport = async (jobId, fileName = 'low-altitude-circles.xlsx') => {
  const response = await http.get(`/admin/low-altitude-circles/batch/jobs/${jobId}/download`, {
    responseType: 'blob',
    timeout: 60000,
  })
  const url = URL.createObjectURL(response.data)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export default {
  fetchAdminLowAltitudeCircles,
  fetchAdminLowAltitudeCircleReceipts,
  reviewLowAltitudeCircle,
  updateLowAltitudeCircleListing,
  updateAdminLowAltitudeCircle,
  LOW_ALTITUDE_CIRCLE_REVIEW_STATUS,
  startLowAltitudeCircleExport,
  startLowAltitudeCircleImport,
  subscribeLowAltitudeCircleBatchJob,
  downloadLowAltitudeCircleExport,
}
