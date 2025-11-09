<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { fetchPendingMarkersCount, MARKER_REVIEW_STATUS } from '../../services/markers'
import { fetchOrders } from '../../services/orders'

const { t } = useI18n()
const router = useRouter()

const pendingCount = ref(0)
const loading = ref(false)

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

const orderColumns = computed(() => [
  { title: t('orders.table.columns.orderNumber'), dataIndex: 'orderNumber', key: 'orderNumber', width: 180 },
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
  showTotal: (total, range) =>
    t('orders.pagination.total', { total, start: range?.[0] ?? 0, end: range?.[1] ?? 0 }),
}))

const orderStatusColors = {
  WAITING_PAYMENT: 'orange',
  PAID: 'green',
  REFUNDED: 'blue',
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
    default:
      return t('orders.paymentType.unknown')
  }
}

const loadPendingCount = async () => {
  loading.value = true
  try {
    const count = await fetchPendingMarkersCount()
    pendingCount.value = count ?? 0
  } catch (error) {
    console.error('Failed to load pending markers count', error)
  } finally {
    loading.value = false
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
  router.push({
    name: 'airspace',
    query: { status: MARKER_REVIEW_STATUS.PENDING },
  }).catch(() => { })
}

onMounted(() => {
  loadPendingCount()
  loadOrderSummary()
})
</script>

<template>
  <div class="home-wrapper">
    <div class="cards-container">
      <button class="summary-card" type="button" @click="goToPendingMarkers">
        <span class="value">{{ loading ? '...' : pendingCount }}</span>
        <span class="label">
          {{ t('dashboard.pending') }}
          <span aria-hidden="true"> ></span>
        </span>
      </button>
      <button class="summary-card" type="button" @click="openOrdersModal">
        <span class="value">{{ orderSummaryLoading ? '...' : orderCount }}</span>
        <span class="label">
          {{ t('orders.summary.title') }}
          <span aria-hidden="true"> ></span>
        </span>
      </button>
    </div>



    <a-modal :open="ordersVisible" :title="t('orders.modal.title')" width="960px" :destroy-on-close="true"
      @cancel="closeOrdersModal">
      <template #footer>
        <a-button @click="closeOrdersModal">{{ t('orders.modal.close') }}</a-button>
      </template>

      <a-table :columns="orderColumns" :data-source="ordersTableData" :loading="ordersLoading"
        :pagination="orderPaginationConfig" row-key="id" class="orders-table" @change="handleOrdersTableChange">
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
.home-wrapper {
  min-height: 320px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding-left: clamp(24px, 10vw, 72px);
}

.cards-container {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
}

.summary-card {
  width: 240px;
  height: 160px;
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  color: #111827;
  cursor: pointer;
  border: none;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.summary-card:focus-visible {
  outline: 3px solid rgba(99, 102, 241, 0.4);
}

.summary-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 16px 36px rgba(15, 23, 42, 0.18);
}

.value {
  font-size: 3rem;
  font-weight: 600;
}

.label {
  font-size: 0.95rem;
  color: #1f3d99;
  display: flex;
  align-items: center;
  gap: 4px;
}

.orders-table {
  margin-top: 8px;
}
</style>
