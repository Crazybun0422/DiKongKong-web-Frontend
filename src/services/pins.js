import http from './http'
import { normalizeFileList, normalizeFileEntry } from './files'

export const PIN_VISIBILITY = {
  PRIVATE: 'PRIVATE',
  GROUP: 'GROUP',
  PUBLIC: 'PUBLIC',
}

export const PIN_REVIEW_STATUS = {
  PENDING: 'PENDING',
  APPROVED_A: 'APPROVED_A',
  APPROVED_B: 'APPROVED_B',
  REJECTED: 'REJECTED',
}

export const PIN_STATUS = {
  ALIVE: 'ALIVE',
  BANNED: 'BANNED',
}

const normalizePin = (pin = {}) => {
  const imageResources = normalizeFileList(pin.images)
  const attachmentResources = normalizeFileList(pin.attachments || pin.attachmentUrls)
  const qrCodeResources = normalizeFileList(pin.qrCodeUrls)
  const businessLicenseResource = normalizeFileEntry(pin.businessLicense)

  return {
    ...pin,
    images: imageResources.map((item) => item.url),
    imageResources,
    attachments: attachmentResources,
    attachmentUrls: attachmentResources.map((item) => item.url),
    qrCodeResources,
    qrCodeUrls: qrCodeResources.map((item) => item.url),
    businessLicense: businessLicenseResource?.url || pin.businessLicense || '',
    businessLicenseResource,
  }
}

export const fetchPins = async ({ page = 1, size = 10, visibility, reviewStatus } = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
  }

  if (visibility) {
    params.visibility = visibility
  }

  if (reviewStatus) {
    params.reviewStatus = reviewStatus
  }

  const { data } = await http.get('/admin/pins', { params })
  const payload = data?.data || {}

  return {
    content: Array.isArray(payload.content)
      ? payload.content.map((item) => normalizePin(item))
      : [],
    page: typeof payload.page === 'number' ? payload.page + 1 : page,
    size: payload.size || size,
    totalElements: payload.totalElements || 0,
    totalPages: payload.totalPages || 0,
  }
}

export const reviewPin = async (pinId, status) => {
  if (!pinId) throw new Error('pinId is required')
  const { data } = await http.post(`/admin/pins/${pinId}/review`, { status })
  return normalizePin(data?.data)
}

export const updatePinStatus = async (pinId, status) => {
  if (!pinId) throw new Error('pinId is required')
  const { data } = await http.post(`/admin/pins/${pinId}/status`, { status })
  return normalizePin(data?.data)
}

export default {
  fetchPins,
  reviewPin,
  updatePinStatus,
}
