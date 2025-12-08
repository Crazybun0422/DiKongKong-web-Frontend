<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import OpenPlatformEditor from '../../components/OpenPlatformEditor.vue'
import { fetchTemplateSettings } from '../../services/config'
import {
  createSubscriptionPush,
  fetchLatestPushContent,
  fetchSubscriptionPushes,
  updateLatestPushContent,
} from '../../services/weappSubscriptions'
import { API_BASE_URL } from '../../services/http'
import dayjs from 'dayjs'

const LANDING_TEMPLATE_NAME = '运营活动通知'

const { t } = useI18n()

const templateSettings = reactive({
  templates: {},
  updatedAt: null,
})
const templateSettingsLoading = ref(false)

const formRef = ref(null)
const submissionLoading = ref(false)
const landingModalVisible = ref(false)
const landingLoading = ref(false)
const landingSaving = ref(false)
const listLoading = ref(false)
const taskSocket = ref(null)

const formState = reactive({
  templateId: '',
  templateName: '',
  templateData: [{ key: '', value: '' }],
  registrationRange: 'ALL',
  registrationDateRange: [],
  flpMin: null,
  flpMax: null,
  likeMin: null,
  likeMax: null,
  pushContent: '',
  page: '',
})

const tableData = ref([])
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})
const selectedPushId = ref(null)
const selectedPushRecord = ref(null)

const templateOptions = computed(() =>
  Object.entries(templateSettings.templates || {}).map(([templateName, config]) => {
    const templateId = typeof config === 'string' ? config : config?.templateId
    const details = Array.isArray(config?.details) ? config.details : []
    const page = typeof config === 'object' ? config?.page || '' : ''
    return {
      label: templateName,
      value: templateId,
      key: templateName,
      details,
      page,
    }
  }),
)

const templateIdNameMap = computed(() =>
  Object.entries(templateSettings.templates || {}).reduce((acc, [templateName, config]) => {
    const templateId = typeof config === 'string' ? config : config?.templateId
    if (templateId) {
      acc[templateId] = templateName
    }
    return acc
  }, {}),
)
const templateDetailReverseMap = computed(() =>
  Object.entries(templateSettings.templates || {}).reduce((acc, [_templateName, config]) => {
    const templateId = typeof config === 'string' ? config : config?.templateId
    const details = Array.isArray(config?.details) ? config.details : []
    if (!templateId) return acc
    const detailMap = {}
    details.forEach((item) => {
      const field = (item?.field || '').trim()
      const value = (item?.value || '').trim()
      if (value && field) {
        detailMap[value] = field
      }
    })
    acc[templateId] = detailMap
    return acc
  }, {}),
)

const selectedTemplateName = computed(
  () => formState.templateName || templateIdNameMap.value[formState.templateId] || '',
)
const selectedTemplatePage = computed(() => {
  if (formState.page) return formState.page
  const option = templateOptions.value.find((item) => item.value === formState.templateId)
  return option?.page || ''
})

// Landing content is now editable for all templates.
const canEditLanding = computed(() => true)
const detailKeyMap = computed(() => {
  const option = templateOptions.value.find((item) => item.value === formState.templateId)
  const map = {}
  if (Array.isArray(option?.details)) {
    option.details.forEach((d) => {
      const field = (d?.field || '').trim()
      const value = (d?.value || '').trim()
      if (!value && !field) return
      if (field) map[field] = value || field
      if (value) map[value] = value
    })
  }
  return map
})
const selectedTemplateDetails = computed(() => {
  const option = templateOptions.value.find((item) => item.value === formState.templateId)
  return Array.isArray(option?.details) ? option.details.filter((d) => d?.value || d?.field) : []
})
const satisfiedDetailTags = computed(() => {
  const keys = formState.templateData.map((item) => (item.key || '').trim()).filter(Boolean)
  return new Set(keys)
})
const allDetailsSatisfied = computed(() => {
  const tags = selectedTemplateDetails.value
  if (!tags.length) return false
  return tags.every((tag) => satisfiedDetailTags.value.has(tag.field || tag.value))
})

