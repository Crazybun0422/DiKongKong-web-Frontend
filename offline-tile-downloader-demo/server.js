import { createHash } from 'node:crypto'
import http from 'node:http'
import fs from 'node:fs/promises'
import { createReadStream, createWriteStream } from 'node:fs'
import { execFile } from 'node:child_process'
import { once } from 'node:events'
import { availableParallelism, cpus } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Worker } from 'node:worker_threads'
import { buildProvinceLayerParams, buildProvinceLayerRecords } from '../src/utils/uomProvinceSelector.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const CHINA_GEOJSON_PATH = path.resolve(__dirname, '../src/map-meta-data/China.geojson')

const HOST = process.env.OFFLINE_TILE_HOST || '127.0.0.1'
const PORT = Number(process.env.OFFLINE_TILE_PORT || 7060)
const STATIC_FILES = new Map([
  ['/', 'index.html'],
  ['/index.html', 'index.html'],
  ['/app.js', 'app.js'],
  ['/styles.css', 'styles.css'],
])
const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
}

const DEFAULT_ZOOM = 11
const WMS_MIN_ZOOM = 5
const WMS_MAX_ZOOM = 18
const OVERLAY_MIN_ZOOM = 6
const OVERLAY_MAX_ZOOM = 7
const CHINA_BOUNDS = {
  minLng: 72.004,
  maxLng: 137.8347,
  minLat: 0.8293,
  maxLat: 55.8271,
}
const CAAC_TOKEN = '1e4b78fc-06bd-45be-8af7-cabd802ea9a8'
const CAAC_BASE = 'https://uom.caac.gov.cn/map/airspace/wms'
const EPSILON = 1e-10
const TASK_META_DIR = '_offline_tile_downloader'
const WORKSPACE_DIR = 'offline-task-workspace'
const POINTER_FILE = 'latest-task.json'
const TASK_STATE_FILE = 'task-state.json'
const TASK_METADATA_FILE = 'metadata.json'
const ANCHOR_MODEL_FILE = 'anchor-model.json'
const TILE_ROOT_DIR = 'tiles'
const CHUNK_STATE_DIR = 'chunk-state'
const SPLIT_OUTPUT_DIR = 'split-packages'
const MAX_EVENTS = 80
const RETRY_BASE_DELAY_MS = 20
const RETRY_MAX_DELAY_MS = 100
const TILE_MAX_ATTEMPTS = 30
const TILE_REQUEST_TIMEOUT_MS = 10000
const STOP_ERROR_CODE = 'STOP_REQUESTED'
const PAUSE_ERROR_CODE = 'PAUSE_REQUESTED'
const TILE_UNAVAILABLE_ERROR_CODE = 'TILE_UNAVAILABLE'
const CHUNK_STATE_MAX_BYTES = 20 * 1024 * 1024
const SCAN_CHUNK_WIDTH = 8
const PROGRESS_BROADCAST_INTERVAL_MS = 250
const COUNT_PROGRESS_STEP = 100000
const HIGH_ZOOM_STAGE_MIN_ZOOM = 15
const STAGE_BUCKET_SCALE = 10000
const ZIP_MAX_CONCURRENCY = Number(process.env.OFFLINE_TILE_ZIP_MAX_CONCURRENCY || 4)
const TILE_LAYER_PARAM_CACHE_MAX = 5000
const ZIP_STORE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
  '.avif',
  '.mp4',
  '.mov',
  '.zip',
  '.kmz',
  '.gz',
  '.br',
  '.woff',
  '.woff2',
  '.ttf',
])
const CHUNK_STATUS_PRIORITY = {
  pending: 0,
  counting: 1,
  counted: 2,
  partial: 3,
  completed_unavailable: 4,
  completed: 5,
}

const runtime = {
  workspacePath: '',
  taskContext: null,
  clients: new Set(),
  activeAbortControllers: new Set(),
  inFlightTiles: new Set(),
  persistPromise: Promise.resolve(),
  runPromise: null,
  broadcastTimer: null,
  lastBroadcastAt: 0,
  events: [],
  countWorker: null,
  countWorkerDonePromise: null,
  countWorkerError: null,
  liveChunks: new Map(),
  packagePromise: null,
  packageTaskState: null,
}

const PROVINCE_LAYER_RECORDS = buildProvinceLayerRecords(
  JSON.parse(await fs.readFile(CHINA_GEOJSON_PATH, 'utf8')),
)
const TILE_LAYER_PARAM_CACHE = new Map()

function resolveZipConcurrency() {
  const manualConcurrency = Number(process.env.OFFLINE_TILE_ZIP_CONCURRENCY || 0)
  if (Number.isFinite(manualConcurrency) && manualConcurrency > 0) {
    return Math.max(1, Math.floor(manualConcurrency))
  }
  const cpuCount = typeof availableParallelism === 'function' ? availableParallelism() : (cpus()?.length || 1)
  if (process.platform === 'win32') return 1
  if (cpuCount <= 2) return 1
  return Math.max(1, Math.min(ZIP_MAX_CONCURRENCY, cpuCount - 1))
}

const ZIP_CONCURRENCY = resolveZipConcurrency()

function getLiveChunkKey(phase, chunkKey) {
  return `${phase}:${chunkKey}`
}

function setLiveChunkProgress(phase, descriptor, patch = {}) {
  if (!descriptor?.key) return
  const liveKey = getLiveChunkKey(phase, descriptor.key)
  const current = runtime.liveChunks.get(liveKey) || {
    phase,
    key: descriptor.key,
    zoom: descriptor.zoom,
    xStart: descriptor.xStart,
    xEnd: descriptor.xEnd,
    yStart: descriptor.yStart,
    yEnd: descriptor.yEnd,
    discovered: 0,
    downloaded: 0,
    totalTiles: 0,
    status: 'running',
    updatedAt: new Date().toISOString(),
  }
  runtime.liveChunks.set(liveKey, {
    ...current,
    ...patch,
    phase,
    key: descriptor.key,
    zoom: descriptor.zoom,
    xStart: descriptor.xStart,
    xEnd: descriptor.xEnd,
    yStart: descriptor.yStart,
    yEnd: descriptor.yEnd,
    updatedAt: new Date().toISOString(),
  })
  scheduleBroadcast()
}

function removeLiveChunkProgress(phase, descriptorOrKey) {
  const chunkKey = typeof descriptorOrKey === 'string' ? descriptorOrKey : descriptorOrKey?.key
  if (!chunkKey) return
  runtime.liveChunks.delete(getLiveChunkKey(phase, chunkKey))
  scheduleBroadcast()
}

function clearLiveChunkProgress() {
  runtime.liveChunks.clear()
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  res.end(`${JSON.stringify(payload)}\n`)
}

function sendError(res, status, message) {
  sendJson(res, status, { ok: false, error: message })
}

async function readRequestJson(req) {
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return {}
  return JSON.parse(raw)
}

