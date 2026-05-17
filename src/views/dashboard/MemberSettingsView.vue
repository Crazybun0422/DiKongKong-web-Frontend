<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, SaveOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import {
  fetchMemberGroupQrcode,
  buildAvatarPackDownloadUrl,
  buildBackgroundImagePackDownloadUrl,
  buildVoicePackDownloadUrl,
  fetchAvatarPackVersion,
  fetchBackgroundImagePackVersion,
  fetchMemberOpenLogs,
  fetchMemberInviteRewardConfig,
  fetchMemberRechargeConfig,
  fetchVoicePackVersion,
  saveMemberInviteRewardConfig,
  saveMemberRechargeConfig,
  uploadAvatarPack,
  uploadBackgroundImagePack,
  uploadMemberGroupQrcode,
  uploadVoicePack,
} from '../../services/memberSettings'
import { buildDownloadUrl, extractObjectName } from '../../services/files'

const { t } = useI18n()

const memberSettingsTab = ref('settings')
const priceFormRef = ref(null)
const priceLoading = ref(false)
const priceSaving = ref(false)
const cashSaving = ref(false)
const priceUpdatedAt = ref('')
const inviteRewardFormRef = ref(null)
const inviteRewardLoading = ref(false)
const inviteRewardSaving = ref(false)
const inviteRewardUpdatedAt = ref('')
const memberGroupQrcodeUrl = ref('')
const memberGroupQrcodeUpdatedAt = ref(null)
const memberGroupQrcodeLoading = ref(false)
const memberGroupQrcodeUploading = ref(false)
const memberOpenLogs = ref([])
const memberLogLoading = ref(false)
const memberLogFilters = reactive({
  featureCode: '',
})
const memberLogPagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
})

const priceFieldKeys = [
  'yearlyWechatNetPrice',
  'yearlyWechatListPrice',
  'yearlyFlpNetPrice',
  'yearlyFlpListPrice',
  'monthlyWechatNetPrice',
  'monthlyWechatListPrice',
  'monthlyFlpNetPrice',
  'monthlyFlpListPrice',
]

const priceForm = reactive({
  yearlyWechatNetPrice: 0,
  yearlyWechatListPrice: 0,
  yearlyFlpNetPrice: 0,
  yearlyFlpListPrice: 0,
  monthlyWechatNetPrice: 0,
  monthlyWechatListPrice: 0,
  monthlyFlpNetPrice: 0,
  monthlyFlpListPrice: 0,
})

const persistedRechargeConfig = reactive({
  yearlyWechatNetPrice: 0,
  yearlyWechatListPrice: 0,
  yearlyFlpNetPrice: 0,
  yearlyFlpListPrice: 0,
  monthlyWechatNetPrice: 0,
  monthlyWechatListPrice: 0,
  monthlyFlpNetPrice: 0,
  monthlyFlpListPrice: 0,
  cashPaymentEnabled: false,
})

const cashPaymentEnabled = ref(false)

const inviteRewardForm = reactive({
  yearlyRewardFlp: 0,
  monthlyRewardFlp: 0,
})

const uploadState = reactive({
  background: {
    file: null,
    version: '',
    currentFileName: '',
    currentVersion: '',
    loading: false,
    uploading: false,
    result: null,
  },
  avatar: {
    file: null,
    version: '',
    currentFileName: '',
    currentVersion: '',
    loading: false,
    uploading: false,
    result: null,
  },
  voice: {
    file: null,
    version: '',
    currentFileName: '',
    currentVersion: '',
    loading: false,
    uploading: false,
    result: null,
  },
})

const packConfigs = computed(() => [
  {
    key: 'background',
    title: t('memberSettings.upload.background.title'),
    subtitle: t('memberSettings.upload.background.subtitle'),
    helper: t('memberSettings.upload.background.helper'),
    accept: '.zip,.rar,.7z',
    fetchVersion: fetchBackgroundImagePackVersion,
    upload: uploadBackgroundImagePack,
    buildDownloadUrl: buildBackgroundImagePackDownloadUrl,
  },
  {
    key: 'avatar',
    title: t('memberSettings.upload.avatar.title'),
    subtitle: t('memberSettings.upload.avatar.subtitle'),
    helper: t('memberSettings.upload.avatar.helper'),
    accept: '.zip,.rar,.7z',
    fetchVersion: fetchAvatarPackVersion,
    upload: uploadAvatarPack,
    buildDownloadUrl: buildAvatarPackDownloadUrl,
  },
  {
    key: 'voice',
    title: t('memberSettings.upload.voice.title'),
    subtitle: t('memberSettings.upload.voice.subtitle'),
    helper: t('memberSettings.upload.voice.helper'),
    accept: '.zip,.rar,.7z',
    fetchVersion: fetchVoicePackVersion,
    upload: uploadVoicePack,
    buildDownloadUrl: buildVoicePackDownloadUrl,
  },
])

