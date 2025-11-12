<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { fetchAdminUsers } from '../../services/adminUsers'
import { fetchFlpLogs } from '../../services/flp'
import { resolveProfileAsset } from '../../services/profile'
import detailIcon from '../../assets/img/detail.png'

const { t } = useI18n()

const loading = ref(false)
const tableData = ref([])
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const searchForm = reactive({
  keyword: '',
})

const detailVisible = ref(false)
const detailLoading = ref(false)
const detailLogs = ref([])
const detailUser = ref(null)

const detailPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const sortState = reactive({
  field: 'createdAt',
  order: 'DESC',
})

const isSortFieldActive = (field) => sortState.field === field
const getSortIndicator = (field) =>
  isSortFieldActive(field) ? (sortState.order === 'ASC' ? '↑' : '↓') : '↕'
const getSortLabel = (field) => {
  if (isSortFieldActive(field) && sortState.order === 'ASC') {
    return t('users.sort.ascend')
  }
  return t('users.sort.descend')
}

const columns = computed(() => [
  { title: t('users.columns.featureCode'), dataIndex: 'featureCode', key: 'featureCode', width: 160 },
  { title: t('users.columns.username'), dataIndex: 'username', key: 'username' },
  { title: t('users.columns.avatar'), dataIndex: 'avatarUrl', key: 'avatar', width: 120 },
  { title: t('users.columns.token'), dataIndex: 'flpBalance', key: 'token', width: 120 },
  { title: t('users.columns.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 220 },
  { title: t('users.columns.actions'), key: 'actions', width: 160 },
])

const detailColumns = computed(() => [
  { title: t('users.detail.columns.operation'), dataIndex: 'operation', key: 'operation', width: 140 },
  { title: t('users.detail.columns.amount'), dataIndex: 'amount', key: 'amount', width: 140 },
  { title: t('users.detail.columns.reason'), dataIndex: 'reason', key: 'reason' },
  { title: t('users.detail.columns.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 200 },
])

const paginationConfig = computed(() => ({
  current: pagination.current,
  pageSize: pagination.pageSize,
  total: pagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total, range) =>
    t('users.pagination.total', { total, start: range?.[0] ?? 0, end: range?.[1] ?? 0 }),
}))

const detailPaginationConfig = computed(() => ({
  current: detailPagination.current,
  pageSize: detailPagination.pageSize,
  total: detailPagination.total,
  showSizeChanger: false,
}))

const formatDateTime = (value) => {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch (error) {
    return value
  }
}

const loadUsers = async ({ sortField, sortOrder, pageOverride } = {}) => {
  if (typeof pageOverride === 'number') {
    pagination.current = pageOverride
  }

  loading.value = true
  try {
    if (sortField) {
      sortState.field = sortField
    }
    if (sortOrder) {
      sortState.order = sortOrder
    }

    const { content, totalElements, page, size } = await fetchAdminUsers({
      page: pagination.current,
      size: pagination.pageSize,
      keyword: searchForm.keyword,
      sortOrder: sortState.field === 'createdAt' ? sortState.order : undefined,
      flp: sortState.field === 'flp' ? sortState.order : undefined,
    })
    tableData.value = (content || []).map((item) => ({
      ...item,
      avatarUrl: resolveProfileAsset(item?.avatarUrl),
    }))
    pagination.total = totalElements
    pagination.current = page
    pagination.pageSize = size
  } catch (error) {
    console.error('Failed to load users', error)
    message.error(t('users.messages.loadFailed'))
  } finally {
    loading.value = false
  }
}

const handleSearch = () => {
  pagination.current = 1
  loadUsers({ sortField: 'createdAt', sortOrder: 'DESC', pageOverride: 1 })
}

const handleTableChange = (pager) => {
  pagination.current = pager?.current ?? 1
  pagination.pageSize = pager?.pageSize ?? pagination.pageSize

  loadUsers({})
}

const toggleSort = (field) => {
  const isSameField = isSortFieldActive(field)
  const nextOrder = isSameField && sortState.order === 'ASC' ? 'DESC' : 'ASC'
  loadUsers({ sortField: field, sortOrder: nextOrder, pageOverride: 1 })
}

const loadUserLogs = async () => {
  if (!detailUser.value?.featureCode) {
    detailLogs.value = []
    detailPagination.total = 0
    return
  }

  detailLoading.value = true
  try {
    const { content, totalElements, page, size } = await fetchFlpLogs({
      page: detailPagination.current,
      size: detailPagination.pageSize,
      featureCode: detailUser.value.featureCode,
    })
    detailLogs.value = (content || []).filter((item) => item?.operation === 'INCREASE')
    detailPagination.total = totalElements
    detailPagination.current = page
    detailPagination.pageSize = size
  } catch (error) {
    console.error('Failed to load user FLP logs', error)
    message.error(t('users.messages.logLoadFailed'))
  } finally {
    detailLoading.value = false
  }
}

const openDetail = (record) => {
  detailUser.value = record
  detailPagination.current = 1
  detailVisible.value = true
  loadUserLogs()
}

const handleDetailTableChange = (pager) => {
  detailPagination.current = pager?.current ?? 1
  loadUserLogs()
}

const closeDetail = () => {
  detailVisible.value = false
  detailUser.value = null
  detailLogs.value = []
}

onMounted(() => {
  loadUsers()
})
</script>

<template>
  <div class="user-wrapper">
    <a-card :bordered="false" class="content-card">
      <header class="card-header">
        <div>
          <h2 class="card-title">{{ t('users.title') }}</h2>
          <p class="card-subtitle">{{ t('users.subtitle') }}</p>
        </div>
        <div class="search-bar">
          <a-input
            v-model:value="searchForm.keyword"
            :placeholder="t('users.search.placeholder')"
            allow-clear
            class="search-input"
          />
          <a-button type="primary" @click="handleSearch">{{ t('users.search.submit') }}</a-button>
        </div>
      </header>

      <a-table
        :columns="columns"
        :data-source="tableData"
        :loading="loading"
        :pagination="paginationConfig"
        row-key="id"
        class="users-table"
        @change="handleTableChange"
      >
        <template #headerCell="{ column }">
          <template v-if="column.key === 'createdAt'">
            <button
              :class="['sort-toggle', { active: isSortFieldActive('createdAt') }]"
              type="button"
              @click.stop="toggleSort('createdAt')"
            >
              <span>{{ t('users.columns.createdAt') }}</span>
              <span class="sort-indicator" aria-hidden="true">{{ getSortIndicator('createdAt') }}</span>
              <span class="sr-only">{{ getSortLabel('createdAt') }}</span>
            </button>
          </template>
          <template v-else-if="column.key === 'token'">
            <button
              :class="['sort-toggle', { active: isSortFieldActive('flp') }]"
              type="button"
              @click.stop="toggleSort('flp')"
            >
              <span>{{ t('users.columns.token') }}</span>
              <span class="sort-indicator" aria-hidden="true">{{ getSortIndicator('flp') }}</span>
              <span class="sr-only">{{ getSortLabel('flp') }}</span>
            </button>
          </template>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'avatar'">
            <a-avatar :src="record.avatarUrl" :alt="record.username" />
          </template>
          <template v-else-if="column.key === 'token'">
            <span class="token">{{ record.flpBalance ?? t('users.table.noToken') }}</span>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'actions'">
            <a-button
              size="small"
              type="text"
              class="detail-button"
              :title="t('users.table.actions.viewDetail')"
              :aria-label="t('users.table.actions.viewDetail')"
              @click="openDetail(record)"
            >
              <img :src="detailIcon" :alt="t('users.table.actions.viewDetail')" class="detail-icon" />
            </a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-drawer
      :open="detailVisible"
      :title="detailUser?.username || detailUser?.featureCode || t('users.detail.title')"
      width="480"
      @close="closeDetail"
    >
      <div v-if="detailUser" class="detail-summary">
        <div class="detail-row">
          <span class="label">{{ t('users.detail.fields.featureCode') }}</span>
          <span class="value">{{ detailUser.featureCode || '-' }}</span>
        </div>
        <div class="detail-row">
          <span class="label">{{ t('users.detail.fields.token') }}</span>
          <span class="value">{{ detailUser.flpBalance ?? t('users.table.noToken') }}</span>
        </div>
        <div class="detail-row">
          <span class="label">{{ t('users.detail.fields.createdAt') }}</span>
          <span class="value">{{ formatDateTime(detailUser.createdAt) }}</span>
        </div>
      </div>

      <a-divider />

      <h3 class="detail-title">{{ t('users.detail.logs.title') }}</h3>
      <p class="detail-subtitle">{{ t('users.detail.logs.subtitle') }}</p>

      <a-table
        :columns="detailColumns"
        :data-source="detailLogs"
        :loading="detailLoading"
        :pagination="detailPaginationConfig"
        row-key="id"
        size="small"
        @change="handleDetailTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'operation'">
            <a-tag :color="record.operation === 'DECREASE' ? 'red' : 'green'">
              {{ t(`users.detail.logs.operation.${record.operation?.toLowerCase() || 'increase'}`) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'amount'">
            <span :class="['amount', record.operation === 'DECREASE' ? 'negative' : 'positive']">
              {{ record.operation === 'DECREASE' ? '-' : '+' }}{{ record.amount ?? 0 }}
            </span>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>
        </template>
      </a-table>
    </a-drawer>
  </div>
</template>

<style scoped>
.user-wrapper {
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
  margin-bottom: 16px;
  gap: 16px;
}

.card-title {
  margin: 0;
  font-size: 1.4rem;
  font-weight: 600;
  color: #111827;
}

.card-subtitle {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 0.95rem;
}

.search-bar {
  display: flex;
  gap: 12px;
  align-items: center;
}

.search-input {
  width: 240px;
}

.users-table :deep(.ant-table-tbody > tr > td) {
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

.sort-toggle.active {
  color: #1d4ed8;
}

.sort-indicator {
  font-size: 0.9rem;
  line-height: 1;
  min-width: 1em;
  text-align: center;
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

.token {
  font-weight: 600;
  color: #2563eb;
}

.amount {
  font-weight: 600;
}

.amount.positive {
  color: #059669;
}

.amount.negative {
  color: #dc2626;
}

.detail-summary {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  color: #1f2937;
}

.detail-row .label {
  font-weight: 500;
  color: #6b7280;
}

.detail-title {
  margin: 0;
  font-size: 1.1rem;
  color: #111827;
}

.detail-subtitle {
  margin: 4px 0 12px;
  color: #6b7280;
}

@media (max-width: 768px) {
  .content-card {
    padding: 16px;
  }

  .card-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .search-bar {
    width: 100%;
  }

  .search-input {
    flex: 1;
  }
}
</style>
