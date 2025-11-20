<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import locationIcon from '../../assets/img/location.png'
import { fetchNearbyMarkers, fetchMarkerDetail, fetchNearbyNoFlyZones } from '../../services/airspaceMap'
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
const DRONE_ICON_PATH = '/assets/img/drone.png'

const mapContainer = ref(null)
const mapInstance = ref(null)
const mapReady = ref(false)
const mapListeners = []

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
    const { latitude, longitude } = marker.location
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return
    const overlay = new window.qq.maps.Marker({
      map: mapInstance.value,
      position: new window.qq.maps.LatLng(latitude, longitude),
      title: marker.name || '商户',
      icon: markerImage,
      zIndex: 5,
    })
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
  const center = getCurrentCenter()
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
  const center = getCurrentCenter()
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
  const center = getCurrentCenter()
  if (!center) return fallback
  const wgs = gcj02ToWgs84(center.longitude, center.latitude)
  if (!wgs) return fallback
  const hits = []
  const visitArea = (area, parent, polygonOnly) => {
    if (!area) return
    if (Array.isArray(area.sub_areas) && area.sub_areas.length) {
      area.sub_areas.forEach((sub) => visitArea(sub, area, true))
      return
    }
    if (areaContainsWgsPoint(area, wgs.lng, wgs.lat, { polygonOnly })) {
      hits.push({ area, parent })
    }
  }
  areas.forEach((area) => visitArea(area, null, false))
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

const loadNearbyMarkers = async (center, radiusKm) => {
  try {
    const markers = await fetchNearbyMarkers({
      latitude: center.latitude,
      longitude: center.longitude,
      radiusInKilometers: radiusKm,
    })
    const normalized = markers.map((item) => ({
      id: item.id,
      name: item.name || '未命名商户',
      address: item.address || item.detailAddress || '',
      contact: item.contactName || item.contact || '',
      phone: item.phone || item.mobile || '',
      location: { latitude: Number(item.latitude ?? item.lat), longitude: Number(item.longitude ?? item.lng) },
    }))
    renderMarkers(normalized)
  } catch (error) {
    console.error('加载商户失败', error)
    message.error('加载附近商户失败')
  }
}

const loadNoFlyZones = async (center, radiusKm) => {
  try {
    const wgs = gcj02ToWgs84(center.longitude, center.latitude)
    const zones = await fetchNearbyNoFlyZones({
      latitude: Number.isFinite(wgs?.lat) ? wgs.lat : center.latitude,
      longitude: Number.isFinite(wgs?.lng) ? wgs.lng : center.longitude,
      radiusInKilometers: radiusKm,
    })
    const graphics = buildNoFlyZoneGraphics(zones)
    noFlyZoneShapes.value = graphics.shapes || []
    noFlyZonesReady.value = true
    noFlyZonesError.value = false
    renderNoFlyOverlays(graphics.polygons || [], graphics.circles || [])
  } catch (error) {
    console.error('加载临时禁飞区失败', error)
    noFlyZonesReady.value = true
    noFlyZonesError.value = true
    noFlyZoneShapes.value = []
    clearOverlays(nfzCircleOverlays)
    clearOverlays(nfzPolygonOverlays)
  } finally {
    updateStatusPanel()
  }
}

const loadDjiAreas = async (center, radiusMeters, region) => {
  try {
    const rect = buildBoundsRect(region, center, radiusMeters)
    const wgsRect = gcjRectToWgs(rect)
    if (!wgsRect) throw new Error('坐标转换失败')
    const areas = await fetchDjiAreas({ rect: wgsRect, levels: '2,6,1,4,3,7,8,10', drone: selectedDrone.value?.slug })
    lastDjiAreas.value = areas
    const graphics = buildAreaGraphics(areas)
    renderDjiOverlays(graphics.polygons || [], graphics.circles || [])
  } catch (error) {
    console.error('DJI 空域加载失败', error)
    lastDjiAreas.value = null
    clearOverlays(djiPolygonOverlays)
    clearOverlays(djiCircleOverlays)
  } finally {
    updateStatusPanel()
  }
}

const refreshUom = (center, zoom, region) => {
  const tiles = buildWmsOverlay(center, Math.round(zoom), region)
  currentWmsTiles.value = tiles
  renderUomOverlays(tiles)
  tiles.forEach((tile) => ensureUomMask(tile))
  updateStatusPanel()
}