function toNumber(value, fallback = 0) {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatTaskId(date = new Date()) {
  return `${date.getFullYear()}${pad2(date.getMonth() + 1)}${pad2(date.getDate())}-${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function makeStopError() {
  const error = new Error('Download stopped by user')
  error.code = STOP_ERROR_CODE
  return error
}

function isStopError(error) {
  return error?.code === STOP_ERROR_CODE
}

function makePauseError() {
  const error = new Error('Download paused by user')
  error.code = PAUSE_ERROR_CODE
  return error
}

function isPauseError(error) {
  return error?.code === PAUSE_ERROR_CODE
}

function makeTileUnavailableError(tileId) {
  const error = new Error(`瓦片 ${tileId} 累计尝试 ${TILE_MAX_ATTEMPTS} 次后仍不可下载，判定为放弃`)
  error.code = TILE_UNAVAILABLE_ERROR_CODE
  error.retryable = false
  return error
}

function isTileUnavailableError(error) {
  return error?.code === TILE_UNAVAILABLE_ERROR_CODE
}

function createEvent(type, message, extra = {}) {
  return {
    type,
    message,
    time: new Date().toISOString(),
    ...extra,
  }
}

function pushRuntimeEvent(type, message, extra = {}) {
  runtime.events.unshift(createEvent(type, message, extra))
  if (runtime.events.length > MAX_EVENTS) {
    runtime.events.length = MAX_EVENTS
  }
  scheduleBroadcast(true)
}

function sanitizeTaskStateForSnapshot(taskState) {
  if (!taskState) return null
  return JSON.parse(JSON.stringify(taskState))
}

function buildSnapshotTaskState(taskContext) {
  const snapshotTaskState = sanitizeTaskStateForSnapshot(taskContext?.taskState || null)
  if (!snapshotTaskState || !taskContext) return snapshotTaskState

  let liveCountDelta = 0
  for (const liveChunk of runtime.liveChunks.values()) {
    if (liveChunk?.phase !== 'count') continue
    const zoomKey = String(liveChunk.zoom)
    const persistedChunk = taskContext.chunkStateMaps?.[zoomKey]?.get?.(liveChunk.key)
    const persistedDiscovered = Number(persistedChunk?.discovered || 0)
    const liveDiscovered = Number(liveChunk.discovered || 0)
    liveCountDelta += Math.max(0, liveDiscovered - persistedDiscovered)
  }

  snapshotTaskState.progress = snapshotTaskState.progress || {}
  snapshotTaskState.progress.totalTiles = Number(snapshotTaskState.progress.totalTiles || 0) + liveCountDelta
  return snapshotTaskState
}

function makeSnapshot() {
  const splitOutputDefaultPath = runtime.workspacePath
    ? path.join(runtime.workspacePath, SPLIT_OUTPUT_DIR)
    : ''
  return {
    ok: true,
    data: {
      workspacePath: runtime.workspacePath,
      workspaceLabel: runtime.workspacePath ? path.basename(runtime.workspacePath) : '',
      taskState: buildSnapshotTaskState(runtime.taskContext || null),
      packageTask: runtime.packageTaskState ? JSON.parse(JSON.stringify(runtime.packageTaskState)) : null,
      splitOutputDefaultPath,
      activeRequests: runtime.activeAbortControllers.size,
      running: Boolean(runtime.runPromise),
      overlay: { minZoom: OVERLAY_MIN_ZOOM, maxZoom: OVERLAY_MAX_ZOOM },
      events: runtime.events,
      liveChunks: Array.from(runtime.liveChunks.values()).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))),
      serverTime: new Date().toISOString(),
    },
  }
}

function encodeWsFrame(text) {
  const payload = Buffer.from(text)
  const length = payload.length
  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payload])
  }
  if (length < 65536) {
    const header = Buffer.alloc(4)
    header[0] = 0x81
    header[1] = 126
    header.writeUInt16BE(length, 2)
    return Buffer.concat([header, payload])
  }
  const header = Buffer.alloc(10)
  header[0] = 0x81
  header[1] = 127
  header.writeBigUInt64BE(BigInt(length), 2)
  return Buffer.concat([header, payload])
}

function broadcastSnapshotNow() {
  runtime.lastBroadcastAt = Date.now()
  const frame = encodeWsFrame(JSON.stringify({ type: 'snapshot', ...makeSnapshot() }))
  for (const socket of runtime.clients) {
    if (socket.destroyed) {
      runtime.clients.delete(socket)
      continue
    }
    socket.write(frame)
  }
}

function scheduleBroadcast(force = false) {
  if (force && Date.now() - runtime.lastBroadcastAt >= PROGRESS_BROADCAST_INTERVAL_MS) {
    broadcastSnapshotNow()
    return
  }
  if (runtime.broadcastTimer) return
  runtime.broadcastTimer = setTimeout(() => {
    runtime.broadcastTimer = null
    broadcastSnapshotNow()
  }, 120)
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function readJsonFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content)
  } catch (_error) {
    return null
  }
}

async function writeJsonFile(filePath, payload) {
  await ensureDir(path.dirname(filePath))
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch (_error) {
    return false
  }
}

async function copyFileIfMissing(sourcePath, targetPath) {
  if (await fileExists(targetPath)) return false
  await ensureDir(path.dirname(targetPath))
  await fs.copyFile(sourcePath, targetPath)
  return true
}

async function mergeTileTree(sourceDir, targetDir) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true })
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)
    if (entry.isDirectory()) {
      await ensureDir(targetPath)
      await mergeTileTree(sourcePath, targetPath)
      continue
    }
    await copyFileIfMissing(sourcePath, targetPath)
  }
}

function buildTaskFolderName() {
  return WORKSPACE_DIR
}

function getWorkspaceDir(baseDir) {
  return path.join(baseDir, WORKSPACE_DIR)
}

function getMetaDir(baseDir) {
  return path.join(baseDir, TASK_META_DIR)
}

function getChunkStateBaseDir(taskDir) {
  return path.join(taskDir, TASK_META_DIR, CHUNK_STATE_DIR)
}

function getChunkStateZoomDir(taskDir, zoom) {
  return path.join(getChunkStateBaseDir(taskDir), `z${zoom}`)
}

function buildChunkKey(zoom, xStart, xEnd, yStart, yEnd) {
  return `${zoom}:${xStart}:${xEnd}:${yStart}:${yEnd}`
}

function normalizeStagePercent(value, fallback) {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return clamp(num, 0, 100)
}

function normalizeTaskOptions(options = {}) {
  let stageStartPercent = normalizeStagePercent(options?.highZoomStageStartPercent ?? options?.highZoomStage?.startPercent, 0)
  let stageEndPercent = normalizeStagePercent(options?.highZoomStageEndPercent ?? options?.highZoomStage?.endPercent, 100)
  if (stageStartPercent > stageEndPercent) {
    [stageStartPercent, stageEndPercent] = [stageEndPercent, stageStartPercent]
  }
  return {
    autoShutdown: Boolean(options?.autoShutdown),
    highZoomStage: {
      minZoom: HIGH_ZOOM_STAGE_MIN_ZOOM,
      startPercent: stageStartPercent,
      endPercent: stageEndPercent,
    },
  }
}

function uniqueStringArray(values = []) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter((item) => typeof item === 'string' && item)))
}

function mergeDeferredTiles(existingTiles = [], incomingTiles = []) {
  const merged = new Map()
  for (const tile of [...existingTiles, ...incomingTiles]) {
    if (!tile?.id) continue
    const current = merged.get(tile.id)
    if (!current) {
      merged.set(tile.id, {
        id: tile.id,
        x: Number(tile.x),
        y: Number(tile.y),
        attempts: Number(tile.attempts || 0),
        lastError: tile.lastError || '',
      })
      continue
    }
    merged.set(tile.id, {
      ...current,
      x: Number.isFinite(Number(tile.x)) ? Number(tile.x) : current.x,
      y: Number.isFinite(Number(tile.y)) ? Number(tile.y) : current.y,
      attempts: Math.max(Number(current.attempts || 0), Number(tile.attempts || 0)),
      lastError: tile.lastError || current.lastError || '',
    })
  }
  return Array.from(merged.values())
}

function upsertDeferredTile(deferredTiles = [], tilePatch = {}) {
  return mergeDeferredTiles(deferredTiles, [tilePatch])
}

function removeDeferredTile(deferredTiles = [], tileId) {
  return (Array.isArray(deferredTiles) ? deferredTiles : []).filter((tile) => tile?.id !== tileId)
}

function stagePercentToBucket(percent, fallback) {
  const normalized = normalizeStagePercent(percent, fallback)
  return clamp(Math.round(normalized * 100), 0, STAGE_BUCKET_SCALE)
}

function tileStageBucket(zoom, x, y) {
  let hash = (Math.imul(Number(zoom) || 0, 73856093)
    ^ Math.imul(Number(x) || 0, 19349663)
    ^ Math.imul(Number(y) || 0, 83492791)) >>> 0
  hash ^= hash >>> 16
  return hash % STAGE_BUCKET_SCALE
}

function tileSelectedForTask(zoom, x, y, options = {}) {
  const normalized = normalizeTaskOptions(options)
  const stage = normalized.highZoomStage
  if (Number(zoom) < Number(stage.minZoom || HIGH_ZOOM_STAGE_MIN_ZOOM)) {
    return true
  }
  const startBucket = stagePercentToBucket(stage.startPercent, 0)
  const endBucket = stagePercentToBucket(stage.endPercent, 100)
  if (startBucket <= 0 && endBucket >= STAGE_BUCKET_SCALE) {
    return true
  }
  if (startBucket === endBucket) {
    return false
  }
  const bucket = tileStageBucket(zoom, x, y)
  return bucket >= startBucket && bucket < endBucket
}

function mergeChunkStatus(existingStatus, nextStatus) {
  const current = String(existingStatus || 'pending')
  const incoming = String(nextStatus || current)
  const currentPriority = CHUNK_STATUS_PRIORITY[current] ?? 0
  const incomingPriority = CHUNK_STATUS_PRIORITY[incoming] ?? 0
  return incomingPriority >= currentPriority ? incoming : current
}

function createEmptyLevelState(zoom) {
  return {
    zoom,
    attempted: 0,
    discovered: 0,
    downloaded: 0,
    unavailable: 0,
    retryCount: 0,
    chunkCount: 0,
    completedChunks: 0,
    partialChunks: 0,
    pendingChunks: 0,
    chunkFiles: [],
    lastUpdatedAt: null,
  }
}

function createEmptyTaskState() {
  const taskId = formatTaskId()
  return {
    version: 2,
    taskId,
    folderName: buildTaskFolderName(),
    status: 'ready',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    polygon: [],
    polygons: [],
    range: { startZoom: 6, endZoom: 7 },
    currentZoom: 6,
    concurrency: 4,
    chunking: {
      scanChunkWidth: SCAN_CHUNK_WIDTH,
      shardMaxBytes: CHUNK_STATE_MAX_BYTES,
    },
    options: normalizeTaskOptions(),
    levels: {},
    progress: {
      totalTiles: 0,
      downloadedTiles: 0,
      unavailableTiles: 0,
      handledTiles: 0,
      retryCount: 0,
      completedLevels: 0,
      totalLevels: 2,
    },
  }
}

function normalizePolygonsInput(polygons, fallbackPolygon = []) {
  const normalized = Array.isArray(polygons)
    ? polygons.map((polygon) => normalizePolygonInput(polygon)).filter((polygon) => polygon.length >= 3)
    : []
  if (normalized.length) return normalized
  const fallback = normalizePolygonInput(fallbackPolygon)
  return fallback.length >= 3 ? [fallback] : []
}

function getTaskPolygons(taskState = {}) {
  return normalizePolygonsInput(taskState?.polygons, taskState?.polygon)
}

function getPrimaryTaskPolygon(taskState = {}) {
  return getTaskPolygons(taskState)[0] || []
}

function sanitizeTaskStateForPersist(taskState) {
  return {
    version: taskState.version,
    taskId: taskState.taskId,
    folderName: taskState.folderName,
    status: taskState.status,
    createdAt: taskState.createdAt,
    updatedAt: taskState.updatedAt,
    polygon: getPrimaryTaskPolygon(taskState),
    polygons: getTaskPolygons(taskState),
    range: taskState.range,
    currentZoom: taskState.currentZoom,
    concurrency: taskState.concurrency,
    chunking: taskState.chunking,
    options: normalizeTaskOptions(taskState.options),
    levels: taskState.levels,
    progress: taskState.progress,
  }
}

function buildTaskMetadata(taskState) {
  return {
    version: taskState.version,
    taskId: taskState.taskId,
    createdAt: taskState.createdAt,
    updatedAt: taskState.updatedAt,
    status: taskState.status,
    folderName: taskState.folderName,
    polygon: getPrimaryTaskPolygon(taskState),
    polygons: getTaskPolygons(taskState),
    range: taskState.range,
    tileRootDir: TILE_ROOT_DIR,
    provider: 'CAAC UOM WMS',
    concurrency: taskState.concurrency || 1,
    chunking: taskState.chunking,
    options: normalizeTaskOptions(taskState.options),
  }
}
async function savePointer(baseDir, pointer) {
  await writeJsonFile(path.join(getMetaDir(baseDir), POINTER_FILE), pointer)
}

async function loadPointer(baseDir) {
  return readJsonFile(path.join(getMetaDir(baseDir), POINTER_FILE))
}

async function collectTaskDirectoryNames(baseDir) {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isDirectory() && entry.name !== TASK_META_DIR && (entry.name === WORKSPACE_DIR || /^offline-task-/i.test(entry.name)))
      .map((entry) => entry.name)
  } catch (_error) {
    return []
  }
}

function normalizePolygonForCompare(points = []) {
  return points.map((point) => ({
    latitude: Number(point?.latitude),
    longitude: Number(point?.longitude),
  }))
}

function normalizePolygonsForCompare(polygons = []) {
  return normalizePolygonsInput(polygons)
    .map((polygon) => normalizePolygonForCompare(polygon))
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
}

function sameTaskScope(taskState, polygons, startZoom, endZoom) {
  if (!taskState) return false
  const currentRange = taskState.range || {}
  if (Number(currentRange.startZoom) !== Number(startZoom) || Number(currentRange.endZoom) !== Number(endZoom)) {
    return false
  }
  return JSON.stringify(normalizePolygonsForCompare(getTaskPolygons(taskState))) === JSON.stringify(normalizePolygonsForCompare(polygons || []))
}

async function loadChunkStateIndex(taskDir, zoom) {
  const zoomDir = getChunkStateZoomDir(taskDir, zoom)
  const map = new Map()
  const files = []
  const startedAt = Date.now()
  try {
    const entries = await fs.readdir(zoomDir, { withFileTypes: true })
    const fileNames = entries.filter((entry) => entry.isFile() && /^part-\d+\.ndjson$/i.test(entry.name)).map((entry) => entry.name).sort()
    for (const fileName of fileNames) {
      const filePath = path.join(zoomDir, fileName)
      const stat = await fs.stat(filePath)
      const content = await fs.readFile(filePath, 'utf8')
      const lines = content.split(/\r?\n/).filter(Boolean)
      let recordCount = 0
      for (const line of lines) {
        const record = JSON.parse(line)
        if (!record?.key) continue
        map.set(record.key, record)
        recordCount += 1
      }
      files.push({ file: fileName, bytes: stat.size, records: recordCount })
    }
  } catch (_error) {
    // ignore missing state dir
  }
  if (files.length) {
    pushRuntimeEvent('chunk-state-loaded', `已加载 Z${zoom} 的 chunk 状态索引，文件 ${files.length} 个。`, {
      zoom,
      files: files.length,
      elapsedMs: Date.now() - startedAt,
    })
  }
  return { map, files }
}

function summarizeLevelFromChunkMap(zoom, chunkMap, existingLevel = null, chunkFiles = []) {
  const levelState = existingLevel ? { ...existingLevel } : createEmptyLevelState(zoom)
  let attempted = 0
  let discovered = 0
  let downloaded = 0
  let unavailable = 0
  let completedChunks = 0
  let partialChunks = 0
  let pendingChunks = 0
  let lastUpdatedAt = null

  for (const record of chunkMap.values()) {
    attempted += Number(record.attempted || 0)
    discovered += Number(record.discovered || 0)
    downloaded += Number(record.downloaded || 0)
    unavailable += Number(record.unavailable ?? record.unavailableTileIds?.length ?? 0)
    if (record.status === 'completed' || record.status === 'completed_unavailable') completedChunks += 1
    else if (record.status === 'partial') partialChunks += 1
    else pendingChunks += 1
    if (record.updatedAt && (!lastUpdatedAt || new Date(record.updatedAt) > new Date(lastUpdatedAt))) {
      lastUpdatedAt = record.updatedAt
    }
  }

  levelState.zoom = zoom
  levelState.attempted = attempted
  levelState.discovered = discovered
  levelState.downloaded = downloaded
  levelState.unavailable = unavailable
  levelState.chunkCount = chunkMap.size
  levelState.completedChunks = completedChunks
  levelState.partialChunks = partialChunks
  levelState.pendingChunks = pendingChunks
  levelState.chunkFiles = chunkFiles
  levelState.lastUpdatedAt = lastUpdatedAt
  levelState.retryCount = Number(levelState.retryCount || 0)
  return levelState
}

function refreshTaskProgressFromLevels(taskState) {
  const startZoom = Number(taskState?.range?.startZoom)
  const endZoom = Number(taskState?.range?.endZoom)
  let totalTiles = 0
  let downloadedTiles = 0
  let unavailableTiles = 0
  let retryCount = 0
  let completedLevels = 0

  Object.entries(taskState.levels || {}).forEach(([zoomKey, levelState]) => {
    const zoom = Number(zoomKey)
    if (Number.isFinite(startZoom) && Number.isFinite(endZoom) && (zoom < startZoom || zoom > endZoom)) return
    totalTiles += Number(levelState.discovered || 0)
    downloadedTiles += Number(levelState.downloaded || 0)
    unavailableTiles += Number(levelState.unavailable || 0)
    retryCount += Number(levelState.retryCount || 0)
    if (Number(levelState.chunkCount || 0) > 0 && Number(levelState.completedChunks || 0) >= Number(levelState.chunkCount || 0)) {
      completedLevels += 1
    }
  })

  taskState.progress = taskState.progress || {}
  taskState.progress.totalTiles = totalTiles
  taskState.progress.downloadedTiles = downloadedTiles
  taskState.progress.unavailableTiles = unavailableTiles
  taskState.progress.handledTiles = downloadedTiles + unavailableTiles
  taskState.progress.retryCount = retryCount
  taskState.progress.completedLevels = completedLevels
  taskState.progress.totalLevels = endZoom - startZoom + 1
}

function mergeTaskStatePayload(baseTaskState, incomingTaskState) {
  if (!incomingTaskState) return baseTaskState
  const merged = {
    ...baseTaskState,
    ...incomingTaskState,
    folderName: WORKSPACE_DIR,
    options: normalizeTaskOptions(incomingTaskState.options || baseTaskState.options),
    levels: { ...(baseTaskState.levels || {}), ...(incomingTaskState.levels || {}) },
    progress: { ...(baseTaskState.progress || {}), ...(incomingTaskState.progress || {}) },
  }
  if (incomingTaskState.updatedAt && (!baseTaskState.updatedAt || new Date(incomingTaskState.updatedAt) > new Date(baseTaskState.updatedAt))) {
    merged.polygons = normalizePolygonsInput(incomingTaskState.polygons, incomingTaskState.polygon || baseTaskState.polygon)
    merged.polygon = merged.polygons[0] || []
    merged.range = incomingTaskState.range || baseTaskState.range
    merged.currentZoom = incomingTaskState.currentZoom ?? baseTaskState.currentZoom
    merged.status = incomingTaskState.status || baseTaskState.status
    merged.concurrency = incomingTaskState.concurrency || baseTaskState.concurrency
    merged.chunking = incomingTaskState.chunking || baseTaskState.chunking
  }
  return merged
}

async function ensureWorkspaceMerged(baseDir) {
  const startedAt = Date.now()
  await ensureDir(baseDir)
  const directoryNames = await collectTaskDirectoryNames(baseDir)
  const workspaceDir = getWorkspaceDir(baseDir)
  await ensureDir(workspaceDir)
  pushRuntimeEvent('workspace-merge-start', `开始应用目录，检测到 ${directoryNames.length} 个任务目录。`, {
    baseDir,
    directoryCount: directoryNames.length,
  })

  let mergedTaskState = createEmptyTaskState()
  let mergedAnchorModel = await readJsonFile(path.join(baseDir, ANCHOR_MODEL_FILE))
  if (!normalizePolygonsInput(mergedAnchorModel?.polygons, mergedAnchorModel?.polygon).length) {
    mergedAnchorModel = null
  }

  for (const dirName of directoryNames) {
    const sourceDir = path.join(baseDir, dirName)
    const isWorkspaceDir = dirName === WORKSPACE_DIR
    const dirStartedAt = Date.now()
    pushRuntimeEvent('workspace-merge-dir', `正在处理目录 ${dirName}${isWorkspaceDir ? '（当前工作目录）' : ''}。`, {
      dirName,
      isWorkspaceDir,
    })
    const sourceTaskState = await readJsonFile(path.join(sourceDir, TASK_STATE_FILE))
    const sourceAnchorModel = await readJsonFile(path.join(sourceDir, ANCHOR_MODEL_FILE))
    mergedTaskState = mergeTaskStatePayload(mergedTaskState, sourceTaskState)

    if (normalizePolygonsInput(sourceAnchorModel?.polygons, sourceAnchorModel?.polygon).length) {
      if (!mergedAnchorModel || new Date(sourceAnchorModel.updatedAt || 0) >= new Date(mergedAnchorModel.updatedAt || 0)) {
        mergedAnchorModel = sourceAnchorModel
      }
    }

    if (!isWorkspaceDir) {
      const sourceTileRoot = path.join(sourceDir, TILE_ROOT_DIR)
      const targetTileRoot = path.join(workspaceDir, TILE_ROOT_DIR)
      if (await fileExists(sourceTileRoot)) {
        pushRuntimeEvent('workspace-merge-tiles', `正在合并 ${dirName} 的瓦片目录。`, { dirName })
        await ensureDir(targetTileRoot)
        await mergeTileTree(sourceTileRoot, targetTileRoot)
      }

      const sourceChunkBaseDir = getChunkStateBaseDir(sourceDir)
      const targetChunkBaseDir = getChunkStateBaseDir(workspaceDir)
      if (await fileExists(sourceChunkBaseDir)) {
        pushRuntimeEvent('workspace-merge-chunks', `正在合并 ${dirName} 的 chunk 状态目录。`, { dirName })
        await ensureDir(targetChunkBaseDir)
        await mergeTileTree(sourceChunkBaseDir, targetChunkBaseDir)
      }
    }

    if (dirName !== WORKSPACE_DIR) {
      await fs.rm(sourceDir, { recursive: true, force: true })
    }
    pushRuntimeEvent('workspace-merge-dir-done', `目录 ${dirName} 处理完成。`, {
      dirName,
      elapsedMs: Date.now() - dirStartedAt,
    })
  }

  mergedTaskState.polygons = normalizePolygonsInput(mergedTaskState.polygons, mergedTaskState.polygon)
  if (!mergedTaskState.polygons.length) {
    mergedTaskState.polygons = normalizePolygonsInput(mergedAnchorModel?.polygons, mergedAnchorModel?.polygon)
  }
  mergedTaskState.polygon = mergedTaskState.polygons[0] || []
  mergedTaskState.folderName = WORKSPACE_DIR
  await writeJsonFile(path.join(workspaceDir, TASK_STATE_FILE), sanitizeTaskStateForPersist(mergedTaskState))
  await writeJsonFile(path.join(workspaceDir, TASK_METADATA_FILE), buildTaskMetadata(mergedTaskState))
  const mergedAnchorPolygons = normalizePolygonsInput(mergedAnchorModel?.polygons, mergedAnchorModel?.polygon || mergedTaskState.polygon || [])
  await writeJsonFile(path.join(workspaceDir, ANCHOR_MODEL_FILE), {
    version: 1,
    taskId: mergedTaskState.taskId,
    updatedAt: mergedTaskState.updatedAt,
    polygon: mergedAnchorPolygons[0] || mergedTaskState.polygon || [],
    polygons: mergedAnchorPolygons.length ? mergedAnchorPolygons : getTaskPolygons(mergedTaskState),
  })
  await savePointer(baseDir, {
    version: 1,
    taskId: mergedTaskState.taskId,
    folderName: WORKSPACE_DIR,
    status: mergedTaskState.status,
    updatedAt: mergedTaskState.updatedAt,
    range: mergedTaskState.range,
  })
  pushRuntimeEvent('workspace-merge-done', '应用目录完成。', {
    baseDir,
    elapsedMs: Date.now() - startedAt,
  })

  return {
    taskDir: workspaceDir,
    taskState: mergedTaskState,
  }
}

async function hydrateTaskContext(baseDir, taskState) {
  if (!baseDir || !taskState?.folderName) return null
  const taskDir = path.join(baseDir, taskState.folderName)
  const chunkStateMaps = {}
  const chunkShardFiles = {}
  const startedAt = Date.now()
  pushRuntimeEvent('task-hydrate-start', '开始加载任务状态索引。', {
    taskDir,
    startZoom: taskState.range.startZoom,
    endZoom: taskState.range.endZoom,
  })
  for (let zoom = taskState.range.startZoom; zoom <= taskState.range.endZoom; zoom += 1) {
    const { map, files } = await loadChunkStateIndex(taskDir, zoom)
    chunkStateMaps[String(zoom)] = map
    chunkShardFiles[String(zoom)] = files
    taskState.levels[String(zoom)] = summarizeLevelFromChunkMap(zoom, map, taskState.levels[String(zoom)], files)
  }
  refreshTaskProgressFromLevels(taskState)
  pushRuntimeEvent('task-hydrate-done', '任务状态索引加载完成。', {
    taskDir,
    elapsedMs: Date.now() - startedAt,
  })
  return {
    baseDir,
    taskDir,
    stopRequested: false,
    pauseRequested: false,
    taskState,
    chunkStateMaps,
    chunkShardFiles,
  }
}

async function persistTaskState(taskContext) {
  taskContext.taskState.updatedAt = new Date().toISOString()
  taskContext.taskState.polygons = getTaskPolygons(taskContext.taskState)
  taskContext.taskState.polygon = taskContext.taskState.polygons[0] || []
  await writeJsonFile(path.join(taskContext.taskDir, TASK_STATE_FILE), sanitizeTaskStateForPersist(taskContext.taskState))
  await writeJsonFile(path.join(taskContext.taskDir, TASK_METADATA_FILE), buildTaskMetadata(taskContext.taskState))
  await writeJsonFile(path.join(taskContext.taskDir, ANCHOR_MODEL_FILE), {
    version: 1,
    taskId: taskContext.taskState.taskId,
    updatedAt: taskContext.taskState.updatedAt,
    polygon: taskContext.taskState.polygon || [],
    polygons: taskContext.taskState.polygons || [],
  })
  await savePointer(taskContext.baseDir, {
    version: 1,
    taskId: taskContext.taskState.taskId,
    folderName: taskContext.taskState.folderName,
    status: taskContext.taskState.status,
    updatedAt: taskContext.taskState.updatedAt,
    range: taskContext.taskState.range,
  })
  scheduleBroadcast()
}

function queuePersistTaskState(taskContext) {
  runtime.persistPromise = runtime.persistPromise.then(() => persistTaskState(taskContext))
  return runtime.persistPromise
}

function normalizeGcjPoint(point) {
  const latitude = Number(point?.latitude ?? point?.lat)
  const longitude = Number(point?.longitude ?? point?.lng)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  return { latitude, longitude }
}

function normalizePolygonInput(points) {
  return Array.isArray(points) ? points.map(normalizeGcjPoint).filter(Boolean) : []
}

function outOfChina(lat, lng) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271
}

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI)) + (20.0 * Math.sin(2.0 * x * Math.PI))) * 2.0 / 3.0
  ret += ((20.0 * Math.sin(y * Math.PI)) + (40.0 * Math.sin(y / 3.0 * Math.PI))) * 2.0 / 3.0
  ret += ((160.0 * Math.sin(y / 12.0 * Math.PI)) + (320 * Math.sin(y * Math.PI / 30.0))) * 2.0 / 3.0
  return ret
}

function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x))
  ret += ((20.0 * Math.sin(6.0 * x * Math.PI)) + (20.0 * Math.sin(2.0 * x * Math.PI))) * 2.0 / 3.0
  ret += ((20.0 * Math.sin(x * Math.PI)) + (40.0 * Math.sin(x / 3.0 * Math.PI))) * 2.0 / 3.0
  ret += ((150.0 * Math.sin(x / 12.0 * Math.PI)) + (300.0 * Math.sin(x / 30.0 * Math.PI))) * 2.0 / 3.0
  return ret
}

function gcj02ToWgs84(lng, lat) {
  if (outOfChina(lat, lng)) return { lng, lat }
  const a = 6378245.0
  const ee = 0.00669342162296594323
  let dLat = transformLat(lng - 105.0, lat - 35.0)
  let dLon = transformLng(lng - 105.0, lat - 35.0)
  const radLat = (lat / 180.0) * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI)
  dLon = (dLon * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI)
  const mgLat = lat + dLat
  const mgLon = lng + dLon
  return { lng: lng * 2 - mgLon, lat: lat * 2 - mgLat }
}

function wgs84ToGcj02(lng, lat) {
  const longitude = Number(lng)
  const latitude = Number(lat)
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return { lng: longitude, lat: latitude }
  if (outOfChina(latitude, longitude)) return { lng: longitude, lat: latitude }
  const a = 6378245.0
  const ee = 0.00669342162296594323
  let dLat = transformLat(longitude - 105.0, latitude - 35.0)
  let dLng = transformLng(longitude - 105.0, latitude - 35.0)
  const radLat = latitude / 180.0 * Math.PI
  let magic = Math.sin(radLat)
  magic = 1 - ee * magic * magic
  const sqrtMagic = Math.sqrt(magic)
  dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI)
  dLng = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI)
  return { lng: longitude + dLng, lat: latitude + dLat }
}
function lonLatToTile(lng, lat, zoom) {
  const scale = Math.pow(2, zoom)
  const x = Math.floor(((lng + 180) / 360) * scale)
  const sinLat = Math.sin((lat * Math.PI) / 180)
  const y = Math.floor((0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale)
  return { x, y }
}

function clampTileIndex(value, zoom) {
  const scale = Math.pow(2, zoom)
  const max = Math.max(0, scale - 1)
  return Math.max(0, Math.min(max, value))
}

function tileXYToBBOX3857(x, y, z) {
  const tileSize = 256
  const radius = 6378137
  const originShift = Math.PI * radius
  const resolution = (2 * originShift) / (tileSize * Math.pow(2, z))
  const minx = x * tileSize * resolution - originShift
  const maxx = (x + 1) * tileSize * resolution - originShift
  const maxy = originShift - y * tileSize * resolution
  const miny = originShift - (y + 1) * tileSize * resolution
  return [Number(minx.toFixed(6)), Number(miny.toFixed(6)), Number(maxx.toFixed(6)), Number(maxy.toFixed(6))]
}

function mercatorToLonLat(x, y) {
  const lng = (x / (Math.PI * 6378137)) * 180.0
  const lat = ((2 * Math.atan(Math.exp(y / 6378137)) - Math.PI / 2) * 180.0) / Math.PI
  return { lng, lat }
}

function lonLatToMercator(lng, lat) {
  const originShift = Math.PI * 6378137
  const x = (lng * originShift) / 180.0
  const y = Math.log(Math.tan(((90 + lat) * Math.PI) / 360.0)) * 6378137
  return { x, y }
}

function getTileLayerParams(cacheKey, bbox) {
  if (cacheKey && TILE_LAYER_PARAM_CACHE.has(cacheKey)) {
    return TILE_LAYER_PARAM_CACHE.get(cacheKey)
  }
  const params = buildProvinceLayerParams(PROVINCE_LAYER_RECORDS, bbox)
  if (cacheKey) {
    TILE_LAYER_PARAM_CACHE.set(cacheKey, params)
    if (TILE_LAYER_PARAM_CACHE.size > TILE_LAYER_PARAM_CACHE_MAX) {
      const oldestKey = TILE_LAYER_PARAM_CACHE.keys().next().value
      if (oldestKey) TILE_LAYER_PARAM_CACHE.delete(oldestKey)
    }
  }
  return params
}

function toQuery(params) {
  return Object.keys(params)
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&')
}

function buildTileRequestBBox(x, y, zoom) {
  const bbox = tileXYToBBOX3857(x, y, zoom)
  const center = [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
  const centerLonLat = mercatorToLonLat(center[0], center[1])
  const gcjCenter = wgs84ToGcj02(centerLonLat.lng, centerLonLat.lat)
  const mercatorWgs = lonLatToMercator(centerLonLat.lng, centerLonLat.lat)
  const mercatorGcj = lonLatToMercator(gcjCenter.lng, gcjCenter.lat)
  const dx = mercatorGcj.x - mercatorWgs.x
  const dy = mercatorGcj.y - mercatorWgs.y
  return [bbox[0] - dx, bbox[1] - dy, bbox[2] - dx, bbox[3] - dy]
}

function buildWmsTileEntry(x, y, zoom) {
  const requestBBox = buildTileRequestBBox(x, y, zoom)
  const wgsSW = mercatorToLonLat(requestBBox[0], requestBBox[1])
  const wgsNE = mercatorToLonLat(requestBBox[2], requestBBox[3])
  const gcjSW = wgs84ToGcj02(wgsSW.lng, wgsSW.lat)
  const gcjNE = wgs84ToGcj02(wgsNE.lng, wgsNE.lat)
  const bounds = {
    southwest: { longitude: gcjSW.lng, latitude: gcjSW.lat },
    northeast: { longitude: gcjNE.lng, latitude: gcjNE.lat },
  }
  const { layers, styles, provinceCodes } = getTileLayerParams(`${zoom}-${x}-${y}`, bounds)
  if (!layers || !styles || !provinceCodes.length) return null
  const query = toQuery({
    token: CAAC_TOKEN,
    service: 'WMS',
    request: 'GetMap',
    layers,
    styles,
    format: 'image/png8',
    transparent: 'true',
    version: '1.1.0',
    srs: 'EPSG:3857',
    width: '256',
    height: '256',
    bbox: requestBBox.join(','),
  })
  return {
    id: `${zoom}-${x}-${y}`,
    zoom,
    x,
    y,
    src: `${CAAC_BASE}?${query}`,
    bounds,
    provinceCodes,
  }
}

function buildTileBoundsEntry(x, y, zoom) {
  const requestBBox = buildTileRequestBBox(x, y, zoom)
  const wgsSW = mercatorToLonLat(requestBBox[0], requestBBox[1])
  const wgsNE = mercatorToLonLat(requestBBox[2], requestBBox[3])
  const gcjSW = wgs84ToGcj02(wgsSW.lng, wgsSW.lat)
  const gcjNE = wgs84ToGcj02(wgsNE.lng, wgsNE.lat)
  return {
    id: `${zoom}-${x}-${y}`,
    zoom,
    x,
    y,
    bounds: {
      southwest: { longitude: gcjSW.lng, latitude: gcjSW.lat },
      northeast: { longitude: gcjNE.lng, latitude: gcjNE.lat },
    },
  }
}

function pointInRect(point, rect) {
  return point.longitude >= rect.minLng - EPSILON
    && point.longitude <= rect.maxLng + EPSILON
    && point.latitude >= rect.minLat - EPSILON
    && point.latitude <= rect.maxLat + EPSILON
}

function onSegment(a, b, p) {
  return Math.min(a.longitude, b.longitude) - EPSILON <= p.longitude
    && p.longitude <= Math.max(a.longitude, b.longitude) + EPSILON
    && Math.min(a.latitude, b.latitude) - EPSILON <= p.latitude
    && p.latitude <= Math.max(a.latitude, b.latitude) + EPSILON
    && Math.abs((b.longitude - a.longitude) * (p.latitude - a.latitude) - (b.latitude - a.latitude) * (p.longitude - a.longitude)) <= EPSILON
}

function orientation(a, b, c) {
  return (b.longitude - a.longitude) * (c.latitude - a.latitude) - (b.latitude - a.latitude) * (c.longitude - a.longitude)
}

function segmentsIntersect(a, b, c, d) {
  const o1 = orientation(a, b, c)
  const o2 = orientation(a, b, d)
  const o3 = orientation(c, d, a)
  const o4 = orientation(c, d, b)

  if (((o1 > EPSILON && o2 < -EPSILON) || (o1 < -EPSILON && o2 > EPSILON))
    && ((o3 > EPSILON && o4 < -EPSILON) || (o3 < -EPSILON && o4 > EPSILON))) {
    return true
  }
  if (Math.abs(o1) <= EPSILON && onSegment(a, b, c)) return true
  if (Math.abs(o2) <= EPSILON && onSegment(a, b, d)) return true
  if (Math.abs(o3) <= EPSILON && onSegment(c, d, a)) return true
  if (Math.abs(o4) <= EPSILON && onSegment(c, d, b)) return true
  return false
}

function pointInPolygon(point, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i]
    const pj = polygon[j]
    if (onSegment(pj, pi, point)) return true
    const crosses = (pi.latitude > point.latitude) !== (pj.latitude > point.latitude)
    if (!crosses) continue
    const slope = (pj.longitude - pi.longitude) / ((pj.latitude - pi.latitude) || EPSILON)
    const xAtY = slope * (point.latitude - pi.latitude) + pi.longitude
    if (point.longitude < xAtY) inside = !inside
  }
  return inside
}

function polygonIntersectsRect(polygon, rectCorners) {
  const rect = {
    minLng: Math.min(...rectCorners.map((point) => point.longitude)),
    maxLng: Math.max(...rectCorners.map((point) => point.longitude)),
    minLat: Math.min(...rectCorners.map((point) => point.latitude)),
    maxLat: Math.max(...rectCorners.map((point) => point.latitude)),
  }

  if (polygon.some((point) => pointInRect(point, rect))) return true
  if (rectCorners.some((point) => pointInPolygon(point, polygon))) return true
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    for (let j = 0; j < rectCorners.length; j += 1) {
      const c = rectCorners[j]
      const d = rectCorners[(j + 1) % rectCorners.length]
      if (segmentsIntersect(a, b, c, d)) return true
    }
  }
  return false
}

function tileIntersectsPolygon(tile, polygon) {
  const sw = tile?.bounds?.southwest
  const ne = tile?.bounds?.northeast
  if (!sw || !ne) return false
  const rectCorners = [
    { longitude: sw.longitude, latitude: sw.latitude },
    { longitude: ne.longitude, latitude: sw.latitude },
    { longitude: ne.longitude, latitude: ne.latitude },
    { longitude: sw.longitude, latitude: ne.latitude },
  ]
  return polygonIntersectsRect(polygon, rectCorners)
}

function tileIntersectsAnyPolygon(tile, polygons = []) {
  return normalizePolygonsInput(polygons).some((polygon) => tileIntersectsPolygon(tile, polygon))
}

function polygonsTouchChinaRegion(polygons) {
  const normalizedPolygons = normalizePolygonsInput(polygons)
  if (!normalizedPolygons.length) return false
  const chinaRectCorners = [
    { longitude: CHINA_BOUNDS.minLng, latitude: CHINA_BOUNDS.minLat },
    { longitude: CHINA_BOUNDS.maxLng, latitude: CHINA_BOUNDS.minLat },
    { longitude: CHINA_BOUNDS.maxLng, latitude: CHINA_BOUNDS.maxLat },
    { longitude: CHINA_BOUNDS.minLng, latitude: CHINA_BOUNDS.maxLat },
  ]
  return normalizedPolygons.some((polygon) => polygonIntersectsRect(polygon, chinaRectCorners))
}

function computeZoomScanBounds(polygon, zoom) {
  const normalized = polygon.map(normalizeGcjPoint).filter(Boolean)
  if (normalized.length < 3) return null
  const wgsPoints = normalized.map((point) => {
    const converted = gcj02ToWgs84(point.longitude, point.latitude)
    return { longitude: converted?.lng ?? point.longitude, latitude: converted?.lat ?? point.latitude }
  })
  const west = Math.min(...wgsPoints.map((point) => point.longitude))
  const east = Math.max(...wgsPoints.map((point) => point.longitude))
  const north = Math.max(...wgsPoints.map((point) => point.latitude))
  const south = Math.min(...wgsPoints.map((point) => point.latitude))
  const tileNW = lonLatToTile(west, north, zoom)
  const tileSE = lonLatToTile(east, south, zoom)
  let xMin = clampTileIndex(Math.min(tileNW.x, tileSE.x), zoom)
  let xMax = clampTileIndex(Math.max(tileNW.x, tileSE.x), zoom)
  let yMin = clampTileIndex(Math.min(tileNW.y, tileSE.y), zoom)
  let yMax = clampTileIndex(Math.max(tileNW.y, tileSE.y), zoom)
  if (xMin > xMax) [xMin, xMax] = [xMax, xMin]
  if (yMin > yMax) [yMin, yMax] = [yMax, yMin]
  return { normalizedPolygon: normalized, xMin, xMax, yMin, yMax }
}

function buildChunkDescriptorsForZoom(polygons, zoom) {
  const descriptorMap = new Map()
  for (const polygon of normalizePolygonsInput(polygons)) {
    const bounds = computeZoomScanBounds(polygon, zoom)
    if (!bounds) continue
    for (let xStart = bounds.xMin; xStart <= bounds.xMax; xStart += SCAN_CHUNK_WIDTH) {
      const xEnd = Math.min(bounds.xMax, xStart + SCAN_CHUNK_WIDTH - 1)
      const key = buildChunkKey(zoom, xStart, xEnd, bounds.yMin, bounds.yMax)
      const current = descriptorMap.get(key)
      if (current) {
        current.polygons.push(bounds.normalizedPolygon)
        continue
      }
      descriptorMap.set(key, {
        key,
        zoom,
        xStart,
        xEnd,
        yStart: bounds.yMin,
        yEnd: bounds.yMax,
        polygon: bounds.normalizedPolygon,
        polygons: [bounds.normalizedPolygon],
      })
    }
  }
  return Array.from(descriptorMap.values()).sort((a, b) => a.xStart - b.xStart || a.yStart - b.yStart)
}

function buildAllChunkDescriptors(taskState) {
  const descriptors = {}
  const polygons = getTaskPolygons(taskState)
  for (let zoom = taskState.range.startZoom; zoom <= taskState.range.endZoom; zoom += 1) {
    descriptors[String(zoom)] = buildChunkDescriptorsForZoom(polygons, zoom)
  }
  return descriptors
}

function ensureChunkMap(taskContext, zoom) {
  const key = String(zoom)
  if (!taskContext.chunkStateMaps[key]) {
    taskContext.chunkStateMaps[key] = new Map()
  }
  if (!taskContext.chunkShardFiles[key]) {
    taskContext.chunkShardFiles[key] = []
  }
  if (!taskContext.taskState.levels[key]) {
    taskContext.taskState.levels[key] = createEmptyLevelState(zoom)
  }
  return taskContext.chunkStateMaps[key]
}

async function appendChunkRecord(taskContext, zoom, record) {
  const key = String(zoom)
  const zoomDir = getChunkStateZoomDir(taskContext.taskDir, zoom)
  await ensureDir(zoomDir)
  const files = taskContext.chunkShardFiles[key] || []
  let current = files[files.length - 1]
  const line = `${JSON.stringify(record)}\n`
  const byteLength = Buffer.byteLength(line)
  if (!current || (current.bytes + byteLength) > CHUNK_STATE_MAX_BYTES) {
    const nextIndex = files.length + 1
    current = { file: `part-${String(nextIndex).padStart(6, '0')}.ndjson`, bytes: 0, records: 0 }
    files.push(current)
    taskContext.chunkShardFiles[key] = files
  }
  await fs.appendFile(path.join(zoomDir, current.file), line, 'utf8')
  current.bytes += byteLength
  current.records += 1
  taskContext.taskState.levels[key].chunkFiles = files.map((file) => ({ ...file }))
}

async function upsertChunkState(taskContext, record) {
  const zoomKey = String(record.zoom)
  const chunkMap = ensureChunkMap(taskContext, record.zoom)
  const existing = chunkMap.get(record.key)
  const mergedUnavailableTileIds = uniqueStringArray([
    ...(existing?.unavailableTileIds || []),
    ...(record?.unavailableTileIds || []),
  ])
  const mergedDeferredTiles = mergeDeferredTiles(existing?.deferredTiles || [], record?.deferredTiles || [])
  const mergedRecord = existing ? {
    ...existing,
    ...record,
    status: mergeChunkStatus(existing.status, record.status),
    attempted: Math.max(Number(existing.attempted || 0), Number(record.attempted || 0)),
    discovered: Math.max(Number(existing.discovered || 0), Number(record.discovered || 0)),
    downloaded: Math.max(Number(existing.downloaded || 0), Number(record.downloaded || 0)),
    unavailableTileIds: mergedUnavailableTileIds,
    deferredTiles: mergedDeferredTiles,
    unavailable: Math.max(
      mergedUnavailableTileIds.length,
      Number(existing.unavailable || 0),
      Number(record.unavailable || 0),
    ),
  } : record
  chunkMap.set(record.key, mergedRecord)
  taskContext.taskState.levels[zoomKey] = summarizeLevelFromChunkMap(record.zoom, chunkMap, taskContext.taskState.levels[zoomKey], taskContext.chunkShardFiles[zoomKey])
  refreshTaskProgressFromLevels(taskContext.taskState)
  await appendChunkRecord(taskContext, record.zoom, mergedRecord)
  scheduleBroadcast()
}

function tileFilePath(taskContext, zoom, x, y) {
  return path.join(taskContext.taskDir, TILE_ROOT_DIR, `z${zoom}`, `x${x}`, `y${y}.png`)
}

async function tileFileExists(taskContext, zoom, x, y) {
  return fileExists(tileFilePath(taskContext, zoom, x, y))
}

async function writeTileToDisk(taskContext, tile, buffer) {
  const targetPath = tileFilePath(taskContext, tile.zoom, tile.x, tile.y)
  await ensureDir(path.dirname(targetPath))
  await fs.writeFile(targetPath, buffer)
}

function stopCountWorker() {
  if (!runtime.countWorker) return
  runtime.countWorker.terminate().catch(() => {})
  runtime.countWorker = null
  runtime.countWorkerDonePromise = null
  runtime.countWorkerError = null
  for (const liveKey of Array.from(runtime.liveChunks.keys())) {
    if (liveKey.startsWith('count:')) {
      runtime.liveChunks.delete(liveKey)
    }
  }
}

function normalizeChunkCursor(descriptor, cursorX, cursorY) {
  const xStart = Number(descriptor?.xStart)
  const xEnd = Number(descriptor?.xEnd)
  const yStart = Number(descriptor?.yStart)
  const yEnd = Number(descriptor?.yEnd)
  let nextX = Number(cursorX)
  let nextY = Number(cursorY)

  if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
    return { x: xStart, y: yStart }
  }
  if (nextX < xStart) nextX = xStart
  if (nextY < yStart) nextY = yStart
  if (nextX > xEnd) {
    return { x: xEnd + 1, y: yStart }
  }
  if (nextY > yEnd) {
    nextX += 1
    nextY = yStart
  }
  if (nextX > xEnd) {
    return { x: xEnd + 1, y: yStart }
  }
  return { x: nextX, y: nextY }
}

function setChunkResumeCursor(chunkState, descriptor, cursorX, cursorY) {
  const cursor = normalizeChunkCursor(descriptor, cursorX, cursorY)
  chunkState.resumeCursorX = cursor.x
  chunkState.resumeCursorY = cursor.y
}

function startCountWorker(taskContext, descriptorMap) {
  stopCountWorker()
  runtime.countWorkerError = null
  const worker = new Worker(new URL('./count-worker.js', import.meta.url), {
    workerData: {
      descriptorMap,
      constants: {
        EPSILON,
        COUNT_PROGRESS_STEP,
        HIGH_ZOOM_STAGE_MIN_ZOOM,
        STAGE_BUCKET_SCALE,
      },
      options: normalizeTaskOptions(taskContext?.taskState?.options),
    },
  })
  runtime.countWorker = worker
  runtime.countWorkerDonePromise = new Promise((resolve) => {
    worker.once('exit', () => resolve())
  })
  worker.on('message', async (message) => {
    if (!runtime.taskContext || runtime.taskContext !== taskContext) return
    if (message?.type === 'chunk-progress') {
      setLiveChunkProgress('count', message.record, {
        status: 'counting',
        discovered: Number(message.record?.discovered || 0),
        totalTiles: Number(message.record?.discovered || 0),
      })
    }
    if (message?.type === 'chunk-count') {
      setLiveChunkProgress('count', message.record, {
        status: message.record?.status || 'counting',
        discovered: Number(message.record?.discovered || 0),
        totalTiles: Number(message.record?.discovered || 0),
      })
      await upsertChunkState(taskContext, {
        ...message.record,
        status: message.record?.status || 'counted',
        updatedAt: new Date().toISOString(),
      })
    }
    if (message?.type === 'progress') {
      refreshTaskProgressFromLevels(taskContext.taskState)
      scheduleBroadcast(true)
    }
    if (message?.type === 'done') {
      for (const liveKey of Array.from(runtime.liveChunks.keys())) {
        if (liveKey.startsWith('count:')) runtime.liveChunks.delete(liveKey)
      }
      refreshTaskProgressFromLevels(taskContext.taskState)
      scheduleBroadcast(true)
    }
  })
  worker.on('error', (error) => {
    runtime.countWorkerError = error
    pushRuntimeEvent('count-worker-failed', `计数线程失败：${error.message || error}`)
  })
  worker.on('exit', () => {
    if (runtime.countWorker === worker) {
      runtime.countWorker = null
    }
    if (runtime.countWorkerDonePromise) {
      const donePromise = runtime.countWorkerDonePromise
      runtime.countWorkerDonePromise = null
      Promise.resolve(donePromise).catch(() => {})
    }
  })
  pushRuntimeEvent('count-worker-started', `总数统计线程已启动，按每 ${COUNT_PROGRESS_STEP.toLocaleString('zh-CN')} 张增量回传。`)
  return worker
}

async function createTaskState(startZoom, endZoom, polygons, concurrency) {
  const taskState = createEmptyTaskState()
  taskState.taskId = formatTaskId()
  taskState.status = 'ready'
  taskState.createdAt = new Date().toISOString()
  taskState.updatedAt = taskState.createdAt
  taskState.polygons = normalizePolygonsInput(polygons)
  taskState.polygon = taskState.polygons[0] || []
  taskState.range = { startZoom, endZoom }
  taskState.currentZoom = startZoom
  taskState.concurrency = concurrency
  taskState.progress.totalLevels = endZoom - startZoom + 1
  return taskState
}

async function initializeTaskContext(baseDir, startZoom, endZoom, polygons, concurrency, options = {}) {
  const mergedWorkspace = await ensureWorkspaceMerged(baseDir)
  const existingTaskState = mergedWorkspace.taskState
  const workspaceTaskDir = mergedWorkspace.taskDir
  if (!sameTaskScope(existingTaskState, polygons, startZoom, endZoom)) {
    await fs.rm(getChunkStateBaseDir(workspaceTaskDir), { recursive: true, force: true })
  }
  const taskState = await createTaskState(startZoom, endZoom, polygons, concurrency)
  taskState.taskId = existingTaskState?.taskId || taskState.taskId
  taskState.folderName = WORKSPACE_DIR
  taskState.createdAt = existingTaskState?.createdAt || taskState.createdAt
  taskState.status = existingTaskState?.status || taskState.status
  taskState.chunking = existingTaskState?.chunking || taskState.chunking
  taskState.options = normalizeTaskOptions({ ...existingTaskState?.options, ...options })
  taskState.levels = {}
  const taskContext = await hydrateTaskContext(baseDir, taskState)
  pushRuntimeEvent('task-reused', '复用现有工作目录，继续增量下载。')
  await persistTaskState(taskContext)
  return taskContext
}

async function loadTaskFromDirectory(baseDir) {
  const mergedWorkspace = await ensureWorkspaceMerged(baseDir)
  const taskState = mergeTaskStatePayload(createEmptyTaskState(), mergedWorkspace.taskState)
  taskState.options = normalizeTaskOptions(taskState.options)
  taskState.polygons = getTaskPolygons(taskState)
  taskState.polygon = taskState.polygons[0] || []
  const pointer = await loadPointer(baseDir)
  if (pointer?.range) {
    taskState.range = pointer.range
  }
  if (taskState.status === 'running' || taskState.status === 'stopping' || taskState.status === 'pausing') {
    taskState.status = 'stopped'
    pushRuntimeEvent('task-recovered', '检测到上次任务未正常结束，已转为可恢复状态。')
  }
  const taskContext = await hydrateTaskContext(baseDir, taskState)
  await persistTaskState(taskContext)
  return taskContext
}

async function waitWithStop(taskContext, ms) {
  let remaining = ms
  while (remaining > 0) {
    if (taskContext.stopRequested) throw makeStopError()
    const slice = Math.min(250, remaining)
    await sleep(slice)
    remaining -= slice
  }
}

function execFileAsync(command, args) {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || stdout || error.message || String(error)))
        return
      }
      resolve({ stdout, stderr })
    })
  })
}

async function openDirectorySelectionDialog({ title = '选择目录', initialPath = '' } = {}) {
  if (process.platform !== 'win32') {
    throw new Error('当前仅在 Windows 环境支持原生目录选择')
  }
  const dialogTitle = JSON.stringify(String(title || '选择目录'))
  const dialogInitialPath = JSON.stringify(String(initialPath || ''))
  const script = [
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
    'Add-Type -AssemblyName System.Windows.Forms',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog',
    `$dialog.Description = ${dialogTitle}`,
    '$dialog.ShowNewFolderButton = $true',
    `$initialPath = ${dialogInitialPath}`,
    'if ($initialPath -and (Test-Path -LiteralPath $initialPath -PathType Container)) { $dialog.SelectedPath = $initialPath }',
    '$result = $dialog.ShowDialog()',
    'if ($result -eq [System.Windows.Forms.DialogResult]::OK -and $dialog.SelectedPath) { [Console]::Out.Write($dialog.SelectedPath) }',
  ].join('; ')
  const { stdout } = await execFileAsync('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-STA',
    '-Command',
    script,
  ])
  return String(stdout || '').trim()
}

function decodeXmlEntities(value = '') {
  return String(value)
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}

function escapeRegExp(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function collectTagBlocks(xml = '', localName = '') {
  const pattern = new RegExp(`<(?:[\\w.-]+:)?${escapeRegExp(localName)}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escapeRegExp(localName)}>`, 'gi')
  return Array.from(String(xml).matchAll(pattern), (match) => String(match[0] || ''))
}

function extractTagTexts(xml = '', localName = '') {
  const pattern = new RegExp(`<(?:[\\w.-]+:)?${escapeRegExp(localName)}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escapeRegExp(localName)}>`, 'gi')
  return Array.from(String(xml).matchAll(pattern), (match) => decodeXmlEntities(String(match[1] || '').trim()))
}

function sanitizeFileSegment(value = '', fallback = 'unnamed') {
  const sanitized = String(value || '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return sanitized || fallback
}

function parseKmlCoordinateText(text = '') {
  const points = String(text || '')
    .trim()
    .split(/\s+/)
    .map((row) => row.split(','))
    .map(([longitude, latitude]) => normalizeGcjPoint({ longitude, latitude }))
    .filter(Boolean)
  if (points.length >= 2) {
    const first = points[0]
    const last = points[points.length - 1]
    if (first && last && first.latitude === last.latitude && first.longitude === last.longitude) {
      points.pop()
    }
  }
  return points.length >= 3 ? points : []
}

function parseKmlPolygons(text = '', fallbackName = 'Imported') {
  const xml = String(text || '')
  const placemarks = collectTagBlocks(xml, 'Placemark')
  const polygonSources = placemarks.length ? placemarks : [xml]
  const polygons = []

  polygonSources.forEach((placemark, placemarkIndex) => {
    const baseName = sanitizeFileSegment(
      extractTagTexts(placemark, 'name')[0] || `${fallbackName}-${placemarkIndex + 1}`,
      `${fallbackName}-${placemarkIndex + 1}`,
    )
    const polygonBlocks = collectTagBlocks(placemark, 'Polygon')
    const polygonContainers = polygonBlocks.length ? polygonBlocks : [placemark]
    polygonContainers.forEach((polygonBlock, polygonIndex) => {
      const outerBlocks = collectTagBlocks(polygonBlock, 'outerBoundaryIs')
      const coordinateTexts = (outerBlocks.length ? outerBlocks : [polygonBlock])
        .flatMap((block) => extractTagTexts(block, 'coordinates'))
      coordinateTexts.forEach((coordinateText) => {
        const points = parseKmlCoordinateText(coordinateText)
        if (points.length < 3) return
        polygons.push({
          name: polygonContainers.length > 1 ? `${baseName}-${polygonIndex + 1}` : baseName,
          points,
        })
      })
    })
  })

  if (!polygons.length) {
    throw new Error('KML 中没有可用的 Polygon')
  }
  return polygons
}

async function collectKmlFiles(rootDir, currentDir = rootDir, bucket = []) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name)
    if (entry.isDirectory()) {
      await collectKmlFiles(rootDir, fullPath, bucket)
      continue
    }
    if (/\.kml$/i.test(entry.name)) {
      bucket.push(fullPath)
    }
  }
  return bucket
}

function mergeZoomBounds(boundsList = []) {
  if (!boundsList.length) return null
  return {
    xMin: Math.min(...boundsList.map((item) => item.xMin)),
    xMax: Math.max(...boundsList.map((item) => item.xMax)),
    yMin: Math.min(...boundsList.map((item) => item.yMin)),
    yMax: Math.max(...boundsList.map((item) => item.yMax)),
  }
}

function buildPackageZoomBounds(polygons = []) {
  const zoomBounds = {}
  for (let zoom = WMS_MIN_ZOOM; zoom <= WMS_MAX_ZOOM; zoom += 1) {
    const boundsList = polygons
      .map((polygon) => computeZoomScanBounds(polygon, zoom))
      .filter(Boolean)
    const merged = mergeZoomBounds(boundsList)
    if (merged) zoomBounds[String(zoom)] = merged
  }
  return zoomBounds
}

async function buildSplitPackages(kmlRootPath, outputPath) {
  const kmlFiles = await collectKmlFiles(kmlRootPath)
  const packages = []

  for (const filePath of kmlFiles) {
    try {
      const raw = await fs.readFile(filePath, 'utf8')
      const fileName = path.basename(filePath, path.extname(filePath))
      const polygons = parseKmlPolygons(raw, sanitizeFileSegment(fileName, 'package'))
        .map((item) => item.points)
        .filter((points) => points.length >= 3)
      if (!polygons.length) continue
      const relativeFilePath = path.relative(kmlRootPath, filePath)
      const relativeDir = path.dirname(relativeFilePath) === '.' ? '' : path.dirname(relativeFilePath)
      const packageName = sanitizeFileSegment(fileName, 'package')
      const packageDir = path.join(outputPath, relativeDir, packageName)
      const zipPath = path.join(outputPath, relativeDir, `${packageName}.zip`)
      packages.push({
        filePath,
        relativeFilePath,
        relativeDir,
        packageName,
        displayName: relativeDir ? path.join(relativeDir, packageName) : packageName,
        packageDir,
        zipPath,
        polygons,
        zoomBounds: buildPackageZoomBounds(polygons),
        copiedTiles: 0,
        changed: false,
      })
    } catch (error) {
      pushRuntimeEvent('package-split-kml-skip', `跳过 KML：${path.relative(kmlRootPath, filePath)}，原因：${error.message || error}`)
    }
  }

  if (!packages.length) {
    throw new Error('指定目录下没有可用的 KML Polygon 文件')
  }
  return packages
}

function normalizeUploadedKmlFiles(files = []) {
  return (Array.isArray(files) ? files : [])
    .map((file) => ({
      name: String(file?.name || ''),
      relativePath: String(file?.relativePath || file?.webkitRelativePath || file?.name || ''),
      content: String(file?.content || ''),
    }))
    .filter((file) => /\.kml$/i.test(file.name || file.relativePath) && file.content)
}

async function buildSplitPackagesFromUploadedFiles(kmlFiles = [], outputPath, rootLabel = '浏览器已选目录') {
  const normalizedFiles = normalizeUploadedKmlFiles(kmlFiles)
  const packages = []

  for (const file of normalizedFiles) {
    try {
      const fileName = path.basename(file.name || file.relativePath, path.extname(file.name || file.relativePath))
      const polygons = parseKmlPolygons(file.content, sanitizeFileSegment(fileName, 'package'))
        .map((item) => item.points)
        .filter((points) => points.length >= 3)
      if (!polygons.length) continue
      const normalizedRelativePath = String(file.relativePath || file.name || '').replace(/\\/g, '/')
      const relativeFilePath = normalizedRelativePath.replace(/^[^/]+\//, '')
      const relativeDirRaw = path.posix.dirname(relativeFilePath)
      const relativeDir = relativeDirRaw === '.' ? '' : relativeDirRaw
      const packageName = sanitizeFileSegment(fileName, 'package')
      const packageDir = path.join(outputPath, ...relativeDir.split('/').filter(Boolean), packageName)
      const zipPath = path.join(outputPath, ...relativeDir.split('/').filter(Boolean), `${packageName}.zip`)
      packages.push({
        filePath: '',
        fileContent: file.content,
        relativeFilePath,
        relativeDir,
        packageName,
        displayName: relativeDir ? `${relativeDir}/${packageName}` : packageName,
        packageDir,
        zipPath,
        polygons,
        zoomBounds: buildPackageZoomBounds(polygons),
        copiedTiles: 0,
        changed: false,
      })
    } catch (error) {
      pushRuntimeEvent('package-split-kml-skip', `跳过 KML：${file.relativePath || file.name}，原因：${error.message || error}`, {
        kmlRootPath: rootLabel,
      })
    }
  }

  if (!packages.length) {
    throw new Error('所选目录中没有可用的 KML Polygon 文件')
  }
  return packages
}

function parseTileRelativePath(relativePath = '') {
  const normalized = String(relativePath).split(path.sep)
  if (normalized.length < 3) return null
  const [zoomSegment, xSegment, ySegment] = normalized.slice(-3)
  const zoomMatch = /^z(\d+)$/i.exec(zoomSegment || '')
  const xMatch = /^x(\d+)$/i.exec(xSegment || '')
  const yMatch = /^y(\d+)\.png$/i.exec(ySegment || '')
  if (!zoomMatch || !xMatch || !yMatch) return null
  return {
    zoom: Number(zoomMatch[1]),
    x: Number(xMatch[1]),
    y: Number(yMatch[1]),
  }
}

async function walkTileFiles(tileRootDir, visitor, currentDir = tileRootDir) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name)
    if (entry.isDirectory()) {
      await walkTileFiles(tileRootDir, visitor, fullPath)
      continue
    }
    if (!/\.png$/i.test(entry.name)) continue
    const relativePath = path.relative(tileRootDir, fullPath)
    const tileMeta = parseTileRelativePath(relativePath)
    if (!tileMeta) continue
    await visitor({
      ...tileMeta,
      fullPath,
      relativePath,
    })
  }
}

function getMotherTileCountFromTaskContext(taskContext) {
  const direct = Number(taskContext?.taskState?.progress?.downloadedTiles || 0)
  if (direct > 0) return direct

  let total = 0
  for (const levelState of Object.values(taskContext?.taskState?.levels || {})) {
    total += Number(levelState?.downloaded || 0)
  }
  return total
}

function createPackageTaskState(patch = {}) {
  return {
    mode: 'split',
    status: 'idle',
    phase: 'idle',
    phaseLabel: '等待中',
    workspacePath: runtime.workspacePath,
    sourceTileRoot: '',
    kmlRootPath: '',
    outputPath: '',
    totalPackages: 0,
    completedPackages: 0,
    zippedPackages: 0,
    skippedZipPackages: 0,
    totalTiles: 0,
    processedTiles: 0,
    copiedTiles: 0,
    skippedTiles: 0,
    currentPackageName: '',
    currentTile: '',
    bundleZipPath: '',
    startedAt: null,
    finishedAt: null,
    error: '',
    ...patch,
    updatedAt: new Date().toISOString(),
  }
}

function updatePackageTaskState(patch = {}, { replace = false } = {}) {
  runtime.packageTaskState = replace
    ? createPackageTaskState(patch)
    : {
      ...(runtime.packageTaskState || createPackageTaskState()),
      ...patch,
      updatedAt: new Date().toISOString(),
    }
  scheduleBroadcast()
  return runtime.packageTaskState
}

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1)
    }
    table[index] = value >>> 0
  }
  return table
})()

function updateCrc32(previous, chunk) {
  let crc = (previous ^ 0xFFFFFFFF) >>> 0
  for (let index = 0; index < chunk.length; index += 1) {
    crc = CRC32_TABLE[(crc ^ chunk[index]) & 0xFF] ^ (crc >>> 8)
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function toDosDateTime(value) {
  const date = value instanceof Date ? value : new Date(value || Date.now())
  const year = Math.max(1980, date.getFullYear())
  const month = Math.min(Math.max(date.getMonth() + 1, 1), 12)
  const day = Math.min(Math.max(date.getDate(), 1), 31)
  const hours = Math.min(Math.max(date.getHours(), 0), 23)
  const minutes = Math.min(Math.max(date.getMinutes(), 0), 59)
  const seconds = Math.min(Math.max(Math.floor(date.getSeconds() / 2), 0), 29)
  return {
    dosTime: (hours << 11) | (minutes << 5) | seconds,
    dosDate: ((year - 1980) << 9) | (month << 5) | day,
  }
}

function writeUInt64LE(buffer, value, offset) {
  buffer.writeBigUInt64LE(BigInt(Math.max(0, Number(value || 0))), offset)
}

async function writeBufferWithBackpressure(stream, buffer) {
  if (!stream.write(buffer)) {
    await once(stream, 'drain')
  }
}

async function createStoredZip(entries = [], zipPath) {
  const normalizedEntries = Array.isArray(entries) ? entries.filter((entry) => entry?.filePath && entry?.entryName) : []
  if (!normalizedEntries.length) {
    throw new Error('没有可用于压缩的文件')
  }
  if (await fileExists(zipPath)) {
    await fs.rm(zipPath, { force: true })
  }
  await ensureDir(path.dirname(zipPath))

  const tempZipPath = `${zipPath}.tmp`
  await fs.rm(tempZipPath, { force: true })

  const output = createWriteStream(tempZipPath)
  let offset = 0
  const centralEntries = []

  try {
    for (const entry of normalizedEntries) {
      const stats = await fs.stat(entry.filePath)
      if (!stats.isFile()) continue

      const nameBuffer = Buffer.from(String(entry.entryName).replace(/\\/g, '/'), 'utf8')
      const { dosTime, dosDate } = toDosDateTime(stats.mtime)
      const fileSize = stats.size
      const localHeaderOffset = offset
      const needsZip64 = fileSize > 0xFFFFFFFF || localHeaderOffset > 0xFFFFFFFF
      const flags = 0x0808
      const localHeader = Buffer.alloc(30)
      localHeader.writeUInt32LE(0x04034B50, 0)
      localHeader.writeUInt16LE(needsZip64 ? 45 : 20, 4)
      localHeader.writeUInt16LE(flags, 6)
      localHeader.writeUInt16LE(0, 8)
      localHeader.writeUInt16LE(dosTime, 10)
      localHeader.writeUInt16LE(dosDate, 12)
      localHeader.writeUInt32LE(0, 14)
      localHeader.writeUInt32LE(0, 18)
      localHeader.writeUInt32LE(0, 22)
      localHeader.writeUInt16LE(nameBuffer.length, 26)
      localHeader.writeUInt16LE(0, 28)
      await writeBufferWithBackpressure(output, localHeader)
      await writeBufferWithBackpressure(output, nameBuffer)
      offset += localHeader.length + nameBuffer.length

      let crc32 = 0
      let writtenSize = 0
      const input = createReadStream(entry.filePath)
      for await (const chunk of input) {
        crc32 = updateCrc32(crc32, chunk)
        writtenSize += chunk.length
        await writeBufferWithBackpressure(output, chunk)
        offset += chunk.length
      }

      const descriptor = Buffer.alloc(needsZip64 ? 24 : 16)
      descriptor.writeUInt32LE(0x08074B50, 0)
      descriptor.writeUInt32LE(crc32 >>> 0, 4)
      if (needsZip64) {
        writeUInt64LE(descriptor, writtenSize, 8)
        writeUInt64LE(descriptor, writtenSize, 16)
      } else {
        descriptor.writeUInt32LE(writtenSize >>> 0, 8)
        descriptor.writeUInt32LE(writtenSize >>> 0, 12)
      }
      await writeBufferWithBackpressure(output, descriptor)
      offset += descriptor.length

      centralEntries.push({
        nameBuffer,
        crc32,
        size: writtenSize,
        compressedSize: writtenSize,
        localHeaderOffset,
        dosTime,
        dosDate,
        needsZip64,
      })
    }

    const centralDirectoryOffset = offset
    let centralDirectorySize = 0

    for (const entry of centralEntries) {
      const zip64PayloadSize = entry.needsZip64 ? 24 : 0
      const extraFieldSize = entry.needsZip64 ? 4 + zip64PayloadSize : 0
      const centralHeader = Buffer.alloc(46)
      centralHeader.writeUInt32LE(0x02014B50, 0)
      centralHeader.writeUInt16LE(entry.needsZip64 ? 45 : 20, 4)
      centralHeader.writeUInt16LE(entry.needsZip64 ? 45 : 20, 6)
      centralHeader.writeUInt16LE(0x0808, 8)
      centralHeader.writeUInt16LE(0, 10)
      centralHeader.writeUInt16LE(entry.dosTime, 12)
      centralHeader.writeUInt16LE(entry.dosDate, 14)
      centralHeader.writeUInt32LE(entry.crc32 >>> 0, 16)
      centralHeader.writeUInt32LE(entry.needsZip64 ? 0xFFFFFFFF : (entry.compressedSize >>> 0), 20)
      centralHeader.writeUInt32LE(entry.needsZip64 ? 0xFFFFFFFF : (entry.size >>> 0), 24)
      centralHeader.writeUInt16LE(entry.nameBuffer.length, 28)
      centralHeader.writeUInt16LE(extraFieldSize, 30)
      centralHeader.writeUInt16LE(0, 32)
      centralHeader.writeUInt16LE(0, 34)
      centralHeader.writeUInt16LE(0, 36)
      centralHeader.writeUInt32LE(0, 38)
      centralHeader.writeUInt32LE(entry.needsZip64 ? 0xFFFFFFFF : (entry.localHeaderOffset >>> 0), 42)
      await writeBufferWithBackpressure(output, centralHeader)
      await writeBufferWithBackpressure(output, entry.nameBuffer)
      centralDirectorySize += centralHeader.length + entry.nameBuffer.length

      if (entry.needsZip64) {
        const extraField = Buffer.alloc(extraFieldSize)
        extraField.writeUInt16LE(0x0001, 0)
        extraField.writeUInt16LE(zip64PayloadSize, 2)
        writeUInt64LE(extraField, entry.size, 4)
        writeUInt64LE(extraField, entry.compressedSize, 12)
        writeUInt64LE(extraField, entry.localHeaderOffset, 20)
        await writeBufferWithBackpressure(output, extraField)
        centralDirectorySize += extraField.length
      }
    }
    offset += centralDirectorySize

    const needsZip64 = centralEntries.length > 0xFFFF
      || centralDirectorySize > 0xFFFFFFFF
      || centralDirectoryOffset > 0xFFFFFFFF
      || centralEntries.some((entry) => entry.needsZip64)

    if (needsZip64) {
      const zip64EocdOffset = offset
      const zip64Eocd = Buffer.alloc(56)
      zip64Eocd.writeUInt32LE(0x06064B50, 0)
      writeUInt64LE(zip64Eocd, 44, 4)
      zip64Eocd.writeUInt16LE(45, 12)
      zip64Eocd.writeUInt16LE(45, 14)
      zip64Eocd.writeUInt32LE(0, 16)
      zip64Eocd.writeUInt32LE(0, 20)
      writeUInt64LE(zip64Eocd, centralEntries.length, 24)
      writeUInt64LE(zip64Eocd, centralEntries.length, 32)
      writeUInt64LE(zip64Eocd, centralDirectorySize, 40)
      writeUInt64LE(zip64Eocd, centralDirectoryOffset, 48)
      await writeBufferWithBackpressure(output, zip64Eocd)
      offset += zip64Eocd.length

      const zip64Locator = Buffer.alloc(20)
      zip64Locator.writeUInt32LE(0x07064B50, 0)
      zip64Locator.writeUInt32LE(0, 4)
      writeUInt64LE(zip64Locator, zip64EocdOffset, 8)
      zip64Locator.writeUInt32LE(1, 16)
      await writeBufferWithBackpressure(output, zip64Locator)
      offset += zip64Locator.length
    }

    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054B50, 0)
    eocd.writeUInt16LE(0, 4)
    eocd.writeUInt16LE(0, 6)
    eocd.writeUInt16LE(Math.min(centralEntries.length, 0xFFFF), 8)
    eocd.writeUInt16LE(Math.min(centralEntries.length, 0xFFFF), 10)
    eocd.writeUInt32LE(needsZip64 ? 0xFFFFFFFF : (centralDirectorySize >>> 0), 12)
    eocd.writeUInt32LE(needsZip64 ? 0xFFFFFFFF : (centralDirectoryOffset >>> 0), 16)
    eocd.writeUInt16LE(0, 20)
    await writeBufferWithBackpressure(output, eocd)

    output.end()
    await once(output, 'close')
    await fs.rename(tempZipPath, zipPath)
  } catch (error) {
    output.destroy()
    await fs.rm(tempZipPath, { force: true }).catch(() => {})
    throw error
  }
}

async function createZipFromDirectory(sourceDir, zipPath) {
  const entries = []
  const rootDirName = path.basename(sourceDir)
  const pendingDirs = ['']

  while (pendingDirs.length > 0) {
    const currentRelativeDir = pendingDirs.pop() || ''
    const currentAbsoluteDir = currentRelativeDir
      ? path.join(sourceDir, currentRelativeDir)
      : sourceDir
    const dirEntries = await fs.readdir(currentAbsoluteDir, { withFileTypes: true })

    for (const entry of dirEntries) {
      const relativePath = currentRelativeDir
        ? `${currentRelativeDir.replace(/\\/g, '/')}/${entry.name}`
        : entry.name
      const absolutePath = path.join(currentAbsoluteDir, entry.name)

      if (entry.isDirectory()) {
        pendingDirs.push(relativePath)
        continue
      }
      if (!entry.isFile()) {
        continue
      }

      entries.push({
        filePath: absolutePath,
        entryName: `${rootDirName}/${relativePath}`,
        shouldStore: ZIP_STORE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()),
      })
    }
  }

  await createStoredZip(entries, zipPath)
}

async function createZipFromFiles(files = [], zipPath, baseDir = '') {
  const normalizedFiles = Array.isArray(files)
    ? files.map((file) => path.resolve(String(file || ''))).filter(Boolean)
    : []
  if (!normalizedFiles.length) {
    throw new Error('没有可用于汇总打包的压缩包')
  }

  const normalizedBaseDir = baseDir ? path.resolve(baseDir) : ''
  const entries = normalizedFiles.map((filePath) => ({
    filePath,
    entryName: (normalizedBaseDir
      ? path.relative(normalizedBaseDir, filePath)
      : path.basename(filePath)).replace(/\\/g, '/'),
    shouldStore: true,
  }))
  await createStoredZip(entries, zipPath)
}

async function isUsableZipFile(zipPath) {
  try {
    const stats = await fs.stat(zipPath)
    if (!stats.isFile() || stats.size < 22) {
      return false
    }

    const handle = await fs.open(zipPath, 'r')
    try {
      const header = Buffer.alloc(4)
      await handle.read(header, 0, 4, 0)
      const headerSignature = header.readUInt32LE(0)
      const validHeaderSignatures = new Set([0x04034b50, 0x06054b50, 0x08074b50])
      if (!validHeaderSignatures.has(headerSignature)) {
        return false
      }

      const tailSize = Math.min(stats.size, 65557)
      const tailBuffer = Buffer.alloc(tailSize)
      await handle.read(tailBuffer, 0, tailSize, stats.size - tailSize)
      for (let index = tailSize - 22; index >= 0; index -= 1) {
        if (tailBuffer.readUInt32LE(index) === 0x06054b50) {
          return true
        }
      }
      return false
    } finally {
      await handle.close()
    }
  } catch (_error) {
    return false
  }
}

async function collectExistingPackageDirectories(outputPath) {
  const resolvedOutputPath = path.resolve(outputPath)
  if (!await fileExists(resolvedOutputPath)) {
    throw new Error('分包输出目录不存在')
  }

  const packages = []
  const pendingDirs = [{ absolutePath: resolvedOutputPath, relativePath: '' }]

  while (pendingDirs.length > 0) {
    const current = pendingDirs.pop()
    const entries = await fs.readdir(current.absolutePath, { withFileTypes: true })
    const hasKmlFile = entries.some((entry) => entry.isFile() && /\.kml$/i.test(entry.name))
    const hasTileDir = entries.some((entry) => entry.isDirectory() && entry.name === TILE_ROOT_DIR)

    if (current.relativePath && (hasKmlFile || hasTileDir)) {
      const packageName = path.basename(current.absolutePath)
      const relativeDirRaw = path.dirname(current.relativePath)
      const relativeDir = relativeDirRaw === '.' ? '' : relativeDirRaw
      packages.push({
        relativeDir,
        relativeFilePath: '',
        packageName,
        displayName: current.relativePath.replace(/\\/g, '/'),
        packageDir: current.absolutePath,
        zipPath: path.join(path.dirname(current.absolutePath), `${packageName}.zip`),
        polygons: [],
        zoomBounds: {},
        copiedTiles: 0,
        changed: false,
      })
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name === TILE_ROOT_DIR || entry.name === TASK_META_DIR || entry.name === CHUNK_STATE_DIR) continue
      pendingDirs.push({
        absolutePath: path.join(current.absolutePath, entry.name),
        relativePath: current.relativePath ? path.join(current.relativePath, entry.name) : entry.name,
      })
    }
  }

  if (!packages.length) {
    throw new Error('输出目录中没有可压缩的分包目录')
  }

  packages.sort((left, right) => left.displayName.localeCompare(right.displayName, 'zh-CN'))
  return packages
}

function buildBundleZipPath(outputPath) {
  const baseName = sanitizeFileSegment(path.basename(outputPath), 'split-packages')
  return path.join(outputPath, `${baseName}.zip`)
}

async function zipPackagesAndCreateBundle(packages, outputPath) {
  let rebuiltPackageCount = 0
  updatePackageTaskState({
    status: 'zipping',
    phase: 'zipping',
    phaseLabel: `压缩分包目录（并行 ${Math.min(ZIP_CONCURRENCY, Math.max(packages.length, 1))}）`,
    currentTile: '',
  })

  await processPackagesWithConcurrency(packages, async (pkg) => {
    updatePackageTaskState({
      currentPackageName: pkg.displayName,
    })
    const hasValidZip = await isUsableZipFile(pkg.zipPath)
    if (pkg.changed || !hasValidZip) {
      await createZipFromDirectory(pkg.packageDir, pkg.zipPath)
      rebuiltPackageCount += 1
      updatePackageTaskState({
        zippedPackages: Number(runtime.packageTaskState?.zippedPackages || 0) + 1,
      })
      pushRuntimeEvent(
        'package-split-package',
        `分包 ${pkg.displayName} 已重打包。`,
        {
          packageName: pkg.displayName,
          copiedTiles: pkg.copiedTiles,
          zipPath: pkg.zipPath,
        },
      )
    } else {
      updatePackageTaskState({
        skippedZipPackages: Number(runtime.packageTaskState?.skippedZipPackages || 0) + 1,
      })
      pushRuntimeEvent(
        'package-split-package-skip',
        `分包 ${pkg.displayName} 已有有效压缩包，已跳过重打包。`,
        {
          packageName: pkg.displayName,
          zipPath: pkg.zipPath,
        },
      )
    }
    updatePackageTaskState({
      completedPackages: Number(runtime.packageTaskState?.completedPackages || 0) + 1,
      currentPackageName: pkg.displayName,
    })
  })

  const bundleZipPath = buildBundleZipPath(outputPath)
  updatePackageTaskState({
    status: 'zipping',
    phase: 'bundling',
    phaseLabel: '汇总全部压缩包',
    currentPackageName: path.basename(bundleZipPath),
    bundleZipPath,
  })

  const zipFiles = []
  for (const pkg of packages) {
    if (await isUsableZipFile(pkg.zipPath)) {
      zipFiles.push(pkg.zipPath)
    }
  }
  const hasValidBundleZip = await isUsableZipFile(bundleZipPath)
  if (rebuiltPackageCount > 0 || !hasValidBundleZip) {
    await createZipFromFiles(zipFiles, bundleZipPath, outputPath)
    pushRuntimeEvent('package-split-bundle', '已生成最外层汇总压缩包。', {
      bundleZipPath,
      zipCount: zipFiles.length,
    })
  } else {
    pushRuntimeEvent('package-split-bundle-skip', '最外层汇总压缩包已存在且有效，已跳过重打包。', {
      bundleZipPath,
      zipCount: zipFiles.length,
    })
  }
}

async function writeTextFileIfChanged(targetPath, content) {
  const nextContent = String(content ?? '')
  try {
    const currentContent = await fs.readFile(targetPath, 'utf8')
    if (currentContent === nextContent) {
      return false
    }
  } catch (_error) {
    // ignore missing file
  }
  await ensureDir(path.dirname(targetPath))
  await fs.writeFile(targetPath, nextContent, 'utf8')
  return true
}

async function processPackagesWithConcurrency(packages = [], handler, concurrency = ZIP_CONCURRENCY) {
  if (!packages.length) return
  const workerCount = Math.max(1, Math.min(concurrency, packages.length))
  let nextIndex = 0

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= packages.length) return
      await handler(packages[currentIndex], currentIndex)
    }
  })

  await Promise.all(workers)
}

async function runSplitPackagesTask({ kmlRootPath, outputPath, kmlFiles }) {
  ensureTaskIdle()
  if (!runtime.workspacePath || !runtime.taskContext?.taskDir) {
    throw new Error('请先选择并加载下载目录')
  }

  const sourceTileRoot = path.join(runtime.taskContext.taskDir, TILE_ROOT_DIR)
  if (!await fileExists(sourceTileRoot)) {
    throw new Error('当前下载目录中没有可用的母包瓦片')
  }

  const uploadedKmlFiles = normalizeUploadedKmlFiles(kmlFiles)
  const rawKmlRoot = String(kmlRootPath || '').trim()
  const useUploadedFiles = uploadedKmlFiles.length > 0
  const resolvedKmlRoot = useUploadedFiles ? (rawKmlRoot || '浏览器已选目录') : path.resolve(rawKmlRoot)
  if (!useUploadedFiles && (!resolvedKmlRoot || !await fileExists(resolvedKmlRoot))) {
    throw new Error('KML 根目录不存在')
  }
  const resolvedOutputPath = path.resolve(String(outputPath || '').trim() || path.join(runtime.workspacePath, SPLIT_OUTPUT_DIR))

  runtime.events = []
  updatePackageTaskState({
    mode: 'split',
    status: 'preparing',
    phase: 'scan-kml',
    phaseLabel: '解析 KML',
    workspacePath: runtime.workspacePath,
    sourceTileRoot,
    kmlRootPath: resolvedKmlRoot,
    outputPath: resolvedOutputPath,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: '',
    totalPackages: 0,
    completedPackages: 0,
    zippedPackages: 0,
    skippedZipPackages: 0,
    totalTiles: 0,
    processedTiles: 0,
    copiedTiles: 0,
    skippedTiles: 0,
    currentPackageName: '',
    currentTile: '',
  }, { replace: true })

  pushRuntimeEvent('package-split-start', '开始按 KML 目录分包。', {
    kmlRootPath: resolvedKmlRoot,
    outputPath: resolvedOutputPath,
  })

  runtime.packagePromise = (async () => {
    try {
      const packages = useUploadedFiles
        ? await buildSplitPackagesFromUploadedFiles(uploadedKmlFiles, resolvedOutputPath, resolvedKmlRoot)
        : await buildSplitPackages(resolvedKmlRoot, resolvedOutputPath)
      const totalTiles = getMotherTileCountFromTaskContext(runtime.taskContext)
      updatePackageTaskState({
        totalPackages: packages.length,
        totalTiles,
        phase: 'copying',
        phaseLabel: totalTiles > 0 ? '按交集复制瓦片' : '按交集扫描并复制瓦片',
        status: 'running',
      })

      for (const pkg of packages) {
        await ensureDir(pkg.packageDir)
        if (!await fileExists(pkg.zipPath)) {
          pkg.changed = true
        }
        const kmlTargetPath = path.join(pkg.packageDir, path.basename(pkg.relativeFilePath || pkg.packageName || 'source.kml'))
        if (pkg.fileContent) {
          const changed = await writeTextFileIfChanged(kmlTargetPath, pkg.fileContent)
          if (changed) pkg.changed = true
        } else if (pkg.filePath) {
          const sourceContent = await fs.readFile(pkg.filePath, 'utf8')
          const changed = await writeTextFileIfChanged(kmlTargetPath, sourceContent)
          if (changed) pkg.changed = true
        }
      }

      await walkTileFiles(sourceTileRoot, async (tileMeta) => {
        const zoomKey = String(tileMeta.zoom)
        const candidates = packages.filter((pkg) => {
          const bounds = pkg.zoomBounds[zoomKey]
          if (!bounds) return false
          return tileMeta.x >= bounds.xMin
            && tileMeta.x <= bounds.xMax
            && tileMeta.y >= bounds.yMin
            && tileMeta.y <= bounds.yMax
        })

        let copiedDelta = 0
        let skippedDelta = 0
        let currentPackageName = ''
        if (candidates.length) {
          const tile = buildTileBoundsEntry(tileMeta.x, tileMeta.y, tileMeta.zoom)
          if (tile) {
            for (const pkg of candidates) {
              if (!tileIntersectsAnyPolygon(tile, pkg.polygons)) continue
              if (!currentPackageName) currentPackageName = pkg.displayName
              const copied = await copyFileIfMissing(
                tileMeta.fullPath,
                path.join(pkg.packageDir, TILE_ROOT_DIR, tileMeta.relativePath),
              )
              if (copied) {
                pkg.copiedTiles += 1
                pkg.changed = true
                copiedDelta += 1
              } else {
                skippedDelta += 1
              }
            }
          }
        }

        updatePackageTaskState({
          processedTiles: Number(runtime.packageTaskState?.processedTiles || 0) + 1,
          copiedTiles: Number(runtime.packageTaskState?.copiedTiles || 0) + copiedDelta,
          skippedTiles: Number(runtime.packageTaskState?.skippedTiles || 0) + skippedDelta,
          currentPackageName: currentPackageName || runtime.packageTaskState?.currentPackageName || '',
          currentTile: tileMeta.relativePath,
        })
      })

      await zipPackagesAndCreateBundle(packages, resolvedOutputPath)

      updatePackageTaskState({
        status: 'completed',
        phase: 'completed',
        phaseLabel: '分包完成',
        finishedAt: new Date().toISOString(),
        currentPackageName: '',
      })
      pushRuntimeEvent('package-split-done', 'KML 分包已完成。', {
        totalPackages: packages.length,
        copiedTiles: runtime.packageTaskState?.copiedTiles || 0,
        outputPath: resolvedOutputPath,
      })
    } catch (error) {
      updatePackageTaskState({
        status: 'failed',
        phase: 'failed',
        phaseLabel: '分包失败',
        finishedAt: new Date().toISOString(),
        error: error.message || String(error),
      })
      pushRuntimeEvent('package-split-failed', `KML 分包失败：${error.message || error}`)
      throw error
    } finally {
      runtime.packagePromise = null
      scheduleBroadcast(true)
    }
  })()
    .catch((error) => {
      console.error('[offline-tile-downloader] split packages failed:', error)
    })

  scheduleBroadcast(true)
}

async function runCompressPackagesTask({ outputPath } = {}) {
  ensureTaskIdle()
  if (!runtime.workspacePath || !runtime.taskContext?.taskDir) {
    throw new Error('请先选择并加载下载目录')
  }

  const resolvedOutputPath = path.resolve(String(outputPath || '').trim() || path.join(runtime.workspacePath, SPLIT_OUTPUT_DIR))

  runtime.events = []
  updatePackageTaskState({
    mode: 'compress',
    status: 'preparing',
    phase: 'scan-packages',
    phaseLabel: '扫描已有分包目录',
    workspacePath: runtime.workspacePath,
    sourceTileRoot: path.join(runtime.taskContext.taskDir, TILE_ROOT_DIR),
    kmlRootPath: '',
    outputPath: resolvedOutputPath,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: '',
    totalPackages: 0,
    completedPackages: 0,
    zippedPackages: 0,
    skippedZipPackages: 0,
    totalTiles: 0,
    processedTiles: 0,
    copiedTiles: 0,
    skippedTiles: 0,
    currentPackageName: '',
    currentTile: '',
    bundleZipPath: '',
  }, { replace: true })

  pushRuntimeEvent('package-compress-start', '开始压缩已有分包目录。', {
    outputPath: resolvedOutputPath,
  })

  runtime.packagePromise = (async () => {
    try {
      const packages = await collectExistingPackageDirectories(resolvedOutputPath)
      updatePackageTaskState({
        totalPackages: packages.length,
        status: 'running',
        phase: 'zipping',
        phaseLabel: `压缩分包目录（并行 ${Math.min(ZIP_CONCURRENCY, Math.max(packages.length, 1))}）`,
      })

      await zipPackagesAndCreateBundle(packages, resolvedOutputPath)

      updatePackageTaskState({
        status: 'completed',
        phase: 'completed',
        phaseLabel: '压缩完成',
        finishedAt: new Date().toISOString(),
        currentPackageName: '',
      })
      pushRuntimeEvent('package-compress-done', '已有分包目录压缩完成。', {
        totalPackages: packages.length,
        outputPath: resolvedOutputPath,
        bundleZipPath: runtime.packageTaskState?.bundleZipPath || '',
      })
    } catch (error) {
      updatePackageTaskState({
        status: 'failed',
        phase: 'failed',
        phaseLabel: '压缩失败',
        finishedAt: new Date().toISOString(),
        error: error.message || String(error),
      })
      pushRuntimeEvent('package-compress-failed', `分包压缩失败：${error.message || error}`)
      throw error
    } finally {
      runtime.packagePromise = null
      scheduleBroadcast(true)
    }
  })()
    .catch((error) => {
      console.error('[offline-tile-downloader] compress packages failed:', error)
    })

  scheduleBroadcast(true)
}

async function requestSystemShutdown() {
  if (process.platform === 'win32') {
    await execFileAsync('shutdown', ['/s', '/t', '30', '/f'])
    return 'Windows 关机命令已发出，系统将在 30 秒后关机。'
  }
  if (process.platform === 'darwin') {
    await execFileAsync('shutdown', ['-h', '+1'])
    return 'macOS 关机命令已发出，系统将在 1 分钟内关机。'
  }
  await execFileAsync('shutdown', ['-h', 'now'])
  return '系统关机命令已发出。'
}

async function markTaskStopped(taskContext, reason = '用户停止下载') {
  taskContext.taskState.status = 'stopped'
  pushRuntimeEvent('task-stopped', reason)
  refreshTaskProgressFromLevels(taskContext.taskState)
  await queuePersistTaskState(taskContext)
}

async function markTaskPaused(taskContext, reason = '用户暂停下载') {
  taskContext.taskState.status = 'paused'
  pushRuntimeEvent('task-paused', reason)
  refreshTaskProgressFromLevels(taskContext.taskState)
  await queuePersistTaskState(taskContext)
}

async function requestStopDownload() {
  const taskContext = runtime.taskContext
  if (!taskContext || !['running', 'stopping', 'pausing'].includes(taskContext.taskState.status)) {
    throw new Error('当前没有运行中的任务')
  }
  taskContext.stopRequested = true
  taskContext.pauseRequested = false
  taskContext.taskState.status = 'stopping'
  pushRuntimeEvent('task-stopping', '用户点击停止，正在落盘保存当前进度节点。')
  stopCountWorker()
  clearLiveChunkProgress()
  runtime.activeAbortControllers.forEach((controller) => controller.abort())
  await queuePersistTaskState(taskContext)
}

async function requestPauseDownload() {
  const taskContext = runtime.taskContext
  if (!taskContext || !['running', 'stopping', 'pausing'].includes(taskContext.taskState.status)) {
    throw new Error('当前没有运行中的任务')
  }
  taskContext.pauseRequested = true
  taskContext.stopRequested = false
  taskContext.taskState.status = 'pausing'
  pushRuntimeEvent('task-pausing', '用户点击暂停，正在保存当前分块游标。')
  stopCountWorker()
  clearLiveChunkProgress()
  runtime.activeAbortControllers.forEach((controller) => controller.abort())
  await queuePersistTaskState(taskContext)
}

async function fetchTileWithRetry(taskContext, tile, levelState) {
  const tileKey = tile.id
  if (taskContext.stopRequested) throw makeStopError()
  if (taskContext.pauseRequested) throw makePauseError()
  const controller = new AbortController()
  const timeoutHandle = setTimeout(() => controller.abort(), TILE_REQUEST_TIMEOUT_MS)
  runtime.activeAbortControllers.add(controller)
  runtime.inFlightTiles.add(tileKey)
  scheduleBroadcast(true)

  try {
    const response = await fetch(tile.src, { method: 'GET', signal: controller.signal })
    if (response.ok) {
      return Buffer.from(await response.arrayBuffer())
    }
    const error = new Error(`HTTP ${response.status}`)
    error.httpStatus = response.status
    throw error
  } catch (error) {
    if (taskContext.stopRequested) throw makeStopError()
    if (taskContext.pauseRequested) throw makePauseError()
    if (error?.name === 'AbortError') {
      const timeoutError = new Error(`Request timeout after ${TILE_REQUEST_TIMEOUT_MS}ms`)
      timeoutError.code = 'REQUEST_TIMEOUT'
      throw timeoutError
    }
    levelState.retryCount += 1
    refreshTaskProgressFromLevels(taskContext.taskState)
    scheduleBroadcast(true)
    throw error
  } finally {
    clearTimeout(timeoutHandle)
    runtime.activeAbortControllers.delete(controller)
    runtime.inFlightTiles.delete(tileKey)
    scheduleBroadcast(true)
  }
}

async function processChunk(taskContext, descriptor, concurrency) {
  const zoomKey = String(descriptor.zoom)
  const chunkMap = ensureChunkMap(taskContext, descriptor.zoom)
  const existing = chunkMap.get(descriptor.key)
  if (existing?.status === 'completed' || existing?.status === 'completed_unavailable') {
    return
  }

  const levelState = taskContext.taskState.levels[zoomKey] || createEmptyLevelState(descriptor.zoom)
  taskContext.taskState.levels[zoomKey] = levelState
  const unavailableTileIds = new Set(existing?.unavailableTileIds || [])
  let deferredTiles = mergeDeferredTiles(existing?.deferredTiles || [], [])
  const deferredTileIds = new Set(deferredTiles.map((tile) => tile.id))
  const chunkState = {
    key: descriptor.key,
    zoom: descriptor.zoom,
    xStart: descriptor.xStart,
    xEnd: descriptor.xEnd,
    yStart: descriptor.yStart,
    yEnd: descriptor.yEnd,
    status: 'partial',
    attempted: Number(existing?.attempted || 0),
    discovered: Number(existing?.discovered || 0),
    downloaded: Number(existing?.downloaded || 0),
    unavailable: unavailableTileIds.size,
    unavailableTileIds: Array.from(unavailableTileIds),
    deferredTiles,
    updatedAt: new Date().toISOString(),
  }
  setChunkResumeCursor(
    chunkState,
    descriptor,
    existing?.resumeCursorX ?? descriptor.xStart,
    existing?.resumeCursorY ?? descriptor.yStart,
  )
  await upsertChunkState(taskContext, chunkState)
  setLiveChunkProgress('download', descriptor, {
    status: 'running',
    discovered: Number(chunkState.discovered || 0),
    downloaded: 0,
    totalTiles: Number(chunkState.discovered || 0),
  })

  const initialCursor = normalizeChunkCursor(
    descriptor,
    existing?.resumeCursorX ?? descriptor.xStart,
    existing?.resumeCursorY ?? descriptor.yStart,
  )
  let cursorX = initialCursor.x
  let cursorY = initialCursor.y
  function nextTile() {
    while (cursorX <= descriptor.xEnd) {
      while (cursorY <= descriptor.yEnd) {
        const currentX = cursorX
        const currentY = cursorY
        cursorY += 1
        setChunkResumeCursor(chunkState, descriptor, cursorX, cursorY)
        const tile = buildWmsTileEntry(currentX, currentY, descriptor.zoom)
        if (!tile) continue
        if (!tileIntersectsAnyPolygon(tile, descriptor.polygons || [descriptor.polygon])) continue
        if (!tileSelectedForTask(descriptor.zoom, currentX, currentY, taskContext.taskState.options)) continue
        if (deferredTileIds.has(tile.id)) continue
        return tile
      }
      cursorX += 1
      cursorY = descriptor.yStart
      setChunkResumeCursor(chunkState, descriptor, cursorX, cursorY)
    }
    setChunkResumeCursor(chunkState, descriptor, descriptor.xEnd + 1, descriptor.yStart)
    return null
  }

  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      if (taskContext.stopRequested) throw makeStopError()
      if (taskContext.pauseRequested) throw makePauseError()
      const tile = nextTile()
      if (!tile) return
      if (runtime.inFlightTiles.has(tile.id)) continue
      if (await tileFileExists(taskContext, tile.zoom, tile.x, tile.y)) {
        if (deferredTileIds.delete(tile.id)) {
          deferredTiles = removeDeferredTile(deferredTiles, tile.id)
          chunkState.deferredTiles = deferredTiles
        }
        if (unavailableTileIds.delete(tile.id)) {
          chunkState.unavailable = unavailableTileIds.size
          chunkState.unavailableTileIds = Array.from(unavailableTileIds)
          levelState.unavailable = Math.max(0, Number(levelState.unavailable || 0) - 1)
        }
        chunkState.downloaded += 1
        levelState.downloaded += 1
        setLiveChunkProgress('download', descriptor, {
          discovered: Number(chunkState.discovered || 0),
          downloaded: Number(chunkState.downloaded || 0),
          totalTiles: Number(ensureChunkMap(taskContext, descriptor.zoom).get(descriptor.key)?.discovered || chunkState.discovered || 0),
        })
        refreshTaskProgressFromLevels(taskContext.taskState)
        scheduleBroadcast(true)
        continue
      }
      let buffer
      try {
        buffer = await fetchTileWithRetry(taskContext, tile, levelState)
      } catch (error) {
        if (isStopError(error) || isPauseError(error) || error?.name === 'AbortError') {
          if (!deferredTileIds.has(tile.id)) {
            deferredTileIds.add(tile.id)
            deferredTiles = upsertDeferredTile(deferredTiles, {
              id: tile.id,
              x: tile.x,
              y: tile.y,
              attempts: Number(deferredTiles.find((item) => item.id === tile.id)?.attempts || 0),
              lastError: isPauseError(error) ? 'paused' : 'stopped',
            })
            chunkState.deferredTiles = deferredTiles
          }
          throw error
        }
        const existingDeferred = deferredTiles.find((item) => item.id === tile.id)
        const attempts = Number(existingDeferred?.attempts || 0) + 1
        if (attempts >= TILE_MAX_ATTEMPTS) {
          deferredTileIds.delete(tile.id)
          deferredTiles = removeDeferredTile(deferredTiles, tile.id)
          if (!unavailableTileIds.has(tile.id)) {
            unavailableTileIds.add(tile.id)
            levelState.unavailable += 1
          }
          chunkState.unavailable = unavailableTileIds.size
          chunkState.unavailableTileIds = Array.from(unavailableTileIds)
          chunkState.deferredTiles = deferredTiles
          pushRuntimeEvent('tile-unavailable', makeTileUnavailableError(tile.id).message, { tileId: tile.id, zoom: tile.zoom, attempts })
          refreshTaskProgressFromLevels(taskContext.taskState)
          scheduleBroadcast(true)
          continue
        }
        deferredTileIds.add(tile.id)
        deferredTiles = upsertDeferredTile(deferredTiles, {
          id: tile.id,
          x: tile.x,
          y: tile.y,
          attempts,
          lastError: error?.httpStatus ? `HTTP ${error.httpStatus}` : (error.message || String(error)),
        })
        chunkState.deferredTiles = deferredTiles
        if (attempts === 1 || attempts % 5 === 0) {
          pushRuntimeEvent('tile-deferred', `瓦片 ${tile.id} 第 ${attempts} 次失败，已延后到尾部补试。`, {
            tileId: tile.id,
            zoom: tile.zoom,
            attempts,
            reason: error?.httpStatus ? `HTTP ${error.httpStatus}` : (error.message || String(error)),
          })
        }
        refreshTaskProgressFromLevels(taskContext.taskState)
        scheduleBroadcast(true)
        continue
      }
      if (taskContext.stopRequested) throw makeStopError()
      if (taskContext.pauseRequested) throw makePauseError()
      await writeTileToDisk(taskContext, tile, buffer)
      if (deferredTileIds.delete(tile.id)) {
        deferredTiles = removeDeferredTile(deferredTiles, tile.id)
        chunkState.deferredTiles = deferredTiles
      }
      if (unavailableTileIds.delete(tile.id)) {
        chunkState.unavailable = unavailableTileIds.size
        chunkState.unavailableTileIds = Array.from(unavailableTileIds)
        levelState.unavailable = Math.max(0, Number(levelState.unavailable || 0) - 1)
      }
      chunkState.downloaded += 1
      levelState.downloaded += 1
      setLiveChunkProgress('download', descriptor, {
        discovered: Number(chunkState.discovered || 0),
        downloaded: Number(chunkState.downloaded || 0),
        totalTiles: Number(ensureChunkMap(taskContext, descriptor.zoom).get(descriptor.key)?.discovered || chunkState.discovered || 0),
      })
      refreshTaskProgressFromLevels(taskContext.taskState)
      scheduleBroadcast(true)
    }
  })

  try {
    await Promise.all(workers)
    chunkState.status = deferredTiles.length > 0
      ? 'partial'
      : (unavailableTileIds.size > 0 ? 'completed_unavailable' : 'completed')
  } catch (error) {
    chunkState.status = isStopError(error) ? 'partial' : 'partial'
    throw error
  } finally {
    chunkState.unavailable = unavailableTileIds.size
    chunkState.unavailableTileIds = Array.from(unavailableTileIds)
    chunkState.deferredTiles = deferredTiles
    chunkState.updatedAt = new Date().toISOString()
    await upsertChunkState(taskContext, chunkState)
    removeLiveChunkProgress('download', descriptor)
    await queuePersistTaskState(taskContext)
  }
}

function descriptorFromChunkRecord(record) {
  return {
    key: record.key,
    zoom: Number(record.zoom),
    xStart: Number(record.xStart),
    xEnd: Number(record.xEnd),
    yStart: Number(record.yStart),
    yEnd: Number(record.yEnd),
  }
}

async function retryDeferredChunkTiles(taskContext, record, concurrency) {
  const descriptor = descriptorFromChunkRecord(record)
  const zoomKey = String(descriptor.zoom)
  const levelState = taskContext.taskState.levels[zoomKey] || createEmptyLevelState(descriptor.zoom)
  taskContext.taskState.levels[zoomKey] = levelState
  const unavailableTileIds = new Set(record.unavailableTileIds || [])
  let deferredTiles = mergeDeferredTiles(record.deferredTiles || [], [])
  if (!deferredTiles.length) return

  setLiveChunkProgress('download', descriptor, {
    status: 'retrying',
    discovered: Number(record.discovered || 0),
    downloaded: Number(record.downloaded || 0),
    totalTiles: Number(record.discovered || 0),
  })

  let cursor = 0
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (true) {
      if (taskContext.stopRequested) throw makeStopError()
      if (taskContext.pauseRequested) throw makePauseError()
      const current = deferredTiles[cursor]
      cursor += 1
      if (!current) return

      const tile = buildWmsTileEntry(Number(current.x), Number(current.y), descriptor.zoom)
      if (!tile) {
        deferredTiles = removeDeferredTile(deferredTiles, current.id)
        record.deferredTiles = deferredTiles
        continue
      }
      if (await tileFileExists(taskContext, tile.zoom, tile.x, tile.y)) {
        deferredTiles = removeDeferredTile(deferredTiles, tile.id)
        unavailableTileIds.delete(tile.id)
        record.downloaded = Number(record.downloaded || 0) + 1
        levelState.downloaded += 1
        levelState.unavailable = Math.max(0, Number(levelState.unavailable || 0) - 1)
        continue
      }

      try {
        const buffer = await fetchTileWithRetry(taskContext, tile, levelState)
        if (taskContext.stopRequested) throw makeStopError()
        if (taskContext.pauseRequested) throw makePauseError()
        await writeTileToDisk(taskContext, tile, buffer)
        deferredTiles = removeDeferredTile(deferredTiles, tile.id)
        unavailableTileIds.delete(tile.id)
        record.downloaded = Number(record.downloaded || 0) + 1
        levelState.downloaded += 1
        levelState.unavailable = Math.max(0, Number(levelState.unavailable || 0) - 1)
      } catch (error) {
        if (isStopError(error) || isPauseError(error) || error?.name === 'AbortError') {
          throw error
        }
        const attempts = Number(current.attempts || 0) + 1
        deferredTiles = upsertDeferredTile(removeDeferredTile(deferredTiles, tile.id), {
          id: tile.id,
          x: tile.x,
          y: tile.y,
          attempts,
          lastError: error?.httpStatus ? `HTTP ${error.httpStatus}` : (error.message || String(error)),
        })
        if (attempts >= TILE_MAX_ATTEMPTS) {
          deferredTiles = removeDeferredTile(deferredTiles, tile.id)
          if (!unavailableTileIds.has(tile.id)) {
            unavailableTileIds.add(tile.id)
            levelState.unavailable += 1
          }
          pushRuntimeEvent('tile-unavailable', makeTileUnavailableError(tile.id).message, {
            tileId: tile.id,
            zoom: tile.zoom,
            attempts,
          })
          continue
        }
        if (attempts === 1 || attempts % 5 === 0) {
          pushRuntimeEvent('tile-deferred', `瓦片 ${tile.id} 第 ${attempts} 次失败，继续放到尾部补试。`, {
            tileId: tile.id,
            zoom: tile.zoom,
            attempts,
            reason: error?.httpStatus ? `HTTP ${error.httpStatus}` : (error.message || String(error)),
          })
        }
      } finally {
        record.deferredTiles = deferredTiles
        record.unavailableTileIds = Array.from(unavailableTileIds)
        record.unavailable = unavailableTileIds.size
        setLiveChunkProgress('download', descriptor, {
          status: 'retrying',
          discovered: Number(record.discovered || 0),
          downloaded: Number(record.downloaded || 0),
          totalTiles: Number(record.discovered || 0),
        })
        refreshTaskProgressFromLevels(taskContext.taskState)
        scheduleBroadcast(true)
      }
    }
  })

  await Promise.all(workers)
  record.deferredTiles = deferredTiles
  record.unavailableTileIds = Array.from(unavailableTileIds)
  record.unavailable = unavailableTileIds.size
  record.status = deferredTiles.length > 0
    ? 'partial'
    : (unavailableTileIds.size > 0 ? 'completed_unavailable' : 'completed')
  record.updatedAt = new Date().toISOString()
  await upsertChunkState(taskContext, record)
  removeLiveChunkProgress('download', descriptor)
  await queuePersistTaskState(taskContext)
}

async function runDeferredRetries(taskContext, concurrency) {
  let pass = 0
  while (true) {
    const pendingRecords = []
    for (let zoom = taskContext.taskState.range.startZoom; zoom <= taskContext.taskState.range.endZoom; zoom += 1) {
      const chunkMap = ensureChunkMap(taskContext, zoom)
      for (const record of chunkMap.values()) {
        if (Array.isArray(record.deferredTiles) && record.deferredTiles.length > 0) {
          pendingRecords.push({ ...record })
        }
      }
    }
    if (!pendingRecords.length) return
    pass += 1
    pushRuntimeEvent('deferred-retry-pass', `开始第 ${pass} 轮尾部补试，共 ${pendingRecords.length} 个分块。`, {
      pass,
      chunkCount: pendingRecords.length,
    })
    for (const record of pendingRecords) {
      if (taskContext.stopRequested) throw makeStopError()
      if (taskContext.pauseRequested) throw makePauseError()
      await retryDeferredChunkTiles(taskContext, record, concurrency)
    }
  }
}

async function runTask(taskContext, concurrency) {
  clearLiveChunkProgress()
  taskContext.stopRequested = false
  taskContext.pauseRequested = false
  taskContext.taskState.status = 'running'
  taskContext.taskState.concurrency = concurrency
  await queuePersistTaskState(taskContext)
  pushRuntimeEvent('task-started', `任务开始执行，并发 ${concurrency}，范围 Z${taskContext.taskState.range.startZoom}-Z${taskContext.taskState.range.endZoom}。`)

  const descriptorMap = buildAllChunkDescriptors(taskContext.taskState)
  for (let zoom = taskContext.taskState.range.startZoom; zoom <= taskContext.taskState.range.endZoom; zoom += 1) {
    const zoomKey = String(zoom)
    const descriptors = descriptorMap[zoomKey] || []
    ensureChunkMap(taskContext, zoom)
    if (!taskContext.taskState.levels[zoomKey]) taskContext.taskState.levels[zoomKey] = createEmptyLevelState(zoom)
    taskContext.taskState.levels[zoomKey].chunkCount = descriptors.length
    taskContext.taskState.currentZoom = zoom
  }
  refreshTaskProgressFromLevels(taskContext.taskState)
  scheduleBroadcast(true)
  startCountWorker(taskContext, descriptorMap)

  try {
    for (let zoom = taskContext.taskState.range.startZoom; zoom <= taskContext.taskState.range.endZoom; zoom += 1) {
      taskContext.taskState.currentZoom = zoom
      const descriptors = descriptorMap[String(zoom)] || []
      pushRuntimeEvent('level-start', `开始处理 Z${zoom}，共 ${descriptors.length} 个扫描分块。`, { zoom })
      await queuePersistTaskState(taskContext)
      for (const descriptor of descriptors) {
        if (taskContext.pauseRequested) throw makePauseError()
        const existing = ensureChunkMap(taskContext, zoom).get(descriptor.key)
        if (existing?.status === 'completed' || existing?.status === 'completed_unavailable') continue
        await processChunk(taskContext, descriptor, concurrency)
      }
      pushRuntimeEvent('level-complete', `Z${zoom} 处理完成。`, { zoom })
      await queuePersistTaskState(taskContext)
    }
    await runDeferredRetries(taskContext, concurrency)
    if (runtime.countWorkerDonePromise) {
      pushRuntimeEvent('count-worker-wait', '下载已完成，等待计数线程完成最终总数统计。')
      await runtime.countWorkerDonePromise
    }
    if (runtime.countWorkerError) {
      throw runtime.countWorkerError
    }
    taskContext.taskState.status = 'completed'
    refreshTaskProgressFromLevels(taskContext.taskState)
    pushRuntimeEvent(
      'task-completed',
      `任务完成，已下载 ${taskContext.taskState.progress.downloadedTiles} 张，不可下载 ${taskContext.taskState.progress.unavailableTiles || 0} 张，共处理 ${taskContext.taskState.progress.handledTiles || taskContext.taskState.progress.downloadedTiles}/${taskContext.taskState.progress.totalTiles} 张瓦片。`,
    )
    await queuePersistTaskState(taskContext)
    if (taskContext.taskState.options?.autoShutdown) {
      pushRuntimeEvent('system-shutdown', '任务已完成，准备自动关机。')
      scheduleBroadcast(true)
      await sleep(500)
      const shutdownMessage = await requestSystemShutdown()
      pushRuntimeEvent('system-shutdown-sent', shutdownMessage)
      scheduleBroadcast(true)
    }
  } catch (error) {
    if (isStopError(error)) {
      await markTaskStopped(taskContext)
      return
    }
    if (isPauseError(error)) {
      await markTaskPaused(taskContext)
      return
    }
    taskContext.taskState.status = 'failed'
    await queuePersistTaskState(taskContext)
    pushRuntimeEvent('task-failed', `任务失败：${error.message || error}`)
    throw error
  } finally {
    stopCountWorker()
    clearLiveChunkProgress()
    refreshTaskProgressFromLevels(taskContext.taskState)
    scheduleBroadcast(true)
  }
}

function ensureTaskIdle() {
  if (runtime.runPromise) {
    throw new Error('当前已有任务在运行，请先停止或等待结束')
  }
  if (runtime.packagePromise) {
    throw new Error('当前正在执行 KML 分包，请等待完成')
  }
}

function parseConcurrency(value, fallback = 4) {
  return Math.max(1, Math.floor(toNumber(value, fallback)))
}

function parseZoom(value, fallback) {
  return clamp(Math.round(toNumber(value, fallback)), WMS_MIN_ZOOM, WMS_MAX_ZOOM)
}

async function selectWorkspace(basePathInput) {
  ensureTaskIdle()
  const rawPath = String(basePathInput || '').trim()
  if (!rawPath) throw new Error('下载目录不能为空')
  const resolved = path.resolve(rawPath)
  const startedAt = Date.now()
  runtime.events = []
  runtime.packageTaskState = null
  clearLiveChunkProgress()
  pushRuntimeEvent('workspace-select-start', '开始应用目录。', { basePath: resolved })
  await ensureDir(resolved)
  runtime.workspacePath = resolved
  runtime.taskContext = await loadTaskFromDirectory(resolved)
  pushRuntimeEvent('workspace-select-done', '目录应用完成。', {
    basePath: resolved,
    elapsedMs: Date.now() - startedAt,
  })
  scheduleBroadcast(true)
}

async function reloadWorkspace() {
  ensureTaskIdle()
  if (!runtime.workspacePath) throw new Error('请先设置下载目录')
  const startedAt = Date.now()
  runtime.events = []
  runtime.packageTaskState = null
  clearLiveChunkProgress()
  pushRuntimeEvent('workspace-reload-start', '开始重新读取目录。', { basePath: runtime.workspacePath })
  runtime.taskContext = await loadTaskFromDirectory(runtime.workspacePath)
  pushRuntimeEvent('workspace-reload-done', '目录重新读取完成。', {
    basePath: runtime.workspacePath,
    elapsedMs: Date.now() - startedAt,
  })
  scheduleBroadcast(true)
}

async function startCurrentTask({ polygon, polygons, zoom, concurrency, autoShutdown, highZoomStageStartPercent, highZoomStageEndPercent }) {
  ensureTaskIdle()
  if (!runtime.workspacePath) throw new Error('请先设置下载目录')
  const normalizedPolygons = normalizePolygonsInput(polygons, polygon)
  if (!normalizedPolygons.length) throw new Error('至少需要 1 个有效区域，每个区域至少 3 个点')
  if (!polygonsTouchChinaRegion(normalizedPolygons)) throw new Error('当前锚点区域完全不在中国范围内，已跳过下载')
  const targetZoom = parseZoom(zoom, DEFAULT_ZOOM)
  runtime.events = []
  const taskContext = await initializeTaskContext(
    runtime.workspacePath,
    targetZoom,
    targetZoom,
    normalizedPolygons,
    parseConcurrency(concurrency),
    normalizeTaskOptions({ autoShutdown, highZoomStageStartPercent, highZoomStageEndPercent }),
  )
  runtime.taskContext = taskContext
  scheduleBroadcast(true)
  runtime.runPromise = runTask(taskContext, taskContext.taskState.concurrency)
    .catch((error) => console.error('[offline-tile-downloader] task failed:', error))
    .finally(() => {
      runtime.runPromise = null
      scheduleBroadcast(true)
    })
}

async function startRangeTask({ polygon, polygons, startZoom, endZoom, concurrency, autoShutdown, highZoomStageStartPercent, highZoomStageEndPercent }) {
  ensureTaskIdle()
  if (!runtime.workspacePath) throw new Error('请先设置下载目录')
  const normalizedPolygons = normalizePolygonsInput(polygons, polygon)
  if (!normalizedPolygons.length) throw new Error('至少需要 1 个有效区域，每个区域至少 3 个点')
  if (!polygonsTouchChinaRegion(normalizedPolygons)) throw new Error('当前锚点区域完全不在中国范围内，已跳过下载')
  let start = parseZoom(startZoom, 6)
  let end = parseZoom(endZoom, 7)
  if (start > end) [start, end] = [end, start]
  runtime.events = []
  const taskContext = await initializeTaskContext(
    runtime.workspacePath,
    start,
    end,
    normalizedPolygons,
    parseConcurrency(concurrency),
    normalizeTaskOptions({ autoShutdown, highZoomStageStartPercent, highZoomStageEndPercent }),
  )
  runtime.taskContext = taskContext
  scheduleBroadcast(true)
  runtime.runPromise = runTask(taskContext, taskContext.taskState.concurrency)
    .catch((error) => console.error('[offline-tile-downloader] task failed:', error))
    .finally(() => {
      runtime.runPromise = null
      scheduleBroadcast(true)
    })
}

async function resumeTask(concurrency, options = {}) {
  ensureTaskIdle()
  if (!runtime.taskContext?.taskState) throw new Error('当前没有可恢复任务')
  if (!['paused', 'stopped', 'failed', 'ready', 'completed'].includes(runtime.taskContext.taskState.status)) {
    throw new Error('当前任务状态不支持恢复')
  }
  runtime.events = []
  const targetConcurrency = parseConcurrency(concurrency, runtime.taskContext.taskState.concurrency || 4)
  runtime.taskContext.taskState.concurrency = targetConcurrency
  runtime.taskContext.taskState.options = normalizeTaskOptions({ ...runtime.taskContext.taskState.options, ...options })
  runtime.runPromise = runTask(runtime.taskContext, targetConcurrency)
    .catch((error) => console.error('[offline-tile-downloader] task failed:', error))
    .finally(() => {
      runtime.runPromise = null
      scheduleBroadcast(true)
    })
}

function serveStatic(res, fileName) {
  const filePath = path.join(__dirname, fileName)
  const ext = path.extname(filePath)
  res.writeHead(200, {
    'Content-Type': CONTENT_TYPES[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store',
  })
  createReadStream(filePath).pipe(res)
}

async function serveOfflineTile(res, z, x, y) {
  if (!runtime.taskContext) {
    sendError(res, 404, '当前没有已加载任务')
    return
  }
  const tilePath = tileFilePath(runtime.taskContext, Number(z), Number(x), Number(y))
  if (!await fileExists(tilePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end('tile not found')
    return
  }
  res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' })
  createReadStream(tilePath).pipe(res)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`)
    const pathname = url.pathname
    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(res, 200, { ok: true, data: { status: 'ok' } })
      return
    }
    if (req.method === 'GET' && pathname === '/api/state') {
      sendJson(res, 200, makeSnapshot())
      return
    }
    if (req.method === 'POST' && pathname === '/api/dialog/select-directory') {
      const body = await readRequestJson(req)
      const selectedPath = await openDirectorySelectionDialog({
        title: body?.title,
        initialPath: body?.initialPath,
      })
      sendJson(res, 200, { ok: true, data: { path: selectedPath } })
      return
    }
    if (req.method === 'POST' && pathname === '/api/workspace') {
      const body = await readRequestJson(req)
      await selectWorkspace(body.basePath)
      sendJson(res, 200, makeSnapshot())
      return
    }
    if (req.method === 'POST' && pathname === '/api/task/reload') {
      await reloadWorkspace()
      sendJson(res, 200, makeSnapshot())
      return
    }
    if (req.method === 'POST' && pathname === '/api/task/current') {
      const body = await readRequestJson(req)
      await startCurrentTask(body)
      sendJson(res, 202, makeSnapshot())
      return
    }
    if (req.method === 'POST' && pathname === '/api/task/range') {
      const body = await readRequestJson(req)
      await startRangeTask(body)
      sendJson(res, 202, makeSnapshot())
      return
    }
    if (req.method === 'POST' && pathname === '/api/task/resume') {
      const body = await readRequestJson(req)
      await resumeTask(body?.concurrency, normalizeTaskOptions(body))
      sendJson(res, 202, makeSnapshot())
      return
    }
    if (req.method === 'POST' && pathname === '/api/task/pause') {
      await requestPauseDownload()
      sendJson(res, 202, makeSnapshot())
      return
    }
    if (req.method === 'POST' && pathname === '/api/task/stop') {
      await requestStopDownload()
      sendJson(res, 202, makeSnapshot())
      return
    }
    if (req.method === 'POST' && pathname === '/api/task/split-packages') {
      const body = await readRequestJson(req)
      await runSplitPackagesTask(body || {})
      sendJson(res, 202, makeSnapshot())
      return
    }
    if (req.method === 'POST' && pathname === '/api/task/compress-packages') {
      const body = await readRequestJson(req)
      await runCompressPackagesTask(body || {})
      sendJson(res, 202, makeSnapshot())
      return
    }
    const tileMatch = pathname.match(/^\/api\/offline-tiles\/(\d+)\/(\d+)\/(\d+)\.png$/)
    if (req.method === 'GET' && tileMatch) {
      await serveOfflineTile(res, tileMatch[1], tileMatch[2], tileMatch[3])
      return
    }
    if (req.method === 'GET' && STATIC_FILES.has(pathname)) {
      serveStatic(res, STATIC_FILES.get(pathname))
      return
    }
    sendError(res, 404, 'Not Found')
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : 500
    sendError(res, status, error.message || String(error))
  }
})

server.on('upgrade', (req, socket) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`)
    if (url.pathname !== '/ws') {
      socket.destroy()
      return
    }
    const key = req.headers['sec-websocket-key']
    if (!key) {
      socket.destroy()
      return
    }
    const accept = createHash('sha1').update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64')
    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '',
      '',
    ].join('\r\n'))
    runtime.clients.add(socket)
    socket.on('close', () => runtime.clients.delete(socket))
    socket.on('error', () => runtime.clients.delete(socket))
    socket.on('data', (buffer) => {
      if (!buffer?.length) return
      const opcode = buffer[0] & 0x0f
      if (opcode === 0x8) socket.end()
      if (opcode === 0x9) socket.write(Buffer.from([0x8a, 0x00]))
    })
    socket.write(encodeWsFrame(JSON.stringify({ type: 'snapshot', ...makeSnapshot() })))
  } catch (_error) {
    socket.destroy()
  }
})

server.listen(PORT, HOST, () => {
  console.log(`[offline-tile-downloader] server running at http://${HOST}:${PORT}`)
})
