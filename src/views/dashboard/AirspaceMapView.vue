<script setup>
import { computed, h, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { Input, Modal, message } from 'ant-design-vue'
import COS from 'cos-js-sdk-v5'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { EnvironmentOutlined } from '@ant-design/icons-vue'
import { fetchMarkers, reviewMarker, MARKER_REVIEW_STATUS, MARKER_SORT_BY } from '../../services/markers'
import {
  fetchAdminLowAltitudeCircles,
  fetchAdminLowAltitudeCircleReceipts,
  reviewLowAltitudeCircle,
  updateLowAltitudeCircleListing,
  updateAdminLowAltitudeCircle,
  startLowAltitudeCircleExport,
  startLowAltitudeCircleImport,
  subscribeLowAltitudeCircleBatchJob,
  downloadLowAltitudeCircleExport,
  LOW_ALTITUDE_CIRCLE_REVIEW_STATUS,
} from '../../services/lowAltitudeCircles'
import {
  fetchPins,
  reviewPin,
  updatePinStatus,
  PIN_REVIEW_STATUS,
  PIN_VISIBILITY,
  PIN_STATUS,
} from '../../services/pins'
import { fetchOrderByReference } from '../../services/orders'
import { repairWechatPaymentOrder } from '../../services/wechatPayments'
import {
  fetchPinVideoUploadFlpLimitConfig,
  savePinVideoUploadFlpLimitConfig,
  fetchTencentCosSts,
} from '../../services/config'
import detailIcon from '../../assets/img/detail.png'
import pointDefaultIcon from '../../assets/img/default.png'
import pointWarningIcon from '../../assets/img/drone-warning.png'
import pointAerialIcon from '../../assets/img/aerial.png'
import pointDockIcon from '../../assets/img/dock.png'
import pointElevationIcon from '../../assets/img/elevation.png'
import TemporaryNoFlyZoneManager from '../../components/noFlyZones/TemporaryNoFlyZoneManager.vue'
import { buildDownloadUrl, extractObjectName } from '../../services/files'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const loading = ref(false)
const tableData = ref([])
const activeMainTab = ref('markers')
const MARKER_TAB_STATUS = {
  ...MARKER_REVIEW_STATUS,
  ORDINARY: 'ORDINARY',
}
const activeStatus = ref(MARKER_REVIEW_STATUS.ALL)
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const detailVisible = ref(false)
const detailRecord = ref(null)
const circleAuditLoading = ref(false)
const circleAuditData = ref([])
const circleListingUpdatingIds = ref(new Set())
const activeCircleStatus = ref(LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.ALL)
const circlePagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})
const circleDetailVisible = ref(false)
const circleDetailRecord = ref(null)
const circleEditVisible = ref(false)
const circleEditSaving = ref(false)
const circleEditId = ref('')
const circleEditForm = reactive({
  category: 'REGIONAL_PILOTS', coverImage: '', showcaseImagesText: '', name: '', summary: '',
  description: '', entryRequirement: '', joinMethod: 'GROUP_QR', entryMode: 'FREE', entryPrice: 0,
  groupQrImage: '', groupLiveCodeUrl: '', ownerQrImage: '', memberCount: 0,
})
const circleSelectedIds = ref(new Set())
const circleSelectingAll = ref(false)
const circleBatchVisible = ref(false)
const circleBatchJob = ref(null)
let circleBatchAbortController = null
const circleReceiptVisible = ref(false)
const circleReceiptLoading = ref(false)
const circleReceiptData = ref([])
const circleReceiptRecord = ref(null)
const circleReceiptScope = ref('CIRCLE')
const circleReceiptPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})
const orderDetailVisible = ref(false)
const orderDetailLoading = ref(false)
const orderRepairing = ref(false)
const orderDetail = ref(null)
const markerSortBy = ref(MARKER_SORT_BY.CREATED_AT)
const sortOrder = ref('DESC')
const sortIndicator = computed(() => (sortOrder.value === 'ASC' ? '↑' : '↓'))
const sortLabel = computed(() => {
  if (markerSortBy.value === MARKER_SORT_BY.CERTIFICATION_EXPIRE_AT) {
    return sortOrder.value === 'ASC'
      ? t('airspace.sort.authExpireAscend')
      : t('airspace.sort.authExpireDescend')
  }
  return sortOrder.value === 'ASC'
    ? t('airspace.sort.createdAtAscend')
    : t('airspace.sort.createdAtDescend')
})

const pinAuditLoading = ref(false)
const pinAuditData = ref([])
const pinAuditPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})
const pinAuditVisibility = ref(PIN_VISIBILITY.PUBLIC)
const pinAuditReviewStatus = ref(PIN_REVIEW_STATUS.PENDING)
const pinDetailVisible = ref(false)
const pinDetailRecord = ref(null)
const pinVideoPlayerVisible = ref(false)
const pinVideoPlayerLoading = ref(false)
const pinVideoPlayerUrl = ref('')
const pinVideoPlayerName = ref('')
const mapPreviewVisible = ref(false)
const mapPreviewTarget = ref(null)
const mapPreviewKind = ref('pin')
const mapPreviewContainer = ref(null)
const mapPreviewInstance = ref(null)
const mapPreviewOverlays = ref([])
const pinRewardConfig = ref(null)
const pinRewardLoading = ref(false)
const pinRewardSaving = ref(false)
const pinRewardForm = reactive({
  videoUploadFlpLimit: null,
})

const ORDER_STATUS_COLORS = {
  WAITING_PAYMENT: 'gold',
  PAID: 'green',
  REFUNDED: 'blue',
}

const normalizeStatus = (value) => {
  if (Array.isArray(value)) {
    return normalizeStatus(value[0])
  }
  if (!value) return MARKER_REVIEW_STATUS.ALL
  const formatted = String(value).toUpperCase()
  return Object.values(MARKER_TAB_STATUS).includes(formatted) ? formatted : MARKER_REVIEW_STATUS.ALL
}

const updateRouteStatus = (status) => {
  const nextQuery = { ...route.query }
  if (status === MARKER_REVIEW_STATUS.ALL) {
    if (nextQuery.status === undefined) return
    delete nextQuery.status
  } else if (nextQuery.status === status) {
    return
  } else {
    nextQuery.status = status
  }
  router.replace({ query: nextQuery }).catch(() => { })
}

const mainTabs = computed(() => [
  { key: 'markers', label: t('airspace.mainTabs.markers') },
  { key: 'pinAudit', label: t('airspace.mainTabs.pinAudit') },
  { key: 'lowAltitudeCircles', label: t('airspace.mainTabs.lowAltitudeCircles') },
  { key: 'noFlyZones', label: t('airspace.mainTabs.noFlyZones') },
])

const pinVisibilityOptions = computed(() => [
  { value: PIN_VISIBILITY.PUBLIC, label: t('airspace.pinAudit.visibility.public') },
  { value: PIN_VISIBILITY.GROUP, label: t('airspace.pinAudit.visibility.group') },
  { value: PIN_VISIBILITY.PRIVATE, label: t('airspace.pinAudit.visibility.private') },
])

const pinReviewOptions = computed(() => [
  { value: PIN_REVIEW_STATUS.PENDING, label: t('airspace.pinAudit.reviewStatus.pending') },
  { value: PIN_REVIEW_STATUS.APPROVED_A, label: t('airspace.pinAudit.reviewStatus.approved_a') },
  { value: PIN_REVIEW_STATUS.APPROVED_B, label: t('airspace.pinAudit.reviewStatus.approved_b') },
  { value: PIN_REVIEW_STATUS.REJECTED, label: t('airspace.pinAudit.reviewStatus.rejected') },
])

const pinReviewStatusTabs = computed(() =>
  pinReviewOptions.value.map((option) => ({ key: option.value, label: option.label })),
)

const statusTabs = computed(() => [
  { key: MARKER_TAB_STATUS.ALL, label: t('airspace.tabs.all') },
  { key: MARKER_TAB_STATUS.DRAFT, label: t('airspace.tabs.draft') },
  { key: MARKER_TAB_STATUS.PENDING, label: t('airspace.tabs.pending') },
  { key: MARKER_TAB_STATUS.APPROVED, label: t('airspace.tabs.approved') },
  { key: MARKER_TAB_STATUS.ORDINARY, label: t('airspace.tabs.ordinary') },
  { key: MARKER_TAB_STATUS.REJECTED, label: t('airspace.tabs.rejected') },
])

const circleStatusTabs = computed(() => [
  { key: LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.ALL, label: t('airspace.circle.tabs.all') },
  { key: LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.PENDING, label: t('airspace.circle.tabs.pending') },
  { key: LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.APPROVED, label: t('airspace.circle.tabs.approved') },
  { key: LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.REJECTED, label: t('airspace.circle.tabs.rejected') },
])

const statusColors = {
  PENDING: 'gold',
  APPROVED: 'green',
  REJECTED: 'red',
  DRAFT: 'default',
}

const pinReviewColors = {
  PENDING: 'gold',
  APPROVED_A: 'green',
  APPROVED_B: 'cyan',
  REJECTED: 'red',
}

const pinStatusColors = {
  ALIVE: 'green',
  BANNED: 'red',
}

const pinShapeColors = {
  point: 'blue',
  line: 'geekblue',
  circle: 'orange',
  rectangle: 'purple',
  polygon: 'volcano',
  kml: 'cyan',
  kmz: 'purple',
  unknown: 'default',
}

const PIN_SHAPE_ALIASES = {
  AREA: 'POLYGON',
  AREA_POLYGON: 'POLYGON',
  AREA_CIRCLE: 'CIRCLE',
  AREA_RECTANGLE: 'RECTANGLE',
  LINE_PATH_BUFFER: 'LINE',
}

const PIN_POINT_CATEGORY_ALIASES = {
  POINT_DEFAULT: 'GENERAL',
  POINT_WARNING: 'WARNING',
  POINT_AERIAL: 'AERIAL_SHOT',
  POINT_DOCK: 'TAKEOFF_LANDING',
  POINT_ELEVATION: 'TALL_BUILDING',
}

const PIN_LINE_CATEGORY_ALIASES = {
  LINE_PATH_BUFFER: 'TEMPORARY_NO_FLY_ZONE_BUFFER',
}

const markerTypeColors = {
  point: 'blue',
  line: 'geekblue',
  polygon: 'volcano',
  unknown: 'default',
}

// QQ 颜色工具（与临时禁飞区一致）
const toQqColor = (value, opacity = 1) => {
  const toRgb = (input) => {
    if (typeof input !== 'string') return null
    const hex = input.trim().replace('#', '')
    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
      }
    }
    const m = input.match(/^rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
    if (m) {
      return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) }
    }
    return null
  }

  const rgb = toRgb(value)
  if (window.qq?.maps?.Color && rgb) {
    const clamp = (v) => Math.max(0, Math.min(255, Number.isFinite(v) ? v : 0))
    const a = Math.max(0, Math.min(1, Number(opacity)))
    return new window.qq.maps.Color(clamp(rgb.r), clamp(rgb.g), clamp(rgb.b), a)
  }
  return value
}

// --- geometry helpers for map preview ---
const toPlainCoordinate = (coord) => {
  if (!coord) return null
  const lat = Number(coord.latitude ?? coord.lat)
  const lng = Number(coord.longitude ?? coord.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { latitude: lat, longitude: lng }
}

const normalizeCoordinateList = (entries) => {
  if (!Array.isArray(entries)) return []
  return entries.map((item) => toPlainCoordinate(item)).filter(Boolean)
}

const normalizePinCoordinateGroups = (pin) => {
  const groups = pin?.shape?.coordinateGroups
  if (!groups || typeof groups !== 'object') return null
  const normalized = {}
  Object.entries(groups).forEach(([key, value]) => {
    const normalizedKey = String(key).toLowerCase()
    const coords = normalizeCoordinateList(value)
    if (coords.length) {
      normalized[normalizedKey] = coords
    }
  })
  return Object.keys(normalized).length ? normalized : null
}

const inferShapeKeyFromCoordinates = (coords = []) => {
  if (!Array.isArray(coords) || !coords.length) return ''
  if (coords.length === 1) return 'point'
  if (coords.length === 2) return 'line'
  if (coords.length >= 3) return 'polygon'
  return ''
}

const inferShapeKeyFromGroups = (groups) => {
  if (!groups) return ''
  if (Array.isArray(groups.polygon) && groups.polygon.length) return 'polygon'
  if (Array.isArray(groups.line) && groups.line.length) return 'line'
  if (Array.isArray(groups.point) && groups.point.length) return 'point'
  return ''
}

const resolvePinCoordinates = (pin, preferredKey) => {
  const groups = normalizePinCoordinateGroups(pin)
  if (preferredKey && groups?.[preferredKey]?.length) return groups[preferredKey]
  const inferred = inferShapeKeyFromGroups(groups)
  if (inferred && groups?.[inferred]?.length) return groups[inferred]
  return normalizeCoordinateList(pin?.shape?.coordinates)
}

const getPinCoordinateCount = (pin) => {
  const groups = normalizePinCoordinateGroups(pin)
  if (groups) {
    return Object.values(groups).reduce((total, list) => total + (list?.length || 0), 0)
  }
  return normalizeCoordinateList(pin?.shape?.coordinates).length
}

const EARTH_RADIUS = 6378137

const projectToMercator = ({ latitude, longitude }) => {
  const x = ((longitude * Math.PI) / 180) * EARTH_RADIUS
  const y = Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360)) * EARTH_RADIUS
  return { x, y }
}

const unprojectFromMercator = ({ x, y }) => {
  const lng = (x / EARTH_RADIUS) * (180 / Math.PI)
  const lat = (2 * Math.atan(Math.exp(y / EARTH_RADIUS)) - Math.PI / 2) * (180 / Math.PI)
  return { lat, lng }
}

const normalizeVector = ({ x, y }) => {
  const length = Math.sqrt(x * x + y * y)
  if (!length) return { x: 0, y: 0, length: 0 }
  return { x: x / length, y: y / length, length }
}

const segmentNormal = (start, end) => {
  const { x, y, length } = normalizeVector({ x: end.x - start.x, y: end.y - start.y })
  if (!length) return null
  return { x: -y, y: x }
}

const computePathBufferPolygon = (points, distanceMeters) => {
  const distance = Number(distanceMeters)
  if (!Array.isArray(points) || points.length < 2 || !Number.isFinite(distance) || distance <= 0) {
    return []
  }
  const plain = points.map((point) => toPlainCoordinate(point)).filter(Boolean)
  if (plain.length < 2) return []
  const projected = plain.map((coord) => projectToMercator(coord))
  const leftSide = []
  const rightSide = []

  for (let i = 0; i < projected.length; i += 1) {
    const current = projected[i]
    if (!current) continue
    let normal = null
    if (i === 0 && projected[i + 1]) {
      normal = segmentNormal(current, projected[i + 1])
    } else if (i === projected.length - 1 && projected[i - 1]) {
      normal = segmentNormal(projected[i - 1], current)
    } else if (projected[i - 1] && projected[i + 1]) {
      const prevNormal = segmentNormal(projected[i - 1], current)
      const nextNormal = segmentNormal(current, projected[i + 1])
      if (prevNormal && nextNormal) {
        const combined = { x: prevNormal.x + nextNormal.x, y: prevNormal.y + nextNormal.y }
        const { x: nx, y: ny, length } = normalizeVector(combined)
        if (length > 1e-6) {
          normal = { x: nx, y: ny }
        } else {
          normal = prevNormal || nextNormal
        }
        const reference = prevNormal || nextNormal
        if (reference) {
          const dot = Math.abs(normal.x * reference.x + normal.y * reference.y)
          const scale = distance / Math.max(dot, 0.2)
          leftSide.push({ x: current.x + normal.x * scale, y: current.y + normal.y * scale })
          rightSide.push({ x: current.x - normal.x * scale, y: current.y - normal.y * scale })
          continue
        }
      }
      normal = prevNormal || nextNormal
    }
    if (!normal) continue
    const { x: nx, y: ny, length } = normalizeVector(normal)
    if (length <= 0) continue
    leftSide.push({ x: current.x + nx * distance, y: current.y + ny * distance })
    rightSide.push({ x: current.x - nx * distance, y: current.y - ny * distance })
  }

  if (leftSide.length < 2 || rightSide.length < 2) {
    return []
  }
  const polygon = [...leftSide, ...rightSide.reverse()]
  if (polygon.length) {
    polygon.push({ ...polygon[0] })
  }
  return polygon.map((point) => {
    const unprojected = unprojectFromMercator(point)
    return { latitude: unprojected.lat, longitude: unprojected.lng }
  })
}

