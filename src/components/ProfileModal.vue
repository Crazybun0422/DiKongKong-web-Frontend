<script setup>
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import AvatarCropper from './AvatarCropper.vue'
import { fetchProfile, updateProfile, uploadAvatar, resolveProfileAsset } from '../services/profile'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['update:visible', 'updated'])
const { t } = useI18n()

const loading = ref(false)
const submitting = ref(false)
const uploadLoading = ref(false)

const cropperVisible = ref(false)
const cropperSource = ref('')
const fileInput = ref(null)

const form = reactive({
  username: '',
  email: '',
  avatarPreviewUrl: '',
  avatarObjectName: '',
  avatarOriginal: '',
})

const hasAvatar = computed(() => !!form.avatarPreviewUrl)

const resetState = () => {
  form.username = ''
  form.email = ''
  form.avatarPreviewUrl = ''
  form.avatarObjectName = ''
  form.avatarOriginal = ''
  uploadLoading.value = false
  cropperVisible.value = false
  cropperSource.value = ''
}

const loadProfile = async () => {
  loading.value = true
  try {
    const profile = await fetchProfile()
    form.username = profile?.username || ''
    form.email = profile?.email || ''
    form.avatarOriginal = profile?.avatarOriginal || ''
    form.avatarObjectName = profile?.avatarObjectName || ''
    form.avatarPreviewUrl = resolveProfileAsset(
      profile?.avatarObjectName || profile?.avatarOriginal || '',
    )
  } catch (error) {
    console.error('fetch profile error', error)
    message.error(t('profile.fetchError'))
  } finally {
    loading.value = false
  }
}

const beforeUpload = (file) => {
  const isValidType = ['image/jpeg', 'image/png'].includes(file.type)
  if (!isValidType) {
    message.error(t('profile.uploadError'))
    return false
  }
  const isLt2M = file.size / 1024 / 1024 < 2
  if (!isLt2M) {
    message.error(t('profile.uploadError'))
    return false
  }
  return true
}

const openCropper = (file) => {
  const reader = new FileReader()
  reader.onload = () => {
    cropperSource.value = reader.result
    cropperVisible.value = true
  }
  reader.readAsDataURL(file)
}

const triggerFilePicker = () => {
  if (uploadLoading.value) return
  fileInput.value?.click()
}

const handleFileChange = (event) => {
  const inputEl = event.target
  const file = inputEl?.files?.[0]
  if (file && beforeUpload(file)) {
    openCropper(file)
  }
  if (inputEl) inputEl.value = ''
}

const handleDrop = (event) => {
  if (uploadLoading.value) return
  const file = event.dataTransfer?.files?.[0]
  if (file && beforeUpload(file)) {
    openCropper(file)
  }
}

const handleCropConfirm = async (blob) => {
  uploadLoading.value = true
  try {
    const file = new File([blob], `avatar-${Date.now()}.png`, { type: 'image/png' })
    const result = await uploadAvatar(file)
    form.avatarObjectName = result.objectName
    form.avatarOriginal = result.original
    form.avatarPreviewUrl = result.url
    message.success(t('profile.uploadSuccess'))
  } catch (error) {
    console.error('upload avatar error', error)
    message.error(t('profile.uploadError'))
  } finally {
    cropperVisible.value = false
    cropperSource.value = ''
    uploadLoading.value = false
  }
}

const handleCropCancel = () => {
  cropperVisible.value = false
  cropperSource.value = ''
  uploadLoading.value = false
}

const handleCropClear = () => {
  cropperVisible.value = false
  cropperSource.value = ''
  uploadLoading.value = false
  form.avatarPreviewUrl = ''
  form.avatarObjectName = ''
  form.avatarOriginal = ''
  message.success(t('profile.reset'))
}

const handleSubmit = async () => {
  submitting.value = true
  try {
    await updateProfile({
      email: form.email,
      avatarUrl: form.avatarObjectName || form.avatarOriginal,
    })
    message.success(t('profile.updateSuccess'))
    emit('updated', {
      username: form.username,
      email: form.email,
      avatarUrl: form.avatarPreviewUrl,
      avatarObjectName: form.avatarObjectName,
      avatarOriginal: form.avatarOriginal,
    })
    emit('update:visible', false)
  } catch (error) {
    console.error('update profile error', error)
    message.error(t('messages.requestFailed'))
  } finally {
    submitting.value = false
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      loadProfile()
    } else {
      resetState()
    }
  },
)
</script>

