<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import locationIcon from '../../assets/img/location.png'
import searchIcon from '../../assets/img/search.png'
import centerPinIcon from '../../assets/img/position.png'
import droneIcon from '../../assets/img/drone.png'
import { fetchNearbyMarkers, fetchMarkerDetail, fetchNearbyNoFlyZones } from '../../services/airspaceMap'
import { buildDownloadUrl, extractObjectName, normalizeFileList } from '../../services/files'
import {
  buildAreaGraphics,
  fetchDjiAreas,
  labelForArea,
  toneForLevel,
  colorForArea,
  severityRank,
  effectiveHeight,
  areaContainsWgsPoint,
  ringContains,
  normalizedAreaLevel,
} from '../../utils/airspaceDji'
import { buildWmsOverlay, createWmsMapType, WMS_MIN_ZOOM, WMS_MAX_ZOOM } from '../../utils/airspaceWms'
import { buildNoFlyZoneGraphics } from '../../utils/airspaceNoFlyZones'
import { searchPlaces } from '../../utils/tencentMap'
import { DRONES } from '../../utils/drones'
import { clampRadius, gcj02ToWgs84, haversineMeters, wgs84ToGcj02 } from '../../utils/coords'
import { fetchPendingMarkersCount, MARKER_REVIEW_STATUS } from '../../services/markers'
import { fetchOrders } from '../../services/orders'

const { t } = useI18n()
const router = useRouter()

const DEFAULT_CENTER = { latitude: 39.908823, longitude: 116.39747 }
const DEFAULT_DRONE_INDEX = Math.max(DRONES.findIndex((d) => d.slug === 'dji-mavic-3'), 0)
const DEFAULT_MAP_ZOOM = 11
const UOM_SAFE_STATUS_TEXT = '适飞空域（限高120m）'
const DRONE_ICON_PATH = droneIcon

const mapContainer = ref(null)
const mapInstance = ref(null)
const mapReady = ref(false)
const mapListeners = []
const statusCenter = ref(DEFAULT_CENTER)
const userLocation = ref(null)
const scaleBarWidthPx = ref(0)
const scaleBarLabel = ref('')
const showScaleBar = computed(() => scaleBarWidthPx.value > 0 && !!scaleBarLabel.value)

const searchKeyword = ref('')
const searchResults = ref([])
const searchLoading = ref(false)

const statusPanel = reactive({
  djiStatus: '评估中',
  djiStatusExtra: '',
  djiTone: 'neutral',
  djiColor: '',
  uomStatus: '评估中',
  uomTone: 'neutral',
  temporaryText: '评估中',
  temporaryTone: 'neutral',
  temporaryZone: null,
})

const orderStatusColors = {
  WAITING_PAYMENT: 'orange',
  PAID: 'green',
  REFUNDED: 'blue',
}

const selectedDroneIndex = ref(DEFAULT_DRONE_INDEX)
const selectedDrone = computed(() => DRONES[selectedDroneIndex.value] || DRONES[0])

