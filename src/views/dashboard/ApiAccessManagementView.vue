<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { CopyOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import {
  createApiAccessService,
  fetchApiAccessServices,
  updateApiAccessService,
} from '../../services/apiAccessServices'

const route = useRoute()
const router = useRouter()
const loading = ref(false)
const saving = ref(false)
const rows = ref([])
const modalVisible = ref(false)
const editingId = ref('')
const formRef = ref(null)
const filters = reactive({
  keyword: '',
  status: ['ACTIVE', 'EXPIRED'].includes(String(route.query.status || '').toUpperCase())
    ? String(route.query.status).toUpperCase()
    : 'ALL',
})
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })
const form = reactive({
  companyName: '',
  registeredDate: dayjs(),
  durationValue: 1,
  durationUnit: 'YEAR',
  customerContact: '',
})

const rules = {
  companyName: [{ required: true, message: '请输入公司名' }],
  registeredDate: [{ required: true, message: '请选择录入日期' }],
  durationValue: [{ required: true, message: '请输入服务时长' }],
  durationUnit: [{ required: true, message: '请选择时长单位' }],
  customerContact: [{ required: true, message: '请输入客户联系方式' }],
}

const columns = [
  { title: '公司名', dataIndex: 'companyName', key: 'companyName', width: 180, fixed: 'left' },
  { title: '客户联系方式', dataIndex: 'customerContact', key: 'customerContact', width: 190 },
  { title: '录入日期', dataIndex: 'registeredDate', key: 'registeredDate', width: 125 },
  { title: '服务时长', key: 'duration', width: 110 },
  { title: '到期日期', dataIndex: 'expiresOn', key: 'expiresOn', width: 125 },
  { title: '倒计时', key: 'countdown', width: 130 },
  { title: '服务 Key', dataIndex: 'serviceKey', key: 'serviceKey', width: 310 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'actions', width: 90, fixed: 'right' },
]

const paginationConfig = computed(() => ({
  current: pagination.current,
  pageSize: pagination.pageSize,
  total: pagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total) => `共 ${total} 项`,
}))

const modalTitle = computed(() => (editingId.value ? '编辑API接入服务' : '新增API接入服务'))
const maxDuration = computed(() => (form.durationUnit === 'YEAR' ? 20 : 120))
const expiryPreview = computed(() => {
  if (!form.registeredDate || !form.durationValue) return '-'
  const unit = form.durationUnit === 'MONTH' ? 'month' : 'year'
  return dayjs(form.registeredDate).add(Number(form.durationValue), unit).format('YYYY-MM-DD')
})

const errorText = (error, fallback) => error?.response?.data?.message?.zh || fallback

const loadList = async () => {
  loading.value = true
  try {
    const result = await fetchApiAccessServices({
      page: pagination.current,
      size: pagination.pageSize,
      keyword: filters.keyword,
      status: filters.status,
    })
    rows.value = result.content
    pagination.current = result.page
    pagination.pageSize = result.size
    pagination.total = result.totalElements
  } catch (error) {
    console.error('Failed to load API access services', error)
    message.error(errorText(error, 'API接入服务加载失败'))
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  editingId.value = ''
  form.companyName = ''
  form.registeredDate = dayjs()
  form.durationValue = 1
  form.durationUnit = 'YEAR'
  form.customerContact = ''
  formRef.value?.clearValidate?.()
}

const openCreate = () => {
  resetForm()
  modalVisible.value = true
}

const openEdit = (record) => {
  editingId.value = record.id
  form.companyName = record.companyName || ''
  form.registeredDate = record.registeredDate ? dayjs(record.registeredDate) : dayjs()
  form.durationValue = Number(record.durationValue) || 1
  form.durationUnit = record.durationUnit === 'MONTH' ? 'MONTH' : 'YEAR'
  form.customerContact = record.customerContact || ''
  modalVisible.value = true
}

const submit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const durationValue = Number(form.durationValue)
  if (!Number.isInteger(durationValue) || durationValue < 1 || durationValue > maxDuration.value) {
    message.warning(`服务时长请输入 1-${maxDuration.value} 的整数`)
    return
  }
  const payload = {
    companyName: form.companyName.trim(),
    registeredDate: dayjs(form.registeredDate).format('YYYY-MM-DD'),
    durationValue,
    durationUnit: form.durationUnit,
    customerContact: form.customerContact.trim(),
  }
  saving.value = true
  try {
    if (editingId.value) {
      await updateApiAccessService(editingId.value, payload)
      message.success('API接入服务已更新')
    } else {
      await createApiAccessService(payload)
      message.success('API接入服务已创建，服务Key已生成')
    }
    modalVisible.value = false
    pagination.current = 1
    await loadList()
  } catch (error) {
    console.error('Failed to save API access service', error)
    message.error(errorText(error, 'API接入服务保存失败'))
  } finally {
    saving.value = false
  }
}