<template>
  <a-modal
    :open="visible"
    :confirm-loading="submitting"
    width="520"
    centered
    :title="t('profile.title')"
    :ok-text="t('profile.update')"
    :cancel-text="t('profile.cancel')"
    @ok="handleSubmit"
    @cancel="emit('update:visible', false)"
  >
    <a-spin :spinning="loading">
      <div class="profile-form">
        <div class="field">
          <label>{{ t('auth.adminAccount') }}</label>
          <input class="input" type="text" :value="form.username" disabled />
        </div>
        <div class="field">
          <label>{{ t('profile.email') }}</label>
          <input class="input" type="email" v-model="form.email" placeholder="admin@example.com" />
        </div>

        <div class="avatar-block">
          <div class="avatar-preview">
            <img v-if="hasAvatar" :src="form.avatarPreviewUrl" alt="avatar" />
            <span v-else>{{ form.username?.slice(0, 1)?.toUpperCase() || 'A' }}</span>
          </div>
          <div class="avatar-panel">
            <p class="avatar-title">{{ t('profile.changeAvatar') }}</p>
            <div
              class="dropzone"
              :class="{ uploading: uploadLoading }"
              @click="triggerFilePicker"
              @drop.prevent="handleDrop"
              @dragover.prevent
            >
              <div v-if="uploadLoading" class="dropzone-loading">
                <a-spin />
                <p>{{ t('profile.uploading') }}</p>
              </div>
              <div v-else class="dropzone-body">
                <span class="dropzone-icon">📁</span>
                <p class="dropzone-title">{{ t('profile.dragTitle') }}</p>
                <p class="dropzone-subtitle">{{ t('profile.dragSubtitle') }}</p>
                <button class="dropzone-button" type="button" @click.stop="triggerFilePicker">
                  {{ t('profile.selectFile') }}
                </button>
                <input
                  ref="fileInput"
                  class="hidden-input"
                  type="file"
                  accept="image/png,image/jpeg"
                  @change="handleFileChange"
                />
              </div>
            </div>
            <p class="avatar-hint">{{ t('profile.uploadHint') }}</p>
            <button
              v-if="hasAvatar"
              class="reset-btn"
              type="button"
              @click="handleCropClear"
            >
              {{ t('profile.reset') }}
            </button>
          </div>
        </div>
      </div>
    </a-spin>

    <AvatarCropper
      :visible="cropperVisible"
      :src="cropperSource"
      @confirm="handleCropConfirm"
      @cancel="handleCropCancel"
      @clear="handleCropClear"
    />
  </a-modal>
</template>

<style scoped>
.profile-form {
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.field label {
  font-weight: 600;
  color: #0f172a;
}

.input {
  width: 100%;
  padding: 0.65rem 0.9rem;
  border-radius: 12px;
  border: 1px solid #d4dbe8;
  background: #f8fafc;
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.18);
  outline: none;
}

.avatar-block {
  display: flex;
  gap: 1.75rem;
  align-items: stretch;
}

.avatar-preview {
  width: 118px;
  height: 118px;
  border-radius: 26px;
  background: linear-gradient(135deg, #e0f2fe, #bfdbfe);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.8rem;
  color: #0f172a;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.55), 0 16px 32px rgba(15, 23, 42, 0.18);
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.avatar-title {
  font-weight: 600;
  color: #0f172a;
  margin: 0;
}

.dropzone {
  position: relative;
  border-radius: 20px;
  border: 1px dashed rgba(59, 130, 246, 0.45);
  background: linear-gradient(150deg, rgba(191, 219, 254, 0.32), rgba(219, 234, 254, 0.14));
  padding: 1.9rem 1.25rem;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
  outline: none;
}

.dropzone.uploading {
  cursor: wait;
  opacity: 0.7;
}

.dropzone:hover {
  border-color: rgba(37, 99, 235, 0.78);
  box-shadow: 0 14px 28px rgba(37, 99, 235, 0.18);
  transform: translateY(-1px);
}

.dropzone-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
}

.dropzone-icon {
  font-size: 2.1rem;
}

.dropzone-title {
  margin: 0;
  font-size: 1rem;
  color: #1d4ed8;
  font-weight: 600;
}

.dropzone-subtitle {
  margin: 0;
  color: #475569;
}

.dropzone-button {
  margin-top: 0.4rem;
  padding: 0.45rem 1.3rem;
  border-radius: 999px;
  border: none;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.dropzone-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.22);
}

.dropzone-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  color: #1d4ed8;
}

.hidden-input {
  display: none;
}

.avatar-hint {
  color: #64748b;
  font-size: 0.92rem;
}

.reset-btn {
  align-self: flex-start;
  background: none;
  border: none;
  color: #ef4444;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  padding: 0;
}

.reset-btn:hover {
  text-decoration: underline;
}

@media (max-width: 560px) {
  .avatar-block {
    flex-direction: column;
  }

  .avatar-preview {
    align-self: center;
  }
}
</style>