const orderColumns = computed(() => [
  { title: t('orders.table.columns.orderNumber'), dataIndex: 'orderNumber', key: 'orderNumber', width: 180 },
  { title: t('orders.table.columns.referenceId'), dataIndex: 'referenceId', key: 'referenceId', width: 200 },
  { title: t('orders.table.columns.featureCode'), dataIndex: 'featureCode', key: 'featureCode', width: 140 },
  { title: t('orders.table.columns.status'), dataIndex: 'status', key: 'status', width: 140 },
  { title: t('orders.table.columns.paymentType'), dataIndex: 'paymentType', key: 'paymentType', width: 140 },
  { title: t('orders.table.columns.amount'), dataIndex: 'amount', key: 'amount', width: 120 },
  { title: t('orders.table.columns.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 200 },
  { title: t('orders.table.columns.updatedAt'), dataIndex: 'updatedAt', key: 'updatedAt', width: 200 },
])

const orderPaginationConfig = computed(() => ({
  current: orderPagination.current,
  pageSize: orderPagination.pageSize,
  total: orderPagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total, range) => t('orders.pagination.total', { total, start: range?.[0] ?? 0, end: range?.[1] ?? 0 }),
}))

const markerOverlays = ref([])
const markerDrawerVisible = ref(false)
const markerDrawerLoading = ref(false)
const activeMarker = ref(null)
const markerDetail = ref(null)
const nearbyMarkers = ref([])
const MARKER_LABEL_WIDTH = 120
const normalizePoint = (value) => {
  const pick = (...vals) => {
    for (const v of vals) {
      const num = Number(v)
      if (Number.isFinite(num)) return num
    }
    return null
  }
  if (!value) return null
  const lat = pick(value?.latitude, value?.lat, value?.location?.latitude, value?.location?.lat)
  const lng = pick(value?.longitude, value?.lng, value?.location?.longitude, value?.location?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { latitude: lat, longitude: lng }
}
// const markerCoordsText = computed(() => {
//   const detail = markerDetail.value || {}
//   const lat = Number(detail.latitude ?? detail.location?.latitude ?? detail.location?.lat)
//   const lng = Number(detail.longitude ?? detail.location?.longitude ?? detail.location?.lng)
//   if (Number.isFinite(lat) && Number.isFinite(lng)) {
//     return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
//   }
//   return ''
// })
const markerAddressText = computed(
  () => markerDetail.value?.address || markerDetail.value?.detailAddress || markerDetail.value?.location?.text || '',
)
const markerDistanceText = computed(() => {
  const markerLoc = markerDetail.value?.location
  const userLoc = userLocation.value
  if (!markerLoc || !Number.isFinite(markerLoc.latitude) || !Number.isFinite(markerLoc.longitude)) return ''
  if (!userLoc || !Number.isFinite(userLoc.latitude) || !Number.isFinite(userLoc.longitude)) return '未定位'
  const meters = haversineMeters(userLoc.latitude, userLoc.longitude, markerLoc.latitude, markerLoc.longitude)
  if (!Number.isFinite(meters)) return ''
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`
  return `${Math.round(meters)} m`
})
const markerCoordsText = computed(() => {
  const detail = markerDetail.value || {}
  const lat = Number(detail.latitude ?? detail.location?.latitude ?? detail.location?.lat)
  const lng = Number(detail.longitude ?? detail.location?.longitude ?? detail.location?.lng)
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  }
  return ''
})
const pendingCount = ref(0)
const pendingLoading = ref(false)

const orderCount = ref(0)
const orderSummaryLoading = ref(false)

const ordersVisible = ref(false)
const ordersLoading = ref(false)
const ordersTableData = ref([])
const orderPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const djiPolygonOverlays = ref([])
const djiCircleOverlays = ref([])
const nfzPolygonOverlays = ref([])
const nfzCircleOverlays = ref([])
const uomOverlays = ref([])
const uomTileMasks = new Map()
const currentWmsTiles = ref([])
let uomMapType = null
let uomMapTypeIndex = -1

const lastDjiAreas = ref(undefined)
const noFlyZoneShapes = ref([])
const noFlyZonesReady = ref(false)
const noFlyZonesError = ref(false)

let refreshTimer = null
// 每次刷新都会递增 refreshToken，异步请求返回时对比 token 防止旧响应覆盖最新的中心点状态
let refreshToken = 0
const nextRefreshToken = () => ++refreshToken
const isStaleToken = (token) => token !== refreshToken

const toneClass = (tone) => {
  if (tone === 'safe') return 'tone-safe'
  if (tone === 'warn') return 'tone-warn'
  if (tone === 'alert') return 'tone-alert'
  return 'tone-neutral'
}

const clearListeners = () => {
  if (window.qq?.maps?.event && mapListeners.length) {
    mapListeners.forEach((ls) => {
      try {
        window.qq.maps.event.removeListener(ls)
      } catch (err) {
        console.warn('remove listener failed', err)
      }
    })
  }
  mapListeners.splice(0, mapListeners.length)
}

const clearOverlays = (collection) => {
  collection.value.forEach((item) => {
    try {
      item.setMap(null)
    } catch (err) {
      // ignore
    }
  })
  collection.value = []
}

const parseColorWithOpacity = (value, fallbackOpacity = 1) => {
  if (typeof value !== 'string') return { color: '#DE4329', opacity: fallbackOpacity }
  const normalized = value.trim().replace('#', '')
  if (normalized.length === 8) {
    const a = Math.max(0, Math.min(1, parseInt(normalized.slice(6, 8), 16) / 255))
    return { color: `#${normalized.slice(0, 6)}`, opacity: a }
  }
  if (normalized.length === 6) {
    return { color: `#${normalized}`, opacity: fallbackOpacity }
  }
  return { color: value, opacity: fallbackOpacity }
}

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

const formatDateTime = (value) => {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch (error) {
    return value
  }
}

const formatAmount = (value) => {
  if (value === null || value === undefined) return '-'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '-'
  return numeric.toFixed(2)
}

const statusText = (status) => {
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

const paymentTypeText = (type) => {
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

const toLatLng = (point) => new window.qq.maps.LatLng(Number(point.latitude), Number(point.longitude))

const resolveAssetUrl = (value) => {
  if (!value) return ''
  const objectName = extractObjectName(value)
  return buildDownloadUrl(objectName || value)
}

const normalizeMarkerDetailPayload = (detail) => {
  if (!detail) return detail
  const normalizedImages = normalizeFileList(detail.images || []).map((item) => item.url)
  const normalizedQrs = normalizeFileList(detail.qrCodeUrls || []).map((item) => item.url)
  const normalizedAttachments = normalizeFileList(detail.attachmentUrls || []).map((item) => item.url)
  const licenseUrl = resolveAssetUrl(detail.businessLicense)
  const normalizedLocation = normalizeMarkerLocation(detail)
  return {
    ...detail,
    images: normalizedImages,
    qrCodeUrls: normalizedQrs,
    attachmentUrls: normalizedAttachments,
    businessLicense: licenseUrl,
    location: normalizedLocation || detail.location || null,
  }
}

const pickNumber = (...values) => {
  for (const value of values) {
    const num = Number(value)
    if (Number.isFinite(num)) return num
  }
  return null
}

const normalizeMarkerLocation = (item) => {
  if (!item) return null
  const lat = pickNumber(item?.location?.latitude, item?.location?.lat, item?.latitude, item?.lat)
  const lng = pickNumber(item?.location?.longitude, item?.location?.lng, item?.longitude, item?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  const gcj = wgs84ToGcj02(lng, lat)
  return {
    latitude: Number.isFinite(gcj?.lat) ? gcj.lat : lat,
    longitude: Number.isFinite(gcj?.lng) ? gcj.lng : lng,
  }
}

const renderDjiOverlays = (polygons = [], circles = []) => {
  clearOverlays(djiPolygonOverlays)
  clearOverlays(djiCircleOverlays)
  if (!mapInstance.value || !window.qq?.maps) return

  polygons.forEach((poly) => {
    const stroke = parseColorWithOpacity(poly.strokeColor, 0.95)
    const fill = parseColorWithOpacity(poly.fillColor, 0.4)
    const overlay = new window.qq.maps.Polygon({
      map: mapInstance.value,
      path: poly.points.map((pt) => toLatLng(pt)),
      strokeColor: toQqColor(stroke.color, stroke.opacity),
      fillColor: toQqColor(fill.color, fill.opacity),
      strokeWeight: poly.strokeWidth || 1,
      strokeOpacity: stroke.opacity,
      fillOpacity: fill.opacity ?? 0.4,
      zIndex: 3,
    })
    djiPolygonOverlays.value.push(overlay)
  })

  circles.forEach((circle) => {
    const stroke = parseColorWithOpacity(circle.color, 0.95)
    const fill = parseColorWithOpacity(circle.fillColor, 0.4)
    const overlay = new window.qq.maps.Circle({
      map: mapInstance.value,
      center: new window.qq.maps.LatLng(circle.latitude, circle.longitude),
      radius: circle.radius,
      strokeColor: toQqColor(stroke.color, stroke.opacity),
      fillColor: toQqColor(fill.color, fill.opacity),
      strokeWeight: circle.strokeWidth || 1,
      strokeOpacity: stroke.opacity,
      fillOpacity: fill.opacity ?? 0.4,
      zIndex: 3,
    })
    djiCircleOverlays.value.push(overlay)
  })
}

const renderNoFlyOverlays = (polygons = [], circles = []) => {
  clearOverlays(nfzPolygonOverlays)
  clearOverlays(nfzCircleOverlays)
  if (!mapInstance.value || !window.qq?.maps) return

  polygons.forEach((poly) => {
    const stroke = parseColorWithOpacity(poly.strokeColor, 0.95)
    const fill = parseColorWithOpacity(poly.fillColor, 0.3)
    const overlay = new window.qq.maps.Polygon({
      map: mapInstance.value,
      path: poly.points.map((pt) => toLatLng(pt)),
      strokeColor: toQqColor(stroke.color, stroke.opacity),
      fillColor: toQqColor(fill.color, fill.opacity),
      strokeWeight: poly.strokeWidth || 1,
      strokeOpacity: stroke.opacity,
      fillOpacity: fill.opacity ?? 0.3,
      zIndex: 2,
    })
    nfzPolygonOverlays.value.push(overlay)
  })

  circles.forEach((circle) => {
    const stroke = parseColorWithOpacity(circle.color, 0.95)
    const fill = parseColorWithOpacity(circle.fillColor, 0.3)
    const overlay = new window.qq.maps.Circle({
      map: mapInstance.value,
      center: new window.qq.maps.LatLng(circle.latitude, circle.longitude),
      radius: circle.radius,
      strokeColor: toQqColor(stroke.color, stroke.opacity),
      fillColor: toQqColor(fill.color, fill.opacity),
      strokeWeight: circle.strokeWidth || 1,
      strokeOpacity: stroke.opacity,
      fillOpacity: fill.opacity ?? 0.3,
      zIndex: 2,
    })
    nfzCircleOverlays.value.push(overlay)
  })
}

const renderUomOverlays = (tiles = []) => {
  // Deprecated: kept for compatibility with the UOM mask parser. We now rely on
  // a map type overlay for display, so only clear previously rendered ground
  // overlays if any remain.
  clearOverlays(uomOverlays)
  currentWmsTiles.value = tiles
}

const ensureUomMapType = () => {
  if (!mapInstance.value || !window.qq?.maps) return null
  if (!uomMapType) {
    uomMapType = createWmsMapType(window.qq)
  }
  return uomMapType
}

const setUomLayerVisible = (visible) => {
  if (!mapInstance.value || !window.qq?.maps) return
  const layer = ensureUomMapType()
  if (!layer) return
  if (visible) {
    if (uomMapTypeIndex === -1) {
      uomMapTypeIndex = mapInstance.value.overlayMapTypes.push(layer) - 1
    }
  } else if (uomMapTypeIndex > -1) {
    mapInstance.value.overlayMapTypes.removeAt(uomMapTypeIndex)
    uomMapTypeIndex = -1
  }
}

const clearMarkers = () => clearOverlays(markerOverlays)

const renderMarkers = (markers = []) => {
  clearMarkers()
  if (!mapInstance.value || !window.qq?.maps) return

  const iconSize = new window.qq.maps.Size(40, 40)
  const markerImage = new window.qq.maps.MarkerImage(
    DRONE_ICON_PATH,
    iconSize,
    new window.qq.maps.Point(0, 0),
    new window.qq.maps.Point(20, 20),
    iconSize,
  )

  markers.forEach((marker) => {
    if (!marker?.location) return
    const latitude = Number(marker.location.latitude)
    const longitude = Number(marker.location.longitude)
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return
    const overlay = new window.qq.maps.Marker({
      map: mapInstance.value,
      position: new window.qq.maps.LatLng(latitude, longitude),
      title: marker.name || '未命名商户',
      icon: markerImage,
      zIndex: 5,
    })
    const labelText = marker.name || '未命名商户'
    if (labelText) {
      const label = new window.qq.maps.Label({
        map: mapInstance.value,
        position: overlay.getPosition(),
        content: labelText,
        // Anchor the label bottom to the marker point; wrapping grows upward instead of covering the marker.
        offset: new window.qq.maps.Size(0, -20),
      })
      label.setZIndex(6)
      label.setStyle({
        backgroundColor: '#ffffff',
        color: '#111827',
        padding: '6px 10px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: '700',
        border: '1px solid rgba(0, 0, 0, 0.2)',
        boxShadow: '0 8px 16px rgba(0, 0, 0, 0.25)',
        display: '-webkit-box',
        WebkitLineClamp: '3',
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        width: `${MARKER_LABEL_WIDTH}px`,
        maxWidth: `${MARKER_LABEL_WIDTH}px`,
        textAlign: 'center',
        lineHeight: '1.2',
        transform: 'translate(-50%, -100%)',
        left: '50%',
      })
      markerOverlays.value.push(label)
    }
    window.qq.maps.event.addListener(overlay, 'click', () => openMarkerDetail(marker))
    markerOverlays.value.push(overlay)
  })
}

const getCurrentCenter = () => {
  if (mapInstance.value && typeof mapInstance.value.getCenter === 'function') {
    const center = mapInstance.value.getCenter()
    return { latitude: center.getLat(), longitude: center.getLng() }
  }
  return DEFAULT_CENTER
}

const getCurrentBounds = () => {
  if (!mapInstance.value || typeof mapInstance.value.getBounds !== 'function') return null
  const bounds = mapInstance.value.getBounds()
  if (!bounds) return null
  const ne = bounds.getNorthEast()
  const sw = bounds.getSouthWest()
  return {
    northeast: { latitude: ne.getLat(), longitude: ne.getLng() },
    southwest: { latitude: sw.getLat(), longitude: sw.getLng() },
  }
}

const estimateVisibleRadiusMeters = () => {
  const center = getCurrentCenter()
  const bounds = getCurrentBounds()
  if (center && bounds?.northeast) {
    const north = bounds.northeast
    return haversineMeters(center.latitude, center.longitude, north.latitude, center.longitude)
  }
  return 80000
}

const formatScaleLabel = (meters) => {
  if (!Number.isFinite(meters) || meters <= 0) return ''
  if (meters >= 1000) {
    const km = meters / 1000
    return `${km >= 10 ? km.toFixed(0) : km.toFixed(1)} km`
  }
  return `${Math.round(meters)} m`
}

const updateScaleBar = (center, zoom) => {
  if (!mapInstance.value || !mapReady.value) {
    scaleBarWidthPx.value = 0
    scaleBarLabel.value = ''
    return
  }
  const lat = Number(center?.latitude ?? DEFAULT_CENTER.latitude)
  const useZoom = Number.isFinite(zoom) ? zoom : DEFAULT_MAP_ZOOM
  const metersPerPixel =
    (40075016.686 * Math.abs(Math.cos((lat * Math.PI) / 180))) / (256 * Math.pow(2, useZoom))
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) {
    scaleBarWidthPx.value = 0
    scaleBarLabel.value = ''
    return
  }
  const candidates = [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000]
  const targetPx = 120
  const rangeMin = 70
  const rangeMax = 180
  let picked = { meters: candidates[0], px: candidates[0] / metersPerPixel, score: Infinity }
  candidates.forEach((meters) => {
    const px = meters / metersPerPixel
    const inRange = px >= rangeMin && px <= rangeMax
    const score = Math.abs(px - targetPx) + (inRange ? 0 : 1000)
    if (score < picked.score) {
      picked = { meters, px, score }
    }
  })
  scaleBarWidthPx.value = picked.px
  scaleBarLabel.value = formatScaleLabel(picked.meters)
}

const refreshScaleBar = () => {
  const center = getCurrentCenter()
  const zoom = typeof mapInstance.value?.getZoom === 'function' ? mapInstance.value.getZoom() : DEFAULT_MAP_ZOOM
  updateScaleBar(center, zoom)
}

const circleRectFromCenter = (center, radius) => {
  if (!center) return null
  const metersLat = 111320
  const useRadius = clampRadius(radius || 80000)
  const latDelta = useRadius / metersLat
  const cosLat = Math.cos((center.latitude * Math.PI) / 180)
  const metersLng = metersLat * Math.max(cosLat, 0.01)
  const lngDelta = useRadius / metersLng
  const clampLat = (lat) => Math.max(-90, Math.min(90, lat))
  const clampLng = (lng) => {
    if (!Number.isFinite(lng)) return 0
    let val = lng
    while (val > 180) val -= 360
    while (val < -180) val += 360
    return val
  }
  return {
    ltlat: clampLat(center.latitude + latDelta),
    ltlng: clampLng(center.longitude - lngDelta),
    rblat: clampLat(center.latitude - latDelta),
    rblng: clampLng(center.longitude + lngDelta),
  }
}

const buildBoundsRect = (region, center, radius) => {
  if (region?.northeast && region?.southwest) {
    const { northeast, southwest } = region
    return {
      ltlat: northeast.latitude,
      ltlng: southwest.longitude,
      rblat: southwest.latitude,
      rblng: northeast.longitude,
    }
  }
  return circleRectFromCenter(center, radius)
}

const gcjRectToWgs = (rect) => {
  if (!rect) return null
  const leftTop = gcj02ToWgs84(rect.ltlng, rect.ltlat)
  const rightBottom = gcj02ToWgs84(rect.rblng, rect.rblat)
  if (!leftTop || !rightBottom) return null
  return {
    ltlat: leftTop.lat,
    ltlng: leftTop.lng,
    rblat: rightBottom.lat,
    rblng: rightBottom.lng,
  }
}

const ensureUomMask = (tile) => {
  if (!tile || !tile.id) return
  const cached = uomTileMasks.get(tile.id)
  if (cached && (cached.status === 'ready' || cached.status === 'pending')) return
  const img = new Image()
  const entry = { status: 'pending', bounds: tile.bounds }
  uomTileMasks.set(tile.id, entry)
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    try {
      const w = img.width || 256
      const h = img.height || 256
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, w, h)
      ctx.drawImage(img, 0, 0, w, h)
      const imageData = ctx.getImageData(0, 0, w, h)
      entry.status = 'ready'
      entry.width = imageData.width
      entry.height = imageData.height
      entry.data = imageData.data
      updateStatusPanel()
    } catch (err) {
      console.error('解析 UOM 瓦片失败', err)
      entry.status = 'error'
    }
  }
  img.onerror = (err) => {
    console.error('加载 UOM 瓦片失败', err)
    const current = uomTileMasks.get(tile.id)
    if (current) current.status = 'error'
  }
  img.src = tile.src
}

const findUomTileForPoint = (point) => {
  if (!point || !Array.isArray(currentWmsTiles.value)) return null
  return currentWmsTiles.value.find((tile) => pointInBounds(point, tile.bounds)) || null
}

const pointInBounds = (point, bounds) => {
  if (!point || !bounds) return false
  const sw = bounds.southwest || {}
  const ne = bounds.northeast || {}
  const swLat = typeof sw.latitude === 'number' ? sw.latitude : -90
  const neLat = typeof ne.latitude === 'number' ? ne.latitude : 90
  const swLng = typeof sw.longitude === 'number' ? sw.longitude : -180
  const neLng = typeof ne.longitude === 'number' ? ne.longitude : 180
  return point.latitude >= swLat && point.latitude <= neLat && point.longitude >= swLng && point.longitude <= neLng
}

const pointCoveredByUomMask = (point, bounds, mask) => {
  if (!point || !bounds || !mask || mask.status !== 'ready' || !mask.data) return false
  const sw = bounds.southwest || {}
  const ne = bounds.northeast || {}
  const lngSpan = (ne.longitude ?? sw.longitude) - (sw.longitude ?? 0)
  const latSpan = (ne.latitude ?? sw.latitude) - (sw.latitude ?? 0)
  if (!lngSpan || !latSpan) return false
  const u = (point.longitude - sw.longitude) / lngSpan
  const v = (ne.latitude - point.latitude) / latSpan
  if (u < 0 || u > 1 || v < 0 || v > 1) return false
  const width = mask.width || 256
  const height = mask.height || 256
  const px = Math.min(width - 1, Math.max(0, Math.round(u * (width - 1))))
  const py = Math.min(height - 1, Math.max(0, Math.round(v * (height - 1))))
  const idx = (py * width + px) * 4
  const alpha = mask.data[idx + 3]
  return alpha > 16
}

const describeUomStatus = () => {
  const center = statusCenter.value
  if (!center) return { status: '评估中', tone: 'neutral' }
  const tile = findUomTileForPoint(center)
  if (!tile) return { status: '非适飞空域', tone: 'alert' }
  const mask = uomTileMasks.get(tile.id)
  if (!mask) {
    ensureUomMask(tile)
    return { status: '评估中', tone: 'neutral' }
  }
  if (mask.status === 'pending') return { status: '评估中', tone: 'neutral' }
  if (mask.status !== 'ready') return { status: '非适飞空域', tone: 'alert' }
  const covered = pointCoveredByUomMask(center, tile.bounds, mask)
  return covered ? { status: UOM_SAFE_STATUS_TEXT, tone: 'safe' } : { status: '非适飞空域', tone: 'alert' }
}

const formatTemporaryZoneLabel = (value, maxLength = 9) => {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  const chars = Array.from(trimmed)
  if (chars.length <= maxLength) return trimmed
  return `${chars.slice(0, maxLength).join('')}...`
}

const findNoFlyZoneAtPoint = (lng, lat) => {
  if (!Array.isArray(noFlyZoneShapes.value) || !noFlyZoneShapes.value.length) return null
  for (const entry of noFlyZoneShapes.value) {
    if (!entry) continue
    if (entry.type === 'circle' && entry.center) {
      const radius = Number(entry.radius)
      if (!Number.isFinite(radius) || radius <= 0) continue
      const dist = haversineMeters(lat, lng, Number(entry.center.lat), Number(entry.center.lng))
      if (Number.isFinite(dist) && dist <= radius) return { zone: entry.zone, shape: entry }
      continue
    }
    if (entry.type === 'polygon' && Array.isArray(entry.rings)) {
      for (const ring of entry.rings) {
        if (ringContains(ring, lng, lat)) return { zone: entry.zone, shape: entry }
      }
    }
  }
  return null
}

const describeTemporaryNoFlyStatus = () => {
  if (!noFlyZonesReady.value) return { zoneInfo: null, text: '评估中', tone: 'neutral' }
  if (noFlyZonesError.value) return { zoneInfo: null, text: '临时禁飞数据不可用', tone: 'warn' }
  const center = statusCenter.value
  if (!center || !Number.isFinite(center.longitude) || !Number.isFinite(center.latitude)) {
    return { zoneInfo: null, text: '评估中', tone: 'neutral' }
  }
  const hit = findNoFlyZoneAtPoint(center.longitude, center.latitude)
  if (!hit) return { zoneInfo: null, text: '无', tone: 'safe' }
  const rawName = typeof hit.zone?.name === 'string' ? hit.zone.name.trim() : ''
  const name = rawName || '临时禁飞区'
  const displayName = formatTemporaryZoneLabel(name)
  return { zoneInfo: { id: hit.zone?.id || '', name, displayName }, text: displayName, tone: 'alert' }
}

const describeDjiStatus = () => {
  const areas = lastDjiAreas.value
  const fallback = { status: '暂无空域数据', extra: '', tone: 'neutral', color: '' }
  if (typeof areas === 'undefined') return { status: '评估中', extra: '', tone: 'neutral', color: '' }
  if (areas === null) return { status: '空域数据加载失败', extra: '', tone: 'warn', color: '' }
  if (!Array.isArray(areas) || !areas.length) return { status: '不在限制区', extra: '', tone: 'safe', color: '' }
  const center = statusCenter.value
  if (!center) return fallback
  const wgs = gcj02ToWgs84(center.longitude, center.latitude)
  if (!wgs) return fallback
  const hits = []
  const visitArea = (area, parent) => {
    if (!area) return
    if (areaContainsWgsPoint(area, wgs.lng, wgs.lat)) {
      hits.push({ area, parent })
    }
    if (Array.isArray(area.sub_areas) && area.sub_areas.length) {
      area.sub_areas.forEach((sub) => visitArea(sub, area))
    }
  }
  areas.forEach((area) => visitArea(area, null))
  if (!hits.length) return { status: '不在限制区', extra: '', tone: 'safe', color: '' }
  hits.sort((a, b) => severityRank(a.area) - severityRank(b.area))
  const target = hits[0]
  const extraParts = []
  const areaName = target.area.name || target.area.title || target.parent?.name
  const city = target.area.city || target.parent?.city
  if (areaName) extraParts.push(areaName)
  if (city && city !== areaName) extraParts.push(city)
  const height = effectiveHeight(target.area, target.parent)
  if (typeof height === 'number' && height > 0) extraParts.push(`限高 ${Math.round(height)}m`)
  const reason = target.area.reason || target.area.desc || target.area.description
  if (reason) extraParts.push(reason)
  const normalizedLevel = normalizedAreaLevel(target.area)
  return {
    status: labelForArea(target.area, target.parent),
    extra: extraParts.join(' · '),
    tone: toneForLevel(normalizedLevel),
    color: colorForArea(target.area),
  }
}

const updateStatusPanel = () => {
  const dji = describeDjiStatus()
  const uom = describeUomStatus()
  const temporary = describeTemporaryNoFlyStatus()
  statusPanel.djiStatus = dji.status
  statusPanel.djiStatusExtra = dji.extra
  statusPanel.djiTone = dji.tone
  statusPanel.djiColor = dji.color || ''
  statusPanel.uomStatus = uom.status
  statusPanel.uomTone = uom.tone
  statusPanel.temporaryText = temporary.text
  statusPanel.temporaryTone = temporary.tone
  statusPanel.temporaryZone = temporary.zoneInfo
}

const loadNearbyMarkers = async (center, radiusKm, token) => {
  try {
    const markers = await fetchNearbyMarkers({
      latitude: center.latitude,
      longitude: center.longitude,
      radiusInKilometers: radiusKm,
    })
    if (isStaleToken(token)) return
    const normalized = markers
      .map((item) => {
        const location = normalizeMarkerLocation(item)
        if (!location) return null
        return {
          id: item.id,
          name: item.name || '未命名商户',
          address: item.address || item.detailAddress || item.location?.text || '',
          contact: item.contactName || item.contact || '',
          phone: item.phone || item.mobile || '',
          location,
        }
      })
      .filter(Boolean)
    nearbyMarkers.value = normalized
    renderMarkers(normalized)
  } catch (error) {
    console.error('加载商户失败', error)
    message.error('加载附近商户失败')
  }
}

const loadNoFlyZones = async (center, radiusKm, token) => {
  try {
    const wgs = gcj02ToWgs84(center.longitude, center.latitude)
    const zones = await fetchNearbyNoFlyZones({
      latitude: Number.isFinite(wgs?.lat) ? wgs.lat : center.latitude,
      longitude: Number.isFinite(wgs?.lng) ? wgs.lng : center.longitude,
      radiusInKilometers: radiusKm,
    })
    if (isStaleToken(token)) return
    const graphics = buildNoFlyZoneGraphics(zones)
    noFlyZoneShapes.value = graphics.shapes || []
    noFlyZonesReady.value = true
    noFlyZonesError.value = false
    renderNoFlyOverlays(graphics.polygons || [], graphics.circles || [])
  } catch (error) {
    console.error('加载临时禁飞区失败', error)
    if (isStaleToken(token)) return
    noFlyZonesReady.value = true
    noFlyZonesError.value = true
    noFlyZoneShapes.value = []
    clearOverlays(nfzCircleOverlays)
    clearOverlays(nfzPolygonOverlays)
  } finally {
    if (!isStaleToken(token)) updateStatusPanel()
  }
}

const loadDjiAreas = async (center, radiusMeters, region, token) => {
  try {
    const rect = buildBoundsRect(region, center, radiusMeters)
    const wgsRect = gcjRectToWgs(rect)
    if (!wgsRect) throw new Error('坐标转换失败')
    const areas = await fetchDjiAreas({ rect: wgsRect, levels: '2,6,1,4,3,7,8,10', drone: selectedDrone.value?.slug })
    if (isStaleToken(token)) return
    lastDjiAreas.value = areas
    const graphics = buildAreaGraphics(areas)
    renderDjiOverlays(graphics.polygons || [], graphics.circles || [])
  } catch (error) {
    console.error('DJI 空域加载失败', error)
    if (isStaleToken(token)) return
    lastDjiAreas.value = null
    clearOverlays(djiPolygonOverlays)
    clearOverlays(djiCircleOverlays)
  } finally {
    if (!isStaleToken(token)) updateStatusPanel()
  }
}

const refreshUom = (center, zoom, region) => {
  const tiles = buildWmsOverlay(center, Math.round(zoom), region)
  currentWmsTiles.value = tiles
  renderUomOverlays(tiles)
  tiles.forEach((tile) => ensureUomMask(tile))
  updateStatusPanel()
}

const refreshData = (force = false, providedToken = null) => {
  if (!mapInstance.value || !mapReady.value) return
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  const token = providedToken === null ? nextRefreshToken() : providedToken
  refreshToken = token
  const center = getCurrentCenter()
  statusCenter.value = center
  lastDjiAreas.value = undefined
  noFlyZonesReady.value = false
  updateStatusPanel()
  const bounds = getCurrentBounds()
  const radiusMeters = clampRadius(estimateVisibleRadiusMeters())
  const radiusKm = Math.max(0.5, Math.round((radiusMeters / 1000) * 10) / 10)
  const zoom = typeof mapInstance.value.getZoom === 'function' ? mapInstance.value.getZoom() : DEFAULT_MAP_ZOOM

  updateScaleBar(center, zoom)
  loadNearbyMarkers(center, radiusKm, token)
  loadNoFlyZones(center, radiusKm, token)
  loadDjiAreas(center, radiusMeters, bounds, token)
  if (zoom >= WMS_MIN_ZOOM && zoom <= WMS_MAX_ZOOM) {
    setUomLayerVisible(true)
    refreshUom(center, zoom, bounds)
  } else {
    setUomLayerVisible(false)
    clearOverlays(uomOverlays)
    currentWmsTiles.value = []
  }
}

const scheduleRefresh = () => {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshScaleBar()
  const token = nextRefreshToken()
  refreshTimer = setTimeout(() => refreshData(false, token), 300)
}

const initializeMap = () => {
  if (!window.qq?.maps || !mapContainer.value) return false
  mapInstance.value = new window.qq.maps.Map(mapContainer.value, {
    center: new window.qq.maps.LatLng(DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude),
    zoom: DEFAULT_MAP_ZOOM,
    mapTypeControl: false,
    zoomControl: false,
    panControl: false,
  })
  mapReady.value = true
  refreshScaleBar()
  mapListeners.push(window.qq.maps.event.addListener(mapInstance.value, 'center_changed', scheduleRefresh))
  mapListeners.push(window.qq.maps.event.addListener(mapInstance.value, 'idle', scheduleRefresh))
  mapListeners.push(window.qq.maps.event.addListener(mapInstance.value, 'dragend', scheduleRefresh))
  mapListeners.push(window.qq.maps.event.addListener(mapInstance.value, 'zoom_changed', scheduleRefresh))
  mapListeners.push(window.qq.maps.event.addListener(mapInstance.value, 'tilesloaded', () => refreshData()))
  refreshData(true)
  return true
}

const waitForMap = () => {
  if (initializeMap()) return
  let attempts = 0
  const timer = setInterval(() => {
    attempts += 1
    if (initializeMap() || attempts > 40) {
      clearInterval(timer)
      if (!mapReady.value) {
        message.error('地图加载失败，请刷新重试')
      }
    }
  }, 150)
}

const openMarkerDetail = (marker) => {
  activeMarker.value = marker
  markerDrawerVisible.value = true
  markerDrawerLoading.value = true
  fetchMarkerDetail(marker.id)
    .then((detail) => {
      markerDetail.value = normalizeMarkerDetailPayload(detail || marker)
    })
    .catch((error) => {
      console.error('加载商户详情失败', error)
      markerDetail.value = normalizeMarkerDetailPayload(marker)
    })
    .finally(() => {
      markerDrawerLoading.value = false
    })
}

const handleDrawerClose = () => {
  markerDrawerVisible.value = false
  markerDetail.value = null
  activeMarker.value = null
}

const locateUser = () => {
  if (!navigator.geolocation) {
    message.warning('当前浏览器不支持定位')
    return
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords
      const gcj = wgs84ToGcj02(longitude, latitude)
      userLocation.value = { latitude: gcj.lat, longitude: gcj.lng }
      if (mapInstance.value) {
        mapInstance.value.setCenter(new window.qq.maps.LatLng(gcj.lat, gcj.lng))
        mapInstance.value.setZoom(Math.max(DEFAULT_MAP_ZOOM, 13))
      }
      refreshData(true)
    },
    (err) => {
      console.error('定位失败', err)
      message.error('定位失败，请检查权限')
    },
    { enableHighAccuracy: true, timeout: 8000 },
  )
}

const submitSearch = async () => {
  const keyword = searchKeyword.value.trim()
  if (!keyword) return
  searchLoading.value = true
  try {
    const center = getCurrentCenter()
    const keywordLower = keyword.toLowerCase()
    const markerMatches = nearbyMarkers.value
      .map((m) => ({
        id: `marker-${m.id}`,
        title: m.name || '未命名商户',
        address: m.address || '',
        location: normalizePoint(m.location),
        source: 'marker',
        markerId: m.id,
      }))
      .filter(
        (m) =>
          m.location &&
          ((m.title || '').toLowerCase().includes(keywordLower) || (m.address || '').toLowerCase().includes(keywordLower)),
      )

    const placeResults = await searchPlaces(keyword, center)
    const mappedPlaces = placeResults
      .map((item) => ({
        ...item,
        location: normalizePoint(item.location || item),
        source: 'place',
      }))
      .filter((item) => item.location)

    searchResults.value = [...markerMatches, ...mappedPlaces]
  } catch (error) {
    console.error('搜索失败', error)
    message.error('搜索失败，请稍后重试')
  } finally {
    searchLoading.value = false
  }
}

const applySearchResult = (item) => {
  if (!mapInstance.value) return
  const point = normalizePoint(item?.location || item)
  if (!point) return
  const target = new window.qq.maps.LatLng(point.latitude, point.longitude)
  try {
    if (typeof mapInstance.value.setCenter === 'function') {
      mapInstance.value.setCenter(target)
    }
    if (typeof mapInstance.value.panTo === 'function') {
      mapInstance.value.panTo(target)
    }
    if (typeof mapInstance.value.setZoom === 'function') {
      mapInstance.value.setZoom(item.source === 'marker' ? 17 : 15)
    }
  } catch (err) {
    console.error('地图跳转失败', err)
  }
  searchResults.value = []
  searchKeyword.value = item.title
  // 在下一帧再刷新，确保中心已更新
  requestAnimationFrame(() => refreshData(true))
}

const loadPendingCount = async () => {
  pendingLoading.value = true
  try {
    const count = await fetchPendingMarkersCount()
    pendingCount.value = count ?? 0
  } catch (error) {
    console.error('Failed to load pending markers count', error)
  } finally {
    pendingLoading.value = false
  }
}

const loadOrderSummary = async () => {
  orderSummaryLoading.value = true
  try {
    const { totalElements } = await fetchOrders({ page: 1, size: 1 })
    orderCount.value = totalElements ?? 0
  } catch (error) {
    console.error('Failed to load order count', error)
  } finally {
    orderSummaryLoading.value = false
  }
}

const loadOrders = async () => {
  ordersLoading.value = true
  try {
    const { content, totalElements, page, size } = await fetchOrders({
      page: orderPagination.current,
      size: orderPagination.pageSize,
    })
    ordersTableData.value = content
    orderPagination.total = totalElements
    orderPagination.current = page
    orderPagination.pageSize = size
    orderCount.value = totalElements ?? orderCount.value
  } catch (error) {
    console.error('Failed to load orders', error)
    message.error(t('orders.messages.loadFailed'))
  } finally {
    ordersLoading.value = false
  }
}

const openOrdersModal = () => {
  orderPagination.current = 1
  ordersVisible.value = true
  loadOrders()
}

const closeOrdersModal = () => {
  ordersVisible.value = false
}

const handleOrdersTableChange = (pager) => {
  orderPagination.current = pager?.current ?? 1
  orderPagination.pageSize = pager?.pageSize ?? orderPagination.pageSize
  loadOrders()
}

const goToPendingMarkers = () => {
  router
    .push({
      name: 'airspace',
      query: { status: MARKER_REVIEW_STATUS.PENDING },
    })
    .catch(() => { })
}

onMounted(() => {
  waitForMap()
  loadPendingCount()
  loadOrderSummary()
})

onBeforeUnmount(() => {
  clearListeners()
  clearOverlays(markerOverlays)
  clearOverlays(djiPolygonOverlays)
  clearOverlays(djiCircleOverlays)
  clearOverlays(nfzPolygonOverlays)
  clearOverlays(nfzCircleOverlays)
  clearOverlays(uomOverlays)
  setUomLayerVisible(false)
  if (refreshTimer) clearTimeout(refreshTimer)
  if (mapInstance.value && typeof mapInstance.value.destroy === 'function') {
    mapInstance.value.destroy()
  }
})
</script>

<template>
  <div class="map-page">
    <div ref="mapContainer" class="map-canvas">
      <div class="map-center-pin" :class="{ 'is-ready': mapReady }" aria-hidden="true">
        <img :src="centerPinIcon" alt="中心锚点" />
      </div>
      <div v-if="!mapReady" class="map-placeholder">地图加载中...</div>
      <div v-if="showScaleBar" class="map-scale">
        <div class="map-scale-label">{{ scaleBarLabel }}</div>
        <div class="map-scale-track" :style="{ width: `${scaleBarWidthPx}px` }">
          <div class="map-scale-line"></div>
          <div class="map-scale-tick map-scale-tick-start"></div>
          <div class="map-scale-tick map-scale-tick-end"></div>
        </div>
      </div>
    </div>

    <div class="map-overlays">
      <div class="dashboard-card">
        <div class="card-header">
          <div>
            <div class="card-title">飞前安全准备</div>
          </div>
        </div>
        <div class="status-row">
          <span class="status-label">执飞机型：</span>
          <a-select v-model:value="selectedDroneIndex" class="picker-select" size="small"
            :options="DRONES.map((item, index) => ({ label: item.name, value: index }))"
            :get-popup-container="(triggerNode) => triggerNode?.parentNode || document.body"
            :dropdownMatchSelectWidth="false" @change="refreshData(true)" />
        </div>
        <div class="status-row">
          <span class="status-label">临时禁飞区：</span>
          <span :class="['status-value', toneClass(statusPanel.temporaryTone)]">{{ statusPanel.temporaryText }}</span>
        </div>
        <div class="status-row">
          <span class="status-label">位于UOM划分：</span>
          <span :class="['status-value', toneClass(statusPanel.uomTone)]">{{ statusPanel.uomStatus }}</span>
        </div>
        <div class="status-row">
          <span class="status-label">位于大疆划分：</span>
          <span :class="['status-value', toneClass(statusPanel.djiTone)]"
            :style="{ color: statusPanel.djiColor || undefined }">
            {{ statusPanel.djiStatus }}
          </span>
        </div>
        <div v-if="statusPanel.djiStatusExtra" class="status-extra">{{ statusPanel.djiStatusExtra }}</div>

        <div class="search-box">
          <div class="search-pill">
            <input v-model="searchKeyword" class="search-input" type="text" placeholder="搜索位置或商户"
              @keyup.enter="submitSearch" />
            <button class="search-btn" type="button" :disabled="searchLoading" @click="submitSearch">
              <img :src="searchIcon" alt="搜索" />
            </button>
          </div>
        </div>
        <div v-if="searchResults.length" class="search-results">
          <div v-for="item in searchResults" :key="item.id" class="search-result-item"
            :class="{ 'search-result-item--marker': item.source === 'marker' }" @click="applySearchResult(item)">
            <div class="result-title" :class="{ 'result-title--marker': item.source === 'marker' }">
              {{ item.title }}<span v-if="item.source === 'marker'" class="result-tag">（低空星球）</span>
            </div>
            <div class="result-address">{{ item.address || '无详细地址' }}</div>
          </div>
        </div>
      </div>

      <div class="summary-board summary-board--standalone">
        <button class="board-item board-item--pending" type="button" @click="goToPendingMarkers">
          <span class="board-label">{{ t('dashboard.pending') }} ></span>
          <span class="board-value">{{ pendingLoading ? '...' : pendingCount }}</span>
        </button>
        <div class="board-divider" aria-hidden="true"></div>
        <button class="board-item board-item--orders" type="button" @click="openOrdersModal">
          <span class="board-value">{{ orderSummaryLoading ? '...' : orderCount }}</span>
          <span class="board-label">{{ t('orders.summary.title') }} ></span>
        </button>
      </div>
    </div>

    <div class="map-actions">
      <button class="floating-btn" type="button" @click="locateUser">
        <img :src="locationIcon" alt="定位" />
      </button>
    </div>

    <a-drawer :open="markerDrawerVisible" :width="460" placement="right" title="商户详情" @close="handleDrawerClose">
      <a-spin :spinning="markerDrawerLoading">
        <div v-if="markerDetail" class="marker-detail">
          <div class="detail-header">
            <div>
              <div class="detail-title">{{ markerDetail.name || '未命名商户' }}</div>
              <div v-if="markerAddressText" class="detail-sub">{{ markerAddressText }}</div>
            </div>
            <span v-if="markerDetail.reviewStatus" class="detail-chip">{{ markerDetail.reviewStatus }}</span>
          </div>

          <div class="detail-grid">
            <div class="detail-row">
              <span class="detail-label">联系人</span>
              <span class="detail-value">{{ markerDetail.contactName || markerDetail.contact || '未提供' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">电话</span>
              <span class="detail-value">{{ markerDetail.phone || markerDetail.mobile || '未提供' }}</span>
            </div>
            <div v-if="markerCoordsText" class="detail-row">
              <span class="detail-label">坐标</span>
              <span class="detail-value">{{ markerCoordsText }}</span>
            </div>
            <div v-if="markerDistanceText" class="detail-row">
              <span class="detail-label">距我</span>
              <span class="detail-value">{{ markerDistanceText }}</span>
            </div>
            <div v-if="markerDetail.featureCode" class="detail-row">
              <span class="detail-label">Feature Code</span>
              <span class="detail-value">{{ markerDetail.featureCode }}</span>
            </div>
            <div v-if="markerDetail.reviewStatus" class="detail-row">
              <span class="detail-label">审核</span>
              <span class="detail-value">{{ markerDetail.reviewStatus }}</span>
            </div>
            <div v-if="markerDetail.createdAt" class="detail-row">
              <span class="detail-label">创建时间</span>
              <span class="detail-value">{{ formatDateTime(markerDetail.createdAt) }}</span>
            </div>
            <div v-if="markerDetail.updatedAt" class="detail-row">
              <span class="detail-label">更新时间</span>
              <span class="detail-value">{{ formatDateTime(markerDetail.updatedAt) }}</span>
            </div>
          </div>

          <div v-if="markerDetail.description" class="detail-section">
            <div class="detail-section-title">描述</div>
            <p class="detail-paragraph">{{ markerDetail.description }}</p>
          </div>

          <div v-if="markerDetail.industryHonorTags?.length" class="detail-section">
            <div class="detail-section-title">行业荣誉</div>
            <div class="detail-chip-list">
              <span v-for="tag in markerDetail.industryHonorTags" :key="tag" class="detail-chip">{{ tag }}</span>
            </div>
          </div>

          <div v-if="markerDetail.images?.length" class="detail-section">
            <div class="detail-section-title">图片</div>
            <div class="detail-gallery">
              <img v-for="(img, idx) in markerDetail.images" :key="img || idx" class="detail-img" :src="img"
                alt="标记图片" />
            </div>
          </div>

          <div v-if="markerDetail.businessLicense" class="detail-section">
            <div class="detail-section-title">营业执照</div>
            <img class="detail-img detail-img--single" :src="markerDetail.businessLicense" alt="营业执照" />
          </div>

          <div v-if="markerDetail.attachmentUrls?.length" class="detail-section">
            <div class="detail-section-title">附件</div>
            <ul class="detail-list">
              <li v-for="(url, idx) in markerDetail.attachmentUrls" :key="url || idx" class="detail-list-item">
                <a :href="url" target="_blank" rel="noreferrer">附件{{ idx + 1 }}</a>
              </li>
            </ul>
          </div>

          <div v-if="markerDetail.qrCodeUrls?.length" class="detail-section">
            <div class="detail-section-title">二维码</div>
            <div class="detail-gallery">
              <img v-for="(img, idx) in markerDetail.qrCodeUrls" :key="img || idx" class="detail-img detail-img--qr"
                :src="img" alt="二维码" />
            </div>
          </div>
        </div>
        <div v-else class="empty-detail">正在加载...</div>
      </a-spin>
    </a-drawer>
    <a-modal :destroy-on-close="true" :open="ordersVisible" :title="t('orders.modal.title')" width="960px"
      @cancel="closeOrdersModal">
      <template #footer>
        <a-button @click="closeOrdersModal">{{ t('orders.modal.close') }}</a-button>
      </template>

      <a-table :columns="orderColumns" :data-source="ordersTableData" :loading="ordersLoading"
        :pagination="orderPaginationConfig" class="orders-table" row-key="id" @change="handleOrdersTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="orderStatusColors[record.status] || 'default'">
              {{ statusText(record.status) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'paymentType'">
            {{ paymentTypeText(record.paymentType) }}
          </template>
          <template v-else-if="column.key === 'amount'">
            {{ formatAmount(record.amount) }}
          </template>
          <template v-else-if="column.key === 'createdAt' || column.key === 'updatedAt'">
            {{ formatDateTime(record[column.dataIndex || column.key]) }}
          </template>
          <template v-else>
            {{ record[column.dataIndex || column.key] ?? '-' }}
          </template>
        </template>
      </a-table>
    </a-modal>
  </div>
</template>

<style scoped>
.map-page {
  position: relative;
  min-height: calc(100vh - 140px);
  border-radius: 18px;
  overflow: hidden;
  background: #0c0c0f;
}

.map-canvas {
  width: 100%;
  height: 89vh;
  min-height: 720px;
  border-radius: 16px;
  background: #0c0c0f;
  position: relative;
  z-index: 1;
  box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5);
}

.map-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a0a0a0;
  font-size: 16px;
  background: linear-gradient(135deg, #0f1015 0%, #111726 100%);
}

.map-center-pin {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 32px;
  height: 32px;
  transform: translate(-50%, -100%);
  z-index: 12;
  pointer-events: none;
  user-select: none;
}

.map-center-pin img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  filter: brightness(0);
  opacity: 0.92;
  transition: opacity 0.2s ease;
}

.map-center-pin:not(.is-ready) img {
  opacity: 0.4;
}

.map-scale {
  position: absolute;
  left: 18px;
  bottom: 18px;
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(12, 18, 32, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.16);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(10px);
  color: #eef2ff;
  z-index: 9;
  pointer-events: none;
}

.map-scale-label {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.2px;
  white-space: nowrap;
  color: #dfe7f4;
}

.map-scale-track {
  position: relative;
  height: 12px;
  min-width: 60px;
}

.map-scale-line {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #8dd3ff 0%, #4a9dff 100%);
  border-radius: 999px;
  transform: translateY(-50%);
}

.map-scale-tick {
  position: absolute;
  top: 50%;
  width: 2px;
  height: 14px;
  background: #e5edf9;
  border-radius: 2px;
  transform: translateY(-50%);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0);
}

.map-scale-tick-start {
  left: 0;
}

.map-scale-tick-end {
  right: 0;
}

.map-overlays {
  position: absolute;
  top: 14px;
  left: 12px;
  width: 260px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  z-index: 7;
  pointer-events: none;
}

.map-overlays>* {
  pointer-events: auto;
}

.dashboard-card {
  position: relative;
  width: 100%;
  padding: 12px 12px 8px;
  color: #f7fbff;
  user-select: none;
}

.dashboard-card::before {
  content: '';
  position: absolute;
  inset: 0;
  right: -120px;
  border-radius: 20px 0 0 20px;
  background: rgba(12, 18, 32, 0.58);
  border: 1px solid rgba(255, 255, 255, 0.12);

  clip-path: polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%);
  z-index: -1;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.card-title {
  font-size: 11px;
  font-weight: 700;
}

.card-subtitle {
  font-size: 8px;
  color: #a8b5c7;
  margin-top: 1px;
  opacity: 0.92;
}

.drone-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.picker-label {
  color: #cfd6e0;
  font-size: 8px;
}

.picker-select {
  min-width: 120px;
}

.status-row {
  display: flex;
  align-items: center;
  margin-top: 6px;
}

.status-label {
  width: 80px;
  color: #c8d3e1;
  font-size: 8px;
}

.status-value {
  font-size: 9px;
  font-weight: 700;
}

.status-extra {
  margin-top: 3px;
  color: #dfe7f4;
  font-size: 8px;
  line-height: 1.4;
}

.tone-safe {
  color: #35c759;
}

.tone-warn {
  color: #f6c344;
}

.tone-alert {
  color: #ff6b6b;
}

.tone-neutral {
  color: #cfd6e0;
}

.status-hint {
  margin-top: 3px;
  font-size: 8px;
  color: rgba(255, 255, 255, 0.75);
}

.search-box {
  margin-top: 8px;
}

.search-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 3px 3px 9px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.78);
  background: rgba(0, 0, 0, 0.26);
  box-shadow: inset 0 6px 16px rgba(0, 0, 0, 0.3);
}