const copyText = async (value) => {
  if (!value) return
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
    } else {
      const input = document.createElement('textarea')
      input.value = value
      input.style.position = 'fixed'
      input.style.opacity = '0'
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      document.body.removeChild(input)
    }
    message.success('服务Key已复制')
  } catch (error) {
    console.error('Failed to copy service key', error)
    message.error('复制失败，请手动复制')
  }
}

const onSearch = () => {
  pagination.current = 1
  loadList()
}

const onStatusChange = (value) => {
  filters.status = value
  pagination.current = 1
  router.replace({ query: value === 'ALL' ? {} : { status: value } }).catch(() => {})
  loadList()
}

const onTableChange = (pager) => {
  pagination.current = pager.current || 1
  pagination.pageSize = pager.pageSize || 20
  loadList()
}

const durationText = (record) => `${record.durationValue}${record.durationUnit === 'MONTH' ? '个月' : '年'}`
const countdownText = (record) => {
  if (record.status === 'EXPIRED') {
    return Number(record.expiredDays) > 0 ? `已到期 ${record.expiredDays} 天` : '今天到期'
  }
  return `剩余 ${record.remainingDays} 天`
}
const rowClassName = (record) => (record.status === 'EXPIRED' ? 'api-row-expired' : '')

watch(
  () => route.query.status,
  (value) => {
    const next = ['ACTIVE', 'EXPIRED'].includes(String(value || '').toUpperCase())
      ? String(value).toUpperCase()
      : 'ALL'
    if (next !== filters.status) {
      filters.status = next
      pagination.current = 1
      loadList()
    }
  },
)

onMounted(loadList)
</script>