const registrationOptions = computed(() => [
  { value: 'ALL', label: t('subscriptionPush.form.registrationOptions.all') },
  { value: 'TODAY', label: t('subscriptionPush.form.registrationOptions.today') },
  { value: 'LAST_7_DAYS', label: t('subscriptionPush.form.registrationOptions.last7Days') },
  { value: 'BETWEEN', label: t('subscriptionPush.form.registrationOptions.between') },
  { value: 'FLP', label: t('subscriptionPush.form.registrationOptions.flp') },
  { value: 'LIKE', label: t('subscriptionPush.form.registrationOptions.like') },
])

const rules = computed(() => ({
  templateId: [{ required: true, message: t('subscriptionPush.form.validation.templateId') }],
  registrationRange: [{ required: true, message: t('subscriptionPush.form.validation.registrationRange') }],
  registrationDateRange: [
    {
      validator: async (_rule, value) => {
        if (formState.registrationRange !== 'BETWEEN') return Promise.resolve()
        if (!value || value.length !== 2) {
          return Promise.reject(new Error(t('subscriptionPush.form.validation.registrationDateRange')))
        }
        return Promise.resolve()
      },
    },
  ],
}))

const columns = computed(() => [
  { title: t('subscriptionPush.table.columns.template'), dataIndex: 'templateId', key: 'templateId', width: 200 },
  { title: t('subscriptionPush.table.columns.templateData'), dataIndex: 'templateData', key: 'templateData' },
  { title: t('subscriptionPush.table.columns.registration'), dataIndex: 'registrationRange', key: 'registrationRange', width: 200 },
  { title: t('subscriptionPush.table.columns.progress'), key: 'progress', width: 360 },
  { title: t('subscriptionPush.table.columns.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 200 },
])

const paginationConfig = computed(() => ({
  current: pagination.current,
  pageSize: pagination.pageSize,
  total: pagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total, range) =>
    t('subscriptionPush.table.pagination.total', {
      total,
      start: range?.[0] ?? 0,
      end: range?.[1] ?? 0,
    }),
}))

const addTemplateDataRow = () => {
  if (allDetailsSatisfied.value) return
  formState.templateData.push({ key: '', value: '' })
}

const detailTagClass = (tag) => (satisfiedDetailTags.value.has(tag) ? 'tag-satisfied' : 'tag-pending')

const removeTemplateDataRow = (index) => {
  if (formState.templateData.length <= 1) return
  formState.templateData.splice(index, 1)
}

const resetForm = () => {
  formState.templateId = ''
  formState.templateName = ''
  formState.templateData = [{ key: '', value: '' }]
  formState.registrationRange = 'ALL'
  formState.registrationDateRange = []
  formState.flpMin = null
  formState.flpMax = null
  formState.likeMin = null
  formState.likeMax = null
  formState.pushContent = ''
  formState.page = ''
}

const handleTemplateChange = (value, option) => {
  formState.templateId = value
  formState.templateName = option?.label || option?.key || ''
  const detailsList = Array.isArray(option?.details) ? option.details.filter((d) => d?.value) : []
  formState.templateData =
    detailsList.length > 0
      ? detailsList.map((item) => ({ key: item.field || item.value || '', value: '' }))
      : [{ key: '', value: '' }]
  formState.page = option?.page || ''
}

const handleRegistrationChange = (value) => {
  formState.registrationRange = value
  if (value !== 'BETWEEN') {
    formState.registrationDateRange = []
  }
  if (value !== 'FLP') {
    formState.flpMin = null
    formState.flpMax = null
  }
  if (value !== 'LIKE') {
    formState.likeMin = null
    formState.likeMax = null
  }
}

const toNullableNumber = (value, toInteger = false) => {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = toInteger ? parseInt(value, 10) : Number(value)
  if (Number.isNaN(parsed)) return undefined
  return parsed
}

const buildTemplateDataPayload = () => {
  const payload = {}
  formState.templateData.forEach(({ key, value }) => {
    const trimmedKey = (key || '').trim()
    if (!trimmedKey) return
    const resolvedKey = detailKeyMap.value[trimmedKey] || trimmedKey
    payload[resolvedKey] = typeof value === 'string' ? value.trim() : value ?? ''
  })
  return payload
}

watch(
  () => templateSettings.templates,
  () => {
    if (selectedPushRecord.value) {
      loadRecordToForm(selectedPushRecord.value)
    }
  },
  { deep: true },
)

const validateRanges = () => {
  if (
    formState.flpMin !== null &&
    formState.flpMax !== null &&
    formState.flpMin !== undefined &&
    formState.flpMax !== undefined &&
    Number(formState.flpMin) > Number(formState.flpMax)
  ) {
    message.warning(t('subscriptionPush.form.validation.flpRange'))
    return false
  }
  if (
    formState.likeMin !== null &&
    formState.likeMax !== null &&
    formState.likeMin !== undefined &&
    formState.likeMax !== undefined &&
    Number(formState.likeMin) > Number(formState.likeMax)
  ) {
    message.warning(t('subscriptionPush.form.validation.likeRange'))
    return false
  }
  return true
}

const handleSubmit = async () => {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }

  if (!validateRanges()) {
    return
  }

  submissionLoading.value = true
  try {
    const dateRange = formState.registrationDateRange || []
    const registrationRangeForPayload =
      formState.registrationRange === 'FLP' || formState.registrationRange === 'LIKE'
        ? 'ALL'
        : formState.registrationRange
    const payload = {
      templateId: formState.templateId,
      templateData: buildTemplateDataPayload(),
      registrationRange: registrationRangeForPayload,
      registrationStart:
        formState.registrationRange === 'BETWEEN' && dateRange?.[0]?.format
          ? dateRange[0].format('YYYY-MM-DD')
          : undefined,
      registrationEnd:
        formState.registrationRange === 'BETWEEN' && dateRange?.[1]?.format
          ? dateRange[1].format('YYYY-MM-DD')
          : undefined,
      flpMin: formState.registrationRange === 'FLP' ? toNullableNumber(formState.flpMin) : undefined,
      flpMax: formState.registrationRange === 'FLP' ? toNullableNumber(formState.flpMax) : undefined,
      likeMin: formState.registrationRange === 'LIKE' ? toNullableNumber(formState.likeMin, true) : undefined,
      likeMax: formState.registrationRange === 'LIKE' ? toNullableNumber(formState.likeMax, true) : undefined,
      pushContent: formState.pushContent,
      page: selectedTemplatePage.value || undefined,
    }

    await createSubscriptionPush(payload)
    message.success(t('subscriptionPush.form.messages.submitSuccess'))
    resetForm()
    loadPushes(1)
  } catch (error) {
    console.error('Failed to create subscription push', error)
    message.error(t('subscriptionPush.form.messages.submitFailed'))
  } finally {
    submissionLoading.value = false
  }
}