const priceGroups = computed(() => [
  {
    key: 'monthly',
    title: t('memberSettings.price.groups.monthly.title'),
    subtitle: t('memberSettings.price.groups.monthly.subtitle'),
    rows: [
      {
        key: 'monthlyWechat',
        label: t('memberSettings.price.paymentTypes.wechat'),
        fields: [
          { key: 'monthlyWechatNetPrice', label: t('memberSettings.price.valueTypes.net'), addon: t('memberSettings.units.yuan') },
          { key: 'monthlyWechatListPrice', label: t('memberSettings.price.valueTypes.list'), addon: t('memberSettings.units.yuan') },
        ],
      },
      {
        key: 'monthlyFlp',
        label: t('memberSettings.price.paymentTypes.flp'),
        fields: [
          { key: 'monthlyFlpNetPrice', label: t('memberSettings.price.valueTypes.net'), addon: t('memberSettings.units.flp') },
          { key: 'monthlyFlpListPrice', label: t('memberSettings.price.valueTypes.list'), addon: t('memberSettings.units.flp') },
        ],
      },
    ],
  },
  {
    key: 'yearly',
    title: t('memberSettings.price.groups.yearly.title'),
    subtitle: t('memberSettings.price.groups.yearly.subtitle'),
    rows: [
      {
        key: 'yearlyWechat',
        label: t('memberSettings.price.paymentTypes.wechat'),
        fields: [
          { key: 'yearlyWechatNetPrice', label: t('memberSettings.price.valueTypes.net'), addon: t('memberSettings.units.yuan') },
          { key: 'yearlyWechatListPrice', label: t('memberSettings.price.valueTypes.list'), addon: t('memberSettings.units.yuan') },
        ],
      },
      {
        key: 'yearlyFlp',
        label: t('memberSettings.price.paymentTypes.flp'),
        fields: [
          { key: 'yearlyFlpNetPrice', label: t('memberSettings.price.valueTypes.net'), addon: t('memberSettings.units.flp') },
          { key: 'yearlyFlpListPrice', label: t('memberSettings.price.valueTypes.list'), addon: t('memberSettings.units.flp') },
        ],
      },
    ],
  },
])

const priceFields = computed(() => priceGroups.value.flatMap((group) => group.rows.flatMap((row) => row.fields)))

const inviteRewardFields = computed(() => [
  { key: 'monthlyRewardFlp', label: t('memberSettings.inviteReward.fields.monthlyRewardFlp') },
  { key: 'yearlyRewardFlp', label: t('memberSettings.inviteReward.fields.yearlyRewardFlp') },
])

const memberLogColumns = computed(() => [
  { title: t('memberSettings.logs.columns.featureCode'), dataIndex: 'featureCode', key: 'featureCode', width: 160 },
  { title: t('memberSettings.logs.columns.username'), dataIndex: 'username', key: 'username', width: 180 },
  { title: t('memberSettings.logs.columns.cycle'), dataIndex: 'cycle', key: 'cycle', width: 120 },
  { title: t('memberSettings.logs.columns.paymentMode'), dataIndex: 'paymentMode', key: 'paymentMode', width: 130 },
  { title: t('memberSettings.logs.columns.amount'), dataIndex: 'amount', key: 'amount', width: 120 },
  { title: t('memberSettings.logs.columns.memberExpireDate'), dataIndex: 'memberExpireDate', key: 'memberExpireDate', width: 200 },
  { title: t('memberSettings.logs.columns.activatedAt'), dataIndex: 'activatedAt', key: 'activatedAt', width: 200 },
])

const memberLogPaginationConfig = computed(() => ({
  current: memberLogPagination.current,
  pageSize: memberLogPagination.pageSize,
  total: memberLogPagination.total,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total, range) =>
    t('memberSettings.logs.pagination.total', { total, start: range?.[0] ?? 0, end: range?.[1] ?? 0 }),
}))

const settingsReloadLoading = computed(() =>
  priceLoading.value ||
  inviteRewardLoading.value ||
  memberGroupQrcodeLoading.value ||
  Object.values(uploadState).some((item) => item.loading),
)

const buildNonNegativeRules = (fields, messageKey) =>
  fields.reduce((rules, field) => {
    rules[field.key] = [
      {
        validator: (_, value) => {
          const numeric = Number(value)
          if (Number.isNaN(numeric) || numeric < 0) {
            return Promise.reject(new Error(t(messageKey)))
          }
          return Promise.resolve()
        },
      },
    ]
    return rules
  }, {})

const priceRules = computed(() =>
  buildNonNegativeRules(priceFields.value, 'memberSettings.price.validation.nonNegative'),
)

