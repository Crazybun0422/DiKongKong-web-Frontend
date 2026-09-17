<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { fetchAdminOnlineUsers, fetchAdminOnlineUserDetail } from '../../services/adminUsers'
import { resolveProfileAsset } from '../../services/profile'

const { t, locale } = useI18n()
const label = (key) => t(`onlineUsers.${key}`)
const rows = ref([])
const onlineCount = ref(null)
const total = ref(0)
const current = ref(1)
const pageSize = ref(20)
const searchInput = ref('')
const keyword = ref('')
const sampledAt = ref(null)
const timeoutSeconds = ref(60)
const loading = ref(false)
const loadError = ref(false)
const selectedCode = ref('')
const detail = ref(null)
const detailLoading = ref(false)
const detailError = ref(false)
let timer
let disposed = false
let requestId = 0
let detailRequestId = 0
let listController
let detailController

const columns = computed(() => [
  { key: 'user', title: label('nickname'), width: 210 },
  { key: 'featureCode', dataIndex: 'featureCode', title: label('featureCode'), width: 105 },
  { key: 'phone', dataIndex: 'phone', title: label('phone'), width: 140 },
  { key: 'member', title: label('member'), width: 110 },
  { key: 'flpBalance', dataIndex: 'flpBalance', title: label('balance'), width: 115 },
  { key: 'lastHeartbeatAt', title: label('heartbeat'), width: 190 },
  { key: 'connectionCount', dataIndex: 'connectionCount', title: label('connections'), width: 120 },
  { key: 'actions', title: label('detail'), fixed: 'right', width: 110 },
])
const pagination = computed(() => ({
  current: current.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50', '100'],
  showTotal: (count) => t('onlineUsers.total', { total: count }),
}))
const detailAccount = computed(() => detail.value?.account?.user ?? {})
const detailProfile = computed(() => detail.value?.profile ?? {})
const detailFields = computed(() => {
  const user = detailAccount.value
  const profile = detailProfile.value
  return [
    ['ID', user.id],
    [label('featureCode'), user.featureCode],
    [label('phone'), user.phone],
    [label('email'), user.email],
    [label('accountStatus'), user.status],
    [label('member'), label(user.member ? 'vip' : 'ordinary')],
    [label('memberExpireDate'), user.memberExpireDate || (user.member ? label('unlimited') : '—')],
    [label('balance'), user.flpBalance],
    [label('createdAt'), formatTime(user.createdAt)],
    [label('heartbeat'), formatTime(detail.value?.account?.lastHeartbeatAt)],
    [label('connections'), detail.value?.account?.connectionCount],
    [label('gender'), label(['male', 'female'].includes(profile.gender) ? profile.gender : 'unknown')],
    [label('age'), profile.age ?? label('unknown')],
    [label('birthday'), profile.birthday || label('unknown')],
    [label('xingGe'), profile.selectedXingGe],
    [label('aircraft'), detail.value?.aircraftModel],
    [label('likes'), profile.likes],
    [label('signature'), profile.signature],
  ]
})

function formatTime(value) {
  if (!value) return '—'
  // LocalDateTime in existing account records is Beijing time; heartbeat Instants include a zone.
  const text = String(value)
  const zoned = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text) && !/(Z|[+-]\d{2}:?\d{2})$/i.test(text)
    ? `${text}+08:00` : text
  const date = new Date(zoned)
  return Number.isNaN(date.getTime()) ? text : date.toLocaleString(locale.value, { timeZone: 'Asia/Shanghai', hour12: false })
}

function scheduleRefresh() {
  clearTimeout(timer)
  if (!disposed && !document.hidden) timer = setTimeout(() => loadUsers(false), 15000)
}

