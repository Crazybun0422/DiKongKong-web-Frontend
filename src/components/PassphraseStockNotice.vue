<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import http from '../services/http'

const router = useRouter()
const stock = ref(null), failed = ref(false), loading = ref(false)
let disposed = false, timer
const title = computed(() => stock.value?.exhausted ? '口令词库已用完，请及时补充' : `口令库存不足：还剩 ${stock.value?.remaining || 0} 条`)
const description = computed(() => {
  if (!stock.value?.exhausted) return `每天使用一条口令，当前还能供后续 ${stock.value.remaining} 天使用，请及时上传新词语。`
  return stock.value.todayAvailable ? '今日口令仍可领取；明日起将没有可用口令，请补充词库。' : '今日暂无可用口令，领取暂未开放，请补充词库。'
})
async function refresh() {
  if (loading.value || disposed) return
  loading.value = true
  try {
    const { data } = await http.get('/community-passphrases/admin/stock')
    if (!data?.success || !Number.isInteger(data.data?.remaining)) throw new Error('invalid-stock')
    if (!disposed) { stock.value = data.data; failed.value = false }
  } catch { if (!disposed) failed.value = true }
  finally { if (!disposed) loading.value = false }
}
function onVisible() { if (document.visibilityState === 'visible') refresh() }
onMounted(() => {
  refresh()
  document.addEventListener('visibilitychange', onVisible)
  timer = setInterval(() => { if (document.visibilityState === 'visible') refresh() }, 60000)
})
onBeforeUnmount(() => { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible) })
</script>

<template>
  <a-alert v-if="stock?.low" class="stock-notice" :type="stock.exhausted ? 'error' : 'warning'" show-icon :message="title">
    <template #description>{{ description }}<span v-if="failed">（状态更新失败，请刷新）</span></template>
    <template #action><a-button type="primary" @click="router.push({ name: 'flpPool', hash: '#community-passphrase' })">补充口令</a-button></template>
  </a-alert>
  <a-alert v-else-if="failed" class="stock-notice" type="warning" show-icon message="口令库存暂时无法读取">
    <template #action><a-button :loading="loading" @click="refresh">重试</a-button></template>
  </a-alert>
</template>

<style scoped>
.stock-notice{margin-bottom:20px;text-align:left}
</style>