const loadTemplateSettings = async () => {
  templateSettingsLoading.value = true
  try {
    const data = await fetchTemplateSettings()
    templateSettings.templates = data?.templates || {}
    templateSettings.updatedAt = data?.updatedAt || null
  } catch (error) {
    console.error('Failed to load template settings', error)
    message.error(t('subscriptionPush.messages.templatesLoadFailed'))
  } finally {
    templateSettingsLoading.value = false
  }
}

const loadPushes = async (pageOverride) => {
  if (typeof pageOverride === 'number') {
    pagination.current = pageOverride
  }

  listLoading.value = true
  try {
    const { content, totalElements, page, size } = await fetchSubscriptionPushes({
      page: pagination.current,
      size: pagination.pageSize,
    })
    tableData.value = (content || []).map((item) => ({
      ...item,
      taskSnapshot:
        item?.lastTaskId || item?.lastTaskStatus
          ? (() => {
            const processed = (item.lastSendSuccessCount || 0) + (item.lastSendFailureCount || 0)
            const total = item.totalTargets || item.processedCount || processed || 0
            const percent = total > 0 ? Math.min(Math.round((processed / total) * 100), 100) : 0
            return {
              id: item.lastTaskId,
              status: item.lastTaskStatus || 'PENDING',
              progressPercent: typeof item.progressPercent === 'number' ? item.progressPercent : percent,
              successCount: item.lastSendSuccessCount ?? 0,
              failureCount: item.lastSendFailureCount ?? 0,
              totalTargets: total || undefined,
              processedCount: processed || undefined,
            }
          })()
          : null,
    }))
    pagination.total = totalElements
    pagination.current = page
    pagination.pageSize = size
    if (!selectedPushId.value && tableData.value.length) {
      handleSelectPush(tableData.value[0])
    }
  } catch (error) {
    console.error('Failed to load subscription pushes', error)
    message.error(t('subscriptionPush.messages.listLoadFailed'))
  } finally {
    listLoading.value = false
  }
}

