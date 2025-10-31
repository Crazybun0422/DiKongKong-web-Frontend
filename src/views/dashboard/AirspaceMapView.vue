<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Modal, message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { fetchMarkers, reviewMarker, MARKER_REVIEW_STATUS } from '../../services/markers'
import detailIcon from '../../assets/img/detail.png'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const loading = ref(false)
const tableData = ref([])
const activeStatus = ref(MARKER_REVIEW_STATUS.ALL)
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const detailVisible = ref(false)
const detailRecord = ref(null)

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

const statusTabs = computed(() => [
  { key: MARKER_REVIEW_STATUS.ALL, label: t('airspace.tabs.all') },
  { key: MARKER_REVIEW_STATUS.PENDING, label: t('airspace.tabs.pending') },
  { key: MARKER_REVIEW_STATUS.APPROVED, label: t('airspace.tabs.approved') },
  { key: MARKER_REVIEW_STATUS.REJECTED, label: t('airspace.tabs.rejected') },
])

const statusColors = {
  PENDING: 'gold',
  APPROVED: 'green',
  REJECTED: 'red',
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

const canReviewRecord = (record) => record?.paid && record?.reviewStatus === MARKER_REVIEW_STATUS.PENDING

const columns = computed(() => [
  { title: t('airspace.table.columns.name'), dataIndex: 'name', key: 'name' },
  { title: t('airspace.table.columns.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 180 },
  { title: t('airspace.table.columns.status'), dataIndex: 'reviewStatus', key: 'status', width: 140 },
  { title: t('airspace.table.columns.paid'), dataIndex: 'paid', key: 'paid', width: 140 },
  { title: t('airspace.table.columns.actions'), key: 'actions', width: 220 },
])

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
    const { content, totalElements, page, size } = await fetchMarkers({
      page: pagination.current,
      size: pagination.pageSize,
      status: activeStatus.value,
    })
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

const handleTabChange = (key) => {
  const nextStatus = normalizeStatus(key)
  if (activeStatus.value !== nextStatus) {
    activeStatus.value = nextStatus
    pagination.current = 1
    loadData()
  }
  updateRouteStatus(nextStatus)
}

const handleTableChange = (pager) => {
  pagination.current = pager?.current ?? 1
  pagination.pageSize = pager?.pageSize ?? pagination.pageSize
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
      </header>
      <a-tabs :active-key="activeStatus" @change="handleTabChange" class="status-tabs">
        <a-tab-pane v-for="tab in statusTabs" :key="tab.key" :tab="tab.label" />
      </a-tabs>
      <a-table :columns="columns" :data-source="tableData" :loading="loading" :pagination="paginationConfig"
        row-key="id" class="markers-table" @change="handleTableChange">
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
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusColors[record.reviewStatus] || 'default'">
              {{ statusText(record.reviewStatus) }}
            </a-tag>
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
              <a-button v-if="record.reviewStatus === MARKER_REVIEW_STATUS.PENDING" type="link" size="small"
                :disabled="!record.paid" @click="handleReview(record, MARKER_REVIEW_STATUS.APPROVED)">
                {{ t('airspace.table.actions.approve') }}
              </a-button>
              <a-button v-if="record.reviewStatus === MARKER_REVIEW_STATUS.PENDING" type="link" size="small" danger
                :disabled="!record.paid" @click="handleReview(record, MARKER_REVIEW_STATUS.REJECTED)">
                {{ t('airspace.table.actions.reject') }}
              </a-button>
            </div>
          </template>
        </template>
      </a-table>
    </a-card>

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
            <a-descriptions-item :label="t('airspace.modal.fields.location')" :span="2">
              {{ detailRecord?.location?.text || t('airspace.table.placeholders.unknownLocation') }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.phone')">
              {{ detailRecord.phone || t('airspace.table.placeholders.notProvided') }}
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.status')">
              <a-tag :color="statusColors[detailRecord.reviewStatus] || 'default'">
                {{ statusText(detailRecord.reviewStatus) }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item :label="t('airspace.modal.fields.paid')">
              <a-tag :color="detailRecord.paid ? 'green' : 'orange'">
                {{ detailRecord.paid ? t('airspace.paidStatus.paid') : t('airspace.paidStatus.unpaid') }}
              </a-tag>
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

        <section class="detail-section" v-if="detailRecord.attachmentUrls?.length">
          <h3>{{ t('airspace.modal.sections.attachments') }}</h3>
          <ul class="link-list">
            <li v-for="url in detailRecord.attachmentUrls" :key="url">
              <a-typography-link :href="url" target="_blank" rel="noopener noreferrer">
                {{ url }}
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

        <section class="detail-section" v-if="detailRecord.videoChannelUrls?.length">
          <h3>{{ t('airspace.modal.sections.videoChannels') }}</h3>
          <ul class="link-list">
            <li v-for="url in detailRecord.videoChannelUrls" :key="url">
              <a-typography-link :href="url" target="_blank" rel="noopener noreferrer">
                {{ url }}
              </a-typography-link>
            </li>
          </ul>
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

.status-tabs {
  margin-bottom: 16px;
}

.markers-table :deep(.ant-table-tbody > tr > td) {
  vertical-align: middle;
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
