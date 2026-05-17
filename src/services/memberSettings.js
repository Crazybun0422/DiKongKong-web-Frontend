import http, { API_BASE_URL } from './http'
import { extractObjectName } from './files'

const apiRoot = API_BASE_URL.replace(/\/$/, '')

const normalizePagePayload = (response, fallback = {}) => response?.data?.data ?? response?.data ?? fallback
const toPageResult = (payload = {}, defaults = {}) => ({
  content: Array.isArray(payload.content) ? payload.content : [],
  page: typeof payload.page === 'number' ? payload.page + 1 : defaults.page ?? 1,
  size: payload.size ?? defaults.size ?? 10,
  totalElements: payload.totalElements ?? defaults.totalElements ?? 0,
  totalPages: payload.totalPages ?? defaults.totalPages ?? 0,
})

const uploadPack = async (endpoint, file, version) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('version', version)

  const response = await http.post(endpoint, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  return normalizePagePayload(response, {})
}

export const buildAvatarPackDownloadUrl = (objectName) => {
  const normalized = extractObjectName(objectName)
  if (!normalized) return ''
  return `${apiRoot}/avatar-packs/download/${encodeURIComponent(normalized)}`
}

export const buildVoicePackDownloadUrl = (objectName) => {
  const normalized = extractObjectName(objectName)
  if (!normalized) return ''
  return `${apiRoot}/voice-packs/download/${encodeURIComponent(normalized)}`
}

export const buildBackgroundImagePackDownloadUrl = (objectName) => {
  const normalized = extractObjectName(objectName)
  if (!normalized) return ''
  return `${apiRoot}/background-image-packs/download/${encodeURIComponent(normalized)}`
}

const fetchPackVersion = async (endpoint) => {
  const response = await http.get(endpoint)
  return normalizePagePayload(response, { fileName: '', version: '' })
}

export const fetchMemberRechargeConfig = async () => {
  const response = await http.get('/config/member-recharge')
  return normalizePagePayload(response, {})
}

export const saveMemberRechargeConfig = async (payload) => {
  const response = await http.put('/config/member-recharge', payload)
  return normalizePagePayload(response, {})
}

export const fetchMemberInviteRewardConfig = async () => {
  const response = await http.get('/config/member-invite-reward')
  return normalizePagePayload(response, {})
}

export const saveMemberInviteRewardConfig = async (payload) => {
  const response = await http.put('/config/member-invite-reward', payload)
  return normalizePagePayload(response, {})
}

export const fetchMemberGroupQrcode = async () => {
  const response = await http.get('/config/member-group-qrcode')
  return normalizePagePayload(response, { imageUrl: '', updatedAt: null })
}

export const uploadMemberGroupQrcode = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await http.post('/config/member-group-qrcode', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  return normalizePagePayload(response, { imageUrl: '', updatedAt: null })
}

export const fetchMemberOpenLogs = async ({ page = 1, size = 10, featureCode = '' } = {}) => {
  const params = {
    page: Math.max(page - 1, 0),
    size,
  }
  const normalizedFeatureCode = String(featureCode || '').trim()
  if (normalizedFeatureCode) {
    params.featureCode = normalizedFeatureCode
  }

  const response = await http.get('/admin/users/member/logs', { params })
  const payload = normalizePagePayload(response, {})
  return toPageResult(payload, { page, size })
}

export const fetchAvatarPackVersion = async () => fetchPackVersion('/avatar-packs/version')

export const fetchVoicePackVersion = async () => fetchPackVersion('/voice-packs/version')

export const fetchBackgroundImagePackVersion = async () => fetchPackVersion('/background-image-packs/version')

export const uploadAvatarPack = async (file, version) => uploadPack('/avatar-packs/upload', file, version)

export const uploadVoicePack = async (file, version) => uploadPack('/voice-packs/upload', file, version)

export const uploadBackgroundImagePack = async (file, version) =>
  uploadPack('/background-image-packs/upload', file, version)

export default {
  buildAvatarPackDownloadUrl,
  buildVoicePackDownloadUrl,
  buildBackgroundImagePackDownloadUrl,
  fetchMemberRechargeConfig,
  saveMemberRechargeConfig,
  fetchMemberInviteRewardConfig,
  saveMemberInviteRewardConfig,
  fetchMemberGroupQrcode,
  uploadMemberGroupQrcode,
  fetchMemberOpenLogs,
  fetchAvatarPackVersion,
  fetchVoicePackVersion,
  fetchBackgroundImagePackVersion,
  uploadAvatarPack,
  uploadVoicePack,
  uploadBackgroundImagePack,
}
