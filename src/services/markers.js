import http from './http'
import { normalizeFileEntry, normalizeFileList } from './files'

export const MARKER_REVIEW_STATUS = {
  ALL: 'ALL',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  DRAFT: 'DRAFT',
}

export const MARKER_SORT_BY = {
  CREATED_AT: 'CREATED_AT',
  CERTIFICATION_EXPIRE_AT: 'CERTIFICATION_EXPIRE_AT',
}

const normalizeMarker = (marker = {}) => {
  const imageResources = normalizeFileList(marker.images)
  const attachmentResources = normalizeFileList(marker.attachments || marker.attachmentUrls)
  const qrCodeResources = normalizeFileList(marker.qrCodeUrls)
  const businessLicenseResource = normalizeFileEntry(marker.businessLicense)
  const legacyVideoChannelResources = normalizeFileList(marker.videoChannelUrls)

  return {
    ...marker,
    rejectDetail: marker.reviewRejectDetail || marker.rejectDetail || '',
    images: imageResources.map((item) => item.url),
    imageResources,
    attachments: attachmentResources,
    attachmentUrls: attachmentResources.map((item) => item.url),
    qrCodeResources,
    qrCodeUrls: qrCodeResources.map((item) => item.url),
    videoChannelResources: legacyVideoChannelResources,
    videoChannelUrls: legacyVideoChannelResources.map((item) => item.url),
    videoChannelId: marker.videoChannelId || '',
    videoId: marker.videoId || '',
    businessLicense: businessLicenseResource?.url || marker.businessLicense || '',
    businessLicenseResource,
  }
}

export const fetchMarkers = async ({
  page = 1,
  size = 10,
  status = MARKER_REVIEW_STATUS.ALL,
  sortOrder = 'DESC',
  sortBy = MARKER_SORT_BY.CREATED_AT,
  draft,
} = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
  }

  if (status && ![MARKER_REVIEW_STATUS.ALL, MARKER_REVIEW_STATUS.DRAFT].includes(status)) {
    params.status = status
  }

  if (sortOrder) {
    params.sortOrder = sortOrder
  }

  if (sortBy) {
    params.sortBy = sortBy
  }

  if (typeof draft === 'boolean') {
    params.draft = draft
  }

  const { data } = await http.get('/markers', { params })
  const payload = data?.data || {}

  return {
    content: Array.isArray(payload.content)
      ? payload.content.map((item) => normalizeMarker(item))
      : [],
    page: typeof payload.page === 'number' ? payload.page + 1 : page,
    size: payload.size || size,
    totalElements: payload.totalElements || 0,
    totalPages: payload.totalPages || 0,
  }
}

export const reviewMarker = async (markerId, status, rejectDetail) => {
  if (!markerId) throw new Error('markerId is required')
  const payload = { status }
  if (typeof rejectDetail === 'string' && rejectDetail.trim()) {
    payload.rejectDetail = rejectDetail.trim()
  }
  if (import.meta.env.DEV) {
    console.info('[reviewMarker] request', {
      baseURL: http.defaults.baseURL,
      markerId,
      status,
      rejectDetail: payload.rejectDetail,
    })
  }
  const { data } = await http.post(`/markers/${markerId}/review`, payload)
  return normalizeMarker(data?.data)
}

export const fetchPendingMarkersCount = async () => {
  const { data } = await http.get('/markers/pending/count')
  return data?.data?.count ?? 0
}

export default {
  fetchMarkers,
  reviewMarker,
  fetchPendingMarkersCount,
  MARKER_SORT_BY,
}
