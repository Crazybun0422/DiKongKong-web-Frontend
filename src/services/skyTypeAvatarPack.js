import http, { API_BASE_URL } from './http'
import { extractObjectName } from './files'

const apiRoot = API_BASE_URL.replace(/\/$/, '')

const normalizePayload = (response, fallback = {}) => response?.data?.data ?? response?.data ?? fallback

export const fetchSkyTypeAvatarPackVersion = async () => {
  const response = await http.get('/xingge-image-packs/version')
  return normalizePayload(response, { fileName: '', version: '' })
}

export const uploadSkyTypeAvatarPack = async (file, version) => {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('version', version)

  const response = await http.post('/xingge-image-packs/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  return normalizePayload(response, {})
}

export const buildSkyTypeAvatarPackDownloadUrl = (objectName) => {
  const normalized = extractObjectName(objectName)
  if (!normalized) return ''
  return `${apiRoot}/xingge-image-packs/download/${encodeURIComponent(normalized)}`
}

export default {
  fetchSkyTypeAvatarPackVersion,
  uploadSkyTypeAvatarPack,
  buildSkyTypeAvatarPackDownloadUrl,
}
