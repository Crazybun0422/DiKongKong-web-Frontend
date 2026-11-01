<script setup>
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { ReloadOutlined, UploadOutlined } from '@ant-design/icons-vue'
import { useI18n } from 'vue-i18n'
import { inspectXinggePack } from '../utils/xingge-pack'
import { downloadSkyTypeAvatarPack } from '../services/skyTypeAvatarPack'
import {
  fetchSkyTypeAvatarPackVersion,
  uploadSkyTypeAvatarPack,
} from '../services/skyTypeAvatarPack'
import { extractObjectName } from '../services/files'

const { t } = useI18n()

const packLoading = ref(false)
const packSaving = ref(false)
const packChecking = ref(false)
const packError = ref('')
const selectedFile = ref(null)
const fileInputRef = ref(null)

const packConfig = reactive({
  fileName: '',
  version: '',
})

const packForm = reactive({
  fileName: '',
  version: '',
})

const packageTree = `manifest.json
role-professional_agriculture-male.png
role-professional_agriculture-female.png
… 19 个角色 × 男女两版
style-craft-male.png
style-craft-female.png
… 6 个副称号 × 男女两版
共 50 张 PNG，全部位于 ZIP 根目录`

const loadPackVersion = async () => {
  packLoading.value = true
  try {
    const data = await fetchSkyTypeAvatarPackVersion()
    const normalized = data || {}
    packConfig.fileName = normalized.status === 'ready' && normalized.schemaVersion === 2 ? extractObjectName(normalized.fileName || '') : ''
    packConfig.version = packConfig.fileName ? normalized.resourceVersion : ''
  } catch (error) {
    if (error?.response?.status !== 404) {
      console.error('Failed to load sky type avatar pack config', error)
      message.error(t('settings.system.skyTypeAvatarPack.messages.loadFailed'))
    }
    packConfig.fileName = ''
    packConfig.version = ''
  } finally {
    packLoading.value = false
  }
}

let selectionSequence = 0
const handleFileSelect = async (event) => {
  const file = event?.target?.files?.[0]
  const sequence = ++selectionSequence
  selectedFile.value = null
  packForm.fileName = ''
  packForm.version = ''
  packError.value = ''
  if (event?.target) event.target.value = ''
  packChecking.value = !!file
  if (!file) return
  try {
    const manifest = await inspectXinggePack(file)
    if (sequence !== selectionSequence) return
    selectedFile.value = file
    packForm.fileName = file.name
    packForm.version = manifest.resourceVersion
  } catch (error) {
    if (sequence === selectionSequence) {
      packError.value = file.name + '：' + (error.message || '无法读取图包清单。')
      message.error(packError.value)
    }
  } finally { if (sequence === selectionSequence) packChecking.value = false }
}

const downloadCurrent = async () => {
  try { await downloadSkyTypeAvatarPack(packConfig.fileName) }
  catch (_) { message.error('图包下载失败，请重试。') }
}

const clearSelection = () => {
  selectionSequence++
  packForm.version = ''
  selectedFile.value = null
  packForm.fileName = ''
  packChecking.value = false
  packError.value = ''
}

const triggerFileSelect = () => {
  if (packSaving.value) return
  fileInputRef.value?.click()
}

const submitUpload = async () => {
  if (!selectedFile.value) {
    message.warning(t('settings.system.skyTypeAvatarPack.messages.noFile'))
    return
  }
  const version = String(packForm.version || '').trim()
  if (!version) {
    message.warning(t('settings.system.skyTypeAvatarPack.messages.noVersion'))
    return
  }
  if (packSaving.value) return

  packSaving.value = true
  packError.value = ''
  try {
    await uploadSkyTypeAvatarPack(selectedFile.value, version)
    message.success(t('settings.system.skyTypeAvatarPack.messages.uploadSuccess'))
    clearSelection()
    await loadPackVersion()
  } catch (error) {
    console.error('Failed to upload sky type avatar pack', error)
    packError.value = error?.response?.data?.message?.zh || (error.code === 'ECONNABORTED' ? '上传超时，请检查网络后重试。' : t('settings.system.skyTypeAvatarPack.messages.uploadFailed'))
    message.error(packError.value)
  } finally {
    packSaving.value = false
  }
}

onMounted(() => {
  loadPackVersion()
})
</script>