const refreshData = (force = false) => {
  if (!mapInstance.value || !mapReady.value) return
  if (refreshTimer) {
    clearTimeout(refreshTimer)
    refreshTimer = null
  }
  const center = getCurrentCenter()
  const bounds = getCurrentBounds()
  const radiusMeters = clampRadius(estimateVisibleRadiusMeters())
  const radiusKm = Math.max(0.5, Math.round((radiusMeters / 1000) * 10) / 10)
  const zoom = typeof mapInstance.value.getZoom === 'function' ? mapInstance.value.getZoom() : DEFAULT_MAP_ZOOM

  loadNearbyMarkers(center, radiusKm)
  loadNoFlyZones(center, radiusKm)
  loadDjiAreas(center, radiusMeters, bounds)
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
  refreshTimer = setTimeout(() => refreshData(), 300)
}

const initializeMap = () => {
  if (!window.qq?.maps || !mapContainer.value) return false
  mapInstance.value = new window.qq.maps.Map(mapContainer.value, {
    center: new window.qq.maps.LatLng(DEFAULT_CENTER.latitude, DEFAULT_CENTER.longitude),
    zoom: DEFAULT_MAP_ZOOM,
    mapTypeControl: false,
    zoomControl: true,
  })
  mapReady.value = true
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
      markerDetail.value = detail || marker
    })
    .catch((error) => {
      console.error('加载商户详情失败', error)
      markerDetail.value = marker
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
    const results = await searchPlaces(keyword, center)
    searchResults.value = results
  } catch (error) {
    console.error('搜索失败', error)
    message.error('搜索失败，请稍后重试')
  } finally {
    searchLoading.value = false
  }
}

