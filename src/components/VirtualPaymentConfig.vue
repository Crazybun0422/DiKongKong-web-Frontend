<script setup>
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import http from '../services/http'
const form = reactive({ enabled: false, offerId: '', env: 0, appKey: '', sandboxAppKey: '', callbackToken: '', encodingAesKey: '', miniProgramOriginalId: '', products: [] })
const flags = ref({}), loading = ref(false), saving = ref(false), error = ref(''), success = ref('')
const names = { MONTHLY: '月会员', YEARLY: '年会员', LIFETIME: '终身会员', CIRCLE_UNLOCK: '群解锁' }
const callbackUrl = new URL(String(http.defaults.baseURL || '/api').replace(/\/$/, '') + '/payments/virtual/callback', window.location.origin).href
function accept(data) { Object.assign(form, data.config); flags.value = data; error.value = '' }
function responseMessage(data) {
  const m = data?.message
  return typeof m === 'string' ? m : m?.['zh-CN'] || m?.zh || m?.en
}
function configFrom(response) {
  const body = response?.data
  if (body?.success === false) throw new Error(responseMessage(body) || '配置保存失败，请重试')
  if (!body?.data?.config || !Array.isArray(body.data.config.products)) throw new Error('服务器未返回有效的虚拟支付配置，请检查后端版本')
  return body.data
}
function explain(e) {
  const detail = responseMessage(e?.response?.data)
  if (detail) return detail
  if (e?.response?.status === 401) return '登录已失效，请重新登录后保存'
  if (e?.code === 'ECONNABORTED') return '请求超时，请重新加载确认是否保存成功'
  if (e?.code === 'ERR_NETWORK') return '无法连接服务器，请检查网络后重试'
  return e?.message || '请求失败，请重试'
}
async function load() {
  if (loading.value || saving.value) return
  loading.value = true
  error.value = ''; success.value = ''
  try { accept(configFrom(await http.get('/config/virtual-payment'))) }
  catch (e) { error.value = explain(e) }
  finally { loading.value = false }
}
async function save() {
  if (loading.value || saving.value) return
  saving.value = true
  error.value = ''; success.value = ''
  try {
    accept(configFrom(await http.put('/config/virtual-payment', form)))
    success.value = '虚拟支付配置已保存'
    message.success(success.value)
  }
  catch (e) { error.value = explain(e); message.error(error.value) }
  finally { saving.value = false }
}
onMounted(load)
</script>

<template>
  <a-card title="微信虚拟支付 · 会员与群解锁" style="margin-bottom:24px">
    <a-alert type="info" show-icon message="使用小程序虚拟支付的 OfferID / AppKey。Android、鸿蒙通过小程序收银台完成支付。" style="margin-bottom:20px" />
    <a-spin :spinning="loading">
      <a-form :model="form" layout="vertical" @finish="save">
        <a-form-item label="开放虚拟支付"><a-switch v-model:checked="form.enabled" /></a-form-item>
        <a-row :gutter="24">
          <a-col :xs="24" :md="12"><a-form-item label="OfferID"><a-input v-model:value="form.offerId" /></a-form-item></a-col>
          <a-col :xs="24" :md="12"><a-form-item label="支付环境"><a-select v-model:value="form.env" :options="[{value:0,label:'正式环境'},{value:1,label:'沙箱环境（体验版）'}]" /></a-form-item></a-col>
          <a-col v-for="field in ['appKey','sandboxAppKey','callbackToken','encodingAesKey']" :key="field" :xs="24" :md="12">
            <a-form-item :label="{appKey:'正式环境 AppKey',sandboxAppKey:'沙箱 AppKey',callbackToken:'支付结果回调验签 Token',encodingAesKey:'支付回调 EncodingAESKey（安全模式）'}[field]">
              <a-input-password v-model:value="form[field]" autocomplete="new-password" :placeholder="flags[field+'Configured'] ? '已保存，留空保留原值' : '尚未配置'" />
            </a-form-item>
          </a-col>
          <a-col :span="24"><a-form-item label="小程序原始 ID（Android 唤起使用）"><a-input v-model:value="form.miniProgramOriginalId" placeholder="gh_ 开头，留空使用 App 已配置的小程序" /></a-form-item></a-col>
        </a-row>
        <p>支付回调地址：<a-typography-text :copyable="{ text: callbackUrl }">{{ callbackUrl }}</a-typography-text></p>
        <p>回调 Token 用于验证微信发来的支付结果，与用户订阅通知无关。请与微信小程序消息推送配置保持一致。</p>
        <p>道具价格须与微信已发布价格一致，单位为分。不同群价格分别添加道具；会员折扣保持原规则。</p>
        <div v-for="(product,index) in form.products" :key="index" class="product">
          <span>{{ names[product.business] }}</span>
          <a-input v-model:value="product.productId" aria-label="道具 ID" placeholder="道具 ID" />
          <a-input-number v-model:value="product.priceFen" aria-label="道具价格（分）" :min="1" :precision="0" addon-after="分" />
          <a-button v-if="product.business==='CIRCLE_UNLOCK'" danger @click="form.products.splice(index,1)">移除</a-button>
        </div>
        <a-button @click="form.products.push({business:'CIRCLE_UNLOCK',productId:'',priceFen:199})">添加群价格道具</a-button>
        <a-alert v-if="error" type="error" show-icon :message="error" style="margin-top:16px" />
        <a-alert v-if="success" type="success" show-icon :message="success" style="margin-top:16px" />
        <a-space style="margin-top:24px"><a-button type="primary" html-type="submit" :loading="saving" :disabled="loading || saving">保存配置</a-button><a-button @click="load" :disabled="saving || loading">重新加载</a-button></a-space>
      </a-form>
    </a-spin>
  </a-card>
</template>
<style scoped>
.product{display:grid;grid-template-columns:90px minmax(120px,1fr) 180px 70px;gap:12px;align-items:center;margin:12px 0}.product :deep(.ant-input-number-group-wrapper){width:100%}p{line-height:1.7;overflow-wrap:anywhere}@media(max-width:650px){.product{grid-template-columns:80px minmax(100px,1fr)} }
</style>