<template>
  <section class="skytype-pack">
    <header class="section-header skytype-pack__header">
      <div>
        <h3>{{ t('settings.system.skyTypeAvatarPack.title') }}</h3>
        <p>{{ t('settings.system.skyTypeAvatarPack.subtitle') }}</p>
      </div>
      <div class="skytype-pack__meta">
        <span class="skytype-pack__meta-label">
          {{ t('settings.system.skyTypeAvatarPack.currentVersionLabel') }}
        </span>
        <span class="skytype-pack__meta-value">
          {{ packConfig.version || t('settings.system.skyTypeAvatarPack.emptyVersion') }}
        </span>
      </div>
    </header>

    <a-spin :spinning="packLoading">
      <div class="skytype-pack__current">
        <span class="skytype-pack__current-label">
          {{ t('settings.system.skyTypeAvatarPack.currentFileLabel') }}
        </span>
        <a-button v-if="packConfig.fileName" type="link" @click="downloadCurrent">
          {{ packConfig.fileName }}
        </a-button>
        <span v-else class="empty-hint">
          {{ t('settings.system.skyTypeAvatarPack.emptyFile') }}
        </span>
      </div>

      <div class="skytype-pack__content">
        <div class="skytype-pack__form">
          <a-form layout="vertical">
            <a-form-item :label="t('settings.system.skyTypeAvatarPack.fields.file')">
              <div class="skytype-pack__upload">
                <input
                  ref="fileInputRef"
                  class="skytype-pack__input"
                  type="file"
                  accept=".zip,application/zip"
                  :disabled="packSaving"
                  hidden
                  @change="handleFileSelect"
                />
                <div class="skytype-pack__trigger">
                  <a-button type="dashed" :loading="packChecking" :disabled="packSaving" @click="triggerFileSelect">
                    <template #icon><UploadOutlined /></template>
                    {{
                      packForm.fileName
                        ? t('settings.system.skyTypeAvatarPack.actions.replaceFile')
                        : t('settings.system.skyTypeAvatarPack.actions.selectFile')
                    }}
                  </a-button>
                </div>
                <span v-if="packForm.fileName" class="skytype-pack__file-name">
                  {{ packForm.fileName }}
                </span>
                <a-button v-if="packForm.fileName" type="link" danger @click="clearSelection">
                  {{ t('settings.system.skyTypeAvatarPack.actions.removeFile') }}
                </a-button>
              </div>
              <div class="skytype-pack__helper">
                {{ t('settings.system.skyTypeAvatarPack.helper') }}
              </div>
              <a-alert v-if="packError" type="error" show-icon :message="packError" />
              <a-alert v-else-if="packForm.fileName" type="success" show-icon :message="'已读取完整 50 张图片，资源版本：' + packForm.version" />
            </a-form-item>

            <a-form-item :label="t('settings.system.skyTypeAvatarPack.fields.version')">
              <a-input
                v-model:value="packForm.version"
                readonly
                :placeholder="t('settings.system.skyTypeAvatarPack.placeholders.version')"
              />
            </a-form-item>

            <div class="skytype-pack__actions">
              <a-button type="primary" :loading="packSaving" :disabled="packChecking" @click="submitUpload">
                {{ t('settings.system.skyTypeAvatarPack.actions.upload') }}
              </a-button>
              <a-button type="default" :disabled="packSaving || packLoading" @click="loadPackVersion">
                <template #icon><ReloadOutlined /></template>
                {{ t('settings.system.skyTypeAvatarPack.actions.reload') }}
              </a-button>
            </div>
          </a-form>
        </div>

        <div class="skytype-pack__spec">
          <div class="skytype-pack__spec-title">
            {{ t('settings.system.skyTypeAvatarPack.structureTitle') }}
          </div>
          <pre class="skytype-pack__tree">{{ packageTree }}</pre>
        </div>
      </div>
    </a-spin>
  </section>
</template>

<style scoped>
.skytype-pack {
  display: flex;
  flex-direction: column;
  gap: 20px;
  border-radius: 16px;
  background: var(--admin-surface);
  padding: 24px;
  box-shadow: 0 4px 18px #00000014;
}

.skytype-pack__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
}

.skytype-pack__meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  color: var(--admin-muted);
  font-size: 13px;
}

.skytype-pack__meta-label,
.skytype-pack__current-label,
.skytype-pack__spec-title {
  color: var(--admin-muted);
  font-weight: 600;
}

.skytype-pack__meta-value {
  color: var(--admin-text);
  font-weight: 600;
}

.skytype-pack__current {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  font-size: 14px;
}

.skytype-pack__content {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
  gap: 24px;
}

.skytype-pack__upload {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.skytype-pack__trigger {
  display: inline-flex;
}

.skytype-pack__input {
  display: none;
}

.skytype-pack__file-name {
  font-size: 13px;
  color: var(--admin-text);
  word-break: break-all;
}

.skytype-pack__helper {
  margin-top: 8px;
  color: var(--admin-muted);
  font-size: 13px;
}

.skytype-pack__actions {
  display: flex;
  gap: 12px;
}

.skytype-pack__spec {
  border-radius: 12px;
  background: linear-gradient(180deg, var(--admin-raised) 0%, var(--admin-raised) 100%);
  padding: 16px;
  border: 1px solid var(--admin-line);
}

.skytype-pack__tree {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--admin-text);
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 960px) {
  .skytype-pack__header {
    flex-direction: column;
  }

  .skytype-pack__meta {
    align-items: flex-start;
  }

  .skytype-pack__content {
    grid-template-columns: 1fr;
  }
}
</style>
