<script setup>
import AnnouncementEditor from './AnnouncementEditor.vue'
import { computed, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { getNoFlyZoneGeoJson, saveNoFlyZoneGeoJson, deleteGeoJsonAsset } from '../../services/noFlyZoneGeoJson'
import { safeSourceUrl } from '../../utils/sourceUrl'

dayjs.extend(utc)
dayjs.extend(timezone)
const emit = defineEmits(['saved', 'deleted'])
const opened = ref(false), loading = ref(false), saving = ref(false), loaded = ref(false)
const errorText = ref(''), fileInput = ref(null), revision = ref(0)
const form = reactive({ id: null, title: '', sourceUrl: '', announcement: null, source: '', coordinateSystem: 'GCJ-02', periods: [] })
const attachmentBusy = ref(false)
const busy = computed(() => loading.value || saving.value || attachmentBusy.value)
const validJson = computed(() => { try { return JSON.parse(form.source) } catch { return null } })
const hasJson = computed(() => !!validJson.value)
const circleFeatures = computed(() => {
  const json = validJson.value
  const features = json?.type === 'FeatureCollection' ? json.features : [json]
  return (Array.isArray(features) ? features : []).flatMap((feature, index) =>
    feature?.type === 'Feature' && feature.geometry?.type === 'Point' && feature.properties?.shape === 'CIRCLE'
      ? [{ index, center: feature.geometry.coordinates || [], radius: feature.properties.radiusMeters }] : [])
})
const pathFeatures = computed(() => {
  const json = validJson.value
  const features = json?.type === 'FeatureCollection' ? json.features : [json]
  return (Array.isArray(features) ? features : []).flatMap((feature, index) =>
    feature?.geometry?.type === 'LineString' && feature.properties?.shape === 'PATH'
      ? [{ index, distance: feature.properties.pathDistanceMeters }] : [])
})
function changePathDistance(index, value) {
  const json = validJson.value
  if (!json || busy.value || !loaded.value) return
  const feature = json.type === 'FeatureCollection' ? json.features[index] : json
  feature.properties.pathDistanceMeters = value
  form.source = JSON.stringify(json, null, 2)
}
function changeCircle(index, field, value) {
  const json = validJson.value
  if (!json || busy.value || !loaded.value) return
  const feature = json.type === 'FeatureCollection' ? json.features[index] : json
  if (field === 'radius') feature.properties.radiusMeters = value
  else feature.geometry.coordinates[field === 'longitude' ? 0 : 1] = value
  form.source = JSON.stringify(json, null, 2)
}
const toLocal = (seconds) => dayjs.unix(seconds).tz('Asia/Shanghai').format('YYYY-MM-DDTHH:mm:ss')
const newPeriod = () => ({ from: '', to: '' })
function showError(error, fallback) {
  errorText.value = error?.response?.data?.message?.zh || fallback
  message.error(errorText.value)
}
async function open(id = null) {
  if (busy.value) return
  revision.value++
  Object.assign(form, { id, title: '', sourceUrl: '', announcement: null, source: '', coordinateSystem: 'GCJ-02', periods: [newPeriod()] })
  opened.value = true; errorText.value = ''; loaded.value = !id
  if (!id) return
  loading.value = true
  try {
    const detail = await getNoFlyZoneGeoJson(id)
    form.title = detail.title
    form.sourceUrl = detail.sourceUrl || ''
    form.announcement = detail.announcement || null
    form.source = JSON.stringify(detail.sourceGeoJson, null, 2)
    form.coordinateSystem = detail.sourceCoordinateSystem || 'WGS84'
    form.periods = detail.effectivePeriods.map(p => ({ from: toLocal(p.effectiveFrom), to: toLocal(p.effectiveTo) }))
    loaded.value = true
  } catch (error) { showError(error, '读取 GeoJSON 失败，请关闭后重试') }
  finally { loading.value = false }
}
async function readFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  if (file.size > 2 * 1024 * 1024) return showError(null, 'GeoJSON 文件不得超过 2 MiB')
  const current = revision.value
  loading.value = true
  try {
    const text = await file.text()
    JSON.parse(text)
    if (current !== revision.value) return
    form.source = text
    if (!form.title) form.title = file.name.replace(/\.(geojson|json)$/i, '')
    errorText.value = ''
  } catch { showError(null, '文件不是有效 JSON，原内容已保留') }
  finally { loading.value = false }
}
function epoch(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return NaN
  const time = dayjs.tz(value, 'Asia/Shanghai')
  return time.isValid() && time.format(value.length === 16 ? 'YYYY-MM-DDTHH:mm' : 'YYYY-MM-DDTHH:mm:ss') === value ? time.unix() : NaN
}
async function save() {
  if (busy.value || !loaded.value) return
  if (!form.title.trim() || !hasJson.value) return showError(null, '请填写标题和有效的 GeoJSON')
  if (form.sourceUrl.trim() && !safeSourceUrl(form.sourceUrl)) return showError(null, '请填写有效的 http:// 或 https:// 来源 URL，且不能包含账号密码')
  if (new Blob([form.source]).size > 2 * 1024 * 1024) return showError(null, 'GeoJSON 文件不得超过 2 MiB')
  let effectivePeriods
  try { effectivePeriods = form.periods.map(p => ({ effectiveFrom: epoch(p.from), effectiveTo: epoch(p.to) })) }
  catch { return showError(null, '请填写有效的生效起止时间') }
  if (!effectivePeriods.length || effectivePeriods.some(p => !Number.isFinite(p.effectiveFrom) || !Number.isFinite(p.effectiveTo) || p.effectiveTo <= p.effectiveFrom)) {
    return showError(null, '每个时间段都必须填写起止时间，且结束晚于开始')
  }
  saving.value = true
  try {
    const result = await saveNoFlyZoneGeoJson(form.id, { title: form.title.trim(), sourceUrl: form.sourceUrl.trim(), announcement: form.announcement, geoJson: validJson.value, coordinateSystem: form.coordinateSystem, effectivePeriods })
    message.success('素材已保存，尚未加入临时禁飞区')
    opened.value = false
    emit('saved', result)
  } catch (error) { showError(error, '保存失败，修改内容已保留') }
  finally { saving.value = false }
}
function remove() {
  if (!form.id || busy.value) return
  Modal.confirm({
    title: '删除 GeoJSON 素材？', content: `将删除“${form.title}”的素材和全部生效时段，不影响已保存的临时禁飞区。`,
    okText: '删除', cancelText: '取消', okButtonProps: { danger: true },
    async onOk() {
      saving.value = true
      try { await deleteGeoJsonAsset(form.id); opened.value = false; emit('deleted', form.id); message.success('已删除') }
      catch (error) { showError(error, '删除失败，请重试'); throw error }
      finally { saving.value = false }
    },
  })
}
function close() { if (!busy.value) { revision.value++; opened.value = false } }
defineExpose({ open })
</script>

