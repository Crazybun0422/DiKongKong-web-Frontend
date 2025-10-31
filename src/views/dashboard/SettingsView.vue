<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { fetchWeappConfig, saveWeappConfig } from '../../services/weappConfig'

const { t } = useI18n()

const formRef = ref(null)
const loading = ref(false)
const saving = ref(false)

const form = reactive({
  appId: '',
  secret: '',
  jwtSecret: '',
})

const formRules = computed(() => ({
  appId: [{ required: true, message: t('settings.weapp.validation.appId') }],
  secret: [{ required: true, message: t('settings.weapp.validation.secret') }],
  jwtSecret: [{ required: true, message: t('settings.weapp.validation.jwtSecret') }],
}))

const loadConfig = async () => {
  loading.value = true
  try {
    const data = await fetchWeappConfig()
    form.appId = data?.appId || ''
    form.secret = data?.secret || ''
    form.jwtSecret = data?.jwtSecret || ''
  } catch (error) {
    message.error(t('settings.weapp.messages.loadFailed'))
  } finally {
    loading.value = false
  }
}

const handleSubmit = async () => {
  saving.value = true
  try {
    await saveWeappConfig({
      appId: form.appId,
      secret: form.secret,
      jwtSecret: form.jwtSecret,
    })
    message.success(t('settings.weapp.messages.saveSuccess'))
  } catch (error) {
    message.error(t('settings.weapp.messages.saveFailed'))
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="settings-wrapper">
    <a-card :title="t('settings.weapp.title')" class="section-card" :bordered="false">
      <a-spin :spinning="loading">
        <a-form ref="formRef" :model="form" :rules="formRules" layout="vertical" autocomplete="off"
          @finish="handleSubmit">
          <a-row :gutter="[24, 12]">
            <a-col :xs="24" :md="12">
              <a-form-item name="appId" :label="t('settings.weapp.appId')">
                <a-input v-model:value="form.appId" :placeholder="t('settings.weapp.placeholders.appId')" allow-clear />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item name="secret" :label="t('settings.weapp.secret')">
                <a-input-password v-model:value="form.secret" :placeholder="t('settings.weapp.placeholders.secret')"
                  allow-clear />
              </a-form-item>
            </a-col>
            <a-col :xs="24" :md="12">
              <a-form-item name="jwtSecret" :label="t('settings.weapp.jwtSecret')">
                <a-input-password v-model:value="form.jwtSecret"
                  :placeholder="t('settings.weapp.placeholders.jwtSecret')" allow-clear />
              </a-form-item>
            </a-col>
          </a-row>
          <div class="actions">
            <a-button type="primary" html-type="submit" :loading="saving">
              {{ t('common.actions.save') }}
            </a-button>
            <a-button type="default" @click="loadConfig" :disabled="loading || saving">
              {{ t('common.actions.reset') }}
            </a-button>
          </div>
        </a-form>
      </a-spin>
    </a-card>
  </div>
</template>

<style scoped>
.settings-wrapper {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.section-card {
  background: #ffffff;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  border-radius: 16px;
  padding: 24px 24px 32px;
}

.actions {
  margin-top: 12px;
  display: flex;
  gap: 12px;
  justify-content: flex-start;
}

@media (max-width: 640px) {
  .section-card {
    padding: 20px;
  }

  .actions {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
