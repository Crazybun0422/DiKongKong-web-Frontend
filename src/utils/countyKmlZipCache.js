const COUNTY_KML_CACHE_NAME = 'dikongkong-county-kml-zip-cache'
const COUNTY_KML_CACHE_META_KEY = 'dikongkong_county_kml_zip_meta'

const getCacheMeta = () => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(COUNTY_KML_CACHE_META_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (_) {
    return null
  }
}

const setCacheMeta = (meta) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COUNTY_KML_CACHE_META_KEY, JSON.stringify(meta || {}))
  } catch (_) { }
}

const clearCacheMeta = () => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(COUNTY_KML_CACHE_META_KEY)
  } catch (_) { }
}

const supportsCacheStorage = () =>
  typeof window !== 'undefined' &&
  typeof window.caches !== 'undefined' &&
  typeof window.caches.open === 'function'

const buildCacheRequestUrl = (version) => `/_local_cache/county-kml-zip/${encodeURIComponent(version || 'latest')}.zip`

const readCachedZipBlob = async (version) => {
  if (!supportsCacheStorage()) return null
  const cache = await window.caches.open(COUNTY_KML_CACHE_NAME)
  const response = await cache.match(buildCacheRequestUrl(version))
  return response ? response.blob() : null
}

const writeCachedZipBlob = async (version, blob) => {
  if (!supportsCacheStorage() || !(blob instanceof Blob)) return
  const cache = await window.caches.open(COUNTY_KML_CACHE_NAME)
  const requestUrl = buildCacheRequestUrl(version)
  await cache.put(requestUrl, new Response(blob, {
    headers: {
      'Content-Type': 'application/zip',
      'X-DiKongKong-Version': version || '',
    },
  }))
}

const clearCachedZipBlobs = async () => {
  if (!supportsCacheStorage()) return
  await window.caches.delete(COUNTY_KML_CACHE_NAME)
}

const createTreeNode = (title, key, extra = {}) => ({
  title,
  key,
  ...extra,
})

const normalizeZipPath = (value) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/')
    .trim()

const buildTreeDataFromFiles = (files = []) => {
  const root = []
  const nodeMap = new Map()
  const kmlPathMap = new Map()

  files.forEach((file) => {
    const normalizedPath = normalizeZipPath(file?.path)
    if (!normalizedPath) return
    kmlPathMap.set(normalizedPath, normalizedPath)
  })

  const ensureNode = (pathSegments, isLeaf, rawPath) => {
    let parentChildren = root
    let currentPath = ''
    pathSegments.forEach((segment, index) => {
      currentPath = currentPath ? `${currentPath}/${segment}` : segment
      const isCurrentLeaf = isLeaf && index === pathSegments.length - 1
      const folderMatchPath = `${currentPath}/${segment}.kml`
      const folderRawPath = kmlPathMap.get(folderMatchPath) || null
      let node = nodeMap.get(currentPath)
      if (!node) {
        node = createTreeNode(segment, currentPath, {
          isLeaf: isCurrentLeaf,
          selectable: isCurrentLeaf || Boolean(folderRawPath),
          children: isCurrentLeaf ? undefined : [],
          rawPath: isCurrentLeaf ? rawPath : (folderRawPath || undefined),
        })
        nodeMap.set(currentPath, node)
        parentChildren.push(node)
      } else if (isCurrentLeaf) {
        node.isLeaf = true
        node.selectable = true
        node.rawPath = rawPath
        delete node.children
      } else if (folderRawPath) {
        node.selectable = true
        node.rawPath = folderRawPath
      }
      if (!isCurrentLeaf) {
        if (!Array.isArray(node.children)) {
          node.children = []
        }
        parentChildren = node.children
      }
    })
  }

  files.forEach((file) => {
    const normalizedPath = normalizeZipPath(file?.path)
    if (!normalizedPath) return
    const pathSegments = normalizedPath.split('/').filter(Boolean)
    if (!pathSegments.length) return
    ensureNode(pathSegments, true, normalizedPath)
  })

  const sortNodes = (nodes) => {
    nodes.sort((left, right) => {
      const leftFolder = Array.isArray(left?.children) && left.children.length >= 0
      const rightFolder = Array.isArray(right?.children) && right.children.length >= 0
      if (leftFolder !== rightFolder) return leftFolder ? -1 : 1
      return String(left?.title || '').localeCompare(String(right?.title || ''), 'zh-Hans-CN')
    })
    nodes.forEach((node) => {
      if (Array.isArray(node.children)) {
        sortNodes(node.children)
      }
    })
  }

  sortNodes(root)
  return root
}