async function loadUsers(foreground = true) {
  clearTimeout(timer)
  listController?.abort()
  const controller = new AbortController()
  listController = controller
  const id = ++requestId
  if (foreground) loading.value = true
  try {
    const result = await fetchAdminOnlineUsers({
      page: current.value, size: pageSize.value, keyword: keyword.value, signal: controller.signal,
    })
    if (disposed || id !== requestId) return
    rows.value = result.content.map((row) => ({
      ...row.user,
      avatarUrl: resolveProfileAsset(row.user.avatarUrl),
      lastHeartbeatAt: row.lastHeartbeatAt,
      connectionCount: row.connectionCount,
    }))
    onlineCount.value = result.onlineCount
    total.value = result.totalElements
    current.value = result.page
    pageSize.value = result.size
    sampledAt.value = result.sampledAt
    timeoutSeconds.value = result.onlineTimeoutSeconds
    loadError.value = false
  } catch (error) {
    if (!disposed && id === requestId && !controller.signal.aborted) loadError.value = true
  } finally {
    if (!disposed && id === requestId) {
      loading.value = false
      scheduleRefresh()
    }
  }
  if (!disposed && id === requestId && selectedCode.value && !document.hidden) loadDetail(false)
}

function search() {
  keyword.value = searchInput.value.trim()
  current.value = 1
  loadUsers()
}

function changePage(page) {
  current.value = page.pageSize !== pageSize.value ? 1 : page.current
  pageSize.value = page.pageSize
  loadUsers()
}

function openDetail(record) {
  selectedCode.value = record.featureCode
  detail.value = null
  loadDetail()
}

async function loadDetail(foreground = true) {
  detailController?.abort()
  const controller = new AbortController()
  detailController = controller
  const id = ++detailRequestId
  const code = selectedCode.value
  if (!code) return
  if (foreground) detailLoading.value = true
  detailError.value = false
  try {
    const result = await fetchAdminOnlineUserDetail(code, controller.signal)
    if (!disposed && id === detailRequestId && selectedCode.value === code) detail.value = result
  } catch (error) {
    if (!disposed && id === detailRequestId && !controller.signal.aborted) detailError.value = true
  } finally {
    if (!disposed && id === detailRequestId) detailLoading.value = false
  }
}

function closeDetail() {
  selectedCode.value = ''
  detailController?.abort()
  ++detailRequestId
  detail.value = null
  detailLoading.value = false
}

function visibilityChanged() {
  if (document.hidden) {
    clearTimeout(timer)
    listController?.abort()
    detailController?.abort()
  } else loadUsers(false)
}

onMounted(() => {
  document.addEventListener('visibilitychange', visibilityChanged)
  if (!document.hidden) loadUsers()
})
onBeforeUnmount(() => {
  disposed = true
  clearTimeout(timer)
  listController?.abort()
  detailController?.abort()
  document.removeEventListener('visibilitychange', visibilityChanged)
})
</script>

