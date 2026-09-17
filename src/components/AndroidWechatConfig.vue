<script setup>
import { onMounted, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import http from '../services/http'
const { t } = useI18n()
const appId = ref(''), appSecret = ref(''), savedAppId = ref(''), savedAppSecret = ref('')
const configured = ref(false), loading = ref(false), saving = ref(false), feedback = ref('')
async function load() {
  if (loading.value || saving.value) return
  loading.value = true; feedback.value = ''
  try {
    const { data } = await http.get('/auth/android/wechat-config')
    if (!data?.success) throw new Error()
    appId.value = savedAppId.value = data.data.appId || ''
    configured.value = data.data.secretConfigured === true
    appSecret.value = savedAppSecret.value = data.data.appSecret || ''
  } catch { feedback.value = 'loadFailed'; message.error(t('androidWechat.loadFailed')) }
  finally { loading.value = false }
}
async function save() {
  if (loading.value || saving.value) return
  const id = appId.value.trim(), secret = appSecret.value.trim()
  if (!/^wx[A-Za-z0-9]{16}$/.test(id) || (secret ? !/^[A-Za-z0-9]{32}$/.test(secret) : !configured.value || id !== savedAppId.value)
      || (id !== savedAppId.value && secret === savedAppSecret.value)) {
    feedback.value = 'invalid'; message.error(t('androidWechat.invalid')); return
  }
  saving.value = true; feedback.value = ''
  try {
    const { data } = await http.post('/auth/android/wechat-config', { appId: id, appSecret: secret })
    if (!data?.success) throw new Error()
    appId.value = savedAppId.value = data.data.appId
    configured.value = data.data.secretConfigured === true
    appSecret.value = savedAppSecret.value = data.data.appSecret || ''; feedback.value = 'saved'
    message.success(t('androidWechat.saved'))
  } catch { feedback.value = 'saveFailed'; message.error(t('androidWechat.saveFailed')) }
  finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <a-card :title="t('androidWechat.title')" style="margin-bottom: 24px">
    <p>{{ t('androidWechat.description') }}</p>
    <a-spin :spinning="loading">
      <a-form :model="{ appId, appSecret }" layout="vertical" @finish="save">
        <a-form-item name="appId" label="Android AppID">
          <a-input v-model:value="appId" placeholder="wx…" :maxlength="18" :disabled="loading || saving" />
        </a-form-item>
        <a-form-item name="appSecret" label="Android AppSecret" :help="t('androidWechat.secretHelp')">
          <a-input-password v-model:value="appSecret" autocomplete="new-password" :visibility-toggle="true" :maxlength="32" :disabled="loading || saving"
            :placeholder="t(configured ? 'androidWechat.secretSaved' : 'androidWechat.secretPlaceholder')" />
        </a-form-item>
        <a-space style="margin-top: 12px">
          <a-button type="primary" html-type="submit" :loading="saving" :disabled="loading">{{ t('common.actions.save') }}</a-button>
          <a-button @click="load" :disabled="loading || saving">{{ t('common.actions.reset') }}</a-button>
        </a-space>
        <div aria-live="polite" style="margin-top: 16px">
          <a-alert v-if="feedback" :type="feedback === 'saved' ? 'success' : 'error'" show-icon :message="t(`androidWechat.${feedback}`)" />
        </div>
      </a-form>
    </a-spin>
  </a-card>
</template>