const inviteRewardRules = computed(() =>
  buildNonNegativeRules(inviteRewardFields.value, 'memberSettings.inviteReward.validation.nonNegative'),
)

const formattedPriceUpdatedAt = computed(() => {
  if (!priceUpdatedAt.value) return t('memberSettings.price.emptyUpdatedAt')
  return new Date(priceUpdatedAt.value).toLocaleString()
})

const formattedInviteRewardUpdatedAt = computed(() => {
  if (!inviteRewardUpdatedAt.value) return t('memberSettings.inviteReward.emptyUpdatedAt')
  return new Date(inviteRewardUpdatedAt.value).toLocaleString()
})

const formattedMemberGroupQrcodeUpdatedAt = computed(() => {
  if (!memberGroupQrcodeUpdatedAt.value) return t('memberSettings.qrCode.emptyUpdatedAt')
  return new Date(memberGroupQrcodeUpdatedAt.value).toLocaleString()
})

const formattedCashUpdatedAt = computed(() => {
  if (!priceUpdatedAt.value) return t('memberSettings.cashPayment.emptyUpdatedAt')
  return new Date(priceUpdatedAt.value).toLocaleString()
})

const normalizeUploadResult = (result, buildDownloadUrl) => {
  const objectName = extractObjectName(result?.objectName || result?.location || result?.url || '')
  return {
    objectName,
    location: result?.location || '',
    downloadUrl: result?.location || buildDownloadUrl(objectName),
  }
}

const bumpPatchVersion = (version) => {
  const parts = String(version || '').trim().split('.')
  if (parts.length >= 3 && parts.every((part) => /^\d+$/.test(part))) {
    parts[parts.length - 1] = String(Number(parts[parts.length - 1]) + 1)
    return parts.join('.')
  }
  return version ? `${version}.1` : '1.0.0'
}

const formatDateTime = (value) => {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleString()
  } catch (error) {
    return value
  }
}

const formatCycle = (value) => {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'MONTHLY') return t('memberSettings.logs.cycle.monthly')
  if (normalized === 'YEARLY') return t('memberSettings.logs.cycle.yearly')
  return value || '-'
}

const formatPaymentMode = (value) => {
  const normalized = String(value || '').toUpperCase()
  if (normalized === 'WECHAT') return t('memberSettings.logs.paymentMode.wechat')
  if (normalized === 'FLP') return t('memberSettings.logs.paymentMode.flp')
  if (normalized === 'CASH') return t('memberSettings.logs.paymentMode.cash')
  return value || '-'
}

const resolveMemberGroupQrcodeImageUrl = (value) => {
  if (!value) return ''
  const objectName = extractObjectName(value)
  return objectName ? buildDownloadUrl(objectName) : value
}

const resolveMemberGroupQrcodeFileName = (value) => extractObjectName(value || '') || value || ''

const normalizeMemberLog = (item, index) => ({
  ...item,
  rowKey: item?.id || item?.orderId || item?.orderNumber || `${item?.featureCode || 'unknown'}-${item?.activatedAt || item?.createdAt || index}`,
  featureCode: item?.featureCode || item?.userFeatureCode || '-',
  username: item?.username || item?.nickname || '-',
  cycle: item?.cycle || item?.memberCycle || '-',
  paymentMode: item?.paymentMode || item?.paymentType || '-',
  amount: Number(item?.amount ?? item?.payAmount ?? 0) || 0,
  memberExpireDate: item?.memberExpireDate || item?.memberExpireAt || item?.expireDate || '',
  activatedAt: item?.activatedAt || item?.payTime || item?.createdAt || item?.updatedAt || '',
})

const loadMemberRechargeConfig = async () => {
  priceLoading.value = true
  try {
    const data = await fetchMemberRechargeConfig()
    priceFieldKeys.forEach((key) => {
      const numericValue = Number(data?.[key] ?? 0)
      priceForm[key] = numericValue
      persistedRechargeConfig[key] = numericValue
    })
    persistedRechargeConfig.cashPaymentEnabled = Boolean(data?.cashPaymentEnabled)
    cashPaymentEnabled.value = persistedRechargeConfig.cashPaymentEnabled
    priceUpdatedAt.value = data?.updatedAt || ''
  } catch (error) {
    console.warn('Failed to load member recharge config', error)
    message.error(t('memberSettings.price.messages.loadFailed'))
  } finally {
    priceLoading.value = false
  }
}

const loadMemberInviteRewardConfig = async () => {
  inviteRewardLoading.value = true
  try {
    const data = await fetchMemberInviteRewardConfig()
    Object.keys(inviteRewardForm).forEach((key) => {
      inviteRewardForm[key] = Number(data?.[key] ?? 0)
    })
    inviteRewardUpdatedAt.value = data?.updatedAt || ''
  } catch (error) {
    console.warn('Failed to load member invite reward config', error)
    message.error(t('memberSettings.inviteReward.messages.loadFailed'))
  } finally {
    inviteRewardLoading.value = false
  }
}