const formatDateTime = (value) => {
  if (!value) return '-'
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value))
  } catch (error) {
    return value
  }
}

const statusText = (status) => {
  if (!status) return t('airspace.status.unknown')
  return t(`airspace.status.${status.toLowerCase()}`)
}

const circleStatusText = (status) => {
  if (!status) return t('airspace.circle.status.unknown')
  return t(`airspace.circle.status.${String(status).toLowerCase()}`, status)
}

const circleCategoryText = (category) => {
  if (!category) return '-'
  return t(`airspace.circle.category.${String(category).toLowerCase()}`, category)
}

const circleOverviewText = (record = {}) =>
  record.description || record.entryRequirement || record.summary || t('airspace.table.placeholders.notProvided')

const circleJoinMethodText = (joinMethod) => {
  if (joinMethod === 'GROUP_LIVE_CODE') return '群活码按钮'
  if (!joinMethod) return t('airspace.circle.joinMethod.unknown')
  return t(`airspace.circle.joinMethod.${String(joinMethod).toLowerCase()}`, joinMethod)
}

const circleEntryModeText = (entryMode) =>
  String(entryMode || 'FREE').toUpperCase() === 'PAID'
    ? t('airspace.circle.entryMode.paid')
    : t('airspace.circle.entryMode.free')

const isPaidCircle = (record = {}) => String(record.entryMode || 'FREE').toUpperCase() === 'PAID'

const formatCircleAmount = (value) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? `¥${amount.toFixed(2)}` : '-'
}

const pinVisibilityText = (visibility) => {
  if (!visibility) return '-'
  const key = String(visibility).toLowerCase()
  return t(`airspace.pinAudit.visibility.${key}`, visibility)
}

const pinReviewStatusText = (status) => {
  if (!status) return t('airspace.pinAudit.reviewStatus.unknown')
  const key = String(status).toLowerCase()
  return t(`airspace.pinAudit.reviewStatus.${key}`, status)
}

const pinStatusText = (status) => {
  if (!status) return '-'
  const key = String(status).toLowerCase()
  return t(`airspace.pinAudit.pinStatus.${key}`, status)
}

const normalizeShapeType = (pin) => {
  const raw = pin?.shape?.type || pin?.shapeType
  const normalized = typeof raw === 'string' ? raw.toUpperCase() : ''
  if (PIN_SHAPE_ALIASES[normalized]) {
    return PIN_SHAPE_ALIASES[normalized]
  }
  return normalized
}

const pinShapeKey = (pin) => {
  const normalized = normalizeShapeType(pin)
  if (normalized === 'POINT') return 'point'
  if (normalized === 'LINE') return 'line'
  if (normalized === 'CIRCLE') return 'circle'
  if (normalized === 'RECTANGLE') return 'rectangle'
  if (normalized === 'POLYGON') return 'polygon'
  if (normalized === 'KML') return 'kml'
  if (normalized === 'KMZ') return 'kmz'
  const inferred = inferShapeKeyFromGroups(normalizePinCoordinateGroups(pin))
    || inferShapeKeyFromCoordinates(normalizeCoordinateList(pin?.shape?.coordinates))
  return inferred || 'unknown'
}

const resolvePinPreviewShapeKey = (pin) => {
  const shapeKey = pinShapeKey(pin)
  if (shapeKey !== 'kml' && shapeKey !== 'kmz') return shapeKey
  const groups = normalizePinCoordinateGroups(pin)
  const inferred = inferShapeKeyFromGroups(groups)
  if (inferred) return inferred
  const coords = normalizeCoordinateList(pin?.shape?.coordinates)
  return inferShapeKeyFromCoordinates(coords) || 'unknown'
}

const normalizePointCategory = (pin) => {
  const raw = pin?.shape?.pointCategory || pin?.pointCategory
  const normalized = typeof raw === 'string' ? raw.toUpperCase() : ''
  return PIN_POINT_CATEGORY_ALIASES[normalized] || normalized
}

const normalizeLineCategory = (pin) => {
  const raw = pin?.shape?.lineCategory || pin?.lineCategory
  const normalized = typeof raw === 'string' ? raw.toUpperCase() : ''
  return PIN_LINE_CATEGORY_ALIASES[normalized] || normalized
}

const pinShapeText = (pin) => t(`airspace.pinAudit.shapeType.${pinShapeKey(pin)}`)

const pinShapeCategoryText = (pin) => {
  const shapeKey = pinShapeKey(pin)
  if (shapeKey === 'point') {
    const pointKey = normalizePointCategory(pin)
    if (pointKey) {
      const key = pointKey.toLowerCase()
      return t(`airspace.pinAudit.shapePointCategory.${key}`, pointKey)
    }
  }
  if (shapeKey === 'line') {
    const lineKey = normalizeLineCategory(pin)
    if (lineKey) {
      const key = lineKey.toLowerCase()
      return t(`airspace.pinAudit.shapeLineCategory.${key}`, lineKey)
    }
  }
  if (shapeKey === 'circle') return t('airspace.pinAudit.shapeType.circle')
  if (shapeKey === 'rectangle') return t('airspace.pinAudit.shapeType.rectangle')
  if (shapeKey === 'polygon') return t('airspace.pinAudit.shapeType.polygon')
  return ''
}

const pinShapeDisplay = (pin) => {
  const typeLabel = pinShapeText(pin)
  const category = pinShapeCategoryText(pin)
  if (category && pinShapeKey(pin) !== 'circle' && pinShapeKey(pin) !== 'rectangle' && pinShapeKey(pin) !== 'polygon') {
    return `${typeLabel} - ${category}`
  }
  if (category && ['circle', 'rectangle', 'polygon'].includes(pinShapeKey(pin))) {
    return category
  }
  return typeLabel
}

const pointIconByCategory = {
  GENERAL: pointDefaultIcon,
  WARNING: pointWarningIcon,
  AERIAL_SHOT: pointAerialIcon,
  TAKEOFF_LANDING: pointDockIcon,
  TALL_BUILDING: pointElevationIcon,
}

const clearMapPreviewOverlays = () => {
  if (!mapPreviewOverlays.value.length) return
  mapPreviewOverlays.value.forEach((overlay) => {
    try {
      overlay.setMap(null)
    } catch (err) {
      // ignore
    }
  })
  mapPreviewOverlays.value = []
}

const ensureTencentMapScript = () =>
  new Promise((resolve, reject) => {
    if (window.qq?.maps) {
      resolve(window.qq.maps)
      return
    }
    const existing = document.getElementById('qqmaps-script-preview')
    if (existing) {
      existing.onload = () => resolve(window.qq?.maps)
      existing.onerror = (err) => reject(err)
      return
    }
    const script = document.createElement('script')
    script.id = 'qqmaps-script-preview'
    script.src = `https://map.qq.com/api/js?v=2.exp&key=${import.meta.env.VITE_TENCENT_MAP_KEY || 'GEDBZ-R36KT-S52XJ-LTI4K-WWZK7-USFNP'}`
    script.onload = () => resolve(window.qq?.maps)
    script.onerror = (err) => reject(err)
    document.body.appendChild(script)
  })

const initMapPreview = async () => {
  await ensureTencentMapScript()
  if (!mapPreviewContainer.value) return
  mapPreviewContainer.value.innerHTML = ''
  if (!mapPreviewInstance.value) {
    mapPreviewInstance.value = new window.qq.maps.Map(mapPreviewContainer.value, {
      center: new window.qq.maps.LatLng(26.074508, 119.296494),
      zoom: 11,
      disableDoubleClickZoom: true,
    })
  } else {
    window.qq?.maps?.event?.trigger?.(mapPreviewInstance.value, 'resize')
  }
}

const formatUnixSecondsDateTime = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return '-'
  return formatDateTime(numeric * 1000)
}

const COS_HOST_PATTERN = /^(?<bucket>.+)\.cos\.(?<region>[^.]+)\.(?:myqcloud\.com|tencentcos\.cn)$/i

const normalizeObjectKey = (value) =>
  String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .split('?')[0]
    .split('#')[0]

const parseCosVideoSource = (value, stsConfig) => {
  const raw = String(value || '').trim()
  if (!raw) return null

  if (/^https?:\/\//i.test(raw)) {
    try {
      const target = new URL(raw)
      const hostMatch = target.hostname.match(COS_HOST_PATTERN)
      if (!hostMatch?.groups?.bucket || !hostMatch?.groups?.region) {
        return { mode: 'direct', url: raw }
      }
      return {
        mode: 'cos',
        bucket: hostMatch.groups.bucket,
        region: hostMatch.groups.region,
        key: normalizeObjectKey(decodeURIComponent(target.pathname || '')),
      }
    } catch (error) {
      return { mode: 'direct', url: raw }
    }
  }

  const defaultBucket = Array.isArray(stsConfig?.buckets) ? stsConfig.buckets[0] : ''
  const defaultRegion = String(stsConfig?.region || '').trim()
  if (!defaultBucket || !defaultRegion) {
    return null
  }

  return {
    mode: 'cos',
    bucket: defaultBucket,
    region: defaultRegion,
    key: normalizeObjectKey(raw),
  }
}

const createTencentCosClient = (sts) =>
  new COS({
    SecretId: sts.tmpSecretId,
    SecretKey: sts.tmpSecretKey,
    SecurityToken: sts.sessionToken,
    Protocol: 'https:',
  })

const getTencentCosObjectUrl = (client, params) =>
  new Promise((resolve, reject) => {
    client.getObjectUrl(params, (error, data) => {
      if (error) {
        reject(error)
        return
      }
      resolve(data)
    })
  })

const resolvePinVideoPlaybackUrl = async (videoLink) => {
  const trimmedLink = String(videoLink || '').trim()
  if (!trimmedLink) return ''

  const directSource = parseCosVideoSource(trimmedLink)
  if (directSource?.mode === 'direct') {
    return directSource.url
  }

  const sts = await fetchTencentCosSts()
  const source = directSource || parseCosVideoSource(trimmedLink, sts)
  if (!source) return ''
  if (source.mode === 'direct') return source.url

  const client = createTencentCosClient(sts)
  const result = await getTencentCosObjectUrl(client, {
    Bucket: source.bucket,
    Region: source.region,
    Key: source.key,
    Sign: true,
    Protocol: 'https:',
  })

  return result?.Url || result || ''
}

