<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { message } from 'ant-design-vue'
import { fetchTownChildren, fetchTownGeometry, searchTownRegions } from '../../services/townRegions'
defineProps({ disabled: Boolean })
const emit = defineEmits(['select'])
const open = ref(false), busy = ref(false), nodes = ref([]), revision = ref(''), path = ref([])
const keyword = ref(''), results = ref([]), total = ref(0), page = ref(1)
let request = 0
let timer
const search = async (nextPage = 1) => {
  clearTimeout(timer)
  if (!keyword.value.trim()) return
  const seq = ++request; busy.value = true; page.value = nextPage
  try {
    const result = await searchTownRegions(keyword.value.trim(), revision.value, nextPage - 1)
    if (seq !== request) return
    results.value = result.items; total.value = result.total; revision.value = result.revision
  } catch (e) { if (seq === request) message.error(e.response?.data?.message?.zh || '镇级区域搜索失败') }
  finally { if (seq === request) busy.value = false }
}
watch(keyword, value => {
  clearTimeout(timer); ++request; results.value = []; total.value = 0; page.value = 1
  busy.value = Boolean(value.trim())
  if (value.trim()) timer = setTimeout(() => search(), 300)
})
onBeforeUnmount(() => { clearTimeout(timer); ++request })
const close = () => { open.value = false; keyword.value = '' }
const load = async (parent = '', trail = []) => {
  const seq = ++request; busy.value = true
  try { const result = await fetchTownChildren(parent, parent ? revision.value : ''); if (seq !== request) return
    nodes.value = result.items; revision.value = result.revision; path.value = trail; open.value = true
  } catch (e) { message.error(e.response?.data?.message?.zh || '镇级区域加载失败') } finally { if (seq === request) busy.value = false }
}
const choose = async node => {
  if (node.level !== 'town') return load(node.id, [...path.value, node])
  const seq = ++request; busy.value = true
  try { const geo = await fetchTownGeometry(node.id, revision.value); if (seq !== request) return; emit('select', geo); message.success(`已加载 ${node.name}`) }
  catch (e) { if (seq === request) message.error(e.response?.data?.message?.zh || '镇级边界下载失败') } finally { if (seq === request) busy.value = false }
}
</script>
<template>
  <div class="town-region-picker">
    <a-button :disabled="disabled || busy" @click="open ? close() : load()">{{ open ? '收起镇级区域库' : '加载镇级范围' }}</a-button>
    <a-spin :spinning="busy">
      <div v-if="open">
        <a-input-search v-model:value="keyword" allow-clear :maxlength="80" :disabled="disabled" placeholder="搜索镇、街道或省市县，例如：长沙 青山镇" style="margin-top: 12px" @search="search()" />
        <p v-if="keyword.trim()">找到 {{ total }} 个镇级范围</p>
        <p v-else>{{ path.map(n => n.name).join(' / ') || '选择省份' }}</p>
        <a-button v-if="!keyword.trim() && path.length" size="small" :disabled="busy" @click="load(path.length > 1 ? path[path.length - 2].id : '', path.slice(0, -1))">返回上级</a-button>
        <div style="max-height: 260px; overflow: auto; margin-top: 8px">
          <a-button v-for="node in (keyword.trim() ? results : nodes)" :key="node.id" block type="text" :disabled="disabled || busy" :style="node.path ? {height: 'auto', textAlign: 'left', whiteSpace: 'normal', padding: '8px'} : {}" @click="choose(node)">
            <span>{{ node.name }}{{ node.level === 'town' ? '' : ' ›' }}</span>
            <small v-if="node.path" style="display: block; color: #667085">{{ node.path }}</small>
          </a-button>
          <a-empty v-if="!busy && !(keyword.trim() ? results : nodes).length" :description="keyword.trim() ? '未找到匹配的镇或街道' : '暂无区域'" />
        </div>
        <a-pagination v-if="keyword.trim() && total > 30" :current="page" :total="total" :page-size="30" :show-size-changer="false" size="small" :disabled="busy" @change="search" />
      </div>
    </a-spin>
  </div>
</template>
