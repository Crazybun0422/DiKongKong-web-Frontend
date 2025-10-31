import { API_BASE_URL } from './http'

const apiRoot = API_BASE_URL.replace(/\/$/, '')

export const buildDownloadUrl = (objectName) => {
  if (!objectName) return ''
  if (/^https?:\/\//i.test(objectName)) {
    return objectName
  }
  return `${apiRoot}/files/download/${encodeURIComponent(objectName)}`
}

export const extractObjectName = (value) => {
  if (!value) return ''
  if (typeof value !== 'string') return ''

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

export default {
  buildDownloadUrl,
  extractObjectName,
  normalizeFileEntry,
  normalizeFileList,
}