const loadMemberGroupQrcode = async () => {
  memberGroupQrcodeLoading.value = true
  try {
    const data = await fetchMemberGroupQrcode()
    memberGroupQrcodeUrl.value = data?.imageUrl || ''
    memberGroupQrcodeUpdatedAt.value = data?.updatedAt || null
  } catch (error) {
    if (error?.response?.status !== 404) {
      console.warn('Failed to load member group qrcode', error)
      message.error(t('memberSettings.qrCode.messages.loadFailed'))
    }
    memberGroupQrcodeUrl.value = ''
    memberGroupQrcodeUpdatedAt.value = null
  } finally {
    memberGroupQrcodeLoading.value = false
  }
}

const loadMemberOpenLogs = async ({ pageOverride } = {}) => {
  if (typeof pageOverride === 'number') {
    memberLogPagination.current = pageOverride
  }

  memberLogLoading.value = true
  try {
    const { content, totalElements, page, size } = await fetchMemberOpenLogs({
      page: memberLogPagination.current,
      size: memberLogPagination.pageSize,
      featureCode: memberLogFilters.featureCode,
    })
    memberOpenLogs.value = (content || []).map((item, index) => normalizeMemberLog(item, index))
    memberLogPagination.total = totalElements
    memberLogPagination.current = page
    memberLogPagination.pageSize = size
  } catch (error) {
    console.warn('Failed to load member open logs', error)
    message.error(t('memberSettings.logs.messages.loadFailed'))
  } finally {
    memberLogLoading.value = false
  }
}

const handleMemberLogSearch = () => {
  memberLogPagination.current = 1
  loadMemberOpenLogs({ pageOverride: 1 })
}

const handleMemberLogTableChange = (pager) => {
  memberLogPagination.current = pager?.current ?? 1
  memberLogPagination.pageSize = pager?.pageSize ?? memberLogPagination.pageSize
  loadMemberOpenLogs()
}

const handleSettingsReload = () => {
  loadMemberSettings()
  loadAllPackVersions()
}

const loadMemberSettings = () => {
  loadMemberRechargeConfig()
  loadMemberInviteRewardConfig()
  loadMemberGroupQrcode()
}

const handleMemberGroupQrcodeUpload = async (event) => {
  const file = event?.target?.files?.[0]
  if (!file) {
    return
  }

  memberGroupQrcodeUploading.value = true
  try {
    const data = await uploadMemberGroupQrcode(file)
    memberGroupQrcodeUrl.value = data?.imageUrl || ''
    memberGroupQrcodeUpdatedAt.value = data?.updatedAt || new Date().toISOString()
    message.success(t('memberSettings.qrCode.messages.uploadSuccess'))
  } catch (error) {
    console.warn('Failed to upload member group qrcode', error)
    message.error(t('memberSettings.qrCode.messages.uploadFailed'))
  } finally {
    memberGroupQrcodeUploading.value = false
    if (event?.target) {
      event.target.value = ''
    }
  }
}

const submitMemberRechargeConfig = async () => {
  priceSaving.value = true
  try {
    const payload = priceFieldKeys.reduce((acc, key) => {
      acc[key] = Number(priceForm[key] ?? 0)
      return acc
    }, {
      cashPaymentEnabled: Boolean(persistedRechargeConfig.cashPaymentEnabled),
    })
    const data = await saveMemberRechargeConfig(payload)
    priceFieldKeys.forEach((key) => {
      persistedRechargeConfig[key] = Number(payload[key] ?? 0)
    })
    priceUpdatedAt.value = data?.updatedAt || new Date().toISOString()
    message.success(t('memberSettings.price.messages.saveSuccess'))
  } catch (error) {
    console.warn('Failed to save member recharge config', error)
    message.error(t('memberSettings.price.messages.saveFailed'))
  } finally {
    priceSaving.value = false
  }
}

const submitCashPaymentConfig = async () => {
  cashSaving.value = true
  try {
    const payload = priceFieldKeys.reduce((acc, key) => {
      acc[key] = Number(persistedRechargeConfig[key] ?? 0)
      return acc
    }, {
      cashPaymentEnabled: Boolean(cashPaymentEnabled.value),
    })
    const data = await saveMemberRechargeConfig(payload)
    persistedRechargeConfig.cashPaymentEnabled = Boolean(cashPaymentEnabled.value)
    priceUpdatedAt.value = data?.updatedAt || new Date().toISOString()
    message.success(t('memberSettings.cashPayment.messages.saveSuccess'))
    return true
  } catch (error) {
    console.warn('Failed to save cash payment config', error)
    cashPaymentEnabled.value = Boolean(persistedRechargeConfig.cashPaymentEnabled)
    message.error(t('memberSettings.cashPayment.messages.saveFailed'))
    return false
  } finally {
    cashSaving.value = false
  }
}

