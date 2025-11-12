import http, { API_BASE_URL } from './http'

const PUBLIC_FILE_UPLOAD = '/files/upload'

const apiRoot = API_BASE_URL.replace(/\/$/, '')

const safeDecode = (text) => {
  if (!text) return ''
  try {
    return decodeURIComponent(text)
  } catch (error) {
    return text
  }
}

export const buildDownloadUrl = (objectName) => {
  if (!objectName) return ''
  if (/^https?:\/\//i.test(objectName)) {
    return objectName
  }
  return `${apiRoot}/files/download/${encodeURIComponent(objectName)}`
}

export const extractObjectName = (value) => {
  if (!value || typeof value !== 'string') return ''

  const trimmed = value.trim()
  if (!trimmed) return ''

  const withoutQuery = trimmed.split(/[?#]/)[0]

  if (withoutQuery.includes('/files/download/')) {
    const objectName = withoutQuery.split('/files/download/').pop() || ''
    return safeDecode(objectName)
  }

  const storageMatch = withoutQuery.match(/\/storage\/(.+)$/)
  if (storageMatch) {
    return safeDecode(storageMatch[1])
  }

  const looksLikePath =
    withoutQuery.startsWith('/') ||
    withoutQuery.startsWith('./') ||
    withoutQuery.startsWith('../') ||
    /^[a-z]+:\/\//i.test(withoutQuery) ||
    withoutQuery.includes('\\')

  if (looksLikePath) {
    const segments = withoutQuery.split(/[\\/]/).filter(Boolean)
    const lastSegment = segments[segments.length - 1] || ''
    return safeDecode(lastSegment)
  }

  return safeDecode(withoutQuery.replace(/^\/+/, ''))
}

const deriveFileName = (value) => {
  if (!value) return ''
  const decoded = decodeURIComponent(String(value))
  const segments = decoded.split(/[\\/]/)
  const name = segments[segments.length - 1]
  return name || decoded
}

export const normalizeFileEntry = (entry) => {
  if (!entry) return null

  if (typeof entry === 'string') {
    const objectName = extractObjectName(entry)
    if (objectName) {
      return {
        name: deriveFileName(objectName),
        url: buildDownloadUrl(objectName),
        objectName,
        original: entry,
      }
    }
    return {
      name: deriveFileName(entry),
      url: entry,
      objectName: '',
      original: entry,
    }
  }

  if (typeof entry === 'object') {
    const objectNameCandidate = entry.objectName || entry.path || entry.key || ''
    const objectName = extractObjectName(objectNameCandidate || entry.url || '') || objectNameCandidate
    const hasHttpUrl = typeof entry.url === 'string' && /^https?:\/\//i.test(entry.url)
    const url = hasHttpUrl
      ? entry.url
      : objectName
        ? buildDownloadUrl(objectName)
        : entry.url || ''

    const nameSource = entry.name || entry.fileName || entry.displayName || objectName || entry.url

    return {
      name: deriveFileName(nameSource),
      url,
      objectName: objectName || '',
      original: entry,
    }
  }

  return null
}

export const normalizeFileList = (entries) => {
  if (!Array.isArray(entries)) return []
  return entries
    .map((item) => normalizeFileEntry(item))
    .filter((item) => item && item.url)
}

export const uploadPublicFile = async (file) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await http.post(PUBLIC_FILE_UPLOAD, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  const data = response.data?.data ?? response.data ?? ''
  const raw = typeof data === 'string' ? data : data?.objectName || data?.url || ''
  const objectName = extractObjectName(raw) || raw.replace(/^\/+/, '')

  return {
    objectName,
    url: objectName ? buildDownloadUrl(objectName) : '',
    original: raw,
  }
}

export default {
  buildDownloadUrl,
  extractObjectName,
  normalizeFileEntry,
  normalizeFileList,
  uploadPublicFile,
}
