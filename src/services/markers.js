import http from './http'

export const MARKER_REVIEW_STATUS = {
  ALL: 'ALL',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
}

export const fetchMarkers = async ({ page = 1, size = 10, status = MARKER_REVIEW_STATUS.ALL } = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
  }

  if (status && status !== MARKER_REVIEW_STATUS.ALL) {
    params.reviewStatus = status
  }

  const { data } = await http.get('/markers', { params })
  const payload = data?.data || {}

  return {
    content: payload.content || [],
    page: typeof payload.page === 'number' ? payload.page + 1 : page,
    size: payload.size || size,
    totalElements: payload.totalElements || 0,
    totalPages: payload.totalPages || 0,
  }
}

export const reviewMarker = async (markerId, status) => {
  if (!markerId) throw new Error('markerId is required')
  const { data } = await http.post(`/markers/${markerId}`, { status })
  return data?.data
}

export default {
  fetchMarkers,
  reviewMarker,
}
