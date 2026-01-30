<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'

const props = defineProps({
  map: { type: Object, default: null },
  mapReady: { type: Boolean, default: false },
  mapContainer: { type: Object, default: null },
  disabled: { type: Boolean, default: false },
})

const { t } = useI18n()

const fileInput = ref(null)
const overlayUrl = ref('')
const overlayOpacity = ref(0.6)
const penetrateMap = ref(false)
const placingMode = ref(false)
const overlayCenter = ref(null)
const overlayScale = ref(0.6)
const overlayWidthMeters = ref(null)
const overlayAspectRatio = ref(1)
const overlayEl = ref(null)
const mapListeners = ref([])
const placingListener = ref(null)
const resizeListener = ref(null)
const pasteListener = ref(null)

const canUseMap = computed(() => props.mapReady && !!props.map)
const hasImage = computed(() => !!overlayUrl.value)
const overlayScalePercent = computed(() => Math.round(Number(overlayScale.value || 0) * 100))
const scaleSyncing = ref(false)

const SCALE_MIN = 0.1
const SCALE_MAX = 1

const clampScale = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return SCALE_MIN
  return Math.min(SCALE_MAX, Math.max(SCALE_MIN, num))
}

const normalizeLatLng = (point) => {
  if (!point) return null
  if (typeof point.getLat === 'function' && typeof point.getLng === 'function') {
    return { lat: Number(point.getLat()), lng: Number(point.getLng()) }
  }
  const lat = Number(point.lat ?? point.latitude)
  const lng = Number(point.lng ?? point.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

const ensureOverlayElement = () => {
  if (!props.mapContainer || overlayEl.value) return
  const img = document.createElement('img')
  img.className = 'map-image-overlay'
  img.alt = 'overlay'
  img.draggable = false
  img.style.position = 'absolute'
  img.style.left = '0px'
  img.style.top = '0px'
  img.style.transform = 'translate(-50%, -50%)'
  img.style.zIndex = '1'
  img.style.userSelect = 'none'
  img.style.display = 'none'
  if (overlayUrl.value) {
    img.src = overlayUrl.value
  }
  props.mapContainer.appendChild(img)
  overlayEl.value = img
  updateOverlayStyle()
}

const removeOverlayElement = () => {
  if (overlayEl.value && overlayEl.value.parentNode) {
    overlayEl.value.parentNode.removeChild(overlayEl.value)
  }
  overlayEl.value = null
}

const getProjection = () => {
  if (!props.map || typeof props.map.getProjection !== 'function') return null
  const projection = props.map.getProjection()
  if (!projection || typeof projection.fromLatLngToPoint !== 'function') return null
  if (typeof projection.fromPointToLatLng !== 'function') return null
  return projection
}

const metersPerPixelAtLatitude = (latitude, zoom) => {
  const lat = Number(latitude)
  const level = Number(zoom)
  if (!Number.isFinite(lat) || !Number.isFinite(level)) return null
  const latRad = (lat * Math.PI) / 180
  const scale = Math.pow(2, level)
  if (!Number.isFinite(scale) || scale <= 0) return null
  return (Math.cos(latRad) * 2 * Math.PI * 6378137) / (256 * scale)
}

const getMapWidthMeters = () => {
  if (!props.map || !props.mapContainer) return null
  const rect = props.mapContainer.getBoundingClientRect?.()
  if (!rect) return null
  const center = normalizeLatLng(props.map.getCenter?.())
  if (!center) return null
  const zoom = props.map.getZoom?.()
  const metersPerPixel = metersPerPixelAtLatitude(center.lat, zoom)
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return null
  return rect.width * metersPerPixel
}

const latLngToPixel = (latLng) => {
  if (!props.map || !props.mapContainer) return null
  if (!window.qq?.maps?.LatLng) return null
  const projection = getProjection()
  if (!projection) return null
  const center = normalizeLatLng(props.map.getCenter?.())
  if (!center) return null
  const zoom = props.map.getZoom?.()
  if (!Number.isFinite(zoom)) return null
  const centerPoint = projection.fromLatLngToPoint(new window.qq.maps.LatLng(center.lat, center.lng))
  const targetPoint = projection.fromLatLngToPoint(new window.qq.maps.LatLng(latLng.lat, latLng.lng))
  if (!centerPoint || !targetPoint) return null
  const scale = Math.pow(2, zoom)
  const rect = props.mapContainer.getBoundingClientRect()
  const x = (targetPoint.x - centerPoint.x) * scale + rect.width / 2
  const y = (targetPoint.y - centerPoint.y) * scale + rect.height / 2
  return { x, y }
}

const pixelToLatLng = (pixel) => {
  if (!props.map || !props.mapContainer) return null
  if (!window.qq?.maps?.LatLng) return null
  const projection = getProjection()
  if (!projection) return null
  const center = normalizeLatLng(props.map.getCenter?.())
  if (!center) return null
  const zoom = props.map.getZoom?.()
  if (!Number.isFinite(zoom)) return null
  const rect = props.mapContainer.getBoundingClientRect()
  const centerPoint = projection.fromLatLngToPoint(new window.qq.maps.LatLng(center.lat, center.lng))
  const scale = Math.pow(2, zoom)
  const worldPointRaw = {
    x: centerPoint.x + (pixel.x - rect.width / 2) / scale,
    y: centerPoint.y + (pixel.y - rect.height / 2) / scale,
  }
  const worldPoint = window.qq?.maps?.Point
    ? new window.qq.maps.Point(worldPointRaw.x, worldPointRaw.y)
    : worldPointRaw
  const latLng = projection.fromPointToLatLng(worldPoint)
  return normalizeLatLng(latLng)
}

const updateOverlayStyle = () => {
  if (!overlayEl.value) return
  overlayEl.value.style.opacity = `${overlayOpacity.value}`
  overlayEl.value.style.pointerEvents = penetrateMap.value ? 'none' : 'auto'
  overlayEl.value.style.cursor = penetrateMap.value ? 'default' : 'grab'
}

const updateOverlayLayout = () => {
  if (!overlayEl.value || !overlayUrl.value) return
  const center = overlayCenter.value || normalizeLatLng(props.map?.getCenter?.())
  if (!center) return
  const pixel = latLngToPixel(center)
  if (!pixel) return
  const rect = props.mapContainer?.getBoundingClientRect?.()
  if (!rect) return
  let widthPx = null
  if (penetrateMap.value) {
    const zoom = props.map?.getZoom?.()
    const metersPerPixel = metersPerPixelAtLatitude(center.lat, zoom)
    if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return
    const widthMeters = Number(overlayWidthMeters.value)
    if (!Number.isFinite(widthMeters) || widthMeters <= 0) return
    widthPx = widthMeters / metersPerPixel
  } else {
    const scale = clampScale(overlayScale.value)
    widthPx = rect.width * Math.min(scale, 1)
  }
  if (!Number.isFinite(widthPx) || widthPx <= 0) return
  const heightPx = widthPx * overlayAspectRatio.value
  overlayEl.value.style.width = `${Math.max(widthPx, 12).toFixed(2)}px`
  overlayEl.value.style.height = `${Math.max(heightPx, 12).toFixed(2)}px`
  overlayEl.value.style.left = `${pixel.x.toFixed(2)}px`
  overlayEl.value.style.top = `${pixel.y.toFixed(2)}px`
  overlayEl.value.style.display = 'block'
}

const refreshOverlay = () => {
  updateOverlayStyle()
  updateOverlayLayout()
}

const attachMapListeners = () => {
  if (!canUseMap.value || !window.qq?.maps?.event) return
  detachMapListeners()
  const tokens = []
  tokens.push(window.qq.maps.event.addListener(props.map, 'bounds_changed', refreshOverlay))
  tokens.push(window.qq.maps.event.addListener(props.map, 'zoom_changed', refreshOverlay))
  tokens.push(window.qq.maps.event.addListener(props.map, 'center_changed', refreshOverlay))
  mapListeners.value = tokens
}

const detachMapListeners = () => {
  if (Array.isArray(mapListeners.value)) {
    mapListeners.value.forEach((token) => {
      try {
        window.qq?.maps?.event?.removeListener?.(token)
      } catch (_) { }
    })
  }
  mapListeners.value = []
}

const stopPlacingMode = () => {
  placingMode.value = false
  if (placingListener.value) {
    try {
      window.qq?.maps?.event?.removeListener?.(placingListener.value)
    } catch (_) { }
    placingListener.value = null
  }
}

const startPlacingMode = () => {
  if (!canUseMap.value || props.disabled) return
  if (!window.qq?.maps?.event) return
  stopPlacingMode()
  placingMode.value = true
  placingListener.value = window.qq.maps.event.addListener(props.map, 'click', (event) => {
    if (!event?.latLng) return
    const point = normalizeLatLng(event.latLng)
    if (!point) return
    overlayCenter.value = point
    stopPlacingMode()
    refreshOverlay()
  })
}

const placeOnCenter = () => {
  if (!canUseMap.value) return
  const center = normalizeLatLng(props.map.getCenter?.())
  if (!center) return
  overlayCenter.value = center
  refreshOverlay()
}

const handleFilePicked = (file) => {
  if (!file) return
  if (!/^image\/(png|jpeg|jpg)$/i.test(file.type)) {
    message.error(t('noFlyZone.imageOverlay.uploadError'))
    return
  }
  if (file.size / 1024 / 1024 > 5) {
    message.error(t('noFlyZone.imageOverlay.uploadError'))
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    overlayUrl.value = String(reader.result || '')
  }
  reader.readAsDataURL(file)
}

const handleFileChange = (event) => {
  const file = event?.target?.files?.[0]
  handleFilePicked(file)
  if (event?.target) event.target.value = ''
}

const triggerFilePicker = () => {
  if (props.disabled) return
  fileInput.value?.click()
}

const clearImage = () => {
  overlayUrl.value = ''
  overlayAspectRatio.value = 1
  overlayWidthMeters.value = null
  if (overlayEl.value) overlayEl.value.style.display = 'none'
}

const syncMetersFromScale = () => {
  const mapWidth = getMapWidthMeters()
  if (!Number.isFinite(mapWidth) || mapWidth <= 0) return
  overlayWidthMeters.value = mapWidth * clampScale(overlayScale.value)
}

const syncScaleFromMeters = () => {
  const mapWidth = getMapWidthMeters()
  const widthMeters = Number(overlayWidthMeters.value)
  if (!Number.isFinite(mapWidth) || mapWidth <= 0) return
  if (!Number.isFinite(widthMeters) || widthMeters <= 0) return
  scaleSyncing.value = true
  overlayScale.value = clampScale(widthMeters / mapWidth)
  scaleSyncing.value = false
}

const adjustScale = (delta) => {
  const next = clampScale(Number(overlayScale.value) + delta)
  if (next === overlayScale.value) return
  overlayScale.value = next
  if (penetrateMap.value) {
    syncMetersFromScale()
  }
  refreshOverlay()
}

const handlePaste = (event) => {
  if (props.disabled) return
  const items = event?.clipboardData?.items
  if (!items || !items.length) return
  const imageItem = Array.from(items).find((item) => item.type && item.type.startsWith('image/'))
  if (!imageItem) return
  const file = imageItem.getAsFile()
  if (file) {
    handleFilePicked(file)
    event.preventDefault?.()
  }
}

const initImageMeta = (url) => {
  if (!url) return
  const img = new Image()
  img.onload = () => {
    if (img.naturalWidth && img.naturalHeight) {
      overlayAspectRatio.value = img.naturalHeight / img.naturalWidth
    } else {
      overlayAspectRatio.value = 1
    }
    if (!overlayCenter.value && canUseMap.value) {
      overlayCenter.value = normalizeLatLng(props.map.getCenter?.())
    }
    if (penetrateMap.value && !overlayWidthMeters.value) {
      syncMetersFromScale()
    }
    ensureOverlayElement()
    if (overlayEl.value) overlayEl.value.src = url
    refreshOverlay()
  }
  img.src = url
}

const startDrag = (event) => {
  if (penetrateMap.value || props.disabled || !overlayEl.value) return
  event.preventDefault()
  event.stopPropagation()
  const rect = props.mapContainer?.getBoundingClientRect?.()
  if (!rect) return
  const start = { x: event.clientX - rect.left, y: event.clientY - rect.top }
  const origin = overlayCenter.value || normalizeLatLng(props.map?.getCenter?.())
  if (!origin) return
  const originPixel = latLngToPixel(origin)
  if (!originPixel) return
  const onMove = (moveEvent) => {
    const current = { x: moveEvent.clientX - rect.left, y: moveEvent.clientY - rect.top }
    const nextPixel = {
      x: originPixel.x + (current.x - start.x),
      y: originPixel.y + (current.y - start.y),
    }
    const nextCenter = pixelToLatLng(nextPixel)
    if (!nextCenter) return
    overlayCenter.value = nextCenter
    updateOverlayLayout()
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

watch(
  () => props.mapReady,
  (ready) => {
    if (ready) {
      ensureOverlayElement()
      attachMapListeners()
      if (penetrateMap.value && !overlayWidthMeters.value) {
        syncMetersFromScale()
      }
      refreshOverlay()
    } else {
      detachMapListeners()
    }
  },
)

watch(
  () => overlayUrl.value,
  (url) => {
    if (!url) {
      clearImage()
      return
    }
    initImageMeta(url)
  },
)

watch([overlayOpacity, penetrateMap, overlayScale], () => {
  updateOverlayStyle()
  updateOverlayLayout()
})

watch(
  () => penetrateMap.value,
  (next) => {
    if (next) {
      syncMetersFromScale()
    } else {
      syncScaleFromMeters()
    }
    refreshOverlay()
  },
)

watch(
  () => overlayScale.value,
  () => {
    if (scaleSyncing.value) return
    if (penetrateMap.value) {
      syncMetersFromScale()
    }
  },
)

watch(
  () => props.mapContainer,
  () => {
    removeOverlayElement()
    ensureOverlayElement()
    refreshOverlay()
  },
)

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) stopPlacingMode()
  },
)

watch(
  () => overlayEl.value,
  (el, prev) => {
    if (prev) {
      prev.removeEventListener('mousedown', startDrag)
    }
    if (el) {
      el.addEventListener('mousedown', startDrag)
    }
  },
)

onBeforeUnmount(() => {
  stopPlacingMode()
  detachMapListeners()
  if (resizeListener.value) {
    window.removeEventListener('resize', resizeListener.value)
    resizeListener.value = null
  }
  if (pasteListener.value) {
    window.removeEventListener('paste', pasteListener.value)
    pasteListener.value = null
  }
  removeOverlayElement()
})

onMounted(() => {
  resizeListener.value = () => refreshOverlay()
  window.addEventListener('resize', resizeListener.value)
  pasteListener.value = (event) => handlePaste(event)
  window.addEventListener('paste', pasteListener.value)
})
</script>

<template>
  <div class="image-overlay-panel">
    <div class="overlay-header">
      <h4>{{ t('noFlyZone.imageOverlay.title') }}</h4>
      <span v-if="placingMode" class="placing-hint">
        {{ t('noFlyZone.imageOverlay.placingHint') }}
      </span>
    </div>

    <div class="overlay-controls">
      <div class="overlay-actions">
        <a-button type="dashed" size="small" :disabled="disabled" @click="triggerFilePicker">
          {{ hasImage ? t('noFlyZone.imageOverlay.replace') : t('noFlyZone.imageOverlay.upload') }}
        </a-button>
        <a-button size="small" :disabled="!hasImage" @click="clearImage">
          {{ t('noFlyZone.imageOverlay.remove') }}
        </a-button>
        <input
          ref="fileInput"
          class="hidden-input"
          type="file"
          accept="image/png,image/jpeg"
          hidden
          style="display: none;"
          @change="handleFileChange"
        />
      </div>

      <div class="overlay-row">
        <span class="overlay-label">{{ t('noFlyZone.imageOverlay.opacity') }}</span>
        <a-slider
          v-model:value="overlayOpacity"
          :min="0"
          :max="1"
          :step="0.05"
          :disabled="!hasImage"
        />
      </div>

      <div class="overlay-row">
        <span class="overlay-label">{{ t('noFlyZone.imageOverlay.scale') }}</span>
        <div class="overlay-scale-controls">
          <a-button size="small" :disabled="!hasImage" @click="adjustScale(-0.001)">
            -
          </a-button>
          <a-slider
            v-model:value="overlayScale"
            :min="0.1"
            :max="1"
            :step="0.001"
            :disabled="!hasImage"
          />
          <a-button size="small" :disabled="!hasImage" @click="adjustScale(0.001)">
            +
          </a-button>
        </div>
        <span class="overlay-unit">{{ overlayScalePercent }}%</span>
      </div>

      <div class="overlay-row overlay-row--toggle">
        <span class="overlay-label">{{ t('noFlyZone.imageOverlay.penetrate') }}</span>
        <a-switch v-model:checked="penetrateMap" :disabled="!hasImage" />
      </div>

      <div class="overlay-actions">
        <a-button size="small" :disabled="!hasImage || disabled || !canUseMap" @click="startPlacingMode">
          {{ t('noFlyZone.imageOverlay.place') }}
        </a-button>
        <a-button size="small" :disabled="!hasImage || !canUseMap" @click="placeOnCenter">
          {{ t('noFlyZone.imageOverlay.placeCenter') }}
        </a-button>
      </div>
    </div>

    <p class="overlay-hint">{{ t('noFlyZone.imageOverlay.uploadHint') }}</p>
  </div>
</template>

<style scoped>
.image-overlay-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: 12px;
  border: 1px dashed rgba(148, 163, 184, 0.6);
  background: rgba(248, 250, 252, 0.75);
}

.overlay-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.overlay-header h4 {
  margin: 0;
  font-size: 14px;
  color: #0f172a;
}

.placing-hint {
  font-size: 12px;
  color: #2563eb;
}

.overlay-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.overlay-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.overlay-row {
  display: grid;
  grid-template-columns: 72px 1fr auto;
  gap: 8px;
  align-items: center;
}

.overlay-scale-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.overlay-scale-controls :deep(.ant-slider) {
  flex: 1 1 auto;
  margin: 0;
}

.overlay-row--toggle {
  grid-template-columns: 72px auto;
  justify-content: space-between;
}

.overlay-label {
  font-size: 12px;
  color: #475569;
}

.overlay-unit {
  font-size: 12px;
  color: #64748b;
}

.overlay-hint {
  margin: 0;
  font-size: 12px;
  color: #64748b;
}

.hidden-input {
  display: none;
}
</style>

<style>
.map-image-overlay {
  border-radius: 8px;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.22);
  object-fit: contain;
}
</style>
