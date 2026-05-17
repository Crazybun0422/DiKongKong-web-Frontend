<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import COS from 'cos-js-sdk-v5'
import {
  fetchInviteConfig,
  saveInviteConfig,
  fetchMapSettlementConfig,
  saveMapSettlementConfig,
  fetchMerchantIntroLongImageConfig,
  saveMerchantIntroLongImageConfig,
  fetchOpenPlatformCopy,
  saveOpenPlatformCopy,
  fetchFlightQualificationAssessmentRichText,
  saveFlightQualificationAssessmentRichText,
  fetchInsuranceCoverageRichText,
  saveInsuranceCoverageRichText,
  fetchCaacLicenseRegistrationSubsidyRichText,
  saveCaacLicenseRegistrationSubsidyRichText,
  fetchTheoryCertificateRichText,
  saveTheoryCertificateRichText,
  fetchOperationCertificateRichText,
  saveOperationCertificateRichText,
  fetch120mFlightRichText,
  save120mFlightRichText,
  fetchNoSpecialFlightScenarioRichText,
  saveNoSpecialFlightScenarioRichText,
  fetchReportAndUnlockGuideRichText,
  saveReportAndUnlockGuideRichText,
  fetchAirspaceDescriptionRichText,
  saveAirspaceDescriptionRichText,
  fetchPlanetMerchantAdvancedGuideCopy,
  savePlanetMerchantAdvancedGuideCopy,
  fetchPlanetCreationAdvancedGuideCopy,
  savePlanetCreationAdvancedGuideCopy,
  fetchShareToPlatformCopy,
  saveShareToPlatformCopy,
  fetchFlpRewardHelpCopy,
  saveFlpRewardHelpCopy,
  fetchInviteGuideCopy,
  saveInviteGuideCopy,
  fetchMemberNoAdsConfig,
  saveMemberNoAdsConfig,
  syncMemberNoAdsCrowdNow,
  fetchMemberNoAdsLastCrowd,
  fetchCoordinateLongPressGuideCopy,
  saveCoordinateLongPressGuideCopy,
  fetchCoordinateSystemDescriptionCopy,
  saveCoordinateSystemDescriptionCopy,
  fetchGuideUrls,
  saveGuideUrls,
  fetchTencentCosConfig,
  saveTencentCosConfig,
  fetchTencentCosSts,
  fetchFontFileConfig,
  uploadFontFileConfig,
  fetchPosterServiceVersion,
  refreshPosterServiceVersion,
  fetchEasterEggResourceConfig,
  uploadEasterEggResourceConfig,
  fetchProvinceCityKmlZipConfig,
  uploadProvinceCityKmlZipConfig,
  fetchCountyKmlZipConfig,
  uploadCountyKmlZipConfig,
  fetchKmlDecryptAesKeyConfig,
  saveKmlDecryptAesKeyConfig,
  fetchTemplateSettings,
  saveTemplateSettingsBatch,
  updateTemplateSetting,
  deleteTemplateSetting,
} from '../../services/config'
import {
  fetchAdminSuitableFlyZoneKmzInfos,
  createSuitableFlyZoneKmzInfo,
} from '../../services/suitableFlyZoneKmz'
import { fetchWechatPayConfig, saveWechatPayConfig } from '../../services/wechatPayConfig'
import { fetchWeappConfig, saveWeappConfig } from '../../services/weappConfig'
import { fetchFlpLogs } from '../../services/flp'
import { resolveProfileAsset } from '../../services/profile'
import OpenPlatformEditor from '../../components/OpenPlatformEditor.vue'
import MemberSettingsView from './MemberSettingsView.vue'
import { fetchSubscriptionAutoTask, saveSubscriptionAutoTask } from '../../services/weappSubscriptions'
import { fetchLotteryConfig, fetchLotteryLogs, saveLotteryConfig } from '../../services/lottery'
import { fetchAdminUserCheckins, fetchAdminUserNewbieTasks } from '../../services/adminUsers'
import {
  fetchNewbieTaskTemplate,
  saveNewbieTaskTemplate,
  deleteNewbieTaskTemplate,
  resetNewbieTaskUserFlags,
} from '../../services/newbieTasks'
import { API_BASE_URL, AUTH_TOKEN_KEY } from '../../services/http'
import { buildDownloadUrl, extractObjectName, uploadPublicFile } from '../../services/files'
import {
  fetchReportEntries,
  fetchReportEntryDialogText,
  saveReportEntryDialogText,
  createReportEntry,
  updateReportEntry,
  deleteReportEntry,
} from '../../services/reportEntries'
import {
  fetchUserAgreements,
  createUserAgreement,
  updateUserAgreement,
  deleteUserAgreement,
  downloadUserAgreementPdf,
  fetchPrivacyPolicies,
  createPrivacyPolicy,
  updatePrivacyPolicy,
  deletePrivacyPolicy,
  downloadPrivacyPolicyPdf,
} from '../../services/policy'
import { fetchLadderGameAdminLeaderboard } from '../../services/ladderGame'
import reportEntryRegions from '../../data/reportEntryRegions'
import detailIcon from '../../assets/img/detail.png'

const { t, te, locale } = useI18n()

const newbieTaskResetTextFallbacks = {
  'zh-CN': {
    resetProgress: {
      title: '刷新任务进度',
      updatedAt: '最近更新：{time}',
      emptyUpdatedAt: '暂无',
      count: '已处理 {processed} / {total}',
      socketConnected: '进度通道已连接',
      socketConnecting: '进度通道连接中',
      status: {
        idle: '未开始',
        pending: '等待执行',
        running: '执行中',
        completed: '已完成',
        failed: '执行失败',
        cancelled: '已取消',
      },
    },
    messages: {
      resetStarted: '已开始刷新全部状态，请等待后台任务完成',
      resetInProgress: '已有刷新任务正在执行，已继续监听进度',
      resetSuccess: '已刷新 {count} 个用户的弹框状态和领取状态',
      resetFailed: '刷新所有用户状态失败',
    },
  },
  en: {
    resetProgress: {
      title: 'Reset task progress',
      updatedAt: 'Last update: {time}',
      emptyUpdatedAt: 'N/A',
      count: 'Processed {processed} / {total}',
      socketConnected: 'Progress channel connected',
      socketConnecting: 'Connecting progress channel',
      status: {
        idle: 'Not started',
        pending: 'Pending',
        running: 'Running',
        completed: 'Completed',
        failed: 'Failed',
        cancelled: 'Cancelled',
      },
    },
    messages: {
      resetStarted: 'Reset task started. Wait for the background job to finish.',
      resetInProgress: 'A reset task is already running. Continuing to listen for progress.',
      resetSuccess: 'Reset popup and claim flags for {count} user(s)',
      resetFailed: 'Failed to reset popup and claim flags for all users',
    },
  },
}

const interpolateText = (template, params = {}) =>
  String(template || '').replace(/\{(\w+)\}/g, (_match, key) => params[key] ?? '')

const getNewbieTaskResetFallbackLocale = () => (String(locale.value || '').toLowerCase().startsWith('zh') ? 'zh-CN' : 'en')

const translateNewbieTaskReset = (path, params = {}) => {
  const key = `settings.newbieTasks.template.${path}`
  if (te(key)) {
    return t(key, params)
  }

  const fallbackLocale = getNewbieTaskResetFallbackLocale()
  const fallbackRoot = newbieTaskResetTextFallbacks[fallbackLocale] || newbieTaskResetTextFallbacks.en
  const value = path.split('.').reduce((current, segment) => current?.[segment], fallbackRoot)
  if (typeof value === 'string') {
    return interpolateText(value, params)
  }
  return key
}

const activeTab = ref('invite')
const areaSettingsTab = ref('suitable-fly-zone')
const guideSettingsTab = ref('gif')

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
  longImageUrl: '',
})
const mapRules = computed(() => ({
  wechatListPrice: [{ required: true, message: t('settings.mapSettlement.validation.wechatListPrice') }],
  wechatNetPrice: [{ required: true, message: t('settings.mapSettlement.validation.wechatNetPrice') }],
  flpListPrice: [{ required: true, message: t('settings.mapSettlement.validation.flpListPrice') }],
  flpNetPrice: [{ required: true, message: t('settings.mapSettlement.validation.flpNetPrice') }],
}))
const mapLoading = ref(false)
const mapSaving = ref(false)
const mapLongImageSaving = ref(false)
const mapLongImageUploading = ref(false)
const tencentCosForm = reactive({
  secretId: '',
  secretKey: '',
  region: '',
  roleArn: '',
  roleSessionName: '',
  durationSeconds: 1800,
  bucketsText: '',
})
const tencentCosLoading = ref(false)
const tencentCosSaving = ref(false)
const tencentCosConfigured = ref(false)
const tencentCosStsState = reactive({
  tmpSecretId: '',
  tmpSecretKey: '',
  sessionToken: '',
  expiredTime: 0,
  startTime: '',
  expiration: '',
  region: '',
  buckets: [],
  durationSeconds: 0,
})
const tencentCosStsLoading = ref(false)
const tencentCosUploadTesting = ref(false)
const tencentCosDownloadTesting = ref(false)
const tencentCosUploadProgress = ref(0)
const tencentCosSelectedFile = ref(null)
const tencentCosTestForm = reactive({
  bucket: '',
  uploadKey: '',
  downloadKey: '',
})
const tencentCosTestResult = reactive({
  uploadedKey: '',
  uploadedUrl: '',
  downloadedAt: '',
})

const memberNoAdsForm = reactive({
  threshold: 0,
})
const memberNoAdsRules = computed(() => ({
  threshold: [
    {
      validator: (_, value) => {
        const numeric = Number(value)
        if (Number.isNaN(numeric) || numeric < 0) {
          return Promise.reject(new Error(t('settings.adSettings.validation.threshold')))
        }
        return Promise.resolve()
      },
    },
  ],
}))
const memberNoAdsLoading = ref(false)
const memberNoAdsSaving = ref(false)
const adSyncing = ref(false)
const adLastCrowdLoading = ref(false)
const adLastCrowdRecord = ref(null)

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
const copyTypeGroups = computed(() => [
  {
    key: 'flightSafetyPreparation',
    title: t('settings.copySettings.groups.flightSafetyPreparation'),
    options: [
      {
        value: 'flightQualificationAssessmentRichText',
        label: t('settings.copySettings.options.flightQualificationAssessmentRichText'),
      },
      { value: 'insuranceCoverageRichText', label: t('settings.copySettings.options.insuranceCoverageRichText') },
      {
        value: 'caacLicenseRegistrationSubsidyRichText',
        label: t('settings.copySettings.options.caacLicenseRegistrationSubsidyRichText'),
      },
      { value: 'theoryCertificateRichText', label: t('settings.copySettings.options.theoryCertificateRichText') },
      { value: 'operationCertificateRichText', label: t('settings.copySettings.options.operationCertificateRichText') },
      { value: 'm120FlightRichText', label: t('settings.copySettings.options.m120FlightRichText') },
      {
        value: 'noSpecialFlightScenarioRichText',
        label: t('settings.copySettings.options.noSpecialFlightScenarioRichText'),
      },
      {
        value: 'reportAndUnlockGuideRichText',
        label: t('settings.copySettings.options.reportAndUnlockGuideRichText'),
      },
      {
        value: 'airspaceDescriptionRichText',
        label: t('settings.copySettings.options.airspaceDescriptionRichText'),
      },
    ],
  },
  {
    key: 'other',
    title: t('settings.copySettings.groups.other'),
    options: [
      { value: 'openPlatform', label: t('settings.copySettings.options.openPlatform') },
      { value: 'planetMerchantAdvancedGuide', label: t('settings.copySettings.options.planetMerchantAdvancedGuide') },
      { value: 'planetCreationAdvancedGuide', label: t('settings.copySettings.options.planetCreationAdvancedGuide') },
      { value: 'shareToPlatform', label: t('settings.copySettings.options.shareToPlatform') },
      { value: 'flpRewardHelp', label: t('settings.copySettings.options.flpRewardHelp') },
      { value: 'inviteGuide', label: t('settings.copySettings.options.inviteGuide') },
      { value: 'coordinateLongPressGuide', label: t('settings.copySettings.options.coordinateLongPressGuide') },
      { value: 'coordinateSystemDescription', label: t('settings.copySettings.options.coordinateSystemDescription') },
    ],
  },
])
const copyHandlers = {
  openPlatform: {
    fetch: fetchOpenPlatformCopy,
    save: saveOpenPlatformCopy,
  },
  flightQualificationAssessmentRichText: {
    fetch: fetchFlightQualificationAssessmentRichText,
    save: saveFlightQualificationAssessmentRichText,
  },
  insuranceCoverageRichText: {
    fetch: fetchInsuranceCoverageRichText,
    save: saveInsuranceCoverageRichText,
  },
  caacLicenseRegistrationSubsidyRichText: {
    fetch: fetchCaacLicenseRegistrationSubsidyRichText,
    save: saveCaacLicenseRegistrationSubsidyRichText,
  },
  theoryCertificateRichText: {
    fetch: fetchTheoryCertificateRichText,
    save: saveTheoryCertificateRichText,
  },
  operationCertificateRichText: {
    fetch: fetchOperationCertificateRichText,
    save: saveOperationCertificateRichText,
  },
  m120FlightRichText: {
    fetch: fetch120mFlightRichText,
    save: save120mFlightRichText,
  },
  noSpecialFlightScenarioRichText: {
    fetch: fetchNoSpecialFlightScenarioRichText,
    save: saveNoSpecialFlightScenarioRichText,
  },
  reportAndUnlockGuideRichText: {
    fetch: fetchReportAndUnlockGuideRichText,
    save: saveReportAndUnlockGuideRichText,
  },
  airspaceDescriptionRichText: {
    fetch: fetchAirspaceDescriptionRichText,
    save: saveAirspaceDescriptionRichText,
  },
  planetMerchantAdvancedGuide: {
    fetch: fetchPlanetMerchantAdvancedGuideCopy,
    save: savePlanetMerchantAdvancedGuideCopy,
  },
  planetCreationAdvancedGuide: {
    fetch: fetchPlanetCreationAdvancedGuideCopy,
    save: savePlanetCreationAdvancedGuideCopy,
  },
  shareToPlatform: {
    fetch: fetchShareToPlatformCopy,
    save: saveShareToPlatformCopy,
  },
  flpRewardHelp: {
    fetch: fetchFlpRewardHelpCopy,
    save: saveFlpRewardHelpCopy,
  },
  inviteGuide: {
    fetch: fetchInviteGuideCopy,
    save: saveInviteGuideCopy,
  },
  coordinateLongPressGuide: {
    fetch: fetchCoordinateLongPressGuideCopy,
    save: saveCoordinateLongPressGuideCopy,
  },
  coordinateSystemDescription: {
    fetch: fetchCoordinateSystemDescriptionCopy,
    save: saveCoordinateSystemDescriptionCopy,
  },
}