const handleTableChange = (pager) => {
  pagination.current = pager?.current ?? 1
  pagination.pageSize = pager?.pageSize ?? pagination.pageSize
  loadPushes()
}

const loadRecordToForm = (record) => {
  if (!record) return
  selectedPushId.value = record.id
  selectedPushRecord.value = record
  formState.templateId = record.templateId || ''
  formState.templateName = templateIdNameMap.value[record.templateId] || record.templateName || ''

  const reverseMap = templateDetailReverseMap.value[record.templateId] || {}
  const dataEntries = Object.entries(record.templateData || {})
  formState.templateData =
    dataEntries.length > 0
      ? dataEntries.map(([k, v]) => ({ key: reverseMap[k] || k, value: v }))
      : [{ key: '', value: '' }]

  formState.registrationRange = record.registrationRange || 'ALL'
  if (record.registrationRange === 'BETWEEN' && record.registrationStart && record.registrationEnd) {
    formState.registrationDateRange = [dayjs(record.registrationStart), dayjs(record.registrationEnd)]
  } else {
    formState.registrationDateRange = []
  }

  formState.flpMin = record.flpMin ?? null
  formState.flpMax = record.flpMax ?? null
  formState.likeMin = record.likeMin ?? null
  formState.likeMax = record.likeMax ?? null
  formState.pushContent = record.pushContent || ''
  formState.page = record.page || ''
}

const handleSelectPush = (record) => {
  loadRecordToForm(record)
}

const openLandingModal = () => {
  landingModalVisible.value = true
  loadLatestLandingContent()
}

const closeLandingModal = () => {
  landingModalVisible.value = false
}

const formatRegistration = (record) => {
  const range = record?.registrationRange || 'ALL'
  const rangeLabel = registrationOptions.value.find((item) => item.value === range)?.label || range
  if (range === 'BETWEEN') {
    const start = record?.registrationStart
    const end = record?.registrationEnd
    return start && end ? `${rangeLabel} | ${start} ~ ${end}` : rangeLabel
  }
  return rangeLabel
}

const formatTemplateDataList = (data, templateId) => {
  const entries = Object.entries(data || {})
  if (!entries.length) return [t('subscriptionPush.table.empty')]
  const reverseMap = templateDetailReverseMap.value[templateId] || {}
  return entries.map(([k, v]) => {
    const displayKey = reverseMap[k] || k
    return `${displayKey}: ${v}`
  })
}

const formatDateTime = (value) => {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch (error) {
    return value
  }
}

