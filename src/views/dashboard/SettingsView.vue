<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import {
  fetchInviteConfig,
  saveInviteConfig,
  fetchMapSettlementConfig,
  saveMapSettlementConfig,
  fetchOpenPlatformCopy,
  saveOpenPlatformCopy,
  fetchFlpRewardHelpCopy,
  saveFlpRewardHelpCopy,
  fetchInviteGuideCopy,
  saveInviteGuideCopy,
  fetchFontFileConfig,
  uploadFontFileConfig,
  fetchTemplateSettings,
  saveTemplateSettingsBatch,
  updateTemplateSetting,
  deleteTemplateSetting,
} from '../../services/config'
import { fetchWechatPayConfig, saveWechatPayConfig } from '../../services/wechatPayConfig'
import { fetchWeappConfig, saveWeappConfig } from '../../services/weappConfig'
import { fetchFlpLogs } from '../../services/flp'
import { resolveProfileAsset } from '../../services/profile'
import OpenPlatformEditor from '../../components/OpenPlatformEditor.vue'
import { fetchSubscriptionAutoTask, saveSubscriptionAutoTask } from '../../services/weappSubscriptions'
import { fetchLotteryConfig, fetchLotteryLogs, saveLotteryConfig } from '../../services/lottery'
import { fetchAdminUserCheckins, fetchAdminUserNewbieTasks } from '../../services/adminUsers'
import {
  fetchNewbieTaskTemplate,
  saveNewbieTaskTemplate,
  deleteNewbieTaskTemplate,
  fetchNetdiskGiftConfig,
  saveNetdiskGiftConfig,
  deleteNetdiskGiftConfig,
} from '../../services/newbieTasks'
import { buildDownloadUrl, extractObjectName, uploadPublicFile } from '../../services/files'
import {
  fetchReportEntries,
  fetchReportEntryDialogText,
  saveReportEntryDialogText,
  createReportEntry,
  updateReportEntry,
  deleteReportEntry,
} from '../../services/reportEntries'
import reportEntryRegions from '../../data/reportEntryRegions'
import detailIcon from '../../assets/img/detail.png'

const { t } = useI18n()

const activeTab = ref('invite')

const parseBulkTemplateInput = (input) => {
  const lines = (input || '').split('\n')
  const result = new Map()
  lines.forEach((line) => {
    const trimmed = line.trim()
    if (!trimmed) return
    const parts = trimmed.split(/[,锛寍\s]+/).filter(Boolean)
    if (parts.length < 2) return
    const [templateName, templateId, ...rest] = parts
    if (templateName && templateId) {
      const detailPairs = []
      let page = ''
      rest.forEach((entry) => {
        const pageMatch = entry.match(/^page[:=](.+)$/i)
        if (pageMatch) {
          page = pageMatch[1].trim()
          return
        }
        const pair = entry.split(/[:=]/).map((v) => v.trim()).filter(Boolean)
        if (pair.length >= 2) {
          const [field, value] = pair
          detailPairs.push({ field, value })
        }
      })
      result.set(templateName.trim(), { templateId: templateId.trim(), details: detailPairs, page })
    }
  })
  return Array.from(result.entries()).map(([templateName, payload]) => ({
    templateName,
    templateId: payload.templateId,
    details: payload.details || [],
    page: payload.page || '',
  }))
}

const inviteForm = reactive({
  friendRegisterRewardFlp: 0,
  friendFirstMarkerFlp: 0,
})
const inviteRules = computed(() => ({
  friendRegisterRewardFlp: [
    { required: true, message: t('settings.invite.validation.friendRegisterRewardFlp') },
  ],
  friendFirstMarkerFlp: [
    { required: true, message: t('settings.invite.validation.friendFirstMarkerFlp') },
  ],
}))
const inviteLoading = ref(false)
const inviteSaving = ref(false)

const inviteLogs = ref([])
const inviteLogsLoading = ref(false)
const inviteLogPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})
const inviteLogFilters = reactive({
  featureCode: '',
  logType: 'INVITE',
})

const mapForm = reactive({
  wechatListPrice: 0,
  wechatNetPrice: 0,
  flpListPrice: 0,
  flpNetPrice: 0,
})
const mapRules = computed(() => ({
  wechatListPrice: [{ required: true, message: t('settings.mapSettlement.validation.wechatListPrice') }],
  wechatNetPrice: [{ required: true, message: t('settings.mapSettlement.validation.wechatNetPrice') }],
  flpListPrice: [{ required: true, message: t('settings.mapSettlement.validation.flpListPrice') }],
  flpNetPrice: [{ required: true, message: t('settings.mapSettlement.validation.flpNetPrice') }],
}))
const mapLoading = ref(false)
const mapSaving = ref(false)

const copyType = ref('openPlatform')
const copyForm = reactive({
  content: '',
})
const copyLoading = ref(false)
const copySaving = ref(false)
const copyPreviewVisible = ref(false)
const copyHasContent = computed(() => {
  const rawContent = copyForm.content || ''
  if (!rawContent.trim()) {
    return false
  }

  const textContent = rawContent.replace(/<[^>]*>/g, '').trim()
  if (textContent) {
    return true
  }

  return /<img\s|<video\s|<iframe\s/i.test(rawContent)
})
const copyTypeOptions = computed(() => [
  { value: 'openPlatform', label: t('settings.copySettings.options.openPlatform') },
  { value: 'flpRewardHelp', label: t('settings.copySettings.options.flpRewardHelp') },
  { value: 'inviteGuide', label: t('settings.copySettings.options.inviteGuide') },
])
const copyHandlers = {
  openPlatform: {
    fetch: fetchOpenPlatformCopy,
    save: saveOpenPlatformCopy,
  },
  flpRewardHelp: {
    fetch: fetchFlpRewardHelpCopy,
    save: saveFlpRewardHelpCopy,
  },
  inviteGuide: {
    fetch: fetchInviteGuideCopy,
    save: saveInviteGuideCopy,
  },
}

const weappForm = reactive({
  appId: '',
  secret: '',
  jwtSecret: '',
})
const weappRules = computed(() => ({
  appId: [{ required: true, message: t('settings.weapp.validation.appId') }],
  secret: [{ required: true, message: t('settings.weapp.validation.secret') }],
  jwtSecret: [{ required: true, message: t('settings.weapp.validation.jwtSecret') }],
}))
const weappLoading = ref(false)
const weappSaving = ref(false)

const paymentForm = reactive({
  mchId: '',
  privateKeyPath: '',
  certificateSerialNumber: '',
  apiV3Key: '',
  callbackUrl: '',
})
const paymentRules = computed(() => ({
  mchId: [{ required: true, message: t('settings.payment.validation.mchId') }],
  privateKeyPath: [{ required: true, message: t('settings.payment.validation.privateKeyPath') }],
  certificateSerialNumber: [
    { required: true, message: t('settings.payment.validation.certificateSerialNumber') },
  ],
  apiV3Key: [{ required: true, message: t('settings.payment.validation.apiV3Key') }],
  callbackUrl: [{ required: true, message: t('settings.payment.validation.callbackUrl') }],
}))
const paymentLoading = ref(false)
const paymentSaving = ref(false)

const templateSettings = reactive({
  templates: {},
  updatedAt: null,
})
const templateSettingsLoading = ref(false)
const templateSettingsSaving = ref(false)
const templateAutoTaskMap = reactive({})
const templateAutoTaskLoadingMap = reactive({})
const bulkTemplateInput = ref('')
const templateSettingsColumns = computed(() => [
  { title: t('settings.templateSettings.columns.templateName'), dataIndex: 'templateName', key: 'templateName' },
  { title: t('settings.templateSettings.columns.templateId'), dataIndex: 'templateId', key: 'templateId' },
  { title: t('settings.templateSettings.columns.page'), dataIndex: 'page', key: 'page' },
  { title: t('settings.templateSettings.columns.details'), dataIndex: 'details', key: 'details' },
  { title: t('settings.templateSettings.columns.autoTask'), dataIndex: 'autoTask', key: 'autoTask', width: 120 },
  { title: t('settings.templateSettings.columns.actions'), key: 'actions', width: 180 },
])
const templateSettingsDataSource = computed(() =>
  Object.entries(templateSettings.templates || {}).map(([templateName, config]) => {
    const templateId = typeof config === 'string' ? config : config?.templateId
    const details = Array.isArray(config?.details) ? config.details : []
    const page = typeof config === 'object' ? config?.page || '' : ''
    const autoTaskMeta = templateId ? templateAutoTaskMap[templateId] : null
    const autoTaskLoading = templateId ? templateAutoTaskLoadingMap[templateId] : false
    return {
      templateName,
      templateId: templateId || '',
      details,
      key: templateName,
      page,
      autoTaskEnabled: autoTaskMeta?.enabled ?? false,
      autoTaskLoading: Boolean(autoTaskLoading),
    }
  }),
)
const parsedBulkTemplates = computed(() => parseBulkTemplateInput(bulkTemplateInput.value))
const templateSettingsUpdatedAt = computed(() =>
  templateSettings.updatedAt ? new Date(templateSettings.updatedAt).toLocaleString() : t('settings.templateSettings.emptyUpdatedAt'),
)
const templateDetailsById = computed(() =>
  Object.entries(templateSettings.templates || {}).reduce((acc, [templateName, config]) => {
    const templateId = typeof config === 'string' ? config : config?.templateId
    if (!templateId) return acc
    const details = Array.isArray(config?.details) ? config.details : []
    acc[templateId] = {
      templateName,
      details,
    }
    return acc
  }, {}),
)
const autoTaskFrequencyOptions = computed(() => [
  { value: 'DAY', label: t('settings.templateSettings.autoTask.frequencyOptions.day') },
  { value: 'WEEK', label: t('settings.templateSettings.autoTask.frequencyOptions.week') },
  { value: 'MONTH', label: t('settings.templateSettings.autoTask.frequencyOptions.month') },
])
const autoTaskConditionOptions = computed(() => [
  { value: 'USER_TODAY_NOT_CHECKIN', label: t('settings.templateSettings.autoTask.conditions.userTodayNotCheckin') },
])
const autoTaskTemplateDisplay = computed(() => {
  if (autoTaskForm.templateName && autoTaskForm.templateId) {
    return `${autoTaskForm.templateName} (${autoTaskForm.templateId})`
  }
  return autoTaskForm.templateName || autoTaskForm.templateId || ''
})
const autoTaskTemplateFieldOptions = computed(() => {
  const templateInfo = templateDetailsById.value[autoTaskForm.templateId]
  const details = templateInfo?.details || []
  return details.map((item) => {
    const valueKey = (item?.value || item?.field || '').trim()
    const label = (item?.field || item?.value || '').trim()
    return {
      value: valueKey,
      label: label || valueKey,
    }
  }).filter((item) => item.value)
})
const templateEditVisible = ref(false)
const templateEditSaving = ref(false)
const templateEditForm = reactive({
  templateName: '',
  templateId: '',
  details: [],
  page: '',
})
const autoTaskEditVisible = ref(false)
const autoTaskEditSaving = ref(false)
const autoTaskEditLoading = ref(false)
const autoTaskForm = reactive({
  templateName: '',
  templateId: '',
  enabled: false,
  startTime: '',
  frequency: '',
  conditionKeys: [],
  templateFields: [],
})

const newbieTaskTemplateLoading = ref(false)
const newbieTaskTemplateSaving = ref(false)
const newbieTaskTemplateUpdatedAt = ref(null)
const newbieTaskTemplateForm = ref([])
const newbieTaskActiveTab = ref('template')
const newbieTaskStats = ref([])
const newbieTaskStatsLoading = ref(false)
const newbieTaskStatsPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})
const newbieTaskQrCodeUrl = ref('')
const newbieTaskQrCodeUploadedAt = ref(null)
const newbieTaskQrUploadLoading = ref(false)

const netdiskGiftLoading = ref(false)
const netdiskGiftSaving = ref(false)
const netdiskGiftUpdatedAt = ref(null)
const netdiskGiftForm = ref([])

const createNewbieTaskRow = () => ({
  index: null,
  name: '',
  description: '',
  buttonText: '',
})

const createNetdiskLinkRow = () => ({
  name: '',
  url: '',
})

newbieTaskTemplateForm.value = [createNewbieTaskRow()]
netdiskGiftForm.value = [createNetdiskLinkRow()]

const fontFileConfig = reactive({
  fileName: '',
  version: '',
})
const fontFileForm = reactive({
  fileName: '',
  version: '',
})
const fontFileLoading = ref(false)
const fontFileSaving = ref(false)
const fontFileSelected = ref(null)

const lotteryActiveTab = ref('prizes')
const lotteryConfigLoading = ref(false)
const lotteryConfigSaving = ref(false)
const lotteryConfigUpdatedAt = ref(null)
const lotteryPrizeForm = ref([])
const lotteryUploadLoadingMap = reactive({})
const lotteryLogs = ref([])
const lotteryLogsLoading = ref(false)
const lotteryLogPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})
const lotteryLogFilters = reactive({
  featureCode: '',
})
const checkinLogs = ref([])
const checkinLogsLoading = ref(false)
const checkinLogPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const reportEntryList = ref([])
const reportEntryLoading = ref(false)
const reportEntrySaving = ref(false)
const reportEntryConfigSaving = ref(false)
const reportEntryDrawerVisible = ref(false)
const reportEntryEditingId = ref(null)
const reportEntryFormRef = ref(null)
const reportEntrySelectedKeys = ref([])
const reportEntrySelectedId = ref(null)
const reportEntryDialogText = ref('')
const reportEntryDeletedIds = ref([])
const reportEntryPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})
const reportEntryForm = reactive({
  areaPath: [],
  miniProgramAppId: '',
  miniProgramPath: '',
  guideType: 'publicAccount',
  publicAccountLink: '',
  videoAccountId: '',
  videoId: '',
})

const createDefaultLotteryPrizes = () =>
  Array.from({ length: 8 }, (_, index) => ({
    level: index + 1,
    flp: false,
    flpCount: '',
    description: '',
    imageUrl: '',
    probability: 0,
  }))

lotteryPrizeForm.value = createDefaultLotteryPrizes()

const normalizeLotteryPrizes = (prizes = []) => {
  const map = new Map((prizes || []).map((item) => [Number(item?.level), item]))
  return Array.from({ length: 8 }, (_, index) => {
    const level = index + 1
    const source = map.get(level) || {}
    return {
      level,
      flp: Boolean(source.flp),
      flpCount: source.flp ? String(source.flpCount ?? '') : '',
      description: source.description ?? '',
      imageUrl: extractObjectName(source.imageUrl ?? ''),
      probability: Number(source.probability ?? 0),
    }
  })
}

const lotteryProbabilityTotal = computed(() =>
  lotteryPrizeForm.value.reduce((sum, item) => sum + Number(item.probability || 0), 0),
)
const lotteryProbabilityValid = computed(() => Math.abs(lotteryProbabilityTotal.value - 100) < 0.001)
const lotteryProbabilityStatus = computed(() => {
  if (lotteryProbabilityValid.value) return 'success'
  return lotteryProbabilityTotal.value > 100 ? 'exception' : 'active'
})
const lotteryProbabilityDisplay = computed(() =>
  Math.min(100, Math.max(0, Number(lotteryProbabilityTotal.value.toFixed(2)))),
)
const lotteryUpdatedAtDisplay = computed(() =>
  lotteryConfigUpdatedAt.value
    ? new Date(lotteryConfigUpdatedAt.value).toLocaleString()
    : t('settings.lottery.meta.emptyUpdatedAt'),
)