const weappForm = reactive({
  appId: '',
  secret: '',
  jwtSecret: '',
  mapKey: '',
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
const newbieTaskResetting = ref(false)
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
const newbieTaskResetSocket = ref(null)
const newbieTaskResetSocketConnected = ref(false)
const newbieTaskResetProgress = reactive({
  status: '',
  total: 0,
  processed: 0,
  message: '',
  updatedAt: null,
  visible: false,
})
const newbieTaskResetTerminalSignature = ref('')

const guideUrls = ref([])
const guideLoading = ref(false)
const guideSaving = ref(false)
const guideUploadLoading = ref(false)
const guideUpdatedAt = ref(null)

const createNewbieTaskRow = () => ({
  index: null,
  name: '',
  description: '',
  buttonText: '',
})

newbieTaskTemplateForm.value = [createNewbieTaskRow()]

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
const posterServiceVersion = ref('')
const posterServiceVersionLoading = ref(false)
const posterServiceVersionRefreshing = ref(false)
const easterEggResourceConfig = reactive({
  fileName: '',
  version: '',
})
const easterEggResourceForm = reactive({
  fileName: '',
  version: '',
})
const easterEggResourceLoading = ref(false)
const easterEggResourceSaving = ref(false)
const easterEggResourceSelected = ref(null)
const provinceCityKmlZipConfig = reactive({
  fileName: '',
  version: '',
})
const countyKmlZipConfig = reactive({
  fileName: '',
  version: '',
})
const provinceCityKmlZipForm = reactive({
  fileName: '',
  version: '',
})
const countyKmlZipForm = reactive({
  fileName: '',
  version: '',
})
const provinceCityKmlZipLoading = ref(false)
const provinceCityKmlZipSaving = ref(false)
const provinceCityKmlZipSelected = ref(null)
const countyKmlZipLoading = ref(false)
const countyKmlZipSaving = ref(false)
const countyKmlZipSelected = ref(null)
const suitableFlyZoneKmzForm = reactive({
  name: '',
  version: '',
  description: '',
  fileName: '',
})
const suitableFlyZoneKmzLoading = ref(false)
const suitableFlyZoneKmzSaving = ref(false)
const suitableFlyZoneKmzSelected = ref(null)
const suitableFlyZoneKmzList = ref([])
const kmlDecryptAesKeyForm = reactive({
  aesKey: '',
})
const kmlDecryptAesKeyLoading = ref(false)
const kmlDecryptAesKeySaving = ref(false)

const userAgreementList = ref([])
const userAgreementLoading = ref(false)
const userAgreementSaving = ref(false)
const userAgreementPdfDownloadingId = ref(null)
const userAgreementForm = reactive({
  id: null,
  version: '',
  content: '',
})

const privacyPolicyList = ref([])
const privacyPolicyLoading = ref(false)
const privacyPolicySaving = ref(false)
const privacyPolicyPdfDownloadingId = ref(null)
const privacyPolicyForm = reactive({
  id: null,
  version: '',
  content: '',
})

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
const ladderLeaderboard = ref([])
const ladderLeaderboardLoading = ref(false)
const ladderLeaderboardPagination = reactive({
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
const reportEntryPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})
const reportEntryForm = reactive({
  areaPath: [],
  cityDescription: '',
  doubleReported: false,
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
const newbieTaskResetProgressVisible = computed(() => newbieTaskResetProgress.visible || newbieTaskResetting.value)
const newbieTaskResetProgressPercent = computed(() => {
  const status = String(newbieTaskResetProgress.status || '').toUpperCase()
  if (status === 'COMPLETED') return 100
  const total = Number(newbieTaskResetProgress.total) || 0
  const processed = Number(newbieTaskResetProgress.processed) || 0
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, Math.round((processed / total) * 100)))
})
const newbieTaskResetProgressStatus = computed(() => {
  const status = String(newbieTaskResetProgress.status || '').toUpperCase()
  if (status === 'FAILED') return 'exception'
  if (status === 'COMPLETED') return 'success'
  return 'active'
})
const newbieTaskResetProgressStatusLabel = computed(() => {
  const key = String(newbieTaskResetProgress.status || '').toLowerCase()
  if (!key) return translateNewbieTaskReset('resetProgress.status.idle')
  return translateNewbieTaskReset(`resetProgress.status.${key}`) || newbieTaskResetProgress.status
})
const newbieTaskResetProgressUpdatedAtDisplay = computed(() =>
  newbieTaskResetProgress.updatedAt
    ? new Date(newbieTaskResetProgress.updatedAt).toLocaleString()
    : translateNewbieTaskReset('resetProgress.emptyUpdatedAt'),
)
const newbieTaskResetProgressCountDisplay = computed(() => {
  const processed = Number(newbieTaskResetProgress.processed) || 0
  const total = Number(newbieTaskResetProgress.total) || 0
  return translateNewbieTaskReset('resetProgress.count', {
    processed,
    total: total > 0 ? total : '-',
  })
})

const guideUpdatedAtDisplay = computed(() =>
  guideUpdatedAt.value
    ? new Date(guideUpdatedAt.value).toLocaleString()
    : t('settings.system.guide.meta.emptyUpdatedAt'),
)

const extractErrorMessage = (error, fallback = t('messages.requestFailed')) => {
  const data = error?.response?.data
  if (!data) {
    return error?.message || fallback
  }
  if (typeof data === 'string') {
    return data
  }
  if (data.msg) {
    return data.msg
  }
  if (typeof data.message === 'string') {
    return data.message
  }
  if (data.message && typeof data.message === 'object') {
    return Object.values(data.message).join(' / ')
  }
  return fallback
}

const buildAdminWsUrl = (path) => {
  if (typeof window === 'undefined') return ''
  const token = localStorage.getItem(AUTH_TOKEN_KEY)
  try {
    const apiUrl = new URL(API_BASE_URL, window.location.origin)
    const wsProtocol = apiUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = new URL(`${wsProtocol}//${apiUrl.host}${path}`)
    if (token) {
      url.searchParams.set('token', token)
    }
    return url.toString()
  } catch (error) {
    const origin = window.location.origin.replace(/^http/, 'ws')
    const url = new URL(`${origin}${path}`)
    if (token) {
      url.searchParams.set('token', token)
    }
    return url.toString()
  }
}

const isNewbieTaskResetTerminalStatus = (status) => ['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)

let newbieTaskResetSocketReconnectTimer = null
let newbieTaskResetSocketShouldReconnect = true

const getLotteryImageUrl = (value) => buildDownloadUrl(extractObjectName(value || ''))
const resolveStorageUrl = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw)) return raw
  const objectName = extractObjectName(raw) || raw
  return buildDownloadUrl(objectName)
}
const getDisplayFileName = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const objectName = extractObjectName(raw)
  if (objectName) return objectName
  const cleaned = raw.split(/[?#]/)[0]
  const segments = cleaned.split(/[\\/]/).filter(Boolean)
  return segments[segments.length - 1] || cleaned
}
const getPlainText = (value) =>
  String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/&nbsp;/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .trim()

const hasRichContent = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return false
  if (/<(img|video|iframe|object|embed)/i.test(raw)) return true
  return getPlainText(raw).length > 0
}