const resolveStatusLabel = (status) => {
  if (!status) return t('subscriptionPush.table.progress.notStarted')
  const key = String(status).toLowerCase()
  const translated = t(`subscriptionPush.status.${key}`)
  return translated || status
}

const getProgressPercent = (task) => {
  if (!task || typeof task.progressPercent !== 'number') return 0
  if (!Number.isFinite(task.progressPercent)) return 0
  return Math.min(Math.max(task.progressPercent, 0), 100)
}

const applyTaskUpdate = (task) => {
  if (!task || (!task.pushId && !task.id)) return
  tableData.value = tableData.value.map((row) => {
    const matchesByPushId = task.pushId && row.id === task.pushId
    const matchesByTaskId = task.id && (row.lastTaskId === task.id || row.taskSnapshot?.id === task.id)
    if (!matchesByPushId && !matchesByTaskId) return row
    return {
      ...row,
      lastTaskId: task.id ?? row.lastTaskId,
      taskSnapshot: {
        id: task.id ?? row.taskSnapshot?.id,
        pushId: task.pushId ?? row.taskSnapshot?.pushId,
        status: task.status ?? row.taskSnapshot?.status,
        progressPercent: typeof task.progressPercent === 'number' ? task.progressPercent : row.taskSnapshot?.progressPercent,
        successCount: task.successCount ?? row.taskSnapshot?.successCount,
        failureCount: task.failureCount ?? row.taskSnapshot?.failureCount,
        totalTargets: task.totalTargets ?? row.taskSnapshot?.totalTargets ?? task.processedCount,
        processedCount: task.processedCount ?? row.taskSnapshot?.processedCount,
        message: task.message ?? row.taskSnapshot?.message,
        startedAt: task.startedAt ?? row.taskSnapshot?.startedAt,
        finishedAt: task.finishedAt ?? row.taskSnapshot?.finishedAt,
      },
    }
  })
}

const loadLatestLandingContent = async () => {
  landingLoading.value = true
  try {
    const latest = await fetchLatestPushContent()
    if (typeof latest?.pushContent === 'string') {
      formState.pushContent = latest.pushContent
    }
  } catch (error) {
    console.error('Failed to load latest landing content', error)
    message.error(t('subscriptionPush.messages.templatesLoadFailed'))
  } finally {
    landingLoading.value = false
  }
}

const submitLandingContent = async () => {
  landingSaving.value = true
  try {
    await updateLatestPushContent({ pushContent: formState.pushContent || '' })
    message.success(t('subscriptionPush.landing.save'))
    landingModalVisible.value = false
  } catch (error) {
    console.error('Failed to update landing content', error)
    message.error(t('subscriptionPush.form.messages.submitFailed'))
  } finally {
    landingSaving.value = false
  }
}

const buildWsUrl = () => {
  if (typeof window === 'undefined') return ''
  try {
    const apiUrl = new URL(API_BASE_URL, window.location.origin)
    const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${wsProtocol}//${apiUrl.host}/ws/subscription-push-task`
  } catch (error) {
    const origin = window.location.origin.replace(/^http/, 'ws')
    return `${origin}/ws/subscription-push-task`
  }
}

const closeTaskSocket = () => {
  if (taskSocket.value) {
    taskSocket.value.close()
    taskSocket.value = null
  }
}

const openTaskSocket = () => {
  const url = buildWsUrl()
  if (!url) return

  closeTaskSocket()
  const socket = new WebSocket(url)
  taskSocket.value = socket

  const handleSocketTermination = () => {
    if (taskSocket.value !== socket) return
    taskSocket.value = null
    // If the websocket drops, immediately refresh the list in case the task finished quickly.
    loadPushes(pagination.current)
  }

  socket.addEventListener('message', (event) => {
    try {
      const task = JSON.parse(event.data)
      applyTaskUpdate(task)
    } catch (error) {
      console.error('Failed to parse subscription task update', error)
    }
  })

  socket.addEventListener('error', (error) => {
    console.error('Subscription task websocket error', error)
    handleSocketTermination()
  })

  socket.addEventListener('close', handleSocketTermination)
}