const newbieTaskTemplateUpdatedAtDisplay = computed(() =>
  newbieTaskTemplateUpdatedAt.value
    ? new Date(newbieTaskTemplateUpdatedAt.value).toLocaleString()
    : t('settings.newbieTasks.meta.emptyUpdatedAt'),
)

const netdiskGiftUpdatedAtDisplay = computed(() =>
  netdiskGiftUpdatedAt.value
    ? new Date(netdiskGiftUpdatedAt.value).toLocaleString()
    : t('settings.newbieTasks.meta.emptyUpdatedAt'),
)

const getLotteryImageUrl = (value) => buildDownloadUrl(extractObjectName(value || ''))
const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '-')
const formatProbabilityValue = (value) => {
  if (value === null || value === undefined || value === '') return ''
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return ''
  return numeric.toFixed(10).replace(/\.?0+$/, '')
}

const parseProbabilityValue = (value) => {
  if (value === null || value === undefined) return ''
  const cleaned = String(value).replace(/[^\d.]/g, '')
  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) return cleaned
  const head = cleaned.slice(0, firstDot + 1)
  const tail = cleaned.slice(firstDot + 1).replace(/\./g, '')
  return head + tail
}

const buildReportEntryTree = (nodes = [], parentPath = []) =>
  nodes.map((node) => {
    const currentPath = [...parentPath, node.name]
    const treeNode = {
      title: node.name,
      key: currentPath.join('/'),
      path: currentPath,
      selectable: true,
    }
    if (Array.isArray(node.children) && node.children.length) {
      treeNode.children = buildReportEntryTree(node.children, currentPath)
    }
    return treeNode
  })

const resolveReportEntryRegion = (path = []) => {
  if (!Array.isArray(path) || !path.length) {
    return { province: '', city: null, county: null }
  }
  const normalized = path[0] === '全国' ? path.slice(1) : path
  if (!normalized.length) {
    return { province: '全国', city: null, county: null }
  }
  const [province, city, county] = normalized
  return {
    province: province || '',
    city: city || null,
    county: county || null,
  }
}

const buildReportEntryAreaPath = (entry) => {
  const path = ['全国']
  if (!entry?.province) return path
  if (entry.province && entry.province !== '全国') {
    path.push(entry.province)
  }
  if (entry.city) path.push(entry.city)
  if (entry.county) path.push(entry.county)
  return path
}

const createTempReportEntryId = () =>
  `temp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

const isTempReportEntryId = (id) => String(id || '').startsWith('temp-')

const updateReportEntryInList = (id, updater) => {
  const index = reportEntryList.value.findIndex((item) => item.id === id)
  if (index === -1) return null
  const current = reportEntryList.value[index]
  const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater }
  reportEntryList.value.splice(index, 1, next)
  return next
}

const parseFontVersion = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  const parts = raw.split('.')
  const major = Number(parts[0])
  const minor = Number(parts[1] ?? 0)
  const patch = Number(parts[2] ?? 0)
  if (!Number.isInteger(major) || major < 0) return null
  if (!Number.isInteger(minor) || minor < 0) return null
  if (!Number.isInteger(patch) || patch < 0) return null
  return { major, minor, patch }
}

const getNextFontVersion = (value) => {
  const parsed = parseFontVersion(value)
  if (!parsed) return '1.0.0'
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`
}

const resetFontFileForm = (currentVersion = '') => {
  fontFileForm.fileName = ''
  fontFileForm.version = getNextFontVersion(currentVersion)
  fontFileSelected.value = null
}

const fontFileDownloadUrl = computed(() => buildDownloadUrl(fontFileConfig.fileName || ''))

