<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { DeleteOutlined, EditOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons-vue'
import {
  createDiscoveryPromotion,
  deleteDiscoveryPromotion,
  fetchDiscoveryPromotions,
  updateDiscoveryPromotion,
} from '../../services/discoveryPromotions'
import { buildDownloadUrl, uploadPublicFile } from '../../services/files'

const activePlacement = ref('BANNER')
const loading = ref(false)
const saving = ref(false)
const uploadLoading = ref(false)
const items = ref([])
const editorVisible = ref(false)
const editingId = ref('')

const emptyForm = () => ({
  placement: activePlacement.value,
  title: '',
  imageFileName: '',
  targetType: 'MINI_PROGRAM',
  miniProgramAppId: '',
  miniProgramPath: '',
  miniProgramEnvVersion: 'release',
  channelsFinderUserName: '',
  channelsFeedId: '',
  articleUrl: '',
  customerServiceUrl: '',
  sortOrder: 0,
  enabled: true,
  activeRange: [],
})

const form = reactive(emptyForm())
const filteredItems = computed(() => items.value.filter((item) => item.placement === activePlacement.value))

const placementLabel = (value) => value === 'BANNER' ? 'Banner 图片' : '生态伙伴按钮'
const targetLabel = (value) => ({
  MINI_PROGRAM: '小程序',
  CHANNELS: '视频号',
  WECHAT_ARTICLE: '公众号文章',
  CUSTOMER_SERVICE: '客服链接',
}[value] || value)

const formatNumber = (value) => Number(value || 0).toLocaleString('zh-CN')

const resetForm = (source = {}) => {
  Object.assign(form, emptyForm(), source, {
    activeRange: source.startsAt || source.endsAt ? [source.startsAt || null, source.endsAt || null] : [],
  })
}

const loadItems = async () => {
  loading.value = true
  try {
    items.value = await fetchDiscoveryPromotions()
  } catch (error) {
    message.error('发现页推广配置加载失败')
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  editingId.value = ''
  resetForm({ placement: activePlacement.value })
  editorVisible.value = true
}

const openEdit = (item) => {
  editingId.value = item.id
  resetForm(item)
  editorVisible.value = true
}

const uploadImage = async ({ file, onSuccess, onError }) => {
  uploadLoading.value = true
  try {
    const result = await uploadPublicFile(file)
    form.imageFileName = result.objectName
    onSuccess?.(result)
  } catch (error) {
    message.error('图片上传失败')
    onError?.(error)
  } finally {
    uploadLoading.value = false
  }
}

const validate = () => {
  if (!form.title.trim()) return '请填写展示名称'
  if (!form.imageFileName) return '请上传图片'
  if (form.targetType === 'MINI_PROGRAM' && !form.miniProgramAppId.trim()) return '请填写小程序 AppID'
  if (form.targetType === 'CHANNELS' && !form.channelsFinderUserName.trim()) return '请填写视频号 ID'
  if (form.targetType === 'WECHAT_ARTICLE' && !/^https:\/\//i.test(form.articleUrl.trim())) return '请填写 HTTPS 公众号文章链接'
  if (form.targetType === 'CUSTOMER_SERVICE' && !/^https:\/\/work\.weixin\.qq\.com\/kfid\//i.test(form.customerServiceUrl.trim())) return '请填写有效的企业微信客服链接'
  return ''
}

const submit = async () => {
  const validationMessage = validate()
  if (validationMessage) {
    message.warning(validationMessage)
    return
  }
  saving.value = true
  try {
    const payload = {
      placement: form.placement,
      title: form.title.trim(),
      imageFileName: form.imageFileName,
      targetType: form.targetType,
      miniProgramAppId: form.miniProgramAppId.trim(),
      miniProgramPath: form.miniProgramPath.trim(),
      miniProgramEnvVersion: form.miniProgramEnvVersion,
      channelsFinderUserName: form.channelsFinderUserName.trim(),
      channelsFeedId: form.channelsFeedId.trim(),
      articleUrl: form.articleUrl.trim(),
      customerServiceUrl: form.customerServiceUrl.trim(),
      sortOrder: Number(form.sortOrder) || 0,
      enabled: Boolean(form.enabled),
      startsAt: form.placement === 'BANNER' ? form.activeRange?.[0] || null : null,
      endsAt: form.placement === 'BANNER' ? form.activeRange?.[1] || null : null,
    }
    if (editingId.value) {
      await updateDiscoveryPromotion(editingId.value, payload)
    } else {
      await createDiscoveryPromotion(payload)
    }
    message.success('配置已保存')
    editorVisible.value = false
    await loadItems()
  } catch (error) {
    message.error('配置保存失败，请检查必填项')
  } finally {
    saving.value = false
  }
}

const removeItem = (item) => {
  Modal.confirm({
    title: `删除“${item.title}”`,
    content: '删除后发现页将立即停止展示此项。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await deleteDiscoveryPromotion(item.id)
      message.success('已删除')
      await loadItems()
    },
  })
}

onMounted(loadItems)
</script>

<template>
  <section class="promotion-page">
    <header class="page-heading">
      <div>
        <h1>发现页推广</h1>
        <p>管理临时 Banner 与长期生态伙伴入口，曝光和点击由平台统一统计。</p>
      </div>
      <a-button type="primary" @click="openCreate"><PlusOutlined />新增配置</a-button>
    </header>

    <a-tabs v-model:activeKey="activePlacement" class="placement-tabs">
      <a-tab-pane key="BANNER" tab="Banner 图片" />
      <a-tab-pane key="PARTNER_BUTTON" tab="生态伙伴按钮" />
    </a-tabs>

    <a-spin :spinning="loading">
      <div v-if="filteredItems.length" class="promotion-grid">
        <article v-for="item in filteredItems" :key="item.id" class="promotion-card">
          <div :class="['media-preview', { 'is-button': item.placement === 'PARTNER_BUTTON' }]">
            <img :src="buildDownloadUrl(item.imageFileName)" :alt="item.title" />
            <span :class="['status-dot', { disabled: !item.enabled }]">{{ item.enabled ? '展示中' : '已停用' }}</span>
          </div>
          <div class="promotion-body">
            <div class="title-row">
              <strong>{{ item.title }}</strong>
              <span>{{ targetLabel(item.targetType) }}</span>
            </div>
            <div class="metrics">
              <div><b>{{ formatNumber(item.exposureCount) }}</b><span>总曝光</span></div>
              <div><b>{{ formatNumber(item.clickCount) }}</b><span>总点击</span></div>
              <div><b>{{ item.sortOrder }}</b><span>排序</span></div>
            </div>
            <div class="card-actions">
              <a-button size="small" @click="openEdit(item)"><EditOutlined />编辑</a-button>
              <a-button size="small" danger @click="removeItem(item)"><DeleteOutlined />删除</a-button>
            </div>
          </div>
        </article>
      </div>
      <a-empty v-else :description="`暂无${placementLabel(activePlacement)}配置`" />
    </a-spin>

    <a-modal
      v-model:open="editorVisible"
      :title="editingId ? '编辑推广项' : '新增推广项'"
      width="680px"
      :confirm-loading="saving"
      ok-text="保存"
      cancel-text="取消"
      @ok="submit"
    >
      <a-form layout="vertical" class="editor-form">
        <div class="form-grid">
          <a-form-item label="展示区域" required>
            <a-segmented v-model:value="form.placement" :options="[
              { label: 'Banner 图片', value: 'BANNER' },
              { label: '生态伙伴按钮', value: 'PARTNER_BUTTON' },
            ]" />
          </a-form-item>
          <a-form-item label="展示状态">
            <a-switch v-model:checked="form.enabled" checked-children="启用" un-checked-children="停用" />
          </a-form-item>
        </div>

        <div class="form-grid">
          <a-form-item label="展示名称" required>
            <a-input v-model:value="form.title" :maxlength="30" placeholder="用于发现页标题与跳转确认" />
          </a-form-item>
          <a-form-item label="排序">
            <a-input-number v-model:value="form.sortOrder" :min="-9999" :max="9999" style="width: 100%" />
          </a-form-item>
        </div>

        <a-form-item :label="form.placement === 'BANNER' ? 'Banner 图片' : '伙伴 Logo'" required>
          <div class="upload-row">
            <div :class="['upload-preview', { compact: form.placement === 'PARTNER_BUTTON' }]">
              <img v-if="form.imageFileName" :src="buildDownloadUrl(form.imageFileName)" alt="preview" />
              <span v-else>暂无图片</span>
            </div>
            <a-upload accept="image/*" :show-upload-list="false" :custom-request="uploadImage">
              <a-button :loading="uploadLoading"><UploadOutlined />上传图片</a-button>
            </a-upload>
          </div>
        </a-form-item>

        <a-form-item v-if="form.placement === 'BANNER'" label="展示时间">
          <a-range-picker
            v-model:value="form.activeRange"
            show-time
            value-format="YYYY-MM-DDTHH:mm:ss"
            style="width: 100%"
            :placeholder="['开始时间（可空）', '结束时间（可空）']"
          />
        </a-form-item>

        <a-divider>跳转设置</a-divider>
        <a-form-item label="跳转类型" required>
          <a-radio-group v-model:value="form.targetType">
            <a-radio-button value="MINI_PROGRAM">小程序</a-radio-button>
            <a-radio-button value="CHANNELS">视频号</a-radio-button>
            <a-radio-button value="WECHAT_ARTICLE">公众号文章</a-radio-button>
            <a-radio-button value="CUSTOMER_SERVICE">客服链接</a-radio-button>
          </a-radio-group>
        </a-form-item>

        <template v-if="form.targetType === 'MINI_PROGRAM'">
          <div class="form-grid">
            <a-form-item label="小程序 AppID" required><a-input v-model:value="form.miniProgramAppId" /></a-form-item>
            <a-form-item label="版本"><a-select v-model:value="form.miniProgramEnvVersion" :options="[
              { label: '正式版', value: 'release' }, { label: '体验版', value: 'trial' }, { label: '开发版', value: 'develop' },
            ]" /></a-form-item>
          </div>
          <a-form-item label="页面路径"><a-input v-model:value="form.miniProgramPath" placeholder="pages/index/index?source=discover" /></a-form-item>
        </template>

        <template v-else-if="form.targetType === 'CHANNELS'">
          <div class="form-grid">
            <a-form-item label="视频号 ID" required><a-input v-model:value="form.channelsFinderUserName" placeholder="sph 开头" /></a-form-item>
            <a-form-item label="视频 Feed ID"><a-input v-model:value="form.channelsFeedId" placeholder="留空时打开视频号主页" /></a-form-item>
          </div>
        </template>

        <a-form-item v-else-if="form.targetType === 'WECHAT_ARTICLE'" label="公众号文章 HTTPS 链接" required>
          <a-input v-model:value="form.articleUrl" placeholder="https://mp.weixin.qq.com/s/..." />
        </a-form-item>
        <a-form-item v-else label="企业微信客服链接" required>
          <a-input v-model:value="form.customerServiceUrl" placeholder="https://work.weixin.qq.com/kfid/..." />
        </a-form-item>
      </a-form>
    </a-modal>
  </section>
</template>

<style scoped>
.promotion-page { color: #111827; }
.page-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; margin-bottom: 18px; }
.page-heading h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
.page-heading p { margin: 8px 0 0; color: #6b7280; }
.placement-tabs { margin-bottom: 18px; }
.promotion-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.promotion-card { overflow: hidden; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; }
.media-preview { position: relative; height: 150px; background: #f3f4f6; }
.media-preview.is-button { height: 112px; }
.media-preview img { width: 100%; height: 100%; object-fit: contain; }
.status-dot { position: absolute; top: 10px; right: 10px; padding: 3px 8px; border-radius: 4px; background: #111827; color: #fff; font-size: 12px; }
.status-dot.disabled { background: #9ca3af; }
.promotion-body { padding: 14px; }
.title-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.title-row strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.title-row span { flex: 0 0 auto; color: #6b7280; font-size: 12px; }
.metrics { display: grid; grid-template-columns: repeat(3, 1fr); margin: 16px 0; border-top: 1px solid #eef0f2; border-bottom: 1px solid #eef0f2; }
.metrics div { padding: 10px 6px; text-align: center; border-right: 1px solid #eef0f2; }
.metrics div:last-child { border-right: 0; }
.metrics b, .metrics span { display: block; }
.metrics b { font-size: 18px; }
.metrics span { margin-top: 3px; color: #6b7280; font-size: 12px; }
.card-actions { display: flex; justify-content: flex-end; gap: 8px; }
.form-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(180px, 0.55fr); gap: 16px; }
.upload-row { display: flex; align-items: center; gap: 16px; }
.upload-preview { width: 240px; height: 100px; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #f5f6f8; border: 1px solid #d9dde3; border-radius: 6px; color: #9ca3af; }
.upload-preview.compact { width: 90px; height: 90px; }
.upload-preview img { width: 100%; height: 100%; object-fit: contain; }
@media (max-width: 720px) { .page-heading, .upload-row { align-items: stretch; flex-direction: column; } .form-grid { grid-template-columns: 1fr; gap: 0; } }
</style>