watch(
  () => formState.templateId,
  (next) => {
    if (!next) {
      formState.templateName = ''
    } else if (!formState.templateName) {
      formState.templateName = templateIdNameMap.value[next] || ''
    }
  },
)

onMounted(() => {
  loadTemplateSettings()
  loadPushes()
  openTaskSocket()
})

onBeforeUnmount(() => {
  closeTaskSocket()
})
</script>

<template>
  <div class="subscription-page">
    <div class="hero">
      <div>
        <p class="eyebrow">{{ t('subscriptionPush.eyebrow') }}</p>
        <h2>{{ t('subscriptionPush.title') }}</h2>
        <p class="muted">
          {{ t('subscriptionPush.subtitle') }}
        </p>
        <div class="hero-meta">
          <a-tag color="blue" v-if="selectedTemplateName">{{ selectedTemplateName }}</a-tag>
          <a-tag color="default" v-else>{{ t('subscriptionPush.form.placeholder.template') }}</a-tag>
          <span class="meta-updated" v-if="templateSettings.updatedAt">
            {{ t('subscriptionPush.meta.updatedAt', { time: new Date(templateSettings.updatedAt).toLocaleString() }) }}
          </span>
        </div>
    </div>
      <a-button type="primary" ghost @click="openLandingModal">
        {{ t('subscriptionPush.actions.updateLanding') }}
      </a-button>
    </div>

    <a-card :bordered="false" class="form-card">
      <a-form ref="formRef" layout="vertical" :model="formState" :rules="rules" @finish="handleSubmit">
        <a-row :gutter="[16, 8]">
          <a-col :xs="24" :md="12">
            <a-form-item name="templateId" :label="t('subscriptionPush.form.template')">
              <a-select
                v-model:value="formState.templateId"
                :options="templateOptions"
                show-search
                option-filter-prop="label"
                :placeholder="t('subscriptionPush.form.placeholder.template')"
                :loading="templateSettingsLoading"
                @change="handleTemplateChange"
              />
              <div class="template-page" v-if="selectedTemplatePage">
                <span class="template-page__label">{{ t('subscriptionPush.form.pageLabel') }}</span>
                <a-tag color="default">{{ selectedTemplatePage }}</a-tag>
              </div>
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12" class="align-end">
            <div class="inline-actions">
              <a-button @click="loadTemplateSettings" :loading="templateSettingsLoading" ghost>
                {{ t('subscriptionPush.actions.reloadTemplates') }}
              </a-button>
            </div>
          </a-col>
        </a-row>

        <div class="kv-block">
          <div class="kv-header">
            <div>
              <p class="eyebrow">{{ t('subscriptionPush.form.kvTitle') }}</p>
              <p class="muted">{{ t('subscriptionPush.form.kvHint') }}</p>
              <div class="detail-tags" v-if="selectedTemplateDetails.length">
                <span class="detail-tags__label">{{ t('subscriptionPush.form.detailTags') }}</span>
                <a-tag
                  v-for="tag in selectedTemplateDetails"
                  :key="tag.field || tag.value"
                  :color="satisfiedDetailTags.has(tag.field || tag.value) ? 'blue' : '#d9d9d9'"
                >
                  {{ tag.field || tag.value }}
                </a-tag>
              </div>
            </div>
            <a-button type="dashed" size="small" @click="addTemplateDataRow" :disabled="allDetailsSatisfied">
              {{ t('subscriptionPush.actions.addKv') }}
            </a-button>
          </div>
          <a-row
            v-for="(item, index) in formState.templateData"
            :key="index"
            :gutter="[12, 8]"
            class="kv-row"
          >
            <a-col :xs="24" :md="10">
              <a-input v-model:value="item.key" :placeholder="t('subscriptionPush.form.placeholder.k')" allow-clear />
            </a-col>
            <a-col :xs="24" :md="12">
              <a-input
                v-model:value="item.value"
                :placeholder="t('subscriptionPush.form.placeholder.v')"
                allow-clear
              />
            </a-col>
            <a-col :xs="24" :md="2" class="kv-row__actions">
              <a-button
                danger
                type="text"
                @click="removeTemplateDataRow(index)"
                :disabled="formState.templateData.length <= 1"
              >
                {{ t('subscriptionPush.actions.remove') }}
              </a-button>
            </a-col>
          </a-row>
        </div>

        <a-row :gutter="[16, 8]">
          <a-col :xs="24" :md="12">
            <a-form-item name="registrationRange" :label="t('subscriptionPush.form.registrationRange')">
              <a-select
                v-model:value="formState.registrationRange"
                :options="registrationOptions"
                :placeholder="t('subscriptionPush.form.placeholder.registrationRange')"
                @change="handleRegistrationChange"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <template v-if="formState.registrationRange === 'BETWEEN'">
              <a-form-item name="registrationDateRange" :label="t('subscriptionPush.form.registrationDateRange')">
                <a-range-picker v-model:value="formState.registrationDateRange" style="width: 100%" />
              </a-form-item>
            </template>
            <template v-else-if="formState.registrationRange === 'FLP'">
              <a-form-item :label="t('subscriptionPush.form.flpRange')">
                <div class="range-inputs">
                  <a-input-number
                    v-model:value="formState.flpMin"
                    :min="0"
                    :placeholder="t('subscriptionPush.form.placeholder.rangeStart')"
                    style="width: 100%"
                  />
                  <span class="range-separator">~</span>
                  <a-input-number
                    v-model:value="formState.flpMax"
                    :min="0"
                    :placeholder="t('subscriptionPush.form.placeholder.rangeEnd')"
                    style="width: 100%"
                  />
                </div>
              </a-form-item>
            </template>
            <template v-else-if="formState.registrationRange === 'LIKE'">
              <a-form-item :label="t('subscriptionPush.form.likeRange')">
                <div class="range-inputs">
                  <a-input-number
                    v-model:value="formState.likeMin"
                    :min="0"
                    :precision="0"
                    :placeholder="t('subscriptionPush.form.placeholder.rangeStart')"
                    style="width: 100%"
                  />
                  <span class="range-separator">~</span>
                  <a-input-number
                    v-model:value="formState.likeMax"
                    :min="0"
                    :precision="0"
                    :placeholder="t('subscriptionPush.form.placeholder.rangeEnd')"
                    style="width: 100%"
                  />
                </div>
              </a-form-item>
            </template>
          </a-col>
        </a-row>

        <div class="form-actions">
          <a-button @click="resetForm">{{ t('common.actions.cancel') }}</a-button>
          <a-button type="primary" html-type="submit" :loading="submissionLoading">
            {{ t('common.actions.confirm') }}
          </a-button>
        </div>
      </a-form>
    </a-card>

    <a-card :bordered="false" class="table-card">
      <div class="table-header">
        <div>
          <p class="eyebrow">{{ t('subscriptionPush.table.title') }}</p>
          <p class="muted">{{ t('subscriptionPush.table.subtitle') }}</p>
        </div>
      </div>
      <a-table
        :columns="columns"
        :data-source="tableData"
        row-key="id"
        :loading="listLoading"
        :pagination="paginationConfig"
        @change="handleTableChange"
        :row-class-name="record => (record.id === selectedPushId ? 'row-selected' : '')"
        :customRow="record => ({ onClick: () => handleSelectPush(record) })"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'templateId'">
            <div class="template-cell">
              <span class="template-name">{{ templateIdNameMap[record.templateId] || record.templateId }}</span>
              <a-tag color="blue" v-if="templateIdNameMap[record.templateId]">
                {{ record.templateId }}
              </a-tag>
            </div>
          </template>
          <template v-else-if="column.key === 'templateData'">
            <div class="kv-tags">
              <a-tag v-for="item in formatTemplateDataList(record.templateData, record.templateId)" :key="item">{{ item }}</a-tag>
            </div>
          </template>
          <template v-else-if="column.key === 'registrationRange'">
            {{ formatRegistration(record) }}
          </template>
          <template v-else-if="column.key === 'progress'">
            <div class="progress-cell">
              <a-progress
                :percent="getProgressPercent(record.taskSnapshot)"
                size="small"
                :status="record.taskSnapshot?.status === 'FAILED' ? 'exception' : record.taskSnapshot?.status === 'COMPLETED' ? 'success' : 'active'"
              />
              <div class="progress-meta">
                <span class="status-label">{{ resolveStatusLabel(record.taskSnapshot?.status) }}</span>
                <span class="count-label">
                  {{ t('subscriptionPush.table.progress.success') }} {{ record.taskSnapshot?.successCount ?? 0 }}
                  /
                  {{ record.taskSnapshot?.totalTargets ?? record.taskSnapshot?.processedCount ?? '-' }}
                </span>
                <span class="count-label failure">
                  {{ t('subscriptionPush.table.progress.failure') }} {{ record.taskSnapshot?.failureCount ?? 0 }}
                </span>
                <span class="message" v-if="record.taskSnapshot?.message"> · {{ record.taskSnapshot.message }}</span>
              </div>
            </div>
          </template>
          <template v-else-if="column.key === 'createdAt'">
            {{ formatDateTime(record.createdAt) }}
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      :open="landingModalVisible"
      :title="t('subscriptionPush.landing.title')"
      width="720px"
      :ok-text="t('subscriptionPush.landing.save')"
      :confirm-loading="landingSaving"
      :cancel-text="t('common.actions.cancel')"
      @cancel="closeLandingModal"
      @ok="submitLandingContent"
    >
      <a-spin :spinning="landingLoading">
        <open-platform-editor
          v-model="formState.pushContent"
          :placeholder="t('subscriptionPush.landing.placeholder')"
        />
      </a-spin>
    </a-modal>
  </div>