.search-input {
  flex: 1;
  min-width: 0;
  padding: 6px 2px;
  border-radius: 999px;
  border: none;
  background: transparent;
  color: #f8fbff;
  font-size: 8px;
}

.search-input:focus {
  outline: none;
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.85);
}

.search-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid rgba(255, 255, 255, 0.85);
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.28);
  transition: transform 0.12s ease, background-color 0.12s ease;
}

.search-btn img {
  width: 10px;
  height: 10px;
  filter: brightness(0) invert(1);
}

.search-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
  transform: none;
}

.search-btn:not(:disabled):hover {
  background: rgba(255, 255, 255, 0.16);
}

.search-btn:not(:disabled):active {
  transform: scale(0.94);
}

.search-results {
  margin-top: 8px;
  max-height: 150px;
  overflow-y: auto;
  border-radius: 14px;
  background: rgba(7, 10, 18, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 16px 32px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(12px);
  padding: 4px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.35) transparent;
}

.search-result-item {
  padding: 6px 8px;
  cursor: pointer;
  border-radius: 10px;
  transition: background-color 0.15s ease, transform 0.1s ease;
}

.search-result-item+.search-result-item {
  margin-top: 6px;
}

.search-result-item:hover {
  background: rgba(255, 255, 255, 0.06);
  transform: translateX(2px);
}