const handleCashPaymentToggle = async (checked) => {
  cashPaymentEnabled.value = Boolean(checked)
  await submitCashPaymentConfig()
}

const submitMemberInviteRewardConfig = async () => {
  inviteRewardSaving.value = true
  try {
    const payload = Object.keys(inviteRewardForm).reduce((acc, key) => {
      acc[key] = Number(inviteRewardForm[key] ?? 0)
      return acc
    }, {})
    const data = await saveMemberInviteRewardConfig(payload)
    inviteRewardUpdatedAt.value = data?.updatedAt || new Date().toISOString()
    message.success(t('memberSettings.inviteReward.messages.saveSuccess'))
  } catch (error) {
    console.warn('Failed to save member invite reward config', error)
    message.error(t('memberSettings.inviteReward.messages.saveFailed'))
  } finally {
    inviteRewardSaving.value = false
  }
}

const loadPackVersion = async (type) => {
  const config = packConfigs.value.find((item) => item.key === type)
  if (!config) return

  uploadState[type].loading = true
  try {
    const data = await config.fetchVersion()
    uploadState[type].currentFileName = data?.fileName || ''
    uploadState[type].currentVersion = data?.version || ''
    if (!uploadState[type].version) {
      uploadState[type].version = bumpPatchVersion(data?.version)
    }
  } catch (error) {
    if (error?.response?.status !== 404) {
      console.warn(`Failed to load ${type} pack version`, error)
      message.error(t(`memberSettings.upload.${type}.messages.loadVersionFailed`))
    }
    uploadState[type].currentFileName = ''
    uploadState[type].currentVersion = ''
    if (!uploadState[type].version) {
      uploadState[type].version = '1.0.0'
    }
  } finally {
    uploadState[type].loading = false
  }
}

const loadAllPackVersions = () => {
  packConfigs.value.forEach((config) => loadPackVersion(config.key))
}

const handlePackFileChange = (type, event) => {
  const [file] = Array.from(event?.target?.files || [])
  uploadState[type].file = file || null
  uploadState[type].result = null
  if (event?.target) {
    event.target.value = ''
  }
}

const clearPackFile = (type) => {
  uploadState[type].file = null
  uploadState[type].result = null
}

const submitPackUpload = async (type) => {
  const config = packConfigs.value.find((item) => item.key === type)
  if (!config) return
  const file = uploadState[type].file
  if (!file) {
    message.warning(t(`memberSettings.upload.${type}.messages.noFile`))
    return
  }
  if (!String(uploadState[type].version || '').trim()) {
    message.warning(t('memberSettings.upload.messages.noVersion'))
    return
  }

  uploadState[type].uploading = true
  try {
    const data = await config.upload(file, uploadState[type].version.trim())
    uploadState[type].result = normalizeUploadResult(data, config.buildDownloadUrl)
    uploadState[type].currentFileName = uploadState[type].result.objectName
    uploadState[type].currentVersion = uploadState[type].version.trim()
    uploadState[type].version = bumpPatchVersion(uploadState[type].currentVersion)
    uploadState[type].file = null
    message.success(t(`memberSettings.upload.${type}.messages.uploadSuccess`))
  } catch (error) {
    console.warn(`Failed to upload ${type} pack`, error)
    message.error(t(`memberSettings.upload.${type}.messages.uploadFailed`))
  } finally {
    uploadState[type].uploading = false
  }
}

onMounted(() => {
  loadMemberOpenLogs()
  loadMemberSettings()
  loadAllPackVersions()
})
</script>