const resolveLatestUpdatedAt = (...values) => {
  const latestValue = values
    .map((value) => ({
      raw: value,
      time: value ? new Date(value).getTime() : Number.NaN,
    }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((left, right) => right.time - left.time)[0]

  return latestValue?.raw || values.find(Boolean) || null
}

const getPinCoordinates = (pin, preferredKey) => {
  const coords = resolvePinCoordinates(pin, preferredKey)
  if (!coords.length || !window.qq?.maps) return []
  return coords
    .map((item) => new window.qq.maps.LatLng(item.latitude, item.longitude))
    .filter(Boolean)
}

const getMarkerLocationLatLng = (marker) => {
  const lat = Number(marker?.location?.latitude ?? marker?.location?.lat)
  const lng = Number(marker?.location?.longitude ?? marker?.location?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return new window.qq.maps.LatLng(lat, lng)
}

const renderPointPreview = (center, pin) => {
  const map = mapPreviewInstance.value
  if (!map || !center) return
  const iconKey = (normalizePointCategory(pin) || 'GENERAL').toUpperCase()
  const icon = pointIconByCategory[iconKey] || pointDefaultIcon
  const size = new window.qq.maps.Size(40, 40)
  const marker = new window.qq.maps.Marker({
    map,
    position: center,
    icon: new window.qq.maps.MarkerImage(icon, size, new window.qq.maps.Point(0, 0), new window.qq.maps.Point(20, 20), size),
    zIndex: 3,
  })
  const labelText = (() => {
    const name = pin?.name || t('airspace.table.placeholders.unnamed')
    const height = [
      pin?.shape?.height,
      pin?.shape?.elevation,
      pin?.shape?.altitude,
      pin?.height,
      pin?.elevation,
      pin?.altitude,
    ].map((v) => Number(v)).find((v) => Number.isFinite(v))
    if (iconKey === 'TALL_BUILDING' && Number.isFinite(height)) {
      return `${name} ${height}m`
    }
    return name
  })()
  const label = new window.qq.maps.Label({
    map,
    position: center,
    content: labelText,
    offset: new window.qq.maps.Size(0, -46),
  })
  label.setStyle({
    background: '#fff',
    color: '#111827',
    padding: '6px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '700',
    border: '1px solid rgba(0,0,0,0.15)',
    boxShadow: '0 8px 16px rgba(0,0,0,0.18)',
    whiteSpace: 'nowrap',
    transform: 'translate(-50%, -100%)',
  })
  mapPreviewOverlays.value.push(label)
  mapPreviewOverlays.value.push(marker)
  map.setCenter(center)
  map.setZoom(16)
}

const renderLinePreview = (points) => {
  const map = mapPreviewInstance.value
  if (!map || !points.length) return
  const rawDistance =
    Number(mapPreviewTarget.value?.shape?.width ?? mapPreviewTarget.value?.shape?.pathDistanceMeters ?? 50)
  const distanceMeters = Number.isFinite(rawDistance) ? rawDistance : 50
  const buffer = computePathBufferPolygon(
    points.map((pt) => ({ latitude: pt.getLat(), longitude: pt.getLng() })),
    distanceMeters,
  )
  if (buffer.length >= 3) {
    const bufferLatLng = buffer.map((coord) => new window.qq.maps.LatLng(coord.latitude, coord.longitude))
    const polygon = new window.qq.maps.Polygon({
      map,
      path: bufferLatLng,
      strokeColor: toQqColor('#ff4d4f', 1),
      strokeWeight: 1,
      strokeOpacity: 1,
      fillColor: toQqColor('#ff4d4f', 0.12),
      fillOpacity: 0.12,
      zIndex: 2,
    })
    mapPreviewOverlays.value.push(polygon)
  }
  const polyline = new window.qq.maps.Polyline({
    map,
    path: points,
    strokeColor: toQqColor('#ff4d4f', 1),
    strokeWeight: 1,
    strokeDashStyle: 'dash',
    zIndex: 3,
  })
  mapPreviewOverlays.value.push(polyline)
  const bounds = new window.qq.maps.LatLngBounds()
  points.forEach((pt) => bounds.extend(pt))
  map.fitBounds(bounds)
}

const renderPolygonPreview = (points) => {
  const map = mapPreviewInstance.value
  if (!map || points.length < 3) return
  const polygon = new window.qq.maps.Polygon({
    map,
    path: points,
    strokeColor: toQqColor('#ff4d4f', 1),
    strokeWeight: 1,
    strokeOpacity: 1,
    fillColor: toQqColor('#ff4d4f', 0.12),
    fillOpacity: 0.12,
    zIndex: 2,
  })
  mapPreviewOverlays.value.push(polygon)
  const bounds = new window.qq.maps.LatLngBounds()
  points.forEach((pt) => bounds.extend(pt))
  map.fitBounds(bounds)
}

const renderCirclePreview = (center, radiusKm = 0) => {
  const map = mapPreviewInstance.value
  if (!map || !center) return
  const circle = new window.qq.maps.Circle({
    map,
    center,
    radius: Math.max(0, Number(radiusKm || 0)) * 1000,
    strokeColor: toQqColor('#ff4d4f', 1),
    strokeWeight: 1,
    strokeOpacity: 1,
    fillColor: toQqColor('#ff4d4f', 0.12),
    fillOpacity: 0.12,
    zIndex: 2,
  })
  mapPreviewOverlays.value.push(circle)
  map.setCenter(center)
  map.fitBounds(circle.getBounds())
}

const renderShapePreview = async () => {
  clearMapPreviewOverlays()
  await initMapPreview()
  if (!mapPreviewInstance.value || !mapPreviewTarget.value) return
  const target = mapPreviewTarget.value
  if (mapPreviewKind.value === 'marker') {
    const center = getMarkerLocationLatLng(target)
    if (!center) {
      message.warning(t('airspace.messages.mapPreviewMissing'))
      return
    }
    renderPointPreview(center, null)
    return
  }
  const shapeKey = resolvePinPreviewShapeKey(target)
  const preferredKey = shapeKey === 'line'
    ? 'line'
    : shapeKey === 'polygon' || shapeKey === 'rectangle'
      ? 'polygon'
      : shapeKey === 'point' || shapeKey === 'circle'
        ? 'point'
        : null
  const points = getPinCoordinates(target, preferredKey)
  if (!points.length && shapeKey === 'point') {
    message.warning(t('airspace.messages.mapPreviewMissing'))
    return
  }
  switch (shapeKey) {
    case 'point': {
      renderPointPreview(points[0], target)
      break
    }
    case 'line': {
      renderLinePreview(points)
      break
    }
    case 'polygon': {
      renderPolygonPreview(points)
      break
    }
    case 'rectangle': {
      renderPolygonPreview(points)
      break
    }
    case 'circle': {
      const center = points[0]
      renderCirclePreview(center, target?.shape?.radius)
      break
    }
    default: {
      if (points.length) {
        renderPolygonPreview(points)
      } else {
        message.warning(t('airspace.messages.mapPreviewMissing'))
      }
    }
  }
}

const openMapPreview = async (record, kind = 'pin') => {
  mapPreviewTarget.value = record
  mapPreviewKind.value = kind
  mapPreviewVisible.value = true
  await nextTick()
  renderShapePreview()
}

const closeMapPreview = () => {
  mapPreviewVisible.value = false
}

watch(mapPreviewVisible, (visible) => {
  if (!visible) {
    clearMapPreviewOverlays()
    mapPreviewInstance.value = null
  }
})

const markerTypeKey = (marker) => {
  const raw = marker?.type || marker?.geometryType || marker?.shapeType
  const normalized = typeof raw === 'string' ? raw.toUpperCase() : ''
  if (normalized.includes('POINT')) return 'point'
  if (normalized.includes('LINE')) return 'line'
  if (normalized.includes('POLYGON') || normalized.includes('AREA') || normalized.includes('SURFACE')) {
    return 'polygon'
  }
  return 'unknown'
}

const markerTypeText = (marker) => t(`airspace.markerType.${markerTypeKey(marker)}`)

const circleStatusColors = {
  PENDING: 'gold',
  APPROVED: 'green',
  REJECTED: 'red',
  BANNED: 'volcano',
}

const getCircleStatusDisplay = (record) => {
  const status = record?.status
  return {
    text: circleStatusText(status),
    color: circleStatusColors[status] || 'default',
  }
}

const resolveCircleAssetUrl = (value) => {
  const objectName = extractObjectName(value || '')
  return objectName ? buildDownloadUrl(objectName) : value || ''
}

const resolveCircleImageList = (record) => {
  const seen = new Set()
  const result = []
  const append = (value) => {
    const normalized = extractObjectName(value || '') || String(value || '').trim()
    if (!normalized || seen.has(normalized)) return
    seen.add(normalized)
    result.push(value)
  }
  append(record?.coverImage)
  if (Array.isArray(record?.showcaseImages)) {
    record.showcaseImages.forEach(append)
  }
  return result
}

const isDraftRecord = (record) => {
  if (!record) return false
  if (typeof record.draft === 'boolean') {
    return record.draft
  }
  return String(record.reviewStatus || '').toUpperCase() === MARKER_REVIEW_STATUS.DRAFT
}

const isOrdinaryMarkerRecord = (record) =>
  String(record?.reviewStatus || '').toUpperCase() === MARKER_REVIEW_STATUS.APPROVED && !record?.paid

const isPaidApprovedMarkerRecord = (record) =>
  String(record?.reviewStatus || '').toUpperCase() === MARKER_REVIEW_STATUS.APPROVED && !!record?.paid

const normalizeApprovedReviewStatus = (value) => {
  const normalized = String(value || '').toUpperCase()
  if ([PIN_REVIEW_STATUS.APPROVED_A, PIN_REVIEW_STATUS.APPROVED_B].includes(normalized)) {
    return normalized
  }
  return null
}

const resolvePinHistoricalApprovedStatus = (pin) => {
  const candidates = [
    pin?.lastRewardedStatus,
    pin?.lastApprovedReviewStatus,
    pin?.previousApprovedReviewStatus,
    pin?.previousApprovedStatus,
    pin?.lastApprovedStatus,
    pin?.historicalApprovedStatus,
    pin?.historyReviewStatus,
    pin?.previousReviewStatus,
    pin?.lastReviewStatus,
    pin?.auditInfo?.lastRewardedStatus,
    pin?.auditInfo?.lastApprovedReviewStatus,
    pin?.auditInfo?.previousApprovedReviewStatus,
    pin?.auditInfo?.previousReviewStatus,
    pin?.auditInfo?.lastReviewStatus,
  ]
  return candidates.map((value) => normalizeApprovedReviewStatus(value)).find(Boolean) || null
}

const canReviewPin = (pin) =>
  pin?.visibility === PIN_VISIBILITY.PUBLIC && pin?.reviewStatus === PIN_REVIEW_STATUS.PENDING

const resolvePinId = (pin) => pin?.pinIdNew ?? pin?.id

const hasPinId = (pin) => {
  const pinId = resolvePinId(pin)
  return pinId !== undefined && pinId !== null && pinId !== ''
}

const canTogglePinStatus = (pin) => hasPinId(pin)

const getStatusDisplay = (record) => {
  if (isDraftRecord(record)) {
    return {
      text: t('airspace.status.draft'),
      color: statusColors.DRAFT,
    }
  }
  const status = record?.reviewStatus
  return {
    text: statusText(status),
    color: statusColors[status] || 'default',
  }
}

const canReviewRecord = (record) => record?.reviewStatus === MARKER_REVIEW_STATUS.PENDING
const isMarkerRejected = (record) => record?.reviewStatus === MARKER_REVIEW_STATUS.REJECTED
const isPinRejected = (pin) => pin?.reviewStatus === PIN_REVIEW_STATUS.REJECTED
const canReviewLowAltitudeCircle = (record) => record?.status === LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.PENDING
const canUpdateLowAltitudeCircleListing = (record) =>
  record?.status === LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.APPROVED
const isLowAltitudeCircleListingUpdating = (record) =>
  Boolean(record?.id && circleListingUpdatingIds.value.has(record.id))
const canSubmitMarkerReview = (record, status) =>
  status === MARKER_REVIEW_STATUS.REJECTED && isMarkerRejected(record)
    ? !!record?.id
    : canReviewRecord(record)
const canSubmitPinReview = (pin, status) =>
  status === PIN_REVIEW_STATUS.REJECTED && isPinRejected(pin)
    ? hasPinId(pin)
    : canReviewPin(pin)

const pinPrimaryApproveStatus = (pin) => {
  const historicalStatus = resolvePinHistoricalApprovedStatus(pin)
  return historicalStatus || PIN_REVIEW_STATUS.APPROVED_A
}

const pinSecondaryApproveStatus = (pin) => {
  const historicalStatus = resolvePinHistoricalApprovedStatus(pin)
  if (historicalStatus === PIN_REVIEW_STATUS.APPROVED_A) return PIN_REVIEW_STATUS.APPROVED_B
  if (historicalStatus === PIN_REVIEW_STATUS.APPROVED_B) return PIN_REVIEW_STATUS.APPROVED_A
  return PIN_REVIEW_STATUS.APPROVED_B
}

const pinPrimaryApproveLabel = (pin) => {
  const historicalStatus = resolvePinHistoricalApprovedStatus(pin)
  if (historicalStatus === PIN_REVIEW_STATUS.APPROVED_A) return t('airspace.pinAudit.actions.markA')
  if (historicalStatus === PIN_REVIEW_STATUS.APPROVED_B) return t('airspace.pinAudit.actions.markB')
  return t('airspace.pinAudit.actions.passA')
}

const pinSecondaryApproveLabel = (pin) => {
  const historicalStatus = resolvePinHistoricalApprovedStatus(pin)
  if (historicalStatus === PIN_REVIEW_STATUS.APPROVED_A) return t('airspace.pinAudit.actions.downgradeToB')
  if (historicalStatus === PIN_REVIEW_STATUS.APPROVED_B) return t('airspace.pinAudit.actions.upgradeToA')
  return t('airspace.pinAudit.actions.passB')
}

const formatOrderStatus = (status) => {
  switch (status) {
    case 'WAITING_PAYMENT':
      return t('orders.status.waitingPayment')
    case 'PAID':
      return t('orders.status.paid')
    case 'REFUNDED':
      return t('orders.status.refunded')
    default:
      return t('orders.status.unknown')
  }
}

const formatOrderPaymentType = (type) => {
  switch (type) {
    case 'CASH':
      return t('orders.paymentType.cash')
    case 'FLP':
      return t('orders.paymentType.flp')
    case 'WECHAT':
      return t('orders.paymentType.wechat')
    default:
      return t('orders.paymentType.unknown')
  }
}

const formatOrderAmount = (value) => {
  if (value === null || value === undefined) return '-'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '-'
  return numeric.toFixed(2)
}

const formatOrderDate = (value) => {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch (error) {
    return value
  }
}

const formatOrderItemLabel = (key) => {
  if (!key) return '-'
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
}

const formatOrderItemValue = (value) => {
  if (value === null || value === undefined) return '-'
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch (error) {
      return '-'
    }
  }
  return value
}

const normalizedOrderItems = computed(() => {
  if (!orderDetail.value || !Array.isArray(orderDetail.value.items)) return []
  return orderDetail.value.items.map((item, index) => {
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      return {
        key: index,
        entries: Object.entries(item).map(([entryKey, entryValue], entryIndex) => ({
          key: `${entryKey}-${entryIndex}`,
          label: entryKey,
          value: entryValue,
        })),
      }
    }
    return {
      key: index,
      entries: [
        {
          key: `value-${index}`,
          label: 'value',
          value: item,
        },
      ],
    }
  })
})

const columns = computed(() => [
  { title: t('airspace.table.columns.name'), dataIndex: 'name', key: 'name' },
  { title: t('airspace.table.columns.type'), dataIndex: 'type', key: 'type', width: 120 },
  { title: t('airspace.table.columns.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: t('airspace.table.columns.authExpireAt'), dataIndex: 'expireAtSeconds', key: 'authExpireAt', width: 180 },
  { title: t('airspace.table.columns.status'), dataIndex: 'reviewStatus', key: 'status', width: 140 },
  { title: t('airspace.table.columns.exposure'), dataIndex: 'exposureCount', key: 'exposureCount', width: 120 },
  { title: t('airspace.table.columns.phoneCall'), dataIndex: 'phoneCallCount', key: 'phoneCallCount', width: 140 },
  { title: t('airspace.table.columns.paid'), dataIndex: 'paid', key: 'paid', width: 140 },
  { title: t('airspace.table.columns.actions'), key: 'actions', width: 140 },
])

const circleColumns = computed(() => [
  { title: t('airspace.circle.columns.name'), dataIndex: 'name', key: 'name', width: 220 },
  { title: t('airspace.circle.columns.summary'), dataIndex: 'summary', key: 'summary', width: 520 },
  { title: t('airspace.circle.columns.category'), dataIndex: 'category', key: 'category', width: 150 },
  { title: t('airspace.circle.columns.entryMode'), dataIndex: 'entryMode', key: 'entryMode', width: 120 },
  { title: t('airspace.circle.columns.likeCount'), dataIndex: 'likeCount', key: 'likeCount', width: 90 },
  { title: t('airspace.circle.columns.status'), dataIndex: 'status', key: 'status', width: 120 },
  { title: t('airspace.circle.columns.listingStatus'), dataIndex: 'listed', key: 'listed', width: 110 },
  { title: t('airspace.circle.columns.actions'), key: 'actions', width: 330 },
])

const circleReceiptColumns = computed(() => [
  { title: t('airspace.circle.receipts.columns.circle'), dataIndex: 'circleName', key: 'circleName', width: 180 },
  { title: t('airspace.circle.receipts.columns.payer'), dataIndex: 'payerNickname', key: 'payer', width: 170 },
  { title: t('airspace.circle.receipts.columns.originalAmount'), dataIndex: 'originalAmount', key: 'originalAmount', width: 110 },
  { title: t('airspace.circle.receipts.columns.paidAmount'), dataIndex: 'paidAmount', key: 'paidAmount', width: 110 },
  { title: t('airspace.circle.receipts.columns.discount'), dataIndex: 'memberDiscountApplied', key: 'discount', width: 110 },
  { title: t('airspace.circle.receipts.columns.paidAt'), dataIndex: 'paidAt', key: 'paidAt', width: 180 },
])

const pinAuditPaginationConfig = computed(() => ({
  current: pinAuditPagination.current,
  pageSize: pinAuditPagination.pageSize,
  total: pinAuditPagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (total, range) =>
    t('airspace.pagination.showTotal', {
      total,
      start: range?.[0] ?? 0,
      end: range?.[1] ?? 0,
    }),
}))

const circlePaginationConfig = computed(() => ({
  current: circlePagination.current,
  pageSize: circlePagination.pageSize,
  total: circlePagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100', '500', '1000'],
  showTotal: (total, range) =>
    t('airspace.pagination.showTotal', {
      total,
      start: range?.[0] ?? 0,
      end: range?.[1] ?? 0,
    }),
}))

const circleRowSelection = computed(() => ({
  selectedRowKeys: Array.from(circleSelectedIds.value),
  preserveSelectedRowKeys: true,
  onChange: (keys) => { circleSelectedIds.value = new Set(keys.map(String)) },
}))

const circleSelectedCount = computed(() => circleSelectedIds.value.size)

const circleReceiptPaginationConfig = computed(() => ({
  current: circleReceiptPagination.current,
  pageSize: circleReceiptPagination.pageSize,
  total: circleReceiptPagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total, range) =>
    t('airspace.pagination.showTotal', {
      total,
      start: range?.[0] ?? 0,
      end: range?.[1] ?? 0,
    }),
}))

const paginationConfig = computed(() => ({
  current: pagination.current,
  pageSize: pagination.pageSize,
  total: pagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (total, range) =>
    t('airspace.pagination.showTotal', {
      total,
      start: range?.[0] ?? 0,
      end: range?.[1] ?? 0,
    }),
}))

const syncDetailRecord = () => {
  if (!detailVisible.value || !detailRecord.value) return
  const latest = tableData.value.find((item) => item.id === detailRecord.value.id)
  if (latest) {
    detailRecord.value = { ...detailRecord.value, ...latest }
  }
}

const canRepairOrder = (order) => order?.status === 'WAITING_PAYMENT' && order?.paymentType === 'WECHAT' && !!order?.id

const fetchAllMarkersByStatus = async (status) => {
  const pageSize = 100
  const allContent = []
  let requestPage = 1
  let totalElements = 0

  while (true) {
    const params = {
      page: requestPage,
      size: pageSize,
      sortOrder: sortOrder.value,
      sortBy: markerSortBy.value,
    }
    if (status && status !== MARKER_REVIEW_STATUS.ALL) {
      params.status = status
    }

    const response = await fetchMarkers(params)
    const content = Array.isArray(response?.content) ? response.content : []
    totalElements = Number(response?.totalElements) || totalElements
    allContent.push(...content)

    const totalPages = Number(response?.totalPages)
    const reachedLastPage =
      Number.isFinite(totalPages) && totalPages > 0
        ? requestPage >= totalPages
        : !content.length || allContent.length >= totalElements

    if (reachedLastPage) {
      break
    }
    requestPage += 1
  }

  return allContent
}

const applyMarkerTabFilter = (content, status) => {
  if (!Array.isArray(content)) return []
  if (status === MARKER_TAB_STATUS.PENDING) {
    return content.filter((item) => String(item?.reviewStatus || '').toUpperCase() === MARKER_REVIEW_STATUS.PENDING)
  }
  if (status === MARKER_TAB_STATUS.ORDINARY) {
    return content.filter((item) => isOrdinaryMarkerRecord(item))
  }
  if (status === MARKER_TAB_STATUS.APPROVED) {
    return content.filter((item) => isPaidApprovedMarkerRecord(item))
  }
  return content
}

const loadData = async () => {
  loading.value = true
  try {
    if ([MARKER_TAB_STATUS.PENDING, MARKER_TAB_STATUS.ORDINARY, MARKER_TAB_STATUS.APPROVED].includes(activeStatus.value)) {
      const sourceStatus = activeStatus.value === MARKER_TAB_STATUS.PENDING
        ? MARKER_REVIEW_STATUS.ALL
        : MARKER_REVIEW_STATUS.APPROVED
      const sourceContent = await fetchAllMarkersByStatus(sourceStatus)
      const filteredContent = applyMarkerTabFilter(sourceContent, activeStatus.value)
      const safePageSize = Math.max(1, Number(pagination.pageSize) || 10)
      const total = filteredContent.length
      const totalPages = Math.max(1, Math.ceil(total / safePageSize))
      const safeCurrent = Math.min(Math.max(1, Number(pagination.current) || 1), totalPages)
      const startIndex = (safeCurrent - 1) * safePageSize
      const endIndex = startIndex + safePageSize

      tableData.value = filteredContent.slice(startIndex, endIndex)
      pagination.total = total
      pagination.current = safeCurrent
      pagination.pageSize = safePageSize
      syncDetailRecord()
      return
    }

    const params = {
      page: pagination.current,
      size: pagination.pageSize,
      sortOrder: sortOrder.value,
      sortBy: markerSortBy.value,
    }

    if (activeStatus.value === MARKER_REVIEW_STATUS.DRAFT) {
      params.draft = true
    } else {
      if (activeStatus.value !== MARKER_REVIEW_STATUS.ALL) {
        params.status = activeStatus.value
      }
      if (activeStatus.value === MARKER_REVIEW_STATUS.PENDING) {
        params.draft = false
      }
    }

    const { content, totalElements, page, size } = await fetchMarkers(params)
    tableData.value = content
    pagination.total = totalElements
    pagination.current = page
    pagination.pageSize = size
    syncDetailRecord()
  } catch (error) {
    console.error('Failed to load markers', error)
    message.error(t('airspace.messages.loadFailed'))
  } finally {
    loading.value = false
  }
}

const loadPinAuditData = async () => {
  pinAuditLoading.value = true
  try {
    const reviewStatusFilter =
      pinAuditVisibility.value === PIN_VISIBILITY.PUBLIC ? pinAuditReviewStatus.value : undefined
    const { content, totalElements, page, size } = await fetchPins({
      page: pinAuditPagination.current,
      size: pinAuditPagination.pageSize,
      visibility: pinAuditVisibility.value,
      reviewStatus: reviewStatusFilter,
    })
    const filteredContent =
      reviewStatusFilter && Array.isArray(content)
        ? content.filter(
            (item) => String(item?.reviewStatus || '').toUpperCase() === String(reviewStatusFilter).toUpperCase(),
          )
        : content
    pinAuditData.value = filteredContent
    const effectiveTotal =
      reviewStatusFilter && pinAuditVisibility.value === PIN_VISIBILITY.PUBLIC
        ? Number.isFinite(totalElements) && totalElements >= filteredContent.length
          ? totalElements
          : filteredContent.length
        : totalElements
    pinAuditPagination.total = effectiveTotal
    pinAuditPagination.current = page
    pinAuditPagination.pageSize = size
  } catch (error) {
    console.error('Failed to load pins', error)
    message.error(t('airspace.pinAudit.messages.loadFailed'))
  } finally {
    pinAuditLoading.value = false
  }
}

const loadLowAltitudeCircleData = async () => {
  circleAuditLoading.value = true
  try {
    const { content, totalElements, page, size } = await fetchAdminLowAltitudeCircles({
      page: circlePagination.current,
      size: circlePagination.pageSize,
      status: activeCircleStatus.value,
    })
    circleAuditData.value = content
    circlePagination.total = totalElements
    circlePagination.current = page
    circlePagination.pageSize = size
    if (circleDetailVisible.value && circleDetailRecord.value?.id) {
      const latest = content.find((item) => item.id === circleDetailRecord.value.id)
      if (latest) {
        circleDetailRecord.value = { ...circleDetailRecord.value, ...latest }
      }
    }
  } catch (error) {
    console.error('Failed to load low altitude circles', error)
    message.error(t('airspace.circle.messages.loadFailed'))
  } finally {
    circleAuditLoading.value = false
  }
}

const loadPinRewardConfig = async () => {
  if (pinRewardLoading.value) return
  pinRewardLoading.value = true
  try {
    const videoUploadConfig = await fetchPinVideoUploadFlpLimitConfig()
    pinRewardConfig.value = {
      videoUploadFlpLimit: Number(videoUploadConfig?.threshold) || 0,
      videoUploadUpdatedAt: videoUploadConfig?.updatedAt || null,
      updatedAt: videoUploadConfig?.updatedAt || null,
    }
    pinRewardForm.videoUploadFlpLimit = Number(videoUploadConfig?.threshold) || 0
  } catch (error) {
    console.error('Failed to load pin reward config', error)
    message.error(t('airspace.pinAudit.reward.loadFailed'))
  } finally {
    pinRewardLoading.value = false
  }
}

const submitPinRewardConfig = async () => {
  pinRewardSaving.value = true
  try {
    const videoUploadPayload = {
      threshold: Number(pinRewardForm.videoUploadFlpLimit) || 0,
    }
    const savedVideoUpload = await savePinVideoUploadFlpLimitConfig(videoUploadPayload)
    pinRewardConfig.value = {
      videoUploadFlpLimit: Number(savedVideoUpload?.threshold ?? videoUploadPayload.threshold) || 0,
      videoUploadUpdatedAt: savedVideoUpload?.updatedAt || pinRewardConfig.value?.videoUploadUpdatedAt || null,
      updatedAt: savedVideoUpload?.updatedAt || pinRewardConfig.value?.updatedAt || null,
    }
    message.success(t('airspace.pinAudit.reward.saved'))
  } catch (error) {
    console.error('Failed to save pin reward config', error)
    message.error(t('airspace.pinAudit.reward.saveFailed'))
  } finally {
    pinRewardSaving.value = false
  }
}

const handleTabChange = (key) => {
  const nextStatus = normalizeStatus(key)
  if (activeStatus.value !== nextStatus) {
    activeStatus.value = nextStatus
    pagination.current = 1
    loadData()
  }
  updateRouteStatus(nextStatus)
}

const handleMainTabChange = (key) => {
  activeMainTab.value = key
  if (key === 'markers') {
    loadData()
  } else if (key === 'pinAudit') {
    loadPinAuditData()
    loadPinRewardConfig()
  } else if (key === 'lowAltitudeCircles') {
    loadLowAltitudeCircleData()
  }
}

const handlePinVisibilityChange = (nextVisibility) => {
  pinAuditVisibility.value = nextVisibility
  pinAuditPagination.current = 1
  loadPinAuditData()
}

const handlePinReviewFilterChange = (nextStatus) => {
  pinAuditReviewStatus.value = nextStatus
  pinAuditPagination.current = 1
  loadPinAuditData()
}

const handleTableChange = (pager) => {
  pagination.current = pager?.current ?? 1
  pagination.pageSize = pager?.pageSize ?? pagination.pageSize
  loadData()
}

const handlePinAuditTableChange = (pager) => {
  pinAuditPagination.current = pager?.current ?? 1
  pinAuditPagination.pageSize = pager?.pageSize ?? pinAuditPagination.pageSize
  loadPinAuditData()
}

const handleLowAltitudeCircleStatusChange = (nextStatus) => {
  activeCircleStatus.value = nextStatus || LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.ALL
  circlePagination.current = 1
  loadLowAltitudeCircleData()
}

const handleLowAltitudeCircleTableChange = (pager) => {
  circlePagination.current = pager?.current ?? 1
  circlePagination.pageSize = pager?.pageSize ?? circlePagination.pageSize
  loadLowAltitudeCircleData()
}

const syncPinDetailRecord = (pin) => {
  if (!pin || !pinDetailRecord.value) return
  if (resolvePinId(pinDetailRecord.value) === resolvePinId(pin)) {
    pinDetailRecord.value = { ...pinDetailRecord.value, ...pin }
  }
}

const toggleMarkerSort = (nextSortBy) => {
  if (markerSortBy.value === nextSortBy) {
    sortOrder.value = sortOrder.value === 'ASC' ? 'DESC' : 'ASC'
  } else {
    markerSortBy.value = nextSortBy
    sortOrder.value = 'DESC'
  }
  pagination.current = 1
  loadData()
}

const openDetail = (record) => {
  detailRecord.value = { ...record }
  detailVisible.value = true
}

const closeDetail = () => {
  detailVisible.value = false
  detailRecord.value = null
  closePinVideoPlayer()
}

const openCircleDetail = (record) => {
  circleDetailRecord.value = { ...record }
  circleDetailVisible.value = true
}

const openCircleEdit = (record) => {
  circleEditId.value = record?.id || ''
  Object.assign(circleEditForm, {
    category: record?.category || 'REGIONAL_PILOTS',
    coverImage: record?.coverImage || '',
    showcaseImagesText: Array.isArray(record?.showcaseImages) ? record.showcaseImages.join('\n') : '',
    name: record?.name || '',
    summary: record?.summary || '',
    description: record?.description || record?.entryRequirement || '',
    entryRequirement: record?.entryRequirement || record?.description || '',
    joinMethod: record?.joinMethod || 'GROUP_QR',
    entryMode: record?.entryMode || 'FREE',
    entryPrice: Number(record?.originalPrice || 0),
    groupQrImage: record?.groupQrImage || '',
    groupLiveCodeUrl: record?.groupLiveCodeUrl || '',
    ownerQrImage: record?.ownerQrImage || '',
    memberCount: Number(record?.memberCount || 0),
  })
  circleEditVisible.value = true
}

const submitCircleEdit = async () => {
  if (!circleEditId.value || !circleEditForm.name.trim() || !circleEditForm.summary.trim()
    || !circleEditForm.description.trim() || !circleEditForm.coverImage.trim()) {
    message.warning('请完整填写社群名称、简介、详情和封面')
    return
  }
  if (circleEditForm.joinMethod === 'GROUP_LIVE_CODE'
    && !/^https:\/\//i.test(circleEditForm.groupLiveCodeUrl.trim())) {
    message.warning('请填写企业微信群活码 HTTPS 链接')
    return
  }
  circleEditSaving.value = true
  try {
    const updated = await updateAdminLowAltitudeCircle(circleEditId.value, {
      category: circleEditForm.category,
      coverImage: circleEditForm.coverImage.trim(),
      showcaseImages: circleEditForm.showcaseImagesText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
      name: circleEditForm.name.trim(),
      summary: circleEditForm.summary.trim(),
      description: circleEditForm.description.trim(),
      entryRequirement: circleEditForm.entryRequirement.trim() || circleEditForm.description.trim(),
      joinMethod: circleEditForm.joinMethod,
      entryMode: circleEditForm.entryMode,
      entryPrice: circleEditForm.entryMode === 'PAID' ? Number(circleEditForm.entryPrice) : 0,
      groupQrImage: circleEditForm.groupQrImage.trim(),
      groupLiveCodeUrl: circleEditForm.groupLiveCodeUrl.trim(),
      ownerQrImage: circleEditForm.ownerQrImage.trim(),
      memberCount: Math.max(0, Number(circleEditForm.memberCount) || 0),
    })
    circleAuditData.value = circleAuditData.value.map((item) => item.id === updated.id ? { ...item, ...updated } : item)
    if (circleDetailRecord.value?.id === updated.id) circleDetailRecord.value = { ...circleDetailRecord.value, ...updated }
    circleEditVisible.value = false
    message.success('社群信息已保存')
  } catch (error) {
    console.error('Failed to update low altitude circle', error)
    message.error('社群信息保存失败，请检查入群资料')
  } finally {
    circleEditSaving.value = false
  }
}

const selectAllLowAltitudeCircles = async () => {
  if (circlePagination.total > 1000) {
    message.warning('单次最多选择 1000 条，请先按审核状态筛选后再操作')
    return
  }
  circleSelectingAll.value = true
  try {
    const result = await fetchAdminLowAltitudeCircles({
      page: 1,
      size: Math.max(1, Math.min(1000, circlePagination.total || 1000)),
      status: activeCircleStatus.value,
    })
    circleSelectedIds.value = new Set(result.content.map((item) => String(item.id)).filter(Boolean))
  } catch (error) {
    message.error('全选社群失败')
  } finally {
    circleSelectingAll.value = false
  }
}

const clearLowAltitudeCircleSelection = () => {
  circleSelectedIds.value = new Set()
}

const watchCircleBatchJob = async (job) => {
  circleBatchAbortController?.abort()
  circleBatchAbortController = new AbortController()
  circleBatchJob.value = job
  circleBatchVisible.value = true
  try {
    await subscribeLowAltitudeCircleBatchJob(job.jobId, async (progress) => {
      circleBatchJob.value = progress
      if (progress.status === 'COMPLETED' && progress.type === 'IMPORT') {
        await loadLowAltitudeCircleData()
      }
    }, circleBatchAbortController.signal)
  } catch (error) {
    if (error?.name !== 'AbortError') console.error('Low altitude circle batch stream failed', error)
  }
}

const exportLowAltitudeCircles = async (all) => {
  if (!all && !circleSelectedCount.value) {
    message.warning('请先选择需要导出的社群')
    return
  }
  try {
    const job = await startLowAltitudeCircleExport({
      all,
      ids: all ? [] : Array.from(circleSelectedIds.value),
      status: activeCircleStatus.value,
    })
    watchCircleBatchJob(job)
  } catch (error) {
    message.error('导出任务启动失败')
  }
}

const importLowAltitudeCircles = async ({ file, onSuccess, onError }) => {
  try {
    const job = await startLowAltitudeCircleImport(file)
    onSuccess?.(job)
    watchCircleBatchJob(job)
  } catch (error) {
    onError?.(error)
    message.error('导入任务启动失败，请上传由本页面导出的 XLSX 文件')
  }
}

const downloadCircleBatchFile = async () => {
  const job = circleBatchJob.value
  if (!job?.jobId || job.status !== 'COMPLETED' || job.type !== 'EXPORT') return
  try {
    await downloadLowAltitudeCircleExport(job.jobId, job.fileName)
  } catch (error) {
    message.error('导出文件下载失败')
  }
}

onBeforeUnmount(() => circleBatchAbortController?.abort())

const closeCircleDetail = () => {
  circleDetailVisible.value = false
  circleDetailRecord.value = null
}

const loadCircleReceipts = async () => {
  const circleId = circleReceiptRecord.value?.id
  if (!circleId) return
  circleReceiptLoading.value = true
  try {
    const result = await fetchAdminLowAltitudeCircleReceipts(circleId, {
      scope: circleReceiptScope.value,
      page: circleReceiptPagination.current,
      size: circleReceiptPagination.pageSize,
    })
    circleReceiptData.value = result.content
    circleReceiptPagination.current = result.page
    circleReceiptPagination.pageSize = result.size
    circleReceiptPagination.total = result.totalElements
  } catch (error) {
    console.error('Failed to load low altitude circle receipts', error)
    message.error(t('airspace.circle.receipts.loadFailed'))
  } finally {
    circleReceiptLoading.value = false
  }
}

const openCircleReceipts = (record) => {
  circleReceiptRecord.value = { ...record }
  circleReceiptScope.value = 'CIRCLE'
  circleReceiptPagination.current = 1
  circleReceiptData.value = []
  circleReceiptVisible.value = true
  loadCircleReceipts()
}

const closeCircleReceipts = () => {
  circleReceiptVisible.value = false
  circleReceiptRecord.value = null
  circleReceiptData.value = []
}

const handleCircleReceiptScopeChange = (scope) => {
  circleReceiptScope.value = scope
  circleReceiptPagination.current = 1
  loadCircleReceipts()
}

const handleCircleReceiptTableChange = (nextPagination) => {
  circleReceiptPagination.current = nextPagination.current || 1
  circleReceiptPagination.pageSize = nextPagination.pageSize || circleReceiptPagination.pageSize
  loadCircleReceipts()
}

const openPinDetail = (record) => {
  pinDetailRecord.value = { ...record }
  pinDetailVisible.value = true
}

const closePinDetail = () => {
  pinDetailVisible.value = false
  pinDetailRecord.value = null
  closePinVideoPlayer()
}

const openPinVideoPlayer = async (record) => {
  const videoLink = record?.videoLink
  if (!videoLink) {
    message.warning(t('airspace.pinAudit.messages.videoUnavailable'))
    return
  }

  pinVideoPlayerVisible.value = true
  pinVideoPlayerLoading.value = true
  pinVideoPlayerUrl.value = ''
  pinVideoPlayerName.value = record?.name || ''

  try {
    const playbackUrl = await resolvePinVideoPlaybackUrl(videoLink)
    if (!playbackUrl) {
      throw new Error('Empty playback url')
    }
    pinVideoPlayerUrl.value = playbackUrl
  } catch (error) {
    console.error('Failed to open pin video player', error)
    message.error(t('airspace.pinAudit.messages.videoPlaybackFailed'))
    pinVideoPlayerVisible.value = false
    pinVideoPlayerName.value = ''
  } finally {
    pinVideoPlayerLoading.value = false
  }
}

const closePinVideoPlayer = () => {
  pinVideoPlayerVisible.value = false
  pinVideoPlayerLoading.value = false
  pinVideoPlayerUrl.value = ''
  pinVideoPlayerName.value = ''
}

const openDetailVideoPlayer = async (record) => {
  await openPinVideoPlayer(record)
}

const openOrderDetail = async (referenceId) => {
  const resolvedReference = referenceId || detailRecord.value?.id
  if (!resolvedReference) {
    message.warning(t('airspace.orderModal.messages.missingReference'))
    return
  }

  orderDetailVisible.value = true
  orderDetailLoading.value = true
  orderDetail.value = null

  try {
    const order = await fetchOrderByReference(resolvedReference)
    if (order) {
      orderDetail.value = order
    } else {
      message.warning(t('airspace.orderModal.messages.notFound'))
    }
  } catch (error) {
    console.error('Failed to load order detail', error)
    if (error?.response?.status === 404) {
      message.warning(t('airspace.orderModal.messages.notFound'))
    } else {
      message.error(t('airspace.orderModal.messages.loadFailed'))
      orderDetailVisible.value = false
    }
  } finally {
    orderDetailLoading.value = false
  }
}

const handleOpenOrderDetail = () => {
  openOrderDetail(detailRecord.value?.id)
}

const handleRepairOrderDetail = async () => {
  if (!canRepairOrder(orderDetail.value)) return

  orderRepairing.value = true
  try {
    const status = await repairWechatPaymentOrder(orderDetail.value.id)
    const refreshedOrder = await fetchOrderByReference(orderDetail.value.referenceId)
    if (refreshedOrder) {
      orderDetail.value = refreshedOrder
      if (detailRecord.value && refreshedOrder.status === 'PAID') {
        detailRecord.value = {
          ...detailRecord.value,
          paid: true,
        }
      }
    }

    if (status?.paid || refreshedOrder?.status === 'PAID') {
      message.success(t('orders.messages.repairPaid'))
    } else {
      message.info(t('orders.messages.repairNoChange'))
    }
  } catch (error) {
    console.error('Failed to repair wechat payment order', error)
    message.error(t('orders.messages.repairFailed'))
  } finally {
    orderRepairing.value = false
  }
}

const closeOrderDetail = () => {
  orderDetailVisible.value = false
  orderDetail.value = null
}

const openRejectReasonModal = ({ title, okText, placeholder, requiredMessage, initialValue = '', onSubmit }) => {
  let rejectDetail = typeof initialValue === 'string' ? initialValue : ''

  Modal.confirm({
    title,
    content: h(Input.TextArea, {
      rows: 4,
      autofocus: true,
      placeholder,
      defaultValue: rejectDetail,
      'onUpdate:value': (value) => {
        rejectDetail = value ?? ''
      },
    }),
    okText,
    cancelText: t('airspace.confirm.cancel'),
    okButtonProps: {
      danger: true,
    },
    onOk: async () => {
      const normalizedReason = rejectDetail.trim()
      if (!normalizedReason) {
        message.warning(requiredMessage)
        return Promise.reject(new Error('rejectDetail is required'))
      }
      await onSubmit(normalizedReason)
    },
  })
}

const executeReview = async (record, status, rejectDetail) => {
  if (!record?.id) return
  if (!canSubmitMarkerReview(record, status)) {
    return
  }
  try {
    const updated = await reviewMarker(record.id, status, rejectDetail)
    message.success(t('airspace.messages.reviewSuccess'))
    await loadData()
    if (updated && detailRecord.value?.id === record.id) {
      detailRecord.value = { ...detailRecord.value, ...updated }
    }
  } catch (error) {
    console.error('Failed to review marker', error)
    message.error(t('airspace.messages.reviewFailed'))
  }
}

const handleReview = (record, status) => {
  const statusKey = status === MARKER_REVIEW_STATUS.APPROVED ? 'approve' : 'reject'
  if (status === MARKER_REVIEW_STATUS.REJECTED) {
    openRejectReasonModal({
      title: t('airspace.confirm.rejectReason.title'),
      okText: t('airspace.confirm.reject.ok'),
      placeholder: t('airspace.confirm.rejectReason.placeholder', { name: record.name || '' }),
      requiredMessage: t('airspace.messages.rejectReasonRequired'),
      initialValue: record?.rejectDetail || '',
      onSubmit: (rejectDetail) => executeReview(record, status, rejectDetail),
    })
    return
  }
  Modal.confirm({
    title: t(`airspace.confirm.${statusKey}.title`),
    content: t(`airspace.confirm.${statusKey}.content`, { name: record.name || '' }),
    okText: t(`airspace.confirm.${statusKey}.ok`),
    cancelText: t('airspace.confirm.cancel'),
    okButtonProps: {
      type: status === MARKER_REVIEW_STATUS.APPROVED ? 'primary' : 'primary',
      danger: status === MARKER_REVIEW_STATUS.REJECTED,
    },
    onOk: () => executeReview(record, status),
  })
}

const executeLowAltitudeCircleReview = async (record, status, rejectReason) => {
  if (!record?.id || !canReviewLowAltitudeCircle(record)) return
  try {
    const updated = await reviewLowAltitudeCircle(record.id, status, rejectReason)
    message.success(t('airspace.circle.messages.reviewSuccess'))
    await loadLowAltitudeCircleData()
    if (updated && circleDetailRecord.value?.id === record.id) {
      circleDetailRecord.value = { ...circleDetailRecord.value, ...updated }
    }
  } catch (error) {
    console.error('Failed to review low altitude circle', error)
    message.error(t('airspace.circle.messages.reviewFailed'))
  }
}

const handleLowAltitudeCircleReview = (record, status) => {
  const statusKey = status === LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.APPROVED ? 'approve' : 'reject'
  if (status === LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.REJECTED) {
    openRejectReasonModal({
      title: t('airspace.circle.confirm.rejectReason.title'),
      okText: t('airspace.circle.confirm.reject.ok'),
      placeholder: t('airspace.circle.confirm.rejectReason.placeholder', { name: record.name || '' }),
      requiredMessage: t('airspace.circle.messages.rejectReasonRequired'),
      initialValue: record?.rejectReason || '',
      onSubmit: (rejectReason) => executeLowAltitudeCircleReview(record, status, rejectReason),
    })
    return
  }
  Modal.confirm({
    title: t(`airspace.circle.confirm.${statusKey}.title`),
    content: t(`airspace.circle.confirm.${statusKey}.content`, { name: record.name || '' }),
    okText: t(`airspace.circle.confirm.${statusKey}.ok`),
    cancelText: t('airspace.confirm.cancel'),
    okButtonProps: {
      type: 'primary',
      danger: status === LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.REJECTED,
    },
    onOk: () => executeLowAltitudeCircleReview(record, status),
  })
}

const executeLowAltitudeCircleListingUpdate = async (record, listed) => {
  if (!record?.id || !canUpdateLowAltitudeCircleListing(record) || isLowAltitudeCircleListingUpdating(record)) return
  circleListingUpdatingIds.value = new Set([...circleListingUpdatingIds.value, record.id])
  try {
    const updated = await updateLowAltitudeCircleListing(record.id, listed)
    circleAuditData.value = circleAuditData.value.map((item) => item.id === record.id ? { ...item, ...updated } : item)
    if (circleDetailRecord.value?.id === record.id) {
      circleDetailRecord.value = { ...circleDetailRecord.value, ...updated }
    }
    message.success(t(listed ? 'airspace.circle.messages.relistSuccess' : 'airspace.circle.messages.unlistSuccess'))
  } catch (error) {
    console.error('Failed to update low altitude circle listing', error)
    message.error(t('airspace.circle.messages.listingFailed'))
  } finally {
    const next = new Set(circleListingUpdatingIds.value)
    next.delete(record.id)
    circleListingUpdatingIds.value = next
  }
}

const handleLowAltitudeCircleListing = (record) => {
  if (!canUpdateLowAltitudeCircleListing(record)) return
  const nextListed = record.listed === false
  const action = nextListed ? 'relist' : 'unlist'
  Modal.confirm({
    title: t(`airspace.circle.confirm.${action}.title`),
    content: t(`airspace.circle.confirm.${action}.content`, { name: record.name || '' }),
    okText: t(`airspace.circle.confirm.${action}.ok`),
    cancelText: t('airspace.confirm.cancel'),
    okButtonProps: { danger: !nextListed },
    onOk: () => executeLowAltitudeCircleListingUpdate(record, nextListed),
  })
}

const submitPinReview = async (pin, status, rejectDetail) => {
  if (!canSubmitPinReview(pin, status)) {
    message.info(t('airspace.pinAudit.messages.onlyPublicReview'))
    return
  }
  try {
    const pinId = resolvePinId(pin)
    if (pinId === undefined || pinId === null || pinId === '') {
      message.error(t('airspace.pinAudit.messages.reviewFailed'))
      return
    }
    const updated = await reviewPin(pinId, status, rejectDetail)
    message.success(t('airspace.pinAudit.messages.reviewSuccess'))
    await loadPinAuditData()
    syncPinDetailRecord(updated)
  } catch (error) {
    console.error('Failed to review pin', error)
    message.error(t('airspace.pinAudit.messages.reviewFailed'))
  }
}

const confirmPinReview = (pin, status) => {
  const statusKey = status === PIN_REVIEW_STATUS.REJECTED ? 'reject' : 'approve'
  if (status === PIN_REVIEW_STATUS.REJECTED) {
    openRejectReasonModal({
      title: t('airspace.pinAudit.confirm.rejectReason.title'),
      okText: t('airspace.pinAudit.actions.reject'),
      placeholder: t('airspace.pinAudit.confirm.rejectReason.placeholder', { name: pin.name || '' }),
      requiredMessage: t('airspace.pinAudit.messages.rejectReasonRequired'),
      initialValue: pin?.rejectDetail || '',
      onSubmit: (rejectDetail) => submitPinReview(pin, status, rejectDetail),
    })
    return
  }
  Modal.confirm({
    title: t(`airspace.pinAudit.confirm.${statusKey}.title`),
    content: t(`airspace.pinAudit.confirm.${statusKey}.content`, {
      name: pin.name || '',
      status: pinReviewStatusText(status),
    }),
    okText: t(`airspace.pinAudit.actions.${statusKey === 'approve' ? 'approve' : 'reject'}`),
    cancelText: t('airspace.confirm.cancel'),
    okButtonProps: {
      type: statusKey === 'approve' ? 'primary' : 'primary',
      danger: statusKey === 'reject',
    },
    onOk: () => submitPinReview(pin, status),
  })
}

const confirmPinStatusChange = (pin) => {
  if (!canTogglePinStatus(pin)) return
  const nextStatus = pin.status === PIN_STATUS.BANNED ? PIN_STATUS.ALIVE : PIN_STATUS.BANNED
  Modal.confirm({
    title: t('airspace.pinAudit.confirm.statusTitle'),
    content: t('airspace.pinAudit.confirm.statusContent', {
      name: pin.name || '',
      status: pinStatusText(nextStatus),
    }),
    okText: t('airspace.pinAudit.actions.toggleStatus'),
    cancelText: t('airspace.confirm.cancel'),
    okButtonProps: {
      danger: nextStatus === PIN_STATUS.BANNED,
    },
    onOk: async () => {
      try {
        const pinId = resolvePinId(pin)
        if (pinId === undefined || pinId === null || pinId === '') return
        const updated = await updatePinStatus(pinId, nextStatus)
        message.success(t('airspace.pinAudit.messages.statusUpdated'))
        syncPinDetailRecord(updated)
        await loadPinAuditData()
      } catch (error) {
        console.error('Failed to update pin status', error)
        message.error(t('airspace.pinAudit.messages.statusUpdateFailed'))
      }
    },
  })
}

onMounted(() => {
  const initialStatus = normalizeStatus(route.query.status)
  activeStatus.value = initialStatus
  updateRouteStatus(initialStatus)
  loadData()
  if (activeMainTab.value === 'pinAudit') {
    loadPinRewardConfig()
  }
})

watch(
  () => route.query.status,
  (status) => {
    const normalized = normalizeStatus(status)
    if (normalized === activeStatus.value) return
    activeStatus.value = normalized
    pagination.current = 1
    loadData()
  },
)
</script>

<template>
  <div class="airspace-wrapper">
    <a-card :bordered="false" class="content-card">
      <header class="card-header">
        <div>
          <h2 class="card-title">{{ t('airspace.title') }}</h2>
          <p class="card-subtitle">{{ t('airspace.subtitle') }}</p>
        </div>
        <div class="card-actions"></div>
      </header>
      <a-tabs :active-key="activeMainTab" @change="handleMainTabChange" class="main-tabs">
        <a-tab-pane v-for="tab in mainTabs" :key="tab.key" :tab="tab.label" />
      </a-tabs>

      <template v-if="activeMainTab === 'markers'">
        <a-tabs :active-key="activeStatus" @change="handleTabChange" class="status-tabs">
          <a-tab-pane v-for="tab in statusTabs" :key="tab.key" :tab="tab.label" />
        </a-tabs>
        <a-table :columns="columns" :data-source="tableData" :loading="loading" :pagination="paginationConfig"
          row-key="id" class="markers-table" @change="handleTableChange">
          <template #headerCell="{ column }">
            <template v-if="column.key === 'createdAt' || column.key === 'authExpireAt'">
              <button class="sort-toggle" type="button"
                @click.stop="toggleMarkerSort(column.key === 'authExpireAt' ? MARKER_SORT_BY.CERTIFICATION_EXPIRE_AT : MARKER_SORT_BY.CREATED_AT)">
                <span>{{ column.key === 'authExpireAt' ? t('airspace.table.columns.authExpireAt') : t('airspace.table.columns.createdAt') }}</span>
                <span class="sort-indicator" aria-hidden="true">
                  {{ markerSortBy === (column.key === 'authExpireAt' ? MARKER_SORT_BY.CERTIFICATION_EXPIRE_AT : MARKER_SORT_BY.CREATED_AT) ? sortIndicator : '' }}
                </span>
                <span class="sr-only">{{ sortLabel }}</span>
              </button>
            </template>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <div class="name-cell">
                <div class="primary-line">
                  <span class="marker-name">{{ record.name || t('airspace.table.placeholders.unnamed') }}</span>
                  <span v-if="record.featureCode" class="feature-code">{{ record.featureCode }}</span>
                </div>
                <div class="secondary-line">
                  <span>{{ record?.location?.text || t('airspace.table.placeholders.unknownLocation') }}</span>
                </div>
              </div>
            </template>
            <template v-else-if="column.key === 'type'">
              <a-tag :color="markerTypeColors[markerTypeKey(record)] || 'default'">{{ markerTypeText(record) }}</a-tag>
            </template>
            <template v-else-if="column.key === 'createdAt'">
              {{ formatDateTime(record.createdAt) }}
            </template>
            <template v-else-if="column.key === 'authExpireAt'">
              {{ formatUnixSecondsDateTime(record.expireAtSeconds) }}
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="getStatusDisplay(record).color">
                {{ getStatusDisplay(record).text }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'exposureCount'">
              {{ record.exposureCount ?? 0 }}
            </template>
            <template v-else-if="column.key === 'phoneCallCount'">
              {{ record.phoneCallCount ?? 0 }}
            </template>
            <template v-else-if="column.key === 'paid'">
              <a-tag :color="record.paid ? 'green' : 'orange'">
                {{ record.paid ? t('airspace.paidStatus.paid') : t('airspace.paidStatus.unpaid') }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <div class="table-actions">
                <a-button size="small" type="text" class="detail-button" :title="t('airspace.table.actions.viewDetail')"
                  :aria-label="t('airspace.table.actions.viewDetail')" @click="openDetail(record)">
                  <img :src="detailIcon" :alt="t('airspace.table.actions.viewDetail')" class="detail-icon" />
                </a-button>
              </div>
            </template>
          </template>
        </a-table>
      </template>
      <template v-else-if="activeMainTab === 'lowAltitudeCircles'">
        <div class="circle-audit-panel">
          <div class="circle-audit-toolbar">
            <div>
              <div class="circle-audit-subtitle">{{ t('airspace.circle.subtitle') }}</div>
              <span class="circle-selection-summary">已选择 {{ circleSelectedCount }} 条，跨页选择会保留</span>
            </div>
            <div class="circle-batch-actions">
              <a-button :loading="circleSelectingAll" @click="selectAllLowAltitudeCircles">全选当前筛选</a-button>
              <a-button :disabled="!circleSelectedCount" @click="clearLowAltitudeCircleSelection">清空选择</a-button>
              <a-button :disabled="!circleSelectedCount" @click="exportLowAltitudeCircles(false)">导出已选</a-button>
              <a-button @click="exportLowAltitudeCircles(true)">导出当前筛选</a-button>
              <a-upload accept=".xls,.xlsx" :show-upload-list="false" :custom-request="importLowAltitudeCircles">
                <a-button type="primary">导入新增 / 修改</a-button>
              </a-upload>
            </div>
          </div>
          <a-tabs :active-key="activeCircleStatus" @change="handleLowAltitudeCircleStatusChange" class="status-tabs">
            <a-tab-pane v-for="tab in circleStatusTabs" :key="tab.key" :tab="tab.label" />
          </a-tabs>
          <a-table
            :columns="circleColumns"
            :data-source="circleAuditData"
            :loading="circleAuditLoading"
            :pagination="circlePaginationConfig"
            :row-selection="circleRowSelection"
            row-key="id"
            class="markers-table circle-audit-table"
            :scroll="{ x: 1490 }"
            @change="handleLowAltitudeCircleTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'name'">
                <div class="name-cell">
                  <div class="primary-line">
                    <span class="marker-name">{{ record.name || t('airspace.table.placeholders.unnamed') }}</span>
                  </div>
                  <div class="secondary-line">
                    <span>{{ record.ownerFeatureCode || t('airspace.table.placeholders.notProvided') }}</span>
                  </div>
                </div>
              </template>
              <template v-else-if="column.key === 'summary'">
                <div class="circle-summary-cell">
                  {{ circleOverviewText(record) }}
                </div>
              </template>
              <template v-else-if="column.key === 'category'">
                {{ circleCategoryText(record.category) }}
              </template>
              <template v-else-if="column.key === 'entryMode'">
                <a-tag :color="isPaidCircle(record) ? 'gold' : 'default'">
                  {{ circleEntryModeText(record.entryMode) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'likeCount'">
                {{ record.likeCount ?? 0 }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getCircleStatusDisplay(record).color">
                  {{ getCircleStatusDisplay(record).text }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'listed'">
                <a-tag v-if="record.status === LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.APPROVED" :color="record.listed === false ? 'default' : 'green'">
                  {{ t(record.listed === false ? 'airspace.circle.listingStatus.unlisted' : 'airspace.circle.listingStatus.listed') }}
                </a-tag>
                <span v-else>-</span>
              </template>
              <template v-else-if="column.key === 'actions'">
                <div class="circle-action-group">
                  <a-button type="link" size="small" @click="openCircleEdit(record)">编辑</a-button>
                  <a-button type="link" size="small" @click="openCircleDetail(record)">
                    {{ t('airspace.circle.actions.detail') }}
                  </a-button>
                  <a-button
                    v-if="isPaidCircle(record)"
                    type="link"
                    size="small"
                    @click="openCircleReceipts(record)"
                  >
                    {{ t('airspace.circle.actions.receipts') }}
                  </a-button>
                  <a-button
                    v-if="canUpdateLowAltitudeCircleListing(record)"
                    type="link"
                    size="small"
                    :danger="record.listed !== false"
                    :loading="isLowAltitudeCircleListingUpdating(record)"
                    @click="handleLowAltitudeCircleListing(record)"
                  >
                    {{ t(record.listed === false ? 'airspace.circle.actions.relist' : 'airspace.circle.actions.unlist') }}
                  </a-button>
                  <a-button
                    v-if="canReviewLowAltitudeCircle(record)"
                    type="link"
                    size="small"
                    @click="handleLowAltitudeCircleReview(record, LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.APPROVED)"
                  >
                    {{ t('airspace.circle.actions.approve') }}
                  </a-button>
                  <a-button
                    v-if="canReviewLowAltitudeCircle(record)"
                    type="link"
                    size="small"
                    danger
                    @click="handleLowAltitudeCircleReview(record, LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.REJECTED)"
                  >
                    {{ t('airspace.circle.actions.reject') }}
                  </a-button>
                </div>
              </template>
            </template>
          </a-table>
        </div>
      </template>
      <template v-else-if="activeMainTab === 'pinAudit'">
        <div class="pin-reward-form" role="form" aria-live="polite">
          <div class="reward-form-title">{{ t('airspace.pinAudit.reward.title') }}</div>
          <div class="reward-inputs">
            <a-form layout="vertical">
              <a-row :gutter="[16, 0]">
                <a-col :xs="24" :sm="12" :md="8">
                  <a-form-item :label="t('airspace.pinAudit.reward.videoUploadFlpLimit')">
                    <a-input-number v-model:value="pinRewardForm.videoUploadFlpLimit" :min="0" :step="0.01" :precision="2"
                      :placeholder="t('airspace.pinAudit.reward.placeholder')" class="reward-input" />
                  </a-form-item>
                </a-col>
              </a-row>
            </a-form>
            <div class="reward-actions">
              <a-button type="primary" :loading="pinRewardSaving" @click="submitPinRewardConfig">
                {{ pinRewardSaving ? t('airspace.pinAudit.reward.saving') : t('airspace.pinAudit.reward.save') }}
              </a-button>
              <a-button @click="loadPinRewardConfig" :loading="pinRewardLoading">
                {{ t('airspace.pinAudit.reward.reload') }}
              </a-button>
              <span v-if="pinRewardConfig?.updatedAt" class="reward-updated">
                {{ t('airspace.pinAudit.reward.updatedAt', { time: formatDateTime(pinRewardConfig.updatedAt) }) }}
              </span>
            </div>
          </div>
        </div>

        <div class="pin-audit-panel">
          <div class="pin-audit-toolbar">
            <a-segmented :options="pinVisibilityOptions" :value="pinAuditVisibility"
              @change="handlePinVisibilityChange" />
            <a-tabs v-if="pinAuditVisibility === PIN_VISIBILITY.PUBLIC" :active-key="pinAuditReviewStatus"
              class="pin-review-tabs" @change="handlePinReviewFilterChange">
              <a-tab-pane v-for="status in pinReviewStatusTabs" :key="status.key" :tab="status.label" />
            </a-tabs>
          </div>

          <a-table :data-source="pinAuditData" :loading="pinAuditLoading" :pagination="pinAuditPaginationConfig"
            :row-key="(record) => resolvePinId(record)" @change="handlePinAuditTableChange" class="pin-audit-table">
            <a-table-column :title="t('airspace.pinAudit.columns.name')" key="name" dataIndex="name">
              <template #default="{ record }">
                <div class="pin-name">{{ record.name || t('airspace.table.placeholders.unnamed') }}</div>
                <div class="pin-meta">{{ formatDateTime(record.createdAt) }}</div>
              </template>
            </a-table-column>
            <a-table-column :title="t('airspace.pinAudit.columns.type')" key="shapeType">
              <template #default="{ record }">
                <a-tag :color="pinShapeColors[pinShapeKey(record)] || 'default'">
                  {{ pinShapeDisplay(record) }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column :title="t('airspace.pinAudit.columns.visibility')" key="visibility" dataIndex="visibility">
              <template #default="{ record }">
                <a-tag :color="pinReviewColors[record.reviewStatus] || 'default'">
                  {{ pinVisibilityText(record.visibility) }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column :title="t('airspace.pinAudit.columns.reviewStatus')" key="reviewStatus"
              dataIndex="reviewStatus">
              <template #default="{ record }">
                <a-tag :color="pinReviewColors[record.reviewStatus] || 'default'">
                  {{ pinReviewStatusText(record.reviewStatus) }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column :title="t('airspace.pinAudit.columns.status')" key="status" dataIndex="status">
              <template #default="{ record }">
                <a-tag :color="pinStatusColors[record.status] || 'default'">
                  {{ pinStatusText(record.status) }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column :title="t('airspace.pinAudit.columns.actions')" key="actions">
              <template #default="{ record }">
                <div class="table-actions">
                  <a-button size="small" type="text" class="detail-button"
                    :title="t('airspace.pinAudit.actions.detail')" :aria-label="t('airspace.pinAudit.actions.detail')"
                    @click="openPinDetail(record)">
                    <img :src="detailIcon" :alt="t('airspace.pinAudit.actions.detail')" class="detail-icon" />
                  </a-button>
                </div>
              </template>
            </a-table-column>
          </a-table>
        </div>
      </template>
      <template v-else>
        <TemporaryNoFlyZoneManager />
      </template>
    </a-card>

    <a-modal :open="pinDetailVisible" :title="pinDetailRecord?.name || t('airspace.pinAudit.detail.title')"
      width="880px" :destroy-on-close="true" @cancel="closePinDetail">
      <template #footer>
        <div class="modal-footer">
          <a-button @click="closePinDetail">{{ t('airspace.pinAudit.detail.close') }}</a-button>
          <template v-if="pinDetailRecord?.reviewStatus === PIN_REVIEW_STATUS.PENDING">
            <a-button type="primary" ghost :danger="pinDetailRecord?.status === PIN_STATUS.ALIVE"
              @click="confirmPinStatusChange(pinDetailRecord)">
              {{ pinDetailRecord?.status === PIN_STATUS.BANNED
                ? t('airspace.pinAudit.actions.enable')
                : t('airspace.pinAudit.actions.disable') }}
            </a-button>
            <a-button type="primary" ghost :disabled="!canReviewPin(pinDetailRecord)"
              @click="confirmPinReview(pinDetailRecord, pinPrimaryApproveStatus(pinDetailRecord))">
              {{ pinPrimaryApproveLabel(pinDetailRecord) }}
            </a-button>
            <a-button type="primary" ghost :disabled="!canReviewPin(pinDetailRecord)"
              @click="confirmPinReview(pinDetailRecord, pinSecondaryApproveStatus(pinDetailRecord))">
              {{ pinSecondaryApproveLabel(pinDetailRecord) }}
            </a-button>
            <a-button type="primary" danger :disabled="!canReviewPin(pinDetailRecord)"
              @click="confirmPinReview(pinDetailRecord, PIN_REVIEW_STATUS.REJECTED)">
              {{ t('airspace.pinAudit.actions.reject') }}
            </a-button>
          </template>
          <a-button v-else-if="isPinRejected(pinDetailRecord)" type="primary" danger ghost
            @click="confirmPinReview(pinDetailRecord, PIN_REVIEW_STATUS.REJECTED)">
            {{ t('airspace.pinAudit.actions.supplementReason') }}
          </a-button>
        </div>
      </template>

      <div v-if="pinDetailRecord" class="detail-body">
        <section class="detail-section">
          <h3>{{ t('airspace.pinAudit.detail.basic') }}</h3>
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item :label="t('airspace.pinAudit.detail.pinId')">
              {{ pinDetailRecord?.pinIdNew ?? pinDetailRecord?.id ?? '-' }}
            </a-descriptions-item>
            <a-descriptions-item v-if="pinDetailRecord?.pinIdNew && pinDetailRecord?.id"
              :label="t('airspace.pinAudit.detail.legacyId')">
              {{ pinDetailRecord.id }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.pinAudit.detail.creator')">
              {{ pinDetailRecord?.creatorName || '-' }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.pinAudit.detail.featureCode')">
              {{ pinDetailRecord?.featureCode || '-' }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.pinAudit.detail.visibility')">
              {{ pinVisibilityText(pinDetailRecord.visibility) }}
            </a-descriptions-item>
            <a-descriptions-item v-if="pinDetailRecord?.groups?.length" :span="2"
              :label="t('airspace.pinAudit.detail.groups')">
              <div class="pin-group-tags">
                <a-tag v-for="group in pinDetailRecord.groups" :key="group.id || group.name || group">
                  {{ group.name || group.id || group }}
                </a-tag>
              </div>
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.pinAudit.detail.reviewStatus')">
              <a-tag :color="pinReviewColors[pinDetailRecord.reviewStatus] || 'default'">
                {{ pinReviewStatusText(pinDetailRecord.reviewStatus) }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item v-if="resolvePinHistoricalApprovedStatus(pinDetailRecord)"
              :label="t('airspace.pinAudit.detail.lastApprovedStatus')">
              <a-tag :color="pinReviewColors[resolvePinHistoricalApprovedStatus(pinDetailRecord)] || 'default'">
                {{ pinReviewStatusText(resolvePinHistoricalApprovedStatus(pinDetailRecord)) }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.pinAudit.detail.status')">
              <a-tag :color="pinStatusColors[pinDetailRecord.status] || 'default'">
                {{ pinStatusText(pinDetailRecord.status) }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item v-if="pinDetailRecord?.reviewStatus === PIN_REVIEW_STATUS.REJECTED" :span="2"
              :label="t('airspace.pinAudit.detail.rejectReason')">
              {{ pinDetailRecord?.rejectDetail || t('airspace.pinAudit.detail.rejectReasonEmpty') }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.pinAudit.detail.exposure')">
              {{ pinDetailRecord?.exposureCount ?? 0 }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.pinAudit.detail.shapeType')">
              <div class="type-with-action">
                <a-tag :color="pinShapeColors[pinShapeKey(pinDetailRecord)] || 'default'">
                  {{ pinShapeText(pinDetailRecord) }}
                </a-tag>
                <a-button size="small" type="link" :icon="h(EnvironmentOutlined)"
                  @click="openMapPreview(pinDetailRecord, 'pin')">
                  {{ t('airspace.actions.mapPreview') }}
                </a-button>
              </div>
            </a-descriptions-item>
            <a-descriptions-item v-if="pinShapeCategoryText(pinDetailRecord)"
              :label="t('airspace.pinAudit.detail.shapeCategory')">
              {{ pinShapeCategoryText(pinDetailRecord) }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.pinAudit.detail.shapePoints')">
              {{ getPinCoordinateCount(pinDetailRecord) }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.pinAudit.detail.createdAt')">
              {{ formatDateTime(pinDetailRecord.createdAt) }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.pinAudit.detail.updatedAt')">
              {{ formatDateTime(pinDetailRecord.updatedAt) }}
            </a-descriptions-item>
            <a-descriptions-item v-if="pinDetailRecord?.publishedAt"
              :label="t('airspace.pinAudit.detail.publishedAt')">
              {{ formatDateTime(pinDetailRecord.publishedAt) }}
            </a-descriptions-item>
            <a-descriptions-item v-if="pinDetailRecord?.shape?.radius"
              :label="t('airspace.pinAudit.detail.shapeRadius')">
              {{ pinDetailRecord.shape.radius }} km
            </a-descriptions-item>
            <a-descriptions-item v-if="pinDetailRecord?.shape?.width"
              :label="t('airspace.pinAudit.detail.shapeWidth')">
              {{ pinDetailRecord.shape.width }}
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section v-if="pinDetailRecord.description" class="detail-section">
          <h3>{{ t('airspace.pinAudit.detail.description') }}</h3>
          <p class="description-text">{{ pinDetailRecord.description }}</p>
        </section>

        <section v-if="pinDetailRecord.videoLink" class="detail-section">
          <h3>{{ t('airspace.pinAudit.detail.videoLink') }}</h3>
          <div class="video-action-row">
            <a-button type="primary" :loading="pinVideoPlayerLoading" @click="openPinVideoPlayer(pinDetailRecord)">
              {{ t('airspace.pinAudit.detail.playVideo') }}
            </a-button>
          </div>
        </section>

        <section v-if="pinDetailRecord.images?.length" class="detail-section">
          <h3>{{ t('airspace.pinAudit.detail.images') }}</h3>
          <div class="image-grid">
            <a-image-preview-group>
              <a-image v-for="url in pinDetailRecord.images" :key="url" :src="url" width="140"
                :preview="{ src: url }" />
            </a-image-preview-group>
          </div>
        </section>
      </div>
      <a-empty v-else />
    </a-modal>

    <a-modal :open="pinVideoPlayerVisible"
      :title="pinVideoPlayerName || t('airspace.pinAudit.detail.videoPlayerTitle')" width="880px"
      :footer="null" :destroy-on-close="true" @cancel="closePinVideoPlayer">
      <a-spin :spinning="pinVideoPlayerLoading">
        <div class="video-player-panel">
          <video v-if="pinVideoPlayerUrl" class="video-player" :src="pinVideoPlayerUrl" controls autoplay playsinline />
          <a-empty v-else />
        </div>
      </a-spin>
    </a-modal>

    <a-modal :open="detailVisible" :title="detailRecord?.name || t('airspace.modal.title')" width="960px"
      :destroy-on-close="true" @cancel="closeDetail">
      <template #footer>
        <div class="modal-footer">
          <a-button @click="closeDetail">{{ t('airspace.modal.actions.close') }}</a-button>
          <template v-if="detailRecord?.reviewStatus === MARKER_REVIEW_STATUS.PENDING">
            <a-button type="primary" ghost
              @click="handleReview(detailRecord, MARKER_REVIEW_STATUS.REJECTED)">
              {{ t('airspace.modal.actions.reject') }}
            </a-button>
            <a-button type="primary"
              @click="handleReview(detailRecord, MARKER_REVIEW_STATUS.APPROVED)">
              {{ t('airspace.modal.actions.approve') }}
            </a-button>
          </template>
          <a-button v-else-if="isMarkerRejected(detailRecord)" type="primary" danger ghost
            @click="handleReview(detailRecord, MARKER_REVIEW_STATUS.REJECTED)">
            {{ t('airspace.modal.actions.supplementReason') }}
          </a-button>
        </div>
      </template>

      <div v-if="detailRecord" class="detail-body">
        <section class="detail-section">
          <h3>{{ t('airspace.modal.sections.basic') }}</h3>
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item :label="t('airspace.modal.fields.name')">{{ detailRecord.name }}</a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.featureCode')">
              {{ detailRecord.featureCode || t('airspace.table.placeholders.notProvided') }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.type')">
              <div class="type-with-action">
                <a-tag :color="markerTypeColors[markerTypeKey(detailRecord)] || 'default'">
                  {{ markerTypeText(detailRecord) }}
                </a-tag>
                <a-button size="small" type="link" :icon="h(EnvironmentOutlined)" @click="openMapPreview(detailRecord, 'marker')">
                  {{ t('airspace.actions.mapPreview') }}
                </a-button>
              </div>
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.location')" :span="2">
              {{ detailRecord?.location?.text || t('airspace.table.placeholders.unknownLocation') }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.phone')">
              {{ detailRecord.phone || t('airspace.table.placeholders.notProvided') }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.status')">
              <div class="status-action-row">
                <a-tag :color="getStatusDisplay(detailRecord).color">
                  {{ getStatusDisplay(detailRecord).text }}
                </a-tag>

              </div>
            </a-descriptions-item>
            <a-descriptions-item v-if="detailRecord?.reviewStatus === MARKER_REVIEW_STATUS.REJECTED" :span="2"
              :label="t('airspace.modal.fields.rejectReason')">
              {{ detailRecord?.rejectDetail || t('airspace.modal.fields.rejectReasonEmpty') }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.paid')">
              <a-tag :color="detailRecord.paid ? 'green' : 'orange'">
                {{ detailRecord.paid ? t('airspace.paidStatus.paid') : t('airspace.paidStatus.unpaid') }}
              </a-tag>
              <a-button v-if="detailRecord?.id" type="link" size="small" class="order-detail-link"
                @click="handleOpenOrderDetail">
                {{ t('airspace.modal.actions.viewOrder') }}
              </a-button>
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.createdAt')">
              {{ formatDateTime(detailRecord.createdAt) }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.authExpireAt')">
              {{ formatUnixSecondsDateTime(detailRecord.expireAtSeconds) }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.updatedAt')">
              {{ formatDateTime(detailRecord.updatedAt) }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.exposure')">
              {{ detailRecord.exposureCount ?? 0 }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.phoneCall')">
              {{ detailRecord.phoneCallCount ?? 0 }}
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section" v-if="detailRecord.description">
          <h3>{{ t('airspace.modal.sections.description') }}</h3>
          <p class="description-text">{{ detailRecord.description }}</p>
        </section>

        <section class="detail-section" v-if="detailRecord.images?.length">
          <h3>{{ t('airspace.modal.sections.images') }}</h3>
          <a-image-preview-group>
            <div class="image-grid">
              <a-image v-for="url in detailRecord.images" :key="url" :src="url" width="120" height="120"
                :preview="{ src: url }" />
            </div>
          </a-image-preview-group>
        </section>

        <section class="detail-section" v-if="detailRecord.businessLicense">
          <h3>{{ t('airspace.modal.sections.businessLicense') }}</h3>
          <a-image :src="detailRecord.businessLicense" width="240" :preview="{ src: detailRecord.businessLicense }" />
        </section>

        <section class="detail-section" v-if="detailRecord.attachments?.length">
          <h3>{{ t('airspace.modal.sections.attachments') }}</h3>
          <ul class="link-list">
            <li v-for="file in detailRecord.attachments" :key="file.objectName || file.url || file.name">
              <a-typography-link :href="file.url" target="_blank" rel="noopener noreferrer"
                :download="file.name || undefined">
                {{ file.name || file.url }}
              </a-typography-link>
            </li>
          </ul>
        </section>

        <section class="detail-section" v-if="detailRecord.qrCodeUrls?.length">
          <h3>{{ t('airspace.modal.sections.qrCodes') }}</h3>
          <div class="image-grid">
            <a-image v-for="url in detailRecord.qrCodeUrls" :key="url" :src="url" width="120" height="120"
              :preview="{ src: url }" />
          </div>
        </section>

        <section class="detail-section" v-if="detailRecord.videoChannelId || detailRecord.videoId || detailRecord.videoLink">
          <h3>{{ t('airspace.modal.sections.videoInfo') }}</h3>
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item :label="t('airspace.modal.fields.videoChannelId')">
              {{ detailRecord.videoChannelId || t('airspace.table.placeholders.notProvided') }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.videoId')">
              {{ detailRecord.videoId || t('airspace.table.placeholders.notProvided') }}
            </a-descriptions-item>
            <a-descriptions-item v-if="detailRecord.videoLink" :span="2"
              :label="t('airspace.modal.fields.videoLink')">
              <div class="video-action-row">
                <a-button type="primary" :loading="pinVideoPlayerLoading" @click="openDetailVideoPlayer(detailRecord)">
                  {{ t('airspace.modal.actions.playVideo') }}
                </a-button>
              </div>
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section" v-if="detailRecord.industryHonorTags?.length">
          <h3>{{ t('airspace.modal.sections.honors') }}</h3>
          <div class="tag-grid">
            <a-tag v-for="tag in detailRecord.industryHonorTags" :key="tag">{{ tag }}</a-tag>
          </div>
        </section>

        <section class="detail-section" v-if="detailRecord.adminInfo">
          <h3>{{ t('airspace.modal.sections.adminInfo') }}</h3>
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item :label="t('airspace.modal.fields.adminName')">
              {{ detailRecord.adminInfo?.name || t('airspace.table.placeholders.notProvided') }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.adminTitle')">
              {{ detailRecord.adminInfo?.title || t('airspace.table.placeholders.notProvided') }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.adminPhone')">
              {{ detailRecord.adminInfo?.phone || t('airspace.table.placeholders.notProvided') }}
            </a-descriptions-item>
          </a-descriptions>
        </section>
      </div>
      <a-empty v-else />
    </a-modal>
    <a-modal
      v-model:open="circleEditVisible"
      title="编辑低空有圈"
      width="760px"
      :confirm-loading="circleEditSaving"
      ok-text="保存"
      cancel-text="取消"
      @ok="submitCircleEdit"
    >
      <a-form layout="vertical" class="circle-edit-form">
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="社群名称" required><a-input v-model:value="circleEditForm.name" :maxlength="20" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item label="社群类型" required><a-select v-model:value="circleEditForm.category" :options="[
            { label: '地区飞友群', value: 'REGIONAL_PILOTS' }, { label: '行业交流群', value: 'INDUSTRY_EXCHANGE' }, { label: '协会组织', value: 'ASSOCIATION_ORG' },
          ]" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="社群简介" required><a-input v-model:value="circleEditForm.summary" :maxlength="120" /></a-form-item>
        <a-form-item label="社群详情 / 入群要求" required><a-textarea v-model:value="circleEditForm.description" :rows="4" /></a-form-item>
        <a-row :gutter="16">
          <a-col :span="12"><a-form-item label="入群收费"><a-select v-model:value="circleEditForm.entryMode" :options="[
            { label: '免费群', value: 'FREE' }, { label: '付费群', value: 'PAID' },
          ]" /></a-form-item></a-col>
          <a-col :span="12"><a-form-item v-if="circleEditForm.entryMode === 'PAID'" label="普通用户价格（元）" required><a-input-number v-model:value="circleEditForm.entryPrice" :min="0.01" :precision="2" style="width:100%" /></a-form-item></a-col>
        </a-row>
        <a-form-item label="入群资料展示" required>
          <a-segmented v-model:value="circleEditForm.joinMethod" :options="[
            { label: '群二维码', value: 'GROUP_QR' }, { label: '群主二维码', value: 'OWNER_QR' }, { label: '群活码按钮', value: 'GROUP_LIVE_CODE' },
          ]" />
        </a-form-item>
        <a-form-item v-if="circleEditForm.joinMethod === 'GROUP_LIVE_CODE'" label="企业微信群活码链接" required>
          <a-input v-model:value="circleEditForm.groupLiveCodeUrl" placeholder="填写配置客户群进群方式接口返回的 qr_code URL" />
        </a-form-item>
        <a-form-item v-else-if="circleEditForm.joinMethod === 'GROUP_QR'" label="群二维码图片对象名" required><a-input v-model:value="circleEditForm.groupQrImage" /></a-form-item>
        <a-form-item v-else label="群主二维码图片对象名" required><a-input v-model:value="circleEditForm.ownerQrImage" /></a-form-item>
        <a-form-item label="封面图片对象名" required><a-input v-model:value="circleEditForm.coverImage" /></a-form-item>
        <a-form-item label="风采图片对象名（每行一张）"><a-textarea v-model:value="circleEditForm.showcaseImagesText" :rows="3" /></a-form-item>
        <a-form-item label="社群人数"><a-input-number v-model:value="circleEditForm.memberCount" :min="0" style="width:100%" /></a-form-item>
      </a-form>
    </a-modal>

    <a-modal
      v-model:open="circleBatchVisible"
      :title="circleBatchJob?.type === 'IMPORT' ? '低空有圈批量导入' : '低空有圈导出任务'"
      width="620px"
      :mask-closable="false"
    >
      <div v-if="circleBatchJob" class="circle-batch-progress">
        <a-progress
          :percent="Math.round(Number(circleBatchJob.progress) || 0)"
          :status="circleBatchJob.status === 'FAILED' ? 'exception' : circleBatchJob.status === 'COMPLETED' ? 'success' : 'active'"
        />
        <div class="circle-batch-stats">
          <span>{{ circleBatchJob.message }}</span>
          <span>处理 {{ circleBatchJob.processed || 0 }} / {{ circleBatchJob.total || 0 }}</span>
          <span>成功 {{ circleBatchJob.succeeded || 0 }}</span>
          <span v-if="circleBatchJob.failed">失败 {{ circleBatchJob.failed }}</span>
        </div>
        <a-alert
          v-if="circleBatchJob.errors?.length"
          type="warning"
          show-icon
          :message="circleBatchJob.errors.slice(0, 5).join('；')"
        />
      </div>
      <template #footer>
        <a-button
          v-if="circleBatchJob?.type === 'EXPORT' && circleBatchJob?.status === 'COMPLETED'"
          type="primary"
          @click="downloadCircleBatchFile"
        >下载 XLSX</a-button>
        <a-button @click="circleBatchVisible = false">关闭</a-button>
      </template>
    </a-modal>

    <a-modal
      :open="circleDetailVisible"
      :title="t('airspace.circle.modal.title')"
      width="760px"
      :destroy-on-close="true"
      @cancel="closeCircleDetail"
    >
      <template #footer>
        <a-button
          v-if="circleDetailRecord && canReviewLowAltitudeCircle(circleDetailRecord)"
          danger
          ghost
          @click="handleLowAltitudeCircleReview(circleDetailRecord, LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.REJECTED)"
        >
          {{ t('airspace.circle.actions.reject') }}
        </a-button>
        <a-button
          v-if="circleDetailRecord && canReviewLowAltitudeCircle(circleDetailRecord)"
          type="primary"
          @click="handleLowAltitudeCircleReview(circleDetailRecord, LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.APPROVED)"
        >
          {{ t('airspace.circle.actions.approve') }}
        </a-button>
        <a-button @click="closeCircleDetail">{{ t('airspace.modal.actions.close') }}</a-button>
      </template>

      <div v-if="circleDetailRecord" class="detail-body">
        <section class="detail-section">
          <h3>{{ t('airspace.circle.modal.sections.basic') }}</h3>
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item :label="t('airspace.circle.modal.fields.name')">
              {{ circleDetailRecord.name || '-' }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.circle.modal.fields.category')">
              {{ circleCategoryText(circleDetailRecord.category) }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.circle.modal.fields.status')">
              <a-tag :color="getCircleStatusDisplay(circleDetailRecord).color">
                {{ getCircleStatusDisplay(circleDetailRecord).text }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.circle.modal.fields.listingStatus')">
              {{ circleDetailRecord.status === LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.APPROVED
                ? t(circleDetailRecord.listed === false ? 'airspace.circle.listingStatus.unlisted' : 'airspace.circle.listingStatus.listed')
                : '-' }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.circle.modal.fields.sortOrder')">
              {{ circleDetailRecord.sortOrder ?? 0 }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.circle.modal.fields.likeCount')">
              {{ circleDetailRecord.likeCount ?? 0 }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.circle.modal.fields.ownerFeatureCode')">
              {{ circleDetailRecord.ownerFeatureCode || t('airspace.table.placeholders.notProvided') }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.circle.modal.fields.joinMethod')">
              {{ circleJoinMethodText(circleDetailRecord.joinMethod) }}
            </a-descriptions-item>
            <a-descriptions-item v-if="circleDetailRecord.groupLiveCodeUrl" label="群活码链接" :span="2">
              <a :href="circleDetailRecord.groupLiveCodeUrl" target="_blank" rel="noreferrer">{{ circleDetailRecord.groupLiveCodeUrl }}</a>
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.circle.modal.fields.entryMode')">
              {{ circleEntryModeText(circleDetailRecord.entryMode) }}
            </a-descriptions-item>
            <a-descriptions-item v-if="isPaidCircle(circleDetailRecord)" :label="t('airspace.circle.modal.fields.entryPrice')">
              {{ formatCircleAmount(circleDetailRecord.originalPrice) }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.circle.modal.fields.createdAt')">
              {{ formatDateTime(circleDetailRecord.createdAt) }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.circle.modal.fields.updatedAt')">
              {{ formatDateTime(circleDetailRecord.updatedAt) }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.circle.modal.fields.reviewedAt')">
              {{ formatDateTime(circleDetailRecord.reviewedAt) }}
            </a-descriptions-item>
            <a-descriptions-item
              v-if="circleDetailRecord.status === LOW_ALTITUDE_CIRCLE_REVIEW_STATUS.REJECTED"
              :label="t('airspace.circle.modal.fields.rejectReason')"
              :span="2"
            >
              {{ circleDetailRecord.rejectReason || t('airspace.circle.modal.fields.rejectReasonEmpty') }}
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <h3>{{ t('airspace.circle.modal.sections.description') }}</h3>
          <a-descriptions :column="1" bordered size="small">
            <a-descriptions-item :label="t('airspace.circle.modal.fields.summary')">
              {{ circleOverviewText(circleDetailRecord) }}
            </a-descriptions-item>
          </a-descriptions>
        </section>

        <section class="detail-section">
          <h3>{{ t('airspace.circle.modal.sections.join') }}</h3>
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item :label="t('airspace.circle.modal.fields.joinMethod')">
              {{ circleJoinMethodText(circleDetailRecord.joinMethod) }}
            </a-descriptions-item>
          </a-descriptions>
          <div class="circle-image-grid">
            <a-image
              v-if="circleDetailRecord.groupQrImage"
              :src="resolveCircleAssetUrl(circleDetailRecord.groupQrImage)"
              width="120"
              height="120"
            />
            <a-image
              v-if="circleDetailRecord.ownerQrImage"
              :src="resolveCircleAssetUrl(circleDetailRecord.ownerQrImage)"
              width="120"
              height="120"
            />
          </div>
        </section>

        <section class="detail-section" v-if="resolveCircleImageList(circleDetailRecord).length">
          <h3>{{ t('airspace.circle.modal.sections.images') }}</h3>
          <a-image-preview-group>
            <div class="circle-image-grid">
              <a-image
                v-for="url in resolveCircleImageList(circleDetailRecord)"
                :key="url"
                :src="resolveCircleAssetUrl(url)"
                width="120"
                height="120"
              />
            </div>
          </a-image-preview-group>
        </section>
      </div>
      <a-empty v-else />
    </a-modal>
    <a-modal
      :open="circleReceiptVisible"
      :title="t('airspace.circle.receipts.title')"
      width="900px"
      :destroy-on-close="true"
      @cancel="closeCircleReceipts"
    >
      <template #footer>
        <a-button @click="closeCircleReceipts">{{ t('airspace.modal.actions.close') }}</a-button>
      </template>
      <div class="circle-receipt-heading">
        <div>
          <strong>{{ circleReceiptRecord?.name || '-' }}</strong>
          <span>{{ circleReceiptRecord?.ownerNickname || circleReceiptRecord?.ownerFeatureCode || '-' }}</span>
        </div>
        <a-tabs :active-key="circleReceiptScope" @change="handleCircleReceiptScopeChange">
          <a-tab-pane key="CIRCLE" :tab="t('airspace.circle.receipts.tabs.circle')" />
          <a-tab-pane key="OWNER" :tab="t('airspace.circle.receipts.tabs.owner')" />
        </a-tabs>
      </div>
      <a-table
        :columns="circleReceiptColumns"
        :data-source="circleReceiptData"
        :loading="circleReceiptLoading"
        :pagination="circleReceiptPaginationConfig"
        :scroll="{ x: 860 }"
        row-key="id"
        size="small"
        @change="handleCircleReceiptTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'payer'">
            <div class="circle-receipt-payer">
              <a-avatar :src="resolveCircleAssetUrl(record.payerAvatarUrl)" :size="28" />
              <div>
                <div>{{ record.payerNickname || '-' }}</div>
                <small>{{ record.payerFeatureCode || '-' }}</small>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'originalAmount'">
            {{ formatCircleAmount(record.originalAmount) }}
          </template>
          <template v-else-if="column.key === 'paidAmount'">
            <strong>{{ formatCircleAmount(record.paidAmount) }}</strong>
          </template>
          <template v-else-if="column.key === 'discount'">
            <a-tag :color="record.memberDiscountApplied ? 'gold' : 'default'">
              {{ record.memberDiscountApplied ? t('airspace.circle.receipts.memberDiscount') : '-' }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'paidAt'">
            {{ formatDateTime(record.paidAt) }}
          </template>
        </template>
      </a-table>
    </a-modal>
    <a-modal :open="orderDetailVisible" :title="t('airspace.orderModal.title')" width="720px" :destroy-on-close="true"
      @cancel="closeOrderDetail">
      <template #footer>
        <a-button v-if="canRepairOrder(orderDetail)" :loading="orderRepairing" @click="handleRepairOrderDetail">
          {{ t('orders.actions.repair') }}
        </a-button>
        <a-button @click="closeOrderDetail">{{ t('airspace.orderModal.close') }}</a-button>
      </template>

      <a-spin :spinning="orderDetailLoading">
        <div v-if="orderDetail" class="order-detail-body">
          <section class="detail-section">
            <h3>{{ t('airspace.orderModal.sections.basic') }}</h3>
            <a-descriptions :column="2" bordered size="small">
              <a-descriptions-item :label="t('airspace.orderModal.fields.orderNumber')">
                {{ orderDetail.orderNumber || '-' }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('airspace.orderModal.fields.referenceId')">
                {{ orderDetail.referenceId || '-' }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('airspace.orderModal.fields.featureCode')">
                {{ orderDetail.featureCode || '-' }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('airspace.orderModal.fields.orderType')">
                {{ orderDetail.orderType || '-' }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('airspace.orderModal.fields.status')">
                <a-tag :color="ORDER_STATUS_COLORS[orderDetail.status] || 'default'">
                  {{ formatOrderStatus(orderDetail.status) }}
                </a-tag>
              </a-descriptions-item>
              <a-descriptions-item :label="t('airspace.orderModal.fields.paymentType')">
                {{ formatOrderPaymentType(orderDetail.paymentType) }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('airspace.orderModal.fields.amount')">
                {{ formatOrderAmount(orderDetail.amount) }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('airspace.orderModal.fields.wechatTransactionId')">
                {{ orderDetail.wechatTransactionId || '-' }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('airspace.orderModal.fields.createdAt')">
                {{ formatOrderDate(orderDetail.createdAt) }}
              </a-descriptions-item>
              <a-descriptions-item :label="t('airspace.orderModal.fields.updatedAt')">
                {{ formatOrderDate(orderDetail.updatedAt) }}
              </a-descriptions-item>
            </a-descriptions>
          </section>

          <section class="detail-section" v-if="normalizedOrderItems.length">
            <h3>{{ t('airspace.orderModal.sections.items') }}</h3>
            <div class="order-items">
              <a-descriptions v-for="item in normalizedOrderItems" :key="item.key" :column="1" bordered size="small"
                class="order-item">
                <a-descriptions-item v-for="entry in item.entries" :key="entry.key"
                  :label="formatOrderItemLabel(entry.label)">
                  {{ formatOrderItemValue(entry.value) }}
                </a-descriptions-item>
              </a-descriptions>
            </div>
          </section>
        </div>
        <a-empty v-else-if="!orderDetailLoading" :description="t('airspace.orderModal.empty')" />
      </a-spin>
    </a-modal>

    <a-modal :open="mapPreviewVisible" :title="t('airspace.actions.mapPreview')" width="50vw"
      :body-style="{ height: '60vh', padding: 0 }" :destroy-on-close="true" @cancel="closeMapPreview" :footer="null">
      <div ref="mapPreviewContainer" class="map-preview-container"></div>
    </a-modal>
  </div>
</template>

<style scoped>
.airspace-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.content-card {
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.12);
  padding: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 12px;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  color: #111827;
}

.card-subtitle {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 0.95rem;
}

.status-action-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.order-detail-link {
  padding: 0;
  height: auto;
}

.order-detail-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.order-items {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-item {
  width: 100%;
}


.pin-audit-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.circle-audit-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.circle-audit-subtitle {
  color: #64748b;
  font-size: 0.95rem;
}

.circle-audit-toolbar,
.circle-batch-actions,
.circle-batch-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.circle-audit-toolbar {
  justify-content: space-between;
}

.circle-selection-summary {
  display: block;
  margin-top: 3px;
  color: #94a3b8;
  font-size: 12px;
}

.circle-batch-progress {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.circle-batch-stats {
  color: #475569;
  font-size: 13px;
}

.pin-reward-form {
  margin-bottom: 8px;
}

.pin-audit-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.pin-review-tabs {
  flex: 1;
  min-width: 320px;
}

.pin-reward-form {
  padding: 14px 12px 6px;
  border: 1px dashed #cbd5e1;
  border-radius: 12px;
  background: #f8fafc;
}

.reward-form-title {
  font-weight: 700;
  color: #0f172a;
  margin-bottom: 8px;
}

.reward-inputs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reward-input {
  width: 100%;
  max-width: 420px;
  min-width: 260px;
}

.reward-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.reward-updated {
  color: #64748b;
  font-size: 0.9rem;
}

.pin-audit-table :deep(.ant-table-tbody > tr > td) {
  vertical-align: middle;
}

.pin-name {
  font-weight: 600;
  color: #111827;
}

.pin-group-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pin-meta {
  color: #6b7280;
  font-size: 0.85rem;
}

.main-tabs,
.status-tabs {
  margin-bottom: 16px;
}

.markers-table :deep(.ant-table-tbody > tr > td) {
  vertical-align: middle;
}

.sort-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  color: #111827;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.sort-toggle:hover {
  color: #1d4ed8;
}

.sort-toggle:focus-visible {
  outline: 2px solid rgba(37, 99, 235, 0.4);
  border-radius: 8px;
  outline-offset: 2px;
}

.sort-indicator {
  font-size: 0.9rem;
  line-height: 1;
  color: #6b7280;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.name-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.primary-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.marker-name {
  font-weight: 600;
  color: #111827;
}

.feature-code {
  font-size: 0.75rem;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
  padding: 2px 6px;
  border-radius: 12px;
}

.secondary-line {
  color: #6b7280;
  font-size: 0.85rem;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.circle-summary-cell {
  max-width: 520px;
  color: #475569;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  white-space: normal;
}

.circle-audit-table :deep(.ant-table) {
  table-layout: fixed;
}

.circle-audit-table :deep(.ant-table-cell) {
  vertical-align: middle;
}

.circle-audit-table :deep(.ant-table-cell:nth-child(2)) {
  max-width: 520px;
}

.circle-action-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: nowrap;
}

.detail-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  width: 32px;
  height: 32px;
}

.detail-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-height: 70vh;
  overflow-y: auto;
  padding-right: 4px;
}

.detail-section h3 {
  margin: 0 0 12px;
  font-size: 1.05rem;
  color: #111827;
}

.description-text {
  margin: 0;
  color: #1f2937;
  line-height: 1.6;
}

.video-action-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.video-player-panel {
  min-height: 180px;
}

.video-player {
  display: block;
  width: 100%;
  max-height: 70vh;
  background: #000;
  border-radius: 12px;
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}

.circle-image-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
}

.circle-receipt-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 16px;
}

.circle-receipt-heading > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.circle-receipt-heading strong {
  color: #111827;
  font-size: 16px;
}

.circle-receipt-heading span {
  color: #64748b;
  font-size: 13px;
}

.circle-receipt-heading :deep(.ant-tabs-nav) {
  margin-bottom: 0;
}

.circle-receipt-payer {
  display: flex;
  align-items: center;
  gap: 8px;
}

.circle-receipt-payer small {
  color: #94a3b8;
}

.link-list {
  margin: 0;
  padding-left: 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.type-with-action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.map-preview-container {
  width: 100%;
  height: 100%;
}

@media (max-width: 768px) {
  .content-card {
    padding: 16px;
  }

  .detail-body {
    max-height: 60vh;
  }

  .table-actions {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
