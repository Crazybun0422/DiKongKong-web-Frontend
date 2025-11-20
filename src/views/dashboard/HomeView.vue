<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import locationIcon from '../../assets/img/location.png'
import { DRONES } from '../../miniapp/utils/drones.js'
import { buildWmsOverlay } from '../../miniapp/utils/wms.js'

const mapRef = ref(null)
const resizeObserver = ref(null)
const searchKeyword = ref('')
const selectedMarkerId = ref(null)
const markerDrawerVisible = ref(false)
const locating = ref(false)

const bounds = reactive({
  minLat: 39.6,
  maxLat: 40.1,
  minLng: 115.9,
  maxLng: 116.8,
})

const mapZoom = 11

const mapRegion = computed(() => ({
  northeast: { longitude: bounds.maxLng, latitude: bounds.maxLat },
  southwest: { longitude: bounds.minLng, latitude: bounds.minLat },
}))

const mapCenter = computed(() => ({
  latitude: (bounds.minLat + bounds.maxLat) / 2,
  longitude: (bounds.minLng + bounds.maxLng) / 2,
}))

const droneIconSrc = computed(
  () => import.meta.env.VITE_DRONE_ICON?.trim() || '/assets/img/drone.png',
)

const fallbackMarkers = [
  {
    id: 'market-01',
    name: '低空星球（国贸） / Low Air Planet (CBD)',
    latitude: 39.9089,
    longitude: 116.3975,
    address: '北京市朝阳区国贸中心 / Guomao Center, Chaoyang, Beijing',
    phone: '010-8888 8888',
    hours: '09:00 - 18:00',
    status: '营业中 / Open',
    description: '城市低空场景体验点，提供飞行咨询与演示。 / Urban low-altitude demo site with consultation.',
  },
  {
    id: 'market-02',
    name: '低空星球（中关村） / Low Air Planet (ZGC)',
    latitude: 39.9836,
    longitude: 116.3119,
    address: '北京市海淀区中关村创业大街 8 号 / 8 Chuangye St, Haidian, Beijing',
    phone: '010-6666 1234',
    hours: '10:00 - 20:00',
    status: '营业中 / Open',
    description: '支持预约试飞、商户入驻与无人机科普课程。 / Trial flights, merchant onboarding, and UAS courses.',
  },
  {
    id: 'market-03',
    name: '低空星球（首钢园） / Low Air Planet (Shougang Park)',
    latitude: 39.913,
    longitude: 116.138,
    address: '北京市石景山区石景山路 68 号 / 68 Shijingshan Rd, Shijingshan, Beijing',
    phone: '010-5999 0000',
    hours: '10:00 - 19:00',
    status: '试运营 / Soft opening',
    description: '工业风园区体验点，提供低空航线展示与服务咨询。 / Industrial park site with low-altitude demos and consulting.',
  },
]

const markers = ref(fallbackMarkers)
const uomTiles = ref([])
const uomLoadState = reactive({ total: 0, loaded: 0, error: false })

const selectedMarker = computed(() => markers.value.find((item) => item.id === selectedMarkerId.value))

const preflightInfo = reactive({
  temporaryZone: '今日临时管制：国家会议中心周边 / Temporary restriction near CNCC',
  uomStatus: '评估中（加载适飞空域）/ Evaluating UOM overlays',
  djiStatus: '低风险限飞区 / Low-risk DJI zone',
  djiStatusExtra: '距最近机场 8.2 km，注意保持空域安全。 / 8.2 km to nearest airport; maintain caution.',
})

const selectedDrone = ref(DRONES?.[0]?.name || 'DJI Mavic 3')
const droneOptions = computed(() => DRONES.map((item) => ({ label: item.name, value: item.name })))

const filteredMarkers = computed(() => {
  const keyword = searchKeyword.value.trim()
  if (!keyword) return markers.value
  const lower = keyword.toLowerCase()
  return markers.value.filter(
    (item) =>
      item.name.toLowerCase().includes(lower) ||
      item.address?.toLowerCase().includes(lower) ||
      item.description?.toLowerCase().includes(lower),
  )
})

const projectToPercent = (latitude, longitude) => {
  const { minLat, maxLat, minLng, maxLng } = bounds
  const clampedLat = Math.min(Math.max(latitude, minLat), maxLat)
  const clampedLng = Math.min(Math.max(longitude, minLng), maxLng)
  const left = ((clampedLng - minLng) / (maxLng - minLng)) * 100
  const top = ((maxLat - clampedLat) / (maxLat - minLat)) * 100
  return {
    left: `${left}%`,
    top: `${top}%`,
  }
}

const projectedMarkers = computed(() =>
  filteredMarkers.value.map((marker) => ({
    ...marker,
    position: projectToPercent(marker.latitude, marker.longitude),
  })),
)

