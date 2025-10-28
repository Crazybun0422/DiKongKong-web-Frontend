import http, { API_BASE_URL } from './http'

const PROFILE_BASE = '/auth/profile'
const FILE_UPLOAD = '/files/upload'

const apiRoot = API_BASE_URL.replace(/\/$/, '')

const buildDownloadUrl = (objectName) => {
  if (!objectName) return ''
  return `${apiRoot}/files/download/${encodeURIComponent(objectName)}`
}

const extractObjectName = (value) => {
  if (!value) return ''
  if (value.includes('/files/download/')) {
    return decodeURIComponent(value.split('/files/download/')[1] || '')
  }
  const storageMatch = value.match(/\/storage\/(.+)$/)
  if (storageMatch) {
    return decodeURIComponent(storageMatch[1])
  }
  if (/^https?:\/\//i.test(value)) {
    return ''
  }
  return value.replace(/^\/+/, '')
}

const normalizeAvatar = (value) => {
  const objectName = extractObjectName(value)
  return {
    avatarUrl: objectName ? buildDownloadUrl(objectName) : value || '',
    avatarObjectName: objectName,
    avatarOriginal: value || '',
  }
}

export const fetchProfile = () =>
  http.get(PROFILE_BASE).then((res) => {
    const data = res.data?.data || res.data
    if (data) {
      const normalized = normalizeAvatar(data.avatarUrl)
      data.avatarUrl = normalized.avatarUrl
      data.avatarObjectName = normalized.avatarObjectName
      data.avatarOriginal = normalized.avatarOriginal
    }
    return data
  })

export const updateProfile = (payload) =>
  http.put(PROFILE_BASE, payload).then((res) => {
    const data = res.data?.data || res.data
    if (data) {
      const normalized = normalizeAvatar(data.avatarUrl)
      data.avatarUrl = normalized.avatarUrl
      data.avatarObjectName = normalized.avatarObjectName
      data.avatarOriginal = normalized.avatarOriginal
    }
    return data
  })

export const uploadAvatar = async (file) => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await http.post(FILE_UPLOAD, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  const data = response.data?.data || response.data
  const raw = typeof data === 'string' ? data : data?.objectName || data?.url || ''
  const objectName = extractObjectName(raw) || raw
  return {
    objectName,
    url: buildDownloadUrl(objectName),
    original: objectName,
  }
}

export const resolveProfileAsset = (value) => normalizeAvatar(value).avatarUrl

export default {
  fetchProfile,
  updateProfile,
  uploadAvatar,
  resolveProfileAsset,
}