<template>
  <div class="member-settings-wrapper">
    <div class="member-settings-header">
      <div>
        <h2>{{ t('memberSettings.title') }}</h2>
        <p>{{ t('memberSettings.subtitle') }}</p>
      </div>
    </div>

    <a-tabs v-model:activeKey="memberSettingsTab" class="member-settings-tabs">
      <a-tab-pane key="settings" :tab="t('memberSettings.tabs.settings')">
        <div class="actions actions--inline member-settings-tab-actions">
          <a-button :loading="settingsReloadLoading" @click="handleSettingsReload">
            <template #icon><ReloadOutlined /></template>
            {{ t('memberSettings.actions.reload') }}
          </a-button>
        </div>
        <section class="settings-panel">
      <header class="section-header">
        <div>
          <h3>{{ t('memberSettings.qrCode.title') }}</h3>
          <p>{{ t('memberSettings.qrCode.subtitle') }}</p>
        </div>
        <span class="updated-at">
          {{ t('memberSettings.qrCode.updatedAt', { time: formattedMemberGroupQrcodeUpdatedAt }) }}
        </span>
      </header>
      <a-spin :spinning="memberGroupQrcodeLoading">
        <div class="member-qrcode-panel">
          <div class="member-qrcode-upload">
            <label class="pack-upload__trigger">
              <input
                class="pack-upload__input"
                type="file"
                accept="image/*"
                :disabled="memberGroupQrcodeUploading"
                @change="handleMemberGroupQrcodeUpload"
              />
              <a-button type="dashed" :loading="memberGroupQrcodeUploading">
                <template #icon><UploadOutlined /></template>
                {{
                  memberGroupQrcodeUrl
                    ? t('memberSettings.qrCode.actions.uploadReplace')
                    : t('memberSettings.qrCode.actions.upload')
                }}
              </a-button>
            </label>
            <span v-if="memberGroupQrcodeUrl" class="pack-upload__name pack-upload__name--wide">
              {{ resolveMemberGroupQrcodeFileName(memberGroupQrcodeUrl) }}
            </span>
          </div>
          <p class="helper-text">{{ t('memberSettings.qrCode.helper') }}</p>
          <div v-if="memberGroupQrcodeUrl" class="member-qrcode-preview">
            <img
              :src="resolveMemberGroupQrcodeImageUrl(memberGroupQrcodeUrl)"
              :alt="t('memberSettings.qrCode.title')"
            />
          </div>
        </div>
      </a-spin>
        </section>
        <section class="settings-panel">
      <header class="section-header">
        <div>
          <h3>{{ t('memberSettings.price.title') }}</h3>
          <p>{{ t('memberSettings.price.subtitle') }}</p>
        </div>
        <span class="updated-at">{{ t('memberSettings.price.updatedAt', { time: formattedPriceUpdatedAt }) }}</span>
      </header>
      <a-spin :spinning="priceLoading">
        <a-form
          ref="priceFormRef"
          :model="priceForm"
          :rules="priceRules"
          layout="vertical"
          @finish="submitMemberRechargeConfig"
        >
          <div class="price-groups">
            <section v-for="group in priceGroups" :key="group.key" class="price-type-section">
              <header class="price-type-section__header">
                <h4>{{ group.title }}</h4>
                <span>{{ group.subtitle }}</span>
              </header>
              <div class="price-type-section__rows">
                <div v-for="row in group.rows" :key="row.key" class="price-row">
                  <div class="price-row__label">{{ row.label }}</div>
                  <div class="price-row__fields">
                    <a-form-item v-for="field in row.fields" :key="field.key" :name="field.key" :label="field.label">
                      <a-input-number
                        v-model:value="priceForm[field.key]"
                        class="price-input"
                        :min="0"
                        :precision="2"
                        :addon-after="field.addon"
                      />
                    </a-form-item>
                  </div>
                </div>
              </div>
            </section>
          </div>
          <div class="actions">
            <a-button type="primary" html-type="submit" :loading="priceSaving">
              <template #icon><SaveOutlined /></template>
              {{ t('memberSettings.price.actions.save') }}
            </a-button>
          </div>
        </a-form>
      </a-spin>
        </section>

        <section class="settings-panel">
      <header class="section-header">
        <div>
          <h3>{{ t('memberSettings.cashPayment.title') }}</h3>
          <p>{{ t('memberSettings.cashPayment.subtitle') }}</p>
        </div>
        <span class="updated-at">
          {{ t('memberSettings.cashPayment.updatedAt', { time: formattedCashUpdatedAt }) }}
        </span>
      </header>
      <a-spin :spinning="priceLoading">
        <div class="payment-option-row">
          <div class="payment-option-row__content">
            <div class="price-row__label">{{ t('memberSettings.cashPayment.field') }}</div>
            <p class="helper-text">{{ t('memberSettings.cashPayment.helper') }}</p>
          </div>
          <div class="payment-option-row__switch">
            <a-switch
              :checked="cashPaymentEnabled"
              :loading="cashSaving"
              :disabled="priceLoading || cashSaving"
              @change="handleCashPaymentToggle"
            />
            <span class="payment-option-row__status">
              {{ cashPaymentEnabled ? t('memberSettings.cashPayment.switch.checked') : t('memberSettings.cashPayment.switch.unchecked') }}
            </span>
          </div>
        </div>
      </a-spin>
        </section>

        <section class="settings-panel">
      <header class="section-header">
        <div>
          <h3>{{ t('memberSettings.inviteReward.title') }}</h3>
          <p>{{ t('memberSettings.inviteReward.subtitle') }}</p>
        </div>
        <span class="updated-at">
          {{ t('memberSettings.inviteReward.updatedAt', { time: formattedInviteRewardUpdatedAt }) }}
        </span>
      </header>
      <a-spin :spinning="inviteRewardLoading">
        <a-form
          ref="inviteRewardFormRef"
          :model="inviteRewardForm"
          :rules="inviteRewardRules"
          layout="vertical"
          @finish="submitMemberInviteRewardConfig"
        >
          <div class="invite-reward-fields">
            <a-form-item
              v-for="field in inviteRewardFields"
              :key="field.key"
              :name="field.key"
              :label="field.label"
            >
              <a-input-number
                v-model:value="inviteRewardForm[field.key]"
                class="price-input"
                :min="0"
                :precision="2"
                :addon-after="t('memberSettings.units.flp')"
              />
            </a-form-item>
          </div>
          <p class="helper-text">{{ t('memberSettings.inviteReward.helper') }}</p>
          <div class="actions">
            <a-button type="primary" html-type="submit" :loading="inviteRewardSaving">
              <template #icon><SaveOutlined /></template>
              {{ t('memberSettings.inviteReward.actions.save') }}
            </a-button>
            <a-button :loading="inviteRewardLoading" @click="loadMemberInviteRewardConfig">
              <template #icon><ReloadOutlined /></template>
              {{ t('memberSettings.inviteReward.actions.reload') }}
            </a-button>
          </div>
        </a-form>
      </a-spin>
        </section>

        <div class="upload-grid">
          <section v-for="config in packConfigs" :key="config.key" class="settings-panel upload-panel">
        <header class="section-header">
          <div>
            <h3>{{ config.title }}</h3>
            <p>{{ config.subtitle }}</p>
          </div>
          <a-button size="small" :loading="uploadState[config.key].loading" @click="loadPackVersion(config.key)">
            {{ t('memberSettings.upload.actions.reloadVersion') }}
          </a-button>
        </header>
        <div class="pack-current">
          <div>
            <span class="pack-current__label">{{ t('memberSettings.upload.currentVersion') }}</span>
            <span class="pack-current__value">
              {{ uploadState[config.key].currentVersion || t('memberSettings.upload.emptyVersion') }}
            </span>
          </div>
          <div>
            <span class="pack-current__label">{{ t('memberSettings.upload.currentFile') }}</span>
            <a
              v-if="uploadState[config.key].currentFileName"
              :href="config.buildDownloadUrl(uploadState[config.key].currentFileName)"
              target="_blank"
              class="pack-current__link"
            >
              {{ uploadState[config.key].currentFileName }}
            </a>
            <span v-else class="pack-current__value">{{ t('memberSettings.upload.emptyFile') }}</span>
          </div>
        </div>
        <div class="pack-upload">
          <label class="pack-upload__trigger">
            <input
              class="pack-upload__input"
              type="file"
              :accept="config.accept"
              @change="handlePackFileChange(config.key, $event)"
            />
            <a-button>
              <template #icon><UploadOutlined /></template>
              {{ uploadState[config.key].file ? t('memberSettings.upload.actions.replace') : t('memberSettings.upload.actions.select') }}
            </a-button>
          </label>
          <span v-if="uploadState[config.key].file" class="pack-upload__name">{{ uploadState[config.key].file.name }}</span>
          <a-button v-if="uploadState[config.key].file" type="link" danger size="small" @click="clearPackFile(config.key)">
            {{ t('memberSettings.upload.actions.remove') }}
          </a-button>
        </div>
        <a-form layout="vertical" class="pack-version-form">
          <a-form-item :label="t('memberSettings.upload.versionLabel')" required>
            <a-input
              v-model:value="uploadState[config.key].version"
              :placeholder="t('memberSettings.upload.versionPlaceholder')"
            />
          </a-form-item>
        </a-form>
        <p class="helper-text">{{ config.helper }}</p>
        <div class="actions">
          <a-button type="primary" :loading="uploadState[config.key].uploading" @click="submitPackUpload(config.key)">
            {{ t('memberSettings.upload.actions.upload') }}
          </a-button>
        </div>
          </section>
        </div>
      </a-tab-pane>

      <a-tab-pane key="logs" :tab="t('memberSettings.tabs.logs')">
        <section class="settings-panel">
          <header class="section-header">
            <div>
              <h3>{{ t('memberSettings.logs.title') }}</h3>
              <p>{{ t('memberSettings.logs.subtitle') }}</p>
            </div>
            <div class="actions actions--inline">
              <a-input
                v-model:value="memberLogFilters.featureCode"
                :placeholder="t('memberSettings.logs.searchPlaceholder')"
                allow-clear
                class="member-log-filter"
                @pressEnter="handleMemberLogSearch"
              />
              <a-button @click="handleMemberLogSearch">
                {{ t('memberSettings.logs.actions.search') }}
              </a-button>
              <a-button :loading="memberLogLoading" @click="loadMemberOpenLogs({ pageOverride: 1 })">
                <template #icon><ReloadOutlined /></template>
                {{ t('memberSettings.logs.actions.reload') }}
              </a-button>
            </div>
          </header>
          <a-table
            :columns="memberLogColumns"
            :data-source="memberOpenLogs"
            :loading="memberLogLoading"
            :pagination="memberLogPaginationConfig"
            row-key="rowKey"
            size="small"
            :scroll="{ x: 1100 }"
            @change="handleMemberLogTableChange"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'cycle'">
                {{ formatCycle(record.cycle) }}
              </template>
              <template v-else-if="column.key === 'paymentMode'">
                {{ formatPaymentMode(record.paymentMode) }}
              </template>
              <template v-else-if="column.key === 'amount'">
                {{ Number(record.amount ?? 0) }}
              </template>
              <template v-else-if="column.key === 'memberExpireDate'">
                {{ formatDateTime(record.memberExpireDate) }}
              </template>
              <template v-else-if="column.key === 'activatedAt'">
                {{ formatDateTime(record.activatedAt) }}
              </template>
            </template>
          </a-table>
        </section>
      </a-tab-pane>
    </a-tabs>
  </div>