const projectBoundsToRect = (tileBounds) => {
  const { minLat, maxLat, minLng, maxLng } = bounds
  const swLng = Math.max(Math.min(tileBounds?.southwest?.longitude ?? minLng, maxLng), minLng)
  const swLat = Math.max(Math.min(tileBounds?.southwest?.latitude ?? minLat, maxLat), minLat)
  const neLng = Math.max(Math.min(tileBounds?.northeast?.longitude ?? maxLng, maxLng), minLng)
  const neLat = Math.max(Math.min(tileBounds?.northeast?.latitude ?? maxLat, maxLat), minLat)

  const left = ((swLng - minLng) / (maxLng - minLng)) * 100
  const top = ((maxLat - neLat) / (maxLat - minLat)) * 100
  const width = ((neLng - swLng) / (maxLng - minLng)) * 100
  const height = ((neLat - swLat) / (maxLat - minLat)) * 100
  return { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }
}

const uomOverlays = computed(() =>
  uomTiles.value.map((tile) => ({
    ...tile,
    rect: projectBoundsToRect(tile.bounds),
  })),
)

const refreshUomTiles = () => {
  try {
    const overlays = buildWmsOverlay(mapCenter.value, mapZoom, mapRegion.value) || []
    uomTiles.value = overlays
  } catch (err) {
    console.error('加载适飞空域图层失败', err)
    uomTiles.value = []
    preflightInfo.uomStatus = '适飞空域加载失败'
  }
}

const openDrawerWithMarker = (markerId) => {
  selectedMarkerId.value = markerId
  markerDrawerVisible.value = true
}

const handleMarkerClick = (marker) => {
  openDrawerWithMarker(marker.id)
}

const handleSearch = () => {
  if (!searchKeyword.value.trim()) {
    markers.value = fallbackMarkers
    return
  }
  if (!filteredMarkers.value.length) {
    message.info('没有找到匹配的商户 / No matching merchant')
    return
  }
  openDrawerWithMarker(filteredMarkers.value[0].id)
}

const handleLocate = () => {
  if (!mapRef.value) return
  locating.value = true
  setTimeout(() => {
    locating.value = false
  }, 900)
  message.success('已定位到当前区域 / Centered on your area')
}

const handleUomTileLoad = () => {
  uomLoadState.loaded += 1
  if (uomLoadState.loaded === uomLoadState.total) {
    preflightInfo.uomStatus = '适飞空域（限高120m）/ UOM: max 120m'
  }
}

const handleUomTileError = () => {
  uomLoadState.error = true
    preflightInfo.uomStatus = '适飞空域加载失败 / UOM overlay failed'
}

onMounted(() => {
  if (mapRef.value) {
    resizeObserver.value = new ResizeObserver(() => {
      mapRef.value?.style.setProperty('--map-height', `${mapRef.value.clientHeight}px`)
    })
    resizeObserver.value.observe(mapRef.value)
  }
  refreshUomTiles()
})

onBeforeUnmount(() => {
  resizeObserver.value?.disconnect()
})

watch(
  () => uomTiles.value,
  (tiles) => {
    uomLoadState.total = tiles.length
    uomLoadState.loaded = 0
    uomLoadState.error = false
    preflightInfo.uomStatus = tiles.length
      ? '适飞空域加载中 / Loading UOM overlay'
      : '未获取到适飞空域图层 / No UOM overlay available'
  },
  { immediate: true },
)
</script>

<template>
  <div class="home-page">
    <div ref="mapRef" class="map-container">
      <div class="map-frame" aria-label="地图背景"></div>

      <div class="uom-layer" aria-label="UOM 适飞空域">
        <img
          v-for="tile in uomOverlays"
          :key="tile.id"
          class="uom-tile"
          :style="tile.rect"
          :src="tile.src"
          alt="适飞空域覆盖"
          @load="handleUomTileLoad"
          @error="handleUomTileError"
        />
      </div>

      <div class="preflight-panel">
        <div class="preflight-card">
          <div class="preflight-header">
            <div>
              <div class="preflight-title">飞前安全准备 / Preflight safety</div>
              <div class="preflight-subtitle">与小程序保持一致的飞行前看板 / Same dashboard as the miniapp</div>
            </div>
            <a-select
              v-model:value="selectedDrone"
              :options="droneOptions"
              class="drone-selector"
              size="small"
              :dropdown-match-select-width="false"
            />
          </div>

          <div class="preflight-row">
            <span class="label">临时禁飞区 / TFR：</span>
            <span class="value warning">{{ preflightInfo.temporaryZone }}</span>
          </div>
          <div class="preflight-row">
            <span class="label">位于 UOM 划分 / UOM：</span>
            <span class="value safe">{{ preflightInfo.uomStatus }}</span>
          </div>
          <div class="preflight-row">
            <span class="label">位于大疆划分 / DJI：</span>
            <span class="value dji">{{ preflightInfo.djiStatus }}</span>
          </div>
          <div class="preflight-extra">{{ preflightInfo.djiStatusExtra }}</div>

          <a-input-search
            v-model:value="searchKeyword"
            placeholder="搜索商户或地点 / Search merchant or place"
            enter-button="搜索 / Search"
            class="search-bar"
            @search="handleSearch"
          />
        </div>
      </div>

      <div class="marker-layer">
        <button
          v-for="marker in projectedMarkers"
          :key="marker.id"
          class="marker-point"
          :style="{ left: marker.position.left, top: marker.position.top }"
          type="button"
          @click="handleMarkerClick(marker)"
        >
          <img :src="droneIconSrc" alt="商户位置" />
          <span class="marker-label">{{ marker.name }}</span>
        </button>
      </div>

      <div class="center-pin" :class="{ 'is-locating': locating }" aria-hidden="true"></div>

      <button class="locate-button" type="button" @click="handleLocate">
        <img :src="locationIcon" alt="定位 / locate" />
      </button>
    </div>

    <a-drawer
      :open="markerDrawerVisible"
      title="商户详情 / Merchant details"
      height="320"
      placement="bottom"
      :destroy-on-close="true"
      @close="markerDrawerVisible = false"
    >
      <template v-if="selectedMarker">
        <h3 class="drawer-title">{{ selectedMarker.name }}</h3>
        <p class="drawer-line"><strong>地址 / Address：</strong>{{ selectedMarker.address }}</p>
        <p class="drawer-line"><strong>营业时间 / Hours：</strong>{{ selectedMarker.hours }}</p>
        <p class="drawer-line"><strong>联系电话 / Phone：</strong>{{ selectedMarker.phone }}</p>
        <p class="drawer-line"><strong>状态 / Status：</strong>{{ selectedMarker.status }}</p>
        <p class="drawer-desc">{{ selectedMarker.description }}</p>
      </template>
      <template v-else>
        <p class="drawer-empty">请选择地图上的商户查看详情。/ Select a map marker to view details.</p>
      </template>
    </a-drawer>
  </div>