.search-result-item--marker .result-title {
  color: #16a34a;
}

.search-result-item--marker .result-tag {
  color: #16a34a;
  font-weight: 700;
}

.summary-board {
  content: '';
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  position: relative;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.36);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(10px);
}

.summary-board--standalone {
  width: 100%;
  margin-top: 0;
}

.summary-board {
  user-select: none;
}

.board-item {
  padding: 6px 9px 8px;
  background: transparent;
  border: none;
  color: #f8fbff;
  width: 100%;
  height: 100%;
  text-align: left;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  cursor: pointer;
  transition: background-color 0.18s ease, transform 0.18s ease;
}

.board-item:hover {
  background: rgba(255, 255, 255, 0.06);
}

.board-item:focus-visible {
  outline: 2px solid #4f8bfd;
}

.board-label {
  font-size: 7px;
  letter-spacing: 0.2px;
}

.board-value {
  font-size: 14px;
  font-weight: 800;
  line-height: 1;
}

/* Allow selection inside controls even when parent disables selection */
.dashboard-card input,
.dashboard-card textarea,
.dashboard-card select,
.dashboard-card button {
  user-select: text;
}

.board-divider {
  position: absolute;
  left: 50%;
  top: 8px;
  bottom: 8px;
  width: 1px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.2) 0%, rgba(255, 255, 255, 0.72) 50%, rgba(255, 255, 255, 0.2) 100%);
  transform: skew(-10deg);
  pointer-events: none;
}

