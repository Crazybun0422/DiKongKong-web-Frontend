<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { banWorkGroup, fetchAdminWorkGroups } from '../../services/workGroups'

const { t } = useI18n()

const loading = ref(false)
const actionGroupId = ref('')
const tableData = ref([])

const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const columns = computed(() => [
  { title: t('groups.columns.name'), dataIndex: 'name', key: 'name', width: 220 },
  { title: t('groups.columns.avatar'), dataIndex: 'avatarUrl', key: 'avatar', width: 140 },
  { title: t('groups.columns.description'), dataIndex: 'description', key: 'description' },
  { title: t('groups.columns.markerCount'), dataIndex: 'markerCount', key: 'markerCount', width: 140 },
  { title: t('groups.columns.memberCount'), dataIndex: 'memberCount', key: 'memberCount', width: 140 },
  { title: t('groups.columns.updatedAt'), dataIndex: 'updatedAt', key: 'updatedAt', width: 200 },
  { title: t('groups.columns.actions'), key: 'actions', width: 200 },
])

const paginationConfig = computed(() => ({
  current: pagination.current,
  pageSize: pagination.pageSize,
  total: pagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total, range) => t('groups.pagination.total', { total, start: range?.[0] ?? 0, end: range?.[1] ?? 0 }),
}))

const formatDateTime = (value) => {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch (error) {
    return value
  }
}

const statusColor = (status) => (status === 'BANNED' ? 'red' : 'green')
const statusLabel = (status) => t(`groups.status.${status || 'ACTIVE'}`)

const loadGroups = async ({ pageOverride } = {}) => {
  if (typeof pageOverride === 'number') {
    pagination.current = pageOverride
  }

  loading.value = true
  try {
    const { content, totalElements, page, size } = await fetchAdminWorkGroups({
      page: pagination.current,
      size: pagination.pageSize,
    })

    tableData.value = content || []
    pagination.total = totalElements
    pagination.current = page
    pagination.pageSize = size
  } catch (error) {
    console.error('Failed to load work groups', error)
    message.error(t('groups.messages.loadFailed'))
  } finally {
    loading.value = false
  }
}

const handleTableChange = (pager) => {
  pagination.current = pager?.current ?? 1
  pagination.pageSize = pager?.pageSize ?? pagination.pageSize
  loadGroups()
}

const confirmBan = (record) => {
  Modal.confirm({
    title: t('groups.actions.confirmBanTitle', { name: record.name || t('groups.table.unnamed') }),
    content: t('groups.actions.confirmBanMessage'),
    okText: t('groups.actions.ban'),
    cancelText: t('profile.cancel'),
    okType: 'danger',
    onOk: () => banSelected(record),
  })
}

const banSelected = async (record) => {
  actionGroupId.value = record.id
  try {
    await banWorkGroup(record.id, { status: 'BANNED', reason: t('groups.actions.defaultBanReason') })
    message.success(t('groups.messages.banSuccess', { name: record.name || t('groups.table.unnamed') }))
    await loadGroups()
  } catch (error) {
    console.error('Failed to ban work group', error)
    message.error(t('groups.messages.banFailed'))
  } finally {
    actionGroupId.value = ''
  }
}

const handleDisband = () => {
  Modal.info({
    title: t('groups.actions.disband'),
    content: t('groups.actions.disbandPlaceholder'),
  })
}

onMounted(() => {
  loadGroups()
})
</script>

<template>
  <div class="groups-wrapper">
    <a-card :bordered="false" class="content-card">
      <header class="card-header">
        <div>
          <h2 class="card-title">{{ t('groups.title') }}</h2>
          <p class="card-subtitle">{{ t('groups.subtitle') }}</p>
        </div>
      </header>

      <a-table
        :columns="columns"
        :data-source="tableData"
        :loading="loading"
        :pagination="paginationConfig"
        row-key="id"
        class="groups-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <div class="name-cell">
              <span class="name-text">{{ record.name || t('groups.table.unnamed') }}</span>
              <a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag>
            </div>
          </template>

          <template v-else-if="column.key === 'avatar'">
            <div class="avatar-cell">
              <a-avatar v-if="record.avatarUrl" :src="record.avatarUrl" :size="48" />
              <span v-else class="placeholder">{{ t('groups.table.noAvatar') }}</span>
            </div>
          </template>

          <template v-else-if="column.key === 'description'">
            <div class="description-text">{{ record.description || t('groups.table.noDescription') }}</div>
          </template>

          <template v-else-if="column.key === 'markerCount'">
            <span>{{ record.markerCount ?? 0 }}</span>
          </template>

          <template v-else-if="column.key === 'memberCount'">
            <span>{{ record.memberCount ?? 0 }}</span>
          </template>

          <template v-else-if="column.key === 'updatedAt'">
            <span>{{ formatDateTime(record.updatedAt) }}</span>
          </template>

          <template v-else-if="column.key === 'actions'">
            <a-space>
              <a-button
                type="link"
                danger
                :loading="actionGroupId === record.id"
                :disabled="record.status === 'BANNED'"
                @click="confirmBan(record)"
              >
                {{ t('groups.actions.ban') }}
              </a-button>
              <a-button type="link" @click="handleDisband">{{ t('groups.actions.disband') }}</a-button>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<style scoped>
.groups-wrapper {
  width: 100%;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.card-title {
  margin: 0;
  font-size: 1.5rem;
  color: #1f1f1f;
}

.card-subtitle {
  margin: 0.35rem 0 0;
  color: #6b7280;
}

.groups-table :deep(.ant-table-thead > tr > th) {
  background: #f0f3ff;
  font-weight: 600;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.name-text {
  font-weight: 600;
}

.avatar-cell {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.placeholder {
  color: #9ca3af;
}

.description-text {
  max-width: 520px;
  color: #4b5563;
}

.groups-table :deep(.ant-table-row) td {
  vertical-align: middle;
}
</style>
