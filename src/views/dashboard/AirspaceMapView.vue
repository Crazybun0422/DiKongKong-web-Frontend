<script setup>
import { computed, h, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { EnvironmentOutlined } from '@ant-design/icons-vue'
import { fetchMarkers, reviewMarker, MARKER_REVIEW_STATUS } from '../../services/markers'
import {
  fetchPins,
  reviewPin,
  updatePinStatus,
  PIN_REVIEW_STATUS,
  PIN_VISIBILITY,
  PIN_STATUS,
} from '../../services/pins'
import { fetchOrderByReference } from '../../services/orders'
import detailIcon from '../../assets/img/detail.png'
import pointDefaultIcon from '../../assets/img/default.png'
import pointWarningIcon from '../../assets/img/drone-warning.png'
import pointAerialIcon from '../../assets/img/aerial.png'
import pointDockIcon from '../../assets/img/dock.png'
import pointElevationIcon from '../../assets/img/elevation.png'
import TemporaryNoFlyZoneManager from '../../components/noFlyZones/TemporaryNoFlyZoneManager.vue'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const loading = ref(false)
const tableData = ref([])
const activeMainTab = ref('markers')
const activeStatus = ref(MARKER_REVIEW_STATUS.ALL)
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const detailVisible = ref(false)
const detailRecord = ref(null)
const orderDetailVisible = ref(false)
const orderDetailLoading = ref(false)
const orderDetail = ref(null)
const sortOrder = ref('DESC')
const sortIndicator = computed(() => (sortOrder.value === 'ASC' ? '↑' : '↓'))
const sortLabel = computed(() =>
  sortOrder.value === 'ASC' ? t('airspace.sort.ascend') : t('airspace.sort.descend'),
)

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
const mapPreviewVisible = ref(false)
const mapPreviewTarget = ref(null)
const mapPreviewKind = ref('pin')
const mapPreviewContainer = ref(null)
const mapPreviewInstance = ref(null)
const mapPreviewOverlays = ref([])

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
  return Object.values(MARKER_REVIEW_STATUS).includes(formatted) ? formatted : MARKER_REVIEW_STATUS.ALL
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
  { key: MARKER_REVIEW_STATUS.ALL, label: t('airspace.tabs.all') },
  { key: MARKER_REVIEW_STATUS.PENDING, label: t('airspace.tabs.pending') },
  { key: MARKER_REVIEW_STATUS.APPROVED, label: t('airspace.tabs.approved') },
  { key: MARKER_REVIEW_STATUS.REJECTED, label: t('airspace.tabs.rejected') },
  { key: MARKER_REVIEW_STATUS.DRAFT, label: t('airspace.tabs.draft') },
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
  return 'unknown'
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

const getPinCoordinates = (pin) => {
  if (!pin?.shape?.coordinates) return []
  return pin.shape.coordinates
    .map((item) => {
      const lat = Number(item.latitude ?? item.lat)
      const lng = Number(item.longitude ?? item.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return new window.qq.maps.LatLng(lat, lng)
    })
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
  const shapeKey = pinShapeKey(target)
  const points = getPinCoordinates(target)
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

const isDraftRecord = (record) => {
  if (!record) return false
  if (typeof record.draft === 'boolean') {
    return record.draft
  }
  if (typeof record.paid === 'boolean') {
    return !record.paid
  }
  return false
}

const canReviewPin = (pin) =>
  pin?.visibility === PIN_VISIBILITY.PUBLIC && pin?.reviewStatus === PIN_REVIEW_STATUS.PENDING

const canTogglePinStatus = (pin) => Boolean(pin?.id)

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

const canReviewRecord = (record) => record?.paid && record?.reviewStatus === MARKER_REVIEW_STATUS.PENDING

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
  { title: t('airspace.table.columns.status'), dataIndex: 'reviewStatus', key: 'status', width: 140 },
  { title: t('airspace.table.columns.exposure'), dataIndex: 'exposureCount', key: 'exposureCount', width: 120 },
  { title: t('airspace.table.columns.phoneCall'), dataIndex: 'phoneCallCount', key: 'phoneCallCount', width: 140 },
  { title: t('airspace.table.columns.paid'), dataIndex: 'paid', key: 'paid', width: 140 },
  { title: t('airspace.table.columns.actions'), key: 'actions', width: 140 },
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

const loadData = async () => {
  loading.value = true
  try {
    const params = {
      page: pagination.current,
      size: pagination.pageSize,
      sortOrder: sortOrder.value,
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
    pinAuditData.value = content
  pinAuditPagination.total = totalElements
  pinAuditPagination.current = page
  pinAuditPagination.pageSize = size
  } catch (error) {
    console.error('Failed to load pins', error)
    message.error(t('airspace.pinAudit.messages.loadFailed'))
  } finally {
    pinAuditLoading.value = false
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

const syncPinDetailRecord = (pin) => {
  if (pin && pinDetailRecord.value?.id === pin.id) {
    pinDetailRecord.value = { ...pinDetailRecord.value, ...pin }
  }
}

const toggleCreatedAtSort = () => {
  sortOrder.value = sortOrder.value === 'ASC' ? 'DESC' : 'ASC'
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
}

const openPinDetail = (record) => {
  pinDetailRecord.value = { ...record }
  pinDetailVisible.value = true
}

const closePinDetail = () => {
  pinDetailVisible.value = false
  pinDetailRecord.value = null
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

const closeOrderDetail = () => {
  orderDetailVisible.value = false
  orderDetail.value = null
}

const executeReview = async (record, status) => {
  if (!record?.id) return
  if (!canReviewRecord(record)) {
    message.warning(t('airspace.messages.unpaidWarning'))
    return
  }
  try {
    const updated = await reviewMarker(record.id, status)
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

const submitPinReview = async (pin, status) => {
  if (!canReviewPin(pin)) {
    message.info(t('airspace.pinAudit.messages.onlyPublicReview'))
    return
  }
  try {
    const updated = await reviewPin(pin.id, status)
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
        const updated = await updatePinStatus(pin.id, nextStatus)
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
            <template v-if="column.key === 'createdAt'">
              <button class="sort-toggle" type="button" @click.stop="toggleCreatedAtSort">
                <span>{{ t('airspace.table.columns.createdAt') }}</span>
                <span class="sort-indicator" aria-hidden="true">{{ sortIndicator }}</span>
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
      <template v-else-if="activeMainTab === 'pinAudit'">
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
            :row-key="(record) => record.id" @change="handlePinAuditTableChange" class="pin-audit-table">
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
              @click="confirmPinReview(pinDetailRecord, PIN_REVIEW_STATUS.APPROVED_A)">
              {{ t('airspace.pinAudit.actions.passA') }}
            </a-button>
            <a-button type="primary" ghost :disabled="!canReviewPin(pinDetailRecord)"
              @click="confirmPinReview(pinDetailRecord, PIN_REVIEW_STATUS.APPROVED_B)">
              {{ t('airspace.pinAudit.actions.passB') }}
            </a-button>
            <a-button type="primary" danger :disabled="!canReviewPin(pinDetailRecord)"
              @click="confirmPinReview(pinDetailRecord, PIN_REVIEW_STATUS.REJECTED)">
              {{ t('airspace.pinAudit.actions.reject') }}
            </a-button>
          </template>
        </div>
      </template>

      <div v-if="pinDetailRecord" class="detail-body">
        <section class="detail-section">
          <h3>{{ t('airspace.pinAudit.detail.basic') }}</h3>
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item :label="t('airspace.pinAudit.detail.visibility')">
              {{ pinVisibilityText(pinDetailRecord.visibility) }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.pinAudit.detail.reviewStatus')">
              <a-tag :color="pinReviewColors[pinDetailRecord.reviewStatus] || 'default'">
                {{ pinReviewStatusText(pinDetailRecord.reviewStatus) }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.pinAudit.detail.status')">
              <a-tag :color="pinStatusColors[pinDetailRecord.status] || 'default'">
                {{ pinStatusText(pinDetailRecord.status) }}
              </a-tag>
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
              {{ pinDetailRecord?.shape?.coordinates?.length ?? 0 }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.pinAudit.detail.createdAt')">
              {{ formatDateTime(pinDetailRecord.createdAt) }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.pinAudit.detail.updatedAt')">
              {{ formatDateTime(pinDetailRecord.updatedAt) }}
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

    <a-modal :open="detailVisible" :title="detailRecord?.name || t('airspace.modal.title')" width="960px"
      :destroy-on-close="true" @cancel="closeDetail">
      <template #footer>
        <div class="modal-footer">
          <a-button @click="closeDetail">{{ t('airspace.modal.actions.close') }}</a-button>
          <template v-if="detailRecord?.reviewStatus === MARKER_REVIEW_STATUS.PENDING">
            <a-button type="primary" ghost :disabled="!detailRecord?.paid"
              @click="handleReview(detailRecord, MARKER_REVIEW_STATUS.REJECTED)">
              {{ t('airspace.modal.actions.reject') }}
            </a-button>
            <a-button type="primary" :disabled="!detailRecord?.paid"
              @click="handleReview(detailRecord, MARKER_REVIEW_STATUS.APPROVED)">
              {{ t('airspace.modal.actions.approve') }}
            </a-button>
          </template>
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

        <section class="detail-section" v-if="detailRecord.videoChannelId || detailRecord.videoId">
          <h3>{{ t('airspace.modal.sections.videoInfo') }}</h3>
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item :label="t('airspace.modal.fields.videoChannelId')">
              {{ detailRecord.videoChannelId || t('airspace.table.placeholders.notProvided') }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.videoId')">
              {{ detailRecord.videoId || t('airspace.table.placeholders.notProvided') }}
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
    <a-modal :open="orderDetailVisible" :title="t('airspace.orderModal.title')" width="720px" :destroy-on-close="true"
      @cancel="closeOrderDetail">
      <template #footer>
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

.pin-audit-table :deep(.ant-table-tbody > tr > td) {
  vertical-align: middle;
}

.pin-name {
  font-weight: 600;
  color: #111827;
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

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
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