const inviteColumns = computed(() => [
  { title: t('settings.invite.logs.columns.featureCode'), dataIndex: ['user', 'featureCode'], key: 'featureCode' },
  { title: t('settings.invite.logs.columns.username'), dataIndex: ['user', 'username'], key: 'username' },
  { title: t('settings.invite.logs.columns.avatar'), dataIndex: ['user', 'avatarUrl'], key: 'avatar', width: 120 },
  { title: t('settings.invite.logs.columns.amount'), dataIndex: 'amount', key: 'amount', width: 140 },
  { title: t('settings.invite.logs.columns.operation'), dataIndex: 'operation', key: 'operation', width: 140 },
  { title: t('settings.invite.logs.columns.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 200 },
])

const inviteLogTypeOptions = computed(() => [
  { value: '', label: t('settings.invite.logs.logTypes.all') },
  { value: 'INVITE', label: t('settings.invite.logs.logTypes.invite') },
  { value: 'PIN_REVIEW', label: t('settings.invite.logs.logTypes.pinReview') },
  { value: 'CHECKIN', label: t('settings.invite.logs.logTypes.checkin') },
  { value: 'LOTTERY', label: t('settings.invite.logs.logTypes.lottery') },
])

const lotteryLogColumns = computed(() => [
  { title: t('settings.lottery.logs.columns.id'), dataIndex: 'id', key: 'id', width: 120 },
  { title: t('settings.lottery.logs.columns.featureCode'), dataIndex: 'featureCode', key: 'featureCode' },
  { title: t('settings.lottery.logs.columns.username'), dataIndex: 'username', key: 'username' },
  { title: t('settings.lottery.logs.columns.prizeDescription'), dataIndex: 'prizeDescription', key: 'prize' },
  { title: t('settings.lottery.logs.columns.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 200 },
])

const checkinLogColumns = computed(() => [
  { title: t('settings.lottery.checkins.columns.featureCode'), dataIndex: 'featureCode', key: 'featureCode' },
  { title: t('settings.lottery.checkins.columns.username'), dataIndex: 'username', key: 'username' },
  { title: t('settings.lottery.checkins.columns.avatar'), dataIndex: 'avatarUrl', key: 'avatar', width: 120 },
  { title: t('settings.lottery.checkins.columns.registeredAt'), dataIndex: 'registeredAt', key: 'registeredAt', width: 200 },
  {
    title: t('settings.lottery.checkins.columns.weeklyContinuousDays'),
    dataIndex: 'weeklyContinuousDays',
    key: 'weeklyContinuousDays',
    width: 160,
  },
  { title: t('settings.lottery.checkins.columns.checkinTimes'), dataIndex: 'checkinTimes', key: 'checkinTimes' },
])

const newbieTaskStatsColumns = computed(() => [
  { title: t('settings.newbieTasks.stats.columns.featureCode'), dataIndex: 'featureCode', key: 'featureCode' },
  { title: t('settings.newbieTasks.stats.columns.username'), dataIndex: 'username', key: 'username' },
  { title: t('settings.newbieTasks.stats.columns.avatar'), dataIndex: 'avatarUrl', key: 'avatar', width: 120 },
  { title: t('settings.newbieTasks.stats.columns.registeredAt'), dataIndex: 'registeredAt', key: 'registeredAt', width: 200 },
  { title: t('settings.newbieTasks.stats.columns.tasks'), dataIndex: 'tasks', key: 'tasks' },
])

const reportEntryTreeData = computed(() => buildReportEntryTree(reportEntryRegions))
const reportEntryDefaultExpandedKeys = ['全国']
const reportEntrySearch = ref('')
const reportEntryTreeExpandedKeys = ref(reportEntryDefaultExpandedKeys)
const reportEntryAutoExpandParent = ref(false)
const reportEntryTreeFilterResult = computed(() => {
  const keyword = reportEntrySearch.value.trim()
  if (!keyword) {
    return { tree: reportEntryTreeData.value, expandedKeys: reportEntryDefaultExpandedKeys }
  }
  const lowerKeyword = keyword.toLowerCase()
  const expandedKeys = new Set()
  const filterNodes = (nodes) =>
    (nodes || []).reduce((acc, node) => {
      const title = String(node?.title || '')
      const matched = title.toLowerCase().includes(lowerKeyword)
      const children = Array.isArray(node?.children) ? node.children : []
      const filteredChildren = filterNodes(children)
      if (filteredChildren.length) {
        expandedKeys.add(node.key)
      }
      if (matched || filteredChildren.length) {
        acc.push({
          ...node,
          children: filteredChildren.length ? filteredChildren : undefined,
        })
      }
      return acc
    }, [])
  return { tree: filterNodes(reportEntryTreeData.value), expandedKeys: Array.from(expandedKeys) }
})
const reportEntryColumns = computed(() => [
  { title: t('settings.reportEntry.table.province'), dataIndex: 'province', key: 'province', width: 160 },
  { title: t('settings.reportEntry.table.area'), dataIndex: 'area', key: 'area' },
  { title: t('settings.reportEntry.table.actions'), key: 'actions', width: 120 },
])
const reportEntryRules = computed(() => ({
  areaPath: [
    {
      validator: (_, value) =>
        Array.isArray(value) && value.length
          ? Promise.resolve()
          : Promise.reject(new Error(t('settings.reportEntry.validation.area'))),
    },
  ],
  miniProgramAppId: [{ required: true, message: t('settings.reportEntry.validation.appId') }],
  miniProgramPath: [{ required: false, message: t('settings.reportEntry.validation.path') }],
  publicAccountLink: [
    {
      validator: () => {
        if (reportEntryForm.guideType !== 'publicAccount') return Promise.resolve()
        return reportEntryForm.publicAccountLink?.trim()
          ? Promise.resolve()
          : Promise.reject(new Error(t('settings.reportEntry.validation.publicAccountLink')))
      },
    },
  ],
  videoAccountId: [
    {
      validator: () => {
        if (reportEntryForm.guideType !== 'video') return Promise.resolve()
        return reportEntryForm.videoAccountId?.trim()
          ? Promise.resolve()
          : Promise.reject(new Error(t('settings.reportEntry.validation.videoAccountId')))
      },
    },
  ],
  videoId: [
    {
      validator: () => {
        if (reportEntryForm.guideType !== 'video') return Promise.resolve()
        return reportEntryForm.videoId?.trim()
          ? Promise.resolve()
          : Promise.reject(new Error(t('settings.reportEntry.validation.videoId')))
      },
    },
  ],
}))

const loadInviteConfig = async () => {
  inviteLoading.value = true
  try {
    const data = await fetchInviteConfig()
    inviteForm.friendRegisterRewardFlp = data?.friendRegisterRewardFlp ?? 0
    inviteForm.friendFirstMarkerFlp = data?.friendFirstMarkerFlp ?? 0
  } catch (error) {
    console.error('Failed to load invite config', error)
    message.error(t('settings.invite.messages.loadFailed'))
  } finally {
    inviteLoading.value = false
  }
}

const loadInviteLogs = async () => {
  inviteLogsLoading.value = true
  try {
    const { content, totalElements, page, size } = await fetchFlpLogs({
      page: inviteLogPagination.current,
      size: inviteLogPagination.pageSize,
      featureCode: inviteLogFilters.featureCode.trim() || undefined,
      logType: inviteLogFilters.logType || undefined,
    })
    const filteredContent = (content || []).filter((item) => item?.operation === 'INCREASE')
    inviteLogs.value = filteredContent.map((item) => ({
      ...item,
      user: item?.user
        ? {
          ...item.user,
          avatarUrl: resolveProfileAsset(item.user.avatarUrl),
        }
        : item?.user ?? null,
    }))
    inviteLogPagination.total = totalElements
    inviteLogPagination.current = page
    inviteLogPagination.pageSize = size
  } catch (error) {
    console.error('Failed to load FLP logs', error)
    message.error(t('settings.invite.messages.logLoadFailed'))
  } finally {
    inviteLogsLoading.value = false
  }
}

const handleInviteLogSearch = () => {
  inviteLogPagination.current = 1
  loadInviteLogs()
}

const handleInviteLogTypeChange = (value) => {
  if (inviteLogFilters.logType === value) return
  inviteLogFilters.logType = value
  inviteLogPagination.current = 1
  loadInviteLogs()
}

const handleInviteLogTableChange = (pager) => {
  inviteLogPagination.current = pager?.current ?? 1
  inviteLogPagination.pageSize = pager?.pageSize ?? inviteLogPagination.pageSize
  loadInviteLogs()
}

const submitInviteForm = async () => {
  inviteSaving.value = true
  try {
    await saveInviteConfig({
      friendRegisterRewardFlp: Number(inviteForm.friendRegisterRewardFlp) || 0,
      friendFirstMarkerFlp: Number(inviteForm.friendFirstMarkerFlp) || 0,
    })
    message.success(t('settings.invite.messages.saveSuccess'))
    loadInviteConfig()
  } catch (error) {
    console.error('Failed to save invite config', error)
    message.error(t('settings.invite.messages.saveFailed'))
  } finally {
    inviteSaving.value = false
  }
}

const loadMapConfig = async () => {
  mapLoading.value = true
  try {
    const data = await fetchMapSettlementConfig()
    mapForm.wechatListPrice = data?.wechatListPrice ?? 0
    mapForm.wechatNetPrice = data?.wechatNetPrice ?? 0
    mapForm.flpListPrice = data?.flpListPrice ?? 0
    mapForm.flpNetPrice = data?.flpNetPrice ?? 0
  } catch (error) {
    console.error('Failed to load map settlement config', error)
    message.error(t('settings.mapSettlement.messages.loadFailed'))
  } finally {
    mapLoading.value = false
  }
}

const submitMapForm = async () => {
  mapSaving.value = true
  try {
    await saveMapSettlementConfig({
      wechatListPrice: Number(mapForm.wechatListPrice) || 0,
      wechatNetPrice: Number(mapForm.wechatNetPrice) || 0,
      flpListPrice: Number(mapForm.flpListPrice) || 0,
      flpNetPrice: Number(mapForm.flpNetPrice) || 0,
    })
    message.success(t('settings.mapSettlement.messages.saveSuccess'))
    loadMapConfig()
  } catch (error) {
    console.error('Failed to save map settlement config', error)
    message.error(t('settings.mapSettlement.messages.saveFailed'))
  } finally {
    mapSaving.value = false
  }
}

const loadCopyContent = async () => {
  const handler = copyHandlers[copyType.value]
  if (!handler) {
    return
  }

  copyLoading.value = true
  try {
    const data = await handler.fetch()
    copyForm.content = data?.content ?? ''
  } catch (error) {
    console.error('Failed to load copy content', error)
    message.error(t('settings.copySettings.messages.loadFailed'))
  } finally {
    copyLoading.value = false
  }
}

const submitCopyForm = async () => {
  const handler = copyHandlers[copyType.value]
  if (!handler) {
    return
  }

  copySaving.value = true
  try {
    await handler.save({ content: copyForm.content || '' })
    message.success(t('settings.copySettings.messages.saveSuccess'))
    loadCopyContent()
  } catch (error) {
    console.error('Failed to save copy content', error)
    message.error(t('settings.copySettings.messages.saveFailed'))
  } finally {
    copySaving.value = false
  }
}

const showCopyPreview = () => {
  copyPreviewVisible.value = true
}

const closeCopyPreview = () => {
  copyPreviewVisible.value = false
}

const loadWeappConfig = async () => {
  weappLoading.value = true
  try {
    const data = await fetchWeappConfig()
    weappForm.appId = data?.appId || ''
    weappForm.secret = data?.secret || ''
    weappForm.jwtSecret = data?.jwtSecret || ''
  } catch (error) {
    console.error('Failed to load weapp config', error)
    message.error(t('settings.weapp.messages.loadFailed'))
  } finally {
    weappLoading.value = false
  }
}

const submitWeappForm = async () => {
  weappSaving.value = true
  try {
    await saveWeappConfig({
      appId: weappForm.appId,
      secret: weappForm.secret,
      jwtSecret: weappForm.jwtSecret,
    })
    message.success(t('settings.weapp.messages.saveSuccess'))
  } catch (error) {
    console.error('Failed to save weapp config', error)
    message.error(t('settings.weapp.messages.saveFailed'))
  } finally {
    weappSaving.value = false
  }
}

const loadPaymentConfig = async () => {
  paymentLoading.value = true
  try {
    const data = await fetchWechatPayConfig()
    paymentForm.mchId = data?.merchantId || ''
    paymentForm.privateKeyPath = data?.privateKeyPath || ''
    paymentForm.certificateSerialNumber = data?.merchantSerialNumber || ''
    paymentForm.apiV3Key = data?.apiV3Key || ''
    paymentForm.callbackUrl = data?.notifyUrl || ''
  } catch (error) {
    console.error('Failed to load payment config', error)
    message.error(t('settings.payment.messages.loadFailed'))
  } finally {
    paymentLoading.value = false
  }
}

const submitPaymentForm = async () => {
  paymentSaving.value = true
  try {
    await saveWechatPayConfig({
      merchantId: paymentForm.mchId,
      privateKeyPath: paymentForm.privateKeyPath,
      merchantSerialNumber: paymentForm.certificateSerialNumber,
      apiV3Key: paymentForm.apiV3Key,
      notifyUrl: paymentForm.callbackUrl,
    })
    message.success(t('settings.payment.messages.saveSuccess'))
    loadPaymentConfig()
  } catch (error) {
    console.error('Failed to save payment config', error)
    message.error(t('settings.payment.messages.saveFailed'))
  } finally {
    paymentSaving.value = false
  }
}

const loadTemplateSettings = async () => {
  templateSettingsLoading.value = true
  try {
    const data = await fetchTemplateSettings()
    templateSettings.templates = data?.templates || {}
    templateSettings.updatedAt = data?.updatedAt || null
    await loadAllAutoTaskConfigs()
  } catch (error) {
    console.error('Failed to load template settings', error)
    message.error(t('settings.templateSettings.messages.loadFailed'))
  } finally {
    templateSettingsLoading.value = false
  }
}

const submitTemplateSettingsBatch = async () => {
  if (templateSettingsSaving.value) {
    return
  }
  const payloads = parsedBulkTemplates.value
  if (!payloads.length) {
    message.warning(t('settings.templateSettings.messages.emptyInput'))
    return
  }

  templateSettingsSaving.value = true
  try {
    await saveTemplateSettingsBatch(payloads)
    message.success(t('settings.templateSettings.messages.saveSuccess', { count: payloads.length }))
    bulkTemplateInput.value = ''
    await loadTemplateSettings()
  } catch (error) {
    console.error('Failed to save template settings', error)
    message.error(t('settings.templateSettings.messages.saveFailed'))
  } finally {
    templateSettingsSaving.value = false
  }
}

const openTemplateEdit = (record) => {
  templateEditForm.templateName = record?.templateName || ''
  templateEditForm.templateId = record?.templateId || ''
  templateEditForm.details = Array.isArray(record?.details)
    ? record.details.map((item) => ({ field: item.field || '', value: item.value || '' }))
    : []
  templateEditForm.page = record?.page || ''
  templateEditVisible.value = true
}

const submitTemplateEdit = async () => {
  if (!templateEditForm.templateName || !templateEditForm.templateId) {
    message.warning(t('settings.templateSettings.messages.emptyInput'))
    return
  }
  if (templateEditSaving.value) {
    return
  }
  templateEditSaving.value = true
  try {
    const details = (templateEditForm.details || [])
      .map((item) => ({
        field: (item.field || '').trim(),
        value: (item.value || '').trim(),
      }))
      .filter((item) => item.field && item.value)
    await updateTemplateSetting(templateEditForm.templateName, {
      templateId: templateEditForm.templateId,
      templateName: templateEditForm.templateName,
      details,
      page: (templateEditForm.page || '').trim() || undefined,
    })
    message.success(t('settings.templateSettings.messages.updateSuccess'))
    templateEditVisible.value = false
    await loadTemplateSettings()
  } catch (error) {
    console.error('Failed to update template setting', error)
    message.error(t('settings.templateSettings.messages.updateFailed'))
  } finally {
    templateEditSaving.value = false
  }
}

const normalizeAutoTaskConfig = (raw) => {
  if (!raw) {
    return {
      enabled: false,
      startTime: '',
      frequency: '',
      conditionKeys: [],
      templateFields: [],
    }
  }
  const conditionKeys = Array.isArray(raw?.conditionKeys) ? raw.conditionKeys : []
  const templateFields = Array.isArray(raw?.templateFields) ? raw.templateFields : []
  const hasParams =
    Boolean(raw?.startTime) ||
    Boolean(raw?.frequency) ||
    conditionKeys.length > 0 ||
    templateFields.length > 0
  return {
    enabled: Boolean(hasParams),
    startTime: raw?.startTime || '',
    frequency: raw?.frequency || '',
    conditionKeys,
    templateFields,
  }
}

const mapTemplateFieldsToRows = (templateFields = []) => {
  const rows = []
  templateFields.forEach((entry) => {
    if (!entry || typeof entry !== 'object') return
    Object.entries(entry).forEach(([field, value]) => {
      if (!field) return
      rows.push({ field, value: value ?? '' })
    })
  })
  return rows
}

const buildAutoTaskTemplateFieldsPayload = () =>
  (autoTaskForm.templateFields || [])
    .map((item) => ({
      field: (item.field || '').trim(),
      value: typeof item.value === 'string' ? item.value.trim() : item.value ?? '',
    }))
    .filter((item) => item.field)
    .map((item) => ({ [item.field]: item.value }))

const loadAutoTaskConfig = async (templateId) => {
  if (!templateId) return null
  templateAutoTaskLoadingMap[templateId] = true
  try {
    const data = await fetchSubscriptionAutoTask(templateId)
    const normalized = normalizeAutoTaskConfig(data)
    templateAutoTaskMap[templateId] = normalized
    return normalized
  } catch (error) {
    if (error?.response?.status !== 404) {
      console.error('Failed to load auto task config', error)
    }
    const normalized = normalizeAutoTaskConfig(null)
    templateAutoTaskMap[templateId] = normalized
    return normalized
  } finally {
    templateAutoTaskLoadingMap[templateId] = false
  }
}

const loadAllAutoTaskConfigs = async () => {
  const templateIds = Object.values(templateSettings.templates || {})
    .map((config) => (typeof config === 'string' ? config : config?.templateId))
    .filter(Boolean)
  const uniqueIds = Array.from(new Set(templateIds))
  await Promise.all(uniqueIds.map((templateId) => loadAutoTaskConfig(templateId)))
}

const openAutoTaskEdit = async (record) => {
  autoTaskEditLoading.value = true
  autoTaskForm.templateName = record?.templateName || ''
  autoTaskForm.templateId = record?.templateId || ''
  try {
    const normalized =
      templateAutoTaskMap[record?.templateId] ?? (await loadAutoTaskConfig(record?.templateId))
    autoTaskForm.enabled = Boolean(normalized?.enabled)
    autoTaskForm.startTime = normalized?.startTime || ''
    autoTaskForm.frequency = normalized?.frequency || ''
    autoTaskForm.conditionKeys = Array.isArray(normalized?.conditionKeys)
      ? [...normalized.conditionKeys]
      : []
    const rows = mapTemplateFieldsToRows(normalized?.templateFields || [])
    autoTaskForm.templateFields = rows.length ? rows : [{ field: '', value: '' }]
    autoTaskEditVisible.value = true
  } finally {
    autoTaskEditLoading.value = false
  }
}

const submitAutoTaskEdit = async () => {
  if (!autoTaskForm.templateId) {
    return
  }
  if (autoTaskEditSaving.value) {
    return
  }
  autoTaskEditSaving.value = true
  try {
    const payload = autoTaskForm.enabled
      ? {
        startTime: autoTaskForm.startTime || undefined,
        frequency: autoTaskForm.frequency || undefined,
        conditionKeys: Array.isArray(autoTaskForm.conditionKeys) ? autoTaskForm.conditionKeys : [],
        templateFields: buildAutoTaskTemplateFieldsPayload(),
      }
      : {}
    await saveSubscriptionAutoTask(autoTaskForm.templateId, payload)
    message.success(t('settings.templateSettings.autoTask.messages.saveSuccess'))
    autoTaskEditVisible.value = false
    await loadAutoTaskConfig(autoTaskForm.templateId)
  } catch (error) {
    console.error('Failed to update auto task config', error)
    message.error(t('settings.templateSettings.autoTask.messages.saveFailed'))
  } finally {
    autoTaskEditSaving.value = false
  }
}

const handleDeleteTemplateSetting = async (templateName) => {
  templateSettingsSaving.value = true
  try {
    await deleteTemplateSetting(templateName)
    message.success(t('settings.templateSettings.messages.deleteSuccess'))
    await loadTemplateSettings()
  } catch (error) {
    console.error('Failed to delete template setting', error)
    message.error(t('settings.templateSettings.messages.deleteFailed'))
  } finally {
    templateSettingsSaving.value = false
  }
}

const normalizeNewbieTasks = (tasks = []) => {
  const rows = (tasks || []).map((item) => ({
    index: Number.isFinite(Number(item?.index)) ? Number(item?.index) : null,
    name: item?.name ?? '',
    description: item?.description ?? '',
    buttonText: item?.buttonText ?? '',
  }))
  return rows.length ? rows : [createNewbieTaskRow()]
}

const normalizeNetdiskLinks = (links = []) => {
  const rows = (links || []).map((item) => ({
    name: item?.name ?? '',
    url: item?.url ?? '',
  }))
  return rows.length ? rows : [createNetdiskLinkRow()]
}

const loadNewbieTaskTemplate = async () => {
  newbieTaskTemplateLoading.value = true
  try {
    const data = await fetchNewbieTaskTemplate()
    newbieTaskTemplateForm.value = normalizeNewbieTasks(data?.tasks)
    newbieTaskTemplateUpdatedAt.value = data?.updatedAt || null
    newbieTaskQrCodeUrl.value = extractObjectName(data?.qrCodeUrl ?? '')
    newbieTaskQrCodeUploadedAt.value = data?.qrCodeUploadedAt ?? null
  } catch (error) {
    if (error?.response?.status === 404) {
      newbieTaskTemplateForm.value = [createNewbieTaskRow()]
      newbieTaskTemplateUpdatedAt.value = null
      newbieTaskQrCodeUrl.value = ''
      newbieTaskQrCodeUploadedAt.value = null
      return
    }
    console.error('Failed to load newbie task template', error)
    message.error(t('settings.newbieTasks.template.messages.loadFailed'))
  } finally {
    newbieTaskTemplateLoading.value = false
  }
}

const submitNewbieTaskTemplate = async () => {
  if (newbieTaskTemplateSaving.value) {
    return
  }
  const tasks = (newbieTaskTemplateForm.value || [])
    .map((item) => ({
      index: Number(item?.index),
      name: (item?.name || '').trim(),
      description: (item?.description || '').trim(),
      buttonText: (item?.buttonText || '').trim(),
    }))
    .filter((item) => Number.isFinite(item.index) && item.name)
  if (!tasks.length) {
    message.warning(t('settings.newbieTasks.template.messages.empty'))
    return
  }
  newbieTaskTemplateSaving.value = true
  try {
    await saveNewbieTaskTemplate({
      tasks,
      qrCodeUrl: extractObjectName(newbieTaskQrCodeUrl.value || ''),
    })
    message.success(t('settings.newbieTasks.template.messages.saveSuccess'))
    await loadNewbieTaskTemplate()
  } catch (error) {
    console.error('Failed to save newbie task template', error)
    message.error(t('settings.newbieTasks.template.messages.saveFailed'))
  } finally {
    newbieTaskTemplateSaving.value = false
  }
}

const handleDeleteNewbieTaskTemplate = async () => {
  if (newbieTaskTemplateSaving.value) {
    return
  }
  newbieTaskTemplateSaving.value = true
  try {
    await deleteNewbieTaskTemplate()
    newbieTaskTemplateForm.value = [createNewbieTaskRow()]
    newbieTaskTemplateUpdatedAt.value = null
    newbieTaskQrCodeUrl.value = ''
    newbieTaskQrCodeUploadedAt.value = null
    message.success(t('settings.newbieTasks.template.messages.deleteSuccess'))
  } catch (error) {
    console.error('Failed to delete newbie task template', error)
    message.error(t('settings.newbieTasks.template.messages.deleteFailed'))
  } finally {
    newbieTaskTemplateSaving.value = false
  }
}

const getNewbieTaskQrCodeUrl = (value) => buildDownloadUrl(extractObjectName(value || ''))

const formatNewbieTaskQrUploadedAt = (value) =>
  value ? new Date(value).toLocaleString() : t('settings.newbieTasks.template.qrCode.emptyUploadedAt')

const handleNewbieTaskQrUpload = async (event) => {
  const file = event?.target?.files?.[0]
  if (!file) {
    return
  }
  newbieTaskQrUploadLoading.value = true
  try {
    const result = await uploadPublicFile(file)
    newbieTaskQrCodeUrl.value = result?.objectName || extractObjectName(result?.url || '') || ''
    newbieTaskQrCodeUploadedAt.value = new Date().toISOString()
    message.success(t('settings.newbieTasks.template.qrCode.uploadSuccess'))
  } catch (error) {
    console.error('Failed to upload newbie task qr code', error)
    message.error(t('settings.newbieTasks.template.qrCode.uploadFailed'))
  } finally {
    newbieTaskQrUploadLoading.value = false
    if (event?.target) {
      event.target.value = ''
    }
  }
}

const removeNewbieTaskQrCode = () => {
  newbieTaskQrCodeUrl.value = ''
  newbieTaskQrCodeUploadedAt.value = null
}

const loadNetdiskGiftConfig = async () => {
  netdiskGiftLoading.value = true
  try {
    const data = await fetchNetdiskGiftConfig()
    netdiskGiftForm.value = normalizeNetdiskLinks(data?.links)
    netdiskGiftUpdatedAt.value = data?.updatedAt || null
  } catch (error) {
    if (error?.response?.status === 404) {
      netdiskGiftForm.value = [createNetdiskLinkRow()]
      netdiskGiftUpdatedAt.value = null
      return
    }
    console.error('Failed to load netdisk gift config', error)
    message.error(t('settings.newbieTasks.netdisk.messages.loadFailed'))
  } finally {
    netdiskGiftLoading.value = false
  }
}

const submitNetdiskGiftConfig = async () => {
  if (netdiskGiftSaving.value) {
    return
  }
  const links = (netdiskGiftForm.value || [])
    .map((item) => ({
      name: (item?.name || '').trim(),
      url: (item?.url || '').trim(),
    }))
    .filter((item) => item.name && item.url)
  if (!links.length) {
    message.warning(t('settings.newbieTasks.netdisk.messages.empty'))
    return
  }
  netdiskGiftSaving.value = true
  try {
    await saveNetdiskGiftConfig({ links })
    message.success(t('settings.newbieTasks.netdisk.messages.saveSuccess'))
    await loadNetdiskGiftConfig()
  } catch (error) {
    console.error('Failed to save netdisk gift config', error)
    message.error(t('settings.newbieTasks.netdisk.messages.saveFailed'))
  } finally {
    netdiskGiftSaving.value = false
  }
}

const handleDeleteNetdiskGiftConfig = async () => {
  if (netdiskGiftSaving.value) {
    return
  }
  netdiskGiftSaving.value = true
  try {
    await deleteNetdiskGiftConfig()
    netdiskGiftForm.value = [createNetdiskLinkRow()]
    netdiskGiftUpdatedAt.value = null
    message.success(t('settings.newbieTasks.netdisk.messages.deleteSuccess'))
  } catch (error) {
    console.error('Failed to delete netdisk gift config', error)
    message.error(t('settings.newbieTasks.netdisk.messages.deleteFailed'))
  } finally {
    netdiskGiftSaving.value = false
  }
}

const loadFontFileConfig = async () => {
  fontFileLoading.value = true
  try {
    const data = await fetchFontFileConfig()
    fontFileConfig.fileName = extractObjectName(data?.fileName || '')
    fontFileConfig.version = data?.version || ''
  } catch (error) {
    if (error?.response?.status !== 404) {
      console.error('Failed to load font config', error)
      message.error(t('settings.system.font.messages.loadFailed'))
    }
    fontFileConfig.fileName = ''
    fontFileConfig.version = ''
  } finally {
    fontFileLoading.value = false
    resetFontFileForm(fontFileConfig.version)
  }
}

const handleFontFileSelect = (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return
  fontFileSelected.value = file
  fontFileForm.fileName = file.name || ''
  if (!fontFileForm.version) {
    fontFileForm.version = getNextFontVersion(fontFileConfig.version)
  }
  if (event?.target) {
    event.target.value = ''
  }
}

const clearFontFileSelection = () => {
  fontFileSelected.value = null
  fontFileForm.fileName = ''
}

const submitFontFileForm = async () => {
  if (!fontFileSelected.value) {
    message.warning(t('settings.system.font.messages.noFile'))
    return
  }
  const version = (fontFileForm.version || '').trim()
  if (!version) {
    message.warning(t('settings.system.font.messages.noVersion'))
    return
  }
  if (fontFileSaving.value) {
    return
  }
  fontFileSaving.value = true
  try {
    await uploadFontFileConfig(fontFileSelected.value, version)
    message.success(t('settings.system.font.messages.uploadSuccess'))
    await loadFontFileConfig()
  } catch (error) {
    console.error('Failed to upload font file', error)
    message.error(t('settings.system.font.messages.uploadFailed'))
  } finally {
    fontFileSaving.value = false
  }
}

const loadNewbieTaskStats = async () => {
  newbieTaskStatsLoading.value = true
  try {
    const { content, totalElements, page, size } = await fetchAdminUserNewbieTasks({
      page: newbieTaskStatsPagination.current,
      size: newbieTaskStatsPagination.pageSize,
    })
    newbieTaskStats.value = (content || []).map((item) => {
      const tasks = Array.isArray(item?.tasks)
        ? [...item.tasks].sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0))
        : []
      return {
        ...item,
        avatarUrl: resolveProfileAsset(item?.avatarUrl),
        tasks,
      }
    })
    newbieTaskStatsPagination.total = totalElements
    newbieTaskStatsPagination.current = page
    newbieTaskStatsPagination.pageSize = size
  } catch (error) {
    console.error('Failed to load newbie task stats', error)
    message.error(t('settings.newbieTasks.stats.messages.loadFailed'))
  } finally {
    newbieTaskStatsLoading.value = false
  }
}

const handleNewbieTaskStatsTableChange = (pager) => {
  newbieTaskStatsPagination.current = pager?.current ?? 1
  newbieTaskStatsPagination.pageSize = pager?.pageSize ?? newbieTaskStatsPagination.pageSize
  loadNewbieTaskStats()
}

const loadLotteryConfig = async () => {
  lotteryConfigLoading.value = true
  try {
    const data = await fetchLotteryConfig()
    lotteryPrizeForm.value = normalizeLotteryPrizes(data?.prizes)
    lotteryConfigUpdatedAt.value = data?.updatedAt || null
  } catch (error) {
    console.error('Failed to load lottery config', error)
    message.error(t('settings.lottery.messages.loadFailed'))
  } finally {
    lotteryConfigLoading.value = false
  }
}

const submitLotteryConfig = async () => {
  if (!lotteryProbabilityValid.value) {
    message.warning(t('settings.lottery.messages.invalidProbability'))
    return
  }
  if (lotteryConfigSaving.value) {
    return
  }
  lotteryConfigSaving.value = true
  try {
    const prizes = lotteryPrizeForm.value.map((item) => ({
      level: item.level,
      flp: Boolean(item.flp),
      flpCount: item.flp ? String(item.flpCount || '').trim() || null : null,
      description: item.flp ? '' : (item.description || '').trim(),
      imageUrl: item.flp ? '' : extractObjectName(item.imageUrl || ''),
      probability: Number(item.probability || 0),
    }))
    await saveLotteryConfig({ prizes })
    message.success(t('settings.lottery.messages.saveSuccess'))
    await loadLotteryConfig()
  } catch (error) {
    console.error('Failed to save lottery config', error)
    message.error(t('settings.lottery.messages.saveFailed'))
  } finally {
    lotteryConfigSaving.value = false
  }
}

const loadLotteryLogs = async () => {
  lotteryLogsLoading.value = true
  try {
    const { content, totalElements, page, size } = await fetchLotteryLogs({
      page: lotteryLogPagination.current,
      size: lotteryLogPagination.pageSize,
      featureCode: lotteryLogFilters.featureCode.trim() || undefined,
    })
    lotteryLogs.value = content || []
    lotteryLogPagination.total = totalElements
    lotteryLogPagination.current = page
    lotteryLogPagination.pageSize = size
  } catch (error) {
    console.error('Failed to load lottery logs', error)
    message.error(t('settings.lottery.messages.logLoadFailed'))
  } finally {
    lotteryLogsLoading.value = false
  }
}

const loadCheckinLogs = async () => {
  checkinLogsLoading.value = true
  try {
    const { content, totalElements, page, size } = await fetchAdminUserCheckins({
      page: checkinLogPagination.current,
      size: checkinLogPagination.pageSize,
    })
    checkinLogs.value = (content || []).map((item) => ({
      ...item,
      avatarUrl: resolveProfileAsset(item?.avatarUrl),
      checkinTimes: Array.isArray(item?.checkinTimes) ? item.checkinTimes : [],
    }))
    checkinLogPagination.total = totalElements
    checkinLogPagination.current = page
    checkinLogPagination.pageSize = size
  } catch (error) {
    console.error('Failed to load checkin logs', error)
    message.error(t('settings.lottery.checkins.messages.loadFailed'))
  } finally {
    checkinLogsLoading.value = false
  }
}

const handleLotteryLogSearch = () => {
  lotteryLogPagination.current = 1
  loadLotteryLogs()
}

const handleLotteryLogTableChange = (pager) => {
  lotteryLogPagination.current = pager?.current ?? 1
  lotteryLogPagination.pageSize = pager?.pageSize ?? lotteryLogPagination.pageSize
  loadLotteryLogs()
}

const handleCheckinLogTableChange = (pager) => {
  checkinLogPagination.current = pager?.current ?? 1
  checkinLogPagination.pageSize = pager?.pageSize ?? checkinLogPagination.pageSize
  loadCheckinLogs()
}

const formatReportEntryArea = (entry) => {
  if (!entry) return '-'
  if (entry.county) {
    return entry.city ? `${entry.city} / ${entry.county}` : entry.county
  }
  if (entry.city) return entry.city
  if (entry.province === '全国') return t('settings.reportEntry.area.nationwide')
  return t('settings.reportEntry.area.allProvince')
}

const selectReportEntry = (entry) => {
  if (!entry) {
    reportEntrySelectedId.value = null
    return
  }
  reportEntrySelectedId.value = entry.id
}

const reportEntryRowProps = (record) => ({
  onClick: () => selectReportEntry(record),
})

const reportEntryRowClassName = (record) =>
  record?.id && record.id === reportEntrySelectedId.value ? 'report-entry-row--active' : ''

const loadReportEntries = async () => {
  reportEntryLoading.value = true
  try {
    const { content, totalElements, page, size } = await fetchReportEntries({
      page: reportEntryPagination.current,
      size: reportEntryPagination.pageSize,
    })
    reportEntryList.value = content || []
    reportEntryDeletedIds.value = []
    reportEntryPagination.total = totalElements
    reportEntryPagination.current = page
    reportEntryPagination.pageSize = size
  } catch (error) {
    console.error('Failed to load report entries', error)
    message.error(t('settings.reportEntry.messages.loadFailed'))
  } finally {
    reportEntryLoading.value = false
  }
}

const loadReportEntryDialogText = async () => {
  try {
    const data = await fetchReportEntryDialogText()
    reportEntryDialogText.value = data?.dialogText || ''
  } catch (error) {
    console.error('Failed to load report entry dialog text', error)
    message.error(t('settings.reportEntry.messages.loadDialogFailed'))
  }
}

const handleReportEntryTableChange = (pager) => {
  reportEntryPagination.current = pager?.current ?? 1
  reportEntryPagination.pageSize = pager?.pageSize ?? reportEntryPagination.pageSize
  loadReportEntries()
}

const resetReportEntryForm = () => {
  reportEntryForm.areaPath = []
  reportEntryForm.miniProgramAppId = ''
  reportEntryForm.miniProgramPath = ''
  reportEntryForm.guideType = 'publicAccount'
  reportEntryForm.publicAccountLink = ''
  reportEntryForm.videoAccountId = ''
  reportEntryForm.videoId = ''
  reportEntrySelectedKeys.value = []
  reportEntryFormRef.value?.clearValidate?.()
}

const openReportEntryDrawer = (entry) => {
  if (entry) {
    reportEntryEditingId.value = entry.id
    reportEntryForm.areaPath = buildReportEntryAreaPath(entry)
    reportEntrySelectedKeys.value = [reportEntryForm.areaPath.join('/')]
    reportEntryForm.miniProgramAppId = entry?.miniProgram?.appId || ''
    reportEntryForm.miniProgramPath = entry?.miniProgram?.path || ''
    reportEntryForm.publicAccountLink = entry?.guide?.publicAccountLink || ''
    reportEntryForm.videoAccountId = entry?.guide?.videoAccountId || ''
    reportEntryForm.videoId = entry?.guide?.videoId || ''
    reportEntryForm.guideType = reportEntryForm.publicAccountLink ? 'publicAccount' : 'video'
    selectReportEntry(entry)
  } else {
    reportEntryEditingId.value = null
    resetReportEntryForm()
  }
  reportEntryDrawerVisible.value = true
}

const handleReportEntryAreaCheck = (_, info) => {
  if (!info?.checked) {
    reportEntryForm.areaPath = []
    reportEntrySelectedKeys.value = []
    return
  }
  const nodePath = info?.node?.path || info?.node?.dataRef?.path
  if (Array.isArray(nodePath)) {
    reportEntryForm.areaPath = [...nodePath]
  }
  reportEntrySelectedKeys.value = info?.node?.key ? [info.node.key] : []
}

const handleReportEntryTreeExpand = (expandedKeys) => {
  reportEntryTreeExpandedKeys.value = expandedKeys
  reportEntryAutoExpandParent.value = false
}

const buildReportEntryPayloadFromEntry = (entry) => ({
  province: entry?.province || '',
  city: entry?.city ?? null,
  county: entry?.county ?? null,
  miniProgram: {
    appId: entry?.miniProgram?.appId || '',
    path: entry?.miniProgram?.path || '',
  },
  guide: {
    publicAccountLink: entry?.guide?.publicAccountLink || '',
    videoAccountId: entry?.guide?.videoAccountId || '',
    videoId: entry?.guide?.videoId || '',
  },
})

const submitReportEntryForm = async () => {
  if (reportEntrySaving.value) return
  try {
    await reportEntryFormRef.value?.validate?.()
  } catch (error) {
    return
  }
  reportEntrySaving.value = true
  try {
    const region = resolveReportEntryRegion(reportEntryForm.areaPath)
    const nextPayload = {
      province: region.province,
      city: region.city,
      county: region.county,
      miniProgram: {
        appId: reportEntryForm.miniProgramAppId.trim(),
        path: reportEntryForm.miniProgramPath.trim(),
      },
      guide: {
        publicAccountLink: reportEntryForm.publicAccountLink.trim(),
        videoAccountId: reportEntryForm.videoAccountId.trim(),
        videoId: reportEntryForm.videoId.trim(),
      },
    }
    if (reportEntryEditingId.value) {
      const updated = updateReportEntryInList(reportEntryEditingId.value, (current) => ({
        ...current,
        ...nextPayload,
      }))
      if (updated) {
        selectReportEntry(updated)
      }
    } else {
      const newEntry = {
        id: createTempReportEntryId(),
        ...nextPayload,
      }
      reportEntryList.value.unshift(newEntry)
      reportEntryEditingId.value = newEntry.id
      selectReportEntry(newEntry)
    }
    reportEntryDrawerVisible.value = false
  } catch (error) {
    console.error('Failed to update report entry draft', error)
    message.error(t('settings.reportEntry.messages.saveFailed'))
  } finally {
    reportEntrySaving.value = false
  }
}

const submitReportEntryConfig = async () => {
  if (reportEntryConfigSaving.value) return
  const dialogTextValue = reportEntryDialogText.value.trim()
  if (!dialogTextValue) {
    message.warning(t('settings.reportEntry.messages.dialogRequired'))
    return
  }
  reportEntryConfigSaving.value = true
  try {
    await saveReportEntryDialogText({ dialogText: dialogTextValue })
    for (const id of reportEntryDeletedIds.value) {
      await deleteReportEntry(id)
    }
    for (const entry of reportEntryList.value) {
      const payload = buildReportEntryPayloadFromEntry(entry)
      if (isTempReportEntryId(entry.id)) {
        const created = await createReportEntry(payload)
        if (created?.id) {
          updateReportEntryInList(entry.id, { id: created.id })
          if (reportEntrySelectedId.value === entry.id) {
            reportEntrySelectedId.value = created.id
          }
        }
      } else {
        await updateReportEntry(entry.id, payload)
      }
    }
    reportEntryDeletedIds.value = []
    message.success(t('settings.reportEntry.messages.saveSuccess'))
    await loadReportEntries()
  } catch (error) {
    console.error('Failed to save report entry config', error)
    message.error(t('settings.reportEntry.messages.saveFailed'))
  } finally {
    reportEntryConfigSaving.value = false
  }
}

const handleReportEntryDelete = (entry) => {
  if (!entry?.id) return
  Modal.confirm({
    title: t('settings.reportEntry.actions.deleteConfirmTitle'),
    content: t('settings.reportEntry.actions.deleteConfirmContent', { name: entry.province || '' }),
    okText: t('settings.reportEntry.actions.delete'),
    cancelText: t('settings.reportEntry.actions.cancel'),
    onOk: async () => {
      try {
        if (!isTempReportEntryId(entry.id) && !reportEntryDeletedIds.value.includes(entry.id)) {
          reportEntryDeletedIds.value.push(entry.id)
        }
        reportEntryList.value = reportEntryList.value.filter((item) => item.id !== entry.id)
        if (reportEntrySelectedId.value === entry.id) {
          reportEntrySelectedId.value = null
        }
        message.success(t('settings.reportEntry.messages.deleteSuccess'))
      } catch (error) {
        console.error('Failed to delete report entry', error)
        message.error(t('settings.reportEntry.messages.deleteFailed'))
      }
    },
  })
}

const handleReportEntryAction = (actionKey, entry) => {
  if (!entry) return
  if (actionKey === 'edit') {
    openReportEntryDrawer(entry)
    return
  }
  if (actionKey === 'delete') {
    handleReportEntryDelete(entry)
  }
}

const handleLotteryImageUpload = async (prize, event) => {
  const file = event?.target?.files?.[0]
  if (!file || !prize) {
    return
  }
  lotteryUploadLoadingMap[prize.level] = true
  try {
    const result = await uploadPublicFile(file)
    prize.imageUrl = result?.objectName || extractObjectName(result?.url || '') || ''
    message.success(t('settings.lottery.prizes.uploadSuccess'))
  } catch (error) {
    console.error('Failed to upload lottery image', error)
    message.error(t('settings.lottery.prizes.uploadFailed'))
  } finally {
    lotteryUploadLoadingMap[prize.level] = false
    if (event?.target) {
      event.target.value = ''
    }
  }
}

const removeLotteryImage = (prize) => {
  if (!prize) return
  prize.imageUrl = ''
}

const lotteryPaginationConfig = computed(() => ({
  current: lotteryLogPagination.current,
  pageSize: lotteryLogPagination.pageSize,
  total: lotteryLogPagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total, range) =>
    t('settings.lottery.logs.pagination.total', {
      total,
      start: range?.[0] ?? 0,
      end: range?.[1] ?? 0,
    }),
}))

const checkinPaginationConfig = computed(() => ({
  current: checkinLogPagination.current,
  pageSize: checkinLogPagination.pageSize,
  total: checkinLogPagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total, range) =>
    t('settings.lottery.checkins.pagination.total', {
      total,
      start: range?.[0] ?? 0,
      end: range?.[1] ?? 0,
    }),
}))

