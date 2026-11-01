<script setup>
import { reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import GeoJsonZoneEditor from './GeoJsonZoneEditor.vue'
import { listGeoJsonAssets, getNoFlyZoneGeoJson, publishGeoJsonAsset } from '../../services/noFlyZoneGeoJson'
import { safeSourceUrl } from '../../utils/sourceUrl'

dayjs.extend(utc)
dayjs.extend(timezone)
const emit = defineEmits(['load', 'published'])
const opened = ref(false), busy = ref(false), rows = ref([]), editor = ref(null)
const pagination = reactive({ current: 1, pageSize: 10, total: 0, showSizeChanger: false })
const columns = [{ title: '素材标题', dataIndex: 'title', key: 'title' },
  { title: '来源', dataIndex: 'sourceUrl', key: 'sourceUrl', width: 200 },
  { title: '生效时间（北京时间 UTC+8）', key: 'periods' },
  { title: '发布状态', key: 'publication', width: 150 }, { title: '操作', key: 'actions', width: 290 }]
const time = seconds => dayjs.unix(seconds).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss')
async function refresh(page = pagination.current) {
  busy.value = true
  try {
    const data = await listGeoJsonAssets(page)
    if (!data.content.length && page > 1) { await refresh(page - 1); return }
    rows.value = data.content
    pagination.current = data.page + 1
    pagination.total = data.totalElements
  } catch { message.error('读取 GeoJSON 素材库失败，请重试') }
  finally { busy.value = false }
}
async function open() { opened.value = true; await refresh(1) }
async function publish(record) {
  if (busy.value) return
  busy.value = true
  try {
    await publishGeoJsonAsset(record.id)
    message.success('已发布为临时禁飞区')
    emit('published')
    await refresh()
  } catch (error) {
    message.error(error?.response?.data?.message?.zh || '发布未确认，请刷新查看状态后重试')
  } finally { busy.value = false }
}
async function load(record) {
  if (busy.value) return
  busy.value = true
  try {
    const detail = await getNoFlyZoneGeoJson(record.id)
    emit('load', detail)
    opened.value = false
  } catch { message.error('加载素材失败，当前编辑内容已保留') }
  finally { busy.value = false }
}
defineExpose({ open })
</script>

<template>
  <a-modal :open="opened" title="GeoJSON 素材库" :width="1200" :footer="null" :mask-closable="false"
    :closable="!busy" :keyboard="!busy" @cancel="opened = false">
    <a-alert type="info" show-icon message="AI 素材上传核验后自动发布，发布结果在此显示"
      description="页面上传可点击发布，或加载到编辑区修改后保存。全部管制时段已结束的素材会自动清理；仍有效、有后续时段或时段待确认的素材保留。清理素材不会删除已发布禁飞区。" />
    <a-space style="margin: 16px 0">
      <a-button :disabled="busy" @click="editor?.open()">上传 GeoJSON 素材</a-button>
      <a-button :loading="busy" @click="refresh()">刷新素材</a-button>
    </a-space>
    <a-table :columns="columns" :data-source="rows" row-key="id" :loading="busy" :pagination="pagination"
      @change="page => refresh(page.current)">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'sourceUrl'">
          <a v-if="safeSourceUrl(record.sourceUrl)" :href="safeSourceUrl(record.sourceUrl)" :title="record.sourceUrl" target="_blank" rel="noopener noreferrer" style="overflow-wrap: anywhere">{{ record.sourceUrl }}</a>
          <span v-else>未填写</span>
        </template>
        <template v-else-if="column.key === 'periods'">
          <div v-for="(period, index) in record.effectivePeriods" :key="index">{{ time(period.effectiveFrom) }} ~ {{ time(period.effectiveTo) }}</div>
        </template>
        <template v-else-if="column.key === 'publication'">
          <a-tag v-if="record.publication?.status === 'PUBLISHED'" color="success">已发布</a-tag>
          <a-tag v-else-if="record.publication?.status === 'MATERIAL_CHANGED'" color="warning">已发布 · 素材有修改</a-tag>
          <a-tag v-else>待发布</a-tag>
          <div v-if="record.publication?.publishedAt" style="font-size: 12px; color: #888">{{ record.publication.publishedAt.replace('T', ' ').slice(0, 19) }}</div>
        </template>
        <a-space v-else-if="column.key === 'actions'">
          <a-button v-if="!record.publication?.zoneId" :disabled="busy" @click="publish(record)">发布</a-button>
          <a-button type="primary" :disabled="busy" @click="load(record)">加载到编辑区</a-button>
          <a-button :disabled="busy" @click="editor?.open(record.id)">编辑素材</a-button>
        </a-space>
      </template>
    </a-table>
    <GeoJsonZoneEditor ref="editor" @saved="refresh()" @deleted="refresh()" />
  </a-modal>
</template>