<template>
  <div class="api-access-page">
    <header class="page-header">
      <div>
        <div class="page-kicker">B端 API EXTENSION</div>
        <h1>API接入管理</h1>
        <p>管理企业接入期限、客户联系方式和服务凭证。</p>
      </div>
      <div class="header-actions">
        <a-button :loading="loading" @click="loadList"><ReloadOutlined />刷新</a-button>
        <a-button type="primary" @click="openCreate"><PlusOutlined />新增接入</a-button>
      </div>
    </header>

    <section class="filter-bar">
      <a-input-search
        v-model:value="filters.keyword"
        class="keyword-search"
        allow-clear
        placeholder="搜索公司名或联系方式"
        @search="onSearch"
      />
      <a-segmented
        :value="filters.status"
        :options="[
          { label: '全部', value: 'ALL' },
          { label: '服务中', value: 'ACTIVE' },
          { label: '已到期', value: 'EXPIRED' },
        ]"
        @change="onStatusChange"
      />
    </section>

    <a-table
      class="api-access-table"
      row-key="id"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="paginationConfig"
      :scroll="{ x: 1480 }"
      :row-class-name="rowClassName"
      @change="onTableChange"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'duration'">{{ durationText(record) }}</template>
        <template v-else-if="column.key === 'countdown'">
          <strong :class="record.status === 'EXPIRED' ? 'expired-text' : 'active-countdown'">{{ countdownText(record) }}</strong>
        </template>
        <template v-else-if="column.key === 'serviceKey'">
          <div class="service-key-cell">
            <code>{{ record.serviceKey }}</code>
            <a-tooltip title="复制服务Key">
              <a-button type="text" size="small" @click="copyText(record.serviceKey)"><CopyOutlined /></a-button>
            </a-tooltip>
          </div>
        </template>
        <template v-else-if="column.key === 'status'">
          <a-tag :color="record.status === 'EXPIRED' ? 'red' : 'green'">
            {{ record.status === 'EXPIRED' ? '已到期' : '服务中' }}
          </a-tag>
        </template>
        <template v-else-if="column.key === 'actions'">
          <a-button type="link" size="small" @click="openEdit(record)"><EditOutlined />编辑</a-button>
        </template>
      </template>
    </a-table>

    <a-modal
      v-model:open="modalVisible"
      :title="modalTitle"
      :confirm-loading="saving"
      ok-text="保存"
      cancel-text="取消"
      :mask-closable="false"
      @ok="submit"
      @cancel="resetForm"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical" class="api-access-form">
        <a-form-item label="公司名" name="companyName">
          <a-input v-model:value="form.companyName" :maxlength="120" placeholder="请输入公司名称" />
        </a-form-item>
        <a-form-item label="录入日期" name="registeredDate">
          <a-date-picker v-model:value="form.registeredDate" :allow-clear="false" :disabled-date="(date) => date && date.isAfter(dayjs(), 'day')" />
        </a-form-item>
        <div class="duration-grid">
          <a-form-item label="服务时长" name="durationValue">
            <a-input-number v-model:value="form.durationValue" :min="1" :max="maxDuration" :precision="0" />
          </a-form-item>
          <a-form-item label="单位" name="durationUnit">
            <a-select v-model:value="form.durationUnit">
              <a-select-option value="YEAR">年</a-select-option>
              <a-select-option value="MONTH">月</a-select-option>
            </a-select>
          </a-form-item>
        </div>
        <div class="expiry-preview">预计到期：<strong>{{ expiryPreview }}</strong></div>
        <a-form-item label="客户联系方式" name="customerContact">
          <a-textarea v-model:value="form.customerContact" :maxlength="200" :rows="3" show-count placeholder="手机号、微信、邮箱或其他联系方式" />
        </a-form-item>
        <div v-if="editingId" class="key-preserve-tip">编辑资料不会改变已经生成的服务Key。</div>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.api-access-page { min-height: 100%; }
.page-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 24px; }
.page-header h1 { margin: 6px 0 4px; color: #111827; font-size: 28px; }
.page-header p { margin: 0; color: #6b7280; }
.page-kicker { color: #2563eb; font-size: 12px; font-weight: 800; letter-spacing: .12em; }
.header-actions { display: flex; gap: 10px; }
.filter-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; padding: 16px; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; }
.keyword-search { width: min(420px, 100%); }
.api-access-table { overflow: hidden; border: 1px solid #e5e7eb; border-radius: 12px; background: #fff; }
.service-key-cell { display: flex; align-items: center; gap: 6px; }
.service-key-cell code { color: #1f2937; font-size: 12px; white-space: nowrap; user-select: all; }
.expired-text { color: #dc2626; }
.active-countdown { color: #15803d; }
.duration-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.duration-grid :deep(.ant-input-number), .duration-grid :deep(.ant-select), .api-access-form :deep(.ant-picker) { width: 100%; }
.expiry-preview { margin: -10px 0 18px; padding: 10px 12px; border-radius: 8px; color: #4b5563; background: #f3f4f6; }
.key-preserve-tip { padding: 10px 12px; border-radius: 8px; color: #92400e; background: #fffbeb; }
:deep(.api-row-expired > td) { background: #fff5f5 !important; }
:deep(.api-row-expired:hover > td) { background: #ffe8e8 !important; }
@media (max-width: 760px) {
  .page-header, .filter-bar { flex-direction: column; align-items: stretch; }
  .header-actions { justify-content: flex-end; }
  .duration-grid { grid-template-columns: 1fr; gap: 0; }
}
</style>