</template>

<style scoped>
.home-page {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 72px);
  min-height: 680px;
  background: #0a1628;
}

.map-container {
  position: relative;
  flex: 1;
  overflow: hidden;
  border-radius: 18px;
  background: linear-gradient(135deg, #0b1e33, #0e2440);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
}

.map-frame {
  position: absolute;
  inset: 0;
  background-image: url('https://tile.openstreetmap.org/11/1713/808.png');
  background-size: cover;
  background-position: center;
  filter: saturate(1.05);
}

.uom-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.uom-tile {
  position: absolute;
  opacity: 0.65;
  mix-blend-mode: screen;
  filter: hue-rotate(180deg) saturate(1.25);
}

.preflight-panel {
  position: absolute;
  top: 32px;
  left: 32px;
  z-index: 3;
  pointer-events: none;
}

.preflight-card {
  position: relative;
  width: min(520px, 38vw);
  padding: 22px 24px 18px;
  color: #ffffff;
  pointer-events: auto;
  overflow: hidden;
}

.preflight-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.42);
  clip-path: polygon(0 0, 82% 0, 100% 50%, 82% 100%, 0 100%);
  border-radius: 18px 0 0 18px;
  z-index: 0;
}

.preflight-header {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.preflight-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.preflight-subtitle {
  margin-top: 4px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.78);
}

.drone-selector {
  min-width: 180px;
}

.preflight-row {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  margin: 6px 0;
}

.label {
  color: rgba(255, 255, 255, 0.92);
  white-space: nowrap;
}

.value {
  font-weight: 700;
  color: #ffffff;
}

.value.safe {
  color: #35c759;
}

.value.warning {
  color: #ffb020;
}

.value.dji {
  color: #7cd0ff;
}

.preflight-extra {
  position: relative;
  z-index: 1;
  margin-top: 4px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.86);
}

.search-bar {
  position: relative;
  z-index: 1;
  margin-top: 12px;
}

.marker-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 2;
}

.marker-point {
  position: absolute;
  transform: translate(-50%, -100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  pointer-events: auto;
}

.marker-point img {
  width: 42px;
  height: 42px;
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.25));
}

.marker-label {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.55);
  color: #ffffff;
  font-size: 12px;
  white-space: nowrap;
}

.center-pin {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 14px;
  height: 14px;
  background: #e53935;
  border: 2px solid #fff;
  border-radius: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);
  z-index: 2;
}

.center-pin.is-locating {
  animation: pulse 0.9s ease;
}

@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(1);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);
  }
  50% {
    transform: translate(-50%, -50%) scale(1.25);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.24);
  }
  100% {
    transform: translate(-50%, -50%) scale(1);
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);
  }
}

.locate-button {
  position: absolute;
  right: 26px;
  bottom: 24px;
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.92);
  border: none;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
  display: grid;
  place-items: center;
  cursor: pointer;
  z-index: 3;
}

.locate-button img {
  width: 30px;
  height: 30px;
}

.drawer-title {
  font-size: 18px;
  margin: 0 0 6px;
}

.drawer-line {
  margin: 4px 0;
  color: #1f2937;
}

.drawer-desc {
  margin-top: 10px;
  line-height: 1.5;
  color: #4b5563;
}

.drawer-empty {
  color: #6b7280;
}

@media (max-width: 1024px) {
  .preflight-card {
    width: min(480px, 82vw);
  }

  .drone-selector {
    min-width: 140px;
  }
}
</style>
