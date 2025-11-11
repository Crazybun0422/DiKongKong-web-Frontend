<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
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
} from '../../services/config'
import { fetchWechatPayConfig, saveWechatPayConfig } from '../../services/wechatPayConfig'
import { fetchWeappConfig, saveWeappConfig } from '../../services/weappConfig'
import { fetchFlpLogs } from '../../services/flp'
import { resolveProfileAsset } from '../../services/profile'
import OpenPlatformEditor from '../../components/OpenPlatformEditor.vue'

const { t } = useI18n()

const activeTab = ref('invite')

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

const inviteColumns = computed(() => [
  { title: t('settings.invite.logs.columns.featureCode'), dataIndex: ['user', 'featureCode'], key: 'featureCode' },
  { title: t('settings.invite.logs.columns.username'), dataIndex: ['user', 'username'], key: 'username' },
  { title: t('settings.invite.logs.columns.avatar'), dataIndex: ['user', 'avatarUrl'], key: 'avatar', width: 120 },
  { title: t('settings.invite.logs.columns.amount'), dataIndex: 'amount', key: 'amount', width: 140 },
  { title: t('settings.invite.logs.columns.operation'), dataIndex: 'operation', key: 'operation', width: 140 },
  { title: t('settings.invite.logs.columns.createdAt'), dataIndex: 'createdAt', key: 'createdAt', width: 200 },
])

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
    })
    inviteLogs.value = (content || []).map((item) => ({
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

watch(copyType, (next, previous) => {
  if (next !== previous) {
    loadCopyContent()
  }
})

onMounted(() => {
  loadInviteConfig()
  loadInviteLogs()
  loadMapConfig()
  loadCopyContent()
  loadPaymentConfig()
  loadWeappConfig()
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
                    :placeholder="t('settings.copySettings.form.placeholder')"
                    :disabled="copyLoading || copySaving" />
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
}
</style>