const collectDefaultExpandedKeys = (treeData = []) => {
  const keys = []
  treeData.forEach((node) => {
    if (!node?.isLeaf && node?.key) {
      keys.push(node.key)
    }
  })
  return keys
}

const emitProgress = (onProgress, payload) => {
  if (typeof onProgress === 'function') {
    onProgress(payload)
  }
}

const loadZipTexts = async (blob, onProgress) => {
  const { default: JSZip } = await import('jszip')
  emitProgress(onProgress, {
    phase: 'unzipping',
    progressPercent: 1,
    current: 0,
    total: 0,
    message: '开始解压县级区域压缩包',
  })
  const zip = await JSZip.loadAsync(blob)
  const fileEntries = Object.values(zip.files)
    .filter((entry) => !entry.dir && /\.kml$/i.test(entry.name || ''))
    .sort((left, right) => String(left.name || '').localeCompare(String(right.name || ''), 'zh-Hans-CN'))

  const fileMap = new Map()
  const files = []
  const total = fileEntries.length || 1

  for (let index = 0; index < fileEntries.length; index += 1) {
    const entry = fileEntries[index]
    const text = await entry.async('text')
    const path = normalizeZipPath(entry.name)
    fileMap.set(path, text)
    files.push({ path })
    emitProgress(onProgress, {
      phase: 'unzipping',
      progressPercent: Math.max(1, Math.min(100, Math.round(((index + 1) / total) * 100))),
      current: index + 1,
      total,
      currentPath: path,
      message: `正在解压 ${path}`,
    })
  }

  return {
    files,
    fileMap,
    treeData: buildTreeDataFromFiles(files),
  }
}

export const clearCountyKmlZipCache = async () => {
  await clearCachedZipBlobs()
  clearCacheMeta()
}

export const loadCountyKmlZipIndex = async ({
  fetchConfig,
  downloadLatest,
  forceDownload = false,
  onProgress,
}) => {
  if (typeof fetchConfig !== 'function' || typeof downloadLatest !== 'function') {
    throw new Error('loadCountyKmlZipIndex requires fetchConfig and downloadLatest callbacks')
  }

  emitProgress(onProgress, {
    phase: 'checking',
    progressPercent: 0,
    message: '正在检查县级区域压缩包版本',
  })

  const remoteMeta = await fetchConfig()
  const version = String(remoteMeta?.version || '').trim()
  if (!version) {
    throw new Error('县级区域压缩包版本不存在')
  }

  const localMeta = getCacheMeta()
  let zipBlob = !forceDownload && localMeta?.version === version
    ? await readCachedZipBlob(version)
    : null

  if (!zipBlob) {
    emitProgress(onProgress, {
      phase: 'downloading',
      progressPercent: 0,
      message: '正在下载最新县级区域压缩包',
    })
    const downloadResult = await downloadLatest({
      onDownloadProgress: (event) => {
        const total = Number(event?.total || 0)
        const loaded = Number(event?.loaded || 0)
        const percent = total > 0 ? Math.round((loaded / total) * 100) : 0
        emitProgress(onProgress, {
          phase: 'downloading',
          progressPercent: Math.max(0, Math.min(100, percent)),
          loaded,
          total,
          message: '正在下载最新县级区域压缩包',
        })
      },
    }, remoteMeta)

    zipBlob = downloadResult?.blob instanceof Blob
      ? downloadResult.blob
      : new Blob([downloadResult?.blob || ''], { type: 'application/zip' })

    await clearCachedZipBlobs()
    await writeCachedZipBlob(version, zipBlob)
    setCacheMeta({
      version,
      fileName: remoteMeta?.fileName || '',
      cachedAt: Date.now(),
    })
  }

  const parsed = await loadZipTexts(zipBlob, onProgress)
  const treeData = parsed.treeData
  const expandedKeys = collectDefaultExpandedKeys(treeData)

  emitProgress(onProgress, {
    phase: 'ready',
    progressPercent: 100,
    message: '县级区域压缩包已就绪',
  })

  return {
    version,
    fileName: remoteMeta?.fileName || '',
    treeData,
    expandedKeys,
    fileMap: parsed.fileMap,
  }
}