const getPolicySummary = (value, max = 120) => {
  const text = getPlainText(value)
  if (!text) return '-'
  return text.length > max ? `${text.slice(0, max)}…` : text
}
const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : '-')
const sanitizeFilename = (value) => String(value || '').replace(/[\\/:*?"<>|]/g, '-')
const resolveFilenameFromDisposition = (value) => {
  if (!value) return ''
  const encodedMatch = value.match(/filename\*=UTF-8''([^;]+)/i)
  if (encodedMatch?.[1]) {
    try {
      return decodeURIComponent(encodedMatch[1])
    } catch (error) {
      return encodedMatch[1]
    }
  }
  const match = value.match(/filename="?([^\";]+)"?/i)
  return match?.[1] ?? ''
}
const resolvePdfFilename = (prefix, record) => {
  const version = String(record?.version || '').trim()
  const id = record?.id ?? ''
  const suffix = version || id || Date.now()
  return sanitizeFilename(`${prefix}-${suffix}.pdf`)
}
const triggerBlobDownload = (blob, filename) => {
  if (typeof window === 'undefined' || !blob) return
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.URL.revokeObjectURL(url)
}
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

const normalizeAdCrowdRecord = (record) => {
  if (!record || typeof record !== 'object') return null
  const members = Array.isArray(record?.members) ? record.members : []
  return {
    ...record,
    members: members.map((member, index) => ({
      ...member,
      rowKey: member?.openid || `${member?.userId ?? 'unknown'}-${index}`,
      avatarUrl: resolveProfileAsset(member?.avatarUrl),
    })),
  }
}

const adCrowdMembers = computed(() => {
  const members = adLastCrowdRecord.value?.members
  return Array.isArray(members) ? members : []
})

const adLastRecordStatusKey = computed(() => {
  const status = String(adLastCrowdRecord.value?.status || '').toUpperCase()
  if (status === 'SUCCESS') return 'success'
  if (status === 'FAILED') return 'failed'
  if (status === 'SKIPPED_EMPTY') return 'skippedEmpty'
  return 'unknown'
})

const adLastRecordStatusText = computed(() => t(`settings.adSettings.status.${adLastRecordStatusKey.value}`))

const adLastRecordStatusColor = computed(() => {
  if (adLastRecordStatusKey.value === 'success') return 'green'
  if (adLastRecordStatusKey.value === 'failed') return 'red'
  if (adLastRecordStatusKey.value === 'skippedEmpty') return 'gold'
  return 'default'
})

const adLastExecutedAtDisplay = computed(() =>
  adLastCrowdRecord.value?.executedAt
    ? new Date(adLastCrowdRecord.value.executedAt).toLocaleString()
    : t('settings.adSettings.meta.noData'),
)

const adLastCrowdCount = computed(() => {
  const count = Number(adLastCrowdRecord.value?.totalOpenidCount)
  if (Number.isFinite(count)) return count
  return adCrowdMembers.value.length
})

const formatMemberNoAdsStatus = (value) => {
  const numeric = Number(value)
  return Number.isFinite(numeric)
    ? t('settings.adSettings.meta.statusValue', { value: numeric.toFixed(0) })
    : t('settings.adSettings.meta.noData')
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

const mergeReportEntryPayload = (payload, saved = {}) => ({
  ...payload,
  ...saved,
  miniProgram: {
    ...payload.miniProgram,
    ...(saved?.miniProgram || {}),
  },
  guide: {
    ...payload.guide,
    ...(saved?.guide || {}),
  },
})

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
const posterServiceVersionDisplay = computed(() =>
  posterServiceVersion.value || t('settings.system.posterService.emptyVersion'),
)
const tencentCosConfiguredText = computed(() =>
  tencentCosConfigured.value ? t('settings.system.tencentCos.configured') : t('settings.system.tencentCos.notConfigured'),
)
const tencentCosAvailableBuckets = computed(() =>
  Array.from(
    new Set([
      ...parseTencentCosBuckets(tencentCosForm.bucketsText),
      ...(Array.isArray(tencentCosStsState.buckets) ? tencentCosStsState.buckets : []),
    ]),
  ),
)
const tencentCosStsExpirationText = computed(() => {
  if (tencentCosStsState.expiration) {
    return tencentCosStsState.expiration
  }
  if (Number(tencentCosStsState.expiredTime) > 0) {
    return new Date(Number(tencentCosStsState.expiredTime) * 1000).toLocaleString()
  }
  return t('settings.system.tencentCos.test.emptyValue')
})
const tencentCosStsRegionText = computed(() =>
  tencentCosStsState.region || tencentCosForm.region || t('settings.system.tencentCos.test.emptyValue'),
)
const tencentCosStsFetched = computed(() => Boolean(tencentCosStsState.tmpSecretId && tencentCosStsState.sessionToken))

const resetEasterEggResourceForm = (currentVersion = '') => {
  easterEggResourceForm.fileName = ''
  easterEggResourceForm.version = getNextFontVersion(currentVersion)
  easterEggResourceSelected.value = null
}

const easterEggResourceDownloadUrl = computed(() => buildDownloadUrl(easterEggResourceConfig.fileName || ''))

const resetProvinceCityKmlZipForm = (currentVersion = '') => {
  provinceCityKmlZipForm.fileName = ''
  provinceCityKmlZipForm.version = getNextFontVersion(currentVersion)
  provinceCityKmlZipSelected.value = null
}

const provinceCityKmlZipDownloadUrl = computed(() => buildDownloadUrl(provinceCityKmlZipConfig.fileName || ''))

const resetCountyKmlZipForm = (currentVersion = '') => {
  countyKmlZipForm.fileName = ''
  countyKmlZipForm.version = getNextFontVersion(currentVersion)
  countyKmlZipSelected.value = null
}

const countyKmlZipDownloadUrl = computed(() => buildDownloadUrl(countyKmlZipConfig.fileName || ''))

const resetSuitableFlyZoneKmzForm = () => {
  suitableFlyZoneKmzForm.name = ''
  suitableFlyZoneKmzForm.version = ''
  suitableFlyZoneKmzForm.description = ''
  suitableFlyZoneKmzForm.fileName = ''
  suitableFlyZoneKmzSelected.value = null
}

const resetKmlDecryptAesKeyForm = (aesKey = '') => {
  kmlDecryptAesKeyForm.aesKey = String(aesKey || '')
}

const resolveSuitableFlyZoneKmzDownloadUrl = (value) => buildDownloadUrl(extractObjectName(value || '') || value || '')

const inviteColumns = computed(() => [
  { title: t('settings.invite.logs.columns.featureCode'), dataIndex: ['user', 'featureCode'], key: 'featureCode' },
  { title: t('settings.invite.logs.columns.username'), dataIndex: ['user', 'username'], key: 'username' },
  { title: t('settings.invite.logs.columns.avatar'), dataIndex: ['user', 'avatarUrl'], key: 'avatar', width: 120 },
  { title: t('settings.invite.logs.columns.amount'), dataIndex: 'amount', key: 'amount', width: 140 },
  { title: t('settings.invite.logs.columns.operation'), dataIndex: 'operation', key: 'operation', width: 140 },
  { title: t('settings.invite.logs.columns.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 200 },
])

const adMemberColumns = computed(() => [
  { title: t('settings.adSettings.table.columns.avatar'), dataIndex: 'avatarUrl', key: 'avatar', width: 90 },
  { title: t('settings.adSettings.table.columns.featureCode'), dataIndex: 'featureCode', key: 'featureCode', width: 140 },
  { title: t('settings.adSettings.table.columns.username'), dataIndex: 'username', key: 'username', width: 140 },
  { title: t('settings.adSettings.table.columns.openid'), dataIndex: 'openid', key: 'openid', ellipsis: true },
  { title: t('settings.adSettings.table.columns.status'), dataIndex: 'status', key: 'status', width: 120 },
  { title: t('settings.adSettings.table.columns.userCreatedAt'), dataIndex: 'userCreatedAt', key: 'userCreatedAt', width: 180 },
])

const userAgreementColumns = computed(() => [
  { title: t('settings.system.userAgreement.columns.version'), dataIndex: 'version', key: 'version', width: 160 },
  { title: t('settings.system.userAgreement.columns.content'), dataIndex: 'content', key: 'content' },
  {
    title: t('settings.system.userAgreement.columns.updatedAt'),
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    width: 200,
  },
  { title: t('settings.system.userAgreement.columns.actions'), key: 'actions', width: 220 },
])

const privacyPolicyColumns = computed(() => [
  { title: t('settings.system.privacyPolicy.columns.version'), dataIndex: 'version', key: 'version', width: 160 },
  { title: t('settings.system.privacyPolicy.columns.content'), dataIndex: 'content', key: 'content' },
  {
    title: t('settings.system.privacyPolicy.columns.updatedAt'),
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    width: 200,
  },
  { title: t('settings.system.privacyPolicy.columns.actions'), key: 'actions', width: 220 },
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

const ladderLeaderboardColumns = computed(() => [
  { title: t('settings.system.ladderLeaderboard.columns.rank'), dataIndex: 'rank', key: 'rank', width: 90 },
  { title: t('settings.system.ladderLeaderboard.columns.avatar'), dataIndex: 'avatarUrl', key: 'avatar', width: 90 },
  { title: t('settings.system.ladderLeaderboard.columns.username'), dataIndex: 'username', key: 'username', width: 160 },
  { title: t('settings.system.ladderLeaderboard.columns.featureCode'), dataIndex: 'featureCode', key: 'featureCode', width: 140 },
  { title: t('settings.system.ladderLeaderboard.columns.highestScore'), dataIndex: 'highestScore', key: 'highestScore', width: 120 },
  { title: t('settings.system.ladderLeaderboard.columns.gameCount'), dataIndex: 'gameCount', key: 'gameCount', width: 120 },
  {
    title: t('settings.system.ladderLeaderboard.columns.latestGameTime'),
    dataIndex: 'latestGameTime',
    key: 'latestGameTime',
    width: 200,
  },
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
  { title: t('settings.reportEntry.table.doubleReported'), dataIndex: 'doubleReported', key: 'doubleReported', width: 120 },
  { title: t('settings.reportEntry.table.actions'), key: 'actions', width: 120 },
])
const suitableFlyZoneKmzColumns = computed(() => [
  { title: t('settings.areaSettings.suitableFlyZone.table.columns.name'), dataIndex: 'name', key: 'name', width: 180 },
  { title: t('settings.areaSettings.suitableFlyZone.table.columns.version'), dataIndex: 'version', key: 'version', width: 140 },
  { title: t('settings.areaSettings.suitableFlyZone.table.columns.attachment'), dataIndex: 'attachmentName', key: 'attachmentName', width: 220 },
  { title: t('settings.areaSettings.suitableFlyZone.table.columns.description'), dataIndex: 'description', key: 'description' },
  { title: t('settings.areaSettings.suitableFlyZone.table.columns.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 200 },
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
    const [data, longImageConfig] = await Promise.all([
      fetchMapSettlementConfig(),
      fetchMerchantIntroLongImageConfig().catch((error) => {
        if (error?.response?.status === 404) return { imageUrl: '' }
        throw error
      }),
    ])
    mapForm.wechatListPrice = data?.wechatListPrice ?? 0
    mapForm.wechatNetPrice = data?.wechatNetPrice ?? 0
    mapForm.flpListPrice = data?.flpListPrice ?? 0
    mapForm.flpNetPrice = data?.flpNetPrice ?? 0
    mapForm.longImageUrl = longImageConfig?.imageUrl ?? ''
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
    await loadMapConfig()
  } catch (error) {
    console.error('Failed to save map settlement config', error)
    message.error(t('settings.mapSettlement.messages.saveFailed'))
  } finally {
    mapSaving.value = false
  }
}

const submitMapLongImageForm = async () => {
  mapLongImageSaving.value = true
  try {
    await saveMerchantIntroLongImageConfig({
      imageUrl: String(mapForm.longImageUrl || '').trim(),
    })
    message.success(t('settings.mapSettlement.messages.longImageSaveSuccess'))
    await loadMapConfig()
  } catch (error) {
    console.error('Failed to save merchant intro long image config', error)
    message.error(t('settings.mapSettlement.messages.longImageSaveFailed'))
  } finally {
    mapLongImageSaving.value = false
  }
}

const parseTencentCosBuckets = (input) =>
  Array.from(
    new Set(
      String(input || '')
        .split(/[\r\n,]+/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )

const applyTencentCosConfig = (data = {}) => {
  tencentCosForm.secretId = data?.secretId || ''
  tencentCosForm.secretKey = ''
  tencentCosForm.region = data?.region || ''
  tencentCosForm.roleArn = data?.roleArn || ''
  tencentCosForm.roleSessionName = data?.roleSessionName || ''
  tencentCosForm.durationSeconds = Number(data?.durationSeconds) || 1800
  tencentCosForm.bucketsText = Array.isArray(data?.buckets) ? data.buckets.join('\n') : ''
  tencentCosConfigured.value = Boolean(data?.configured)
}

const applyTencentCosSts = (data = {}) => {
  tencentCosStsState.tmpSecretId = data?.tmpSecretId || ''
  tencentCosStsState.tmpSecretKey = data?.tmpSecretKey || ''
  tencentCosStsState.sessionToken = data?.sessionToken || ''
  tencentCosStsState.expiredTime = Number(data?.expiredTime) || 0
  tencentCosStsState.startTime = data?.startTime || ''
  tencentCosStsState.expiration = data?.expiration || ''
  tencentCosStsState.region = data?.region || ''
  tencentCosStsState.buckets = Array.isArray(data?.buckets) ? data.buckets : []
  tencentCosStsState.durationSeconds = Number(data?.durationSeconds) || 0
}

const resetTencentCosTestResult = () => {
  tencentCosUploadProgress.value = 0
  tencentCosTestResult.uploadedKey = ''
  tencentCosTestResult.uploadedUrl = ''
  tencentCosTestResult.downloadedAt = ''
}

const loadTencentCosConfig = async () => {
  tencentCosLoading.value = true
  try {
    const data = await fetchTencentCosConfig()
    applyTencentCosConfig(data)
  } catch (error) {
    if (error?.response?.status === 404) {
      applyTencentCosConfig()
      return
    }
    console.error('Failed to load Tencent COS config', error)
    message.error(t('settings.system.tencentCos.messages.loadFailed'))
  } finally {
    tencentCosLoading.value = false
  }
}

const submitTencentCosConfig = async () => {
  tencentCosSaving.value = true
  try {
    const payload = {
      secretId: String(tencentCosForm.secretId || '').trim(),
      region: String(tencentCosForm.region || '').trim(),
      roleArn: String(tencentCosForm.roleArn || '').trim(),
      roleSessionName: String(tencentCosForm.roleSessionName || '').trim(),
      durationSeconds: Number(tencentCosForm.durationSeconds) || 0,
      buckets: parseTencentCosBuckets(tencentCosForm.bucketsText),
    }
    const secretKey = String(tencentCosForm.secretKey || '').trim()
    if (secretKey) {
      payload.secretKey = secretKey
    }
    await saveTencentCosConfig(payload)
    message.success(t('settings.system.tencentCos.messages.saveSuccess'))
    await loadTencentCosConfig()
  } catch (error) {
    console.error('Failed to save Tencent COS config', error)
    message.error(t('settings.system.tencentCos.messages.saveFailed'))
  } finally {
    tencentCosSaving.value = false
  }
}

const isTencentCosStsExpired = () => {
  const expiredTime = Number(tencentCosStsState.expiredTime)
  if (!expiredTime) return true
  return expiredTime - Math.floor(Date.now() / 1000) <= 60
}

const loadTencentCosSts = async ({ force = false, silent = false } = {}) => {
  if (!force && tencentCosStsFetched.value && !isTencentCosStsExpired()) {
    return { ...tencentCosStsState }
  }
  tencentCosStsLoading.value = true
  try {
    const data = await fetchTencentCosSts()
    applyTencentCosSts(data)
    if (!silent) {
      message.success(t('settings.system.tencentCos.test.messages.stsLoaded'))
    }
    return data
  } catch (error) {
    console.error('Failed to load Tencent COS STS', error)
    if (!silent) {
      message.error(t('settings.system.tencentCos.test.messages.stsLoadFailed'))
    }
    throw error
  } finally {
    tencentCosStsLoading.value = false
  }
}

const createTencentCosClient = async () => {
  const sts = await loadTencentCosSts({ silent: true })
  return new COS({
    SecretId: sts.tmpSecretId,
    SecretKey: sts.tmpSecretKey,
    SecurityToken: sts.sessionToken,
    Protocol: 'https:',
  })
}

const resolveTencentCosRegion = () => tencentCosStsState.region || String(tencentCosForm.region || '').trim()

const makeTencentCosObjectUrl = (bucket, region, key) =>
  `https://${bucket}.cos.${region}.myqcloud.com/${String(key || '')
    .split('/')
    .map((item) => encodeURIComponent(item))
    .join('/')}`

const sanitizeTencentCosObjectKey = (value) =>
  String(value || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\s+/g, '-')

const buildTencentCosUploadKey = (file) => {
  const fileName = sanitizeTencentCosObjectKey(file?.name || 'file')
  return `console-test/${Date.now()}-${fileName}`
}

const putTencentCosObject = (client, params) =>
  new Promise((resolve, reject) => {
    client.putObject(params, (error, data) => {
      if (error) {
        reject(error)
        return
      }
      resolve(data)
    })
  })

const getTencentCosObjectUrl = (client, params) =>
  new Promise((resolve, reject) => {
    client.getObjectUrl(params, (error, data) => {
      if (error) {
        reject(error)
        return
      }
      resolve(data)
    })
  })

const handleTencentCosTestFileChange = (event) => {
  const file = event?.target?.files?.[0] || null
  tencentCosSelectedFile.value = file
  resetTencentCosTestResult()
  if (file && !String(tencentCosTestForm.uploadKey || '').trim()) {
    tencentCosTestForm.uploadKey = buildTencentCosUploadKey(file)
  }
  if (event?.target) {
    event.target.value = ''
  }
}

const clearTencentCosTestFile = () => {
  tencentCosSelectedFile.value = null
}

const ensureTencentCosTestBucket = () => {
  const bucket = String(tencentCosTestForm.bucket || '').trim()
  if (!bucket) {
    message.warning(t('settings.system.tencentCos.test.messages.bucketRequired'))
    return ''
  }
  return bucket
}

const submitTencentCosUploadTest = async () => {
  const bucket = ensureTencentCosTestBucket()
  if (!bucket) return
  if (!tencentCosSelectedFile.value) {
    message.warning(t('settings.system.tencentCos.test.messages.fileRequired'))
    return
  }
  const region = resolveTencentCosRegion()
  if (!region) {
    message.warning(t('settings.system.tencentCos.test.messages.regionRequired'))
    return
  }
  const key = sanitizeTencentCosObjectKey(tencentCosTestForm.uploadKey) || buildTencentCosUploadKey(tencentCosSelectedFile.value)

  tencentCosUploadTesting.value = true
  tencentCosUploadProgress.value = 0
  try {
    const client = await createTencentCosClient()
    await putTencentCosObject(client, {
      Bucket: bucket,
      Region: region,
      Protocol: 'https:',
      Key: key,
      Body: tencentCosSelectedFile.value,
      onProgress: (progressData) => {
        tencentCosUploadProgress.value = Math.max(
          0,
          Math.min(100, Math.round((Number(progressData?.percent) || 0) * 100)),
        )
      },
    })
    const signedUrlResult = await getTencentCosObjectUrl(client, {
      Bucket: bucket,
      Region: region,
      Protocol: 'https:',
      Key: key,
      Sign: true,
    }).catch(() => null)
    tencentCosTestForm.uploadKey = key
    tencentCosTestForm.downloadKey = key
    tencentCosTestResult.uploadedKey = key
    tencentCosTestResult.uploadedUrl =
      signedUrlResult?.Url || signedUrlResult || makeTencentCosObjectUrl(bucket, region, key)
    message.success(t('settings.system.tencentCos.test.messages.uploadSuccess'))
  } catch (error) {
    console.error('Failed to upload Tencent COS object', error)
    message.error(t('settings.system.tencentCos.test.messages.uploadFailed'))
  } finally {
    tencentCosUploadTesting.value = false
  }
}

const runTencentCosDownloadTest = async () => {
  const bucket = ensureTencentCosTestBucket()
  if (!bucket) return
  const region = resolveTencentCosRegion()
  if (!region) {
    message.warning(t('settings.system.tencentCos.test.messages.regionRequired'))
    return
  }
  const key = sanitizeTencentCosObjectKey(tencentCosTestForm.downloadKey)
  if (!key) {
    message.warning(t('settings.system.tencentCos.test.messages.downloadKeyRequired'))
    return
  }

  tencentCosDownloadTesting.value = true
  try {
    const client = await createTencentCosClient()
    const result = await getTencentCosObjectUrl(client, {
      Bucket: bucket,
      Region: region,
      Protocol: 'https:',
      Key: key,
      Sign: true,
    })
    const signedUrl = result?.Url || result
    const response = await fetch(signedUrl)
    if (!response.ok) {
      throw new Error(`download failed with status ${response.status}`)
    }
    const blob = await response.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = key.split('/').pop() || 'download'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(link.href)
    tencentCosTestResult.downloadedAt = new Date().toLocaleString()
    message.success(t('settings.system.tencentCos.test.messages.downloadSuccess'))
  } catch (error) {
    console.error('Failed to download Tencent COS object', error)
    message.error(t('settings.system.tencentCos.test.messages.downloadFailed'))
  } finally {
    tencentCosDownloadTesting.value = false
  }
}

const handleMapLongImageUpload = async (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return
  mapLongImageUploading.value = true
  try {
    const result = await uploadPublicFile(file)
    mapForm.longImageUrl = result?.url || ''
    message.success(t('settings.mapSettlement.messages.uploadSuccess'))
  } catch (error) {
    console.error('Failed to upload merchant intro long image', error)
    message.error(t('settings.mapSettlement.messages.uploadFailed'))
  } finally {
    mapLongImageUploading.value = false
    if (event?.target) {
      event.target.value = ''
    }
  }
}

const clearMapLongImage = () => {
  mapForm.longImageUrl = ''
}

const loadMemberNoAdsConfig = async () => {
  memberNoAdsLoading.value = true
  try {
    const data = await fetchMemberNoAdsConfig()
    const threshold = Number(data?.threshold)
    memberNoAdsForm.threshold = Number.isFinite(threshold) ? threshold : 0
  } catch (error) {
    if (error?.response?.status === 404) {
      memberNoAdsForm.threshold = 0
      return
    }
    console.error('Failed to load member no-ads config', error)
    message.error(t('settings.adSettings.messages.loadThresholdFailed'))
  } finally {
    memberNoAdsLoading.value = false
  }
}

const loadAdLastCrowdRecord = async () => {
  adLastCrowdLoading.value = true
  try {
    const data = await fetchMemberNoAdsLastCrowd()
    adLastCrowdRecord.value = normalizeAdCrowdRecord(data)
  } catch (error) {
    if (error?.response?.status === 404) {
      adLastCrowdRecord.value = null
      return
    }
    console.error('Failed to load no-ads last crowd record', error)
    message.error(t('settings.adSettings.messages.loadRecordFailed'))
  } finally {
    adLastCrowdLoading.value = false
  }
}

const reloadAdSettings = () => {
  loadMemberNoAdsConfig()
  loadAdLastCrowdRecord()
}

const submitMemberNoAdsForm = async () => {
  memberNoAdsSaving.value = true
  try {
    await saveMemberNoAdsConfig({
      threshold: Math.max(0, Number(memberNoAdsForm.threshold) || 0),
    })
    message.success(t('settings.adSettings.messages.saveThresholdSuccess'))
    await loadMemberNoAdsConfig()
  } catch (error) {
    console.error('Failed to save member no-ads config', error)
    message.error(t('settings.adSettings.messages.saveThresholdFailed'))
  } finally {
    memberNoAdsSaving.value = false
  }
}

const handleAdSyncNow = async () => {
  if (adSyncing.value) return
  adSyncing.value = true
  try {
    const data = await syncMemberNoAdsCrowdNow()
    adLastCrowdRecord.value = normalizeAdCrowdRecord(data)
    message.success(t('settings.adSettings.messages.syncSuccess'))
  } catch (error) {
    console.error('Failed to run no-ads crowd sync', error)
    message.error(t('settings.adSettings.messages.syncFailed'))
  } finally {
    adSyncing.value = false
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
    weappForm.mapKey = data?.mapKey || ''
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
      mapKey: weappForm.mapKey,
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

const applyNewbieTaskResetProgress = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return
  }

  const nextStatus = String(payload.status || newbieTaskResetProgress.status || '').toUpperCase()
  const nextTotal = Number(payload.total)
  const nextProcessed = Number(payload.processed)
  const nextUpdatedAt = payload.updatedAt || newbieTaskResetProgress.updatedAt || new Date().toISOString()
  const nextMessage = typeof payload.message === 'string' ? payload.message : newbieTaskResetProgress.message

  newbieTaskResetProgress.visible = true
  newbieTaskResetProgress.status = nextStatus
  newbieTaskResetProgress.total = Number.isFinite(nextTotal) ? nextTotal : Number(newbieTaskResetProgress.total) || 0
  newbieTaskResetProgress.processed = Number.isFinite(nextProcessed)
    ? nextProcessed
    : Number(newbieTaskResetProgress.processed) || 0
  newbieTaskResetProgress.updatedAt = nextUpdatedAt
  newbieTaskResetProgress.message = nextMessage
  newbieTaskResetting.value = !isNewbieTaskResetTerminalStatus(nextStatus)

  if (!isNewbieTaskResetTerminalStatus(nextStatus)) {
    return
  }

  const terminalSignature = [
    nextStatus,
    newbieTaskResetProgress.total,
    newbieTaskResetProgress.processed,
    nextUpdatedAt,
    nextMessage,
  ].join('|')

  if (newbieTaskResetTerminalSignature.value === terminalSignature) {
    return
  }
  newbieTaskResetTerminalSignature.value = terminalSignature

  if (nextStatus === 'COMPLETED') {
    const count = Number(newbieTaskResetProgress.processed) || Number(newbieTaskResetProgress.total) || 0
    message.success(translateNewbieTaskReset('messages.resetSuccess', { count }))
    loadNewbieTaskStats(newbieTaskStatsPagination.current)
  } else {
    message.error(nextMessage || translateNewbieTaskReset('messages.resetFailed'))
  }
}

const clearNewbieTaskResetReconnectTimer = () => {
  if (newbieTaskResetSocketReconnectTimer) {
    clearTimeout(newbieTaskResetSocketReconnectTimer)
    newbieTaskResetSocketReconnectTimer = null
  }
}

const scheduleNewbieTaskResetSocketReconnect = () => {
  if (!newbieTaskResetSocketShouldReconnect || newbieTaskResetSocketReconnectTimer) {
    return
  }
  newbieTaskResetSocketReconnectTimer = setTimeout(() => {
    newbieTaskResetSocketReconnectTimer = null
    openNewbieTaskResetSocket()
  }, 1500)
}

const closeNewbieTaskResetSocket = () => {
  newbieTaskResetSocketShouldReconnect = false
  clearNewbieTaskResetReconnectTimer()
  newbieTaskResetSocketConnected.value = false
  if (newbieTaskResetSocket.value) {
    newbieTaskResetSocket.value.close()
    newbieTaskResetSocket.value = null
  }
}

const openNewbieTaskResetSocket = () => {
  const url = buildAdminWsUrl('/ws/newbie-task-reset-progress')
  if (!url) {
    return
  }

  newbieTaskResetSocketShouldReconnect = true
  clearNewbieTaskResetReconnectTimer()

  if (newbieTaskResetSocket.value) {
    newbieTaskResetSocket.value.close()
  }

  const socket = new WebSocket(url)
  newbieTaskResetSocket.value = socket

  socket.addEventListener('open', () => {
    if (newbieTaskResetSocket.value !== socket) {
      return
    }
    newbieTaskResetSocketConnected.value = true
  })

  socket.addEventListener('message', (event) => {
    try {
      const payload = JSON.parse(event.data)
      applyNewbieTaskResetProgress(payload)
    } catch (error) {
      console.error('Failed to parse newbie task reset progress update', error)
    }
  })

  socket.addEventListener('error', (error) => {
    console.error('Newbie task reset websocket error', error)
    if (newbieTaskResetSocket.value === socket) {
      socket.close()
    }
  })

  socket.addEventListener('close', () => {
    if (newbieTaskResetSocket.value !== socket) {
      return
    }
    newbieTaskResetSocket.value = null
    newbieTaskResetSocketConnected.value = false
    scheduleNewbieTaskResetSocketReconnect()
  })
}

const handleResetNewbieTaskUserFlags = async () => {
  if (newbieTaskResetting.value) {
    return
  }
  try {
    newbieTaskResetTerminalSignature.value = ''
    newbieTaskResetting.value = true
    newbieTaskResetProgress.visible = true
    newbieTaskResetProgress.status = 'PENDING'
    newbieTaskResetProgress.total = 0
    newbieTaskResetProgress.processed = 0
    newbieTaskResetProgress.message = translateNewbieTaskReset('messages.resetStarted')
    newbieTaskResetProgress.updatedAt = new Date().toISOString()
    await resetNewbieTaskUserFlags()
    message.info(translateNewbieTaskReset('messages.resetStarted'))
  } catch (error) {
    console.error('Failed to reset newbie task user flags', error)
    if (error?.response?.status === 409) {
      newbieTaskResetting.value = true
      newbieTaskResetProgress.visible = true
      newbieTaskResetProgress.status = 'RUNNING'
      newbieTaskResetProgress.updatedAt = new Date().toISOString()
      newbieTaskResetProgress.message = translateNewbieTaskReset('messages.resetInProgress')
      message.info(translateNewbieTaskReset('messages.resetInProgress'))
      return
    }
    newbieTaskResetting.value = false
    newbieTaskResetProgress.status = 'FAILED'
    newbieTaskResetProgress.updatedAt = new Date().toISOString()
    newbieTaskResetProgress.message = extractErrorMessage(error, translateNewbieTaskReset('messages.resetFailed'))
    message.error(newbieTaskResetProgress.message)
  } finally {
    if (!newbieTaskResetSocket.value && newbieTaskResetSocketShouldReconnect) {
      openNewbieTaskResetSocket()
    }
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

const normalizeGuideTitle = (value) => String(value || '').trim()

const normalizeGuideEntry = (item) => {
  if (typeof item === 'string') {
    const url = item.trim()
    if (!url) return null
    return { url, title: '' }
  }
  if (item && typeof item === 'object') {
    const url = typeof item.url === 'string' ? item.url.trim() : ''
    if (!url) return null
    return {
      url,
      title: normalizeGuideTitle(item.title),
    }
  }
  return null
}

const normalizeGuideUrls = (urls = []) =>
  (urls || [])
    .map((item) => normalizeGuideEntry(item))
    .filter(Boolean)

const createGuideEntry = (url, title = '') => ({
  url: typeof url === 'string' ? url.trim() : '',
  title: normalizeGuideTitle(title),
})

const deriveGuideTitle = (file, url) => {
  const nameSource = file?.name || getDisplayFileName(url)
  const trimmed = normalizeGuideTitle(nameSource)
  if (!trimmed) return ''
  return trimmed.replace(/\.[^.]+$/, '')
}

const loadGuideUrls = async () => {
  guideLoading.value = true
  try {
    const data = await fetchGuideUrls()
    guideUrls.value = normalizeGuideUrls(data?.urls)
    guideUpdatedAt.value = data?.updatedAt || null
  } catch (error) {
    if (error?.response?.status === 404) {
      guideUrls.value = []
      guideUpdatedAt.value = null
      return
    }
    console.error('Failed to load guide urls', error)
    message.error(t('settings.system.guide.messages.loadFailed'))
  } finally {
    guideLoading.value = false
  }
}

const submitGuideUrls = async () => {
  if (guideSaving.value) {
    return
  }
  const urls = normalizeGuideUrls(guideUrls.value)
  if (!urls.length) {
    message.warning(t('settings.system.guide.messages.empty'))
    return
  }
  const missingTitleIndex = urls.findIndex((item) => !item.title)
  if (missingTitleIndex !== -1) {
    message.warning(t('settings.system.guide.messages.noTitle'))
    return
  }
  guideSaving.value = true
  try {
    await saveGuideUrls({ urls })
    message.success(t('settings.system.guide.messages.saveSuccess'))
    await loadGuideUrls()
  } catch (error) {
    console.error('Failed to save guide urls', error)
    message.error(t('settings.system.guide.messages.saveFailed'))
  } finally {
    guideSaving.value = false
  }
}

const handleGuideGifUpload = async (event) => {
  const files = Array.from(event?.target?.files || [])
  if (!files.length) {
    return
  }
  guideUploadLoading.value = true
  try {
    const uploaded = []
    for (const file of files) {
      const result = await uploadPublicFile(file)
      const url = result?.url || (result?.objectName ? buildDownloadUrl(result.objectName) : '')
      if (url) {
        const title = deriveGuideTitle(file, url)
        uploaded.push(createGuideEntry(url, title))
      }
    }
    if (uploaded.length) {
      guideUrls.value = [...guideUrls.value, ...uploaded]
      message.success(
        t('settings.system.guide.messages.uploadSuccess', { count: uploaded.length }),
      )
    } else {
      message.warning(t('settings.system.guide.messages.uploadEmpty'))
    }
  } catch (error) {
    console.error('Failed to upload guide gifs', error)
    message.error(t('settings.system.guide.messages.uploadFailed'))
  } finally {
    guideUploadLoading.value = false
    if (event?.target) {
      event.target.value = ''
    }
  }
}

const removeGuideUrl = (index) => {
  guideUrls.value.splice(index, 1)
}

const resetUserAgreementForm = () => {
  userAgreementForm.id = null
  userAgreementForm.version = ''
  userAgreementForm.content = ''
}

const resetPrivacyPolicyForm = () => {
  privacyPolicyForm.id = null
  privacyPolicyForm.version = ''
  privacyPolicyForm.content = ''
}

const loadUserAgreements = async () => {
  userAgreementLoading.value = true
  try {
    const data = await fetchUserAgreements()
    userAgreementList.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Failed to load user agreements', error)
    message.error(t('settings.system.userAgreement.messages.loadFailed'))
  } finally {
    userAgreementLoading.value = false
  }
}

const loadPrivacyPolicies = async () => {
  privacyPolicyLoading.value = true
  try {
    const data = await fetchPrivacyPolicies()
    privacyPolicyList.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Failed to load privacy policies', error)
    message.error(t('settings.system.privacyPolicy.messages.loadFailed'))
  } finally {
    privacyPolicyLoading.value = false
  }
}

const submitUserAgreement = async () => {
  if (userAgreementSaving.value) return
  const version = (userAgreementForm.version || '').trim()
  const content = (userAgreementForm.content || '').trim()
  if (!version) {
    message.warning(t('settings.system.userAgreement.messages.noVersion'))
    return
  }
  if (!hasRichContent(content)) {
    message.warning(t('settings.system.userAgreement.messages.noFile'))
    return
  }
  userAgreementSaving.value = true
  try {
    if (userAgreementForm.id) {
      await updateUserAgreement(userAgreementForm.id, { version, content })
      message.success(t('settings.system.userAgreement.messages.updateSuccess'))
    } else {
      await createUserAgreement({ version, content })
      message.success(t('settings.system.userAgreement.messages.createSuccess'))
    }
    resetUserAgreementForm()
    await loadUserAgreements()
  } catch (error) {
    console.error('Failed to save user agreement', error)
    message.error(t('settings.system.userAgreement.messages.saveFailed'))
  } finally {
    userAgreementSaving.value = false
  }
}

const submitPrivacyPolicy = async () => {
  if (privacyPolicySaving.value) return
  const version = (privacyPolicyForm.version || '').trim()
  const content = (privacyPolicyForm.content || '').trim()
  if (!version) {
    message.warning(t('settings.system.privacyPolicy.messages.noVersion'))
    return
  }
  if (!hasRichContent(content)) {
    message.warning(t('settings.system.privacyPolicy.messages.noFile'))
    return
  }
  privacyPolicySaving.value = true
  try {
    if (privacyPolicyForm.id) {
      await updatePrivacyPolicy(privacyPolicyForm.id, { version, content })
      message.success(t('settings.system.privacyPolicy.messages.updateSuccess'))
    } else {
      await createPrivacyPolicy({ version, content })
      message.success(t('settings.system.privacyPolicy.messages.createSuccess'))
    }
    resetPrivacyPolicyForm()
    await loadPrivacyPolicies()
  } catch (error) {
    console.error('Failed to save privacy policy', error)
    message.error(t('settings.system.privacyPolicy.messages.saveFailed'))
  } finally {
    privacyPolicySaving.value = false
  }
}

const editUserAgreement = (record) => {
  userAgreementForm.id = record?.id ?? null
  userAgreementForm.version = record?.version || ''
  userAgreementForm.content = record?.content || ''
}

const editPrivacyPolicy = (record) => {
  privacyPolicyForm.id = record?.id ?? null
  privacyPolicyForm.version = record?.version || ''
  privacyPolicyForm.content = record?.content || ''
}

const handleDownloadUserAgreementPdf = async (record) => {
  if (!record?.id || userAgreementPdfDownloadingId.value) return
  userAgreementPdfDownloadingId.value = record.id
  try {
    const response = await downloadUserAgreementPdf(record.id)
    const disposition = response?.headers?.['content-disposition'] || response?.headers?.['Content-Disposition']
    const filename =
      resolveFilenameFromDisposition(disposition) || resolvePdfFilename('user-agreement', record)
    const blob = new Blob([response?.data], { type: 'application/pdf' })
    triggerBlobDownload(blob, filename)
  } catch (error) {
    console.error('Failed to download user agreement pdf', error)
    message.error(t('settings.system.userAgreement.messages.downloadFailed'))
  } finally {
    userAgreementPdfDownloadingId.value = null
  }
}

const handleDownloadPrivacyPolicyPdf = async (record) => {
  if (!record?.id || privacyPolicyPdfDownloadingId.value) return
  privacyPolicyPdfDownloadingId.value = record.id
  try {
    const response = await downloadPrivacyPolicyPdf(record.id)
    const disposition = response?.headers?.['content-disposition'] || response?.headers?.['Content-Disposition']
    const filename =
      resolveFilenameFromDisposition(disposition) || resolvePdfFilename('privacy-policy', record)
    const blob = new Blob([response?.data], { type: 'application/pdf' })
    triggerBlobDownload(blob, filename)
  } catch (error) {
    console.error('Failed to download privacy policy pdf', error)
    message.error(t('settings.system.privacyPolicy.messages.downloadFailed'))
  } finally {
    privacyPolicyPdfDownloadingId.value = null
  }
}

const handleDeleteUserAgreement = (record) => {
  if (!record?.id) return
  Modal.confirm({
    title: t('settings.system.userAgreement.actions.deleteConfirmTitle'),
    content: t('settings.system.userAgreement.actions.deleteConfirmContent', {
      version: record?.version || '',
    }),
    okText: t('settings.system.userAgreement.actions.delete'),
    cancelText: t('settings.system.userAgreement.actions.cancel'),
    onOk: async () => {
      try {
        await deleteUserAgreement(record.id)
        message.success(t('settings.system.userAgreement.messages.deleteSuccess'))
        if (userAgreementForm.id === record.id) {
          resetUserAgreementForm()
        }
        await loadUserAgreements()
      } catch (error) {
        console.error('Failed to delete user agreement', error)
        message.error(t('settings.system.userAgreement.messages.deleteFailed'))
      }
    },
  })
}

const handleDeletePrivacyPolicy = (record) => {
  if (!record?.id) return
  Modal.confirm({
    title: t('settings.system.privacyPolicy.actions.deleteConfirmTitle'),
    content: t('settings.system.privacyPolicy.actions.deleteConfirmContent', {
      version: record?.version || '',
    }),
    okText: t('settings.system.privacyPolicy.actions.delete'),
    cancelText: t('settings.system.privacyPolicy.actions.cancel'),
    onOk: async () => {
      try {
        await deletePrivacyPolicy(record.id)
        message.success(t('settings.system.privacyPolicy.messages.deleteSuccess'))
        if (privacyPolicyForm.id === record.id) {
          resetPrivacyPolicyForm()
        }
        await loadPrivacyPolicies()
      } catch (error) {
        console.error('Failed to delete privacy policy', error)
        message.error(t('settings.system.privacyPolicy.messages.deleteFailed'))
      }
    },
  })
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

const loadPosterServiceVersion = async () => {
  posterServiceVersionLoading.value = true
  try {
    const data = await fetchPosterServiceVersion()
    posterServiceVersion.value = data?.version || ''
  } catch (error) {
    if (error?.response?.status !== 404) {
      console.error('Failed to load poster service version', error)
      message.error(t('settings.system.posterService.messages.loadFailed'))
    }
    posterServiceVersion.value = ''
  } finally {
    posterServiceVersionLoading.value = false
  }
}

const handleRefreshPosterServiceVersion = async () => {
  if (posterServiceVersionRefreshing.value) return
  posterServiceVersionRefreshing.value = true
  try {
    const data = await refreshPosterServiceVersion()
    posterServiceVersion.value = data?.version || ''
    message.success(t('settings.system.posterService.messages.refreshSuccess'))
  } catch (error) {
    console.error('Failed to refresh poster service version', error)
    message.error(t('settings.system.posterService.messages.refreshFailed'))
  } finally {
    posterServiceVersionRefreshing.value = false
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

const loadEasterEggResourceConfig = async () => {
  easterEggResourceLoading.value = true
  try {
    const data = await fetchEasterEggResourceConfig()
    easterEggResourceConfig.fileName = extractObjectName(data?.fileName || '')
    easterEggResourceConfig.version = data?.version || ''
  } catch (error) {
    if (error?.response?.status !== 404) {
      console.error('Failed to load easter egg resource config', error)
      message.error(t('settings.system.easterEggResource.messages.loadFailed'))
    }
    easterEggResourceConfig.fileName = ''
    easterEggResourceConfig.version = ''
  } finally {
    easterEggResourceLoading.value = false
    resetEasterEggResourceForm(easterEggResourceConfig.version)
  }
}

const handleEasterEggResourceSelect = (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return
  easterEggResourceSelected.value = file
  easterEggResourceForm.fileName = file.name || ''
  if (!easterEggResourceForm.version) {
    easterEggResourceForm.version = getNextFontVersion(easterEggResourceConfig.version)
  }
  if (event?.target) {
    event.target.value = ''
  }
}

const clearEasterEggResourceSelection = () => {
  easterEggResourceSelected.value = null
  easterEggResourceForm.fileName = ''
}

const submitEasterEggResourceForm = async () => {
  if (!easterEggResourceSelected.value) {
    message.warning(t('settings.system.easterEggResource.messages.noFile'))
    return
  }
  const version = (easterEggResourceForm.version || '').trim()
  if (!version) {
    message.warning(t('settings.system.easterEggResource.messages.noVersion'))
    return
  }
  if (easterEggResourceSaving.value) {
    return
  }
  easterEggResourceSaving.value = true
  try {
    await uploadEasterEggResourceConfig(easterEggResourceSelected.value, version)
    message.success(t('settings.system.easterEggResource.messages.uploadSuccess'))
    await loadEasterEggResourceConfig()
  } catch (error) {
    console.error('Failed to upload easter egg resource package', error)
    message.error(t('settings.system.easterEggResource.messages.uploadFailed'))
  } finally {
    easterEggResourceSaving.value = false
  }
}

const loadProvinceCityKmlZipConfig = async () => {
  provinceCityKmlZipLoading.value = true
  try {
    const data = await fetchProvinceCityKmlZipConfig()
    provinceCityKmlZipConfig.fileName = extractObjectName(data?.fileName || '')
    provinceCityKmlZipConfig.version = data?.version || ''
  } catch (error) {
    if (error?.response?.status !== 404) {
      console.error('Failed to load province city kml zip config', error)
      message.error(t('settings.system.provinceCityKmlZip.messages.loadFailed'))
    }
    provinceCityKmlZipConfig.fileName = ''
    provinceCityKmlZipConfig.version = ''
  } finally {
    provinceCityKmlZipLoading.value = false
    resetProvinceCityKmlZipForm(provinceCityKmlZipConfig.version)
  }
}

const loadCountyKmlZipConfig = async () => {
  countyKmlZipLoading.value = true
  try {
    const data = await fetchCountyKmlZipConfig()
    countyKmlZipConfig.fileName = extractObjectName(data?.fileName || '')
    countyKmlZipConfig.version = data?.version || ''
  } catch (error) {
    if (error?.response?.status !== 404) {
      console.error('Failed to load county kml zip config', error)
      message.error(t('settings.system.countyKmlZip.messages.loadFailed'))
    }
    countyKmlZipConfig.fileName = ''
    countyKmlZipConfig.version = ''
  } finally {
    countyKmlZipLoading.value = false
    resetCountyKmlZipForm(countyKmlZipConfig.version)
  }
}

const handleProvinceCityKmlZipSelect = (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return
  provinceCityKmlZipSelected.value = file
  provinceCityKmlZipForm.fileName = file.name || ''
  if (!provinceCityKmlZipForm.version) {
    provinceCityKmlZipForm.version = getNextFontVersion(provinceCityKmlZipConfig.version)
  }
  if (event?.target) {
    event.target.value = ''
  }
}

const clearProvinceCityKmlZipSelection = () => {
  provinceCityKmlZipSelected.value = null
  provinceCityKmlZipForm.fileName = ''
}

const handleCountyKmlZipSelect = (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return
  countyKmlZipSelected.value = file
  countyKmlZipForm.fileName = file.name || ''
  if (!countyKmlZipForm.version) {
    countyKmlZipForm.version = getNextFontVersion(countyKmlZipConfig.version)
  }
  if (event?.target) {
    event.target.value = ''
  }
}

const clearCountyKmlZipSelection = () => {
  countyKmlZipSelected.value = null
  countyKmlZipForm.fileName = ''
}

const submitProvinceCityKmlZipForm = async () => {
  if (!provinceCityKmlZipSelected.value) {
    message.warning(t('settings.system.provinceCityKmlZip.messages.noFile'))
    return
  }
  const version = (provinceCityKmlZipForm.version || '').trim()
  if (!version) {
    message.warning(t('settings.system.provinceCityKmlZip.messages.noVersion'))
    return
  }
  if (provinceCityKmlZipSaving.value) {
    return
  }
  provinceCityKmlZipSaving.value = true
  try {
    await uploadProvinceCityKmlZipConfig(provinceCityKmlZipSelected.value, version)
    message.success(t('settings.system.provinceCityKmlZip.messages.uploadSuccess'))
    await loadProvinceCityKmlZipConfig()
  } catch (error) {
    console.error('Failed to upload province city kml zip package', error)
    message.error(t('settings.system.provinceCityKmlZip.messages.uploadFailed'))
  } finally {
    provinceCityKmlZipSaving.value = false
  }
}

const submitCountyKmlZipForm = async () => {
  if (!countyKmlZipSelected.value) {
    message.warning(t('settings.system.countyKmlZip.messages.noFile'))
    return
  }
  const version = (countyKmlZipForm.version || '').trim()
  if (!version) {
    message.warning(t('settings.system.countyKmlZip.messages.noVersion'))
    return
  }
  if (countyKmlZipSaving.value) {
    return
  }
  countyKmlZipSaving.value = true
  try {
    await uploadCountyKmlZipConfig(countyKmlZipSelected.value, version)
    message.success(t('settings.system.countyKmlZip.messages.uploadSuccess'))
    await loadCountyKmlZipConfig()
  } catch (error) {
    console.error('Failed to upload county kml zip package', error)
    message.error(t('settings.system.countyKmlZip.messages.uploadFailed'))
  } finally {
    countyKmlZipSaving.value = false
  }
}

const loadSuitableFlyZoneKmzInfos = async () => {
  suitableFlyZoneKmzLoading.value = true
  try {
    const data = await fetchAdminSuitableFlyZoneKmzInfos()
    suitableFlyZoneKmzList.value = Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Failed to load suitable fly zone kmz infos', error)
    message.error(t('settings.areaSettings.suitableFlyZone.messages.loadFailed'))
  } finally {
    suitableFlyZoneKmzLoading.value = false
  }
}

const loadKmlDecryptAesKeyConfig = async () => {
  kmlDecryptAesKeyLoading.value = true
  try {
    const data = await fetchKmlDecryptAesKeyConfig()
    resetKmlDecryptAesKeyForm(data?.aesKey || '')
  } catch (error) {
    if (error?.response?.status !== 404) {
      console.error('Failed to load KML decrypt AES key config', error)
      message.error(t('settings.areaSettings.kmlDecryptAes.messages.loadFailed'))
    }
    resetKmlDecryptAesKeyForm('')
  } finally {
    kmlDecryptAesKeyLoading.value = false
  }
}

const handleSuitableFlyZoneKmzSelect = (event) => {
  const file = event?.target?.files?.[0]
  if (!file) return
  suitableFlyZoneKmzSelected.value = file
  suitableFlyZoneKmzForm.fileName = file.name || ''
  if (event?.target) {
    event.target.value = ''
  }
}

const clearSuitableFlyZoneKmzSelection = () => {
  suitableFlyZoneKmzSelected.value = null
  suitableFlyZoneKmzForm.fileName = ''
}

const submitKmlDecryptAesKeyForm = async () => {
  const aesKey = String(kmlDecryptAesKeyForm.aesKey || '').trim()
  if (!aesKey) {
    message.warning(t('settings.areaSettings.kmlDecryptAes.messages.noAesKey'))
    return
  }
  if (kmlDecryptAesKeySaving.value) {
    return
  }

  kmlDecryptAesKeySaving.value = true
  try {
    await saveKmlDecryptAesKeyConfig({ aesKey })
    resetKmlDecryptAesKeyForm(aesKey)
    message.success(t('settings.areaSettings.kmlDecryptAes.messages.saveSuccess'))
  } catch (error) {
    console.error('Failed to save KML decrypt AES key config', error)
    message.error(t('settings.areaSettings.kmlDecryptAes.messages.saveFailed'))
  } finally {
    kmlDecryptAesKeySaving.value = false
  }
}

const submitSuitableFlyZoneKmzForm = async () => {
  const name = suitableFlyZoneKmzForm.name.trim()
  const version = suitableFlyZoneKmzForm.version.trim()
  const description = suitableFlyZoneKmzForm.description.trim()

  if (!name) {
    message.warning(t('settings.areaSettings.suitableFlyZone.messages.noName'))
    return
  }
  if (!version) {
    message.warning(t('settings.areaSettings.suitableFlyZone.messages.noVersion'))
    return
  }
  if (!suitableFlyZoneKmzSelected.value) {
    message.warning(t('settings.areaSettings.suitableFlyZone.messages.noFile'))
    return
  }
  if (!description) {
    message.warning(t('settings.areaSettings.suitableFlyZone.messages.noDescription'))
    return
  }
  if (suitableFlyZoneKmzSaving.value) {
    return
  }

  suitableFlyZoneKmzSaving.value = true
  try {
    const uploadResult = await uploadPublicFile(suitableFlyZoneKmzSelected.value)
    const attachmentName = uploadResult?.objectName || extractObjectName(uploadResult?.url || '') || ''
    if (!attachmentName) {
      throw new Error('Suitable fly zone KMZ upload returned empty objectName')
    }

    await createSuitableFlyZoneKmzInfo({
      name,
      version,
      attachmentName,
      description,
    })

    message.success(t('settings.areaSettings.suitableFlyZone.messages.saveSuccess'))
    resetSuitableFlyZoneKmzForm()
    await loadSuitableFlyZoneKmzInfos()
  } catch (error) {
    console.error('Failed to create suitable fly zone kmz info', error)
    message.error(t('settings.areaSettings.suitableFlyZone.messages.saveFailed'))
  } finally {
    suitableFlyZoneKmzSaving.value = false
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

const loadLadderLeaderboard = async () => {
  ladderLeaderboardLoading.value = true
  try {
    const { content, totalElements, page, size } = await fetchLadderGameAdminLeaderboard({
      page: ladderLeaderboardPagination.current,
      size: ladderLeaderboardPagination.pageSize,
    })
    ladderLeaderboard.value = (content || []).map((item) => ({
      ...item,
      avatarUrl: resolveProfileAsset(item?.avatarUrl),
    }))
    ladderLeaderboardPagination.total = totalElements
    ladderLeaderboardPagination.current = page
    ladderLeaderboardPagination.pageSize = size
  } catch (error) {
    console.error('Failed to load ladder leaderboard', error)
    message.error(t('settings.system.ladderLeaderboard.messages.loadFailed'))
  } finally {
    ladderLeaderboardLoading.value = false
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

const handleLadderLeaderboardTableChange = (pager) => {
  ladderLeaderboardPagination.current = pager?.current ?? 1
  ladderLeaderboardPagination.pageSize = pager?.pageSize ?? ladderLeaderboardPagination.pageSize
  loadLadderLeaderboard()
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
  reportEntryForm.cityDescription = ''
  reportEntryForm.doubleReported = false
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
    reportEntryForm.cityDescription = entry?.cityDescription || ''
    reportEntryForm.doubleReported = Boolean(entry?.doubleReported)
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
      cityDescription: reportEntryForm.cityDescription.trim() || null,
      county: region.county,
      doubleReported: Boolean(reportEntryForm.doubleReported),
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
      const saved = await updateReportEntry(reportEntryEditingId.value, nextPayload)
      const merged = mergeReportEntryPayload(nextPayload, saved)
      const updated = updateReportEntryInList(reportEntryEditingId.value, (current) => ({
        ...current,
        ...merged,
        id: merged.id ?? current.id,
      }))
      if (updated) selectReportEntry(updated)
      message.success(t('settings.reportEntry.messages.updateSuccess'))
    } else {
      const saved = await createReportEntry(nextPayload)
      const merged = mergeReportEntryPayload(nextPayload, saved)
      if (!merged?.id) {
        throw new Error('Missing report entry id')
      }
      const newEntry = {
        id: merged.id,
        ...merged,
      }
      reportEntryList.value.unshift(newEntry)
      reportEntryEditingId.value = newEntry.id
      selectReportEntry(newEntry)
      message.success(t('settings.reportEntry.messages.createSuccess'))
    }
    reportEntryDrawerVisible.value = false
    await loadReportEntries()
  } catch (error) {
    console.error('Failed to save report entry', error)
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
    message.success(t('settings.reportEntry.messages.saveSuccess'))
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
        await deleteReportEntry(entry.id)
        reportEntryList.value = reportEntryList.value.filter((item) => item.id !== entry.id)
        if (reportEntrySelectedId.value === entry.id) reportEntrySelectedId.value = null
        message.success(t('settings.reportEntry.messages.deleteSuccess'))
        await loadReportEntries()
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

const ladderLeaderboardPaginationConfig = computed(() => ({
  current: ladderLeaderboardPagination.current,
  pageSize: ladderLeaderboardPagination.pageSize,
  total: ladderLeaderboardPagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total, range) =>
    t('settings.system.ladderLeaderboard.pagination.total', {
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

watch(
  tencentCosAvailableBuckets,
  (buckets) => {
    if (!Array.isArray(buckets) || !buckets.length) {
      tencentCosTestForm.bucket = ''
      return
    }
    if (!buckets.includes(tencentCosTestForm.bucket)) {
      tencentCosTestForm.bucket = buckets[0]
    }
  },
  { immediate: true },
)

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
  loadTencentCosConfig()
  loadMemberNoAdsConfig()
  loadAdLastCrowdRecord()
  loadCopyContent()
  loadPaymentConfig()
  loadWeappConfig()
  loadTemplateSettings()
  loadNewbieTaskTemplate()
  loadNewbieTaskStats()
  loadGuideUrls()
  loadUserAgreements()
  loadPrivacyPolicies()
  loadFontFileConfig()
  loadPosterServiceVersion()
  loadEasterEggResourceConfig()
  loadProvinceCityKmlZipConfig()
  loadCountyKmlZipConfig()
  loadSuitableFlyZoneKmzInfos()
  loadKmlDecryptAesKeyConfig()
  loadLadderLeaderboard()
  loadLotteryConfig()
  loadLotteryLogs()
  loadCheckinLogs()
  loadReportEntries()
  loadReportEntryDialogText()
  openNewbieTaskResetSocket()
})

onBeforeUnmount(() => {
  closeNewbieTaskResetSocket()
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
                  <a-button type="default" @click="loadMapConfig" :disabled="mapLoading || mapSaving || mapLongImageSaving">
                    {{ t('common.actions.reset') }}
                  </a-button>
                </div>
              </a-form>

              <a-form :model="mapForm" layout="vertical" @finish="submitMapLongImageForm">
                <a-row :gutter="[24, 12]">
                  <a-col :xs="24" :md="24">
                    <a-form-item name="longImageUrl" :label="t('settings.mapSettlement.form.longImageUrl')">
                      <div class="lottery-upload">
                        <label class="lottery-upload__trigger">
                          <input class="lottery-upload__input" type="file" accept="image/*"
                            :disabled="mapLongImageUploading || mapLongImageSaving" @change="handleMapLongImageUpload" />
                          <a-button type="dashed" :loading="mapLongImageUploading">
                            {{ mapForm.longImageUrl
                              ? t('settings.mapSettlement.actions.uploadReplace')
                              : t('settings.mapSettlement.actions.upload') }}
                          </a-button>
                        </label>
                        <span v-if="mapForm.longImageUrl" class="lottery-upload__name">
                          {{ mapForm.longImageUrl }}
                        </span>
                        <a-button v-if="mapForm.longImageUrl" type="link" danger size="small"
                          @click="clearMapLongImage">
                          {{ t('settings.mapSettlement.actions.remove') }}
                        </a-button>
                      </div>
                    </a-form-item>
                  </a-col>
                </a-row>
                <div class="actions">
                  <a-button type="primary" html-type="submit" :loading="mapLongImageSaving"
                    :disabled="mapLongImageUploading">
                    {{ t('common.actions.save') }}
                  </a-button>
                  <a-button type="default" @click="loadMapConfig"
                    :disabled="mapLoading || mapSaving || mapLongImageSaving || mapLongImageUploading">
                    {{ t('common.actions.reset') }}
                  </a-button>
                </div>
              </a-form>
            </a-spin>
          </div>
        </a-tab-pane>

        <a-tab-pane key="tencent-cos" :tab="t('settings.tabs.tencentCos')">
          <div class="tab-section">
            <section class="system-settings">
              <header class="section-header">
                <div>
                  <h3>{{ t('settings.system.tencentCos.title') }}</h3>
                  <p>{{ t('settings.system.tencentCos.subtitle') }}</p>
                </div>
                <div class="actions actions--inline">
                  <div class="system-settings__meta">
                    <span class="system-settings__meta-label">
                      {{ t('settings.system.tencentCos.configuredLabel') }}
                    </span>
                    <a-tag :color="tencentCosConfigured ? 'green' : 'default'">
                      {{ tencentCosConfiguredText }}
                    </a-tag>
                  </div>
                  <a-button type="default" @click="loadTencentCosConfig"
                    :disabled="tencentCosLoading || tencentCosSaving">
                    {{ t('settings.system.tencentCos.actions.reload') }}
                  </a-button>
                </div>
              </header>

              <a-spin :spinning="tencentCosLoading">
                <a-form layout="vertical" :model="tencentCosForm" @finish="submitTencentCosConfig">
                  <a-row :gutter="[24, 12]">
                    <a-col :xs="24" :md="12">
                      <a-form-item :label="t('settings.system.tencentCos.fields.secretId')">
                        <a-input v-model:value="tencentCosForm.secretId"
                          :placeholder="t('settings.system.tencentCos.placeholders.secretId')" allow-clear />
                      </a-form-item>
                    </a-col>
                    <a-col :xs="24" :md="12">
                      <a-form-item :label="t('settings.system.tencentCos.fields.secretKey')">
                        <a-input-password v-model:value="tencentCosForm.secretKey"
                          :placeholder="t('settings.system.tencentCos.placeholders.secretKey')" allow-clear />
                        <div class="system-font-helper">{{ t('settings.system.tencentCos.secretKeyHint') }}</div>
                      </a-form-item>
                    </a-col>
                    <a-col :xs="24" :md="12">
                      <a-form-item :label="t('settings.system.tencentCos.fields.region')">
                        <a-input v-model:value="tencentCosForm.region"
                          :placeholder="t('settings.system.tencentCos.placeholders.region')" allow-clear />
                      </a-form-item>
                    </a-col>
                    <a-col :xs="24" :md="12">
                      <a-form-item :label="t('settings.system.tencentCos.fields.durationSeconds')">
                        <a-input-number v-model:value="tencentCosForm.durationSeconds" :min="0" :step="1"
                          style="width: 100%" :placeholder="t('settings.system.tencentCos.placeholders.durationSeconds')" />
                      </a-form-item>
                    </a-col>
                    <a-col :xs="24" :md="12">
                      <a-form-item :label="t('settings.system.tencentCos.fields.roleArn')">
                        <a-input v-model:value="tencentCosForm.roleArn"
                          :placeholder="t('settings.system.tencentCos.placeholders.roleArn')" allow-clear />
                      </a-form-item>
                    </a-col>
                    <a-col :xs="24" :md="12">
                      <a-form-item :label="t('settings.system.tencentCos.fields.roleSessionName')">
                        <a-input v-model:value="tencentCosForm.roleSessionName"
                          :placeholder="t('settings.system.tencentCos.placeholders.roleSessionName')" allow-clear />
                      </a-form-item>
                    </a-col>
                    <a-col :span="24">
                      <a-form-item :label="t('settings.system.tencentCos.fields.buckets')">
                        <a-textarea v-model:value="tencentCosForm.bucketsText" :rows="6"
                          :placeholder="t('settings.system.tencentCos.placeholders.buckets')" />
                        <div class="system-font-helper">{{ t('settings.system.tencentCos.bucketHint') }}</div>
                      </a-form-item>
                    </a-col>
                  </a-row>
                  <div class="actions">
                    <a-button type="primary" html-type="submit" :loading="tencentCosSaving">
                      {{ t('settings.system.tencentCos.actions.save') }}
                    </a-button>
                    <a-button type="default" @click="loadTencentCosConfig"
                      :disabled="tencentCosLoading || tencentCosSaving">
                      {{ t('settings.system.tencentCos.actions.reload') }}
                    </a-button>
                  </div>
                </a-form>
              </a-spin>
            </section>

            <section class="system-settings">
              <header class="section-header">
                <div>
                  <h3>{{ t('settings.system.tencentCos.test.title') }}</h3>
                  <p>{{ t('settings.system.tencentCos.test.subtitle') }}</p>
                </div>
                <div class="actions actions--inline">
                  <div class="system-settings__meta">
                    <span class="system-settings__meta-label">
                      {{ t('settings.system.tencentCos.test.labels.stsStatus') }}
                    </span>
                    <a-tag :color="tencentCosStsFetched ? 'green' : 'default'">
                      {{
                        tencentCosStsFetched
                          ? t('settings.system.tencentCos.test.stsReady')
                          : t('settings.system.tencentCos.test.stsIdle')
                      }}
                    </a-tag>
                  </div>
                  <a-button type="primary" @click="loadTencentCosSts({ force: true })"
                    :loading="tencentCosStsLoading">
                    {{ t('settings.system.tencentCos.test.actions.fetchSts') }}
                  </a-button>
                </div>
              </header>

              <a-descriptions :column="2" bordered size="small">
                <a-descriptions-item :label="t('settings.system.tencentCos.test.labels.region')">
                  {{ tencentCosStsRegionText }}
                </a-descriptions-item>
                <a-descriptions-item :label="t('settings.system.tencentCos.test.labels.expiration')">
                  {{ tencentCosStsExpirationText }}
                </a-descriptions-item>
                <a-descriptions-item :label="t('settings.system.tencentCos.test.labels.buckets')" :span="2">
                  <span v-if="tencentCosAvailableBuckets.length">{{ tencentCosAvailableBuckets.join(', ') }}</span>
                  <span v-else class="empty-hint">{{ t('settings.system.tencentCos.test.emptyValue') }}</span>
                </a-descriptions-item>
              </a-descriptions>

              <a-form layout="vertical" :model="tencentCosTestForm">
                <a-row :gutter="[24, 12]">
                  <a-col :xs="24" :md="12">
                    <a-form-item :label="t('settings.system.tencentCos.test.fields.bucket')">
                      <a-select v-model:value="tencentCosTestForm.bucket"
                        :options="tencentCosAvailableBuckets.map((item) => ({ label: item, value: item }))"
                        :placeholder="t('settings.system.tencentCos.test.placeholders.bucket')"
                        :disabled="!tencentCosAvailableBuckets.length" show-search allow-clear />
                    </a-form-item>
                  </a-col>
                  <a-col :xs="24" :md="12">
                    <a-form-item :label="t('settings.system.tencentCos.test.fields.uploadKey')">
                      <a-input v-model:value="tencentCosTestForm.uploadKey"
                        :placeholder="t('settings.system.tencentCos.test.placeholders.uploadKey')" allow-clear />
                    </a-form-item>
                  </a-col>
                  <a-col :span="24">
                    <a-form-item :label="t('settings.system.tencentCos.test.fields.file')">
                      <div class="system-font-upload">
                        <label class="system-font-upload__trigger">
                          <input class="system-font-upload__input" type="file"
                            :disabled="tencentCosUploadTesting || tencentCosDownloadTesting"
                            @change="handleTencentCosTestFileChange" />
                          <a-button type="dashed" :loading="tencentCosUploadTesting">
                            {{
                              tencentCosSelectedFile
                                ? t('settings.system.tencentCos.test.actions.replaceFile')
                                : t('settings.system.tencentCos.test.actions.selectFile')
                            }}
                          </a-button>
                        </label>
                        <span v-if="tencentCosSelectedFile" class="system-font-upload__name">
                          {{ tencentCosSelectedFile.name }}
                        </span>
                        <a-button v-if="tencentCosSelectedFile" type="link" danger size="small"
                          @click="clearTencentCosTestFile">
                          {{ t('settings.system.tencentCos.test.actions.removeFile') }}
                        </a-button>
                      </div>
                    </a-form-item>
                  </a-col>
                </a-row>
                <div v-if="tencentCosUploadTesting || tencentCosUploadProgress" class="cos-test-progress">
                  <a-progress :percent="tencentCosUploadProgress" size="small" />
                </div>
                <div class="actions">
                  <a-button type="primary" :loading="tencentCosUploadTesting" @click="submitTencentCosUploadTest">
                    {{ t('settings.system.tencentCos.test.actions.uploadTest') }}
                  </a-button>
                </div>
              </a-form>

              <a-form layout="vertical" :model="tencentCosTestForm">
                <a-row :gutter="[24, 12]">
                  <a-col :span="24">
                    <a-form-item :label="t('settings.system.tencentCos.test.fields.downloadKey')">
                      <a-input v-model:value="tencentCosTestForm.downloadKey"
                        :placeholder="t('settings.system.tencentCos.test.placeholders.downloadKey')" allow-clear />
                    </a-form-item>
                  </a-col>
                </a-row>
                <div class="actions">
                  <a-button type="primary" ghost :loading="tencentCosDownloadTesting" @click="runTencentCosDownloadTest">
                    {{ t('settings.system.tencentCos.test.actions.downloadTest') }}
                  </a-button>
                </div>
              </a-form>

              <div class="cos-test-result">
                <div class="system-settings__meta">
                  <span class="system-settings__meta-label">
                    {{ t('settings.system.tencentCos.test.labels.lastUploadedKey') }}
                  </span>
                  <span class="system-settings__meta-value">
                    {{ tencentCosTestResult.uploadedKey || t('settings.system.tencentCos.test.emptyValue') }}
                  </span>
                </div>
                <div class="system-settings__meta">
                  <span class="system-settings__meta-label">
                    {{ t('settings.system.tencentCos.test.labels.lastDownloadedAt') }}
                  </span>
                  <span class="system-settings__meta-value">
                    {{ tencentCosTestResult.downloadedAt || t('settings.system.tencentCos.test.emptyValue') }}
                  </span>
                </div>
                <div v-if="tencentCosTestResult.uploadedUrl" class="system-settings__meta">
                  <span class="system-settings__meta-label">
                    {{ t('settings.system.tencentCos.test.labels.uploadedUrl') }}
                  </span>
                  <a :href="tencentCosTestResult.uploadedUrl" target="_blank" rel="noreferrer">
                    {{ tencentCosTestResult.uploadedUrl }}
                  </a>
                </div>
              </div>
            </section>
          </div>
        </a-tab-pane>

        <a-tab-pane key="ad-settings" :tab="t('settings.tabs.adSettings')">
          <div class="tab-section">
            <section class="ad-settings">
              <header class="section-header">
                <div>
                  <h3>{{ t('settings.adSettings.title') }}</h3>
                  <p>{{ t('settings.adSettings.subtitle') }}</p>
                </div>
                <div class="actions">
                  <a-button type="default" :loading="memberNoAdsLoading || adLastCrowdLoading"
                    :disabled="memberNoAdsSaving || adSyncing" @click="reloadAdSettings">
                    {{ t('settings.adSettings.actions.reload') }}
                  </a-button>
                  <a-button type="primary" :loading="adSyncing" :disabled="memberNoAdsLoading || memberNoAdsSaving"
                    @click="handleAdSyncNow">
                    {{ t('settings.adSettings.actions.syncNow') }}
                  </a-button>
                </div>
              </header>

              <a-spin :spinning="memberNoAdsLoading || adLastCrowdLoading">
                <a-form :model="memberNoAdsForm" :rules="memberNoAdsRules" layout="vertical"
                  class="ad-settings__config" @finish="submitMemberNoAdsForm">
                  <div class="ad-settings__config-main">
                    <a-form-item name="threshold" :label="t('settings.adSettings.form.threshold')"
                      class="ad-settings__form-item">
                      <a-input-number v-model:value="memberNoAdsForm.threshold" :min="0" :step="1" :precision="0"
                        :placeholder="t('settings.adSettings.form.placeholder')" class="ad-settings__status-input" />
                    </a-form-item>
                    <p class="ad-settings__helper">{{ t('settings.adSettings.form.helper') }}</p>
                  </div>
                  <div class="ad-settings__config-side">
                    <span class="ad-settings__side-label">{{ t('settings.adSettings.stats.currentThreshold') }}</span>
                    <strong>{{ formatMemberNoAdsStatus(memberNoAdsForm.threshold) }}</strong>
                    <div class="actions actions--inline ad-settings__form-actions">
                      <a-button type="primary" html-type="submit" :loading="memberNoAdsSaving">
                        {{ t('common.actions.save') }}
                      </a-button>
                      <a-button type="default" @click="loadMemberNoAdsConfig"
                        :disabled="memberNoAdsLoading || memberNoAdsSaving">
                        {{ t('common.actions.reset') }}
                      </a-button>
                    </div>
                  </div>
                </a-form>

                <div class="ad-settings__stats">
                  <div class="ad-stat-card">
                    <span class="ad-stat-card__label">{{ t('settings.adSettings.stats.currentThreshold') }}</span>
                    <span class="ad-stat-card__value ad-stat-card__value--small">
                      {{ formatMemberNoAdsStatus(memberNoAdsForm.threshold) }}
                    </span>
                  </div>
                  <div class="ad-stat-card">
                    <span class="ad-stat-card__label">{{ t('settings.adSettings.stats.lastSyncTime') }}</span>
                    <span class="ad-stat-card__value ad-stat-card__value--small">{{ adLastExecutedAtDisplay }}</span>
                  </div>
                  <div class="ad-stat-card">
                    <span class="ad-stat-card__label">{{ t('settings.adSettings.stats.lastSyncMembers') }}</span>
                    <span class="ad-stat-card__value">{{ adLastCrowdCount }}</span>
                  </div>
                  <div class="ad-stat-card">
                    <span class="ad-stat-card__label">{{ t('settings.adSettings.stats.lastSyncStatus') }}</span>
                    <span class="ad-stat-card__value ad-stat-card__value--small">{{ adLastRecordStatusText }}</span>
                  </div>
                </div>

                <section class="ad-settings__record">
                  <div class="ad-settings__record-header">
                    <h4>{{ t('settings.adSettings.record.title') }}</h4>
                    <a-tag :color="adLastRecordStatusColor">{{ adLastRecordStatusText }}</a-tag>
                  </div>
                  <a-descriptions size="small" :column="2" bordered>
                    <a-descriptions-item :label="t('settings.adSettings.record.executedAt')">
                      {{ adLastExecutedAtDisplay }}
                    </a-descriptions-item>
                    <a-descriptions-item :label="t('settings.adSettings.record.threshold')">
                      {{ formatMemberNoAdsStatus(adLastCrowdRecord?.threshold) }}
                    </a-descriptions-item>
                    <a-descriptions-item :label="t('settings.adSettings.record.crowdName')">
                      {{ adLastCrowdRecord?.crowdName || '-' }}
                    </a-descriptions-item>
                    <a-descriptions-item :label="t('settings.adSettings.record.crowdId')">
                      {{ adLastCrowdRecord?.crowdId || '-' }}
                    </a-descriptions-item>
                    <a-descriptions-item :label="t('settings.adSettings.record.mediaId')">
                      {{ adLastCrowdRecord?.mediaId || '-' }}
                    </a-descriptions-item>
                    <a-descriptions-item :label="t('settings.adSettings.record.totalOpenidCount')">
                      {{ adLastCrowdCount }}
                    </a-descriptions-item>
                  </a-descriptions>
                  <a-alert v-if="adLastCrowdRecord?.errorMessage" type="error" show-icon
                    :message="adLastCrowdRecord.errorMessage" class="ad-settings__error" />
                </section>

                <section class="ad-settings__members">
                  <h4>{{ t('settings.adSettings.table.title') }}</h4>
                  <a-table :columns="adMemberColumns" :data-source="adCrowdMembers"
                    :pagination="{ pageSize: 10, hideOnSinglePage: true }" row-key="rowKey" size="small" bordered
                    :scroll="{ x: 980 }">
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.key === 'avatar'">
                        <a-avatar :src="record?.avatarUrl" :alt="record?.username" />
                      </template>
                      <template v-if="column.key === 'userCreatedAt'">
                        {{ record?.userCreatedAt ? new Date(record.userCreatedAt).toLocaleString() : '-' }}
                      </template>
                      <template v-else-if="column.key === 'status'">
                        {{ record?.status || '-' }}
                      </template>
                    </template>
                  </a-table>
                </section>
              </a-spin>
            </section>
          </div>
        </a-tab-pane>

        <a-tab-pane key="copy-settings" :tab="t('settings.tabs.copySettings')">
          <div class="tab-section">
            <a-spin :spinning="copyLoading">
              <a-form :model="copyForm" layout="vertical" @finish="submitCopyForm">
                <a-form-item :label="t('settings.copySettings.form.type')">
                  <a-radio-group v-model:value="copyType" :disabled="copyLoading || copySaving">
                    <div v-for="group in copyTypeGroups" :key="group.key" class="copy-type-group">
                      <div class="copy-type-group__title">{{ group.title }}</div>
                      <div class="copy-type-group__options">
                        <a-radio v-for="option in group.options" :key="option.value" :value="option.value">
                          {{ option.label }}
                        </a-radio>
                      </div>
                    </div>
                  </a-radio-group>
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
                <a-form-item name="content" :label="t('settings.copySettings.form.content')">
                  <open-platform-editor v-model="copyForm.content"
                    :placeholder="t('settings.copySettings.form.placeholder')" :disabled="copyLoading || copySaving" />
                </a-form-item>
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

        <a-tab-pane key="member-settings" :tab="t('settings.tabs.memberSettings')">
          <MemberSettingsView />
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
                  <a-col :xs="24" :md="12">
                    <a-form-item name="mapKey" :label="t('settings.weapp.mapKey')">
                      <a-input v-model:value="weappForm.mapKey" :placeholder="t('settings.weapp.placeholders.mapKey')"
                        allow-clear />
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
                        <div class="newbie-task-title-row">
                          <h3>{{ t('settings.newbieTasks.template.title') }}</h3>
                          <a-popconfirm :title="t('settings.newbieTasks.template.confirmResetFlags')"
                            overlay-class-name="newbie-task-reset-popconfirm"
                            :ok-text="t('common.actions.confirm')" :cancel-text="t('common.actions.cancel')"
                            :ok-button-props="{ size: 'small', class: 'newbie-task-reset-popconfirm__ok' }"
                            :cancel-button-props="{ size: 'middle', class: 'newbie-task-reset-popconfirm__cancel' }"
                            @confirm="handleResetNewbieTaskUserFlags">
                            <a-button danger size="small" :loading="newbieTaskResetting"
                              :disabled="newbieTaskTemplateSaving || newbieTaskTemplateLoading || newbieTaskResetting">
                              {{ t('settings.newbieTasks.template.actions.resetFlags') }}
                            </a-button>
                          </a-popconfirm>
                        </div>
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
                    <div v-if="newbieTaskResetProgressVisible" class="newbie-task-reset-progress">
                      <div class="newbie-task-reset-progress__header">
                        <div class="newbie-task-reset-progress__title">
                          <strong>{{ translateNewbieTaskReset('resetProgress.title') }}</strong>
                          <a-tag :color="newbieTaskResetProgressStatus === 'success'
                            ? 'success'
                            : newbieTaskResetProgressStatus === 'exception'
                              ? 'error'
                              : 'processing'">
                            {{ newbieTaskResetProgressStatusLabel }}
                          </a-tag>
                        </div>
                        <span class="newbie-task-reset-progress__time">
                          {{ translateNewbieTaskReset('resetProgress.updatedAt', { time: newbieTaskResetProgressUpdatedAtDisplay }) }}
                        </span>
                      </div>
                      <a-progress :percent="newbieTaskResetProgressPercent" :status="newbieTaskResetProgressStatus" />
                      <div class="newbie-task-reset-progress__meta">
                        <span>{{ newbieTaskResetProgressCountDisplay }}</span>
                        <span>
                          {{
                            newbieTaskResetSocketConnected
                              ? translateNewbieTaskReset('resetProgress.socketConnected')
                              : translateNewbieTaskReset('resetProgress.socketConnecting')
                          }}
                        </span>
                      </div>
                      <div v-if="newbieTaskResetProgress.message" class="newbie-task-reset-progress__message">
                        {{ newbieTaskResetProgress.message }}
                      </div>
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
                      <div>{{ formatReportEntryArea(record) }}</div>
                      <div v-if="record.cityDescription" class="report-entry-table-subtext">{{ record.cityDescription }}</div>
                    </template>
                    <template v-else-if="column.key === 'doubleReported'">
                      {{ record.doubleReported ? t('settings.reportEntry.values.yes') : t('settings.reportEntry.values.no') }}
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
                <a-form-item name="cityDescription" :label="t('settings.reportEntry.form.cityDescription')">
                  <a-input v-model:value="reportEntryForm.cityDescription"
                    :placeholder="t('settings.reportEntry.placeholders.cityDescription')" />
                </a-form-item>
                <a-form-item name="doubleReported" :label="t('settings.reportEntry.form.doubleReported')">
                  <a-switch v-model:checked="reportEntryForm.doubleReported" />
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

        <a-tab-pane key="guide-settings" :tab="t('settings.tabs.guideSettings')">
          <div class="tab-section">
            <a-tabs v-model:activeKey="guideSettingsTab" class="guide-settings-tabs">
              <a-tab-pane key="gif" :tab="t('settings.guideSettings.tabs.gif')">
                <section class="system-settings guide-settings">
                  <header class="section-header">
                    <div>
                      <h3>{{ t('settings.system.guide.title') }}</h3>
                      <p>{{ t('settings.system.guide.subtitle') }}</p>
                    </div>
                    <div class="actions">
                      <a-button type="default" @click="loadGuideUrls" :loading="guideLoading"
                        :disabled="guideSaving || guideUploadLoading">
                        {{ t('settings.system.guide.actions.reload') }}
                      </a-button>
                      <a-button type="primary" @click="submitGuideUrls" :loading="guideSaving">
                        {{ t('settings.system.guide.actions.save') }}
                      </a-button>
                    </div>
                  </header>
                  <div class="system-settings__meta">
                    <span>
                      {{ t('settings.system.guide.meta.updatedAt', { time: guideUpdatedAtDisplay }) }}
                    </span>
                  </div>
                  <a-spin :spinning="guideLoading">
                    <div class="guide-upload">
                      <label class="guide-upload__trigger">
                        <input class="guide-upload__input" type="file" accept="image/gif" multiple
                          :disabled="guideUploadLoading" @change="handleGuideGifUpload" />
                        <a-button type="dashed" :loading="guideUploadLoading">
                          {{
                            guideUrls.length
                              ? t('settings.system.guide.actions.addMore')
                              : t('settings.system.guide.actions.upload')
                          }}
                        </a-button>
                      </label>
                      <span class="guide-upload__hint">{{ t('settings.system.guide.hint') }}</span>
                    </div>
                    <div v-if="guideUrls.length" class="guide-list">
                      <div v-for="(item, index) in guideUrls" :key="`${item.url}-${index}`" class="guide-card">
                        <div class="guide-card__preview">
                          <img :src="resolveStorageUrl(item.url)" alt="guide-gif" />
                        </div>
                        <div class="guide-card__body">
                          <div class="guide-card__label">{{ t('settings.system.guide.fields.title') }}</div>
                          <a-input v-model:value="item.title"
                            :placeholder="t('settings.system.guide.placeholders.title')" allow-clear />
                        </div>
                        <div class="guide-card__footer">
                          <span class="guide-card__name">{{ getDisplayFileName(item.url) }}</span>
                          <a-button type="link" danger size="small" @click="removeGuideUrl(index)">
                            {{ t('settings.system.guide.actions.remove') }}
                          </a-button>
                        </div>
                      </div>
                    </div>
                    <a-empty v-else :description="t('settings.system.guide.empty')" />
                  </a-spin>
                </section>
              </a-tab-pane>

              <a-tab-pane key="user-agreement" :tab="t('settings.guideSettings.tabs.userAgreement')">
                <section class="system-settings policy-settings">
                  <header class="section-header">
                    <div>
                      <h3>{{ t('settings.system.userAgreement.title') }}</h3>
                      <p>{{ t('settings.system.userAgreement.subtitle') }}</p>
                    </div>
                    <div class="actions">
                      <a-button type="default" @click="loadUserAgreements" :loading="userAgreementLoading"
                        :disabled="userAgreementSaving">
                        {{ t('settings.system.userAgreement.actions.reload') }}
                      </a-button>
                    </div>
                  </header>
                  <a-spin :spinning="userAgreementLoading">
                    <div class="policy-form">
                      <a-input v-model:value="userAgreementForm.version"
                        :placeholder="t('settings.system.userAgreement.placeholders.version')" allow-clear />
                      <open-platform-editor v-model="userAgreementForm.content"
                        :placeholder="t('settings.system.userAgreement.placeholders.content')"
                        :disabled="userAgreementSaving || userAgreementLoading" />
                      <div class="actions">
                        <a-button type="primary" @click="submitUserAgreement" :loading="userAgreementSaving">
                          {{
                            userAgreementForm.id
                              ? t('settings.system.userAgreement.actions.update')
                              : t('settings.system.userAgreement.actions.create')
                          }}
                        </a-button>
                        <a-button v-if="userAgreementForm.id" type="default" @click="resetUserAgreementForm">
                          {{ t('settings.system.userAgreement.actions.cancelEdit') }}
                        </a-button>
                      </div>
                    </div>
                    <a-table :columns="userAgreementColumns" :data-source="userAgreementList" :pagination="false"
                      row-key="id" size="small" bordered>
                      <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'content'">
                          <span class="policy-content-text">{{ getPolicySummary(record.content) }}</span>
                        </template>
                        <template v-else-if="column.key === 'updatedAt'">
                          {{ formatDateTime(record.updatedAt || record.createdAt) }}
                        </template>
                        <template v-else-if="column.key === 'actions'">
                          <a-button type="link" size="small" @click="editUserAgreement(record)">
                            {{ t('settings.system.userAgreement.actions.edit') }}
                          </a-button>
                          <a-button
                            type="link"
                            size="small"
                            :loading="userAgreementPdfDownloadingId === record.id"
                            @click="handleDownloadUserAgreementPdf(record)"
                          >
                            {{ t('settings.system.userAgreement.actions.downloadPdf') }}
                          </a-button>
                          <a-button type="link" danger size="small" @click="handleDeleteUserAgreement(record)">
                            {{ t('settings.system.userAgreement.actions.delete') }}
                          </a-button>
                        </template>
                      </template>
                    </a-table>
                  </a-spin>
                </section>
              </a-tab-pane>

              <a-tab-pane key="privacy-policy" :tab="t('settings.guideSettings.tabs.privacyPolicy')">
                <section class="system-settings policy-settings">
                  <header class="section-header">
                    <div>
                      <h3>{{ t('settings.system.privacyPolicy.title') }}</h3>
                      <p>{{ t('settings.system.privacyPolicy.subtitle') }}</p>
                    </div>
                    <div class="actions">
                      <a-button type="default" @click="loadPrivacyPolicies" :loading="privacyPolicyLoading"
                        :disabled="privacyPolicySaving">
                        {{ t('settings.system.privacyPolicy.actions.reload') }}
                      </a-button>
                    </div>
                  </header>
                  <a-spin :spinning="privacyPolicyLoading">
                    <div class="policy-form">
                      <a-input v-model:value="privacyPolicyForm.version"
                        :placeholder="t('settings.system.privacyPolicy.placeholders.version')" allow-clear />
                      <open-platform-editor v-model="privacyPolicyForm.content"
                        :placeholder="t('settings.system.privacyPolicy.placeholders.content')"
                        :disabled="privacyPolicySaving || privacyPolicyLoading" />
                      <div class="actions">
                        <a-button type="primary" @click="submitPrivacyPolicy" :loading="privacyPolicySaving">
                          {{
                            privacyPolicyForm.id
                              ? t('settings.system.privacyPolicy.actions.update')
                              : t('settings.system.privacyPolicy.actions.create')
                          }}
                        </a-button>
                        <a-button v-if="privacyPolicyForm.id" type="default" @click="resetPrivacyPolicyForm">
                          {{ t('settings.system.privacyPolicy.actions.cancelEdit') }}
                        </a-button>
                      </div>
                    </div>
                    <a-table :columns="privacyPolicyColumns" :data-source="privacyPolicyList" :pagination="false"
                      row-key="id" size="small" bordered>
                      <template #bodyCell="{ column, record }">
                        <template v-if="column.key === 'content'">
                          <span class="policy-content-text">{{ getPolicySummary(record.content) }}</span>
                        </template>
                        <template v-else-if="column.key === 'updatedAt'">
                          {{ formatDateTime(record.updatedAt || record.createdAt) }}
                        </template>
                        <template v-else-if="column.key === 'actions'">
                          <a-button type="link" size="small" @click="editPrivacyPolicy(record)">
                            {{ t('settings.system.privacyPolicy.actions.edit') }}
                          </a-button>
                          <a-button
                            type="link"
                            size="small"
                            :loading="privacyPolicyPdfDownloadingId === record.id"
                            @click="handleDownloadPrivacyPolicyPdf(record)"
                          >
                            {{ t('settings.system.privacyPolicy.actions.downloadPdf') }}
                          </a-button>
                          <a-button type="link" danger size="small" @click="handleDeletePrivacyPolicy(record)">
                            {{ t('settings.system.privacyPolicy.actions.delete') }}
                          </a-button>
                        </template>
                      </template>
                    </a-table>
                  </a-spin>
                </section>
              </a-tab-pane>
            </a-tabs>
          </div>
        </a-tab-pane>

        <a-tab-pane key="area-settings" :tab="t('settings.tabs.areaSettings')">
          <div class="tab-section">
            <a-tabs v-model:activeKey="areaSettingsTab" class="guide-settings-tabs">
              <a-tab-pane key="kml-decrypt-aes" :tab="t('settings.areaSettings.tabs.kmlDecryptAes')">
                <section class="invite-form">
                  <header class="section-header">
                    <div>
                      <h3>{{ t('settings.areaSettings.kmlDecryptAes.title') }}</h3>
                      <p>{{ t('settings.areaSettings.kmlDecryptAes.subtitle') }}</p>
                    </div>
                    <div class="actions">
                      <a-button
                        type="default"
                        @click="loadKmlDecryptAesKeyConfig"
                        :loading="kmlDecryptAesKeyLoading"
                        :disabled="kmlDecryptAesKeySaving"
                      >
                        {{ t('settings.areaSettings.kmlDecryptAes.actions.reload') }}
                      </a-button>
                    </div>
                  </header>
                  <a-spin :spinning="kmlDecryptAesKeyLoading">
                    <a-form layout="vertical" :model="kmlDecryptAesKeyForm" @finish="submitKmlDecryptAesKeyForm">
                      <a-form-item :label="t('settings.areaSettings.kmlDecryptAes.fields.aesKey')">
                        <a-input-password
                          v-model:value="kmlDecryptAesKeyForm.aesKey"
                          :placeholder="t('settings.areaSettings.kmlDecryptAes.placeholders.aesKey')"
                          allow-clear
                        />
                      </a-form-item>
                      <p class="system-font-helper">{{ t('settings.areaSettings.kmlDecryptAes.helper') }}</p>
                      <div class="actions">
                        <a-button type="primary" html-type="submit" :loading="kmlDecryptAesKeySaving">
                          {{ t('settings.areaSettings.kmlDecryptAes.actions.save') }}
                        </a-button>
                        <a-button
                          type="default"
                          @click="loadKmlDecryptAesKeyConfig"
                          :disabled="kmlDecryptAesKeyLoading || kmlDecryptAesKeySaving"
                        >
                          {{ t('settings.areaSettings.kmlDecryptAes.actions.reset') }}
                        </a-button>
                      </div>
                    </a-form>
                  </a-spin>
                </section>
              </a-tab-pane>

              <a-tab-pane key="suitable-fly-zone" :tab="t('settings.areaSettings.tabs.suitableFlyZone')">
                <section class="invite-form">
                  <a-form layout="vertical" :model="suitableFlyZoneKmzForm" @finish="submitSuitableFlyZoneKmzForm">
                    <a-form-item :label="t('settings.areaSettings.suitableFlyZone.fields.name')">
                      <a-input
                        v-model:value="suitableFlyZoneKmzForm.name"
                        :placeholder="t('settings.areaSettings.suitableFlyZone.placeholders.name')"
                      />
                    </a-form-item>
                    <a-form-item :label="t('settings.areaSettings.suitableFlyZone.fields.version')">
                      <a-input
                        v-model:value="suitableFlyZoneKmzForm.version"
                        :placeholder="t('settings.areaSettings.suitableFlyZone.placeholders.version')"
                      />
                    </a-form-item>
                    <a-form-item :label="t('settings.areaSettings.suitableFlyZone.fields.file')">
                      <div class="system-font-upload">
                        <label class="system-font-upload__trigger">
                          <input
                            class="system-font-upload__input"
                            type="file"
                            accept=".kmz,application/vnd.google-earth.kmz,application/zip"
                            :disabled="suitableFlyZoneKmzSaving"
                            @change="handleSuitableFlyZoneKmzSelect"
                          />
                          <a-button type="dashed" :loading="suitableFlyZoneKmzSaving">
                            {{
                              suitableFlyZoneKmzForm.fileName
                                ? t('settings.areaSettings.suitableFlyZone.actions.replaceFile')
                                : t('settings.areaSettings.suitableFlyZone.actions.selectFile')
                            }}
                          </a-button>
                        </label>
                        <span v-if="suitableFlyZoneKmzForm.fileName" class="system-font-upload__name">
                          {{ suitableFlyZoneKmzForm.fileName }}
                        </span>
                        <a-button
                          v-if="suitableFlyZoneKmzForm.fileName"
                          type="link"
                          danger
                          size="small"
                          @click="clearSuitableFlyZoneKmzSelection"
                        >
                          {{ t('settings.areaSettings.suitableFlyZone.actions.removeFile') }}
                        </a-button>
                      </div>
                    </a-form-item>
                    <a-form-item :label="t('settings.areaSettings.suitableFlyZone.fields.description')">
                      <a-textarea
                        v-model:value="suitableFlyZoneKmzForm.description"
                        :placeholder="t('settings.areaSettings.suitableFlyZone.placeholders.description')"
                        :rows="4"
                      />
                    </a-form-item>
                    <div class="actions">
                      <a-button type="primary" html-type="submit" :loading="suitableFlyZoneKmzSaving">
                        {{ t('settings.areaSettings.suitableFlyZone.actions.save') }}
                      </a-button>
                      <a-button
                        type="default"
                        @click="loadSuitableFlyZoneKmzInfos"
                        :disabled="suitableFlyZoneKmzLoading || suitableFlyZoneKmzSaving"
                      >
                        {{ t('settings.areaSettings.suitableFlyZone.actions.reload') }}
                      </a-button>
                    </div>
                  </a-form>
                </section>

                <section class="invite-table">
                  <a-table
                    :columns="suitableFlyZoneKmzColumns"
                    :data-source="suitableFlyZoneKmzList"
                    :loading="suitableFlyZoneKmzLoading"
                    :pagination="false"
                    row-key="id"
                    size="small"
                    bordered
                    :scroll="{ x: 980 }"
                  >
                    <template #bodyCell="{ column, record }">
                      <template v-if="column.key === 'attachmentName'">
                        <a
                          v-if="record?.attachmentName"
                          :href="resolveSuitableFlyZoneKmzDownloadUrl(record.attachmentName)"
                          target="_blank"
                          rel="noreferrer"
                        >
                          {{ extractObjectName(record.attachmentName) || record.attachmentName }}
                        </a>
                        <span v-else class="empty-hint">-</span>
                      </template>
                      <template v-else-if="column.key === 'description'">
                        {{ record?.description || '-' }}
                      </template>
                      <template v-else-if="column.key === 'createdAt'">
                        {{ record?.createdAt ? new Date(record.createdAt).toLocaleString() : '-' }}
                      </template>
                    </template>
                  </a-table>
                </section>
              </a-tab-pane>
            </a-tabs>
          </div>
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

            <section class="system-settings">
              <header class="section-header">
                <div>
                  <h3>{{ t('settings.system.posterService.title') }}</h3>
                  <p>{{ t('settings.system.posterService.subtitle') }}</p>
                </div>
                <div class="actions actions--inline">
                  <div class="system-settings__meta">
                    <span class="system-settings__meta-label">
                      {{ t('settings.system.posterService.currentVersionLabel') }}
                    </span>
                    <span class="system-settings__meta-value">
                      {{ posterServiceVersionDisplay }}
                    </span>
                  </div>
                  <a-button type="primary" @click="handleRefreshPosterServiceVersion"
                    :loading="posterServiceVersionRefreshing"
                    :disabled="posterServiceVersionLoading">
                    {{ t('settings.system.posterService.actions.pullLatest') }}
                  </a-button>
                  <a-button type="default" @click="loadPosterServiceVersion"
                    :loading="posterServiceVersionLoading"
                    :disabled="posterServiceVersionRefreshing">
                    {{ t('settings.system.posterService.actions.reload') }}
                  </a-button>
                </div>
              </header>
            </section>

            <section class="system-settings">
              <header class="section-header">
                <div>
                  <h3>{{ t('settings.system.easterEggResource.title') }}</h3>
                  <p>{{ t('settings.system.easterEggResource.subtitle') }}</p>
                </div>
                <div class="system-settings__meta">
                  <span class="system-settings__meta-label">
                    {{ t('settings.system.easterEggResource.currentVersionLabel') }}
                  </span>
                  <span class="system-settings__meta-value">
                    {{ easterEggResourceConfig.version || t('settings.system.easterEggResource.emptyVersion') }}
                  </span>
                </div>
              </header>
              <a-spin :spinning="easterEggResourceLoading">
                <div class="system-font-current">
                  <span class="system-font-current__label">
                    {{ t('settings.system.easterEggResource.currentFileLabel') }}
                  </span>
                  <a v-if="easterEggResourceConfig.fileName" :href="easterEggResourceDownloadUrl" target="_blank"
                    rel="noreferrer">
                    {{ easterEggResourceConfig.fileName }}
                  </a>
                  <span v-else class="empty-hint">{{ t('settings.system.easterEggResource.emptyFile') }}</span>
                </div>
                <a-form layout="vertical" :model="easterEggResourceForm" @finish="submitEasterEggResourceForm">
                  <a-form-item :label="t('settings.system.easterEggResource.fields.file')">
                    <div class="system-font-upload">
                      <label class="system-font-upload__trigger">
                        <input class="system-font-upload__input" type="file" accept=".zip"
                          :disabled="easterEggResourceSaving" @change="handleEasterEggResourceSelect" />
                        <a-button type="dashed" :loading="easterEggResourceSaving">
                          {{
                            easterEggResourceForm.fileName
                              ? t('settings.system.easterEggResource.actions.replaceFile')
                              : t('settings.system.easterEggResource.actions.selectFile')
                          }}
                        </a-button>
                      </label>
                      <span v-if="easterEggResourceForm.fileName" class="system-font-upload__name">
                        {{ easterEggResourceForm.fileName }}
                      </span>
                      <a-button v-if="easterEggResourceForm.fileName" type="link" danger size="small"
                        @click="clearEasterEggResourceSelection">
                        {{ t('settings.system.easterEggResource.actions.removeFile') }}
                      </a-button>
                    </div>
                    <div class="system-font-helper">{{ t('settings.system.easterEggResource.helper') }}</div>
                  </a-form-item>
                  <a-form-item :label="t('settings.system.easterEggResource.fields.version')">
                    <a-input v-model:value="easterEggResourceForm.version"
                      :placeholder="t('settings.system.easterEggResource.placeholders.version')" />
                  </a-form-item>
                  <div class="actions">
                    <a-button type="primary" html-type="submit" :loading="easterEggResourceSaving">
                      {{ t('settings.system.easterEggResource.actions.upload') }}
                    </a-button>
                    <a-button type="default" @click="loadEasterEggResourceConfig"
                      :disabled="easterEggResourceLoading || easterEggResourceSaving">
                      {{ t('settings.system.easterEggResource.actions.reload') }}
                    </a-button>
                  </div>
                </a-form>
              </a-spin>
            </section>

            <section class="system-settings">
              <header class="section-header">
                <div>
                  <h3>{{ t('settings.system.provinceCityKmlZip.title') }}</h3>
                  <p>{{ t('settings.system.provinceCityKmlZip.subtitle') }}</p>
                </div>
                <div class="system-settings__meta">
                  <span class="system-settings__meta-label">
                    {{ t('settings.system.provinceCityKmlZip.currentVersionLabel') }}
                  </span>
                  <span class="system-settings__meta-value">
                    {{ provinceCityKmlZipConfig.version || t('settings.system.provinceCityKmlZip.emptyVersion') }}
                  </span>
                </div>
              </header>
              <a-spin :spinning="provinceCityKmlZipLoading">
                <div class="system-font-current">
                  <span class="system-font-current__label">
                    {{ t('settings.system.provinceCityKmlZip.currentFileLabel') }}
                  </span>
                  <a v-if="provinceCityKmlZipConfig.fileName" :href="provinceCityKmlZipDownloadUrl" target="_blank"
                    rel="noreferrer">
                    {{ provinceCityKmlZipConfig.fileName }}
                  </a>
                  <span v-else class="empty-hint">{{ t('settings.system.provinceCityKmlZip.emptyFile') }}</span>
                </div>
                <a-form layout="vertical" :model="provinceCityKmlZipForm" @finish="submitProvinceCityKmlZipForm">
                  <a-form-item :label="t('settings.system.provinceCityKmlZip.fields.file')">
                    <div class="system-font-upload">
                      <label class="system-font-upload__trigger">
                        <input class="system-font-upload__input" type="file" accept=".zip"
                          :disabled="provinceCityKmlZipSaving" @change="handleProvinceCityKmlZipSelect" />
                        <a-button type="dashed" :loading="provinceCityKmlZipSaving">
                          {{
                            provinceCityKmlZipForm.fileName
                              ? t('settings.system.provinceCityKmlZip.actions.replaceFile')
                              : t('settings.system.provinceCityKmlZip.actions.selectFile')
                          }}
                        </a-button>
                      </label>
                      <span v-if="provinceCityKmlZipForm.fileName" class="system-font-upload__name">
                        {{ provinceCityKmlZipForm.fileName }}
                      </span>
                      <a-button v-if="provinceCityKmlZipForm.fileName" type="link" danger size="small"
                        @click="clearProvinceCityKmlZipSelection">
                        {{ t('settings.system.provinceCityKmlZip.actions.removeFile') }}
                      </a-button>
                    </div>
                    <div class="system-font-helper">{{ t('settings.system.provinceCityKmlZip.helper') }}</div>
                  </a-form-item>
                  <a-form-item :label="t('settings.system.provinceCityKmlZip.fields.version')">
                    <a-input v-model:value="provinceCityKmlZipForm.version"
                      :placeholder="t('settings.system.provinceCityKmlZip.placeholders.version')" />
                  </a-form-item>
                  <div class="actions">
                    <a-button type="primary" html-type="submit" :loading="provinceCityKmlZipSaving">
                      {{ t('settings.system.provinceCityKmlZip.actions.upload') }}
                    </a-button>
                    <a-button type="default" @click="loadProvinceCityKmlZipConfig"
                      :disabled="provinceCityKmlZipLoading || provinceCityKmlZipSaving">
                      {{ t('settings.system.provinceCityKmlZip.actions.reload') }}
                    </a-button>
                  </div>
                </a-form>
              </a-spin>
            </section>

            <section class="system-settings">
              <header class="section-header">
                <div>
                  <h3>{{ t('settings.system.countyKmlZip.title') }}</h3>
                  <p>{{ t('settings.system.countyKmlZip.subtitle') }}</p>
                </div>
                <div class="system-settings__meta">
                  <span class="system-settings__meta-label">
                    {{ t('settings.system.countyKmlZip.currentVersionLabel') }}
                  </span>
                  <span class="system-settings__meta-value">
                    {{ countyKmlZipConfig.version || t('settings.system.countyKmlZip.emptyVersion') }}
                  </span>
                </div>
              </header>
              <a-spin :spinning="countyKmlZipLoading">
                <div class="system-font-current">
                  <span class="system-font-current__label">
                    {{ t('settings.system.countyKmlZip.currentFileLabel') }}
                  </span>
                  <a v-if="countyKmlZipConfig.fileName" :href="countyKmlZipDownloadUrl" target="_blank"
                    rel="noreferrer">
                    {{ countyKmlZipConfig.fileName }}
                  </a>
                  <span v-else class="empty-hint">{{ t('settings.system.countyKmlZip.emptyFile') }}</span>
                </div>
                <a-form layout="vertical" :model="countyKmlZipForm" @finish="submitCountyKmlZipForm">
                  <a-form-item :label="t('settings.system.countyKmlZip.fields.file')">
                    <div class="system-font-upload">
                      <label class="system-font-upload__trigger">
                        <input class="system-font-upload__input" type="file" accept=".zip"
                          :disabled="countyKmlZipSaving" @change="handleCountyKmlZipSelect" />
                        <a-button type="dashed" :loading="countyKmlZipSaving">
                          {{
                            countyKmlZipForm.fileName
                              ? t('settings.system.countyKmlZip.actions.replaceFile')
                              : t('settings.system.countyKmlZip.actions.selectFile')
                          }}
                        </a-button>
                      </label>
                      <span v-if="countyKmlZipForm.fileName" class="system-font-upload__name">
                        {{ countyKmlZipForm.fileName }}
                      </span>
                      <a-button v-if="countyKmlZipForm.fileName" type="link" danger size="small"
                        @click="clearCountyKmlZipSelection">
                        {{ t('settings.system.countyKmlZip.actions.removeFile') }}
                      </a-button>
                    </div>
                    <div class="system-font-helper">{{ t('settings.system.countyKmlZip.helper') }}</div>
                  </a-form-item>
                  <a-form-item :label="t('settings.system.countyKmlZip.fields.version')">
                    <a-input v-model:value="countyKmlZipForm.version"
                      :placeholder="t('settings.system.countyKmlZip.placeholders.version')" />
                  </a-form-item>
                  <div class="actions">
                    <a-button type="primary" html-type="submit" :loading="countyKmlZipSaving">
                      {{ t('settings.system.countyKmlZip.actions.upload') }}
                    </a-button>
                    <a-button type="default" @click="loadCountyKmlZipConfig"
                      :disabled="countyKmlZipLoading || countyKmlZipSaving">
                      {{ t('settings.system.countyKmlZip.actions.reload') }}
                    </a-button>
                  </div>
                </a-form>
              </a-spin>
            </section>

            <section class="system-settings">
              <header class="section-header">
                <div>
                  <h3>{{ t('settings.system.ladderLeaderboard.title') }}</h3>
                  <p>{{ t('settings.system.ladderLeaderboard.subtitle') }}</p>
                </div>
                <div class="actions">
                  <a-button type="default" @click="loadLadderLeaderboard" :loading="ladderLeaderboardLoading">
                    {{ t('settings.system.ladderLeaderboard.actions.reload') }}
                  </a-button>
                </div>
              </header>
              <a-table
                :columns="ladderLeaderboardColumns"
                :data-source="ladderLeaderboard"
                :loading="ladderLeaderboardLoading"
                :pagination="ladderLeaderboardPaginationConfig"
                row-key="featureCode"
                size="small"
                bordered
                :scroll="{ x: 920 }"
                @change="handleLadderLeaderboardTableChange"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'avatar'">
                    <a-avatar :src="record?.avatarUrl" :alt="record?.username" />
                  </template>
                  <template v-else-if="column.key === 'highestScore'">
                    {{ Number(record?.highestScore ?? 0) }}
                  </template>
                  <template v-else-if="column.key === 'gameCount'">
                    {{ record?.gameCount ?? '-' }}
                  </template>
                  <template v-else-if="column.key === 'latestGameTime'">
                    {{ record?.latestGameTime ? new Date(record.latestGameTime).toLocaleString() : '-' }}
                  </template>
                </template>
              </a-table>
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

.copy-type-group {
  padding: 12px 16px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f9fafb;
}

.copy-type-group + .copy-type-group {
  margin-top: 12px;
}

.copy-type-group__title {
  margin-bottom: 10px;
  font-size: 0.95rem;
  font-weight: 600;
  color: #111827;
}

.copy-type-group__options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
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

.ad-settings {
  background: #f9fafb;
  padding: 20px;
  border-radius: 12px;
  box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ad-settings__config {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(220px, 320px);
  gap: 16px;
  align-items: stretch;
  padding: 16px;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.ad-settings__config-main,
.ad-settings__config-side {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ad-settings__config-side {
  justify-content: space-between;
  padding: 12px;
  border-radius: 10px;
  background: #f8fafc;
}

.ad-settings__form-item {
  margin-bottom: 0;
  max-width: 260px;
}

.ad-settings__status-input {
  width: 180px;
}

.ad-settings__helper {
  max-width: 640px;
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
  line-height: 1.6;
}

.ad-settings__side-label {
  color: #6b7280;
  font-size: 0.85rem;
}

.ad-settings__config-side strong {
  color: #111827;
  font-size: 1.4rem;
}

.ad-settings__form-actions {
  justify-content: flex-start;
}

.ad-settings__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.ad-stat-card {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ad-stat-card__label {
  color: #6b7280;
  font-size: 0.85rem;
}

.ad-stat-card__value {
  color: #111827;
  font-size: 1.25rem;
  font-weight: 700;
}

.ad-stat-card__value--small {
  font-size: 0.92rem;
  font-weight: 600;
  line-height: 1.4;
}

.ad-settings__record,
.ad-settings__members {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ad-settings__record-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.ad-settings__record-header h4,
.ad-settings__members h4 {
  margin: 0;
  color: #111827;
}

.ad-settings__error {
  margin-top: 6px;
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

.actions--inline {
  margin-top: 0;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
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

.newbie-task-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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

.report-entry-table-subtext {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  color: #6b7280;
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

.guide-upload {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.guide-form {
  margin-bottom: 8px;
}

.guide-upload__trigger {
  position: relative;
  display: inline-flex;
}

.guide-upload__input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  z-index: 1;
}

.guide-upload__hint {
  color: #6b7280;
  font-size: 0.9rem;
}

.guide-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}

.guide-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.08);
}

.guide-card__preview {
  background: #f3f4f6;
  border-radius: 10px;
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
}

.guide-card__preview img {
  max-width: 100%;
  max-height: 160px;
  object-fit: contain;
  border-radius: 8px;
}

.guide-card__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.guide-card__label {
  color: #6b7280;
  font-size: 0.78rem;
}

.guide-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.guide-card__name {
  color: #374151;
  font-size: 0.85rem;
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.policy-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.policy-content-text {
  color: #6b7280;
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

.cos-test-progress {
  margin-bottom: 12px;
}

.cos-test-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
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

.newbie-task-reset-progress {
  margin-top: 12px;
  margin-bottom: 16px;
  padding: 14px 16px;
  border: 1px solid #dbeafe;
  border-radius: 12px;
  background: linear-gradient(135deg, #f8fbff 0%, #eef6ff 100%);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.newbie-task-reset-progress__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.newbie-task-reset-progress__title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: #111827;
  flex-wrap: wrap;
}

.newbie-task-reset-progress__time {
  color: #6b7280;
  font-size: 0.85rem;
  text-align: right;
}

.newbie-task-reset-progress__meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: #475569;
  font-size: 0.9rem;
  flex-wrap: wrap;
}

.newbie-task-reset-progress__message {
  color: #1f2937;
  font-size: 0.9rem;
  line-height: 1.5;
  word-break: break-word;
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

  .ad-settings__record-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .ad-settings__config {
    grid-template-columns: 1fr;
  }

  .ad-settings__form-item,
  .ad-settings__status-input {
    max-width: none;
    width: 100%;
  }
}
</style>

<style>
.newbie-task-reset-popconfirm .ant-popconfirm-buttons {
  display: flex !important;
  width: 100% !important;
  align-items: center !important;
  justify-content: flex-start !important;
  gap: 8px !important;
  text-align: left !important;
}

.newbie-task-reset-popconfirm .newbie-task-reset-popconfirm__ok.ant-btn,
.newbie-task-reset-popconfirm .newbie-task-reset-popconfirm__ok.ant-btn-sm {
  order: -1 !important;
  margin-inline-start: 0 !important;
  margin-inline-end: 0 !important;
  min-width: 0 !important;
  width: auto !important;
  height: 14px !important;
  padding: 0 3px !important;
  font-size: 10px !important;
  line-height: 12px !important;
  border-radius: 3px !important;
}

.newbie-task-reset-popconfirm .newbie-task-reset-popconfirm__cancel.ant-btn,
.newbie-task-reset-popconfirm .newbie-task-reset-popconfirm__cancel.ant-btn-sm,
.newbie-task-reset-popconfirm .newbie-task-reset-popconfirm__cancel.ant-btn-md {
  margin-inline-start: auto !important;
}
</style>