.search-result-item {
  padding: 6px 8px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.search-result-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

.result-title {
  color: #f8fafc;
  font-weight: 600;
  font-size: 11px;
}

.result-address {
  color: #a5acba;
  font-size: 9px;
  margin-top: 2px;
}

.map-actions {
  position: absolute;
  bottom: 260px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 8;
  pointer-events: none;
}

.floating-btn {
  width: 50px;
  height: 50px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  cursor: pointer;
  transition: transform 0.14s ease, box-shadow 0.14s ease;
}

.floating-btn img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  filter: brightness(0) saturate(100%);
}

.floating-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.32);
}

.floating-btn:active {
  transform: scale(0.96);
}

.marker-detail {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.detail-title {
  font-size: 20px;
  font-weight: 700;
}

.detail-sub {
  margin-top: 4px;
  color: #4b5563;
  font-size: 13px;
}

.detail-chip {
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 10px;
  background: #eef2ff;
  color: #1d4ed8;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid rgba(29, 78, 216, 0.2);
}

.detail-row {
  display: flex;
  gap: 8px;
  align-items: center;
  color: #1f2937;
  padding: 6px 0;
}

.detail-label {
  width: 90px;
  color: #6b7280;
  font-weight: 600;
  font-size: 12px;
}

.detail-value {
  flex: 1;
  color: #111;
  font-size: 13px;
  line-height: 1.5;
}

.detail-grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f7f9fc;
  border: 1px solid #e5e7eb;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-section-title {
  font-weight: 700;
  font-size: 13px;
  color: #111827;
}

.detail-paragraph {
  margin: 0;
  color: #374151;
  font-size: 13px;
  line-height: 1.6;
}

.detail-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 10px;
}

.detail-img {
  width: 100%;
  border-radius: 10px;
  object-fit: cover;
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
}

.detail-img--single {
  max-height: 220px;
  object-fit: contain;
}

.detail-img--qr {
  background: #fff;
  padding: 10px;
  object-fit: contain;
}

.detail-list {
  margin: 0;
  padding-left: 16px;
  color: #1f2937;
  font-size: 13px;
  line-height: 1.5;
}

.detail-list-item a {
  color: #1d4ed8;
}

.empty-detail {
  color: #888;
  text-align: center;
  padding: 20px 0;
}

.orders-table {
  margin-top: 8px;
}

@media (max-width: 1100px) {
  .map-overlays {
    width: calc(100% - 32px);
    left: 12px;
  }

  .dashboard-card {
    top: 0;
  }

  .map-actions {
    top: 220px;
    right: 14px;
  }
}
</style>