</template>

<style scoped>
.member-settings-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.member-settings-header,
.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.member-settings-header h2,
.section-header h3 {
  margin: 0;
  color: #111827;
}

.member-settings-header p,
.section-header p {
  margin: 6px 0 0;
  color: #6b7280;
}

.settings-panel {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
}

.updated-at {
  color: #6b7280;
  font-size: 0.9rem;
  white-space: nowrap;
}

.price-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 16px;
}

.price-type-section {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  padding: 16px;
}

.price-type-section__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.price-type-section__header h4 {
  margin: 0;
  color: #111827;
  font-size: 1rem;
}

.price-type-section__header span {
  color: #6b7280;
  font-size: 0.9rem;
}

.price-type-section__rows {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.price-row {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  align-items: start;
  border-top: 1px solid #e5e7eb;
  padding-top: 12px;
}

.price-row:first-child {
  border-top: none;
  padding-top: 0;
}

.price-row__label {
  color: #111827;
  font-weight: 600;
  line-height: 32px;
}

.price-row__fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
  gap: 12px;
}

.price-row__fields :deep(.ant-form-item) {
  margin-bottom: 0;
}

.payment-option-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.payment-option-row__content {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.payment-option-row__switch {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.payment-option-row__status {
  color: #374151;
  font-weight: 600;
}

.price-input {
  width: 100%;
}

.invite-reward-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 1fr));
  gap: 12px;
  margin-top: 16px;
}