<template>
  <a-modal :open="opened" :title="form.id ? '编辑 GeoJSON 素材' : '导入 GeoJSON 素材'"
    :width="920" :mask-closable="false" :closable="!busy" :keyboard="!busy" @cancel="close">
    <a-alert type="info" show-icon message="默认 GCJ-02，读取、加载和保存不重复转换"
      description="腾讯地图数据请选择 GCJ-02；仅 WGS84 输入会转换一次。坐标顺序为经度、纬度，下方编辑原始输入。页面上传后可在素材库发布，或加载修改后保存。修改素材不会自动覆盖已发布禁飞区。时间统一使用北京时间（UTC+8）。" />
    <a-spin :spinning="loading">
      <a-form layout="vertical" class="geojson-form">
        <a-form-item label="标题">
          <a-input v-model:value="form.title" aria-label="GeoJSON 标题" :maxlength="200" :disabled="busy || !loaded" />
        </a-form-item>
        <a-form-item label="来源 URL（选填）">
          <a-input v-model:value="form.sourceUrl" aria-label="来源 URL" placeholder="https://… 公告或原文链接" :maxlength="2048" :disabled="busy || !loaded" />
          <a v-if="safeSourceUrl(form.sourceUrl)" :href="safeSourceUrl(form.sourceUrl)" target="_blank" rel="noopener noreferrer">打开来源</a>
        </a-form-item>
        <a-form-item label="公告内容（随素材保存）">
          <AnnouncementEditor v-model="form.announcement" :source-url="form.sourceUrl" :title="form.title" :disabled="loading || saving || !loaded" @busy="attachmentBusy=$event" />
        </a-form-item>
        <a-form-item label="输入坐标系">
          <select v-model="form.coordinateSystem" aria-label="输入坐标系" :disabled="busy || !loaded" class="coordinate-system">
            <option value="GCJ-02">GCJ-02（腾讯地图，默认）</option>
            <option value="WGS84">WGS84（保存时转换为 GCJ-02）</option>
          </select>
          <p class="hint">替换文件时请核对其坐标系。历史素材保留原坐标系标记；若之前误标，可切换为实际坐标系后重新保存。</p>
        </a-form-item>
        <a-form-item :label="form.coordinateSystem + ' GeoJSON'">
          <input ref="fileInput" type="file" accept=".geojson,.json,application/geo+json,application/json" hidden @change="readFile" />
          <a-button :disabled="busy || !loaded" @click="fileInput?.click()">选择 / 替换 GeoJSON 文件</a-button>
          <p class="hint">支持多边形 POLYGON、矩形 RECTANGLE、圆形 CIRCLE、路径 PATH，可混合多个区域。保留原类型和参数，多边形支持内环。最大 2 MiB。</p>
          <p class="hint">圆形格式：geometry.type 为 Point、coordinates 为 [经度,纬度]；properties.shape 为 CIRCLE、radiusMeters 为半径（米）。可与多边形放在同一个 FeatureCollection 中。</p>
          <p class="hint">矩形格式：Polygon 的单个闭合环（四角点＋闭合点），properties.shape 为 RECTANGLE。路径格式：LineString，properties.shape 为 PATH，pathDistanceMeters 为向路径两侧各扩展的米数。</p>
          <a-textarea v-model:value="form.source" aria-label="GeoJSON 内容" :rows="9" :disabled="busy || !loaded" spellcheck="false" />
        </a-form-item>
        <a-form-item v-for="circle in circleFeatures" :key="circle.index" :label="`圆形区域 ${circle.index + 1}（${form.coordinateSystem}）`">
          <div class="period-row">
            <label>圆心经度 <a-input-number :value="circle.center[0]" :aria-label="`圆心经度 ${circle.index + 1}`" :min="-180" :max="180" :disabled="busy || !loaded" @update:value="changeCircle(circle.index, 'longitude', $event)" /></label>
            <label>圆心纬度 <a-input-number :value="circle.center[1]" :aria-label="`圆心纬度 ${circle.index + 1}`" :min="-90" :max="90" :disabled="busy || !loaded" @update:value="changeCircle(circle.index, 'latitude', $event)" /></label>
            <label>半径（米） <a-input-number :value="circle.radius" :aria-label="`圆形半径 ${circle.index + 1}`" :min="0" :disabled="busy || !loaded" @update:value="changeCircle(circle.index, 'radius', $event)" /></label>
          </div>
        </a-form-item>
        <a-form-item v-for="path in pathFeatures" :key="`path-${path.index}`" :label="`路径区域 ${path.index + 1}`">
          <label>向两侧各扩展（米） <a-input-number :value="path.distance" :aria-label="`路径扩展距离 ${path.index + 1}`" :min="0" :disabled="busy || !loaded" @update:value="changePathDistance(path.index, $event)" /></label>
        </a-form-item>
        <a-form-item label="生效时间段（北京时间 UTC+8）">
          <div v-for="(period, index) in form.periods" :key="index" class="period-row">
            <input v-model="period.from" type="datetime-local" step="1" :aria-label="`开始时间 ${index + 1}`" :disabled="busy || !loaded" />
            <span>至</span>
            <input v-model="period.to" type="datetime-local" step="1" :aria-label="`结束时间 ${index + 1}`" :disabled="busy || !loaded" />
            <a-button danger :aria-label="`删除时段 ${index + 1}`" :disabled="busy || !loaded || form.periods.length <= 1" @click="form.periods.splice(index, 1)">删除时段</a-button>
          </div>
          <a-button :disabled="busy || !loaded || form.periods.length >= 100" @click="form.periods.push(newPeriod())">新增生效时段</a-button>
          <p class="hint">可新增、修改或删除时段；素材至少保留一个完整时段。</p>
        </a-form-item>
        <a-alert v-if="errorText" type="error" show-icon :message="errorText" class="geojson-error" />
      </a-form>
    </a-spin>
    <template #footer>
      <a-button v-if="form.id" danger :disabled="busy || !loaded" @click="remove">删除该 GeoJSON</a-button>
      <a-button :disabled="busy" @click="close">取消</a-button>
      <a-button type="primary" :loading="saving" :disabled="loading || !loaded || attachmentBusy" @click="save">保存素材和时间</a-button>
    </template>
  </a-modal>
</template>

<style scoped>
.geojson-form { margin-top: 20px; }
.coordinate-system { border: 1px solid var(--admin-line); border-radius: 6px; padding: 6px 10px; }
.hint { color: var(--admin-muted); margin: 10px 0; }
.period-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
.period-row input { border: 1px solid var(--admin-line); border-radius: 6px; padding: 6px 10px; max-width: 100%; }
</style>
