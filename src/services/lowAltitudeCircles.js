import http from './http'

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

export default {
  fetchAdminLowAltitudeCircles,
  reviewLowAltitudeCircle,
  LOW_ALTITUDE_CIRCLE_REVIEW_STATUS,
}