<template>
  <section class="online-page">
    <header class="page-header">
      <div>
        <h1>{{ label('title') }}</h1>
        <p>{{ label('description') }}</p>
      </div>
      <a-button :loading="loading" @click="loadUsers()">{{ label('refresh') }}</a-button>
    </header>

    <div class="online-summary">
      <div class="online-number"><span class="online-dot"></span>{{ onlineCount ?? '—' }}</div>
      <div>
        <strong>{{ label('title') }}</strong>
        <p>{{ t('onlineUsers.rule', { seconds: timeoutSeconds }) }}</p>
        <small v-if="sampledAt">{{ t('onlineUsers.updatedAt', { time: formatTime(sampledAt) }) }}</small>
      </div>
    </div>

    <a-alert v-if="loadError" type="warning" show-icon :message="label('loadFailed')" class="error-alert" />
    <div class="list-panel">
      <a-input-search v-model:value="searchInput" :placeholder="label('search')" allow-clear
        :maxlength="128" class="user-search" @search="search" />
      <a-table :columns="columns" :data-source="rows" row-key="featureCode" :loading="loading"
        :pagination="pagination" :scroll="{ x: 1100 }" :locale="{ emptyText: label('empty') }" @change="changePage">
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.key === 'user'">
            <button class="user-link" type="button" @click="openDetail(record)">
              <a-avatar :src="record.avatarUrl" :size="36">{{ (record.username || '?').slice(0, 1) }}</a-avatar>
              <span>{{ record.username || '—' }}</span>
            </button>
          </template>
          <template v-else-if="column.key === 'member'">
            <a-tag :color="record.member ? 'gold' : undefined">{{ label(record.member ? 'vip' : 'ordinary') }}</a-tag>
          </template>
          <template v-else-if="column.key === 'lastHeartbeatAt'">{{ formatTime(record.lastHeartbeatAt) }}</template>
          <template v-else-if="column.key === 'actions'">
            <a-button type="link" size="small" @click="openDetail(record)">{{ label('view') }}</a-button>
          </template>
          <template v-else>{{ text === '' || text == null ? '—' : text }}</template>
        </template>
      </a-table>
    </div>

    <a-drawer :open="!!selectedCode" :title="label('detail')" width="min(560px, 100vw)" @close="closeDetail">
      <template #extra><a-button :loading="detailLoading" @click="loadDetail()">{{ label('refresh') }}</a-button></template>
      <a-alert v-if="detailError" type="warning" show-icon :message="label('detailFailed')" class="error-alert" />
      <a-spin :spinning="detailLoading">
        <template v-if="detail">
          <div class="detail-heading">
            <a-avatar :src="resolveProfileAsset(detailAccount.avatarUrl)" :size="56">{{ (detailAccount.username || '?').slice(0, 1) }}</a-avatar>
            <div><h2>{{ detailAccount.username || detailAccount.featureCode }}</h2>
              <a-badge :status="detail.account.connectionCount > 0 ? 'success' : 'default'"
                :text="label(detail.account.connectionCount > 0 ? 'online' : 'offline')" />
            </div>
          </div>
          <a-descriptions :column="1" bordered size="small">
            <a-descriptions-item v-for="[title, value] in detailFields" :key="title" :label="title">
              <span class="detail-value">{{ value === '' || value == null ? '—' : value }}</span>
            </a-descriptions-item>
          </a-descriptions>
          <p class="detail-time">{{ t('onlineUsers.updatedAt', { time: formatTime(detail.sampledAt) }) }}</p>
        </template>
      </a-spin>
    </a-drawer>
  </section>
</template>

<style scoped>
.online-page { padding: 28px; max-width: 1600px; margin: 0 auto; }
.page-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 20px; }
h1 { margin: 0 0 8px; font-size: 24px; color: #172033; }
p { margin: 0; color: #6b7280; line-height: 1.7; }
.online-summary { display: flex; align-items: center; gap: 28px; background: #fff; border: 1px solid #e9edf3; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
.online-number { display: flex; align-items: center; gap: 12px; font-size: 48px; font-weight: 650; font-variant-numeric: tabular-nums; color: #172033; }
.online-dot { width: 12px; height: 12px; border-radius: 50%; background: #20b67a; box-shadow: 0 0 0 5px #e3f7ef; flex-shrink: 0; }
.online-summary strong { font-size: 16px; }
.online-summary small, .detail-time { color: #8b93a1; }
.list-panel { padding: 20px; background: #fff; border-radius: 12px; }
.user-search { width: min(460px, 100%); margin-bottom: 20px; }
.user-link { display: flex; align-items: center; gap: 10px; padding: 0; border: 0; background: transparent; color: #172033; text-align: left; cursor: pointer; font: inherit; }
.user-link :deep(.ant-avatar) { flex-shrink: 0; }
.user-link:hover { color: #1677ff; }
.error-alert { margin-bottom: 16px; }
.detail-heading { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
.detail-heading h2 { margin: 0 0 6px; font-size: 20px; overflow-wrap: anywhere; }
.detail-value { white-space: pre-wrap; overflow-wrap: anywhere; }
.detail-time { margin-top: 16px; font-size: 12px; }
@media (max-width: 720px) {
  .online-page { padding: 16px; }
  .online-summary { align-items: flex-start; gap: 20px; padding: 20px; }
  .online-number { font-size: 36px; }
  .list-panel { padding: 12px; }
}
</style>