</template>

<style scoped>
.subscription-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: linear-gradient(135deg, #f0f7ff, #e5f2ff);
  border: 1px solid #d9e8ff;
  border-radius: 16px;
  padding: 18px 20px;
  gap: 12px;
}

.hero h2 {
  margin: 4px 0 8px;
  font-size: 1.4rem;
  color: #0f172a;
}

.hero .muted {
  margin: 0;
  color: #64748b;
}

.hero-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.meta-updated {
  color: #475569;
  font-size: 0.9rem;
}

.eyebrow {
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.8rem;
  color: #2563eb;
  font-weight: 700;
}

.form-card,
.table-card {
  border-radius: 14px;
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.06);
}

.align-end {
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
}

.inline-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.kv-block {
  background: #f8fafc;
  border: 1px dashed #d7e3f4;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.kv-row {
  align-items: center;
}

.kv-row__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.range-inputs {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
}

.range-separator {
  color: #94a3b8;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.table-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.kv-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  margin-top: 6px;
}

.detail-tags__label {
  color: #6b7280;
}

.template-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.template-page {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  color: #475569;
}

.template-page__label {
  font-size: 0.9rem;
}

.template-name {
  font-weight: 600;
  color: #0f172a;
}

.progress-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  color: #475569;
  font-size: 0.9rem;
}

.status-label {
  font-weight: 600;
  color: #0f172a;
}

.count-label.failure {
  color: #dc2626;
}

.message {
  color: #6b7280;
}

.row-selected {
  background: #f0f9ff !important;
}

@media (max-width: 720px) {
  .hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .hero-actions {
    width: 100%;
    justify-content: space-between;
  }

  .range-inputs {
    grid-template-columns: 1fr 24px 1fr;
  }
}
</style>