const newbieTaskStatsPaginationConfig = computed(() => ({
  current: newbieTaskStatsPagination.current,
  pageSize: newbieTaskStatsPagination.pageSize,
  total: newbieTaskStatsPagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total, range) =>
    t('settings.newbieTasks.stats.pagination.total', {
      total,
      start: range?.[0] ?? 0,
      end: range?.[1] ?? 0,
    }),
}))

const invitePaginationConfig = computed(() => ({
  current: inviteLogPagination.current,
  pageSize: inviteLogPagination.pageSize,
  total: inviteLogPagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total, range) =>
    t('settings.invite.logs.pagination.total', {
      total,
      start: range?.[0] ?? 0,
      end: range?.[1] ?? 0,
    }),
}))

const reportEntryPaginationConfig = computed(() => ({
  current: reportEntryPagination.current,
  pageSize: reportEntryPagination.pageSize,
  total: reportEntryPagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total, range) =>
    t('settings.reportEntry.pagination.total', {
      total,
      start: range?.[0] ?? 0,
      end: range?.[1] ?? 0,
    }),
}))

watch(copyType, (next, previous) => {
  if (next !== previous) {
    loadCopyContent()
  }
})

watch(reportEntryTreeFilterResult, (result) => {
  if (!reportEntrySearch.value.trim()) {
    reportEntryTreeExpandedKeys.value = reportEntryDefaultExpandedKeys
    reportEntryAutoExpandParent.value = false
    return
  }
  reportEntryTreeExpandedKeys.value = result.expandedKeys
  reportEntryAutoExpandParent.value = true
})