const applySearchResult = (item) => {
  if (!item?.location || !mapInstance.value) return
  mapInstance.value.setCenter(new window.qq.maps.LatLng(item.location.latitude, item.location.longitude))
  mapInstance.value.setZoom(15)
  searchResults.value = []
  searchKeyword.value = item.title
  refreshData(true)
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
    .catch(() => {})
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
      <div v-if="!mapReady" class="map-placeholder">地图加载中...</div>
    </div>

    <div class="dashboard-card">
      <div class="card-header">
        <div>
          <div class="card-title">飞前安全准备</div>
          <div class="card-subtitle">与小程序同步的飞行前检查面板</div>
        </div>
        <div class="drone-picker">
          <span class="picker-label">执飞机型：</span>
          <a-select
            v-model:value="selectedDroneIndex"
            class="picker-select"
            size="small"
            :options="DRONES.map((item, index) => ({ label: item.name, value: index }))"
            @change="refreshData(true)"
          />
        </div>
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
        <span :class="['status-value', toneClass(statusPanel.djiTone)]" :style="{ color: statusPanel.djiColor || undefined }">
          {{ statusPanel.djiStatus }}
        </span>
      </div>
      <div v-if="statusPanel.djiStatusExtra" class="status-extra">{{ statusPanel.djiStatusExtra }}</div>

      <div class="search-box">
        <input
          v-model="searchKeyword"
          class="search-input"
          type="text"
          placeholder="搜索位置或商户"
          @keyup.enter="submitSearch"
        />
        <a-button type="primary" size="small" :loading="searchLoading" @click="submitSearch">搜索</a-button>
      </div>
      <div v-if="searchResults.length" class="search-results">
        <div
          v-for="item in searchResults"
          :key="item.id"
          class="search-result-item"
          @click="applySearchResult(item)"
        >
          <div class="result-title">{{ item.title }}</div>
          <div class="result-address">{{ item.address }}</div>
        </div>
      </div>

      <div class="summary-cards">
        <button class="summary-card" type="button" @click="goToPendingMarkers">
          <span class="summary-value">{{ pendingLoading ? '...' : pendingCount }}</span>
          <span class="summary-label">
            {{ t('dashboard.pending') }}
            <span aria-hidden="true"> ></span>
          </span>
        </button>
        <button class="summary-card" type="button" @click="openOrdersModal">
          <span class="summary-value">{{ orderSummaryLoading ? '...' : orderCount }}</span>
          <span class="summary-label">
            {{ t('orders.summary.title') }}
            <span aria-hidden="true"> ></span>
          </span>
        </button>
      </div>
    </div>

    <div class="map-actions">
      <button class="floating-btn" type="button" @click="locateUser">
        <img :src="locationIcon" alt="定位" />
      </button>
    </div>

    <a-drawer
      :open="markerDrawerVisible"
      :width="420"
      placement="right"
      title="商户详情"
      @close="handleDrawerClose"
    >
      <a-spin :spinning="markerDrawerLoading">
        <div v-if="markerDetail" class="marker-detail">
          <div class="detail-title">{{ markerDetail.name || '未命名商户' }}</div>
          <div class="detail-row">
            <span class="detail-label">地址：</span>
            <span class="detail-value">{{ markerDetail.address || markerDetail.detailAddress || '暂无地址' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">联系人：</span>
            <span class="detail-value">{{ markerDetail.contactName || markerDetail.contact || '未提供' }}</span>
          </div>
          <div class="detail-row">
            <span class="detail-label">电话：</span>
            <span class="detail-value">{{ markerDetail.phone || markerDetail.mobile || '未提供' }}</span>
          </div>
        </div>
        <div v-else class="empty-detail">暂无详情</div>
      </a-spin>
    </a-drawer>

    <a-modal
      :destroy-on-close="true"
      :open="ordersVisible"
      :title="t('orders.modal.title')"
      width="960px"
      @cancel="closeOrdersModal"
    >
      <template #footer>
        <a-button @click="closeOrdersModal">{{ t('orders.modal.close') }}</a-button>
      </template>

      <a-table
        :columns="orderColumns"
        :data-source="ordersTableData"
        :loading="ordersLoading"
        :pagination="orderPaginationConfig"
        class="orders-table"
        row-key="id"
        @change="handleOrdersTableChange"
      >
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
  min-height: calc(100vh - 200px);
  border-radius: 16px;
  overflow: hidden;
  background: #0c0c0f;
}

.map-canvas {
  width: 100%;
  height: 78vh;
  min-height: 640px;
  border-radius: 12px;
  background: #0c0c0f;
  position: relative;
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

.dashboard-card {
  position: absolute;
  top: 18px;
  left: 18px;
  width: 420px;
  background: rgba(18, 20, 28, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45);
  border-radius: 16px;
  padding: 18px 20px;
  color: #f4f6f8;
  backdrop-filter: blur(12px);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.card-title {
  font-size: 20px;
  font-weight: 700;
}

.card-subtitle {
  font-size: 12px;
  color: #9aa1ad;
  margin-top: 4px;
}

.drone-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.picker-label {
  color: #cfd6e0;
  font-size: 12px;
}

.picker-select {
  min-width: 200px;
}

.status-row {
  display: flex;
  align-items: center;
  margin-top: 8px;
}

.status-label {
  width: 120px;
  color: #a8b0be;
  font-size: 13px;
}

.status-value {
  font-size: 14px;
  font-weight: 600;
}

.status-extra {
  margin-top: 6px;
  color: #cdd5e3;
  font-size: 12px;
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

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 14px;
}

.search-input {
  flex: 1;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.06);
  color: #f4f6f8;
}

.search-input::placeholder {
  color: #9aa1ad;
}

.search-results {
  margin-top: 10px;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.35);
}

.summary-cards {
  margin-top: 16px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.summary-card {
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.35);
  border-radius: 12px;
  padding: 12px 14px;
  color: #e7ebf3;
  display: flex;
  flex-direction: column;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.summary-card:hover {
  border-color: rgba(255, 255, 255, 0.18);
  transform: translateY(-1px);
}

.summary-card:focus-visible {
  outline: 2px solid #4f8bfd;
}

.summary-value {
  font-size: 32px;
  font-weight: 700;
}

.summary-label {
  font-size: 14px;
  color: #aab3c4;
  display: flex;
  align-items: center;
  gap: 4px;
}

.search-result-item {
  padding: 10px 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.search-result-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.result-title {
  color: #f8fafc;
  font-weight: 600;
}

.result-address {
  color: #a5acba;
  font-size: 12px;
  margin-top: 4px;
}

.map-actions {
  position: absolute;
  right: 18px;
  bottom: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.floating-btn {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.floating-btn img {
  width: 26px;
  height: 26px;
  object-fit: contain;
}

.marker-detail {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.detail-title {
  font-size: 18px;
  font-weight: 700;
}

.detail-row {
  display: flex;
  gap: 8px;
  color: #444;
}

.detail-label {
  width: 64px;
  color: #6b7280;
}

.detail-value {
  flex: 1;
  color: #111;
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
  .dashboard-card {
    width: calc(100% - 36px);
    left: 12px;
    right: 12px;
  }
}
</style>
