<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import http from '../services/http'
import { resolveProfileAsset } from '../services/profile'

const props = defineProps({ event: { type: Object, default: null } })
const emit = defineEmits(['close'])
const rows = ref([]), loading = ref(false), hasMore = ref(false), failure = ref('')
let generation = 0, retryOlder = false
const date = value => new Date(value).toLocaleString('zh-CN', { hour12: false })

async function load(older = false) {
  const id = props.event?.id
  if (!id || (older && (loading.value || !hasMore.value))) return
  const version = ++generation
  const before = older ? rows.value.at(-1)?.id : undefined
  retryOlder = older
  loading.value = true
  failure.value = ''
  if (!older) { rows.value = []; hasMore.value = false }
  try {
    const response = await http.get(`/flight-meetups/admin/${encodeURIComponent(id)}/messages`, { params: { before } })
    if (version !== generation || props.event?.id !== id) return
    const result = response.data?.data
    if (!response.data?.success || !Array.isArray(result?.items)) throw new Error('留言加载失败，请重试')
    // Server pages are chronological; display the newest first and retain string IDs.
    const incoming = [...result.items].reverse().map(item => ({ ...item, avatar: resolveProfileAsset(item.sender?.avatarUrl) }))
    const seen = new Set(rows.value.map(item => item.id))
    rows.value = [...rows.value, ...incoming.filter(item => !seen.has(item.id))]
    hasMore.value = result.hasMore === true
  } catch (error) {
    if (version === generation && props.event?.id === id) failure.value = error.response?.data?.message?.zh || error.message || '留言加载失败，请重试'
  } finally { if (version === generation) loading.value = false }
}
watch(() => props.event?.id, () => {
  generation++
  rows.value = []; hasMore.value = false; failure.value = ''; loading.value = false
  if (props.event) load()
}, { immediate: true })
onBeforeUnmount(() => { generation++ })
</script>

<template>
  <a-drawer :open="!!event" title="约飞留言板" width="min(680px, 100vw)" @close="emit('close')">
    <div class="meetup-board-admin">
      <div class="board-toolbar"><div><h3>{{ event?.title }}</h3><p>最新留言在前 · 已加载 {{ rows.length }} 条</p></div><a-button :loading="loading" @click="load()">刷新留言</a-button></div>
      <a-alert v-if="failure" type="error" show-icon :message="failure" class="board-error"><template #action><a-button size="small" @click="load(retryOlder)">重试</a-button></template></a-alert>
      <a-spin :spinning="loading && !rows.length">
        <a-empty v-if="!loading && !failure && !rows.length" description="暂无留言" />
        <div v-for="item in rows" :key="item.id" class="board-message">
          <a-avatar :src="item.avatar" :size="36">{{ item.sender?.name?.slice(0, 1) || '飞' }}</a-avatar>
          <div class="board-message-body">
            <div class="board-message-heading"><strong>{{ item.sender?.name || '飞友' }}</strong><time>{{ date(item.createdAt) }}</time></div>
            <div class="board-sender-code">低空号：{{ item.sender?.featureCode || '—' }}</div>
            <div class="board-message-content">{{ item.content }}</div>
          </div>
        </div>
      </a-spin>
      <div v-if="rows.length" class="board-footer"><a-button v-if="hasMore" :loading="loading" @click="load(true)">加载更早留言</a-button><span v-else>已显示全部留言</span></div>
    </div>
  </a-drawer>
</template>

<style scoped>
.board-toolbar{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:24px}.board-toolbar h3{margin:0 0 8px;overflow-wrap:anywhere}.board-toolbar p,.board-sender-code,.board-footer{color:var(--admin-muted);font-size:12px}.board-toolbar p{margin:0}.board-error{margin-bottom:16px}.board-message{display:flex;gap:12px;padding:18px 0;border-bottom:1px solid var(--admin-line)}.board-message .ant-avatar{flex-shrink:0}.board-message-body{flex:1;min-width:0}.board-message-heading{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}.board-message-heading time{font-size:12px;color:var(--admin-muted)}.board-sender-code{margin-top:3px}.board-message-content{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.8;margin-top:12px;color:#294768}.board-footer{text-align:center;padding:24px 0}
</style>