onMounted(() => {
  loadInviteConfig()
  loadInviteLogs()
  loadMapConfig()
  loadCopyContent()
  loadPaymentConfig()
  loadWeappConfig()
  loadTemplateSettings()
  loadNewbieTaskTemplate()
  loadNewbieTaskStats()
  loadNetdiskGiftConfig()
  loadFontFileConfig()
  loadLotteryConfig()
  loadLotteryLogs()
  loadCheckinLogs()
  loadReportEntries()
  loadReportEntryDialogText()
})
</script>

<template>
  <div class="settings-wrapper">
    <a-card :bordered="false" class="settings-card">
      <a-tabs v-model:activeKey="activeTab">
        <a-tab-pane key="invite" :tab="t('settings.tabs.invite')">
          <div class="tab-section">
                <section class="invite-table">
                  <header class="section-header">
                    <div>
                      <h3>{{ t('settings.invite.logs.title') }}</h3>
                      <p>{{ t('settings.invite.logs.subtitle') }}</p>
                    </div>
                    <div class="filters">
                      <div class="filter-tags">
                        <a-tag
                          v-for="item in inviteLogTypeOptions"
                          :key="item.value || 'all'"
                          :color="inviteLogFilters.logType === item.value ? 'blue' : 'default'"
                          class="filter-tag"
                          @click="handleInviteLogTypeChange(item.value)"
                        >
                          {{ item.label }}
                        </a-tag>
                      </div>
                      <a-input v-model:value="inviteLogFilters.featureCode"
                        :placeholder="t('settings.invite.logs.searchPlaceholder')" allow-clear class="filter-input" />
                      <a-button type="primary" @click="handleInviteLogSearch">
                        {{ t('settings.invite.logs.search') }}
                  </a-button>
                </div>
              </header>
                <a-table :columns="inviteColumns" :data-source="inviteLogs" :loading="inviteLogsLoading"
                  :pagination="invitePaginationConfig" row-key="id" @change="handleInviteLogTableChange">
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'avatar'">
                      <a-avatar :src="record?.user?.avatarUrl" :alt="record?.user?.username" />
                    </template>
                    <template v-else-if="column.key === 'amount'">
                      <span :class="['amount', record.operation === 'DECREASE' ? 'negative' : 'positive']">
                        {{ record.operation === 'DECREASE' ? '-' : '+' }}{{ record.amount ?? 0 }}
                      </span>
                    </template>
                    <template v-else-if="column.key === 'operation'">
                      <a-tag :color="record.operation === 'DECREASE' ? 'red' : 'green'">
                        {{ t(`settings.invite.logs.operation.${record.operation?.toLowerCase() || 'increase'}`) }}
                      </a-tag>
                    </template>
                    <template v-else-if="column.key === 'createdAt'">
                      {{ new Date(record.createdAt).toLocaleString() }}
                    </template>
                  </template>
                </a-table>
            </section>

            <section class="invite-form">
              <h3>{{ t('settings.invite.form.title') }}</h3>
              <a-spin :spinning="inviteLoading">
                <a-form :model="inviteForm" :rules="inviteRules" layout="vertical" @finish="submitInviteForm">
                  <a-row :gutter="[24, 12]">
                    <a-col :xs="24" :md="12">
                      <a-form-item name="friendRegisterRewardFlp"
                        :label="t('settings.invite.form.friendRegisterRewardFlp')">
                        <a-input-number v-model:value="inviteForm.friendRegisterRewardFlp" :min="0" :step="0.1"
                          :precision="2" :placeholder="t('settings.invite.form.placeholder')" style="width: 100%" />
                      </a-form-item>
                    </a-col>
                    <a-col :xs="24" :md="12">
                      <a-form-item name="friendFirstMarkerFlp" :label="t('settings.invite.form.friendFirstMarkerFlp')">
                        <a-input-number v-model:value="inviteForm.friendFirstMarkerFlp" :min="0" :step="0.1"
                          :precision="2" :placeholder="t('settings.invite.form.placeholder')" style="width: 100%" />
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <div class="actions">
                    <a-button type="primary" html-type="submit" :loading="inviteSaving">
                      {{ t('common.actions.save') }}
                    </a-button>
                    <a-button type="default" @click="loadInviteConfig" :disabled="inviteLoading || inviteSaving">
                      {{ t('common.actions.reset') }}
                    </a-button>
                  </div>
                </a-form>
              </a-spin>
            </section>
          </div>
        </a-tab-pane>

        <a-tab-pane key="map" :tab="t('settings.tabs.mapSettlement')">
          <div class="tab-section">
            <a-spin :spinning="mapLoading">
              <a-form :model="mapForm" :rules="mapRules" layout="vertical" @finish="submitMapForm">
                <a-row :gutter="[24, 12]">
                  <a-col :xs="24" :md="12">
                    <a-form-item name="wechatListPrice" :label="t('settings.mapSettlement.form.wechatListPrice')">
                      <a-input-number v-model:value="mapForm.wechatListPrice" :min="0" :precision="2" :step="0.1"
                        style="width: 100%" />
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :md="12">
                    <a-form-item name="wechatNetPrice" :label="t('settings.mapSettlement.form.wechatNetPrice')">
                      <a-input-number v-model:value="mapForm.wechatNetPrice" :min="0" :precision="2" :step="0.1"
                        style="width: 100%" />
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :md="12">
                    <a-form-item name="flpListPrice" :label="t('settings.mapSettlement.form.flpListPrice')">
                      <a-input-number v-model:value="mapForm.flpListPrice" :min="0" :precision="2" :step="0.1"
                        style="width: 100%" />
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :md="12">
                    <a-form-item name="flpNetPrice" :label="t('settings.mapSettlement.form.flpNetPrice')">
                      <a-input-number v-model:value="mapForm.flpNetPrice" :min="0" :precision="2" :step="0.1"
                        style="width: 100%" />
                    </a-form-item>
                  </a-col>
                </a-row>
                <div class="actions">
                  <a-button type="primary" html-type="submit" :loading="mapSaving">
                    {{ t('common.actions.save') }}
                  </a-button>
                  <a-button type="default" @click="loadMapConfig" :disabled="mapLoading || mapSaving">
                    {{ t('common.actions.reset') }}
                  </a-button>
                </div>
              </a-form>
            </a-spin>
          </div>
        </a-tab-pane>

        <a-tab-pane key="copy-settings" :tab="t('settings.tabs.copySettings')">
          <div class="tab-section">
            <a-spin :spinning="copyLoading">
              <a-form :model="copyForm" layout="vertical" @finish="submitCopyForm">
                <a-form-item :label="t('settings.copySettings.form.type')">
                  <a-radio-group v-model:value="copyType" :disabled="copyLoading || copySaving">
                    <a-radio v-for="option in copyTypeOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </a-radio>
                  </a-radio-group>
                </a-form-item>
                <a-form-item name="content" :label="t('settings.copySettings.form.content')">
                  <open-platform-editor v-model="copyForm.content"
                    :placeholder="t('settings.copySettings.form.placeholder')" :disabled="copyLoading || copySaving" />
                </a-form-item>
                <div class="actions">
                  <a-button type="primary" html-type="submit" :loading="copySaving">
                    {{ t('settings.copySettings.actions.save') }}
                  </a-button>
                  <a-button type="default" @click="showCopyPreview" :disabled="copyLoading">
                    {{ t('settings.copySettings.actions.preview') }}
                  </a-button>
                  <a-button type="default" @click="loadCopyContent" :disabled="copyLoading || copySaving">
                    {{ t('common.actions.reset') }}
                  </a-button>
                </div>
              </a-form>
            </a-spin>
            <a-modal :open="copyPreviewVisible" :title="t('settings.copySettings.preview.title')" width="440px"
              :footer="null" @cancel="closeCopyPreview">
              <div class="open-platform-preview">
                <div class="open-platform-preview__device">
                  <div class="open-platform-preview__notch"></div>
                  <div class="open-platform-preview__screen">
                    <div class="open-platform-preview__scroller">
                      <div v-if="copyHasContent" class="open-platform-preview__content" v-html="copyForm.content"></div>
                      <a-empty v-else :description="t('settings.copySettings.preview.empty')" />
                    </div>
                  </div>
                </div>
              </div>
              <div class="open-platform-preview__footer">
                <a-button type="primary" @click="closeCopyPreview">
                  {{ t('settings.copySettings.preview.close') }}
                </a-button>
              </div>
            </a-modal>
          </div>
        </a-tab-pane>

        <a-tab-pane key="payment" :tab="t('settings.tabs.payment')">
          <div class="tab-section">
            <p class="tab-description">{{ t('settings.payment.description') }}</p>
            <a-spin :spinning="paymentLoading">
              <a-form :model="paymentForm" :rules="paymentRules" layout="vertical" @finish="submitPaymentForm">
                <a-row :gutter="[24, 12]">
                  <a-col :xs="24" :md="12">
                    <a-form-item name="mchId" :label="t('settings.payment.form.mchId')">
                      <a-input v-model:value="paymentForm.mchId" :placeholder="t('settings.payment.placeholders.mchId')"
                        allow-clear />
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :md="12">
                    <a-form-item name="privateKeyPath" :label="t('settings.payment.form.privateKeyPath')">
                      <a-input v-model:value="paymentForm.privateKeyPath"
                        :placeholder="t('settings.payment.placeholders.privateKeyPath')" allow-clear />
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :md="12">
                    <a-form-item name="certificateSerialNumber"
                      :label="t('settings.payment.form.certificateSerialNumber')">
                      <a-input v-model:value="paymentForm.certificateSerialNumber"
                        :placeholder="t('settings.payment.placeholders.certificateSerialNumber')" allow-clear />
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :md="12">
                    <a-form-item name="apiV3Key" :label="t('settings.payment.form.apiV3Key')">
                      <a-input-password v-model:value="paymentForm.apiV3Key"
                        :placeholder="t('settings.payment.placeholders.apiV3Key')" allow-clear />
                    </a-form-item>
                  </a-col>
                  <a-col :span="24">
                    <a-form-item name="callbackUrl" :label="t('settings.payment.form.callbackUrl')">
                      <a-input v-model:value="paymentForm.callbackUrl"
                        :placeholder="t('settings.payment.placeholders.callbackUrl')" allow-clear />
                    </a-form-item>
                  </a-col>
                </a-row>
                <div class="actions">
                  <a-button type="primary" html-type="submit" :loading="paymentSaving">
                    {{ t('common.actions.save') }}
                  </a-button>
                  <a-button type="default" @click="loadPaymentConfig" :disabled="paymentLoading || paymentSaving">
                    {{ t('common.actions.reset') }}
                  </a-button>
                </div>
              </a-form>
            </a-spin>
          </div>
        </a-tab-pane>

        <a-tab-pane key="weapp" :tab="t('settings.tabs.weapp')">
          <div class="tab-section">
            <a-spin :spinning="weappLoading">
              <a-form :model="weappForm" :rules="weappRules" layout="vertical" @finish="submitWeappForm">
                <a-row :gutter="[24, 12]">
                  <a-col :xs="24" :md="12">
                    <a-form-item name="appId" :label="t('settings.weapp.appId')">
                      <a-input v-model:value="weappForm.appId" :placeholder="t('settings.weapp.placeholders.appId')"
                        allow-clear />
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :md="12">
                    <a-form-item name="secret" :label="t('settings.weapp.secret')">
                      <a-input-password v-model:value="weappForm.secret"
                        :placeholder="t('settings.weapp.placeholders.secret')" allow-clear />
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :md="12">
                    <a-form-item name="jwtSecret" :label="t('settings.weapp.jwtSecret')">
                      <a-input-password v-model:value="weappForm.jwtSecret"
                        :placeholder="t('settings.weapp.placeholders.jwtSecret')" allow-clear />
                    </a-form-item>
                  </a-col>
                </a-row>
                <div class="actions">
                  <a-button type="primary" html-type="submit" :loading="weappSaving">
                    {{ t('common.actions.save') }}
                  </a-button>
                  <a-button type="default" @click="loadWeappConfig" :disabled="weappLoading || weappSaving">
                    {{ t('common.actions.reset') }}
                  </a-button>
                </div>
              </a-form>
            </a-spin>

            <section class="template-settings">
              <header class="section-header">
                <div>
                  <h3>{{ t('settings.templateSettings.title') }}</h3>
                  <p>{{ t('settings.templateSettings.subtitle') }}</p>
                </div>
                <div class="template-settings__meta">
                  <span class="template-settings__updated">
                    {{ t('settings.templateSettings.updatedAt', { time: templateSettingsUpdatedAt }) }}
                  </span>
                  <a-button size="small" @click="loadTemplateSettings" :loading="templateSettingsLoading"
                    :disabled="templateSettingsSaving">
                    {{ t('settings.templateSettings.actions.reload') }}
                  </a-button>
                </div>
              </header>
              <a-spin :spinning="templateSettingsLoading">
                <a-table :columns="templateSettingsColumns" :data-source="templateSettingsDataSource"
                  :pagination="false" size="small" row-key="templateName" bordered>
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'page'">
                      <a-tag v-if="record.page" color="default">{{ record.page }}</a-tag>
                      <span v-else class="empty-hint">{{ t('settings.templateSettings.emptyPage') }}</span>
                    </template>
                    <template v-else-if="column.key === 'details'">
                      <div class="kv-tags">
                        <a-tag v-for="item in record.details" :key="item.field + item.value" color="blue">
                          {{ item.field }} -> {{ item.value }}
                        </a-tag>
                        <span v-if="!record.details?.length" class="empty-hint">
                          {{ t('settings.templateSettings.emptyDetails') }}
                        </span>
                      </div>
                    </template>
                    <template v-else-if="column.key === 'autoTask'">
                      <a-button type="link" size="small" :loading="record.autoTaskLoading"
                        @click="openAutoTaskEdit(record)">
                        {{
                          record.autoTaskEnabled
                            ? t('settings.templateSettings.autoTask.status.on')
                            : t('settings.templateSettings.autoTask.status.off')
                        }}
                      </a-button>
                    </template>
                    <template v-else-if="column.key === 'actions'">
                      <a-space>
                        <a-button type="link" size="small" @click="openTemplateEdit(record)">
                          {{ t('settings.templateSettings.actions.edit') }}
                        </a-button>
                        <a-popconfirm :title="t('settings.templateSettings.actions.deleteConfirm')"
                          :ok-text="t('common.actions.save')" :cancel-text="t('common.actions.reset')"
                          @confirm="handleDeleteTemplateSetting(record.templateName)">
                          <a-button type="link" size="small" danger>
                            {{ t('settings.templateSettings.actions.delete') }}
                          </a-button>
                        </a-popconfirm>
                      </a-space>
                    </template>
                  </template>
                </a-table>
              </a-spin>
            </section>

            <section class="template-bulk">
              <h3>{{ t('settings.templateSettings.bulk.title') }}</h3>
              <p class="tab-description">{{ t('settings.templateSettings.bulk.subtitle') }}</p>
              <div class="template-bulk__layout">
                <div class="template-bulk__form">
                  <a-form layout="vertical" :model="{ bulkTemplateInput: bulkTemplateInput }"
                    @finish="submitTemplateSettingsBatch">
                    <a-form-item :label="t('settings.templateSettings.bulk.inputLabel')">
                      <a-textarea v-model:value="bulkTemplateInput"
                        :placeholder="t('settings.templateSettings.bulk.placeholder')"
                        :auto-size="{ minRows: 6, maxRows: 12 }" />
                      <div class="template-bulk__helper">
                        {{ t('settings.templateSettings.bulk.helper') }}
                      </div>
                      <div class="template-bulk__helper template-bulk__helper--count">
                        {{ t('settings.templateSettings.bulk.preview', { count: parsedBulkTemplates.length }) }}
                      </div>
                    </a-form-item>
                    <div class="actions">
                      <a-button type="primary" html-type="submit" :loading="templateSettingsSaving">
                        {{ t('settings.templateSettings.bulk.actions.save') }}
                      </a-button>
                      <a-button type="default" @click="loadTemplateSettings"
                        :disabled="templateSettingsLoading || templateSettingsSaving">
                        {{ t('settings.templateSettings.bulk.actions.reload') }}
                      </a-button>
                      <a-button type="default" @click="bulkTemplateInput = ''" :disabled="templateSettingsSaving">
                        {{ t('settings.templateSettings.bulk.actions.clear') }}
                      </a-button>
                    </div>
                  </a-form>
                </div>
                <div class="template-bulk__preview">
                  <h4>{{ t('settings.templateSettings.bulk.previewTitle') }}</h4>
                  <ul>
                    <li v-for="item in parsedBulkTemplates" :key="item.templateName">
                      <div class="preview-row">
                        <span class="preview-name">{{ item.templateName }}</span>
                        <span class="preview-id">{{ item.templateId }}</span>
                      </div>
                      <div class="preview-details" v-if="item.page">
                        <a-tag color="default">{{ item.page }}</a-tag>
                      </div>
                      <div class="preview-details" v-if="item.details?.length">
                        <a-tag v-for="detail in item.details" :key="detail.field + detail.value" color="blue">
                          {{ detail.field }} -> {{ detail.value }}
                        </a-tag>
                      </div>
                      <div class="preview-details" v-else>
                        <span class="empty-hint">{{ t('settings.templateSettings.emptyDetails') }}</span>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            <a-modal :open="templateEditVisible" :title="t('settings.templateSettings.modal.title')"
              :confirm-loading="templateEditSaving" :ok-text="t('settings.templateSettings.modal.ok')"
              :cancel-text="t('settings.templateSettings.modal.cancel')" @ok="submitTemplateEdit"
              @cancel="templateEditVisible = false">
              <a-form layout="vertical">
                <a-form-item :label="t('settings.templateSettings.columns.templateName')">
                  <a-input v-model:value="templateEditForm.templateName" disabled />
                </a-form-item>
                <a-form-item :label="t('settings.templateSettings.columns.templateId')">
                  <a-input v-model:value="templateEditForm.templateId"
                    :placeholder="t('settings.templateSettings.modal.placeholder')" />
                </a-form-item>
                <a-form-item :label="t('settings.templateSettings.columns.page')">
                  <a-input v-model:value="templateEditForm.page"
                    :placeholder="t('settings.templateSettings.modal.pagePlaceholder')" allow-clear />
                </a-form-item>
                <div class="detail-editor">
                  <div class="detail-editor__header">
                    <span>{{ t('settings.templateSettings.modal.detailsLabel') }}</span>
                    <a-button size="small" type="dashed" @click="templateEditForm.details.push({ field: '', value: '' })">
                      {{ t('settings.templateSettings.actions.addDetail') }}
                    </a-button>
                  </div>
                  <div class="detail-editor__rows">
                    <div v-for="(item, index) in templateEditForm.details" :key="index" class="detail-row">
                      <a-input v-model:value="item.field" :placeholder="t('settings.templateSettings.modal.detailsFieldPlaceholder')" />
                      <a-input v-model:value="item.value" :placeholder="t('settings.templateSettings.modal.detailsValuePlaceholder')" />
                      <a-button type="link" danger size="small" @click="templateEditForm.details.splice(index, 1)">
                        {{ t('settings.templateSettings.actions.removeDetail') }}
                      </a-button>
                    </div>
                  </div>
                  <div class="template-bulk__helper">
                    {{ t('settings.templateSettings.modal.detailsHelper') }}
                  </div>
                </div>
              </a-form>
            </a-modal>

            <a-modal :open="autoTaskEditVisible" :title="t('settings.templateSettings.autoTask.modal.title')"
              :confirm-loading="autoTaskEditSaving" :ok-text="t('settings.templateSettings.autoTask.modal.ok')"
              :cancel-text="t('settings.templateSettings.autoTask.modal.cancel')" @ok="submitAutoTaskEdit"
              @cancel="autoTaskEditVisible = false">
              <a-spin :spinning="autoTaskEditLoading">
                <a-form layout="vertical">
                  <a-form-item :label="t('settings.templateSettings.autoTask.modal.status')">
                    <a-radio-group v-model:value="autoTaskForm.enabled">
                      <a-radio :value="true">{{ t('settings.templateSettings.autoTask.status.on') }}</a-radio>
                      <a-radio :value="false">{{ t('settings.templateSettings.autoTask.status.off') }}</a-radio>
                    </a-radio-group>
                    <div v-if="!autoTaskForm.enabled" class="auto-task-hint">
                      {{ t('settings.templateSettings.autoTask.modal.disabledHint') }}
                    </div>
                  </a-form-item>
                  <a-form-item :label="t('settings.templateSettings.autoTask.modal.template')">
                    <a-input :value="autoTaskTemplateDisplay" disabled />
                  </a-form-item>
                  <a-form-item :label="t('settings.templateSettings.autoTask.modal.startTime')">
                    <a-time-picker v-model:value="autoTaskForm.startTime" value-format="HH:mm" format="HH:mm"
                      :disabled="!autoTaskForm.enabled" style="width: 100%" />
                  </a-form-item>
                  <a-form-item :label="t('settings.templateSettings.autoTask.modal.frequency')">
                    <a-select v-model:value="autoTaskForm.frequency" :options="autoTaskFrequencyOptions"
                      :disabled="!autoTaskForm.enabled"
                      :placeholder="t('settings.templateSettings.autoTask.modal.frequencyPlaceholder')" allow-clear />
                  </a-form-item>
                  <a-form-item :label="t('settings.templateSettings.autoTask.modal.conditions')">
                    <a-select v-model:value="autoTaskForm.conditionKeys" :options="autoTaskConditionOptions"
                      :disabled="!autoTaskForm.enabled" mode="multiple" allow-clear
                      :placeholder="t('settings.templateSettings.autoTask.modal.conditionsPlaceholder')" />
                  </a-form-item>
                  <div class="detail-editor">
                    <div class="detail-editor__header">
                      <span>{{ t('settings.templateSettings.autoTask.modal.templateFields') }}</span>
                      <a-button size="small" type="dashed" :disabled="!autoTaskForm.enabled"
                        @click="autoTaskForm.templateFields.push({ field: '', value: '' })">
                        {{ t('settings.templateSettings.autoTask.actions.addField') }}
                      </a-button>
                    </div>
                    <div class="detail-editor__rows">
                      <div v-for="(item, index) in autoTaskForm.templateFields" :key="index"
                        class="detail-row detail-row--auto-task">
                        <a-select v-model:value="item.field" :options="autoTaskTemplateFieldOptions"
                          :disabled="!autoTaskForm.enabled" allow-clear
                          :placeholder="t('settings.templateSettings.autoTask.modal.templateFieldPlaceholder')" />
                        <a-input v-model:value="item.value" :disabled="!autoTaskForm.enabled"
                          :placeholder="t('settings.templateSettings.autoTask.modal.templateValuePlaceholder')" />
                        <a-button type="link" danger size="small" :disabled="!autoTaskForm.enabled"
                          @click="autoTaskForm.templateFields.splice(index, 1)">
                          {{ t('settings.templateSettings.autoTask.actions.removeField') }}
                        </a-button>
                      </div>
                    </div>
                    <div class="template-bulk__helper">
                      {{ t('settings.templateSettings.autoTask.modal.templateFieldsHelper') }}
                    </div>
                  </div>
                </a-form>
              </a-spin>
            </a-modal>
          </div>
        </a-tab-pane>

        <a-tab-pane key="newbie-tasks" :tab="t('settings.tabs.newbieTasks')">
          <div class="tab-section">
            <a-tabs v-model:activeKey="newbieTaskActiveTab" class="newbie-task-tabs">
              <a-tab-pane key="template" :tab="t('settings.newbieTasks.tabs.template')">
                <div class="tab-section">
                  <section class="newbie-task-config">
                    <header class="section-header">
                      <div>
                        <h3>{{ t('settings.newbieTasks.template.title') }}</h3>
                        <p>{{ t('settings.newbieTasks.template.subtitle') }}</p>
                      </div>
                      <div class="actions">
                        <a-button type="default" @click="loadNewbieTaskTemplate" :loading="newbieTaskTemplateLoading"
                          :disabled="newbieTaskTemplateSaving">
                          {{ t('settings.newbieTasks.actions.reload') }}
                        </a-button>
                        <a-button type="primary" @click="submitNewbieTaskTemplate" :loading="newbieTaskTemplateSaving">
                          {{ t('settings.newbieTasks.actions.save') }}
                        </a-button>
                        <a-popconfirm :title="t('settings.newbieTasks.template.confirmDelete')"
                          @confirm="handleDeleteNewbieTaskTemplate">
                          <a-button danger :disabled="newbieTaskTemplateSaving">
                            {{ t('settings.newbieTasks.actions.delete') }}
                          </a-button>
                        </a-popconfirm>
                      </div>
                    </header>
                    <div class="newbie-task-meta">
                      <span>{{ t('settings.newbieTasks.meta.updatedAt', { time: newbieTaskTemplateUpdatedAtDisplay }) }}</span>
                    </div>
                    <a-spin :spinning="newbieTaskTemplateLoading">
                      <div class="detail-editor">
                        <div class="newbie-task-qrcode">
                          <span class="newbie-task-qrcode__label">
                            {{ t('settings.newbieTasks.template.fields.qrCode') }}
                          </span>
                          <div class="newbie-task-upload">
                            <label class="newbie-task-upload__trigger">
                              <input class="newbie-task-upload__input" type="file" accept="image/*"
                                :disabled="newbieTaskQrUploadLoading" @change="handleNewbieTaskQrUpload" />
                              <a-button type="dashed" size="small" :loading="newbieTaskQrUploadLoading">
                                {{
                                  newbieTaskQrCodeUrl
                                    ? t('settings.newbieTasks.template.qrCode.uploadReplace')
                                    : t('settings.newbieTasks.template.qrCode.upload')
                                }}
                              </a-button>
                            </label>
                            <span v-if="newbieTaskQrCodeUrl" class="newbie-task-upload__name">
                              {{ newbieTaskQrCodeUrl }}
                            </span>
                            <a-button v-if="newbieTaskQrCodeUrl" type="link" danger size="small"
                              @click="removeNewbieTaskQrCode">
                              {{ t('settings.newbieTasks.template.qrCode.remove') }}
                            </a-button>
                            <span class="newbie-task-upload__time">
                              {{
                                t('settings.newbieTasks.template.qrCode.uploadedAt', {
                                  time: formatNewbieTaskQrUploadedAt(newbieTaskQrCodeUploadedAt),
                                })
                              }}
                            </span>
                            <div v-if="newbieTaskQrCodeUrl" class="newbie-task-qr-preview">
                              <img :src="getNewbieTaskQrCodeUrl(newbieTaskQrCodeUrl)"
                                :alt="t('settings.newbieTasks.template.fields.qrCode')" />
                            </div>
                          </div>
                        </div>
                        <div class="detail-editor__header">
                          <span>{{ t('settings.newbieTasks.template.listTitle') }}</span>
                          <a-button size="small" type="dashed" @click="newbieTaskTemplateForm.push(createNewbieTaskRow())">
                            {{ t('settings.newbieTasks.template.actions.add') }}
                          </a-button>
                        </div>
                        <div class="detail-editor__rows">
                          <div v-for="(item, index) in newbieTaskTemplateForm" :key="index"
                            class="newbie-task-row newbie-task-row--task">
                            <a-input-number v-model:value="item.index" :min="1" style="width: 120px"
                              :placeholder="t('settings.newbieTasks.template.fields.index')" />
                            <a-input v-model:value="item.name" :placeholder="t('settings.newbieTasks.template.fields.name')"
                              allow-clear />
                            <a-input v-model:value="item.description"
                              :placeholder="t('settings.newbieTasks.template.fields.description')" allow-clear />
                            <a-input v-model:value="item.buttonText"
                              :placeholder="t('settings.newbieTasks.template.fields.buttonText')" allow-clear />
                            <a-button type="link" danger size="small"
                              @click="newbieTaskTemplateForm.splice(index, 1)">
                              {{ t('settings.newbieTasks.template.actions.remove') }}
                            </a-button>
                          </div>
                        </div>
                      </div>
                    </a-spin>
                  </section>

                  <section class="newbie-task-config">
                    <header class="section-header">
                      <div>
                        <h3>{{ t('settings.newbieTasks.netdisk.title') }}</h3>
                        <p>{{ t('settings.newbieTasks.netdisk.subtitle') }}</p>
                      </div>
                      <div class="actions">
                        <a-button type="default" @click="loadNetdiskGiftConfig" :loading="netdiskGiftLoading"
                          :disabled="netdiskGiftSaving">
                          {{ t('settings.newbieTasks.actions.reload') }}
                        </a-button>
                        <a-button type="primary" @click="submitNetdiskGiftConfig" :loading="netdiskGiftSaving">
                          {{ t('settings.newbieTasks.actions.save') }}
                        </a-button>
                        <a-popconfirm :title="t('settings.newbieTasks.netdisk.confirmDelete')"
                          @confirm="handleDeleteNetdiskGiftConfig">
                          <a-button danger :disabled="netdiskGiftSaving">
                            {{ t('settings.newbieTasks.actions.delete') }}
                          </a-button>
                        </a-popconfirm>
                      </div>
                    </header>
                    <div class="newbie-task-meta">
                      <span>{{ t('settings.newbieTasks.meta.updatedAt', { time: netdiskGiftUpdatedAtDisplay }) }}</span>
                    </div>
                    <a-spin :spinning="netdiskGiftLoading">
                      <div class="detail-editor">
                        <div class="detail-editor__header">
                          <span>{{ t('settings.newbieTasks.netdisk.listTitle') }}</span>
                          <a-button size="small" type="dashed" @click="netdiskGiftForm.push(createNetdiskLinkRow())">
                            {{ t('settings.newbieTasks.netdisk.actions.add') }}
                          </a-button>
                        </div>
                        <div class="detail-editor__rows">
                          <div v-for="(item, index) in netdiskGiftForm" :key="index"
                            class="newbie-task-row newbie-task-row--link">
                            <a-input v-model:value="item.name" :placeholder="t('settings.newbieTasks.netdisk.fields.name')"
                              allow-clear />
                            <a-input v-model:value="item.url" :placeholder="t('settings.newbieTasks.netdisk.fields.url')"
                              allow-clear />
                            <a-button type="link" danger size="small" @click="netdiskGiftForm.splice(index, 1)">
                              {{ t('settings.newbieTasks.netdisk.actions.remove') }}
                            </a-button>
                          </div>
                        </div>
                      </div>
                    </a-spin>
                  </section>
                </div>
              </a-tab-pane>

              <a-tab-pane key="stats" :tab="t('settings.newbieTasks.tabs.stats')">
                <div class="tab-section">
                  <section class="newbie-task-config">
                    <header class="section-header">
                      <div>
                        <h3>{{ t('settings.newbieTasks.stats.title') }}</h3>
                        <p>{{ t('settings.newbieTasks.stats.subtitle') }}</p>
                      </div>
                    </header>
                    <a-table :columns="newbieTaskStatsColumns" :data-source="newbieTaskStats"
                      :loading="newbieTaskStatsLoading" :pagination="newbieTaskStatsPaginationConfig"
                      :row-key="(record) => `${record.featureCode || 'unknown'}-${record.registeredAt || ''}`"
                      @change="handleNewbieTaskStatsTableChange">
                      <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'avatar'">
                          <a-avatar :src="record.avatarUrl" :alt="record.username" />
                        </template>
                        <template v-else-if="column.key === 'registeredAt'">
                          {{ formatDateTime(record.registeredAt) }}
                        </template>
                        <template v-else-if="column.key === 'tasks'">
                          <a-space wrap size="4">
                            <a-tag v-for="task in record.tasks || []" :key="`${task.index}-${task.name}`"
                              :color="task.completed ? 'green' : 'default'">
                              {{
                                t('settings.newbieTasks.stats.taskLabel', {
                                  index: task.index ?? '-',
                                  name: task.name || t('settings.newbieTasks.stats.unnamed'),
                                })
                              }}
                              {{
                                task.completed
                                  ? t('settings.newbieTasks.stats.status.completed')
                                  : t('settings.newbieTasks.stats.status.pending')
                              }}
                            </a-tag>
                            <span v-if="!record.tasks?.length" class="empty-hint">
                              {{ t('settings.newbieTasks.stats.empty') }}
                            </span>
                          </a-space>
                        </template>
                      </template>
                    </a-table>
                  </section>
                </div>
              </a-tab-pane>
            </a-tabs>
          </div>
        </a-tab-pane>

        <a-tab-pane key="lottery" :tab="t('settings.tabs.lottery')">
          <div class="tab-section">
            <header class="lottery-hero">
              <div>
                <h3>{{ t('settings.lottery.title') }}</h3>
                <p>{{ t('settings.lottery.subtitle') }}</p>
              </div>
            </header>

            <a-tabs v-model:activeKey="lotteryActiveTab" class="lottery-tabs">
              <a-tab-pane key="prizes" :tab="t('settings.lottery.tabs.prizes')">
                <section class="lottery-prize-config">
                  <header class="section-header">
                    <div>
                      <h3>{{ t('settings.lottery.prizes.title') }}</h3>
                      <p>{{ t('settings.lottery.prizes.subtitle') }}</p>
                    </div>
                    <div class="lottery-prize-actions">
                      <a-button type="default" @click="loadLotteryConfig" :loading="lotteryConfigLoading"
                        :disabled="lotteryConfigSaving">
                        {{ t('settings.lottery.actions.reload') }}
                      </a-button>
                      <a-button type="primary" @click="submitLotteryConfig" :loading="lotteryConfigSaving"
                        :disabled="!lotteryProbabilityValid">
                        {{ t('settings.lottery.actions.save') }}
                      </a-button>
                    </div>
                  </header>

                  <div class="lottery-probability">
                    <div class="lottery-probability__summary">
                      <span>{{ t('settings.lottery.prizes.totalProbability') }}</span>
                      <strong
                        :class="['lottery-probability__value', lotteryProbabilityValid ? 'is-valid' : 'is-invalid']">
                        {{ formatProbabilityValue(lotteryProbabilityTotal) }}%
                      </strong>
                    </div>
                    <a-progress :percent="lotteryProbabilityDisplay" :status="lotteryProbabilityStatus" />
                    <p class="lottery-probability__hint">
                      {{
                        lotteryProbabilityValid
                          ? t('settings.lottery.prizes.totalHintReady')
                          : t('settings.lottery.prizes.totalHint')
                      }}
                    </p>
                  </div>

                  <a-spin :spinning="lotteryConfigLoading">
                    <div class="lottery-prize-grid">
                      <div v-for="prize in lotteryPrizeForm" :key="prize.level" class="lottery-prize-card">
                        <div class="lottery-prize-card__header">
                          <span class="lottery-prize-level">
                            {{ t('settings.lottery.prizes.level', { level: prize.level }) }}
                          </span>
                          <a-tag color="geekblue">{{ t('settings.lottery.prizes.levelTag', { level: prize.level }) }}</a-tag>
                        </div>
                        <a-form layout="vertical" :model="prize">
                          <a-form-item :label="t('settings.lottery.prizes.fields.type')">
                            <a-radio-group v-model:value="prize.flp">
                              <a-radio :value="true">{{ t('settings.lottery.prizes.type.flp') }}</a-radio>
                              <a-radio :value="false">{{ t('settings.lottery.prizes.type.other') }}</a-radio>
                            </a-radio-group>
                          </a-form-item>
                          <a-form-item v-if="prize.flp" :label="t('settings.lottery.prizes.fields.flpCount')">
                            <a-input v-model:value="prize.flpCount" inputmode="decimal"
                              :placeholder="t('settings.lottery.prizes.placeholders.flpCount')" />
                          </a-form-item>
                          <template v-else>
                            <a-form-item :label="t('settings.lottery.prizes.fields.description')">
                              <a-input v-model:value="prize.description"
                                :placeholder="t('settings.lottery.prizes.placeholders.description')" allow-clear />
                            </a-form-item>
                            <a-form-item :label="t('settings.lottery.prizes.fields.imageUrl')">
                              <div class="lottery-upload">
                                <label class="lottery-upload__trigger">
                                  <input class="lottery-upload__input" type="file" accept="image/*"
                                    :disabled="lotteryUploadLoadingMap[prize.level]"
                                    @change="(event) => handleLotteryImageUpload(prize, event)" />
                                  <a-button type="dashed" :loading="lotteryUploadLoadingMap[prize.level]">
                                    {{ prize.imageUrl ? t('settings.lottery.prizes.uploadReplace') : t('settings.lottery.prizes.upload') }}
                                  </a-button>
                                </label>
                                <span v-if="prize.imageUrl" class="lottery-upload__name">
                                  {{ prize.imageUrl }}
                                </span>
                                <a-button v-if="prize.imageUrl" type="link" danger size="small"
                                  @click="removeLotteryImage(prize)">
                                  {{ t('settings.lottery.prizes.uploadRemove') }}
                                </a-button>
                              </div>
                            </a-form-item>
                          </template>
                          <a-form-item :label="t('settings.lottery.prizes.fields.probability')">
                            <a-input-number v-model:value="prize.probability" :min="0" :max="100"
                              :step="0.0000000001" :precision="10" style="width: 100%"
                              :formatter="formatProbabilityValue" :parser="parseProbabilityValue"
                              :placeholder="t('settings.lottery.prizes.placeholders.probability')" />
                          </a-form-item>
                        </a-form>
                        <div v-if="!prize.flp && prize.imageUrl" class="lottery-prize-preview">
                          <img :src="getLotteryImageUrl(prize.imageUrl)"
                            :alt="prize.description || `Prize ${prize.level}`" />
                        </div>
                      </div>
                    </div>
                  </a-spin>
                  <div class="actions">
                    <a-button type="primary" @click="submitLotteryConfig" :loading="lotteryConfigSaving"
                      :disabled="!lotteryProbabilityValid">
                      {{ t('settings.lottery.actions.save') }}
                    </a-button>
                    <a-button type="default" @click="loadLotteryConfig" :disabled="lotteryConfigSaving">
                      {{ t('settings.lottery.actions.reload') }}
                    </a-button>
                  </div>
                </section>
              </a-tab-pane>

              <a-tab-pane key="logs" :tab="t('settings.lottery.tabs.logs')">
                <section class="lottery-logs">
                  <header class="section-header">
                    <div>
                      <h3>{{ t('settings.lottery.logs.title') }}</h3>
                      <p>{{ t('settings.lottery.logs.subtitle') }}</p>
                    </div>
                    <div class="filters">
                      <a-input v-model:value="lotteryLogFilters.featureCode"
                        :placeholder="t('settings.lottery.logs.searchPlaceholder')" allow-clear class="filter-input" />
                      <a-button type="primary" @click="handleLotteryLogSearch">
                        {{ t('settings.lottery.logs.search') }}
                      </a-button>
                    </div>
                  </header>
                  <a-table :columns="lotteryLogColumns" :data-source="lotteryLogs" :loading="lotteryLogsLoading"
                    :pagination="lotteryPaginationConfig" row-key="id" @change="handleLotteryLogTableChange">
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.key === 'prize'">
                        <a-tag color="gold">
                          {{ record.prizeDescription || t('settings.lottery.logs.emptyPrize') }}
                        </a-tag>
                      </template>
                      <template v-else-if="column.key === 'createdAt'">
                        {{ new Date(record.createdAt).toLocaleString() }}
                      </template>
                    </template>
                  </a-table>
                </section>
              </a-tab-pane>

              <a-tab-pane key="checkins" :tab="t('settings.lottery.tabs.checkins')">
                <section class="lottery-logs">
                  <header class="section-header">
                    <div>
                      <h3>{{ t('settings.lottery.checkins.title') }}</h3>
                      <p>{{ t('settings.lottery.checkins.subtitle') }}</p>
                    </div>
                  </header>
                  <a-table :columns="checkinLogColumns" :data-source="checkinLogs" :loading="checkinLogsLoading"
                    :pagination="checkinPaginationConfig"
                    :row-key="(record) => `${record.featureCode || 'unknown'}-${record.registeredAt || ''}`"
                    @change="handleCheckinLogTableChange">
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.key === 'avatar'">
                        <a-avatar :src="record.avatarUrl" :alt="record.username" />
                      </template>
                      <template v-else-if="column.key === 'registeredAt'">
                        {{ formatDateTime(record.registeredAt) }}
                      </template>
                      <template v-else-if="column.key === 'checkinTimes'">
                        <a-space wrap size="4">
                          <a-tag v-for="time in record.checkinTimes || []" :key="time" color="blue">
                            {{ formatDateTime(time) }}
                          </a-tag>
                          <span v-if="!record.checkinTimes?.length" class="empty-hint">
                            {{ t('settings.lottery.checkins.emptyTimes') }}
                          </span>
                        </a-space>
                      </template>
                    </template>
                  </a-table>
                </section>
              </a-tab-pane>
            </a-tabs>
          </div>
        </a-tab-pane>

        <a-tab-pane key="report-entry" :tab="t('settings.tabs.reportEntry')">
          <div class="tab-section">
            <section class="report-entry-settings">
              <header class="section-header">
                <div>
                  <h3>{{ t('settings.reportEntry.title') }}</h3>
                  <p>{{ t('settings.reportEntry.subtitle') }}</p>
                </div>
                <a-button type="primary" @click="openReportEntryDrawer()">
                  {{ t('settings.reportEntry.actions.create') }}
                </a-button>
              </header>
              <div class="report-entry-table">
                <a-table :columns="reportEntryColumns" :data-source="reportEntryList" :loading="reportEntryLoading"
                  :pagination="reportEntryPaginationConfig" row-key="id" :custom-row="reportEntryRowProps"
                  :row-class-name="reportEntryRowClassName" @change="handleReportEntryTableChange">
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'area'">
                      {{ formatReportEntryArea(record) }}
                    </template>
                    <template v-else-if="column.key === 'actions'">
                      <a-dropdown trigger="click">
                        <a-button type="text" class="report-entry-action-button">
                          <img :src="detailIcon" alt="detail" class="report-entry-action-icon" />
                        </a-button>
                        <template #overlay>
                          <a-menu @click="({ key }) => handleReportEntryAction(key, record)">
                            <a-menu-item key="edit">
                              {{ t('settings.reportEntry.actions.edit') }}
                            </a-menu-item>
                            <a-menu-item key="delete" danger>
                              {{ t('settings.reportEntry.actions.delete') }}
                            </a-menu-item>
                          </a-menu>
                        </template>
                      </a-dropdown>
                    </template>
                  </template>
                </a-table>
              </div>
              <div class="report-entry-dialog">
                <a-textarea v-model:value="reportEntryDialogText" :rows="2"
                  :placeholder="t('settings.reportEntry.dialog.placeholder')" />
                <a-button type="primary" :loading="reportEntryConfigSaving" :disabled="reportEntryConfigSaving"
                  @click="submitReportEntryConfig">
                  {{ t('settings.reportEntry.actions.saveDialog') }}
                </a-button>
              </div>
            </section>
          </div>

          <a-drawer :open="reportEntryDrawerVisible" placement="right" :width="520"
            :title="reportEntryEditingId ? t('settings.reportEntry.drawer.editTitle') : t('settings.reportEntry.drawer.createTitle')"
            :mask-closable="false" @close="reportEntryDrawerVisible = false">
            <a-form ref="reportEntryFormRef" :model="reportEntryForm" :rules="reportEntryRules" layout="vertical">
              <div class="report-entry-form-section">
                <div class="report-entry-form-title">{{ t('settings.reportEntry.form.area') }}</div>
                <a-form-item name="areaPath">
                  <div class="report-entry-tree">
                    <div class="report-entry-search">
                      <a-input v-model:value="reportEntrySearch" allow-clear
                        :placeholder="t('settings.reportEntry.search.placeholder')" />
                    </div>
                    <a-tree :tree-data="reportEntryTreeFilterResult.tree" :checked-keys="reportEntrySelectedKeys"
                      :expanded-keys="reportEntryTreeExpandedKeys" :auto-expand-parent="reportEntryAutoExpandParent"
                      checkable check-strictly block-node @check="handleReportEntryAreaCheck"
                      @expand="handleReportEntryTreeExpand" />
                  </div>
                </a-form-item>
              </div>

              <div class="report-entry-form-section">
                <div class="report-entry-form-title">{{ t('settings.reportEntry.form.miniProgram') }}</div>
                <div class="report-entry-mini-program">
                  <a-form-item name="miniProgramAppId" :label="t('settings.reportEntry.form.appId')">
                    <a-input v-model:value="reportEntryForm.miniProgramAppId"
                      :placeholder="t('settings.reportEntry.placeholders.appId')" />
                  </a-form-item>
                  <a-form-item name="miniProgramPath" :label="t('settings.reportEntry.form.path')">
                    <a-input v-model:value="reportEntryForm.miniProgramPath"
                      :placeholder="t('settings.reportEntry.placeholders.path')" />
                  </a-form-item>
                </div>
              </div>

              <div class="report-entry-form-section">
                <div class="report-entry-form-title">{{ t('settings.reportEntry.form.guide') }}</div>
                <a-form-item name="guideType">
                  <a-radio-group v-model:value="reportEntryForm.guideType">
                    <a-radio value="publicAccount">{{ t('settings.reportEntry.guide.publicAccount') }}</a-radio>
                    <a-radio value="video">{{ t('settings.reportEntry.guide.video') }}</a-radio>
                  </a-radio-group>
                </a-form-item>
                <a-form-item v-if="reportEntryForm.guideType === 'publicAccount'" name="publicAccountLink"
                  :label="t('settings.reportEntry.form.publicAccountLink')">
                  <a-input v-model:value="reportEntryForm.publicAccountLink"
                    :placeholder="t('settings.reportEntry.placeholders.publicAccountLink')" />
                </a-form-item>
                <div v-else class="report-entry-guide-video">
                  <a-form-item name="videoAccountId" :label="t('settings.reportEntry.form.videoAccountId')">
                    <a-input v-model:value="reportEntryForm.videoAccountId"
                      :placeholder="t('settings.reportEntry.placeholders.videoAccountId')" />
                  </a-form-item>
                  <a-form-item name="videoId" :label="t('settings.reportEntry.form.videoId')">
                    <a-input v-model:value="reportEntryForm.videoId"
                      :placeholder="t('settings.reportEntry.placeholders.videoId')" />
                  </a-form-item>
                </div>
              </div>
            </a-form>
            <template #footer>
              <div class="report-entry-drawer-footer">
                <a-button @click="reportEntryDrawerVisible = false">
                  {{ t('settings.reportEntry.actions.cancel') }}
                </a-button>
                <a-button type="primary" :loading="reportEntrySaving" @click="submitReportEntryForm">
                  {{ t('settings.reportEntry.actions.confirm') }}
                </a-button>
              </div>
            </template>
          </a-drawer>
        </a-tab-pane>

        <a-tab-pane key="system" :tab="t('settings.tabs.system')">
          <div class="tab-section">
            <section class="system-settings">
              <header class="section-header">
                <div>
                  <h3>{{ t('settings.system.font.title') }}</h3>
                  <p>{{ t('settings.system.font.subtitle') }}</p>
                </div>
                <div class="system-settings__meta">
                  <span class="system-settings__meta-label">
                    {{ t('settings.system.font.currentVersionLabel') }}
                  </span>
                  <span class="system-settings__meta-value">
                    {{ fontFileConfig.version || t('settings.system.font.emptyVersion') }}
                  </span>
                </div>
              </header>
              <a-spin :spinning="fontFileLoading">
                <div class="system-font-current">
                  <span class="system-font-current__label">
                    {{ t('settings.system.font.currentFileLabel') }}
                  </span>
                  <a v-if="fontFileConfig.fileName" :href="fontFileDownloadUrl" target="_blank" rel="noreferrer">
                    {{ fontFileConfig.fileName }}
                  </a>
                  <span v-else class="empty-hint">{{ t('settings.system.font.emptyFile') }}</span>
                </div>
                <a-form layout="vertical" :model="fontFileForm" @finish="submitFontFileForm">
                  <a-form-item :label="t('settings.system.font.fields.file')">
                    <div class="system-font-upload">
                      <label class="system-font-upload__trigger">
                        <input class="system-font-upload__input" type="file" accept=".ttf,.otf,.woff,.woff2"
                          :disabled="fontFileSaving" @change="handleFontFileSelect" />
                        <a-button type="dashed" :loading="fontFileSaving">
                          {{
                            fontFileForm.fileName
                              ? t('settings.system.font.actions.replaceFile')
                              : t('settings.system.font.actions.selectFile')
                          }}
                        </a-button>
                      </label>
                      <span v-if="fontFileForm.fileName" class="system-font-upload__name">
                        {{ fontFileForm.fileName }}
                      </span>
                      <a-button v-if="fontFileForm.fileName" type="link" danger size="small"
                        @click="clearFontFileSelection">
                        {{ t('settings.system.font.actions.removeFile') }}
                      </a-button>
                    </div>
                    <div class="system-font-helper">{{ t('settings.system.font.helper') }}</div>
                  </a-form-item>
                  <a-form-item :label="t('settings.system.font.fields.version')">
                    <a-input v-model:value="fontFileForm.version"
                      :placeholder="t('settings.system.font.placeholders.version')" />
                  </a-form-item>
                  <div class="actions">
                    <a-button type="primary" html-type="submit" :loading="fontFileSaving">
                      {{ t('settings.system.font.actions.upload') }}
                    </a-button>
                    <a-button type="default" @click="loadFontFileConfig"
                      :disabled="fontFileLoading || fontFileSaving">
                      {{ t('settings.system.font.actions.reload') }}
                    </a-button>
                  </div>
                </a-form>
              </a-spin>
            </section>
          </div>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