.invite-reward-fields :deep(.ant-form-item) {
  margin-bottom: 0;
}

.member-qrcode-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.member-qrcode-upload {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.member-qrcode-preview {
  width: min(220px, 100%);
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #f9fafb;
  padding: 12px;
}

.member-qrcode-preview img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 8px;
  object-fit: contain;
}

.upload-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}

.upload-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.pack-upload {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.pack-current {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f9fafb;
  padding: 12px;
}

.pack-current__label {
  display: inline-block;
  min-width: 80px;
  color: #6b7280;
  font-size: 0.9rem;
}

.pack-current__value,
.pack-current__link {
  color: #111827;
  font-weight: 600;
  word-break: break-all;
}

.pack-current__link {
  color: #2563eb;
}

.pack-upload__trigger {
  position: relative;
  display: inline-flex;
}

.pack-upload__input {
  position: absolute;
  inset: 0;
  z-index: 1;
  opacity: 0;
  cursor: pointer;
}

.pack-upload__name {
  max-width: 240px;
  overflow: hidden;
  color: #374151;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pack-upload__name--wide {
  max-width: 100%;
}

.pack-version-form :deep(.ant-form-item) {
  margin-bottom: 0;
}

.helper-text {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.actions--inline {
  margin-top: 0;
  align-items: center;
  justify-content: flex-end;
}

.member-settings-tab-actions {
  margin-bottom: 12px;
}

.member-log-filter {
  width: 220px;
}

@media (max-width: 720px) {
  .member-settings-header,
  .section-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .updated-at {
    white-space: normal;
  }

  .price-type-section__header,
  .price-row {
    grid-template-columns: 1fr;
  }

  .payment-option-row {
    align-items: flex-start;
    flex-direction: column;
  }

  .price-type-section__header {
    align-items: flex-start;
    flex-direction: column;
  }

  .price-row__fields {
    grid-template-columns: 1fr;
  }

  .invite-reward-fields {
    grid-template-columns: 1fr;
  }

  .member-log-filter {
    width: 100%;
  }
}
</style>