</template>

<style scoped>
.settings-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.settings-card {
  background: #ffffff;
  border-radius: 18px;
  box-shadow: 0 14px 36px rgba(15, 23, 42, 0.12);
  padding: 24px;
}

.tab-section {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.tab-description {
  margin: 0;
  color: #4b5563;
  font-size: 0.95rem;
  line-height: 1.6;
}

.invite-table {
  background: #f9fafb;
  padding: 24px;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.invite-form {
  background: #f9fafb;
  padding: 24px;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.05);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 1.1rem;
  color: #111827;
}

.section-header p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.filters {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.filter-tag {
  cursor: pointer;
  user-select: none;
}

.filter-input {
  width: 220px;
}

.actions {
  margin-top: 12px;
  display: flex;
  gap: 12px;
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

.open-platform-preview {
  display: flex;
  justify-content: center;
  padding: 24px 0 16px;
  background: #f3f4f6;
}

.open-platform-preview__device {
  width: 360px;
  max-width: 100%;
  background: #111827;
  border-radius: 32px;
  padding: 12px;
  box-shadow: 0 24px 48px rgba(15, 23, 42, 0.25);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.open-platform-preview__notch {
  align-self: center;
  width: 108px;
  height: 18px;
  background: #0f172a;
  border-radius: 0 0 12px 12px;
}

.open-platform-preview__screen {
  background: #f8fafc;
  border-radius: 24px;
  flex: 1;
  min-height: 600px;
  display: flex;
  overflow: hidden;
}

.open-platform-preview__scroller {
  flex: 1;
  overflow-y: auto;
  padding: 18px 18px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.open-platform-preview__content {
  width: 100%;
  padding: 18px;
  background: #ffffff;
  border-radius: 16px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.06);
  color: #1f2937;
  line-height: 1.7;
}

.open-platform-preview__content :deep(img) {
  max-width: 100%;
  height: auto;
}

.open-platform-preview__scroller :deep(.ant-empty) {
  margin: auto;
  padding: 48px 0;
}

.open-platform-preview__footer {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.template-settings,
.template-bulk {
  background: #f9fafb;
  padding: 20px;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.kv-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.empty-hint {
  color: #9ca3af;
}

.template-settings__meta {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #6b7280;
}

.template-settings__updated {
  font-size: 0.9rem;
}

.template-bulk__helper {
  margin-top: 6px;
  color: #6b7280;
  font-size: 0.9rem;
}

.template-bulk__helper--count {
  color: #111827;
  font-weight: 600;
}

.template-bulk__helper--warning {
  color: #b45309;
}

.newbie-task-config {
  background: #f9fafb;
  padding: 20px;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.report-entry-settings {
  background: #f9fafb;
  padding: 20px;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.report-entry-table {
  background: #ffffff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.05);
}

.report-entry-action-button {
  width: 32px;
  height: 32px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.report-entry-action-icon {
  width: 22px;
  height: 22px;
}

:deep(.report-entry-row--active) {
  background: #eef2ff;
}

.report-entry-dialog {
  display: flex;
  align-items: center;
  gap: 12px;
}

.report-entry-dialog :deep(.ant-input) {
  flex: 1;
}

.report-entry-form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.report-entry-form-title {
  font-weight: 600;
  color: #111827;
}

.report-entry-tree {
  max-height: 480px;
  overflow: auto;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  background: #ffffff;
}

.report-entry-search {
  position: sticky;
  top: 0;
  z-index: 1;
  padding-bottom: 8px;
  background: #ffffff;
}

.report-entry-mini-program,
.report-entry-guide-video {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.report-entry-drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.system-settings {
  background: #f9fafb;
  padding: 20px;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.system-settings__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #6b7280;
  font-size: 0.9rem;
}

.system-settings__meta-value {
  font-weight: 600;
  color: #111827;
}

.system-font-current {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  color: #374151;
}

.system-font-current__label {
  font-weight: 600;
  color: #111827;
}

.system-font-upload {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.system-font-upload__trigger {
  position: relative;
  display: inline-flex;
}

.system-font-upload__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 1;
}

.system-font-upload__name {
  color: #374151;
  font-size: 0.9rem;
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.system-font-helper {
  margin-top: 6px;
  color: #6b7280;
  font-size: 0.9rem;
}

.newbie-task-meta {
  color: #6b7280;
  font-size: 0.9rem;
}

.newbie-task-row {
  display: grid;
  gap: 8px;
  align-items: center;
}

.newbie-task-row--task {
  grid-template-columns: 120px 1fr 1.2fr 1fr auto;
}

.newbie-task-row--link {
  grid-template-columns: 1fr 1.2fr auto;
}

.newbie-task-upload {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.newbie-task-upload__trigger {
  position: relative;
  display: inline-flex;
}

.newbie-task-upload__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 1;
}

.newbie-task-upload__name {
  color: #374151;
  font-size: 0.9rem;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.newbie-task-upload__time {
  width: 100%;
  color: #6b7280;
  font-size: 0.85rem;
}

.newbie-task-qrcode {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.newbie-task-qrcode__label {
  font-weight: 600;
  color: #111827;
}

.newbie-task-qr-preview {
  width: 100%;
  display: flex;
  align-items: center;
}

.newbie-task-qr-preview img {
  max-width: 120px;
  max-height: 120px;
  object-fit: cover;
  border-radius: 8px;
  background: #f3f4f6;
  padding: 4px;
}

.lottery-hero {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  padding: 20px;
  border-radius: 16px;
  background: linear-gradient(135deg, #fef3c7 0%, #e0f2fe 100%);
  border: 1px solid #e5e7eb;
}

.lottery-hero h3 {
  margin: 0;
  color: #111827;
  font-size: 1.2rem;
}

.lottery-hero p {
  margin: 6px 0 0;
  color: #6b7280;
}

.lottery-hero__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 6px;
  color: #6b7280;
  font-size: 0.9rem;
}

.lottery-hero__updated {
  font-weight: 600;
  color: #1f2937;
}

.lottery-prize-config,
.lottery-logs {
  background: #f9fafb;
  padding: 20px;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lottery-prize-actions {
  display: flex;
  gap: 12px;
}

.lottery-probability {
  background: #ffffff;
  border-radius: 12px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.lottery-probability__summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #374151;
  font-weight: 600;
}

.lottery-probability__value {
  font-size: 1.1rem;
}

.lottery-probability__value.is-valid {
  color: #059669;
}

.lottery-probability__value.is-invalid {
  color: #dc2626;
}

.lottery-probability__hint {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.lottery-prize-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 16px;
}

.lottery-prize-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.08);
}

.lottery-prize-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.lottery-prize-level {
  font-weight: 600;
  color: #111827;
}

.lottery-prize-preview {
  background: #f3f4f6;
  border-radius: 10px;
  padding: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.lottery-prize-preview img {
  max-width: 100%;
  max-height: 120px;
  object-fit: cover;
  border-radius: 8px;
}

.lottery-upload {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.lottery-upload__trigger {
  position: relative;
  display: inline-flex;
}

.lottery-upload__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 1;
}

.lottery-upload__name {
  color: #374151;
  font-size: 0.9rem;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-bulk__layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 16px;
}

.template-bulk__preview {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 12px;
  min-height: 100%;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
  color: #111827;
}

.preview-id {
  color: #2563eb;
}

.preview-details {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0 12px;
}

.detail-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-editor__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.detail-editor__rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
}

.auto-task-hint {
  margin-top: 6px;
  color: #6b7280;
  font-size: 0.9rem;
}

@media (max-width: 768px) {
  .settings-card {
    padding: 16px;
  }

  .invite-table,
  .invite-form {
    padding: 16px;
  }

  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .filters {
    width: 100%;
  }

  .filter-input {
    flex: 1;
  }

  .actions {
    flex-direction: column;
    align-items: stretch;
  }

  .lottery-hero {
    flex-direction: column;
    align-items: flex-start;
  }

  .lottery-hero__meta {
    align-items: flex-start;
  }

  .lottery-prize-actions {
    width: 100%;
    flex-direction: column;
    align-items: stretch;
  }

  .template-bulk__layout {
    grid-template-columns: 1fr;
  }

  .newbie-task-row--task,
  .newbie-task-row--link {
    grid-template-columns: 1fr;
  }

  .report-entry-mini-program,
  .report-entry-guide-video {
    grid-template-columns: 1fr;
  }

  .report-entry-dialog {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>



